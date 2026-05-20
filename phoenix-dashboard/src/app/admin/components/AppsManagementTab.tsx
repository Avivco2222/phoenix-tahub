"use client";

/**
 * AppsManagementTab — admin control over the /ai-hub app registry.
 *
 * Per app, the admin can:
 *   - Toggle hidden (apps disappear from recruiter view but admin still sees
 *     them dimmed on /ai-hub so they can re-enable)
 *   - Override the tag to: חדש / עדכון / בקרוב / ללא / [ברירת מחדל]
 *     Default = the hardcoded `defaultTag` in TOOLS_REGISTRY.
 *
 * Changes go to `PUT /api/admin/apps/{id}`. The hook invalidates the local
 * cache so /ai-hub and the sidebar reflect the change on next render.
 */

import React, { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Save, RefreshCw, Eye, EyeOff } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/components/Toast";
import {
  TOOLS_REGISTRY,
  applyOverrides,
  type AppOverride,
  type AppTag,
  type EffectiveAppEntry,
} from "@/lib/tools-registry";

const CATEGORY_LABEL: Record<EffectiveAppEntry["cat"], string> = {
  pre: "לפני קליטה",
  during: "בתהליך הגיוס",
  onboarding: "בקליטה",
  analytics: "ניתוח",
};

const TAG_OPTIONS: Array<{ value: "" | "new" | "update" | "coming_soon" | "none"; label: string }> = [
  { value: "",            label: "ברירת מחדל" },
  { value: "new",         label: "חדש" },
  { value: "update",      label: "עדכון" },
  { value: "coming_soon", label: "בקרוב" },
  { value: "none",        label: "ללא תגית" },
];

interface PendingChange {
  hidden?: boolean;
  tag?: AppTag;
}

