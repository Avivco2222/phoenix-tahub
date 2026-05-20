"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

/**
 * DataVersionContext — global "freshness" counter for all data-driven blocks.
 *
 * Backend exposes a monotonic `data_version` integer that bumps every time a
 * batch is committed via /api/ingest/{type}. This context polls it; when the
 * value increases, every consumer hook (e.g. useCandidates) that subscribes
 * to `dataVersion` re-fetches. Pages stay fresh after an admin upload without
 * a manual refresh.
 *
 * Why a counter and not WebSockets: counter polling is reliable behind any
 * proxy/CDN, requires zero new infrastructure, and is cheap (< 50 bytes per
 * poll, 30s cadence). We can upgrade to SSE later if traffic warrants it.
 */

interface DataVersionState {
  version: number;
  bumpedAt: number; // local timestamp of the last detected bump (for Toast usage)
  refresh: () => Promise<void>;
}

const DataVersionContext = createContext<DataVersionState>({
  version: 0,
  bumpedAt: 0,
  refresh: async () => {},
});

const POLL_INTERVAL_MS = 30_000;

export function DataVersionProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const [bumpedAt, setBumpedAt] = useState(0);
  const lastSeenRef = useRef(0);

  const refresh = useCallback(async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    try {
      const res = await fetch(`${apiUrl}/api/data-version`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { version?: number };
      const v = Number(json.version || 0);
      if (v !== lastSeenRef.current) {
        const wasBump = v > lastSeenRef.current;
        lastSeenRef.current = v;
        setVersion(v);
        if (wasBump) setBumpedAt(Date.now());
      }
    } catch {
      // network error during polling — keep last known version, try next tick
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <DataVersionContext.Provider value={{ version, bumpedAt, refresh }}>
      {children}
    </DataVersionContext.Provider>
  );
}

/**
 * Returns the current data_version. Use it as a dep on any fetch effect that
 * should re-run after a fresh batch lands:
 *
 *   const dataVersion = useDataVersion();
 *   useEffect(() => { void loadCandidates(); }, [loadCandidates, dataVersion]);
 */
export function useDataVersion(): number {
  return useContext(DataVersionContext).version;
}

/** Imperative refresh — useful right after a programmatic upload completes. */
export function useDataVersionRefresh() {
  return useContext(DataVersionContext).refresh;
}

/** Timestamp of the last detected bump, for Toast etc. */
export function useDataVersionBumpedAt(): number {
  return useContext(DataVersionContext).bumpedAt;
}
