export type User = { id: string; username: string };

export const getSession = async (
  signal?: AbortSignal,
): Promise<User | null> => {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    signal,
  });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error("Unable to restore your session. Please try signing in.");
  return (await response.json()).user;
};

export const login = async (
  username: string,
  secret: string,
): Promise<User> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, secret }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to sign in.");
  return data.user;
};

export const logout = async (): Promise<void> => {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("Unable to sign out. Please try again.");
};
