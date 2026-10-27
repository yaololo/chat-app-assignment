import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer, type IncomingMessage } from "node:http";
import { EventEmitter } from "node:events";
import type { Server, ServerOptions, Socket } from "socket.io";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.AUTH_SIGNING_SECRET = "test-only-signing-key-at-least-32-bytes";
const { prisma } = await import("../../db.js");
const { createToken } = await import("../../auth/token-helper.js");
const { attachRealtime } = await import("../socket.js");
const { chatEvents } = await import("../events.js");

// Mock the transport boundary; exercise real auth and notification handlers.
// These tests need neither a listening port nor frontend dependencies.
test("authenticates sockets, checks origins, isolates notifications and cleans up", async (t) => {
  type Middleware = Parameters<Server["use"]>[0];
  let middleware!: Middleware;
  let onConnection!: (socket: Socket) => void;
  let options!: Partial<ServerOptions>;
  const sockets = new Map<string, Socket>();
  const transport = {
    use: (handler: Middleware) => {
      middleware = handler;
    },
    on: (event: string, handler: (socket: Socket) => void) => {
      assert.equal(event, "connection");
      onConnection = handler;
    },
    sockets: { sockets },
  };
  const httpServer = createServer();
  const beforeUsers = chatEvents.listenerCount("users:changed");
  const beforeMessages = chatEvents.listenerCount("messages:changed");
  const originalFind = prisma.user.findUnique;
  const findUser = t.mock.fn(async ({ where }: { where: { id: string } }) =>
    where.id === "deleted" ? null : { id: where.id },
  );
  prisma.user.findUnique = findUser as unknown as typeof prisma.user.findUnique;
  const io = attachRealtime(httpServer, (_server, configuration) => {
    options = configuration;
    return transport as unknown as Server;
  });
  assert.equal(io, transport);

  const makeSocket = (id?: string) => {
    const events = new EventEmitter();
    const sent: { event: string; payload: unknown }[] = [];
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
  const connected: ReturnType<typeof makeSocket>[] = [];
  try {
    assert.deepEqual(options.transports, ["websocket"]);
    assert.equal(await allow("http://localhost:3000"), true);
    assert.equal(await allow("https://untrusted.example"), false);
    assert.equal(await allow("invalid-origin"), false);
    assert.equal(await allow(), false);
    const missing = await authenticate(makeSocket().typed);
    assert.equal(
      (missing as Error & { data: { code: string } }).data.code,
      "UNAUTHORIZED",
    );
    assert.equal(findUser.mock.callCount(), 0);
    assert.equal(
      (await authenticate(makeSocket("deleted").typed))?.message,
      "Please sign in.",
    );

    for (const id of ["alice", "bob", "eve"]) {
      const client = makeSocket(id);
      assert.equal(await authenticate(client.typed), undefined);
      assert.equal(client.socket.data.userId, id);
      sockets.set(id, client.typed);
      onConnection(client.typed);
      connected.push(client);
    }
    const [alice, bob, eve] = connected;
    chatEvents.emit("users:changed");
    for (const client of connected)
      assert.deepEqual(client.sent, [
        { event: "users:changed", payload: undefined },
      ]);
    const message = {
      id: "message-1",
      senderId: "alice",
      content: "Hello",
      createdAt: "2026-10-27T00:00:00.000Z",
    };
    chatEvents.emit("messages:changed", "alice", "bob", message);
    assert.deepEqual(alice.sent.at(-1), {
      event: "messages:changed",
      payload: { userId: "bob", message },
    });
    assert.deepEqual(bob.sent.at(-1), {
      event: "messages:changed",
      payload: { userId: "alice", message },
    });
    assert.equal(eve.sent.length, 1);

    // Tampered/expired credentials must not receive any further notifications.
    alice.socket.request.headers.cookie = "chat_session=invalid";
    const count = alice.sent.length;
    chatEvents.emit("users:changed");
    chatEvents.emit("messages:changed", "alice", "bob", message);
    assert.equal(alice.sent.length, count);
    bob.socket.disconnect();
    const bobCount = bob.sent.length;
    chatEvents.emit("messages:changed", "alice", "bob", message);
    assert.equal(bob.sent.length, bobCount);
  } finally {
    connected.forEach((client) => client.socket.disconnect());
    httpServer.emit("close");
    assert.equal(chatEvents.listenerCount("users:changed"), beforeUsers);
    assert.equal(chatEvents.listenerCount("messages:changed"), beforeMessages);
    prisma.user.findUnique = originalFind;
    await prisma.$disconnect();
  }
});
