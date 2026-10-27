import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { cookieName, lifetime } from "./cookie.js";

const signingSecret = process.env.AUTH_SIGNING_SECRET;

if (!signingSecret || Buffer.byteLength(signingSecret) < 32) {
  throw new Error("AUTH_SIGNING_SECRET must contain at least 32 bytes");
}

const sign = (payload: string) =>
  createHmac("sha256", signingSecret).update(payload).digest("base64url");

export const readUser = (
  req: Pick<Request, "headers">,
): { id: string; username: string } | null => {
  const token = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  if (!token || token.length > 4096) return null;

  const parts = token.split(".");

  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = sign(payload);
  
  if (
    signature.length !== expected.length ||
    !/^[A-Za-z0-9_-]+$/.test(signature) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof data.id !== "string" ||
      typeof data.username !== "string" ||
      !Number.isSafeInteger(data.expiresAt) ||
      data.expiresAt <= Date.now()
    )
      return null;
    return { id: data.id, username: data.username };
  } catch {
    return null;
  }
};

export const createToken = (user: { id: string; username: string }): string => {
  const payload = Buffer.from(
    JSON.stringify({ ...user, expiresAt: Date.now() + lifetime }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
};
