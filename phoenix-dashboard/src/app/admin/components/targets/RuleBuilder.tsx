"use client";
import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Save, Zap } from "lucide-react";
import { useAdminConfig, AutomationRule } from "./useAdminConfig";
import { useToast } from "@/components/Toast";

const METRICS    = ["interviews_per_week", "avg_days_open", "hires", "offers", "applications"];
const OPS: Array<AutomationRule["op"]> = ["<", ">", "="];
const ACTIONS: { value: AutomationRule["action"]; label: string }[] = [
  { value: "toast",  label: "התראת Toast" },
  { value: "email",  label: "מייל (סימולציה)" },
  { value: "flag",   label: "סמן מנהל" },
];

const LIVE_METRICS: Record<string, number> = {
  interviews_per_week: 5, avg_days_open: 23, hires: 12, offers: 35, applications: 210,
};

export default function RuleBuilder() {
  const { config, save } = useAdminConfig();
  const { showToast }    = useToast();
  const [rules,    setRules]    = useState<AutomationRule[]>(config.rules);
  const [isSaving, setIsSaving] = useState(false);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    rules.forEach(rule => {
      if (!rule.enabled || firedRef.current.has(rule.id)) return;
      const val = LIVE_METRICS[rule.metric] ?? 0;
      const triggered =
        rule.op === "<" ? val < rule.threshold :
        rule.op === ">" ? val > rule.threshold :
        val === rule.threshold;
      if (triggered) {
        firedRef.current.add(rule.id);
        showToast(`⚡ כלל הופעל: ${rule.actionLabel}`, "error");
      }
    });
  }, [rules, showToast]);

  const update = (idx: number, patch: Partial<AutomationRule>) =>
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const addRule = () =>
    setRules(prev => [...prev, {
      id: `r_${Date.now()}`, metric: "interviews_per_week", op: "<", threshold: 7,
      action: "toast", actionLabel: "כלל חדש", enabled: true,
    }]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save({ rules }, "rules");
      showToast("כללי אוטומציה נשמרו ✓", "success");
    } catch {
      showToast("שמירה נכשלה", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#002649] flex items-center gap-2">
          <Zap size={18} className="text-[#EF6B00]" /> בונה אוטומציות (If / Then)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={addRule}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
          >
            <Plus size={14} /> כלל חדש
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

      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <div key={rule.id} className="p-4 bg-white border border-slate-100 rounded-2xl space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black text-[#EF6B00] uppercase tracking-widest w-6">IF</span>
              <select
                value={rule.metric}
                onChange={e => update(idx, { metric: e.target.value })}
                className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
              >
                {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={rule.op}
                onChange={e => update(idx, { op: e.target.value as AutomationRule["op"] })}
                className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none w-14 text-center"
              >
                {OPS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input
                type="number"
                value={rule.threshold}
                onChange={e => update(idx, { threshold: Number(e.target.value) })}
                className="w-16 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none text-center"
              />
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                (() => {
                  const v = LIVE_METRICS[rule.metric] ?? 0;
                  const fired =
                    rule.op === "<" ? v < rule.threshold :
                    rule.op === ">" ? v > rule.threshold :
                    v === rule.threshold;
                  return fired ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700";
                })()
              }`}>
                {LIVE_METRICS[rule.metric] ?? "—"}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black text-[#002649] uppercase tracking-widest w-6">THEN</span>
              <div className="flex gap-1.5">
                {ACTIONS.map(a => (
                  <button
                    key={a.value}
                    onClick={() => update(idx, { action: a.value })}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                      rule.action === a.value
                        ? "bg-[#002649] text-white border-[#002649]"
                        : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <input
                value={rule.actionLabel}
                onChange={e => update(idx, { actionLabel: e.target.value })}
                className="flex-1 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none min-w-0"
                placeholder="תיאור ההתראה..."
              />
              <button
                onClick={() => update(idx, { enabled: !rule.enabled })}
                className={`w-10 h-5 rounded-full relative transition-all shrink-0 ${rule.enabled ? "bg-[#EF6B00]" : "bg-slate-300"}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm transition-all ${rule.enabled ? "right-[3px]" : "left-[3px]"}`} />
              </button>
              <button
                onClick={() => setRules(prev => prev.filter((_, i) => i !== idx))}
                className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
