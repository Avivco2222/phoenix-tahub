"use client";

import React, { useEffect, useState, useMemo } from "react";
import { 
  Building2, Briefcase, TrendingDown, 
  CheckCircle2, Search, Download, 
  RotateCcw, Info, Sparkles, X, Layers, Target, Scale,
  History, LayoutList
} from "lucide-react";
import { formatDateHe } from "@/lib/dates";
import { PageHeader } from "@/components/PageHeader";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

// --- INTERFACES ---
interface TeamRole {
  name: string;
  role: string;
  standard: number;
  current: number;
  gap: number;
}

interface TrendPoint {
  month: string;
  opens: number;
  hires: number;
}

interface TeamData {
  teams: TeamRole[];
  trend: TrendPoint[];
}

interface OrgUnit {
  unit: string;
  dept: string;
  standard: number;
  current: number;
  open: number;
  attrition: number;
  hires: number;
  sector: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

// --- LEGACY MOCK PLACEHOLDERS ---
// These were inlined fixture arrays for an earlier UI iteration. The new
// implementation populates `rawHeadcountData` from /api/headcount at runtime;
// the placeholders below remain only because charts (yearly trend, sector pie)
// haven't yet been wired to real sources — they render empty when empty.
const YEARLY_TREND_DATA: Array<{ month: string; opens: number; hires: number | null; prevYearHires: number }> = [];
const SECTOR_DISTRIBUTION: Array<{ name: string; value: number; color: string }> = [];
const MONTHLY_GROWTH: Array<{ month: string; growth: number }> = [];
const MOCK_TEAMS_ROLES: Record<string, TeamData> = {};

interface HeadcountApiRow {
  snapshot_month: string;
  department: string;
  role: string;
  standard: number;
  current: number;
  attrition_ytd: number;
  hire_plan: number;
  gap: number;
}

export default function HeadcountDashboard() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const strictLiveData = true;
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<OrgUnit | null>(null);
  const [showPrevYear, setShowPrevYear] = useState(true);
  const [liveOpenJobs, setLiveOpenJobs] = useState<number | null>(null);
  const [liveHires, setLiveHires] = useState<number | null>(null);
  const [liveDataError, setLiveDataError] = useState<string | null>(null);
  const [rawHeadcountData, setRawHeadcountData] = useState<OrgUnit[]>([]);
  const [latestMonth, setLatestMonth] = useState<string | null>(null);

  // חישובים ואלגוריתמים
  const calculateVolatility = (attrition: number, standard: number) => {
    if (!standard || standard <= 0) return 0;
    return Math.round((attrition / standard) * 100);
  };

