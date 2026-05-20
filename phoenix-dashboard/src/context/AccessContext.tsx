"use client";

/**
 * AccessContext is now a thin compatibility shim over SessionContext.
 *
 * Background: the original AccessContext used a hardcoded APP_USERS list and
 * localStorage to fake auth. Phase-1 of the merge introduced real auth in
 * SessionContext (cookie + bcrypt + backend). Rather than refactor all
 * consumers at once, this file maps SessionContext data into the AppUser shape
 * the existing consumers expect, so the migration is transparent.
 *
 * In phase 5 (cleanup) we can delete this file and switch consumers to call
 * useSession() directly.
 */

import { createContext, useContext, useMemo } from "react";
import { useSession, type SessionUser } from "@/context/SessionContext";
import type { AppUser } from "@/lib/access-control";

interface AccessContextValue {
  currentUser: AppUser;
  effectiveUser: AppUser;
  isImpersonating: boolean;
  impersonate: (userId: string) => void;
  stopImpersonation: () => void;
}

const AccessContext = createContext<AccessContextValue | null>(null);

// Sentinel used while the session is loading (before /api/auth/me resolves).
// Consumers branch on `role`, so a recognisable role keeps them from crashing.
const PLACEHOLDER_USER: AppUser = {
  id: "anonymous",
  name: "טוען…",
  email: "",
  usf: "",
  role: "recruiter",
};

function toAppUser(session: SessionUser): AppUser {
  return {
    id: session.id,
    name: session.name || session.email,
    email: session.email,
    usf: "",
    role: session.role,
  };
}

export function AccessProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, impersonate, stopImpersonating } = useSession();

  const value = useMemo<AccessContextValue>(() => {
    // SessionContext already encodes impersonation server-side: `user` is the
    // *effective* user, and `user.impersonator` (if set) is the original admin.
    const effective: AppUser = user ? toAppUser(user) : PLACEHOLDER_USER;

    // For currentUser we want the underlying admin when impersonating, else effective.
    const current: AppUser = user?.impersonator
      ? {
          id: user.impersonator,
          name: user.impersonator_email ?? "Admin",
          email: user.impersonator_email ?? "",
          usf: "",
          role: "admin",
        }
      : effective;

    return {
      currentUser: current,
      effectiveUser: effective,
      isImpersonating: !!user?.impersonator,
      // Sync wrappers — Session methods are async; results propagate through
      // SessionProvider state changes, so callers don't need to await.
      impersonate: (userId: string) => {
        void impersonate(userId);
      },
      stopImpersonation: () => {
        void stopImpersonating();
      },
    };
  }, [user, impersonate, stopImpersonating]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error("useAccess must be used inside <AccessProvider>");
  }
  return ctx;
}
