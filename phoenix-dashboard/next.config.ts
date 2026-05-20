import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8010";

const nextConfig: NextConfig = {
  // Same-origin proxy to the FastAPI backend. Required so the auth cookie set
  // by the backend lives on localhost:3000 (rather than 8010) — proxy.ts and
  // the browser then both see it on subsequent requests.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/admin/health", destination: `${BACKEND_URL}/admin/health` },
      { source: "/admin/ingestion/:path*", destination: `${BACKEND_URL}/admin/ingestion/:path*` },
      { source: "/admin/revert/:path*", destination: `${BACKEND_URL}/admin/revert/:path*` },
      { source: "/admin/revert-batch/:path*", destination: `${BACKEND_URL}/admin/revert-batch/:path*` },
      { source: "/admin/reset-for-final-test", destination: `${BACKEND_URL}/admin/reset-for-final-test` },
      { source: "/upload", destination: `${BACKEND_URL}/upload` },
      { source: "/upload/:path*", destination: `${BACKEND_URL}/upload/:path*` },
      { source: "/healthz", destination: `${BACKEND_URL}/healthz` },
      { source: "/readyz", destination: `${BACKEND_URL}/readyz` },
      { source: "/meta", destination: `${BACKEND_URL}/meta` },
      { source: "/stats", destination: `${BACKEND_URL}/stats` },
      { source: "/candidates", destination: `${BACKEND_URL}/candidates` },
      { source: "/jobs", destination: `${BACKEND_URL}/jobs` },
      { source: "/jobs/:path*", destination: `${BACKEND_URL}/jobs/:path*` },
      { source: "/executive-brief", destination: `${BACKEND_URL}/executive-brief` },
      { source: "/intelligence", destination: `${BACKEND_URL}/intelligence` },
      { source: "/drilldown", destination: `${BACKEND_URL}/drilldown` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' http: https:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
