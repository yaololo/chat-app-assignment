import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import { useSignIn } from "../../lib/auth/hooks/useSignIn";
import { useState, type SubmitEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuthStore } from "../../store/store";
import "./signin.css";

export const SigninPage = () => {
  const user = useAuthStore((state) => state.user);
  const restorationError = useAuthStore((state) => state.restorationError);
  const signIn = useSignIn();
  const busy = signIn.isPending;
  const error = signIn.error?.message;
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const from: unknown = location.state?.from;
  const destination =
    typeof from === "string" && /^\/chat(?:\/|$)/.test(from) ? from : "/chat";

  if (user) return <Navigate to={destination} replace />;

  const login = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    signIn.mutate({ username, secret }, { onSuccess: () => setSecret("") });
  };

  return (
    <div className="signin-page">
      {restorationError && (
        <p className="error" role="alert">
          {restorationError}
        </p>
      )}
      <div className="eyebrow">A LITTLE SPACE TO CONNECT</div>
      <h1>
        Good conversations
        <br />
        start here.
      </h1>
      <p className="intro">
        Choose a username and enter your demo access secret. New here? We’ll
        create your account automatically.
      </p>
      <form onSubmit={login}>
        <label htmlFor="username">Username</label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="e.g. alice"
          required
          minLength={3}
          maxLength={32}
          pattern="[A-Za-z0-9_]{3,32}"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-describedby="username-help"
          disabled={busy}
        />
        <small id="username-help">
          3–32 letters, numbers, or underscores. Case insensitive.
        </small>
        <label htmlFor="secret">Demo access secret</label>
        <Input
          id="secret"
          name="secret"
          type="password"
          autoComplete="current-password"
          placeholder="Enter the secret you were given"
          required
          maxLength={256}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={busy}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Signing you in…" : "Join chat →"}
        </Button>
      </form>
      <p className="footnote">
        One shared secret for this demo. Use a demo username; anyone with access
        can sign in with it.
      </p>
    </div>
  );
};
