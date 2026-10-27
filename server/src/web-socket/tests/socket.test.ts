import { afterAll, beforeAll, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "node:events";
import { createServer, type IncomingMessage } from "node:http";
import type { Server, ServerOptions, Socket } from "socket.io";
import { prisma } from "../../db.js";
import { createToken } from "../../utils/token-helper.js";
import { attachRealtime } from "../socket.js";
import { chatEvents } from "../events.js";

type TestClient = {
  socket: {
    request: { headers: { cookie?: string } };
    data: { userId?: string };
    disconnect: () => void;
  };
  sent: { event: string; payload: unknown }[];
  typed: Socket;
};

let middleware: Parameters<Server["use"]>[0];
let onConnection: (socket: Socket) => void;
let options: Partial<ServerOptions>;
const sockets = new Map<string, Socket>();
const transport = {
  use: (handler: Parameters<Server["use"]>[0]) => {
    middleware = handler;
  },
  on: (event: string, handler: (socket: Socket) => void) => {
    expect(event).toBe("connection");
    onConnection = handler;
  },
  sockets: { sockets },
};
const httpServer = createServer();
const originalFindUnique = prisma.user.findUnique;
const findUser = jest.fn(async ({ where }: { where: { id: string } }) =>
  where.id === "deleted" ? null : { id: where.id },
);
const originalUserListeners = chatEvents.listenerCount("users:changed");
const originalMessageListeners = chatEvents.listenerCount("messages:changed");
let connected: TestClient[] = [];

beforeAll(() => {
  prisma.user.findUnique = findUser as unknown as typeof prisma.user.findUnique;
  attachRealtime(httpServer, (_server, configuration) => {
    options = configuration;
    return transport as unknown as Server;
  });
});

afterAll(async () => {
  connected.forEach((client) => client.socket.disconnect());
  httpServer.emit("close");
  prisma.user.findUnique = originalFindUnique;
  expect(chatEvents.listenerCount("users:changed")).toBe(originalUserListeners);
  expect(chatEvents.listenerCount("messages:changed")).toBe(
    originalMessageListeners,
  );
  await prisma.$disconnect();
});

const makeSocket = (id?: string): TestClient => {
  const events = new EventEmitter();
  const sent: TestClient["sent"] = [];
  const socket = {
    request: {
      headers: {
        cookie: id
          ? `chat_session=${createToken({ id, username: id })}`
          : undefined,
      },
    },
    data: {} as { userId?: string },
    emit: (event: string, payload?: unknown) => {
      sent.push({ event, payload });
    },
    on: (event: string, listener: () => void) => {
      events.on(event, listener);
    },
    disconnect: () => {
      events.emit("disconnect");
      if (id) sockets.delete(id);
    },
  };
  return { socket, sent, typed: socket as unknown as Socket };
};

const authenticate = (socket: Socket) =>
  new Promise<Error | undefined>((resolve) => {
    void middleware(socket, (error) => resolve(error));
  });

const allow = (origin?: string) =>
  new Promise<boolean>((resolve) => {
    options.allowRequest!(
      { headers: { host: "localhost:3000", origin } } as IncomingMessage,
      (_error, allowed) => resolve(allowed),
    );
  });

it("restricts socket handshakes to same-origin or configured origins", async () => {
  expect(options.transports).toEqual(["websocket"]);
  expect(await allow("http://localhost:3000")).toBe(true);
  expect(await allow("http://localhost:5173")).toBe(true);
  expect(await allow("https://untrusted.example")).toBe(false);
  expect(await allow("invalid-origin")).toBe(false);
  expect(await allow()).toBe(false);
});

it("rejects missing and deleted users but authenticates existing users", async () => {
  const missing = await authenticate(makeSocket().typed);
  expect((missing as Error & { data: { code: string } }).data.code).toBe(
    "UNAUTHORIZED",
  );
  expect(findUser).not.toHaveBeenCalled();
  expect((await authenticate(makeSocket("deleted").typed))?.message).toBe(
    "Please sign in.",
  );

  const alice = makeSocket("alice");
  expect(await authenticate(alice.typed)).toBeUndefined();
  expect(alice.socket.data.userId).toBe("alice");
});

it("routes notifications only to valid participants and removes listeners on close", async () => {
  connected = [];
  for (const id of ["alice", "bob", "eve"]) {
    const client = makeSocket(id);
    expect(await authenticate(client.typed)).toBeUndefined();
    sockets.set(id, client.typed);
    onConnection(client.typed);
    connected.push(client);
  }
  const [alice, bob, eve] = connected;

  chatEvents.emit("users:changed");
  for (const client of connected) {
    expect(client.sent).toContainEqual({
      event: "users:changed",
      payload: undefined,
    });
  }

  const message = {
    id: "message-1",
    senderId: "alice",
    content: "Hello",
    createdAt: "2026-10-27T00:00:00.000Z",
  };
  chatEvents.emit("messages:changed", "alice", "bob", message);
  expect(alice.sent.at(-1)).toEqual({
    event: "messages:changed",
    payload: { userId: "bob", message },
  });
  expect(bob.sent.at(-1)).toEqual({
    event: "messages:changed",
    payload: { userId: "alice", message },
  });
  expect(eve.sent).toHaveLength(1);

  alice.socket.request.headers.cookie = "chat_session=invalid";
  const aliceCount = alice.sent.length;
  chatEvents.emit("users:changed");
  chatEvents.emit("messages:changed", "alice", "bob", message);
  expect(alice.sent).toHaveLength(aliceCount);

  bob.socket.disconnect();
  const bobCount = bob.sent.length;
  chatEvents.emit("messages:changed", "alice", "bob", message);
  expect(bob.sent).toHaveLength(bobCount);

  httpServer.emit("close");
  expect(chatEvents.listenerCount("users:changed")).toBe(originalUserListeners);
  expect(chatEvents.listenerCount("messages:changed")).toBe(
    originalMessageListeners,
  );
  connected.forEach((client) => client.socket.disconnect());
  connected = [];
});
