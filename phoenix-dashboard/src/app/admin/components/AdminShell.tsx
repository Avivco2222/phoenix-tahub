"use client";

/**
 * AdminShell — 3-group / sub-tab navigation for /admin.
 *
 * Replaces the flat row of 7 tabs with:
 *   GROUP CARDS (large, clickable):  📥 דאטה   ⚙️ הגדרות   📊 ביצועים
 *      └── SUB TABS (thin row under the active group)
 *
 * State is synced to ?group=&sub= so refresh / deep-link keep position.
 * Backwards compat: legacy ?tab=X is mapped on mount via LEGACY_TAB_MAP.
 *
 * Caller renders the content area below <AdminShell>; this component
 * exposes `group` and `sub` via render-prop so parent decides what to draw.
 */

import React, { useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Database, Settings as SettingsIcon,
  Upload, History, ShieldCheck, Target, Filter, Users,
  LayoutGrid, Bell, Activity,
} from "lucide-react";

export type GroupId = "data" | "settings";
export type SubTabId =
  | "ingest" | "batches" | "quality"                                                // data
  | "targets" | "rules" | "permissions" | "apps" | "notifications" | "audit-log";   // settings

interface GroupDef {
  id: GroupId;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  subs: SubDef[];
}

interface SubDef {
  id: SubTabId;
  label: string;
  icon: React.ReactNode;
}

export const GROUPS: GroupDef[] = [
  {
    id: "data",
    icon: <Database size={28} />,
    title: "דאטה",
    subtitle: "קליטה • היסטוריה • בקרת איכות",
    accent: "#3B82F6",
    subs: [
      { id: "ingest",  label: "קליטה (Dropzones)", icon: <Upload size={16}/> },
      { id: "batches", label: "היסטוריית אצוות",   icon: <History size={16}/> },
      { id: "quality", label: "בקרת איכות",         icon: <ShieldCheck size={16}/> },
    ],
  },
  {
    id: "settings",
    icon: <SettingsIcon size={28} />,
    title: "הגדרות",
    subtitle: "יעדים • חוקי טיוב • הרשאות • אפליקציות",
    accent: "#EF6B00",
    subs: [
      { id: "targets",       label: "יעדים ו-KPIs",    icon: <Target size={16}/> },
      { id: "rules",         label: "חוקי טיוב",        icon: <Filter size={16}/> },
      { id: "permissions",   label: "הרשאות ומשתמשים",  icon: <Users size={16}/> },
      { id: "apps",          label: "ניהול אפליקציות",   icon: <LayoutGrid size={16}/> },
      { id: "notifications", label: "ניהול התראות",      icon: <Bell size={16}/> },
      { id: "audit-log",     label: "יומן ביקורת",        icon: <Activity size={16}/> },
    ],
  },
  // "Performance" group (AI Inbox + Consumer Map) removed in A9-FU UX
  // cleanup — both panels rendered hard-coded demo payloads (is_demo: True
  // on the backend) and were not wired to real data.
];

const DEFAULT_SUB: Record<GroupId, SubTabId> = {
  data: "ingest",
  settings: "targets",
};

/** Map legacy ?tab= values to (group, sub) so older bookmarks keep working.
 *  "analytics" / "consumer-map" / "performance" → redirected to the canonical
 *  data-ingest landing since the Performance group was retired. */
const LEGACY_TAB_MAP: Record<string, [GroupId, SubTabId]> = {
  data:           ["data", "ingest"],
  batches:        ["data", "batches"],
  quality:        ["data", "quality"],
  targets:        ["settings", "targets"],
  rules:          ["settings", "rules"],
  permissions:    ["settings", "permissions"],
  analytics:      ["data", "ingest"],
  "consumer-map": ["data", "ingest"],
  performance:    ["data", "ingest"],
};

export interface AdminShellState {
  group: GroupId;
  sub: SubTabId;
}

interface Props {
  badges?: Partial<Record<SubTabId, number>>;
  /** Fired whenever the active sub changes (initial mount and clicks). */
  onChange?: (state: AdminShellState) => void;
}

export default function AdminShell({ badges, onChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Resolve current group + sub from URL, with legacy ?tab= migration.
  const { group, sub } = useMemo<AdminShellState>(() => {
    const legacyTab = search.get("tab");
    if (legacyTab && LEGACY_TAB_MAP[legacyTab]) {
      const [g, s] = LEGACY_TAB_MAP[legacyTab];
      return { group: g, sub: s };
    }
    const rawGroup = (search.get("group") as string | null) || "data";
    // Retired "performance" group falls back to data/ingest so old links don't 404.
    const g: GroupId = rawGroup === "data" || rawGroup === "settings" ? rawGroup : "data";
    const groupDef = GROUPS.find(x => x.id === g);
    const requestedSub = search.get("sub") as SubTabId | null;
    const sub =
      requestedSub && groupDef?.subs.some(s => s.id === requestedSub)
        ? requestedSub
        : DEFAULT_SUB[g];
    return { group: g, sub };
  }, [search]);

  // Migrate legacy ?tab= to canonical ?group=&sub= without losing history.
  useEffect(() => {
    if (search.get("tab")) {
      const params = new URLSearchParams(search.toString());
      params.delete("tab");
      params.set("group", group);
      params.set("sub", sub);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [search, group, sub, pathname, router]);

  // Notify parent of the resolved nav state (initial mount + on any change).
  useEffect(() => {
    onChange?.({ group, sub });
  }, [group, sub, onChange]);

  const setNav = (g: GroupId, s?: SubTabId) => {
    const params = new URLSearchParams(search.toString());
    params.set("group", g);
    params.set("sub", s ?? DEFAULT_SUB[g]);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const activeGroup = GROUPS.find(x => x.id === group) ?? GROUPS[0];

  return (
    <div className="space-y-5">
      {/* GROUP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {GROUPS.map(g => {
          const isActive = g.id === group;
          const groupBadge = g.subs.reduce((acc, s) => acc + (badges?.[s.id] ?? 0), 0);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setNav(g.id)}
              className={`relative text-right rounded-2xl border p-5 transition-all flex items-center gap-4 ${
                isActive
                  ? "bg-[#002649] text-white border-[#002649] shadow-lg"
                  : "bg-white text-[#002649] border-slate-200 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div
                className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${
                  isActive ? "bg-white/15" : "bg-slate-50"
                }`}
                style={!isActive ? { color: g.accent } : undefined}
              >
                {g.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-lg leading-tight">{g.title}</div>
                <div className={`text-xs mt-1 ${isActive ? "text-white/70" : "text-slate-500"}`}>
                  {g.subtitle}
                </div>
              </div>
              {groupBadge > 0 && (
                <span
                  className={`absolute top-2 left-2 min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-black flex items-center justify-center ${
                    isActive ? "bg-[#EF6B00] text-white" : "bg-[#EF6B00] text-white"
                  }`}
                >
                  {groupBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB TABS */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-1">
          {activeGroup.subs.map(s => {
            const isActive = s.id === sub;
            const count = badges?.[s.id] ?? 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setNav(group, s.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-[#EF6B00] text-[#002649]"
                    : "border-transparent text-slate-500 hover:text-[#002649]"
                }`}
              >
                {s.icon}
                <span>{s.label}</span>
                {count > 0 && (
                  <span className="bg-[#EF6B00]/10 text-[#EF6B00] text-[10px] font-black px-1.5 rounded-full min-w-[18px] text-center">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
