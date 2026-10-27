import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createHmac } from "node:crypto";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.AUTH_SIGNING_SECRET = "test-only-signing-key-at-least-32-bytes";
const { app } = await import("../../app.js");
const { prisma } = await import("../../db.js");
const { createToken } = await import("../../utils/token-helper.js");

test("chat routes require auth, validate input and enforce membership", async () => {
  const alice = { id: "00000000-0000-0000-0000-000000000001", username: "alice" };
  const bob = { id: "00000000-0000-0000-0000-000000000002", username: "bob" };
  const originals = { userFind: prisma.user.findUnique, users: prisma.user.findMany, conversation: prisma.conversation.findUnique, member: prisma.conversationMember.findUnique, messages: prisma.message.findMany, create: prisma.message.create };
  let member = true;
  let saved: any;
  prisma.user.findUnique = (async ({ where }: any) => [alice, bob].find(u => u.id === where.id) ?? null) as any;
  prisma.user.findMany = (async ({ where }: any) => { assert.equal(where.id.not, alice.id); return [bob]; }) as any;
  prisma.conversation.findUnique = (async ({ where }: any) => { assert.deepEqual(where.firstUserId_secondUserId, { firstUserId: alice.id, secondUserId: bob.id }); return { id: "conversation" }; }) as any;
  prisma.conversationMember.findUnique = (async () => member ? {} : null) as any;
  prisma.message.findMany = (async () => []) as any;
  prisma.message.create = (async ({ data }: any) => { saved = data; return { ...data, id: "message", createdAt: new Date() }; }) as any;
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api/chat`;
    const cookie = `chat_session=${createToken(alice)}`;
    const get = (path: string) => fetch(base + path, { headers: { cookie } });
    const send = (content: unknown) => fetch(`${base}/users/${bob.id}/messages`, { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ content, senderId: bob.id }) });
    const expiredPayload = Buffer.from(JSON.stringify({ ...alice, expiresAt: 0 })).toString("base64url");
    const expiredSignature = createHmac("sha256", process.env.AUTH_SIGNING_SECRET!).update(expiredPayload).digest("base64url");
    assert.equal((await fetch(base + "/users")).status, 401);
    assert.equal((await fetch(base + "/users", { headers: { cookie: "chat_session=malformed" } })).status, 401);
    assert.equal((await fetch(base + "/users", { headers: { cookie: `chat_session=${expiredPayload}.${expiredSignature}` } })).status, 401);
    assert.deepEqual(await (await get("/users")).json(), { users: [bob] });
    assert.equal((await get("/users/not-a-uuid/messages")).status, 400);
    assert.equal((await get(`/users/${alice.id}/messages`)).status, 400);
    assert.equal((await get("/users/00000000-0000-0000-0000-000000000003/messages")).status, 404);
    assert.equal((await send(" ")).status, 400);
    assert.equal((await send("a".repeat(4001))).status, 400);
    member = false;
    assert.equal((await get(`/users/${bob.id}/messages`)).status, 403);
    assert.equal((await send("hello")).status, 403);
    member = true;
    assert.equal((await send(" hello ")).status, 201);
    assert.equal(saved.senderId, alice.id);
    assert.equal(saved.content, "hello");
    assert.deepEqual(await (await get(`/users/${bob.id}/messages`)).json(), { messages: [] });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    prisma.user.findUnique = originals.userFind; prisma.user.findMany = originals.users;
    prisma.conversation.findUnique = originals.conversation; prisma.conversationMember.findUnique = originals.member;
    prisma.message.findMany = originals.messages; prisma.message.create = originals.create;
    await prisma.$disconnect();
  }
});
