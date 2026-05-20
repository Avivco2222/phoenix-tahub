"use client";

import React from "react";
import { STAGE_ORDER, getStageMeta, type UnifiedStage } from "@/lib/stages";

interface StageFilterChipsProps {
  /** Active stage code, or "" / null for "all". */
  active: UnifiedStage | "" | null;
  /** Map of stage → count to render alongside each chip. Pass `total_by_stage`
   * straight from the /candidates response. */
  counts: Partial<Record<UnifiedStage, number>> & { ALL?: number };
  onChange: (next: UnifiedStage | "") => void;
}

/** Top-of-list filter chips for the unified candidate stage. The "All" chip
 * is always first; subsequent chips follow `STAGE_ORDER`. Counts that come
 * back as 0 are still shown so the user perceives the full pipeline width. */
export function StageFilterChips({ active, counts, onChange }: StageFilterChipsProps) {
  const isAll = !active;
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="סינון לפי שלב">
      <Chip
        active={isAll}
        label="הכל"
        count={counts.ALL ?? STAGE_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0)}
        onClick={() => onChange("")}
      />
      {STAGE_ORDER.map(stage => {
        const meta = getStageMeta(stage);
        return (
          <Chip
            key={stage}
            active={active === stage}
            label={meta.label}
            count={counts[stage] ?? 0}
            onClick={() => onChange(stage)}
            tone={meta.chip}
          />
        );
      })}
    </div>
  );
}

interface ChipProps {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  /** Optional outline color when not active (Tailwind classes). */
  tone?: string;
}

function Chip({ active, label, count, onClick, tone }: ChipProps) {
  const baseInactive = tone ?? "border-slate-300 text-slate-600";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`text-xs font-bold rounded-full px-3 py-1.5 border transition-all ${
        active
          ? "bg-[#EF6B00] text-white border-[#EF6B00] shadow-sm"
          : `bg-white hover:bg-slate-50 ${baseInactive}`
      }`}
    >
      {label}
      <span className={`mr-1 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-black rounded-full ${
        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
      }`}>{count}</span>
    </button>
  );
}
