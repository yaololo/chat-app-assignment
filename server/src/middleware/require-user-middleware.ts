import type { RequestHandler } from "express";
import { prisma } from "../db.js";
import { readUser } from "../utils/token-helper.js";

export const requireUser: RequestHandler = async (req, res, next) => {
  const user = readUser(req);
  if (
    !user ||
    !(await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    }))
  ) {
    res.status(401).json({ error: "Please sign in." });
    return;
  }
  res.locals.userId = user.id;
  next();
};
