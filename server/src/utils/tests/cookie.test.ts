import { describe, expect, it, jest } from "@jest/globals";
import { cookieName, cookieOptions, lifetime } from "../cookie.js";

describe("session cookie configuration", () => {
  it("uses a seven-day lifetime and strict HTTP-only cookie defaults", () => {
    expect(lifetime).toBe(7 * 24 * 60 * 60 * 1000);
    expect(cookieName).toBe("chat_session");
    expect(cookieOptions).toEqual({
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
    });
  });

  it("enables secure cookies when configured for HTTPS", () => {
    const original = process.env.COOKIE_SECURE;
    process.env.COOKIE_SECURE = "true";
    try {
      jest.isolateModules(() => {
        const secureCookie =
          require("../cookie.js") as typeof import("../cookie.js");
        expect(secureCookie.cookieOptions.secure).toBe(true);
      });
    } finally {
      if (original === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = original;
    }
  });

  it("does not enable the secure flag for arbitrary truthy strings", () => {
    const original = process.env.COOKIE_SECURE;
    process.env.COOKIE_SECURE = "yes";
    try {
      jest.isolateModules(() => {
        const configuredCookie =
          require("../cookie.js") as typeof import("../cookie.js");
        expect(configuredCookie.cookieOptions.secure).toBe(false);
      });
    } finally {
      if (original === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = original;
    }
  });
});
