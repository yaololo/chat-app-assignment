import { Router } from "express";
import { readUser } from "../auth/token-helper.js";
import { prisma } from "../db.js";
import { listUsers } from "./list-users.js";
import { getMessages } from "./get-messages.js";
import { sendMessage } from "./send-message.js";

export const chat = Router();

chat.use(async (req, res, next) => {
  res.set("Cache-Control", "no-store");
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
});
chat.get("/users", listUsers);
chat.use("/users/:id/messages", async (req, res, next) => {
  const id = req.params.id;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    id === res.locals.userId
  ) {
    res.status(400).json({ error: "Choose another registered user." });
    return;
  }
  if (
    !(await prisma.user.findUnique({ where: { id }, select: { id: true } }))
  ) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const [directUserLow, directUserHigh] = [
    res.locals.userId,
    id.toLowerCase(),
  ].sort();
  res.locals.pair = { directUserLow, directUserHigh };
  next();
});
chat.get("/users/:id/messages", getMessages);
chat.post("/users/:id/messages", sendMessage);
