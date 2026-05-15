"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSession } from "@/context/SessionContext";
import { useToast } from "@/components/Toast";

/**
 * Notifications come from two sources:
 *  1. Backend (real notifications sent by admin via /api/admin/notifications/send)
 *  2. Local in-app events (e.g., welcome message) added via addNotification()
 * Both are normalized into the same shape below.
 */
export type NotificationSeverity = 'success' | 'warning' | 'danger' | 'info' | 'kudos';

export interface Notification {
  id: string;
  msg: string;
  type: NotificationSeverity;
  /** Display-friendly relative time. */
  time: string;
  read: boolean;
  /** Original ISO timestamp (when available). */
  sentAt?: string;
  /** Who sent it (admin email) or "system". */
  sentBy?: string;
  /** True if this came from the backend (markAsRead persists). */
  remote?: boolean;
  /** Internal URL to navigate to when the notification is clicked. */
  link?: string;
  /** Notification category: 'sla' | 'inactivity' | 'ingest' | 'quality' | 'manual' | 'general' */
  category?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  /** True for a brief moment when a new notification just arrived via SSE — drives bell pulse. */
  freshArrival: boolean;
  addNotification: (msg: string, type: NotificationSeverity) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  refresh: () => Promise<void>;
}

interface BackendNotification {
  id: string;
  message: string;
  severity: string;
  sent_by: string | null;
  sent_at: string;
  read_at: string | null;
  link?: string | null;
  category?: string | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 60_000; // poll every 60 seconds

/** Show a native browser notification for a newly-arrived item (SSE push only). */
function showBrowserNotification(n: Notification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const trigger = () => {
    try {
      new window.Notification("FNX TAHub", {
        body: n.msg,
        icon: "/favicon.ico",
        tag: n.id,          // deduplicates — same id won't stack
        silent: false,
      });
    } catch { /* some browsers block programmatic notifications */ }
  };
  if (window.Notification.permission === "granted") {
    trigger();
  }
  // Don't auto-request permission here — that's done from the prefs panel.
}

function formatRelativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "ממש עכשיו";
    if (min < 60) return `לפני ${min} דק׳`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `לפני ${hr} שעות`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `לפני ${d} ימים`;
    return new Date(iso).toLocaleDateString("he-IL");
  } catch {
    return "—";
  }
}

function normalizeSeverity(s: string): NotificationSeverity {
  const v = (s || "").toLowerCase();
  if (v === "danger" || v === "warning" || v === "success" || v === "info" || v === "kudos") {
    return v as NotificationSeverity;
  }
  return "info";
}

function fromBackend(n: BackendNotification): Notification {
  return {
    id: n.id,
    msg: n.message,
    type: normalizeSeverity(n.severity),
    time: formatRelativeTime(n.sent_at),
    read: !!n.read_at,
    sentAt: n.sent_at,
    sentBy: n.sent_by ?? undefined,
    remote: true,
    link: n.link ?? undefined,
    category: n.category ?? "general",
  };
}

/** Minimum interval between inactivity scans (6 hours). The backend dedupes
 *  within 24h but we limit client-side calls to avoid hammering the scanner
 *  every 60 s when it's not needed. */
