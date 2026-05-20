"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";

export type UserRole = "admin" | "hrbp" | "recruiter" | "hiring_manager";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Admin's id when this session is in "view as" mode. Null/undefined for normal sessions. */
  impersonator?: string | null;
  /** Admin's email when impersonating. */
  impersonator_email?: string | null;
}

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  impersonate: (userId: string) => Promise<void>;
  stopImpersonating: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  logout: async () => {},
  impersonate: async () => {},
  stopImpersonating: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  // Empty NEXT_PUBLIC_API_URL → use same-origin (relative). Otherwise call cross-origin.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as SessionUser;
        setUser(data);
      } else {
        setUser(null);
        if (res.status === 401) {
          // Stale/missing cookie. proxy.ts can't validate JWT, so it lets the
          // request through if a cookie is *present* (even if expired/invalid).
          // We only learn the cookie is bad here — redirect to /login ourselves.
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.href = "/login";
            return;
          }
        } else {
          setError(`Auth check failed (${res.status})`);
        }
      }
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Continue regardless — local state is the source of truth on logout
    }
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, [apiUrl]);

  const impersonate = useCallback(async (userId: string) => {
    const res = await fetch(`${apiUrl}/api/admin/impersonate/${encodeURIComponent(userId)}`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail || `Impersonation failed (${res.status})`);
    }
    await refresh();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, [apiUrl, refresh]);

  const stopImpersonating = useCallback(async () => {
    const res = await fetch(`${apiUrl}/api/admin/stop-impersonate`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail || `Stop impersonation failed (${res.status})`);
    }
    await refresh();
    if (typeof window !== "undefined") {
      window.location.href = "/admin";
    }
  }, [apiUrl, refresh]);

  useEffect(() => {
    // Re-fetch the session on every route change. This handles:
    //  - Initial mount on any page
    //  - After login: pathname changes from /login → / and we pick up the new cookie
    //  - After logout: pathname changes back to /login (refresh just confirms 401)
    // Note: on /login we still call /api/auth/me — it returns 401 silently when no cookie.
    void refresh();
  }, [refresh, pathname]);

  return (
    <SessionContext.Provider value={{ user, loading, error, refresh, logout, impersonate, stopImpersonating }}>
      {children}
    </SessionContext.Provider>
  );
}
