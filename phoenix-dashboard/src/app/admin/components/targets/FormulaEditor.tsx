"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAdminConfig, evalFormula, KpiFormula } from "./useAdminConfig";
import { useToast } from "@/components/Toast";

const VARIABLES = ["hires", "offers", "interviews", "avg_days_open", "applications"];
const OPERATORS: Array<KpiFormula["op"]> = ["/", "*", "+", "-"];
const OP_LABELS: Record<string, string> = { "/": "÷", "*": "×", "+": "+", "-": "−" };

function isValid(f: KpiFormula, metrics: Record<string, number>): boolean {
  if (!f.label.trim()) return false;
  if (!f.varA) return false;
  if (f.op === "/" && f.varB === null) return false;
  if (f.op === "/" && f.varB !== null && (metrics[f.varB] ?? 0) === 0) return false;
  return true;
}

function preview(f: KpiFormula, metrics: Record<string, number>): string {
  if (!isValid(f, metrics)) return "—";
  const result = evalFormula(f, metrics);
  if (result === 0 && f.op === "/") return "⚠ חלוקה באפס";
  return `= ${result.toFixed(1)}${f.scale === 100 ? "%" : ""}`;
}

export default function FormulaEditor() {
  const { config, save, isOffline, loadError } = useAdminConfig();
  const { showToast } = useToast();
  const [formulas, setFormulas] = useState<KpiFormula[]>(config.formulas);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  useEffect(() => { setFormulas(config.formulas); }, [config.formulas]);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats`);
        if (!res.ok) return;
        const stats = await res.json() as Record<string, number>;
        setMetrics({
          hires: Number(stats.hires ?? 0),
          offers: Number(stats.offers ?? 0),
          interviews: Number(stats.interviews ?? 0),
          avg_days_open: Number(stats.avg_days_open ?? 0),
          applications: Number(stats.applications ?? 0),
        });
      } catch {
        setMetrics({});
      }
    })();
  }, []);

  const allValid = useMemo(() => formulas.every((f) => isValid(f, metrics)), [formulas, metrics]);
  const isDirty = useMemo(
    () => JSON.stringify(formulas) !== JSON.stringify(config.formulas),
    [formulas, config.formulas]
  );

  const update = (idx: number, patch: Partial<KpiFormula>) =>
    setFormulas(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));

  const addRow = () =>
    setFormulas(prev => [
      ...prev,
      { id: `kpi_${Date.now()}`, label: "", varA: "hires", op: "/", varB: "offers", scale: 100 },
    ]);

  const removeRow = (idx: number) => {
    if (!globalThis.confirm("למחוק את הנוסחה?")) return;
    setFormulas(prev => prev.filter((_, i) => i !== idx));
    showToast("הנוסחה נמחקה. השינוי יישמר רק לאחר שמירה.", "success");
  };

  const handleSave = async () => {
    if (!allValid || isSaving) return;
    setIsSaving(true);
    try {
      await save({ formulas }, "formulas");
      showToast("פורמולות נשמרו בהצלחה ✓", "success");
    } catch {
      showToast("שמירה נכשלה — נסה שוב", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#002649]">עורך נוסחאות KPI</h3>
        <div className="flex gap-2">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
          >
            <Plus size={14} /> הוסף נוסחה
          </button>
          <button
            onClick={handleSave}
            disabled={!allValid || isSaving || !isDirty}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#002649] text-white rounded-xl font-bold text-sm hover:bg-[#EF6B00] transition-all disabled:opacity-40"
          >
            <Save size={14} /> {isSaving ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>
      {isDirty && <div className="text-[11px] font-black text-amber-600">יש שינויים שלא נשמרו</div>}

      {isOffline && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs font-bold text-orange-700">
          <AlertCircle size={14} /> מצב אופליין — שינויים לא יישמרו עד שהשרת יחזור
        </div>
      )}
      {loadError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
          <AlertCircle size={14} /> {loadError}
        </div>
      )}

      <div className="grid grid-cols-12 gap-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
        <span className="col-span-3">שם מדד</span>
        <span className="col-span-2">משתנה A</span>
        <span className="col-span-1 text-center">פעולה</span>
        <span className="col-span-2">משתנה B</span>
        <span className="col-span-2 text-center">תצוגה מקדימה</span>
        <span className="col-span-2 text-center">סטטוס</span>
      </div>

      <div className="space-y-2">
        {formulas.map((f, idx) => {
          const valid      = isValid(f, metrics);
          const previewStr = preview(f, metrics);
          return (
            <div
              key={f.id}
              className={`grid grid-cols-12 gap-2 items-center p-3 rounded-2xl border transition-all ${
                valid ? "bg-white border-slate-100" : "bg-red-50 border-red-200"
              }`}
            >
              <input
                className="col-span-3 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-[#EF6B00] transition-colors"
                placeholder="שם מדד..."
                value={f.label}
                onChange={e => update(idx, { label: e.target.value })}
              />
              <select
                value={f.varA}
                onChange={e => update(idx, { varA: e.target.value })}
                className="col-span-2 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
              >
                {VARIABLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select
                value={f.op}
                onChange={e => update(idx, { op: e.target.value as KpiFormula["op"] })}
                className="col-span-1 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none text-center"
              >
                {OPERATORS.map(o => <option key={o} value={o}>{OP_LABELS[o]}</option>)}
              </select>
              <select
                value={f.varB ?? ""}
                onChange={e => update(idx, { varB: e.target.value || null })}
                className="col-span-2 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
              >
                <option value="">— ללא —</option>
                {VARIABLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <div
                className={`col-span-2 text-xs font-black text-center ${
                  previewStr.startsWith("⚠") ? "text-red-500" : "text-emerald-600"
                }`}
              >
                {previewStr}
              </div>
              <div className="col-span-2 flex items-center justify-center gap-2">
                {valid
                  ? <CheckCircle2 size={14} className="text-emerald-500" />
                  : <AlertCircle  size={14} className="text-red-500" />}
                <button
                  onClick={() => removeRow(idx)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
