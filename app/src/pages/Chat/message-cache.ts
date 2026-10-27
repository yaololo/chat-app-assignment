import type { Message } from "./api";

export const mergeMessage = (
  messages: Message[],
  message: Message,
): Message[] =>
  [...messages.filter((existing) => existing.id !== message.id), message]
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )
    .slice(-100);
