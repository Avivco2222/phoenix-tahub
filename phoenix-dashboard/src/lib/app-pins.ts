/**
 * App pinning — per-browser persistence via localStorage.
 *
 * The recruiter pins favorite apps; they appear in the sidebar as quick access.
 * Storage is browser-local by design (per user's explicit choice). For multi-
 * device sync we'd need a DB-backed `user_app_pins` table — out of scope for v1.
 *
 * Schema in localStorage:
 *   key:   "phoenix.app-pins.v1"
 *   value: JSON string array of app ids, ordered most-recent-first.
 *
 * The `useAppPins` hook below also wires up a cross-tab event so pinning in
 * one tab updates the sidebar in another tab (StorageEvent + a custom event
 * for same-tab sync, since StorageEvent doesn't fire in the originating tab).
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "phoenix.app-pins.v1";
const CHANGE_EVENT = "phoenix:app-pins:change";

function readPins(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writePins(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    // Fire same-tab notification so other components react immediately.
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: ids }));
  } catch {
    // Quota exceeded or storage disabled — silently ignore.
  }
}

export function useAppPins() {
  const [pins, setPins] = useState<string[]>([]);

  // Hydrate on mount, then keep in sync across tabs + same-tab updates.
  useEffect(() => {
    setPins(readPins());

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPins(readPins());
    };
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) setPins(detail);
      else setPins(readPins());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, onLocal);
    };
  }, []);

  const isPinned = useCallback((id: string) => pins.includes(id), [pins]);

  const togglePin = useCallback((id: string) => {
    const current = readPins();
    const next = current.includes(id)
      ? current.filter(x => x !== id)
      : [id, ...current];
    writePins(next);
  }, []);

  const clearPins = useCallback(() => writePins([]), []);

  return { pins, isPinned, togglePin, clearPins };
}