export default function AppsManagementTab() {
  const [overrides, setOverrides] = useState<Record<string, AppOverride>>({});
  const [pending, setPending] = useState<Record<string, PendingChange>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/apps/config`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setOverrides(data.overrides ?? {});
        setPending({});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const effective = useMemo(() => applyOverrides(overrides), [overrides]);

  // Build the row state by merging server overrides with any unsaved pending change.
  const rowState = (id: string): { hidden: boolean; tag: "" | "new" | "update" | "coming_soon" | "none" } => {
    const p = pending[id] ?? {};
    const o = overrides[id] ?? { hidden: false, tag: null };
    const hidden = p.hidden !== undefined ? p.hidden : o.hidden;
    const tagValue = p.tag !== undefined ? p.tag : o.tag;
    return {
      hidden,
      tag: (tagValue ?? "") as "" | "new" | "update" | "coming_soon" | "none",
    };
  };

  const setLocalHidden = (id: string, hidden: boolean) =>
    setPending(p => ({ ...p, [id]: { ...p[id], hidden } }));

  /** Toggle visibility and immediately persist — no separate save needed. */
  const toggleHiddenAndSave = async (id: string) => {
    const current = rowState(id);
    const newHidden = !current.hidden;
    // Optimistic local update
    setOverrides(prev => ({
      ...prev,
      [id]: { ...prev[id], hidden: newHidden, tag: prev[id]?.tag ?? null },
    }));
    setPending(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSaving(id);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/apps/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: newHidden, tag: current.tag === "" ? null : current.tag }),
      });
      if (res.ok) {
        const data = await res.json();
        setOverrides(prev => ({ ...prev, [id]: { hidden: !!data.hidden, tag: data.tag ?? null } }));
        showToast(newHidden ? "אפליקציה הוסתרה ✓" : "אפליקציה הוצגה ✓", "success");
      } else {
        // Roll back optimistic update on failure
        setOverrides(prev => ({ ...prev, [id]: { ...prev[id], hidden: current.hidden } }));
        showToast("שגיאה בשמירה — נסה/י שוב", "error");
      }
    } catch {
      setOverrides(prev => ({ ...prev, [id]: { ...prev[id], hidden: current.hidden } }));
      showToast("שגיאת רשת — שינוי לא נשמר", "error");
    } finally {
      setSaving(null);
    }
  };

  const setLocalTag = (id: string, raw: string) => {
    const tag = raw === "" ? null : (raw as AppTag);
    setPending(p => ({ ...p, [id]: { ...p[id], tag } }));
  };

  const isDirty = (id: string) => !!pending[id];

  const save = async (id: string) => {
    const p = pending[id];
    if (!p) return;
    setSaving(id);
    try {
      // Resolve the effective values we're about to PUT (merging current
      // server state with local edits so partial dirties still send the full
      // intent).
      const state = rowState(id);
      const body = {
        hidden: state.hidden,
        tag: state.tag === "" ? null : state.tag,
      };
      const res = await fetch(`${getApiBaseUrl()}/api/admin/apps/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setOverrides(prev => ({
          ...prev,
          [id]: { hidden: !!data.hidden, tag: data.tag ?? null },
        }));
        setPending(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        showToast("שינויים נשמרו ✓", "success");
      } else {
        showToast("שגיאה בשמירה — נסה/י שוב", "error");
      }
    } finally {
      setSaving(null);
    }
  };

  // Group by category for clean rendering.
  const byCat = useMemo(() => {
    const out: Record<EffectiveAppEntry["cat"], EffectiveAppEntry[]> = {
      pre: [], during: [], onboarding: [], analytics: [],
    };
    effective.forEach(a => out[a.cat].push(a));
    return out;
  }, [effective]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#EF6B00] flex items-center justify-center">
            <LayoutGrid size={24}/>
          </div>
          <div>
            <h2 className="text-xl font-black text-[#002649]">ניהול אפליקציות</h2>
            <p className="text-sm text-slate-500">
              שלוט/י באילו אפליקציות מוצגות למגייסים ובאיזו תגית. {TOOLS_REGISTRY.length} אפליקציות במערכת.
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-[#002649]">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""}/> רענן
        </button>
      </div>

      {(Object.keys(byCat) as Array<EffectiveAppEntry["cat"]>).map(cat => (
        <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-black text-sm text-[#002649]">
            {CATEGORY_LABEL[cat]} ({byCat[cat].length})
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs font-bold text-slate-500 bg-slate-50/50">
              <tr>
                <th className="text-right p-3">אפליקציה</th>
                <th className="text-right p-3 hidden md:table-cell">תיאור</th>
                <th className="text-center p-3 w-32">תגית</th>
                <th className="text-center p-3 w-32">חשיפה</th>
                <th className="text-center p-3 w-32">שמירה</th>
              </tr>
            </thead>
            <tbody>
              {byCat[cat].map(app => {
                const state = rowState(app.id);
                const dirty = isDirty(app.id);
                return (
                  <tr key={app.id} className={`border-t border-slate-100 ${state.hidden ? "bg-slate-50/60" : ""}`}>
                    <td className="p-3">
                      <div className="font-bold text-[#002649]">{app.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{app.id}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-slate-500 text-xs">{app.description}</td>

                    <td className="p-3 text-center">
                      <select
                        value={state.tag}
                        onChange={e => setLocalTag(app.id, e.target.value)}
                        className="text-xs font-bold border border-slate-200 rounded-md px-2 py-1.5 bg-white text-[#002649] focus:outline-none focus:border-[#EF6B00]"
                      >
                        {TAG_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {!pending[app.id]?.tag && app.defaultTag && (
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          default: {app.defaultTag === "new" ? "חדש" : app.defaultTag === "update" ? "עדכון" : "בקרוב"}
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => void toggleHiddenAndSave(app.id)}
                        disabled={saving === app.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors disabled:opacity-60 ${
                          state.hidden
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                        title={state.hidden ? "לחץ/י להציג — נשמר אוטומטית" : "לחץ/י להסתיר — נשמר אוטומטית"}
                      >
                        {saving === app.id
                          ? <><RefreshCw size={12} className="animate-spin"/> שומר...</>
                          : state.hidden
                            ? <><EyeOff size={12}/> מוסתר</>
                            : <><Eye size={12}/> גלוי</>
                        }
                      </button>
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => save(app.id)}
                        disabled={!dirty || saving === app.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                          dirty
                            ? "bg-[#EF6B00] text-white hover:bg-[#d65a00]"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <Save size={12}/> {saving === app.id ? "שומר..." : dirty ? "שמור" : "שמור"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-3">
        השינויים תקפים מיידית למשתמשים החדשים שטוענים את הדף. רענון נשלח אוטומטית אחרי שמירה.
      </div>
    </div>
  );
}
