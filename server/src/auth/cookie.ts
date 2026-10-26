export const lifetime = 7 * 24 * 60 * 60 * 1000;
export const cookieName = "chat_session";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
};
