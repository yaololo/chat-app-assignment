import type { RequestHandler } from "express";
import { cookieName, cookieOptions } from "../utils/cookie.js";

export const logout: RequestHandler = (_req, res) => {
  // Stateless tokens cannot be individually revoked; clear this browser's cookie.
  res.clearCookie(cookieName, cookieOptions).status(204).end();
};
