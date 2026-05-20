"use client";

import { Info } from "lucide-react";

interface DemoBadgeProps {
  label?: string;
  tooltip?: string;
}

/**
 * Visual badge marking sections backed by mock/demo data rather than live aggregations.
 * Use until backend integration is complete (see roadmap v1.1).
 */
export function DemoBadge({
  label = "נתוני הדגמה",
  tooltip = "הנתונים בטאב זה הם דגימה לצורך הצגה. אינטגרציה לייב עם מקורות הנתונים מתוכננת לגרסה 1.1.",
}: DemoBadgeProps) {
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md"
      role="note"
      aria-label={tooltip}
    >
      <Info size={12} />
      {label}
    </span>
  );
}
