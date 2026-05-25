/**
 * Unified pipeline stage taxonomy — shared between /candidates and /jobs.
 *
 * Mirrors backend `UNIFIED_STAGES` in constants.py. Order of `STAGE_ORDER`
 * matches the funnel direction (left=top of funnel, right=outcomes), so
 * chips display stages in a sensible reading order in RTL/LTR.
 *
 * Audit Phase 4 / Wave B expanded this list from 8 → 14 stages so the
 * Phoenix ATS terminology maps 1:1 onto our codes. The legacy
 * "INTERVIEW" code is retained as a fallback for historical rows /
 * data sources that don't distinguish phone/HR/manager interviews.
 */

export type UnifiedStage =
  | "ACTIVE"
  | "SOURCING"
  | "SCREEN"
  | "PHONE_INTERVIEW"
  | "HR_INTERVIEW"
  | "MANAGER_INTERVIEW"
  | "INTERVIEW"
  | "TESTS"
  | "REFERENCES"
  | "OFFER"
  | "HIRED"
  | "AWAITING_START"
  | "STARTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "NO_RESPONSE";

export const STAGE_ORDER: UnifiedStage[] = [
  "ACTIVE",
  "SOURCING",
  "SCREEN",
  "PHONE_INTERVIEW",
  "HR_INTERVIEW",
  "MANAGER_INTERVIEW",
  "INTERVIEW",
  "TESTS",
  "REFERENCES",
  "OFFER",
  "HIRED",
  "AWAITING_START",
  "STARTED",
  "REJECTED",
  "WITHDRAWN",
  "NO_RESPONSE",
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
  SOURCING: {
    label: "הגיש מועמדות",
    short: "הוגש",
    badge: "bg-slate-50 text-slate-600 border-slate-200",
    chip: "border-slate-300 text-slate-600",
    description: "המועמד הגיש קו״ח למשרה — טרם נסקר ע״י המגייסת.",
  },
  SCREEN: {
    label: "סינון ראשוני",
    short: "סינון",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    chip: "border-sky-300 text-sky-700",
    description: "סינון קו״ח על ידי המגייסת — לפני שיחה ראשונה.",
  },
  PHONE_INTERVIEW: {
    label: "ראיון טלפוני",
    short: "טלפוני",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
    chip: "border-cyan-300 text-cyan-700",
    description: "שיחת היכרות ראשונה / סינון טלפוני.",
  },
  HR_INTERVIEW: {
    label: "ראיון HR",
    short: "HR",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    chip: "border-indigo-300 text-indigo-700",
    description: "ראיון גיוס משאבי אנוש (יכול לכלול מנהל מגייס).",
  },
  MANAGER_INTERVIEW: {
    label: "ראיון מנהל",
    short: "מנהל",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    chip: "border-violet-300 text-violet-700",
    description: "ראיון מנהל מקצועי / מנהל מגייס.",
  },
  INTERVIEW: {
    label: "בראיון",
    short: "ראיון",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    chip: "border-indigo-300 text-indigo-700",
    description: "ראיון (כללי — נוצר טרם פיצול PHONE/HR/MANAGER).",
  },
  TESTS: {
    label: "מבדקים",
    short: "מבדקים",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    chip: "border-blue-300 text-blue-700",
    description: "מבדקי התאמה / מרכז הערכה.",
  },
  REFERENCES: {
    label: "בדיקת ממליצים",
    short: "ממליצים",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    chip: "border-purple-300 text-purple-700",
    description: "בדיקת ממליצים והשלמות לפני הצעת שכר.",
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
    label: "נדחה",
    short: "נדחה",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    chip: "border-rose-300 text-rose-600",
    description: "שלילה ע״י הארגון — סיבה ב-closure_reason.",
  },
  WITHDRAWN: {
    label: "הסרת מועמדות",
    short: "הוסר",
    badge: "bg-stone-100 text-stone-700 border-stone-200",
    chip: "border-stone-300 text-stone-600",
    description: "המועמד הסיר את עצמו מהתהליך — סיבה ב-closure_reason.",
  },
  NO_RESPONSE: {
    label: "אין מענה",
    short: "אין מענה",
    badge: "bg-zinc-100 text-zinc-700 border-zinc-200",
    chip: "border-zinc-300 text-zinc-600",
    description: "המועמד לא ענה לאחר מספר ניסיונות יצירת קשר.",
  },
};

/** Returns metadata with safe fallback for unknown values. */
export function getStageMeta(stage: string | null | undefined): StageMeta {
  const code = (stage || "ACTIVE").toUpperCase() as UnifiedStage;
  return STAGE_META[code] ?? STAGE_META.ACTIVE;
}
