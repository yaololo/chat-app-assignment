import type { RequestHandler } from "express";
import { prisma } from "../db.js";

export const messageMiddleware: RequestHandler = async (req, res, next) => {
  const otherUserId = req.params.id;
  if (
    typeof otherUserId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      otherUserId,
    ) ||
    otherUserId === res.locals.userId
  ) {
    res.status(400).json({ error: "Choose another registered user." });
    return;
  }
  if (
    !(await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    }))
  ) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const currentUserId = res.locals.userId as string;
  const [firstUserId, secondUserId] = [
    currentUserId,
    otherUserId.toLowerCase(),
  ].sort();
  res.locals.conversationUsers = { firstUserId, secondUserId };
  next();
};