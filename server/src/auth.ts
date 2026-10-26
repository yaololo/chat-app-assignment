import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import { prisma } from "./db.js";

export const auth = Router();

auth.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
// Shared access is intentional for this demo: anyone with the secret can use any username.
const DEMO_SECRET = "chat-demo-2026";
const lifetime = 7 * 24 * 60 * 60 * 1000;
const cookieName = "chat_session";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const signingSecret = process.env.AUTH_SIGNING_SECRET;
if (!signingSecret || Buffer.byteLength(signingSecret) < 32) {
  throw new Error("AUTH_SIGNING_SECRET must contain at least 32 bytes");
}
const sign = (payload: string) => createHmac("sha256", signingSecret).update(payload).digest("base64url");
const readUser = (req: Request): { id: string; username: string } | null => {
  const token = req.headers.cookie?.split(";").map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = sign(payload);
  if (signature.length !== expected.length || !/^[A-Za-z0-9_-]+$/.test(signature) ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.id !== "string" || typeof data.username !== "string" ||
        !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= Date.now()) return null;
    return { id: data.id, username: data.username };
  } catch { return null; }
};

// JSON-only login prevents cross-site HTML forms from creating a session.
auth.post("/login", async (req, res) => {
  if (!req.is("application/json")) { res.status(415).json({ error: "Use application/json." }); return; }
  const { username, secret } = req.body ?? {};
  if (typeof username !== "string" || typeof secret !== "string" || secret.length > 256) {
    res.status(400).json({ error: "Enter a username and access secret." }); return;
  }
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(normalized)) {
    res.status(400).json({ error: "Use 3–32 letters, numbers, or underscores for your username." }); return;
  }
  if (!timingSafeEqual(Buffer.from(hash(secret), "hex"), Buffer.from(hash(DEMO_SECRET), "hex"))) {
    res.status(401).json({ error: "Incorrect access secret." }); return;
  }
  // Database upsert preserves one user per normalized username under concurrent logins.
  const user = await prisma.user.upsert({
    where: { username: normalized }, update: {}, create: { username: normalized },
    select: { id: true, username: true },
  });
  const payload = Buffer.from(JSON.stringify({ ...user, expiresAt: Date.now() + lifetime })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: lifetime }).json({ user });
});

auth.get("/me", (req, res) => {
  const user = readUser(req);
  if (!user) {
    res.clearCookie(cookieName, cookieOptions).status(401).json({ error: "Please sign in." }); return;
  }
  res.json({ user });
});

auth.post("/logout", (_req, res) => {
  // Stateless tokens cannot be individually revoked; clear this browser's cookie.
  res.clearCookie(cookieName, cookieOptions).status(204).end();
});
