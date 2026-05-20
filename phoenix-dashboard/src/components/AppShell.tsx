"use client";

import React, { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Settings, PieChart,
  Brain, BadgeDollarSign, Zap, Orbit, Building2, LogOut, Loader2, Eye, ArrowRightLeft,
  Pin,
} from "lucide-react";
import { useSession, UserRole } from "@/context/SessionContext";
import { BellDropdown } from "@/components/BellDropdown";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useAppPins } from "@/lib/app-pins";
import { useAppConfig } from "@/lib/use-app-config";
import { applyOverrides, toolHref } from "@/lib/tools-registry";
import { shouldShowSidebar } from "@/lib/access-control";

interface NavItemConfig {
  href: string;
  label: string;
  icon: ReactNode;
  /** Roles allowed to see this nav item. If omitted, visible to all authenticated users. */
  roles?: UserRole[];
  /** Visual section: "main", "tools". (Admin/system items are no longer in the sidebar — see gear icon next to profile.) */
  section: "main" | "tools";
}

// Stroke-width 1.75 across the board for an elegant, modern feel — keeps lucide's
// outline character but slimmer than the 2.0 default. Matches PageHeader.
const NAV_ITEMS: NavItemConfig[] = [
  { href: "/", label: "מבט על", icon: <LayoutDashboard size={18} strokeWidth={1.75} />, section: "main" },
  { href: "/intelligence", label: "תובנות ותחזיות", icon: <Brain size={18} strokeWidth={1.75} />, section: "main", roles: ["admin", "hrbp", "recruiter"] },
  { href: "/headcount", label: "דוח שליטה", icon: <Building2 size={18} strokeWidth={1.75} />, section: "main", roles: ["admin", "hrbp"] },
  { href: "/jobs", label: "משרות", icon: <PieChart size={18} strokeWidth={1.75} />, section: "main" },
  { href: "/candidates", label: "מועמדים", icon: <Users size={18} strokeWidth={1.75} />, section: "main" },
  { href: "/budget", label: "ניהול תקציב", icon: <BadgeDollarSign size={18} strokeWidth={1.75} />, section: "main", roles: ["admin", "hrbp"] },
  { href: "/ai-hub", label: "אפליקציות", icon: <Zap size={18} strokeWidth={1.75} />, section: "tools" },
];

