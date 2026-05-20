"use client";

/**
 * HeadcountForecaster — basic linear projection.
 *
 * Reads /api/headcount across all snapshots, computes monthly growth/attrition
 * per department from history, and projects standard/current forward 6 months
 * using linear regression. Cost projection is shown when avg_salary is known
 * (from /api/hires). Production should layer in seasonality + confidence bands
 * — flagged as Coming Soon.
 */

import React, { useEffect, useMemo, useState } from "react";
import { TrendingUp, Calendar, DollarSign, Construction, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

interface HeadcountRow {
  snapshot_month: string;
  department: string;
  role: string;
  standard: number;
  current: number;
  attrition_ytd: number;
  hire_plan: number;
}

interface DeptSummary {
  department: string;
  currentTotal: number;
  standardTotal: number;
  monthlyGrowth: number;       // hires - attrition per month (simple avg)
  forecast: { month: string; projected: number }[];
}

const addMonths = (yyyymm: string, n: number): string => {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function HeadcountForecaster() {
  const [rows, setRows] = useState<HeadcountRow[]>([]);
  const [avgSalary, setAvgSalary] = useState<number>(28000);
  const [horizon, setHorizon] = useState<number>(6);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const [hcRes, hiresRes] = await Promise.all([
        fetch(`${apiBase}/api/headcount`, { credentials: "include" }),
        fetch(`${apiBase}/api/hires`, { credentials: "include" }),
      ]);
      if (hcRes.ok) {
        const payload = await hcRes.json();
        setRows(Array.isArray(payload?.data) ? payload.data : []);
      }
      if (hiresRes.ok) {
        const payload = await hiresRes.json();
        const avg = payload?.summary?.avg_salary;
        if (avg) setAvgSalary(Number(avg));
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const deptSummaries = useMemo<DeptSummary[]>(() => {
    if (rows.length === 0) return [];

    // Group by month -> dept -> sum
    const byMonth: Record<string, Record<string, { current: number; standard: number; hires: number; attrition: number }>> = {};
    for (const r of rows) {
      const m = r.snapshot_month;
      byMonth[m] = byMonth[m] || {};
      const d = byMonth[m][r.department] || { current: 0, standard: 0, hires: 0, attrition: 0 };
      d.current += r.current;
      d.standard += r.standard;
      d.hires += r.hire_plan;
      d.attrition += r.attrition_ytd;
      byMonth[m][r.department] = d;
    }

    const sortedMonths = Object.keys(byMonth).sort();
    if (sortedMonths.length === 0) return [];
    const latestMonth = sortedMonths[sortedMonths.length - 1];

    // For each dept, compute linear trend from history (or fall back to hire_plan)
    const depts = new Set(rows.map(r => r.department));
    const summaries: DeptSummary[] = [];
    for (const dept of depts) {
      const series = sortedMonths
        .map(m => byMonth[m][dept])
        .filter(Boolean);
      if (series.length === 0) continue;
      const latest = byMonth[latestMonth][dept];

      // Simple monthly growth = (current_latest - current_first) / months  OR  hire_plan if no history
      let monthlyGrowth = 0;
      if (series.length >= 2) {
        monthlyGrowth = (series[series.length - 1].current - series[0].current) / (series.length - 1);
      } else {
        monthlyGrowth = (latest.hires - latest.attrition) / 12;
      }

      const forecast: { month: string; projected: number }[] = [];
      let projected = latest.current;
      for (let i = 1; i <= horizon; i++) {
        projected += monthlyGrowth;
        forecast.push({ month: addMonths(latestMonth, i), projected: Math.round(projected) });
      }

      summaries.push({
        department: dept,
        currentTotal: latest.current,
        standardTotal: latest.standard,
        monthlyGrowth,
        forecast,
      });
    }
    summaries.sort((a, b) => b.currentTotal - a.currentTotal);
    return summaries;
  }, [rows, horizon]);

  const grandTotal = useMemo(() => {
    const last = deptSummaries.reduce((a, d) => a + d.currentTotal, 0);
    const proj = deptSummaries.reduce((a, d) => a + (d.forecast[horizon - 1]?.projected ?? d.currentTotal), 0);
    const monthlyCost = proj * avgSalary;
    return { last, proj, gap: proj - last, monthlyCost };
  }, [deptSummaries, horizon, avgSalary]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <TrendingUp size={24}/>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#002649]">תחזית מצבה</h3>
            <p className="text-sm text-slate-500">מבוסס על snapshots היסטוריים מ-/api/headcount.</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-[#002649]">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""}/> רענן
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <label className="text-xs font-bold text-slate-500 block mb-1">אופק תחזית (חודשים)</label>
          <input type="number" min={1} max={24} value={horizon} onChange={e => setHorizon(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 6)))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-[#002649]"/>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <label className="text-xs font-bold text-slate-500 block mb-1">שכר חודשי ממוצע (ש&quot;ח)</label>
          <input type="number" value={avgSalary} onChange={e => setAvgSalary(parseInt(e.target.value, 10) || 0)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-[#002649]"/>
        </div>
        <div className="bg-gradient-to-br from-violet-100 to-blue-100 rounded-xl p-3">
          <div className="text-xs font-bold text-violet-700">תחזית מצבה ב-{horizon} חודשים</div>
          <div className="text-2xl font-black text-violet-900 mt-1">{grandTotal.proj.toLocaleString()}</div>
          <div className="text-[10px] text-violet-600 mt-1">
            {grandTotal.gap >= 0 ? `+${grandTotal.gap}` : grandTotal.gap} ביחס להיום ({grandTotal.last})
          </div>
        </div>
      </div>

      {grandTotal.proj > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign size={20} className="text-emerald-600"/>
            <div>
              <div className="font-bold text-sm text-emerald-900">עלות שכר חודשית צפויה ב-{horizon} חודשים</div>
              <div className="text-2xl font-black text-emerald-700">
                {(grandTotal.monthlyCost / 1000000).toFixed(2)}M ש&quot;ח
              </div>
            </div>
          </div>
          <div className="text-[10px] text-emerald-700 text-end">
            הערכה גסה<br/>= מצבה צפויה × שכר ממוצע
          </div>
        </div>
      )}

      {loading && deptSummaries.length === 0 && (
        <div className="text-center text-slate-400 py-8">טוען...</div>
      )}

      {!loading && deptSummaries.length === 0 && (
        <div className="text-center text-slate-400 py-8">
          אין נתוני headcount. העלה/י קובץ ב-/admin → דאטה → קליטה.
        </div>
      )}

      {deptSummaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="text-right p-3">חטיבה</th>
                <th className="text-center p-3">היום</th>
                <th className="text-center p-3">תקן</th>
                <th className="text-center p-3">צמיחה חודשית</th>
                <th className="text-center p-3">תחזית ב-{horizon} חודשים</th>
                <th className="text-center p-3">פער מתקן</th>
              </tr>
            </thead>
            <tbody>
              {deptSummaries.map(d => {
                const projected = d.forecast[horizon - 1]?.projected ?? d.currentTotal;
                const gapFromStd = projected - d.standardTotal;
                return (
                  <tr key={d.department} className="border-t border-slate-100">
                    <td className="p-3 font-bold text-[#002649]">{d.department}</td>
                    <td className="text-center p-3">{d.currentTotal}</td>
                    <td className="text-center p-3 text-slate-500">{d.standardTotal}</td>
                    <td className="text-center p-3">
                      <span className={d.monthlyGrowth >= 0 ? "text-emerald-600" : "text-rose-600"}>
                        {d.monthlyGrowth >= 0 ? "+" : ""}{d.monthlyGrowth.toFixed(1)}
                      </span>
                    </td>
                    <td className="text-center p-3 font-black text-violet-700">{projected}</td>
                    <td className="text-center p-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        gapFromStd === 0 ? "bg-slate-100 text-slate-600" :
                        gapFromStd > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {gapFromStd > 0 ? `+${gapFromStd} מעל` : gapFromStd === 0 ? "מאוזן" : `${gapFromStd}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Construction size={20} className="text-amber-600 flex-shrink-0 mt-0.5"/>
        <div>
          <div className="font-bold text-sm text-amber-900 mb-1">בקרוב — מודלים מתקדמים</div>
          <div className="text-xs text-amber-800">
            הגרסה הנוכחית משתמשת ב-linear regression פשוט. בקרוב: עונתיות (Q4 גיוסים, Q3 עזיבות), confidence intervals, ותרחישי What-If (&quot;מה אם נקלוט 5 ב-R&amp;D ביוני?&quot;).
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2"><Calendar size={12} className="text-slate-400"/>
        <div className="text-[10px] text-slate-400">מבוסס על snapshot חודשי. דייק יותר כשעולים נתוני 6+ חודשים.</div>
      </div>
    </div>
  );
}
