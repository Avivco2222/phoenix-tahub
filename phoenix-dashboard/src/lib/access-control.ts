export type Role = "admin" | "hrbp" | "recruiter" | "hiring_manager";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  usf: string;
  role: Role;
  department?: string;
}

export const APP_USERS: AppUser[] = [
  { id: "u1", name: "אביב כהן", email: "avivc@fnx.co.il", usf: "100001", role: "admin" },
  { id: "u2", name: "מור אהרון", email: "mora@fnx.co.il", usf: "100245", role: "recruiter", department: "R&D" },
  { id: "u3", name: "דן שפירא", email: "dans@fnx.co.il", usf: "100333", role: "hiring_manager", department: "R&D" },
  { id: "u4", name: "שרון לוי", email: "sharonl@fnx.co.il", usf: "100487", role: "hrbp", department: "Sales & Service" },
];

/**
 * Roles that get a full sidebar.
 * hiring_manager and coordinator see NO sidebar — they land on the
 * dashboard only and cannot navigate to other sections.
 */
export function shouldShowSidebar(role: Role): boolean {
  return role === "admin" || role === "recruiter" || role === "hrbp";
}

export function getVisibleNavByRole(role: Role): string[] {
  if (role === "admin") {
    return [
      "/",
      "/intelligence",
      "/headcount",
      "/jobs",
      "/candidates",
      "/budget",
      "/ai-hub",
      "/admin",
      "/admin/permissions",
    ];
  }

  if (role === "recruiter") {
    // Recruiter: dashboard, intelligence/forecasts, jobs, candidates, apps.
    // No headcount, no budget.
    return ["/", "/intelligence", "/jobs", "/candidates", "/ai-hub"];
  }

  if (role === "hrbp") {
    // HRBP needs Budget (FinOps) + AI Hub (mobility/onboarding tools).
    return ["/", "/intelligence", "/headcount", "/jobs", "/candidates", "/budget", "/ai-hub"];
  }

  if (role === "hiring_manager") {
    // No sidebar — only see the dashboard (/) filtered to their own units.
    return ["/"];
  }

  return ["/"];
}

export function canMutateData(role: Role): boolean {
  return role === "admin" || role === "recruiter";
}
