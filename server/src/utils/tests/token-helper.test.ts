import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createHmac } from "node:crypto";
import type { Request } from "express";
import { cookieName, lifetime } from "../cookie.js";
import { createToken, readUser } from "../token-helper.js";

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  username: "alice",
};

const requestWithCookie = (cookie?: string) =>
  ({ headers: { cookie } }) as Pick<Request, "headers">;

const createSignedPayload = (data: unknown) => {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_SIGNING_SECRET!)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
};

describe("session token helpers", () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it("creates a signed token that reads back the user", () => {
    const now = Date.now();
    const token = createToken(user);
    const [payload, signature] = token.split(".");
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(data).toMatchObject(user);
    expect(data.expiresAt).toBeGreaterThanOrEqual(now + lifetime);
    expect(data.expiresAt).toBeLessThanOrEqual(Date.now() + lifetime);
    expect(readUser(requestWithCookie(`${cookieName}=${token}`))).toEqual(user);
  });

  it("finds the session cookie among other cookies and trims whitespace", () => {
    const token = createToken(user);

    expect(
      readUser(
        requestWithCookie(`theme=dark; ${cookieName}=${token}; other=value`),
      ),
    ).toEqual(user);
  });

  it.each([
    ["missing cookie", undefined],
    ["empty cookie", `${cookieName}=`],
    ["missing signature", `${cookieName}=payload`],
    ["extra token section", `${cookieName}=payload.signature.extra`],
    ["invalid signature", `${cookieName}=e30.invalid`],
    ["oversized cookie", `${cookieName}=${"a".repeat(4097)}`],
  ])("returns null for %s", (_description, cookie) => {
    expect(readUser(requestWithCookie(cookie))).toBeNull();
  });

  it("rejects a token with a tampered payload or signature", () => {
    const token = createToken(user);
    const [payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...user,
        username: "mallory",
        expiresAt: Date.now() + lifetime,
      }),
    ).toString("base64url");

    expect(
      readUser(
        requestWithCookie(`${cookieName}=${tamperedPayload}.${signature}`),
      ),
    ).toBeNull();
    expect(
      readUser(
        requestWithCookie(
          `${cookieName}=${payload}.${"A".repeat(signature.length)}`,
        ),
      ),
    ).toBeNull();
  });

  it("rejects correctly signed tokens with invalid or expired claims", () => {
    const expired = createSignedPayload({ ...user, expiresAt: Date.now() - 1 });
    const missingId = createSignedPayload({
      username: user.username,
      expiresAt: Date.now() + lifetime,
    });
    const invalidExpiry = createSignedPayload({
      ...user,
      expiresAt: Number.MAX_SAFE_INTEGER + 1,
    });
    const invalidJsonPayload = Buffer.from("{").toString("base64url");
    const invalidJsonSignature = createHmac(
      "sha256",
      process.env.AUTH_SIGNING_SECRET!,
    )
      .update(invalidJsonPayload)
      .digest("base64url");

    expect(readUser(requestWithCookie(`${cookieName}=${expired}`))).toBeNull();
    expect(
      readUser(requestWithCookie(`${cookieName}=${missingId}`)),
    ).toBeNull();
    expect(
      readUser(requestWithCookie(`${cookieName}=${invalidExpiry}`)),
    ).toBeNull();
    expect(
      readUser(
        requestWithCookie(
          `${cookieName}=${invalidJsonPayload}.${invalidJsonSignature}`,
        ),
      ),
    ).toBeNull();
  });

  it("requires a signing secret of at least 32 bytes", () => {
    const originalSecret = process.env.AUTH_SIGNING_SECRET;
    process.env.AUTH_SIGNING_SECRET = "too-short";
    try {
      expect(() => {
        jest.isolateModules(() => {
          require("../token-helper.js");
        });
      }).toThrow("AUTH_SIGNING_SECRET must contain at least 32 bytes");
    } finally {
      process.env.AUTH_SIGNING_SECRET = originalSecret;
    }
  });
});
