import type { RequestHandler } from "express";
import { prisma } from "../db.js";

export const listUsers: RequestHandler = async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { id: { not: res.locals.userId } },
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });
  res.json({ users });
};
