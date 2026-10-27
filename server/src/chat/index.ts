import { Router } from "express";
import { listUsers } from "./list-users.js";
import { getMessages } from "./get-messages.js";
import { messageMiddleware } from "./message-middleware.js";
import { sendMessage } from "./send-message.js";

export const chat = Router();

chat.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
chat.get("/users", listUsers);
chat.use("/users/:id/messages", messageMiddleware);
chat.get("/users/:id/messages", getMessages);
chat.post("/users/:id/messages", sendMessage);
