import { describe, expect, it } from "vitest";
import { getApiBaseUrl, getAdminHeaders } from "./api";
import { saveAccessToken } from "./auth";

describe("api helpers", () => {
  it("returns API base URL when configured", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("throws when API URL is missing", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(() => getApiBaseUrl()).toThrow("NEXT_PUBLIC_API_URL is not configured");
  });

  it("returns admin headers when token exists", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return this.store[key] ?? null;
        },
        setItem(key: string, value: string) {
          this.store[key] = value;
        },
        removeItem(key: string) {
          delete this.store[key];
        },
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, "document", {
      value: { cookie: "" },
      configurable: true,
    });

    saveAccessToken("header.payload.sig");
    expect(getAdminHeaders().Authorization).toBe("Bearer header.payload.sig");
  });
});
