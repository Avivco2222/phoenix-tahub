"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronDown, ChevronUp, RefreshCw, LayoutGrid,
  AlertTriangle, CheckCircle2, Clock, Users,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecruiterJobRow {
  recruiter: string;
  job_id: string;
  job_title: string;
  department: string;
  stages: Record<string, number>;
  stages_funnel: Record<string, number>;
  total_active: number;
  total_all_time: number;
  avg_days: number;
  funnel_rates: {
    screen_to_interview: number;
    interview_to_offer: number;
    offer_to_hired: number;
  };
  health: "ok" | "slow" | "stuck";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = ["SCREEN", "INTERVIEW", "OFFER", "HIRED"] as const;

const STAGE_LABELS: Record<string, string> = {
  SCREEN:    "סינון",
  INTERVIEW: "ראיון",
  OFFER:     "הצעה",
  HIRED:     "גויס",
};

const HEALTH_CONFIG = {
  ok:    { icon: <CheckCircle2 size={13}/>, label: "תקין", bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  slow:  { icon: <Clock size={13}/>,        label: "איטי", bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  stuck: { icon: <AlertTriangle size={13}/>,label: "תקוע", bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200"   },
};

function stageHeat(value: number): string {
  if (value === 0) return "text-slate-300";
  if (value <= 3)  return "text-slate-700";
  if (value <= 7)  return "bg-amber-50 text-amber-700 rounded font-bold";
  return "bg-red-50 text-red-700 rounded font-bold";
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: "ok" | "slow" | "stuck" }) {
  const cfg = HEALTH_CONFIG[health];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

/** Mini funnel bar: shows 4 filled segments proportionally */
function FunnelBar({ row, mode }: { row: RecruiterJobRow; mode: "pipeline" | "funnel" }) {
  const total = mode === "pipeline"
    ? Math.max(row.total_active, 1)
    : Math.max(row.total_all_time, 1);

  const stages = mode === "pipeline" ? row.stages : row.stages_funnel;

  const COLORS = ["bg-blue-400", "bg-purple-400", "bg-orange-400", "bg-green-500"];
  const bars = PIPELINE_STAGES.map((s, i) => ({
    stage: s,
    value: stages[s] ?? 0,
    color: COLORS[i],
    width: Math.round(((stages[s] ?? 0) / total) * 100),
  }));

  return (
    <div className="flex h-2 rounded-full overflow-hidden w-24 gap-px bg-slate-100">
      {bars.map(b => b.value > 0 && (
        <div
          key={b.stage}
          title={`${STAGE_LABELS[b.stage]}: ${b.value}`}
          className={`${b.color} h-full`}
          style={{ width: `${b.width}%` }}
        />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RecruiterJobMatrix() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  const [data, setData] = useState<RecruiterJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"pipeline" | "funnel">("pipeline");
  const [filterRecruiter, setFilterRecruiter] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [expandedRecruiters, setExpandedRecruiters] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ active_only: "true" });
      if (filterRecruiter !== "all") params.set("recruiter", filterRecruiter);
      if (filterDept !== "all")      params.set("dept", filterDept);

      const res = await fetch(`${apiBase}/api/recruiter-job-matrix?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as RecruiterJobRow[];
      setData(json);

      // Auto-expand: open all if ≤4 recruiters, close all otherwise
      const recruiters = [...new Set(json.map(r => r.recruiter))];
      if (recruiters.length <= 4) {
        setExpandedRecruiters(new Set(recruiters));
      } else {
        setExpandedRecruiters(new Set());
      }
    } catch (e) {
      setError("שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, [filterRecruiter, filterDept]);

  // Unique values for filter dropdowns
  const allRecruiters = useMemo(() => [...new Set(data.map(r => r.recruiter))].sort(), [data]);
  const allDepts      = useMemo(() => [...new Set(data.map(r => r.department).filter(Boolean))].sort(), [data]);

  // Group rows by recruiter
  const grouped = useMemo(() => {
    const map = new Map<string, RecruiterJobRow[]>();
    for (const row of data) {
      const arr = map.get(row.recruiter) ?? [];
      arr.push(row);
      map.set(row.recruiter, arr);
    }
    return map;
  }, [data]);

  const toggleRecruiter = (name: string) => {
    setExpandedRecruiters(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-3">
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-[#EF6B00]" />
          <span className="text-sm font-bold text-[#002649]">מגייסים × משרות</span>
          {data.length > 0 && (
            <span className="text-[10px] bg-[#EF6B00]/10 text-[#EF6B00] px-2 py-0.5 rounded-full font-bold">
              {data.length} רשומות
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-bold">
            <button
              onClick={() => setMode("pipeline")}
              className={`px-3 py-1.5 transition-colors ${mode === "pipeline" ? "bg-[#002649] text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setMode("funnel")}
              className={`px-3 py-1.5 transition-colors ${mode === "funnel" ? "bg-[#002649] text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              Funnel %
            </button>
          </div>

          {/* Recruiter filter */}
          {allRecruiters.length > 1 && (
            <select
              value={filterRecruiter}
              onChange={e => setFilterRecruiter(e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 font-medium"
            >
              <option value="all">כל המגייסים</option>
              {allRecruiters.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}

          {/* Dept filter */}
          {allDepts.length > 1 && (
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 font-medium"
            >
              <option value="all">כל המחלקות</option>
              {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          <button
            onClick={() => void fetchData()}
            title="רענן"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-[#002649] hover:bg-slate-100 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="p-10 text-center text-slate-400 text-xs">
          <RefreshCw size={22} className="mx-auto mb-2 animate-spin text-slate-300" />
          טוען נתוני pipeline…
        </div>
      )}
      {!loading && error && (
        <div className="p-10 text-center text-red-500 text-xs font-medium">{error}</div>
      )}
      {!loading && !error && data.length === 0 && (
        <div className="p-10 text-center text-slate-400 text-xs">
          <Users size={28} className="mx-auto mb-2 text-slate-300" />
          אין נתוני pipeline — יש להעלות קובץ CSV עם שדה stage_code
        </div>
      )}

      {/* Table */}
      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" dir="rtl">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-black uppercase tracking-wider">
                <th className="text-right px-4 py-2 w-64">מגייס / משרה</th>
                {mode === "pipeline" ? (
                  <>
                    {PIPELINE_STAGES.map(s => (
                      <th key={s} className="text-center px-3 py-2 w-16">{STAGE_LABELS[s]}</th>
                    ))}
                    <th className="text-center px-3 py-2 w-16">סה"כ</th>
                    <th className="text-center px-3 py-2 w-20">ממוצע ימים</th>
                  </>
                ) : (
                  <>
                    <th className="text-center px-3 py-2 w-24">סינון→ראיון</th>
                    <th className="text-center px-3 py-2 w-24">ראיון→הצעה</th>
                    <th className="text-center px-3 py-2 w-24">הצעה→גויס</th>
                    <th className="text-center px-3 py-2 w-20">כניסות</th>
                  </>
                )}
                <th className="text-center px-3 py-2 w-24">פאנל</th>
                <th className="text-center px-3 py-2 w-20">בריאות</th>
              </tr>
            </thead>
            <tbody>
              {[...grouped.entries()].map(([recruiterName, rows]) => {
                const isExpanded = expandedRecruiters.has(recruiterName);
                const totalActive = rows.reduce((s, r) => s + r.total_active, 0);
                const avgDays = rows.length > 0
                  ? Math.round(rows.reduce((s, r) => s + r.avg_days, 0) / rows.length)
                  : 0;
                const worstHealth = rows.some(r => r.health === "stuck") ? "stuck"
                  : rows.some(r => r.health === "slow") ? "slow" : "ok";

                return (
                  <React.Fragment key={recruiterName}>
                    {/* Recruiter group header */}
                    <tr
                      className="bg-slate-50/80 border-b border-slate-100 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                      onClick={() => toggleRecruiter(recruiterName)}
                    >
                      <td className="px-4 py-2.5 font-bold text-[#002649] flex items-center gap-2">
                        {isExpanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                        <span>{recruiterName}</span>
                        <span className="text-[9px] text-slate-400 font-normal">{rows.length} משרות</span>
                      </td>
                      {mode === "pipeline" ? (
                        <>
                          {PIPELINE_STAGES.map(s => (
                            <td key={s} className="text-center px-3 py-2 text-slate-500 font-medium">
                              {rows.reduce((sum, r) => sum + (r.stages[s] ?? 0), 0) || "—"}
                            </td>
                          ))}
                          <td className="text-center px-3 py-2 font-bold text-slate-700">{totalActive}</td>
                          <td className="text-center px-3 py-2 text-slate-500">{avgDays}y</td>
                        </>
                      ) : (
                        <>
                          <td className="text-center px-3 py-2 text-slate-400" colSpan={3}>—</td>
                          <td className="text-center px-3 py-2 font-bold text-slate-700">
                            {rows.reduce((s, r) => s + r.total_all_time, 0)}
                          </td>
                        </>
                      )}
                      <td className="text-center px-3 py-2" />
                      <td className="text-center px-3 py-2">
                        <HealthBadge health={worstHealth} />
                      </td>
                    </tr>

                    {/* Job rows */}
                    {isExpanded && rows.map(row => (
                      <tr
                        key={row.job_id || row.job_title}
                        className="border-b border-slate-50 hover:bg-orange-50/30 transition-colors"
                      >
                        <td className="px-4 py-2 text-slate-600 pr-10">
                          <div className="font-medium">{row.job_title}</div>
                          {row.department && (
                            <div className="text-[9px] text-slate-400">{row.department}</div>
                          )}
                        </td>

                        {mode === "pipeline" ? (
                          <>
                            {PIPELINE_STAGES.map(s => {
                              const val = row.stages[s] ?? 0;
                              return (
                                <td key={s} className="text-center px-3 py-2">
                                  <span className={`px-1.5 py-0.5 text-[11px] ${stageHeat(val)}`}>
                                    {val > 0 ? val : "—"}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="text-center px-3 py-2 font-bold text-slate-700">{row.total_active}</td>
                            <td className={`text-center px-3 py-2 font-medium ${row.avg_days > 45 ? "text-red-600" : row.avg_days > 30 ? "text-amber-600" : "text-slate-600"}`}>
                              {row.avg_days}y
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="text-center px-3 py-2 font-medium text-slate-700">
                              {pct(row.funnel_rates.screen_to_interview)}
                            </td>
                            <td className="text-center px-3 py-2 font-medium text-slate-700">
                              {pct(row.funnel_rates.interview_to_offer)}
                            </td>
                            <td className="text-center px-3 py-2 font-medium text-slate-700">
                              {pct(row.funnel_rates.offer_to_hired)}
                            </td>
                            <td className="text-center px-3 py-2 text-slate-500">
                              {row.total_all_time}
                            </td>
                          </>
                        )}

                        <td className="text-center px-3 py-2">
                          <div className="flex justify-center">
                            <FunnelBar row={row} mode={mode} />
                          </div>
                        </td>
                        <td className="text-center px-3 py-2">
                          <HealthBadge health={row.health} />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {!loading && data.length > 0 && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 text-[9px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-100 inline-block"/> עמוד ≥8 מועמדים</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-100 inline-block"/> עמוד 4–7 מועמדים</span>
          <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-green-600"/> תקין — ממוצע ≤30 ימים</span>
          <span className="flex items-center gap-1"><Clock size={10} className="text-amber-600"/> איטי — ממוצע 30–45 ימים</span>
          <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-red-600"/> תקוע — ≥5 בסינון ללא התקדמות / ≥45 ימים</span>
        </div>
      )}
    </div>
  );
}
