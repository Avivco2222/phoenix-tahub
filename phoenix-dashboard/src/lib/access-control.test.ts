/**
 * Unit tests for `lib/access-control.ts` — the role-based gates that
 * decide which routes a user can see and which actions they can perform.
 *
 * These are pure functions, no DOM needed. Worth testing because they
 * are the single source of truth used by both the sidebar (visibility)
 * and the page-level guards (canMutateData). A regression here
 * silently expands or shrinks the surface area users see, which is the
 * worst class of bug for an HR / IAM product.
 */

import { describe, expect, it } from "vitest";
import {
  shouldShowSidebar,
  getVisibleNavByRole,
  canMutateData,
  type Role,
} from "./access-control";

describe("shouldShowSidebar", () => {
  it.each<[Role, boolean]>([
    ["admin", true],
    ["recruiter", true],
    ["hrbp", true],
    ["hiring_manager", false],
  ])("role=%s → %s", (role, expected) => {
    expect(shouldShowSidebar(role)).toBe(expected);
  });
});

describe("getVisibleNavByRole", () => {
  it("admin sees every privileged route, including /admin and /admin/permissions", () => {
    const nav = getVisibleNavByRole("admin");
    expect(nav).toContain("/");
    expect(nav).toContain("/admin");
    expect(nav).toContain("/admin/permissions");
    expect(nav).toContain("/budget");
  });

  it("recruiter sees the operational subset only — no /headcount, no /budget, no /admin", () => {
    const nav = getVisibleNavByRole("recruiter");
    expect(nav).toEqual(["/", "/intelligence", "/jobs", "/candidates", "/ai-hub"]);
    expect(nav).not.toContain("/headcount");
    expect(nav).not.toContain("/budget");
    expect(nav).not.toContain("/admin");
  });

  it("hrbp sees /headcount and /budget but NOT /admin", () => {
    const nav = getVisibleNavByRole("hrbp");
    expect(nav).toContain("/headcount");
    expect(nav).toContain("/budget");
    expect(nav).not.toContain("/admin");
  });

  it("hiring_manager is restricted to the dashboard only", () => {
    expect(getVisibleNavByRole("hiring_manager")).toEqual(["/"]);
  });
});

describe("canMutateData", () => {
  it.each<[Role, boolean]>([
    ["admin", true],
    ["recruiter", true],
    ["hrbp", false],         // read-only by policy
    ["hiring_manager", false],
  ])("role=%s can mutate → %s", (role, expected) => {
    expect(canMutateData(role)).toBe(expected);
  });
});
