import type { Server as HttpServer } from "node:http";
import { Server, type ServerOptions } from "socket.io";
import { readUser } from "../auth/token-helper.js";
import { prisma } from "../db.js";
import { chatEvents } from "./events.js";

type MessageNotification = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

type CreateSocketServer = (
  httpServer: HttpServer,
  options: Partial<ServerOptions>,
) => Server;

export const attachRealtime = (
  httpServer: HttpServer,
  createSocketServer: CreateSocketServer = (server, options) =>
    new Server(server, options),
) => {
  const io = createSocketServer(httpServer, {
    transports: ["websocket"],
    // CORS alone does not protect WebSocket handshakes authenticated by cookies.
    allowRequest: (req, done) => {
      const origin = req.headers.origin;
      let sameOrigin = false;
      try {
        sameOrigin = !!origin && new URL(origin).host === req.headers.host;
      } catch {
        /* invalid origin */
      }
      done(
        null,
        sameOrigin || (!!origin && origin === process.env.CLIENT_ORIGIN),
      );
    },
  });
  io.use(async (socket, next) => {
    try {
      const user = readUser(socket.request);
      if (
        !user ||
        !(await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true },
        }))
      ) {
        const error = new Error("Please sign in.") as Error & {
          data: { code: string };
        };
        error.data = { code: "UNAUTHORIZED" };
        next(error);
        return;
      }
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("Unable to connect. Please try again."));
    }
  });
  io.on("connection", (socket) => {
    // Existing connections must not outlive the signed cookie indefinitely.
    const expiryCheck = setInterval(() => {
      if (!readUser(socket.request)) {
        socket.emit("auth:expired");
        socket.disconnect(true);
      }
    }, 1000);
    expiryCheck.unref();
    socket.on("disconnect", () => clearInterval(expiryCheck));
  });
  const notifyUsers = () => {
    for (const socket of io.sockets.sockets.values()) {
      if (readUser(socket.request)) socket.emit("users:changed");
    }
  };
  const notifyMessages = (
    first: string,
    second: string,
    message: MessageNotification,
  ) => {
    for (const socket of io.sockets.sockets.values()) {
      const user = readUser(socket.request);
      if (user && (user.id === first || user.id === second)) {
        socket.emit("messages:changed", {
          userId: user.id === first ? second : first,
          message,
        });
      }
    }
  };
  chatEvents.on("users:changed", notifyUsers);
  chatEvents.on("messages:changed", notifyMessages);
  httpServer.once("close", () => {
    chatEvents.off("users:changed", notifyUsers);
    chatEvents.off("messages:changed", notifyMessages);
  });
  return io;
};
