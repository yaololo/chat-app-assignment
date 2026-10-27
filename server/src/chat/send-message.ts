import { chatEvents } from "../realtime/events.js";
import type { RequestHandler } from "express";
import { prisma } from "../db.js";
export const sendMessage: RequestHandler = async (req, res) => {
  if (!req.is("application/json")) {
    res.status(415).json({ error: "Use application/json." });
    return;
  }
  const content = req.body?.content;
  if (typeof content !== "string" || !content.trim() || content.length > 4000) {
    res
      .status(400)
      .json({ error: "Enter a message of up to 4,000 characters." });
    return;
  }
  const pair = res.locals.pair;
  const where = { directUserLow_directUserHigh: pair };
  let conversation = await prisma.conversation.findUnique({ where });
  if (!conversation) {
    try {
      // Nested creation keeps the two memberships in the same transaction as the pair.
      conversation = await prisma.conversation.create({
        data: {
          type: "direct",
          ...pair,
          members: {
            create: [
              { userId: pair.directUserLow },
              { userId: pair.directUserHigh },
            ],
          },
        },
      });
    } catch (error) {
      // Two users may send their first message simultaneously. Reuse the winning pair.
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ))
        throw error;
      conversation = await prisma.conversation.findUniqueOrThrow({ where });
    }
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
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: res.locals.userId,
      content: content.trim(),
    },
  });
  chatEvents.emit("messages:changed", pair.directUserLow, pair.directUserHigh, {
    id: message.id,
    senderId: message.senderId,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  });
  res.status(201).json({ message });
};
