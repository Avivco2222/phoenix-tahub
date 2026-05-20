"use client";

import { useEffect, useRef } from "react";
import { useDataVersionBumpedAt } from "@/context/DataVersionContext";
import { useToast } from "@/components/Toast";

/**
 * Listens for data_version bumps (from the global DataVersionContext) and
 * fires a non-intrusive toast on the bottom-left so every screen acknowledges
 * a fresh batch landed. Suppresses the very first poll result (it's just the
 * initial sync, not a real bump).
 */
export function DataVersionToast() {
  const bumpedAt = useDataVersionBumpedAt();
  const { showToast } = useToast();
  const firstRef = useRef(true);

  useEffect(() => {
    if (!bumpedAt) return;
    if (firstRef.current) {
      // First detection on app mount is the baseline read, not a real change.
      firstRef.current = false;
      return;
    }
    showToast("✓ הגיע batch חדש — הנתונים מתעדכנים", "success");
  }, [bumpedAt, showToast]);

  return null;
}
