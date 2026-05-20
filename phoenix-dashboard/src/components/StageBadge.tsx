"use client";

import React from "react";
import { getStageMeta, type UnifiedStage } from "@/lib/stages";

interface StageBadgeProps {
  stage: UnifiedStage | string | null | undefined;
  /** size: "sm" (table rows), "md" (default, headers), "lg" (drawer hero) */
  size?: "sm" | "md" | "lg";
  /** When true, render the short label ("ראיון") instead of the full one ("בראיון"). */
  compact?: boolean;
}

/** Color-coded badge for the unified pipeline stage. Stays consistent across
 * /candidates rows, /jobs breakdown chips, and the side-panels. */
export function StageBadge({ stage, size = "md", compact = false }: StageBadgeProps) {
  const meta = getStageMeta(stage);
  const sizeCls =
    size === "sm" ? "text-[10px] px-1.5 py-0.5"
      : size === "lg" ? "text-sm px-3 py-1"
        : "text-xs px-2 py-0.5";
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${meta.badge} ${sizeCls}`}
    >
      {compact ? meta.short : meta.label}
    </span>
  );
}
