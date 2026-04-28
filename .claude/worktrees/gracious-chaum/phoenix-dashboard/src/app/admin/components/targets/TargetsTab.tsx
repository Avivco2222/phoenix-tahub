"use client";
import React from "react";
import { Shield, WifiOff, CheckCircle2 } from "lucide-react";
import { useAdminConfig } from "./useAdminConfig";
import FormulaEditor     from "./FormulaEditor";
import RuleBuilder       from "./RuleBuilder";
import VisibilityToggles from "./VisibilityToggles";

export default function TargetsTab() {
  const { isOffline, isLoading, lastSaved } = useAdminConfig();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-[#EF6B00] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Integrity Header ── */}
      <div
        className={`flex items-center justify-between p-3 px-5 rounded-2xl border ${
          isOffline
            ? "bg-orange-50 border-orange-200"
            : "bg-emerald-50 border-emerald-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {isOffline
            ? <WifiOff      size={14} className="text-orange-600" />
            : <CheckCircle2 size={14} className="text-emerald-600" />}
          <span className={`text-xs font-black ${isOffline ? "text-orange-700" : "text-emerald-700"}`}>
            {isOffline
              ? "מצב אופליין — ברירת מחדל פעילה, שינויים לא יישמרו"
              : "מחובר לשרת — כל שמירה מתועדת ב-Audit Log"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
          <Shield size={11} />
          {lastSaved ? `נשמר לאחרונה: ${lastSaved}` : "טרם נשמר בסשן זה"}
        </div>
      </div>

      {/* ── Panels ── */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <FormulaEditor />
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <RuleBuilder />
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <VisibilityToggles />
      </div>
    </div>
  );
}