  const getForecastStatus = (current: number, open: number, standard: number) => {
    const forecast = current + open;
    if (current > standard) return { label: `חריגה (+${current - standard})`, color: "text-red-600 bg-red-50 border-red-200" };
    if (forecast > standard) return { label: `צפי לחריגה (+${forecast - standard})`, color: "text-amber-600 bg-amber-50 border-amber-200 animate-pulse" };
    if (current < standard) return { label: `חוסר (${standard - current})`, color: "text-green-600 bg-green-50 border-green-200" };
    return { label: "תקין", color: "text-slate-500 bg-slate-50 border-slate-200" };
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredData = rawHeadcountData.filter((row) => {
    if (!normalizedSearch) return true;
    return (
      row.unit.toLowerCase().includes(normalizedSearch) ||
      row.dept.toLowerCase().includes(normalizedSearch)
    );
  });

  const escapeCsvValue = (value: string | number) => {
    const text = String(value ?? "");
    return `"${text.replaceAll("\"", "\"\"")}"`;
  };

  const handleDownload = () => {
    const headers = "יחידה,מחלקה,תקן,מצבה,פער,משרות פתוחות,עזיבות,קליטות\n";
    const rows = filteredData.map((row) => [
      escapeCsvValue(row.unit),
      escapeCsvValue(row.dept),
      escapeCsvValue(row.standard),
      escapeCsvValue(row.current),
      escapeCsvValue(row.current - row.standard),
      escapeCsvValue(row.open),
      escapeCsvValue(row.attrition),
      escapeCsvValue(row.hires),
    ].join(",")).join("\n");
    const blob = new Blob(["\ufeff" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Phoenix_Headcount_Report.csv";
    link.click();
  };

  const totals = useMemo(() => ({
    opens: rawHeadcountData.reduce((acc, curr) => acc + curr.open, 0),
    hires: rawHeadcountData.reduce((acc, curr) => acc + curr.hires, 0),
    attrition: rawHeadcountData.reduce((acc, curr) => acc + curr.attrition, 0),
    avgVolatility: rawHeadcountData.length ? Math.round(rawHeadcountData.reduce((acc, curr) => acc + calculateVolatility(curr.attrition, curr.standard), 0) / rawHeadcountData.length) : 0
  }), [rawHeadcountData]);

  useEffect(() => {
    const loadLive = async () => {
      try {
        setLiveDataError(null);
        // Audit Phase 3C: switched the "קליטות" count from /stats
        // (current-month only) to /api/dashboard/metrics.hires_in_period
        // (full period total). The "משרות שנפתחו" tile no longer
        // counts the entire jobs array — it filters to is_active=true
        // so closed jobs don't inflate the number.
        const [metricsRes, jobsRes, hcRes] = await Promise.all([
          fetch(`${apiBase}/api/dashboard/metrics`, { cache: "no-store" }),
          fetch(`${apiBase}/jobs`, { cache: "no-store" }),
          fetch(`${apiBase}/api/headcount`, { cache: "no-store", credentials: "include" }),
        ]);
        if (metricsRes.ok) {
          const m = await metricsRes.json();
          // Use hires_in_period (broader than current-month) for the
          // "סה״כ קליטות" tile so the label honestly matches the value.
          setLiveHires(Number(m?.hires_in_period ?? m?.hires ?? 0));
        }
        if (jobsRes.ok) {
          const jobs = await jobsRes.json();
          // Only count ACTIVE (open) jobs — the previous code counted
          // every row including closed ones, which made the "משרות
          // שנפתחו" tile look much higher than reality.
          const openOnly = Array.isArray(jobs)
            ? jobs.filter((j: { is_active?: boolean; status?: string }) => j.is_active !== false)
            : [];
          setLiveOpenJobs(openOnly.length);
        }
        if (hcRes.ok) {
          const payload = await hcRes.json();
          const months: string[] = payload?.months ?? [];
          const latest = months[0] ?? null;
          setLatestMonth(latest);
          // Filter to the most recent snapshot month so the dashboard shows a
          // coherent point-in-time picture instead of mixing multiple snapshots.
          const rows: HeadcountApiRow[] = Array.isArray(payload?.data) ? payload.data : [];
          const filtered = latest ? rows.filter(r => r.snapshot_month === latest) : rows;
          const mapped: OrgUnit[] = filtered.map(r => ({
            unit: r.role || "—",
            dept: r.department || "—",
            sector: r.department || "—",
            standard: r.standard || 0,
            current: r.current || 0,
            open: r.hire_plan || 0,
            attrition: r.attrition_ytd || 0,
            hires: 0, // future: cross-join /api/hires for the same month
          }));
          setRawHeadcountData(mapped);
        }
      } catch {
        setLiveDataError("Live headcount API unavailable");
        if (strictLiveData) {
          setLiveOpenJobs(0);
          setLiveHires(0);
        }
      }
    };
    loadLive();
  }, [apiBase, strictLiveData]);

  return (
    <div className="w-full min-h-screen bg-slate-50/50 pb-20 text-right overflow-x-hidden" dir="rtl">
      
      {/* --- HEADER (uniform PageHeader) --- */}
      <div className="max-w-[1600px] mx-auto px-8 pt-6">
        <PageHeader
          icon={<Building2 size={28} strokeWidth={1.75} />}
          title="דוח שליטה ארגוני"
          subtitle={`מבט על תקינה, צפי חריגה ותנודות כוח אדם · נכון ל-${formatDateHe(new Date())}`}
          actions={
            <>
              <div className="relative group">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text" placeholder="חפש יחידה..."
                  className="pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none w-56 transition-all focus:bg-white focus:ring-2 ring-[#EF6B00]/10"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button onClick={handleDownload} className="p-2 bg-[#002649] text-white rounded-lg hover:bg-[#EF6B00] transition-all"><Download size={16} /></button>
            </>
          }
        />
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-6 space-y-8">
        {strictLiveData && liveDataError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
            מצב Live קשיח פעיל: נתוני headcount חיים לא זמינים כרגע.
          </div>
        )}
        
        {/* --- LAYER 1: KPI CARDS --- */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* The "AI Sentinel Insight" card used to render a hardcoded
              Hebrew string ("ב-'מוקדי מכירות' חריגה של 5 תקנים") that
              looked like a live recommendation but was never wired to a
              detector. Replaced with a real anomaly indicator: the
              largest standard-vs-current gap across all units (the
              actual signal a recruiter would care about).  */}
          {(() => {
            const worstGap = rawHeadcountData.reduce<{ unit: string; dept: string; gap: number } | null>((acc, r) => {
              const gap = r.standard - r.current;
              if (Math.abs(gap) <= 0) return acc;
              if (!acc || Math.abs(gap) > Math.abs(acc.gap)) return { unit: r.unit, dept: r.dept, gap };
              return acc;
            }, null);
            return (
              <div className="bg-[#002649] rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-center border border-blue-900">
                <Sparkles className="absolute -left-2 -top-2 opacity-10" size={60} />
                <div className="flex items-center gap-2 mb-2 relative z-10">
                  <Sparkles size={14} className="text-[#EF6B00]" />
                  <span className="text-[10px] font-black uppercase text-blue-200">חריגת מצבה — תקן מול בפועל</span>
                </div>
                <p className="text-[11px] font-bold leading-snug relative z-10 text-blue-50">
                  {worstGap
                    ? worstGap.gap > 0
                      ? `חוסר של ${worstGap.gap} עובדים ב-${worstGap.unit} (${worstGap.dept}).`
                      : `עודף של ${Math.abs(worstGap.gap)} עובדים ב-${worstGap.unit} (${worstGap.dept}).`
                    : "אין חריגות מצבה משמעותיות בחתך הנוכחי."}
                </p>
              </div>
            );
          })()}
          <StatCard label="דלת מסתובבת" value={`${totals.avgVolatility}%`} icon={<RotateCcw className="text-orange-500"/>} />
          <StatCard label="עזיבות" value={totals.attrition} icon={<TrendingDown className="text-red-500"/>} />
          {/* Label changed from "קליטות בפועל" (which read as "all-time
              hires" but only showed current-month) to be honest about
              the period covered. */}
          <StatCard label="קליטות בתקופה" value={liveHires ?? totals.hires} icon={<CheckCircle2 className="text-green-500"/>} />
          <StatCard label="משרות פעילות" value={liveOpenJobs ?? totals.opens} icon={<Briefcase className="text-blue-500"/>} />
        </div>

        {/* --- LAYER 2: HEADCOUNT MATRIX --- */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
             <h3 className="font-black text-[#002649] flex items-center gap-2 text-md italic"><Building2 className="text-[#EF6B00]" size={20}/> מטריצת תקינה (יחידות)</h3>
             <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">לחץ על שורה לניתוח צוותים ועיסוקים</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-tighter border-b border-slate-100">
                  <th className="px-6 py-4">יחידה ארגונית</th>
                  <th className="px-6 py-4 text-center">תקן</th>
                  <th className="px-6 py-4 text-center">מצבה</th>
                  <th className="px-6 py-4 text-center">פער</th>
                  <th className="px-6 py-4 text-center">פתוחות</th>
                  <th className="px-6 py-4 text-center">עזיבות</th>
                  <th className="px-6 py-4 text-center">תחזית חריגה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.map((row, idx) => {
                  const forecast = getForecastStatus(row.current, row.open, row.standard);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-all cursor-pointer group" onClick={() => setSelectedUnit(row)}>
                      <td className="px-6 py-4"><div className="font-black text-[#002649] text-sm group-hover:text-[#EF6B00]">{row.unit}</div><div className="text-[9px] font-bold text-slate-400">{row.dept}</div></td>
                      <td className="px-6 py-4 text-center font-black text-slate-600 text-sm">{row.standard}</td>
                      <td className="px-6 py-4 text-center font-black text-[#002649] text-sm">{row.current}</td>
                      <td className="px-6 py-4 text-center">
                        <div className={`px-2.5 py-1 rounded-md font-black inline-block ${row.current < row.standard ? 'text-red-500 bg-red-50' : row.current > row.standard ? 'text-purple-600 bg-purple-50' : 'text-green-600 bg-green-50'}`}>
                            {row.current - row.standard}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-blue-600">{row.open}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-500">{row.attrition}</td>
                      <td className="px-6 py-4 text-center"><span className={`px-3 py-1.5 rounded-full text-[9px] font-black border ${forecast.color}`}>{forecast.label}</span></td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                      לא נמצאו תוצאות עבור החיפוש הנוכחי.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- LAYER 3: ANNUAL TREND (YoY) --- */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-lg text-[#002649] flex items-center gap-2"><Target className="text-blue-500" size={20}/> פתיחה מול קליטה (מבט שנתי)</h3>
            <div className="flex items-center gap-5">
              <button onClick={() => setShowPrevYear(!showPrevYear)} className={`text-[10px] font-black flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${showPrevYear ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-white text-slate-400 border-slate-200'}`}>
                <History size={14}/> {showPrevYear ? 'השוואה ל-2025' : 'הצג השוואה'}
              </button>
              <div className="flex gap-4 text-[9px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-blue-500 rounded-full"/> פתיחות 2026</span>
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-[#EF6B00] rounded-full"/> קליטות 2026</span>
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={YEARLY_TREND_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.08}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorHires" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF6B00" stopOpacity={0.08}/><stop offset="95%" stopColor="#EF6B00" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.08)', fontSize: '11px'}} />
                <Area type="monotone" dataKey="opens" name="פתיחות" stroke="#3b82f6" fill="url(#colorOpens)" strokeWidth={3} />
                <Area type="monotone" dataKey="hires" name="קליטות" stroke="#EF6B00" fill="url(#colorHires)" strokeWidth={3} connectNulls />
                {showPrevYear && <Line type="monotone" dataKey="prevYearHires" name="קליטות 2025" stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={2} dot={false} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* --- LAYER 4: BOTTOM STRATEGIC ROW --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
                <h3 className="font-black text-md text-[#002649] mb-4 flex items-center gap-2"><Scale size={18} className="text-blue-500"/> צמיחה מול קיטון (YTD)</h3>
                <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={MONTHLY_GROWTH}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                            <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.05)', fontSize: '11px'}} />
                            <Bar dataKey="growth" name="מאזן נטו" radius={[4, 4, 0, 0]}>
                                {MONTHLY_GROWTH.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.growth > 0 ? '#22c55e' : '#ef4444'} />))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-8">
                <div className="flex-1">
                    <h3 className="font-black text-md text-[#002649] mb-4 flex items-center gap-2"><Layers size={18} className="text-[#EF6B00]"/> תמהיל גזרות גיוס</h3>
                    <div className="space-y-3">
                        {SECTOR_DISTRIBUTION.map(s => (
                            <div key={s.name} className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: s.color}} /><span>{s.name}</span></div>
                                <span className="font-black text-[#002649]">{s.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="h-[160px] w-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={SECTOR_DISTRIBUTION} innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                            {SECTOR_DISTRIBUTION.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                          </Pie>
                          <RechartsTooltip contentStyle={{fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      </div>

      {/* --- DRILL-DOWN MODAL --- */}
      {selectedUnit && (
        <div className="fixed inset-0 bg-[#002649]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-[#002649] flex items-center gap-3">{selectedUnit.unit} <span className="text-xs font-bold text-slate-400">/ צוותים ועיסוקים</span></h2>
                <div className="flex gap-3 mt-2">
                  <div className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-black">תקן כולל: {selectedUnit.standard}</div>
                  <div className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-black">מצבה נוכחית: {selectedUnit.current}</div>
                </div>
              </div>
              <button onClick={() => setSelectedUnit(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all"><X size={20}/></button>
            </div>
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-[#002649] mb-4">מגמת גיוס יחידתית - 3 חודשים אחרונים</h4>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={MOCK_TEAMS_ROLES[selectedUnit.unit]?.trend || []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                            <RechartsTooltip contentStyle={{fontSize: '10px'}} />
                            <Line type="monotone" dataKey="opens" name="פתיחות" stroke="#3b82f6" strokeWidth={2} dot={{r: 3}} />
                            <Line type="monotone" dataKey="hires" name="קליטות" stroke="#EF6B00" strokeWidth={2} dot={{r: 3}} />
                        </LineChart>
                    </ResponsiveContainer>
                  </div>
              </div>
              {(MOCK_TEAMS_ROLES[selectedUnit.unit]?.teams || []).length === 0 ? (
                <div className="border border-slate-200 rounded-xl p-8 text-center bg-slate-50/60">
                  <div className="font-black text-[#002649]">אין עדיין נתוני צוותים ליחידה זו</div>
                  <div className="text-xs text-slate-500 mt-2">לא מוצגים נתוני fallback מחטיבה אחרת כדי למנוע החלטות שגויות.</div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr className="text-[10px] font-black text-slate-400 uppercase">
                        <th className="px-6 py-3">צוות (רמה 4)</th>
                        <th className="px-6 py-3">עיסוק</th>
                        <th className="px-6 py-3 text-center">תקינה</th>
                        <th className="px-6 py-3 text-center">מצבה</th>
                        <th className="px-6 py-3 text-center">פער</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(MOCK_TEAMS_ROLES[selectedUnit.unit]?.teams || []).map((item: TeamRole, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-6 py-3 font-bold text-slate-700">{item.name}</td>
                          <td className="px-6 py-3 font-black text-[#002649]">{item.role}</td>
                          <td className="px-6 py-3 text-center">{item.standard}</td>
                          <td className="px-6 py-3 text-center">{item.current}</td>
                          <td className="px-6 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded font-black text-[10px] ${item.gap < 0 ? 'bg-red-50 text-red-600' : item.gap > 0 ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'}`}>
                              {item.gap}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---
function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center transition-all hover:shadow-md hover:border-blue-100">
      <div className="flex justify-between items-start mb-2"><div className="p-1.5 bg-slate-50 rounded-lg">{icon}</div></div>
      <div className="text-xl font-black text-[#002649] leading-none">{value}</div>
      <div className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-tight">{label}</div>
    </div>
  );
}