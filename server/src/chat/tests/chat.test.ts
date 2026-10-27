import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { createHmac } from "node:crypto";
import { app } from "../../app.js";
import { prisma } from "../../db.js";
import { createToken } from "../../utils/token-helper.js";
import { chatEvents } from "../../web-socket/events.js";

const alice = {
  id: "00000000-0000-0000-0000-000000000001",
  username: "alice",
};
const bob = {
  id: "00000000-0000-0000-0000-000000000002",
  username: "bob",
};
const otherUser = {
  id: "00000000-0000-0000-0000-000000000003",
  username: "carol",
};
const conversation = { id: "conversation-1" };
type AsyncMock = (...args: any[]) => Promise<any>;
const original = {
  userFindUnique: prisma.user.findUnique,
  userFindMany: prisma.user.findMany,
  conversationFindUnique: prisma.conversation.findUnique,
  conversationFindUniqueOrThrow: prisma.conversation.findUniqueOrThrow,
  conversationCreate: prisma.conversation.create,
  memberFindUnique: prisma.conversationMember.findUnique,
  messageFindMany: prisma.message.findMany,
  messageCreate: prisma.message.create,
};
const userFindUnique = jest.fn<AsyncMock>();
const userFindMany = jest.fn<AsyncMock>();
const conversationFindUnique = jest.fn<AsyncMock>();
const conversationFindUniqueOrThrow = jest.fn<AsyncMock>();
const conversationCreate = jest.fn<AsyncMock>();
const memberFindUnique = jest.fn<AsyncMock>();
const messageFindMany = jest.fn<AsyncMock>();
const messageCreate = jest.fn<AsyncMock>();
let server: ReturnType<typeof app.listen>;
let base: string;

beforeAll(async () => {
  prisma.user.findUnique = userFindUnique as any;
  prisma.user.findMany = userFindMany as any;
  prisma.conversation.findUnique = conversationFindUnique as any;
  prisma.conversation.findUniqueOrThrow = conversationFindUniqueOrThrow as any;
  prisma.conversation.create = conversationCreate as any;
  prisma.conversationMember.findUnique = memberFindUnique as any;
  prisma.message.findMany = messageFindMany as any;
  prisma.message.create = messageCreate as any;

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test HTTP server did not bind to a TCP port.");
  }
  base = `http://127.0.0.1:${address.port}/api/chat`;
});

beforeEach(() => {
  userFindUnique
    .mockReset()
    .mockImplementation(
      async ({ where }: any) =>
        [alice, bob, otherUser].find((user) => user.id === where.id) ?? null,
    );
  userFindMany.mockReset().mockResolvedValue([bob, otherUser]);
  conversationFindUnique.mockReset().mockResolvedValue(conversation);
  conversationFindUniqueOrThrow.mockReset().mockResolvedValue(conversation);
  conversationCreate.mockReset().mockResolvedValue(conversation);
  memberFindUnique.mockReset().mockResolvedValue({ userId: alice.id });
  messageFindMany.mockReset().mockResolvedValue([]);
  messageCreate.mockReset().mockImplementation(async ({ data }: any) => ({
    ...data,
    id: "message-1",
    createdAt: new Date("2026-10-27T00:00:00.000Z"),
  }));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  prisma.user.findUnique = original.userFindUnique;
  prisma.user.findMany = original.userFindMany;
  prisma.conversation.findUnique = original.conversationFindUnique;
  prisma.conversation.findUniqueOrThrow =
    original.conversationFindUniqueOrThrow;
  prisma.conversation.create = original.conversationCreate;
  prisma.conversationMember.findUnique = original.memberFindUnique;
  prisma.message.findMany = original.messageFindMany;
  prisma.message.create = original.messageCreate;
  await prisma.$disconnect();
});

const cookie = `chat_session=${createToken(alice)}`;
const get = (path: string, session = cookie) =>
  fetch(`${base}${path}`, { headers: { cookie: session } });
const send = (
  content: unknown,
  options: { contentType?: string; raw?: string } = {},
) =>
  fetch(`${base}/users/${bob.id}/messages`, {
    method: "POST",
    headers: {
      cookie,
      "Content-Type": options.contentType ?? "application/json",
    },
    body: options.raw ?? JSON.stringify({ content, senderId: bob.id }),
  });

