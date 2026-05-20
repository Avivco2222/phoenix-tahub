import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApiBaseUrl, getAdminHeaders } from "./api";
import { saveAccessToken, clearAccessToken } from "./auth";

describe("api helpers", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    }
  });

  it("returns API base URL when configured", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("returns empty string (same-origin) when NEXT_PUBLIC_API_URL is unset", () => {
    // The Next.js rewrites in next.config.ts proxy /api/* to the backend,
    // so an empty base URL is the correct default for the in-app fetch helpers.
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(getApiBaseUrl()).toBe("");
  });

  describe("getAdminHeaders", () => {
    beforeEach(() => {
      const store: Record<string, string> = {};
      Object.defineProperty(globalThis, "window", {
        value: globalThis,
        configurable: true,
      });
      Object.defineProperty(globalThis, "localStorage", {
        value: {
          getItem: (k: string) => store[k] ?? null,
          setItem: (k: string, v: string) => {
            store[k] = v;
          },
          removeItem: (k: string) => {
            delete store[k];
          },
        },
        configurable: true,
      });
      Object.defineProperty(globalThis, "document", {
        value: { cookie: "" },
        configurable: true,
      });
    });

    afterEach(() => {
      clearAccessToken();
    });

    it("always includes Content-Type", () => {
      expect(getAdminHeaders()["Content-Type"]).toBe("application/json");
    });

    it("attaches Authorization Bearer when a non-expired token is stored", () => {
      // JWT shape: header.payload.signature — payload base64url-encoded without exp.
      // auth.isTokenExpired() treats a missing exp as non-expired.
      const payload = btoa(JSON.stringify({ sub: "u1" }))
        .replace(/=+$/, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
      const token = `header.${payload}.sig`;
      saveAccessToken(token);
      expect(getAdminHeaders().Authorization).toBe(`Bearer ${token}`);
    });
  });
});
