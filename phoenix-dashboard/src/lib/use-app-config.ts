/**
 * useAppConfig — single source of truth for app visibility/tag overrides.
 *
 * Fetches `/api/apps/config` once on mount (and on demand via `refresh()`).
 * Components that need the effective app list (ai-hub page, sidebar pins,
 * global search) consume this so admin changes propagate everywhere.
 *
 * Cache lifetime: 60 seconds. Admin pages should call `refresh()` after
 * mutating overrides via `PUT /api/admin/apps/{id}`.
 */

import { useCallback, useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { type AppOverride } from "@/lib/tools-registry";

interface AppConfigResponse {
  overrides: Record<string, AppOverride>;
}

const CACHE_TTL_MS = 60_000;
let cache: { ts: number; data: AppConfigResponse } | null = null;

async function fetchConfig(force = false): Promise<AppConfigResponse> {
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/apps/config`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return { overrides: {} };
    const data = (await res.json()) as AppConfigResponse;
    cache = { ts: Date.now(), data };
    return data;
  } catch {
    return { overrides: {} };
  }
}

export function useAppConfig() {
  const [overrides, setOverrides] = useState<Record<string, AppOverride>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchConfig().then(data => {
      if (!cancelled) {
        setOverrides(data.overrides);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    const data = await fetchConfig(true);
    setOverrides(data.overrides);
  }, []);

  return { overrides, loaded, refresh };
}
