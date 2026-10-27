import type { RequestHandler } from "express";
import { prisma } from "../db.js";
export const getMessages: RequestHandler = async (_req, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { directUserLow_directUserHigh: res.locals.pair },
  });
  if (!conversation) {
    res.json({ messages: [] });
    return;
  }
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: res.locals.userId,
      },
    },
  });
  if (!member) {
    res.status(403).json({ error: "Conversation access denied." });
    return;
  }
  // Bound polling payloads; older-history pagination is a separate feature.
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  res.json({ messages: messages.reverse() });
};