const INACTIVITY_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function NotificationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);
  const [remoteNotifications, setRemoteNotifications] = useState<Notification[]>([]);
  /** Set to true for 4 seconds whenever a new notification arrives via SSE. */
  const [freshArrival, setFreshArrival] = useState(false);
  // Gate every fetch on a confirmed session. Avoids 401 noise during the brief
  // window between mount and proxy.ts redirecting unauthenticated users to /login.
  const { user } = useSession();
  const { showToast } = useToast();
  /** Timestamp of the last inactivity scan call. Throttle to 6h. */
  const lastInactivityCheckRef = useRef<number>(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  const refresh = useCallback(async () => {
    if (!user) return; // not logged in — nothing to fetch
    try {
      // Trigger the inactivity scan at most once every 6 hours (admin/recruiter only).
      // The backend dedupes within 24h, but throttling the client prevents 1440 calls/day.
      if (user.role === "admin" || user.role === "recruiter") {
        const now = Date.now();
        if (now - lastInactivityCheckRef.current > INACTIVITY_CHECK_INTERVAL_MS) {
          lastInactivityCheckRef.current = now;
          void fetch(`${apiUrl}/api/internal/check-my-inactivity`, {
            credentials: "include",
            cache: "no-store",
          }).catch(() => {});
        }
      }

      const res = await fetch(`${apiUrl}/api/notifications/me`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        // 401/403 — user logged out or session expired; silently ignore
        return;
      }
      const data = (await res.json()) as BackendNotification[];
      setRemoteNotifications(data.map(fromBackend));
    } catch {
      // Network errors during background polling shouldn't crash the UI
    }
  }, [apiUrl, user]);

  useEffect(() => {
    if (!user) {
      // Logged out → drop any stale notifications from the previous session.
      setRemoteNotifications([]);
      return;
    }

    // Initial fetch via REST (instant on mount).
    void refresh();

    // ── Real-time: SSE stream for sub-5-second delivery ──────────────────
    // Falls back gracefully: if EventSource is unsupported or the stream
    // errors, the 60-second polling interval below takes over.
    let es: EventSource | null = null;
    let sseActive = false;

    if (typeof EventSource !== "undefined") {
      try {
        es = new EventSource(`${apiUrl}/api/notifications/stream`, { withCredentials: true });

        es.onopen = () => { sseActive = true; };

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data) as BackendNotification[];
            if (!Array.isArray(data) || data.length === 0) return;
            setRemoteNotifications(prev => {
              const existingIds = new Set(prev.map(n => n.id));
              const newOnes = data.filter(n => !existingIds.has(n.id)).map(fromBackend);
              if (newOnes.length > 0) {
                // Native browser notification for the first new item
                showBrowserNotification(newOnes[0]);
                // Pulse the bell for 4 s and show an in-app toast
                setFreshArrival(true);
                setTimeout(() => setFreshArrival(false), 4000);
                const first = newOnes[0];
                showToast(
                  first.msg.length > 60 ? first.msg.slice(0, 58) + "…" : first.msg,
                  first.type === "danger"  ? "error"
                  : first.type === "success" ? "success"
                  : "info",
                );
                return [...newOnes, ...prev];
              }
              return prev;
            });
          } catch { /* malformed SSE data — ignore */ }
        };

        es.onerror = () => {
          sseActive = false;
          es?.close();
          es = null;
          // SSE died — polling interval picks up from here.
        };
      } catch {
        // EventSource constructor failed — fall through to polling only.
      }
    }

    // ── Fallback: periodic polling (always runs; SSE supplements it) ─────
    // When SSE is active the poll still runs every 60 s as a safety net
    // (e.g. catch messages that arrived while SSE was reconnecting).
    const interval = setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, apiUrl]);

  // Combined view (remote first, newest at top)
  const notifications = [...remoteNotifications, ...localNotifications];

  const unreadCount = notifications.filter(n => !n.read).length;

  // Reflect unread count in the browser tab title
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = unreadCount > 0 ? `(${unreadCount}) FNX TAHub` : "FNX TAHub";
  }, [unreadCount]);

  const addNotification = useCallback((msg: string, type: NotificationSeverity) => {
    setLocalNotifications(prev => [{
      id: `local-${Date.now()}`,
      msg,
      type,
      time: 'ממש עכשיו',
      read: false,
    }, ...prev]);
  }, []);

  const markAllAsRead = useCallback(async () => {
    // Optimistic local update
    setRemoteNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setLocalNotifications(prev => prev.map(n => ({ ...n, read: true })));
    // Persist remote-side per-notification read state
    const unreadIds = remoteNotifications.filter(n => !n.read).map(n => n.id);
    await Promise.all(unreadIds.map(id =>
      fetch(`${apiUrl}/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
        credentials: "include",
      }).catch(err => console.warn("[markRead] failed for", id, err))
    ));
  }, [apiUrl, remoteNotifications]);

  const clearNotification = useCallback((id: string) => {
    setLocalNotifications(prev => prev.filter(n => n.id !== id));
    setRemoteNotifications(prev => prev.filter(n => n.id !== id));
    // Permanently delete from backend so it never reappears on next poll
    if (!String(id).startsWith("local-")) {
      void fetch(`${apiUrl}/api/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(err => console.warn("[delete notification] failed for", id, err));
    }
  }, [apiUrl]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      freshArrival,
      addNotification,
      markAllAsRead,
      clearNotification,
      refresh,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
