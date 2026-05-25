/**
 * Unit tests for `lib/stages.ts` — the unified-pipeline taxonomy that
 * both /candidates and /jobs depend on. Mirrored from backend
 * `UNIFIED_STAGES`; keeping the two in sync is exactly the kind of
 * thing a forgotten edit silently breaks.
 *
 * The tests pin three things:
 *   1. The exported `STAGE_ORDER` covers every union variant of
 *      `UnifiedStage` (no orphans).
 *   2. `STAGE_META` has an entry for every variant (lookups can't
 *      return `undefined` at runtime).
 *   3. `getStageMeta` tolerates the messy real-world inputs — nulls,
 *      lowercase, unknown codes — by falling back to ACTIVE rather
 *      than throwing.
 */

import { describe, expect, it } from "vitest";
import {
  STAGE_ORDER,
  STAGE_META,
  getStageMeta,
  type UnifiedStage,
} from "./stages";

// Audit Phase 4 / Wave B expanded this from 8 to 16 stages so the codes
// map 1:1 onto the real Phoenix ATS terminology (PHONE_INTERVIEW,
// HR_INTERVIEW, MANAGER_INTERVIEW, TESTS, REFERENCES, SOURCING,
// WITHDRAWN, NO_RESPONSE) — see backend/constants.py.
const ALL_STAGES: UnifiedStage[] = [
  "ACTIVE", "SOURCING", "SCREEN",
  "PHONE_INTERVIEW", "HR_INTERVIEW", "MANAGER_INTERVIEW", "INTERVIEW",
  "TESTS", "REFERENCES", "OFFER",
  "HIRED", "AWAITING_START", "STARTED",
  "REJECTED", "WITHDRAWN", "NO_RESPONSE",
];

describe("STAGE_ORDER", () => {
  it("contains every UnifiedStage variant exactly once", () => {
    expect(new Set(STAGE_ORDER)).toEqual(new Set(ALL_STAGES));
    expect(STAGE_ORDER.length).toBe(ALL_STAGES.length);
  });

  it("starts with ACTIVE (top of funnel) and ends with a terminal stage", () => {
    expect(STAGE_ORDER[0]).toBe("ACTIVE");
    // After Wave B the terminal slot is NO_RESPONSE; REJECTED / WITHDRAWN
    // sit immediately before it so the funnel reads naturally LTR/RTL.
    expect(["REJECTED", "WITHDRAWN", "NO_RESPONSE"]).toContain(STAGE_ORDER.at(-1)!);
  });
});

describe("STAGE_META", () => {
  it.each(ALL_STAGES)("has a complete meta record for %s", (stage) => {
    const meta = STAGE_META[stage];
    expect(meta).toBeDefined();
    expect(typeof meta.label).toBe("string");
    expect(meta.label.length).toBeGreaterThan(0);
    expect(typeof meta.short).toBe("string");
    expect(typeof meta.badge).toBe("string");
    expect(typeof meta.chip).toBe("string");
  });
});

describe("getStageMeta", () => {
  it("returns the correct record for an exact match", () => {
    expect(getStageMeta("OFFER")).toBe(STAGE_META.OFFER);
  });

  it("upper-cases the input so a lowercase API response still matches", () => {
    expect(getStageMeta("interview")).toBe(STAGE_META.INTERVIEW);
  });

  it("falls back to ACTIVE when the stage is null / undefined / empty", () => {
    expect(getStageMeta(null)).toBe(STAGE_META.ACTIVE);
    expect(getStageMeta(undefined)).toBe(STAGE_META.ACTIVE);
    expect(getStageMeta("")).toBe(STAGE_META.ACTIVE);
  });

  it("falls back to ACTIVE for completely unknown codes (no throw)", () => {
    expect(getStageMeta("SOMETHING_NEW")).toBe(STAGE_META.ACTIVE);
  });
});
