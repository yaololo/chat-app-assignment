import type { RequestHandler } from "express";
import { cookieName, cookieOptions } from "../utils/cookie.js";
import { readUser } from "../utils/token-helper.js";

export const getUser: RequestHandler = (req, res) => {
  const user = readUser(req);
  if (!user) {
    res
      .clearCookie(cookieName, cookieOptions)
      .status(401)
      .json({ error: "Please sign in." });
    return;
  }
  res.json({ user });
};
