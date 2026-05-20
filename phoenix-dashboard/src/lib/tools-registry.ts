/**
 * Static registry of all /ai-hub tools.
 *
 * Used by:
 *   - /ai-hub page itself to render category grids
 *   - GlobalSearch to expose tools as a 4th searchable result kind
 *
 * Keep titles + descriptions + keywords in Hebrew so the global search matches
 * the user's typing language naturally.
 */

export type AppTag = "new" | "update" | "coming_soon" | "none" | null;

export interface ToolRegistryEntry {
  id: string;
  /** ai-hub category id — used to build the deep-link */
  cat: "pre" | "during" | "onboarding" | "analytics";
  title: string;
  description: string;
  keywords: string[];
  /** Hardcoded default tag baked into the registry. Admin overrides via /api/apps/config. */
  defaultTag?: Exclude<AppTag, "none" | null>;
}

/** Admin-managed override loaded from /api/apps/config. */
export interface AppOverride {
  hidden: boolean;
  tag: AppTag;
}

export interface EffectiveAppEntry extends ToolRegistryEntry {
  /** Final tag after applying override (override wins; "none" clears default). */
  effectiveTag: "new" | "update" | "coming_soon" | null;
  /** Admin-set hidden flag. Frontend should hide from non-admins. */
  hidden: boolean;
}

export const TOOLS_REGISTRY: ToolRegistryEntry[] = [
  // PRE-HIRE
  { id: "cv-analyzer", cat: "pre", title: "ניתוח קורות חיים", description: "חילוץ אוטומטי של שדות מ-CV", defaultTag: "new",
    keywords: ["cv","resume","קורות חיים","ניתוח","extract","חילוץ"] },
  { id: "questions", cat: "pre", title: "בנק שאלות לראיון", description: "שאלות לפי תפקיד ושלב", defaultTag: "new",
    keywords: ["שאלות","ראיון","interview","questions","behavioral","טכני","screening"] },
  { id: "jd-generator", cat: "pre", title: "מחולל תיאורי משרה", description: "JD בעברית עם שפה inclusive", defaultTag: "new",
    keywords: ["jd","job description","תיאור משרה","דרישות","משרה","template","תבנית"] },

  // DURING HIRE
  { id: "whisperer", cat: "during", title: "Briefly", description: "תובנות יומיות למנהל גיוס",
    keywords: ["briefly","whisperer","insights","תובנות","מנהל"] },
  { id: "mobility", cat: "during", title: "סימולטור שכר וניוד", description: "חישוב מחיר ניוד פנימי",
    keywords: ["שכר","ניוד","mobility","salary","calculator","סימולטור"] },
  { id: "compensation", cat: "during", title: "בנצ'מארק שכר", description: "השוואת הצעה לטווחי שוק", defaultTag: "coming_soon",
    keywords: ["compensation","benchmark","טווח שכר","הצעה","שוק","משכורת"] },
  { id: "phone-screen", cat: "during", title: "סיכום שיחת סינון", description: "סיווג bullets לחוזקות/חששות", defaultTag: "new",
    keywords: ["phone screen","סינון","סיכום","notes","summary","שיחה"] },
  { id: "scheduler", cat: "during", title: "מתאם/ת ראיונות חכם/ה", description: "מציאת חלונות משותפים", defaultTag: "coming_soon",
    keywords: ["calendar","schedule","scheduler","תיאום","ראיון","יומן"] },

  // ONBOARDING
  { id: "smart-onboarding", cat: "onboarding", title: "אשף קליטת עובד", description: "wizard 7-שלבים מלא",
    keywords: ["onboarding","קליטה","wizard","אשף"] },
  { id: "welcome-email", cat: "onboarding", title: "מחולל מייל ברוכים הבאים", description: "טמפלייט מותאם אישית", defaultTag: "new",
    keywords: ["welcome","email","מייל","ברוכים הבאים","עובד חדש"] },

  // ANALYTICS
  { id: "reports", cat: "analytics", title: "מחולל דוחות AI", description: "יצירת PDFs לפי דרישה",
    keywords: ["report","pdf","דוח","דוחות","ai"] },
  { id: "coach", cat: "analytics", title: "המאמן/ת הביצועי/ת", description: "scorecard אישי שבועי", defaultTag: "new",
    keywords: ["coach","performance","scorecard","kpi","ביצועים","מאמן","שבועי"] },
  { id: "sla-watchdog", cat: "analytics", title: "SLA Watchdog", description: "התראות על תהליכים תקועים", defaultTag: "new",
    keywords: ["sla","watchdog","alert","התראה","תקוע","stuck","אזהרה"] },
  { id: "headcount-forecaster", cat: "analytics", title: "תחזית מצבה", description: "הקרנת צמיחה ועלות שכר", defaultTag: "coming_soon",
    keywords: ["forecast","תחזית","headcount","מצבה","projection","הקרנה"] },
];

/**
 * Merge static registry with admin overrides.
 *
 * Tag precedence:
 *   - override.tag === "none"  → no tag (admin force-clears)
 *   - override.tag is set      → that tag wins
 *   - override.tag null/absent → fallback to entry.defaultTag
 *
 * Hidden:
 *   - override.hidden === true → mark as hidden (caller decides what to do for
 *     admins vs non-admins — typically: hide entirely for non-admins, render
 *     dimmed for admins so they can re-enable).
 */
export function applyOverrides(
  overrides: Record<string, AppOverride>,
): EffectiveAppEntry[] {
  return TOOLS_REGISTRY.map(entry => {
    const ov = overrides[entry.id];
    let effectiveTag: EffectiveAppEntry["effectiveTag"];
    if (ov?.tag === "none") {
      effectiveTag = null;
    } else if (ov?.tag) {
      effectiveTag = ov.tag;
    } else {
      effectiveTag = entry.defaultTag ?? null;
    }
    return {
      ...entry,
      effectiveTag,
      hidden: !!ov?.hidden,
    };
  });
}

/** Convenience: get a single entry by id with overrides applied. */
export function findEffective(id: string, overrides: Record<string, AppOverride>): EffectiveAppEntry | null {
  return applyOverrides(overrides).find(e => e.id === id) ?? null;
}

/**
 * Filter tools by case-insensitive query against title + description + keywords.
 * Optionally accepts admin overrides; hidden apps are skipped unless `includeHidden=true`.
 */
export function searchTools(
  query: string,
  limit = 5,
  overrides?: Record<string, AppOverride>,
  includeHidden = false,
): EffectiveAppEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const effective = applyOverrides(overrides ?? {});
  const out: EffectiveAppEntry[] = [];
  for (const tool of effective) {
    if (tool.hidden && !includeHidden) continue;
    const haystack = [tool.title, tool.description, ...tool.keywords].join(" ").toLowerCase();
    if (haystack.includes(q)) {
      out.push(tool);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Build a deep-link URL into /ai-hub for the given tool. */
export function toolHref(tool: { cat: ToolRegistryEntry["cat"]; id: string }): string {
  return `/ai-hub?cat=${tool.cat}&tool=${tool.id}`;
}
