/**
 * Unit tests for `lib/auth.ts` — the JWT helpers that every authenticated
 * client-side fetch relies on. We can run these without jsdom because the
 * module talks only to `globalThis.window` / `globalThis.localStorage` /
 * `globalThis.atob`, all of which we stub deterministically.
 *
 * Why these are worth testing without rendering a single component:
 *   * `isTokenExpired` is the gate that decides whether to send the Bearer
 *     header. A regression here silently signs out every user.
 *   * `saveAccessToken` / `getAccessToken` straddle the SSR/CSR boundary
 *     (no-op when window is absent) — easy to break in a server-only edit.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  saveAccessToken,
  getAccessToken,
  clearAccessToken,
  isTokenExpired,
} from "./auth";

function installBrowserLikes() {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    },
  });
}

function uninstallBrowserLikes() {
  // Use `delete` via Reflect.deleteProperty so the redefinition in the
  // next test starts from a clean slate (otherwise TypeScript's "cannot
  // redefine" error fires under strict mode).
  Reflect.deleteProperty(globalThis as object, "window");
  Reflect.deleteProperty(globalThis as object, "localStorage");
}

// Compact base64url encoder so each test can fabricate JWT payloads inline
// without pulling in jose / jsonwebtoken.
function encodeJwtPayload(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function jwt(payload: Record<string, unknown>): string {
  return `header.${encodeJwtPayload(payload)}.sig`;
}

describe("auth token storage (SSR-safe)", () => {
  afterEach(() => uninstallBrowserLikes());

  it("save / get / clear round-trip when window is present", () => {
    installBrowserLikes();
    expect(getAccessToken()).toBeNull();
    saveAccessToken("abc.def.ghi");
    expect(getAccessToken()).toBe("abc.def.ghi");
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it("is a no-op when window is undefined (SSR)", () => {
    // Don't install browser-likes. window / localStorage stay absent.
    saveAccessToken("anything");      // must not throw
    expect(getAccessToken()).toBeNull();
    clearAccessToken();               // must not throw
  });
});

describe("isTokenExpired", () => {
  it("treats a token with future exp as not expired", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired(jwt({ sub: "u1", exp }))).toBe(false);
  });

  it("treats a token with past exp as expired", () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    expect(isTokenExpired(jwt({ sub: "u1", exp }))).toBe(true);
  });

  it("treats a token with no exp claim as not expired (dev / tests)", () => {
    expect(isTokenExpired(jwt({ sub: "u1" }))).toBe(false);
  });

  it("returns true for a malformed token (no dots)", () => {
    expect(isTokenExpired("not-a-jwt")).toBe(true);
  });

  it("returns false for an unparseable payload (gracefully degrades, doesn't throw)", () => {
    // base64 of `{not-json` — parses as base64 fine, then JSON.parse explodes.
    const badPayload = btoa("{not-json").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    expect(isTokenExpired(`h.${badPayload}.s`)).toBe(false);
  });
});

describe("save-then-load with realistic JWT", () => {
  beforeEach(() => installBrowserLikes());
  afterEach(() => uninstallBrowserLikes());

  it("survives a JWT with the project's typical claims (sub/role/exp)", () => {
    const exp = Math.floor(Date.now() / 1000) + 1800;
    const token = jwt({ sub: "u1", role: "admin", exp });
    saveAccessToken(token);
    const back = getAccessToken();
    expect(back).toBe(token);
    expect(isTokenExpired(back!)).toBe(false);
  });
});
