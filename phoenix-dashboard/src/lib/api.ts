"use client";

import { getAccessToken, isTokenExpired } from "./auth";

export function getApiBaseUrl(): string {
  // Empty string → same-origin (Next.js rewrites in next.config.ts proxy /api/* to the backend).
  // A non-empty value (e.g. https://api.example.com) overrides for cross-origin setups.
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

/**
 * After the merge, auth runs over the cookie session (set by /api/auth/login).
 * The browser sends `fnx_access_token` automatically when fetch() uses
 * `credentials: "include"`, and the backend's require_admin/verify_token now
 * accept either Bearer (legacy /api/auth/unlock flow) or that cookie.
 *
 * So these header helpers no longer need to inject Authorization. They only
 * surface a Bearer header when a legacy session token is sitting in localStorage,
 * to keep older flows working until they're refactored.
 */

export function getAdminHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...getAdminAuthHeader() };
}

export function getAdminAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  if (!token || isTokenExpired(token)) return {};
  return { Authorization: `Bearer ${token}` };
}
