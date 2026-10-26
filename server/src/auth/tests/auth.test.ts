import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createHmac } from "node:crypto";

// Exercise the actual HTTP routes with a deterministic in-memory Prisma test double.
// This suite does not require a running database or modify local demo accounts.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.AUTH_SIGNING_SECRET = "test-only-signing-key-at-least-32-bytes";
const { prisma } = await import("../../db.js");
const { app } = await import("../../app.js");

test("login validation, account reuse, signed cookie integrity, expiry and logout", async () => {
  const users = new Map<string, { id: string; username: string }>();
  const originalUpsert = prisma.user.upsert;

  prisma.user.upsert = (async ({ where }: any) => {
    if (!users.has(where.username)) users.set(where.username, { id: "demo-user-id", username: where.username });
    return users.get(where.username);
  }) as any;

  const server = app.listen(0, "127.0.0.1");
  
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api/auth`;
    const login = (body: unknown, cookie = "") => fetch(`${base}/login`, {
      method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body),
    });
    assert.equal((await fetch(`${base}/me`)).status, 401);
    assert.equal((await login({ username: "alice", secret: "wrong" })).status, 401);
    assert.equal(users.size, 0);
    assert.equal((await login({ username: "a!", secret: "chat-demo-2026" })).status, 400);
    assert.equal((await login({ username: 123, secret: "chat-demo-2026" })).status, 400);
    const first = await login({ username: " Alice ", secret: "chat-demo-2026" });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).user.username, "alice");
    const header = first.headers.get("set-cookie")!;
    assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/);
    const cookie = header.split(";")[0];
    const token = cookie.split("=")[1];
    const [payload, signature] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), username: "mallory" })).toString("base64url");
    assert.equal((await fetch(`${base}/me`, { headers: { cookie: `chat_session=${tampered}.${signature}` } })).status, 401);
    const me = await fetch(`${base}/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.username, "alice");
    const second = await login({ username: "ALICE", secret: "chat-demo-2026" }, cookie);
    assert.equal(second.status, 200); assert.equal(users.size, 1);
    assert.equal((await fetch(`${base}/me`, { headers: { cookie } })).status, 200);
    const newCookie = second.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await fetch(`${base}/logout`, { method: "POST", headers: { cookie: newCookie } })).status, 204);
    assert.equal((await fetch(`${base}/me`, { headers: { cookie: newCookie } })).status, 200);
    const expiredPayload = Buffer.from(JSON.stringify({ id: "demo-user-id", username: "alice", expiresAt: 0 })).toString("base64url");
    const expiredSignature = createHmac("sha256", process.env.AUTH_SIGNING_SECRET!).update(expiredPayload).digest("base64url");
    assert.equal((await fetch(`${base}/me`, { headers: { cookie: `chat_session=${expiredPayload}.${expiredSignature}` } })).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    prisma.user.upsert = originalUpsert;
    await prisma.$disconnect();
  }
});
