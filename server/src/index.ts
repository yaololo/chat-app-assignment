import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  },
});

httpServer.listen(port, () => {
  console.info(`Server listening on port ${port}`);
});
