import { chatEvents } from "../realtime/events.js";
import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { prisma } from "../db.js";
import { cookieName, cookieOptions, lifetime } from "./cookie.js";
import { createToken } from "./token-helper.js";

// Shared access is intentional for this demo: anyone with the secret can use any username.
const DEMO_SECRET = "chat-demo-2026";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

// JSON-only login prevents cross-site HTML forms from creating a session.
export const login: RequestHandler = async (req, res) => {
  if (!req.is("application/json")) {
    res.status(415).json({ error: "Use application/json." });
    return;
  }
  const { username, secret } = req.body ?? {};
  if (
    typeof username !== "string" ||
    typeof secret !== "string" ||
    secret.length > 256
  ) {
    res.status(400).json({ error: "Enter a username and access secret." });
    return;
  }
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(normalized)) {
    res
      .status(400)
      .json({
        error: "Use 3–32 letters, numbers, or underscores for your username.",
      });
    return;
  }
  if (
    !timingSafeEqual(
      Buffer.from(hash(secret), "hex"),
      Buffer.from(hash(DEMO_SECRET), "hex"),
    )
  ) {
    res.status(401).json({ error: "Incorrect access secret." });
    return;
  }
  // Database upsert preserves one user per normalized username under concurrent logins.
  const user = await prisma.user.upsert({
    where: { username: normalized },
    update: {},
    create: { username: normalized },
    select: { id: true, username: true },
  });
  chatEvents.emit("users:changed");
  const token = createToken(user);
  res
    .cookie(cookieName, token, { ...cookieOptions, maxAge: lifetime })
    .json({ user });
};