// Routes that require admin role (gated client-side; backend enforces independently).
const ADMIN_ONLY_PREFIXES = ["/admin"];

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "מנהל מערכת",
  hrbp: "HRBP",
  recruiter: "מגייסת",
  hiring_manager: "מנהל ישיר",
};

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout, stopImpersonating } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // ALL hooks must be called unconditionally — before any early return.
  // Rules of Hooks: same order, every render.
  const { pins } = useAppPins();
  const { overrides } = useAppConfig();

  // Client-side route guard. Complements backend RBAC.
  useEffect(() => {
    if (!user || pathname === "/login") return;
    // Non-sidebar roles (hiring_manager, etc.) may only access "/".
    if (!shouldShowSidebar(user.role) && pathname !== "/") {
      router.replace("/");
      return;
    }
    const matchingRoute = NAV_ITEMS.find(item => item.href === pathname || pathname.startsWith(item.href + "/"));
    if (matchingRoute?.roles && !matchingRoute.roles.includes(user.role)) {
      router.replace("/");
      return;
    }
    // Admin-only routes (no longer in sidebar but reachable via gear icon).
    if (ADMIN_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + "/")) && user.role !== "admin") {
      router.replace("/");
    }
  }, [user, pathname, router]);

  // Login page renders without the shell.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC] text-[#002649]">
        <Loader2 size={28} className="animate-spin text-[#EF6B00]" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // ── Non-sidebar roles (hiring_manager, coordinator, etc.) ─────────────────
  // These users see NO sidebar and NO top-nav. They land on the dashboard
  // only ("/"), filtered by their own department on the backend.
  if (!shouldShowSidebar(user.role)) {
    return (
      <div className="flex flex-col h-screen bg-[#F8FAFC]" dir="rtl">
        {/* Minimal banner: logo + role label + logout */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm shrink-0">
          <div dir="ltr" className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#002649]">FNX</span>
            <Orbit size={20} strokeWidth={1.75} fill="#EF6B00" fillOpacity={0.15} className="text-[#EF6B00]" />
            <span className="text-lg text-[#002649]"><span className="font-black">TA</span><span className="font-light">Hub</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">{user.name}</span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{ROLE_LABEL[user.role]}</span>
            <button
              onClick={logout}
              title="התנתק"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    );
  }

  const visibleItems = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(user.role));
  // Sidebar-pinned apps (per-browser localStorage). Section is rendered only
  // when at least one app is pinned (option C in the design discussion).
  // We resolve each pin against the effective registry so hidden apps don't
  // show up even if a user pinned them before the admin hid them.
  const isAdminForPins = user.role === "admin";
  const pinnedApps = applyOverrides(overrides)
    .filter(a => pins.includes(a.id) && (isAdminForPins || !a.hidden));
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("");

  const isImpersonating = !!user.impersonator;
  const isAdmin = user.role === "admin" || isImpersonating; // gear icon visible to real admins; impersonators don't see it

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* === SIDEBAR === */}
      <aside className="w-64 bg-white border-l border-slate-200 flex flex-col shrink-0 h-full">
        {/* LOGO AREA */}
        <div className="px-6 py-6 border-b border-slate-100 group cursor-default">
          <div className="flex flex-col items-center justify-center gap-2 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div dir="ltr" className="flex items-center gap-2.5">
              <span className="text-[26px] font-bold text-[#002649] tracking-tight">FNX</span>
              {/* Duotone Phoenix mark: orange fill at low opacity + crisp blue stroke
                  on hover. At rest, the mark sits as a slim orange outline; hovering
                  the FNX TAHub block warms it up and spins it 180° (full revolution
                  within the longer transition).  */}
              <Orbit
                size={28}
                strokeWidth={1.75}
                fill="#EF6B00"
                fillOpacity={0.12}
                className="text-[#EF6B00] transition-all duration-700 ease-in-out group-hover:rotate-180 group-hover:scale-110 group-hover:fill-[#EF6B00]/20 drop-shadow-sm group-hover:drop-shadow-[0_0_8px_rgba(239,107,0,0.55)]"
              />
              <div className="text-[26px] text-[#002649] tracking-tight flex items-baseline">
                <span className="font-black">TA</span>
                <span className="font-light">Hub</span>
              </div>
            </div>
            <div className="text-[9px] uppercase tracking-[0.25em] whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity duration-500">
              <span className="font-medium text-slate-400 group-hover:text-[#002649] transition-colors duration-500 flex items-center justify-center">
                Smart Hiring
                <span className="text-[#EF6B00]/60 mx-2 text-[12px] leading-none">&bull;</span>
                Human Touch
              </span>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          {visibleItems.filter(i => i.section === "main").map(item => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}

          {visibleItems.some(i => i.section === "tools") && (
            <div className="pt-4 pb-2 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">שימושי</div>
          )}
          {visibleItems.filter(i => i.section === "tools").map(item => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}

          {/* Pinned apps section — appears only when the recruiter has at least
              one pin. Each row links to the app's deep-link inside /ai-hub. */}
          {pinnedApps.length > 0 && (
            <>
              <div className="pt-4 pb-2 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Pin size={11} strokeWidth={2} fill="currentColor" className="text-[#EF6B00]/70"/>
                <span>האפליקציות שלי</span>
              </div>
              {pinnedApps.map(app => {
                const href = toolHref(app);
                const active = pathname === "/ai-hub" && href.includes(`tool=${app.id}`);
                return (
                  <Link
                    key={app.id}
                    href={href}
                    className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-[#002649] text-white" : "text-slate-600 hover:bg-slate-100 hover:text-[#002649]"
                    }`}
                    title={app.description}
                  >
                    <Pin size={14} strokeWidth={1.75} fill="currentColor" className={active ? "" : "text-[#EF6B00]/50"}/>
                    <span className="truncate">{app.title}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* USER PROFILE */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#002649] text-white flex items-center justify-center font-bold shrink-0" aria-hidden>
              {initials || "??"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#002649] truncate flex items-center gap-1.5" title={user.name}>
                {user.name}
                {isImpersonating && <Eye size={12} className="text-amber-600 shrink-0" />}
              </div>
              <div className="text-xs text-slate-500 truncate" title={user.email}>
                {ROLE_LABEL[user.role]}
              </div>
            </div>
            {isAdmin && !isImpersonating && (
              <Link
                href="/admin"
                title="הגדרות Admin"
                aria-label="הגדרות Admin"
                className={`p-2 rounded-lg transition-colors shrink-0 ${
                  pathname.startsWith("/admin")
                    ? "text-[#EF6B00] bg-orange-50"
                    : "text-slate-400 hover:text-[#002649] hover:bg-slate-200"
                }`}
              >
                <Settings size={16} />
              </Link>
            )}
            <button
              onClick={logout}
              title="התנתק"
              aria-label="התנתק"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Impersonation banner — visible only when admin is "viewing as" another user */}
        {isImpersonating && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0" role="alert">
            <div className="flex items-center gap-3 text-sm text-amber-900 font-bold min-w-0">
              <Eye size={16} className="text-amber-600 shrink-0" />
              <span className="truncate">
                את/ה צופה במערכת בנעליו של <span className="font-black">{user.name}</span> ({ROLE_LABEL[user.role]})
                <span className="font-medium text-amber-700"> · נכנסת כ-{user.impersonator_email}</span>
              </span>
            </div>
            <button
              onClick={() => stopImpersonating().catch(err => alert(err.message))}
              className="bg-[#002649] hover:bg-[#EF6B00] text-white px-4 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shrink-0"
            >
              <ArrowRightLeft size={14} /> חזרה לחשבון Admin
            </button>
          </div>
        )}
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-end px-8 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <BellDropdown />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, href, active }: NavItemConfig & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`nav-nudge w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 group ${
        active
          ? "bg-[#002649] text-white shadow-md"
          : "text-[#002649]/90 hover:bg-slate-50 hover:text-[#EF6B00]"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Icon hierarchy: active items glow phoenix-orange, idle stay slate
            and brighten on hover. Stroke gets thicker on active to feel
            "filled" without swapping the icon set. */}
        <span
          className={`transition-all ${
            active
              ? "text-[#EF6B00] icon-glow-phoenix"
              : "text-slate-400 group-hover:text-[#EF6B00]"
          }`}
        >
          {icon}
        </span>
        <span>{label}</span>
      </div>
    </Link>
  );
}
