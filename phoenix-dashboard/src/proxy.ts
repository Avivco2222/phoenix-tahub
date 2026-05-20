import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge proxy for Phoenix TAHub (renamed from proxy in Next.js 16).
 *
 * Strategy:
 * - Public routes: /login, /_next/*, static assets, /favicon.ico → pass through.
 * - All other routes: require presence of `fnx_access_token` cookie.
 *   Cookie validity (signature, expiry, role) is verified by the backend on every API call
 *   and by the SessionProvider on mount. Middleware only enforces the gate.
 *
 * NOTE: When the API runs on a different origin (typical in this project — Vercel + FastAPI),
 * the JWT cookie cannot be read here unless the API sets it on a shared parent domain.
 * In cross-origin setups we fall back to a presence check only of a sentinel cookie set by
 * the SessionProvider after a successful /api/auth/me call. See COOKIE_MODE below.
 */

const PUBLIC_PATHS = ["/login"];
const COOKIE_NAME = "fnx_access_token";

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api")) return true; // API requests proxied separately
  if (pathname === "/favicon.ico") return true;
  if (/\.(svg|png|jpg|jpeg|gif|ico|webp|avif|css|js|map|woff2?)$/.test(pathname)) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.get(COOKIE_NAME);
  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