describe("chat API", () => {
  it("requires a valid, unexpired authenticated session on API routes", async () => {
    const expiredPayload = Buffer.from(
      JSON.stringify({ ...alice, expiresAt: 0 }),
    ).toString("base64url");
    const expiredSignature = createHmac(
      "sha256",
      process.env.AUTH_SIGNING_SECRET!,
    )
      .update(expiredPayload)
      .digest("base64url");

    expect((await get("/users", "")).status).toBe(401);
    expect((await get("/users", "chat_session=malformed")).status).toBe(401);
    expect(
      (
        await get(
          "/users",
          `chat_session=${expiredPayload}.${expiredSignature}`,
        )
      ).status,
    ).toBe(401);
    expect((await get("/users")).status).toBe(200);
  });

  it("rejects a correctly signed token for a user that no longer exists", async () => {
    userFindUnique.mockResolvedValue(null);

    const response = await get("/users");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Please sign in." });
  });

  it("lists other users and marks private responses as non-cacheable", async () => {
    const response = await get("/users");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ users: [bob, otherUser] });
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { not: alice.id } } }),
    );
  });

  it("validates the target user id before conversation routes", async () => {
    expect((await get("/users/not-a-uuid/messages")).status).toBe(400);
    expect((await get(`/users/${alice.id}/messages`)).status).toBe(400);
    userFindUnique.mockImplementation(async ({ where }: any) =>
      where.id === alice.id ? alice : null,
    );
    expect(
      (await get("/users/00000000-0000-0000-0000-000000000099/messages"))
        .status,
    ).toBe(404);
  });

  it("returns an empty list when no conversation exists", async () => {
    conversationFindUnique.mockResolvedValue(null);

    const response = await get(`/users/${bob.id}/messages`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ messages: [] });
    expect(memberFindUnique).not.toHaveBeenCalled();
    expect(messageFindMany).not.toHaveBeenCalled();
  });

  it("sorts the conversation user ids consistently regardless of requester", async () => {
    conversationFindUnique.mockResolvedValue(null);

    const response = await get(
      `/users/${alice.id}/messages`,
      `chat_session=${createToken(bob)}`,
    );

    expect(response.status).toBe(200);
    expect(conversationFindUnique).toHaveBeenCalledWith({
      where: {
        firstUserId_secondUserId: {
          firstUserId: alice.id,
          secondUserId: bob.id,
        },
      },
    });
  });

  it("returns recent history in chronological order for a conversation member", async () => {
    const newestFirst = [
      { id: "newest", createdAt: new Date("2026-10-27T00:02:00.000Z") },
      { id: "older", createdAt: new Date("2026-10-27T00:01:00.000Z") },
    ];
    messageFindMany.mockResolvedValue(newestFirst);
    const expectedChronological = [...newestFirst].reverse().map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    }));

    const response = await get(`/users/${bob.id}/messages`);

    expect(response.status).toBe(200);
    expect((await response.json()).messages).toEqual(expectedChronological);
    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: conversation.id },
        take: 100,
      }),
    );
  });

  it("denies history reads and sends when the authenticated user is not a member", async () => {
    memberFindUnique.mockResolvedValue(null);

    expect((await get(`/users/${bob.id}/messages`)).status).toBe(403);
    expect((await send("hello")).status).toBe(403);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("rejects non-JSON, malformed and invalid message bodies", async () => {
    expect(
      (await send("hello", { contentType: "text/plain", raw: "hello" })).status,
    ).toBe(415);
    expect((await send(null, { raw: "{" })).status).toBe(400);
    expect((await send(" ")).status).toBe(400);
    expect((await send(12)).status).toBe(400);
    expect((await send("a".repeat(4001))).status).toBe(400);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("trims valid message content and emits a notification after persistence", async () => {
    const listener = jest.fn();
    chatEvents.on("messages:changed", listener);
    try {
      const response = await send(" hello ");

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        message: {
          conversationId: conversation.id,
          senderId: alice.id,
          content: "hello",
          id: "message-1",
          createdAt: "2026-10-27T00:00:00.000Z",
        },
      });
      expect(messageCreate).toHaveBeenCalledWith({
        data: {
          conversationId: conversation.id,
          senderId: alice.id,
          content: "hello",
        },
      });
      expect(listener).toHaveBeenCalledWith(
        alice.id,
        bob.id,
        expect.objectContaining({
          id: "message-1",
          senderId: alice.id,
          content: "hello",
          createdAt: "2026-10-27T00:00:00.000Z",
        }),
      );
    } finally {
      chatEvents.off("messages:changed", listener);
    }
  });

  it("creates a new conversation with both memberships before saving its first message", async () => {
    conversationFindUnique.mockResolvedValue(null);

    const response = await send("first");

    expect(response.status).toBe(201);
    expect(conversationCreate).toHaveBeenCalledWith({
      data: {
        type: "direct",
        firstUserId: alice.id,
        secondUserId: bob.id,
        members: {
          create: [{ userId: alice.id }, { userId: bob.id }],
        },
      },
    });
    expect(messageCreate).toHaveBeenCalled();
  });

  it("recovers from concurrent first-message conversation creation", async () => {
    conversationFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(conversation);
    conversationCreate.mockRejectedValue({ code: "P2002" });

    const response = await send("first");

    expect(response.status).toBe(201);
    expect(conversationFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        firstUserId_secondUserId: {
          firstUserId: alice.id,
          secondUserId: bob.id,
        },
      },
    });
  });
});
