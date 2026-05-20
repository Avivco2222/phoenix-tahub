const ACCESS_TOKEN_KEY = "fnx-access-token";

function decodeBase64Url(segment: string): string {
  let base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) {
    base64 += "=".repeat(4 - pad);
  }
  if (typeof globalThis.atob !== "function") {
    throw new Error("atob is not available");
  }
  return globalThis.atob(base64);
}

export function saveAccessToken(token: string): void {
  if (typeof globalThis.window === "undefined") return;
  globalThis.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (typeof globalThis.window === "undefined") return null;
  return globalThis.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken(): void {
  if (typeof globalThis.window === "undefined") return;
  globalThis.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/** True if JWT `exp` (seconds) is in the past. Malformed or missing exp → not treated as expired (dev / tests). */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;
    const raw = decodeBase64Url(parts[1]);
    const payload = JSON.parse(raw) as { exp?: number };
    if (payload.exp == null) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= payload.exp;
  } catch {
    return false;
  }
}
