#!/usr/bin/env bash
set -Eeuo pipefail

# Usage: ./deploy.sh <git-repo-ssh-or-https-url> <public-domain> [branch]
# Example: ./deploy.sh git@github.com:OWNER/chat-app.git chat.example.com main

REPO_URL="${1:-}"
DOMAIN="${2:-}"
BRANCH="${3:-main}"
APP_DIR="${APP_DIR:-$HOME/apps/chat-app}"

if [[ -z "$REPO_URL" || -z "$DOMAIN" ]]; then
  echo 'Usage: ./deploy.sh <git-repo-url> <domain> [branch]' >&2
  exit 1
fi
if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ || "$DOMAIN" != *.* ]]; then
  echo 'Provide a valid domain, e.g. chat.example.com (not https://chat.example.com).' >&2
  exit 1
fi
for cmd in git docker openssl; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd. Install it before running this script." >&2; exit 1; }
done
docker compose version >/dev/null || { echo 'Docker Compose plugin is required.' >&2; exit 1; }
if ! docker info >/dev/null 2>&1; then
  echo 'Cannot access Docker daemon. Start Docker or add your user to docker group and reconnect.' >&2
  exit 1
fi

mkdir -p "$(dirname "$APP_DIR")"
if [[ -d "$APP_DIR/.git" ]]; then
  echo 'Updating existing checkout...'
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
elif [[ ! -e "$APP_DIR" ]]; then
  echo 'Cloning repository...'
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  echo "Destination $APP_DIR exists but is not a git checkout. Refusing to overwrite." >&2
  exit 1
fi
cd "$APP_DIR"
[[ -f docker-compose.yml ]] || { echo 'Missing docker-compose.yml at repository root.' >&2; exit 1; }

# Do not overwrite project-owned production configuration.
if [[ ! -f docker-compose.prod.yml ]]; then
  cat > docker-compose.prod.yml <<'YAML'
services:
  server:
    ports: !reset []
    expose:
      - "3000"
    environment:
      CLIENT_ORIGIN: https://${DOMAIN}
      COOKIE_SECURE: "true"

  caddy:
    image: caddy:2
    restart: unless-stopped
    depends_on:
      - server
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMAIN: ${DOMAIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
YAML
fi
if [[ ! -f Caddyfile ]]; then
  cat > Caddyfile <<'CADDY'
{$DOMAIN} {
    reverse_proxy server:3000
}
CADDY
fi

# Save secrets outside of version control; only create them on first deploy.
umask 077
if [[ ! -f .env ]]; then
  echo 'Creating .env with random initial credentials (save these securely).'
  DB_PASSWORD="$(openssl rand -hex 24)"
  AUTH_SECRET="$(openssl rand -hex 48)"
  cat > .env <<ENV
DOMAIN=$DOMAIN
POSTGRES_DB=chat_app
POSTGRES_USER=chat_app
POSTGRES_PASSWORD=$DB_PASSWORD
AUTH_SIGNING_SECRET=$AUTH_SECRET
ENV
else
  if grep -q '^DOMAIN=' .env; then
    sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN/" .env
  else
    printf '\nDOMAIN=%s\n' "$DOMAIN" >> .env
  fi
fi
chmod 600 .env

# Fail before starting containers if mandatory secrets are missing.
set -a
# shellcheck disable=SC1091
source ./.env
set +a
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD missing from .env}"
: "${AUTH_SIGNING_SECRET:?AUTH_SIGNING_SECRET missing from .env}"

echo 'Validating merged Compose configuration...'
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet

echo 'Building images and starting services...'
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans

echo
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
cat <<MESSAGE

Deployment started.
Public URL after DNS, OCI security rules and TLS succeed: https://$DOMAIN

NEXT STEPS:
1. Point DNS A record for $DOMAIN to this VM's public IP.
2. OCI VCN NSG/security list: allow inbound TCP 80 and 443.
3. Ubuntu firewall: allow 80/443 (if enabled).
4. Verify schema migrations ran (depends on your Dockerfile/entrypoint).
5. Check Caddy certificates: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f caddy
6. Verify the app, login, Socket.IO and chat history.

NOTE: Keep .env secret and back up the database; Docker named volumes do not survive boot-volume deletion.
MESSAGE
