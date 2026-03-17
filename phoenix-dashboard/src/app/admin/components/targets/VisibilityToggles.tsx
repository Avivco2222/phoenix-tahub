"use client";
import React, { useState } from "react";
import { Save, Eye, EyeOff } from "lucide-react";
import { useAdminConfig, VisibilityConfig } from "./useAdminConfig";
import { useToast } from "@/components/Toast";

const CARDS: { key: keyof VisibilityConfig; label: string; page: string }[] = [
  { key: "kpi_conversion",   label: "Conversion Rate %",  page: "דשבורד ראשי" },
  { key: "kpi_ttf",          label: "Time-to-Fill",       page: "דשבורד ראשי" },
  { key: "chart_sources",    label: "מקורות גיוס (גרף)", page: "דשבורד ראשי" },
  { key: "table_recruiters", label: "טבלת מגייסים",       page: "ביצועים" },
];

const MANAGER_PRESET:   VisibilityConfig = { kpi_conversion: true,  kpi_ttf: true,  chart_sources: true,  table_recruiters: false };
const RECRUITER_PRESET: VisibilityConfig = { kpi_conversion: false, kpi_ttf: true,  chart_sources: false, table_recruiters: true  };

export default function VisibilityToggles() {
  const { config, save } = useAdminConfig();
  const { showToast }    = useToast();
  const [vis,      setVis]      = useState<VisibilityConfig>(config.visibility);
  const [isSaving, setIsSaving] = useState(false);

  const toggle      = (key: keyof VisibilityConfig) => setVis(prev => ({ ...prev, [key]: !prev[key] }));
  const applyPreset = (preset: VisibilityConfig)    => setVis(preset);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save({ visibility: vis }, "visibility");
      showToast("הגדרות תצוגה נשמרו ✓", "success");
    } catch {
      showToast("שמירה נכשלה", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const grouped = CARDS.reduce<Record<string, typeof CARDS>>((acc, c) => {
    (acc[c.page] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#002649]">ניהול תצוגת כרטיסים</h3>
        <div className="flex gap-2">
          <button
            onClick={() => applyPreset(MANAGER_PRESET)}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-black border border-blue-100 hover:bg-blue-100 transition-all"
          >
            פרופיל: מנהל
          </button>
          <button
            onClick={() => applyPreset(RECRUITER_PRESET)}
            className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl text-xs font-black border border-purple-100 hover:bg-purple-100 transition-all"
          >
            פרופיל: מגייס
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#002649] text-white rounded-xl font-bold text-sm hover:bg-[#EF6B00] transition-all disabled:opacity-40"
          >
            <Save size={14} /> {isSaving ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>

      {Object.entries(grouped).map(([page, cards]) => (
        <div key={page} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{page}</span>
          </div>
          {cards.map(c => (
            <div
              key={c.key}
              className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center gap-2">
                {vis[c.key]
                  ? <Eye    size={14} className="text-emerald-500" />
                  : <EyeOff size={14} className="text-slate-300" />}
                <span className={`text-sm font-bold transition-colors ${vis[c.key] ? "text-[#002649]" : "text-slate-400"}`}>
                  {c.label}
                </span>
              </div>
              <button
                onClick={() => toggle(c.key)}
                className={`w-10 h-5 rounded-full relative transition-all ${vis[c.key] ? "bg-emerald-500" : "bg-slate-200"}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm transition-all ${vis[c.key] ? "right-[3px]" : "left-[3px]"}`} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
