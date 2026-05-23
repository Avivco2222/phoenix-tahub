"use client";

/**
 * FutureBadge — visual marker for blocks intentionally not wired to
 * live data yet because their data source isn't available in the
 * current schema (HRIS integration pending, recruiter tagging not
 * adopted, etc.).
 *
 * Rendering an honest "coming soon" badge with the precise reason is
 * better than:
 *   * showing a hardcoded zero (misleading — looks like real data)
 *   * hiding the block entirely (loses the affordance + roadmap signal)
 *
 * The backend declares which blocks are deferred via the `future_blocks`
 * field on /api/dashboard/metrics and /api/intelligence/extended — the
 * key in props.reason matches a key in that list so this component is
 * fed off the same source of truth that the rest of the page uses.
 *
 * Visual: small orange pill with a clock icon, optional hover-tooltip
 * showing the technical reason ("requires HRIS sync", etc.). Sits at
 * the top-right of the host block via absolute positioning when
 * `position="overlay"` is set; otherwise renders inline.
 */

import { Clock } from "lucide-react";

interface FutureBadgeProps {
  /** Short label visible inside the badge, defaults to "עתידי". */
  label?: string;
  /** Longer technical reason shown in the tooltip; usually the
   *  `reason` field from the backend's future_blocks declaration. */
  reason?: string;
  /** "overlay" places the badge over the parent block (parent must be
   *  position: relative); "inline" renders in-flow. */
  position?: "overlay" | "inline";
}

export function FutureBadge({ label = "עתידי", reason, position = "overlay" }: FutureBadgeProps) {
  const wrapperClass = position === "overlay"
    ? "absolute top-3 left-3 z-10"
    : "inline-flex";

  return (
    <div className={wrapperClass} title={reason ?? "מדד עתידי — דורש מקור נתונים שטרם זמין"}>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-wider shadow-sm">
        <Clock size={10} strokeWidth={2.5} />
        {label}
      </span>
    </div>
  );
}
