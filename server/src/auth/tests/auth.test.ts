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

const users = new Map<string, { id: string; username: string }>();
const originalUpsert = prisma.user.upsert;
const originalFindUnique = prisma.user.findUnique;
let server: ReturnType<typeof app.listen>;
let base: string;

beforeAll(async () => {
  prisma.user.upsert = jest.fn(async ({ where }: any) => {
    if (!users.has(where.username)) {
      users.set(where.username, {
        id: "00000000-0000-0000-0000-000000000001",
        username: where.username,
      });
    }
    return users.get(where.username);
  }) as any;
  prisma.user.findUnique = jest.fn(
    async ({ where }: any) =>
      [...users.values()].find((user) => user.id === where.id) ?? null,
  ) as any;

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test HTTP server did not bind to a TCP port.");
  }
  base = `http://127.0.0.1:${address.port}/api/auth`;
});

beforeEach(() => users.clear());

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  prisma.user.upsert = originalUpsert;
  prisma.user.findUnique = originalFindUnique;
  await prisma.$disconnect();
});

const login = (
  body: unknown,
  options: { contentType?: string; raw?: string } = {},
) =>
  fetch(`${base}/login`, {
    method: "POST",
    headers: options.contentType
      ? { "Content-Type": options.contentType }
      : { "Content-Type": "application/json" },
    body: options.raw ?? JSON.stringify(body),
  });

describe("authentication API", () => {
  it("rejects unsupported content types, malformed JSON and invalid credentials", async () => {
    expect(
      (await login({}, { contentType: "text/plain", raw: "{}" })).status,
    ).toBe(415);
    expect((await login({}, { raw: "{" })).status).toBe(400);
    expect(
      (await login({ username: "a!", secret: "chat-demo-2026" })).status,
    ).toBe(400);
    expect(
      (await login({ username: 123, secret: "chat-demo-2026" })).status,
    ).toBe(400);
    expect(
      (await login({ username: "alice", secret: "x".repeat(257) })).status,
    ).toBe(400);
    expect((await login({ username: "alice", secret: "wrong" })).status).toBe(
      401,
    );
    expect(users.size).toBe(0);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("normalizes usernames, reuses accounts and sets a secure session cookie", async () => {
    const first = await login({
      username: " Alice ",
      secret: "chat-demo-2026",
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        username: "alice",
      },
    });
    const cookieHeader = first.headers.get("set-cookie");
    expect(cookieHeader).toMatch(/HttpOnly/i);
    expect(cookieHeader).toMatch(/SameSite=Strict/i);
    const cookie = cookieHeader!.split(";")[0];
    expect(cookie).toMatch(/^chat_session=/);

    const second = await login({ username: "ALICE", secret: "chat-demo-2026" });
    expect(second.status).toBe(200);
    expect(users.size).toBe(1);
    expect(prisma.user.upsert).toHaveBeenCalledTimes(2);

    const me = await fetch(`${base}/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        username: "alice",
      },
    });
  });

  it("rejects missing, tampered, expired and malformed session tokens", async () => {
    const loginResponse = await login({
      username: "alice",
      secret: "chat-demo-2026",
    });
    const cookie = loginResponse.headers.get("set-cookie")!.split(";")[0];
    const token = cookie.slice("chat_session=".length);
    const [payload, signature] = token.split(".");
    const payloadData = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    const tampered = Buffer.from(
      JSON.stringify({ ...payloadData, username: "mallory" }),
    ).toString("base64url");
    const expiredPayload = Buffer.from(
      JSON.stringify({ ...payloadData, expiresAt: 0 }),
    ).toString("base64url");
    const expiredSignature = createHmac(
      "sha256",
      process.env.AUTH_SIGNING_SECRET!,
    )
      .update(expiredPayload)
      .digest("base64url");

    expect((await fetch(`${base}/me`)).status).toBe(401);
    expect(
      (
        await fetch(`${base}/me`, {
          headers: { cookie: `chat_session=${tampered}.${signature}` },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(`${base}/me`, {
          headers: {
            cookie: `chat_session=${expiredPayload}.${expiredSignature}`,
          },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await fetch(`${base}/me`, {
          headers: { cookie: "chat_session=malformed" },
        })
      ).status,
    ).toBe(401);
  });

  it("clears the browser cookie on logout without revoking an otherwise valid token", async () => {
    const loginResponse = await login({
      username: "alice",
      secret: "chat-demo-2026",
    });
    const cookie = loginResponse.headers.get("set-cookie")!.split(";")[0];
    const logout = await fetch(`${base}/logout`, {
      method: "POST",
      headers: { cookie },
    });

    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toMatch(
      /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i,
    );
    expect(
      (
        await fetch(`${base}/me`, {
          headers: { cookie },
        })
      ).status,
    ).toBe(200);
  });
});
