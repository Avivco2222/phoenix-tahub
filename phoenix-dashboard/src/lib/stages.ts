/**
 * Unified pipeline stage taxonomy — shared between /candidates and /jobs.
 *
 * Mirrors backend `UNIFIED_STAGES` in main.py. Order of `STAGE_ORDER` matches
 * the funnel direction (left=top of funnel, right=outcomes), so chips display
 * stages in a sensible reading order in RTL/LTR.
 */

export type UnifiedStage =
  | "ACTIVE"
  | "SCREEN"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "AWAITING_START"
  | "STARTED"
  | "REJECTED";

export const STAGE_ORDER: UnifiedStage[] = [
  "ACTIVE",
  "SCREEN",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "AWAITING_START",
  "STARTED",
  "REJECTED",
];

interface StageMeta {
  label: string;          // Hebrew label for badge / chip
  short: string;          // shorter form for tight layouts (e.g. job-row breakdown)
  /** Tailwind classes — one for filled badge, one for outlined chip. */
  badge: string;
  chip: string;
  description: string;
}

export const STAGE_META: Record<UnifiedStage, StageMeta> = {
  ACTIVE: {
    label: "חדש",
    short: "חדש",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    chip: "border-slate-300 text-slate-600",
    description: "מועמד חדש בתהליך — טרם שובץ לשלב מובנה.",
  },
  SCREEN: {
    label: "סינון ראשוני",
    short: "סינון",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    chip: "border-sky-300 text-sky-700",
    description: "ראיון טלפוני / HR / ראשוני.",
  },
  INTERVIEW: {
    label: "בראיון",
    short: "ראיון",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    chip: "border-indigo-300 text-indigo-700",
    description: "ראיון מקצועי / מנהל / מרכז הערכה.",
  },
  OFFER: {
    label: "בהצעה",
    short: "הצעה",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    chip: "border-amber-300 text-amber-800",
    description: "הצעת שכר / חוזה / ממתין לחתימה.",
  },
  HIRED: {
    label: "התקבל/ה",
    short: "התקבל",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    chip: "border-emerald-300 text-emerald-700",
    description: "סיום תהליך גיוס בהצלחה — טרם רשומה כקליטה.",
  },
  AWAITING_START: {
    label: "ממתין/ה לקליטה",
    short: "ממתין",
    badge: "bg-orange-50 text-orange-800 border-orange-200",
    chip: "border-orange-300 text-orange-800",
    description: "אושרה קליטה — ממתין לתאריך תחילת עבודה.",
  },
  STARTED: {
    label: "בקליטה פעילה",
    short: "בקליטה",
    badge: "bg-green-100 text-green-800 border-green-300",
    chip: "border-green-400 text-green-800",
    description: "תהליך קליטה פעיל — checklist בעבודה.",
  },
  REJECTED: {
    label: "ארכיון",
    short: "ארכיון",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    chip: "border-rose-300 text-rose-600",
    description: "נדחה / ויתור / עזב חברה — היסטורי.",
  },
};

/** Returns metadata with safe fallback for unknown values. */
export function getStageMeta(stage: string | null | undefined): StageMeta {
  const code = (stage || "ACTIVE").toUpperCase() as UnifiedStage;
  return STAGE_META[code] ?? STAGE_META.ACTIVE;
}
