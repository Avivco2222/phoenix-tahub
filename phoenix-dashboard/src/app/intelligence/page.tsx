"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { useAccess } from "@/context/AccessContext";
import { AdminConfigProvider, useAdminConfig } from "@/app/admin/components/targets/useAdminConfig";
import { PageHeader } from "@/components/PageHeader";
import { FutureBadge } from "@/components/FutureBadge";
import {
  Brain, AlertTriangle, TrendingDown, Target, Zap,
  HeartHandshake, Users, CheckCircle2, AlertCircle,
  Download, Activity, TrendingUp, Info, Settings,
  X, Save, RotateCcw, Battery, BatteryWarning, Sparkles,
  LayoutGrid, ChevronDown, ChevronUp
} from "lucide-react";
import { RecruiterJobMatrix } from "./components/RecruiterJobMatrix";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, ComposedChart, Line
} from 'recharts';

// --- Live-only defaults ---
const totalHeadcount = 0;
const currentDisabilityCount = 0;
const targetDisabilityCount = 0;
const gaugeData = [
  { name: 'עובדים עם מוגבלות (קיים)', value: 0 },
  { name: 'פער ליעד', value: 0 },
];
const GAUGE_COLORS = ['#EF6B00', '#f1f5f9'];
const currentPct = ((currentDisabilityCount / totalHeadcount) * 100).toFixed(1);
const gapToTarget = targetDisabilityCount - currentDisabilityCount;

const MOCK_INTELLIGENCE_DATA = { baseline: { current_hires: 0, avg_days: 0 }, ghosting_risks: [] };

// QoH (Quality of Hire) Data
const qohData: Array<{ source: string; hires: number; retention1Yr: number; perfScore: number }> = [];

// Attrition Heatmap Data
const heatmapData: Array<{ dept: string; "0-3m": number; "3-6m": number; "6-12m": number; "1-2y": number }> = [];

// Capacity Recruiter Data
const recruitersData: Array<{ name: string; type: string; massJobs: number; proJobs: number; techJobs: number }> = [];

// Sentinel AI Insights (Cross-Correlation)
const aiInsights = ["אין תובנות עדכניות - המתנה לנתוני Live מהשרת."];

interface GhostingRisk {
  candidate: string;
  job: string;
  risk_score: number;
  reason: string;
}

interface IntelligenceData {
  baseline: { current_hires: number; avg_days: number };
  ghosting_risks: GhostingRisk[];
}

interface NeglectJob {
  job_title: string;
  department: string;
  recruiter_name: string;
  team_name: string;
  days_open: number;
  new_candidates_last_14d: number;
  pending_candidates_count: number;
  days_since_last_candidate_action: number;
  neglect_reason: string;
  neglect_score: number;
  severity: "critical" | "high" | "medium";
}

interface NeglectPayload {
  summary: {
    total_neglected_jobs: number;
    critical_jobs: number;
    stale_jobs_5d: number;
    recruiters_impacted: number;
  };
  top_jobs: NeglectJob[];
  recruiter_summary: {
    recruiter_name: string;
    team_name: string;
    neglected_jobs: number;
    critical_jobs: number;
    avg_neglect_score: number;
  }[];
  weekly_trend: { week: string; new_openings: number }[];
}

function IntelligenceAndReportsInner() {
  const { showToast } = useToast();
  const { effectiveUser } = useAccess();
  const { config, save } = useAdminConfig();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const strictLiveData = true;
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [liveDataError, setLiveDataError] = useState<string | null>(null);
  // Audit Phase 3C: dashboard-level metrics (OAR, internal-mobility,
  // attrition, etc.) and intelligence-specific extras (early attrition,
  // recruiter capacity, attrition heatmap) come from the two new
  // backend endpoints introduced in Phase 3A. The legacy /intelligence
  // call above is kept for the funnel + ghosting_risks payload it
  // returns.
  const [metrics, setMetrics] = useState<{
    oar_pct: number; internal_mobility_pct: number;
    hires: number; attrition: number;
    future_blocks: Array<{ key: string; label: string; reason: string }>;
  } | null>(null);
  const [extended, setExtended] = useState<{
    early_attrition_pct: number; early_attrition_count: number;
    attrition_with_tenure_total: number;
    recruiter_capacity: Array<{ name: string; active_apps: number; avg_days: number }>;
    attrition_heatmap: Array<{ dept: string; "0-3m": number; "3-6m": number; "6-12m": number; "1-2y": number }>;
    future_blocks: Array<{ key: string; label: string; reason: string }>;
  } | null>(null);
  const [budgetBoost, setBudgetBoost] = useState(0); 
  const [processSpeed, setProcessSpeed] = useState(0); 
  const [insightIndex, setInsightIndex] = useState(0);
  
  const isAdmin = effectiveUser.role === "admin";

  // --- Sticky Filters State ---
  const defaultFilters = { date: "Q1-2026", dept: "all", recruiter: "all" };
  const [filters, setFilters] = useState(defaultFilters);

  // --- Admin Configuration State ---
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [adminConfig, setAdminConfig] = useState({
    earlyAttritionMonths: 12,
    capacityWeights: { mass: 1, pro: 1.5, tech: 2.5 } as Record<string, number>,
    maxCapacityLimit: 22,
    threshold: 60,
    overrides: { depts: { "Service": 1.1 } as Record<string, number>, recruiters: {} as Record<string, number>, jobs: {} as Record<string, number> }
  });
  const [neglectData, setNeglectData] = useState<NeglectPayload | null>(null);

  const [overrideDept, setOverrideDept] = useState("");
  const [overrideFactor, setOverrideFactor] = useState(1.1);
  const filtersReady = false;

  useEffect(() => {
    const loadIntelligence = async () => {
      try {
        setLiveDataError(null);
        const [intRes, statsRes, metricsRes, extRes] = await Promise.all([
          fetch(`${apiBase}/intelligence`, { cache: "no-store" }),
          fetch(`${apiBase}/stats`, { cache: "no-store" }),
          fetch(`${apiBase}/api/dashboard/metrics`, { cache: "no-store" }),
          fetch(`${apiBase}/api/intelligence/extended`, { cache: "no-store" }),
        ]);
        if (metricsRes.ok) setMetrics(await metricsRes.json());
        if (extRes.ok) setExtended(await extRes.json());
        const intPayload = intRes.ok ? await intRes.json() : null;
        const statsPayload = statsRes.ok ? await statsRes.json() : null;
        if (intPayload && !intPayload.error) {
          setData({
            baseline: {
              current_hires: Number(statsPayload?.hired_this_month ?? intPayload?.baseline?.current_hires ?? 0),
              avg_days: Number(statsPayload?.avg_days ?? intPayload?.baseline?.avg_days ?? 0),
            },
            ghosting_risks: (intPayload.ghosting_risks || []).map((item: Record<string, unknown>) => ({
              candidate: String(item.candidate ?? ""),
              job: String(item.job ?? ""),
              risk_score: Number(item.risk_score ?? 0),
              reason: String(item.reason ?? `ימים בתהליך: ${item.days ?? 0}`),
            })),
          });
          return;
        }
      } catch {
        setLiveDataError("Live intelligence API unavailable");
      }
      setData({ baseline: { current_hires: 0, avg_days: 0 }, ghosting_risks: [] });
    };
    loadIntelligence();
    const aiTimer = setInterval(() => {
      setInsightIndex((prev) => (prev + 1) % aiInsights.length);
    }, 8000); // מחליף תובנת AI כל 8 שניות
    return () => { clearInterval(aiTimer); };
  }, [apiBase, strictLiveData]);

  useEffect(() => {
    const loadNeglect = async () => {
      try {
        const res = await fetch(`${apiBase}/jobs/neglect-alerts?limit=20`, { cache: "no-store" });
        if (res.ok) {
          const payload = await res.json();
          setNeglectData(payload);
        }
      } catch {
        setNeglectData(null);
      }
    };
    loadNeglect();
  }, [apiBase]);

  const hasActiveFilters = filters.date !== defaultFilters.date || filters.dept !== defaultFilters.dept || filters.recruiter !== defaultFilters.recruiter;
  const resetFilters = () => setFilters(defaultFilters);

  const handleExecutiveExport = () => {
    showToast("ייצוא דוח C-Level — בקרוב", "coming-soon");
  };

  const addOverride = () => {
    if (!overrideDept) return;
    setAdminConfig({
        ...adminConfig,
        overrides: {
            ...adminConfig.overrides,
            depts: { ...adminConfig.overrides.depts, [overrideDept]: overrideFactor }
        }
    });
    setOverrideDept("");
    setOverrideFactor(1.1);
  };

  const removeOverride = (dept: string) => {
    const newDepts: Record<string, number> = { ...adminConfig.overrides.depts };
    delete newDepts[dept];
    setAdminConfig({ ...adminConfig, overrides: { ...adminConfig.overrides, depts: newDepts } });
  };

  // Render the page chrome immediately even when `data` is still loading.
  // The previous full-screen loader masked the rest of the UI for 1-2s on every
  // navigation; per design guidance the loading state is now in-place per block.
  const isLoading = !data;
  const baselineHires = data?.baseline?.current_hires ?? 0;
  const baselineDays = data?.baseline?.avg_days ?? 0;
  const ghostingCount = data?.ghosting_risks?.length ?? 0;

  const projectedHires = Math.round(baselineHires * (1 + (budgetBoost / 100)));
  const projectedDays = Math.round(baselineDays * (1 - (processSpeed / 100)));
  // OAR / internal mobility / early attrition now source from the backend
  // — same formulas documented in backend/routers/metrics.py. The
  // previous local calc `hires / (hires + ghosting) * 100` confused
  // ghosting (no response) with rejected offers (different concept).
  const oarValue = metrics?.oar_pct ?? 0;
  const internalMobilityValue = metrics?.internal_mobility_pct ?? 0;
  const earlyAttritionValue = extended?.early_attrition_pct ?? 0;
  // Suppress unused-var warnings — ghosting_risks is still rendered
  // below in the radar block, but we no longer multiplex it into OAR.
  void ghostingCount;

  return (
    <div className="w-full min-h-screen bg-slate-50/30 pb-20 text-right overflow-x-hidden" dir="rtl">
      
      {/* --- STICKY HEADER & COMPACT FILTERS --- */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm space-y-4">
        <div className="max-w-[1600px] mx-auto">
          <PageHeader
            icon={<Brain size={28} strokeWidth={1.75} />}
            title='חמ"ל אינטליגנציה אסטרטגית'
            subtitle="TAHub Command Center · מבט על, תחזיות וביצועי עומק"
            actions={
              <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-red-500 font-bold flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-xl transition-all border border-transparent hover:border-red-100">
                  <RotateCcw size={14} /> נקה סננים
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setShowAdmin(true)} className="p-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:text-[#EF6B00] hover:bg-white transition-all shadow-sm" title="הגדרות אדמין למדדי אינטליגנציה">
                  <Settings size={18} />
              </button>
            )}
            <button onClick={handleExecutiveExport} className="p-2.5 bg-[#002649] text-white rounded-xl hover:bg-[#EF6B00] transition-all shadow-md group relative" title="ייצוא דוח הנהלה (C-Level)">
                <Download size={18} />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EF6B00]"></span>
                </span>
            </button>
              </div>
            }
          />
        </div>

        {/* --- FILTER BAR & AI SENTINEL COMPACT --- */}
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/70 p-2 rounded-2xl border border-slate-100">
          
          {/* Filters (Compact) */}
          <div className="flex items-center gap-2">
            <select disabled={!filtersReady} className="bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold outline-none text-[#002649] shadow-sm hover:border-[#EF6B00]/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" value={filters.date} onChange={(e) => setFilters({...filters, date: e.target.value})}>
              <option value="Q1-2026">רבעון נוכחי (Q1 2026)</option>
              <option value="YTD">מתחילת השנה (YTD)</option>
              <option value="2025">שנה קודמת (2025)</option>
            </select>
            <select disabled={!filtersReady} className="bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold outline-none text-[#002649] shadow-sm hover:border-[#EF6B00]/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" value={filters.dept} onChange={(e) => setFilters({...filters, dept: e.target.value})}>
              <option value="all">כל החטיבות בהפניקס</option>
              <option value="R&D">טכנולוגיה (R&D)</option>
              <option value="Service">שירות ומוקדים</option>
              <option value="Finance">כספים</option>
            </select>
            <select disabled={!filtersReady} className="bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-bold outline-none text-[#002649] shadow-sm hover:border-[#EF6B00]/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" value={filters.recruiter} onChange={(e) => setFilters({...filters, recruiter: e.target.value})}>
              <option value="all">כל המגייסים בצוות</option>
              {recruitersData.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          {!filtersReady && <div className="text-[10px] font-black text-slate-400">סינונים אינטראקטיביים — בקרוב</div>}

          {/* Sentinel AI Ticker */}
          <div className="flex-1 flex items-center gap-2 overflow-hidden px-2 border-r border-slate-200 mr-2 pr-4">
              <div className="bg-blue-100 text-blue-700 p-1.5 rounded-md shrink-0">
                  <Sparkles size={14} className="animate-pulse"/>
              </div>
              <p className="text-xs font-black text-blue-900 truncate animate-in slide-in-from-bottom-2 fade-in duration-500" key={insightIndex}>
                {aiInsights[insightIndex]}
              </p>
          </div>
        </div>
      </div>

      {/* --- MAIN SCROLLABLE CONTENT --- */}
      <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-12">
        {strictLiveData && liveDataError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
            מצב Live קשיח פעיל: מוצגים נתונים חיים בלבד. כרגע השרת לא זמין.
          </div>
        )}

        {/* --- SECTION 1: EXECUTIVE KPIs (Top Level) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            label="זמן איוש ממוצע (TTF)" actual={`${baselineDays} ימים`} target="35 ימים" status={baselineDays > 35 ? "warning" : "success"} trend="—" trendDirection="down"
            tooltipDesc="הזמן הממוצע שעובר מפתיחת תקן המשרה ועד לחתימת חוזה של המועמד הנבחר."
            tooltipFormula="Σ (תאריך חתימה - תאריך פתיחת משרה) / סך הגיוסים"
          />
          <MetricCard 
            label="שיעור קיבול הצעות (OAR)" actual={`${oarValue}%`} target="80%" status={oarValue >= 80 ? "success" : "danger"} trend="—" trendDirection="up"
            tooltipDesc="מדד תחרותיות המציג את אחוז המועמדים שחתמו על חוזה מתוך סך הצעות השכר שהוגשו."
            tooltipFormula="(הצעות שנחתמו / סך הצעות שהוגשו) * 100"
          />
          <MetricCard 
            label="שיעור ניוד פנימי" actual={`${internalMobilityValue}%`} target="15%" status={internalMobilityValue >= 15 ? "success" : "warning"} trend="—" trendDirection="up"
            tooltipDesc="אחוז המשרות שאוישו מתוך מצבת העובדים הקיימת בארגון מתוך סך כל הגיוסים."
            tooltipFormula="(גיוסים פנימיים / סך כל הגיוסים) * 100"
          />
          <MetricCard 
            label="שיעור עזיבה מוקדמת" actual={`${earlyAttritionValue}%`} target="10%" status={earlyAttritionValue <= 10 ? "success" : "danger"} trend="—" trendDirection="down"
            tooltipDesc={`אחוז העובדים שעזבו את הפניקס בטרם השלימו ${adminConfig.earlyAttritionMonths} חודשי העסקה.`}
            tooltipFormula={`(עוזבים בותק < ${adminConfig.earlyAttritionMonths} חודשים) / (סך העוזבים) * 100`}
          />
        </div>

        {/* --- SECTION 2: ATTRITION & RETENTION (HEATMAP) --- */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-red-50 text-red-500 rounded-2xl"><TrendingDown size={24} /></div>
            <div>
              <h3 className="font-black text-2xl text-[#002649] flex items-center gap-2">
                חקר עזיבות: מפת חום (Attrition Heatmap)
                <InfoTooltip 
                  description="זיהוי מוקדי 'דימום' של עובדים בארגון לפי חטיבה וותק. צבעים אדומים מעידים על שיעור נטישה חריג ביחס לממוצע." 
                  formula="אחוז העוזבים בחטיבה לפי קבוצת חודשי ותק מתוך סך העוזבים באותה חטיבה."
                />
              </h3>
              <p className="text-slate-500 font-bold mt-1 text-sm">התפלגות עזיבות לפי ותק בחברה (באחוזים)</p>
            </div>
          </div>
          
          <div className="overflow-x-auto relative">
            {/* Heatmap is computed by joining attrition_events with hires
                on the candidate name; on the current demo DB those two
                tables intentionally don't share people, so the rendered
                grid is empty. The CODE is correct — when production data
                flows in with linked records, the cells populate
                automatically. Until then we surface a FutureBadge so the
                empty grid doesn't look like a bug. */}
            {(!extended || extended.attrition_heatmap.length === 0) && (
              <FutureBadge reason={extended?.future_blocks.find(b => b.key === "heatmap_thresholds")?.reason ?? "אין הצלבה בין attrition_events ל-hires לפי שם בנתוני הדגמה"} />
            )}
            <div className="min-w-[800px]">
              <div className="grid grid-cols-5 gap-2 mb-2 text-center text-xs font-black text-slate-400 uppercase">
                <div className="text-right px-4">חטיבה / יחידה</div>
                <div>0-3 חודשים (קליטה)</div>
                <div>3-6 חודשים (הכשרה)</div>
                <div>6-12 חודשים</div>
                <div>1-2 שנים</div>
              </div>
              <div className="space-y-2">
                {(extended?.attrition_heatmap ?? heatmapData).map((row, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-center">
                    <div className="text-sm font-black text-[#002649] px-4 truncate">{row.dept}</div>
                    <HeatmapCell value={row["0-3m"]} />
                    <HeatmapCell value={row["3-6m"]} />
                    <HeatmapCell value={row["6-12m"]} />
                    <HeatmapCell value={row["1-2y"]} />
                  </div>
                ))}
                {(extended?.attrition_heatmap ?? []).length === 0 && (
                  <div className="text-center text-xs text-slate-400 py-8">
                    אין נתוני עזיבות שמצליבים עם רשומות hires לפי שם בתקופה שנבחרה.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION 3: RECRUITER CAPACITY & LOAD --- */}
        <div className="bg-[#002649] p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900 to-[#002649] z-0 opacity-50 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-white/10 text-white rounded-2xl backdrop-blur-sm"><Battery size={24} /></div>
              <div>
                <h3 className="font-black text-2xl text-white flex items-center gap-2">
                  בריאות הצוות וקיבולת עומס (Capacity Tracker)
                  <InfoTooltip 
                    description="ניטור עומס העבודה על המגייסות למניעת שחיקה וחלוקת משאבים חכמה." 
                    formula={`(מסה x${adminConfig.capacityWeights.mass}) + (מקצועית x${adminConfig.capacityWeights.pro}) + (טכנולוגית x${adminConfig.capacityWeights.tech}). סף: ${adminConfig.maxCapacityLimit}`}
                  />
                </h3>
              </div>
            </div>

            {/* Capacity tracker — the role-type split (Mass / Pro / Tech)
                requires a `role_type` column on jobs that doesn't exist
                yet. Until then we render the real signal that IS
                available: active-application count per recruiter, with
                avg days-in-process as a secondary load indicator. The
                role-type breakdown is surfaced via a FutureBadge so it's
                explicit that the mass/pro/tech card isn't computed yet. */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {(extended?.recruiter_capacity ?? []).map((rec, idx) => {
                // Until the role-type taxonomy lands, the "weighted load
                // score" is just active_apps. Threshold remains the
                // admin-configured maxCapacityLimit.
                const loadScore = rec.active_apps;
                const capacityPct = Math.min((loadScore / adminConfig.maxCapacityLimit) * 100, 100);
                const isOverloaded = loadScore >= adminConfig.maxCapacityLimit;

                return (
                  <div key={idx} className="bg-white rounded-3xl p-6 shadow-lg border-2 border-transparent transition-all hover:border-blue-300 relative">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="font-black text-lg text-[#002649]">{rec.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">תיקים פעילים</div>
                      </div>
                      <div className={`p-2 rounded-xl ${isOverloaded ? 'bg-red-50 text-red-500 animate-pulse' : 'bg-green-50 text-green-500'}`}>
                        {isOverloaded ? <BatteryWarning size={20}/> : <Battery size={20}/>}
                      </div>
                    </div>

                    <div className="space-y-1 mb-5">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span>תיקים פעילים:</span>
                        <span className={isOverloaded ? 'text-red-600' : 'text-[#002649]'}>{loadScore} / {adminConfig.maxCapacityLimit}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${isOverloaded ? 'bg-red-500' : capacityPct > 75 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${capacityPct}%` }} />
                      </div>
                    </div>

                    {/* Role-type breakdown — pinned as future block; once
                        jobs.role_type lands, this section flips on. */}
                    <div className="grid grid-cols-2 gap-2 text-center border-t border-slate-100 pt-4 relative">
                      <FutureBadge label="פירוט עתידי" reason="פירוק לפי mass/pro/tech דורש role_type ב-jobs" position="overlay" />
                      <div className="bg-slate-50 rounded-xl p-2">
                        <div className="text-xs font-black text-[#002649]">{rec.avg_days}</div>
                        <div className="text-[9px] font-bold text-slate-400">ימי תהליך ממוצעים</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2">
                        <div className="text-xs font-black text-slate-400">—</div>
                        <div className="text-[9px] font-bold text-slate-400">סוג עומס</div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {(extended?.recruiter_capacity ?? []).length === 0 && (
                <div className="md:col-span-2 xl:col-span-4 text-center text-sm font-bold text-blue-100 py-8 bg-white/5 rounded-2xl">
                  אין מועמדים פעילים בתקופה שנבחרה — לא ניתן לחשב עומס מגייסות.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-red-50 text-red-500 rounded-2xl"><AlertTriangle size={24} /></div>
            <div>
              <h3 className="font-black text-2xl text-[#002649]">עומק: משרות מוזנחות לפי מגייסת/צוות</h3>
              <p className="text-slate-500 font-bold mt-1 text-sm">פירוק מנהלי למשרות עם SLA גבוה וצבר ללא טיפול.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="text-xs text-slate-500 font-black">סה״כ מוזנחות</div>
              <div className="text-2xl font-black text-red-700">{neglectData?.summary.total_neglected_jobs ?? 0}</div>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <div className="text-xs text-slate-500 font-black">קריטיות</div>
              <div className="text-2xl font-black text-orange-700">{neglectData?.summary.critical_jobs ?? 0}</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <div className="text-xs text-slate-500 font-black">ללא טיפול 5+ ימים</div>
              <div className="text-2xl font-black text-blue-700">{neglectData?.summary.stale_jobs_5d ?? 0}</div>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
              <div className="text-xs text-slate-500 font-black">מגייסות מושפעות</div>
              <div className="text-2xl font-black text-purple-700">{neglectData?.summary.recruiters_impacted ?? 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 min-h-[280px]">
              <h4 className="font-black text-[#002649] mb-4">פיזור עומס הזנחה לפי מגייסת</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={neglectData?.recruiter_summary || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="recruiter_name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Bar dataKey="neglected_jobs" name="משרות מוזנחות" fill="#002649" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="critical_jobs" name="קריטיות" fill="#EF6B00" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 min-h-[280px]">
              <h4 className="font-black text-[#002649] mb-4">מגמת פתיחת משרות בסיכון (8 שבועות)</h4>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={neglectData?.weekly_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="new_openings" name="פתיחות משרה" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="new_openings" name="מגמה" stroke="#EF6B00" strokeWidth={3} dot={{r: 5, fill: '#EF6B00'}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* --- SECTION 4: QoH AND PREDICTIVE --- */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Quality of Hire (QoH) */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
            <h3 className="font-black text-2xl text-[#002649] flex items-center gap-2 mb-2">
              <CheckCircle2 size={24} className="text-green-500"/> איכות גיוס לפי מקור (QoH)
              <InfoTooltip 
                description="בוחן את האפקטיביות האמיתית של מקורות הגיוס, לא רק לפי כמות אלא לפי שרידות העובדים בארגון." 
                formula="(אחוז שרידות מעל שנה + ציון הערכת ביצועים מנורמל) / 2"
              />
            </h3>
            <p className="text-slate-500 font-bold mb-8 text-sm">שרידות מעל שנה (קווים, %) לעומת כמות גיוסים (עמודות)</p>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={qohData} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="source" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 11, fontWeight: 'bold'}} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} domain={[0, 100]} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Bar yAxisId="left" dataKey="hires" name="כמות גיוסים" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={30} />
                  <Line yAxisId="right" type="monotone" dataKey="retention1Yr" name="שרידות (1 שנה+)" stroke="#22c55e" strokeWidth={4} dot={{r: 6, fill: '#22c55e', stroke: '#fff', strokeWidth: 2}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ghosting Radar */}
          <div className="bg-white border-t-4 border-t-red-500 rounded-[2.5rem] p-8 shadow-sm flex flex-col">
            <h3 className="font-black text-2xl text-[#002649] flex items-center gap-2 mb-2">
              <AlertTriangle size={24} className="text-red-500" /> רדאר נטישת מועמדים (Ghosting)
              <InfoTooltip 
                description="אלגוריתם המזהה מועמדים איכותיים בתהליך שנמצאים בסבירות גבוהה לנטישה / קבלת הצעות מתחרים." 
                formula="שקלול: (זמן ללא סטטוס חדש) + (ביקוש השוק לתפקיד) + (התנהגות תקשורת של המועמד)"
              />
            </h3>
            <p className="text-slate-500 font-bold mb-6 text-sm">התראות חיות על טאלנטים בסיכון</p>
            <div className="space-y-4 overflow-y-auto pr-2 flex-1">
              {(data?.ghosting_risks ?? []).map((risk: GhostingRisk, idx: number) => (
                <div key={idx} className="bg-red-50/40 border border-red-100 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="font-black text-red-900 text-base">{risk.candidate}</div>
                    <div className="text-xs font-bold text-red-700">{risk.job}</div>
                    <div className="text-[10px] text-red-500/80 mt-1 flex items-center gap-1"><Info size={12}/> סיבה: {risk.reason}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="bg-red-100 text-red-800 text-lg font-black px-3 py-1 rounded-xl border border-red-200">{risk.risk_score}%</div>
                    <div className="text-[9px] font-black text-red-400 mt-1 uppercase tracking-widest">הסתברות</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- SECTION 5: ESG & SIMULATOR --- */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Diversity Gauge */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm flex flex-col items-center relative">
            <h3 className="font-black text-2xl text-[#002649] flex justify-between w-full border-b border-slate-100 pb-4 mb-6">
              <span className="flex items-center gap-2"><HeartHandshake size={24} className="text-pink-500"/> יעד תעסוקת מוגבלות (ESG)</span>
              <InfoTooltip description="מעקב חי אחר עמידת החברה ביעד החוקי והערכי להעסקת אנשים עם מוגבלות." formula="(מוכרים עם מוגבלות / סך מצבת העובדים) * 100" />
            </h3>
            <div className="relative w-full h-[250px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={gaugeData} cx="50%" cy="80%" startAngle={180} endAngle={0} innerRadius={90} outerRadius={130} paddingAngle={2} dataKey="value" stroke="none">
                    {gaugeData.map((entry, index) => <Cell key={index} fill={GAUGE_COLORS[index]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 pointer-events-none">
                <span className="text-6xl font-black text-[#002649]">{currentPct}%</span>
                <span className="text-sm font-bold text-slate-400 uppercase mt-2">יעד ארגוני: 3.0%</span>
              </div>
            </div>
            <div className="w-full bg-orange-50 rounded-2xl p-5 mt-8 border border-orange-100 flex items-start gap-4">
              <AlertCircle className="text-[#EF6B00] shrink-0 mt-0.5" size={24} />
              <p className="text-base text-orange-900 leading-snug font-medium">חסרים <strong>{gapToTarget} תקנים</strong> להשלמת היעד התעסוקתי מתוך מצבת של {totalHeadcount.toLocaleString()} עובדים.</p>
            </div>
          </div>

          {/* What-If Simulator */}
          <div className="bg-gradient-to-br from-white to-blue-50/50 border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="font-black text-2xl text-[#002649] flex items-center justify-between gap-2 mb-2">
              <span className="flex items-center gap-2"><Zap size={24} className="text-blue-500" /> סימולטור תחזיות (What-If)</span>
              <InfoTooltip description="כלי חיזוי להשפעת משאבים או ייעול תהליכים על ביצועי החודש הבא." formula="קצב גיוס * (1 + תוספת תקציב) | זמן איוש * (1 - קיצור תהליך)" />
            </h3>
            <p className="text-slate-500 font-bold mb-8 text-sm">הזז את המחוונים כדי לראות את השפעת המשאבים על הביצועים.</p>
            
            <div className="space-y-10">
              <div className="space-y-4">
                <div className="flex justify-between font-black text-lg text-[#002649]"><span>תוספת תקציב סורסינג</span><span className="text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">+{budgetBoost}%</span></div>
                <input type="range" min="0" max="100" value={budgetBoost} onChange={(e) => setBudgetBoost(Number(e.target.value))} className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between font-black text-lg text-[#002649]"><span>ייעול וקיצור SLA מנהלים</span><span className="text-green-600 bg-green-50 px-3 py-1 rounded-lg">-{processSpeed}%</span></div>
                <input type="range" min="0" max="50" value={processSpeed} onChange={(e) => setProcessSpeed(Number(e.target.value))} className="w-full accent-green-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
              </div>

              <div className="bg-white border-2 border-blue-100 shadow-xl rounded-3xl p-8 relative overflow-hidden mt-8">
                <div className="absolute top-0 right-0 w-3 h-full bg-blue-500"></div>
                <div className="grid grid-cols-2 gap-8 text-center divide-x divide-x-reverse divide-slate-100">
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">תחזית גיוסים</p>
                    <div className="text-5xl font-black text-[#002649]">{projectedHires}</div>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">תחזית זמן איוש</p>
                    <div className="text-5xl font-black text-[#002649]">{projectedDays} <span className="text-xl">ימים</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- ADMIN MODAL (Settings) --- */}
      {showAdmin && isAdmin && (
        <div className="fixed inset-0 bg-[#002649]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-8 border-b pb-6 border-slate-100">
                <div>
                    <h2 className="text-3xl font-black text-[#002649] flex items-center gap-3"><Settings className="text-[#EF6B00]"/> הגדרות אדמין למדדי אינטליגנציה</h2>
                    <p className="text-slate-500 font-bold mt-2">ניהול הכללים והמשקלים מאחורי הקלעים.</p>
                </div>
                <button onClick={() => setShowAdmin(false)} className="p-3 bg-slate-50 rounded-full hover:bg-slate-200 transition-all"><X size={24}/></button>
            </div>
            
            <div className="space-y-8 text-right">
              <div>
                  <h3 className="font-black text-lg text-[#002649] mb-4">הגדרת "עזיבה מוקדמת"</h3>
                  <p className="text-xs font-bold text-slate-500 mb-2">כמה חודשי ותק ייחשבו ככישלון בקליטה/גיוס לצורך חישוב ה-KPI?</p>
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 w-1/2">
                    <input 
                      type="number" min="1" max="24" 
                      className="w-20 p-3 bg-white border border-slate-300 rounded-xl font-black text-center text-lg focus:ring-2 ring-[#EF6B00]/20 outline-none" 
                      value={adminConfig.earlyAttritionMonths} 
                      onChange={(e) => setAdminConfig({...adminConfig, earlyAttritionMonths: Number(e.target.value)})} 
                    />
                    <span className="font-bold text-slate-700">חודשים מיום הקליטה</span>
                  </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                  <h3 className="font-black text-lg text-[#002649] mb-4">משקלי עומס צוותי (Capacity Tracker)</h3>
                  <p className="text-xs font-bold text-slate-500 mb-4">קבע כמה "נקודות עומס" שווה כל משרה פתוחה.</p>
                  <div className="grid grid-cols-3 gap-6 mb-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <label className="text-xs font-black block mb-2 text-slate-600">משרות מסה</label>
                      <input type="number" step="0.5" className="w-full p-3 border border-slate-300 rounded-xl font-bold" value={adminConfig.capacityWeights.mass} onChange={(e) => setAdminConfig({...adminConfig, capacityWeights: {...adminConfig.capacityWeights, mass: Number(e.target.value)}})} />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <label className="text-xs font-black block mb-2 text-slate-600">משרות מקצועיות</label>
                      <input type="number" step="0.5" className="w-full p-3 border border-slate-300 rounded-xl font-bold" value={adminConfig.capacityWeights.pro} onChange={(e) => setAdminConfig({...adminConfig, capacityWeights: {...adminConfig.capacityWeights, pro: Number(e.target.value)}})} />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <label className="text-xs font-black block mb-2 text-slate-600">משרות הייטק (Tech)</label>
                      <input type="number" step="0.5" className="w-full p-3 border border-slate-300 rounded-xl font-bold" value={adminConfig.capacityWeights.tech} onChange={(e) => setAdminConfig({...adminConfig, capacityWeights: {...adminConfig.capacityWeights, tech: Number(e.target.value)}})} />
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center justify-between w-2/3">
                      <div>
                        <div className="font-black text-red-800">סף שחיקה עליון</div>
                        <div className="text-xs font-bold text-red-600 mt-1">מעל מספר זה, המגייסת תסומן באדום.</div>
                      </div>
                      <input type="number" className="w-24 p-3 bg-white border-2 border-red-200 text-red-600 rounded-xl font-black text-center text-xl" value={adminConfig.maxCapacityLimit} onChange={(e) => setAdminConfig({...adminConfig, maxCapacityLimit: Number(e.target.value)})} />
                  </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                  <h3 className="font-black text-lg text-[#002649] mb-4">החרגות ופקטורים חטיבתיים</h3>
                  <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50 space-y-4">
                      <label className="text-xs font-black text-slate-500 block">הוסף פקטור עומס (למשל: Service, 1.1)</label>
                      <div className="flex gap-2">
                          <input type="text" placeholder="שם חטיבה (למשל: Service)" className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 ring-[#EF6B00]/20 outline-none" value={overrideDept} onChange={(e) => setOverrideDept(e.target.value)} />
                          <input type="number" step="0.1" placeholder="פקטור" className="w-24 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-center focus:ring-2 ring-[#EF6B00]/20 outline-none" value={overrideFactor} onChange={(e) => setOverrideFactor(Number(e.target.value))} />
                          <button onClick={addOverride} className="bg-[#002649] text-white px-5 rounded-xl font-bold text-xs hover:bg-[#EF6B00] transition-colors">הוסף</button>
                      </div>
                      
                      {Object.keys(adminConfig.overrides.depts).length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 mt-4">
                              {Object.entries(adminConfig.overrides.depts).map(([dept, factor]) => (
                                  <div key={dept} className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-black">
                                      <span>{dept}: {factor}x</span>
                                      <button onClick={() => removeOverride(dept)} className="text-blue-500 hover:text-red-500 transition-colors"><X size={14}/></button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

            </div>

            <div className="mt-12 pt-6 border-t border-slate-100">
                <button onClick={() => { void save(({ ...(config as object), intelligenceAlgo: adminConfig } as unknown) as Partial<import("@/app/admin/components/targets/useAdminConfig").AdminConfig>, "visibility"); setShowAdmin(false); }} className="w-full py-5 bg-[#002649] text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-[#EF6B00] transition-all shadow-xl shadow-blue-900/20 text-xl tracking-wide">
                    <Save size={24}/> שמור הגדרות
                </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recruiter × Job Matrix ────────────────────────────────────── */}
      <section className="mt-8 px-6 pb-6">
        <button
          onClick={() => setShowMatrix(s => !s)}
          className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <span className="font-bold text-[#002649] flex items-center gap-2 text-sm">
            <LayoutGrid size={16} className="text-[#EF6B00]" />
            טבלת מגייסים × משרות — Pipeline רוחבי
          </span>
          {showMatrix ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
        </button>
        {showMatrix && <RecruiterJobMatrix />}
      </section>
    </div>
  );
}

export default function IntelligenceAndReports() {
  return (
    <AdminConfigProvider>
      <IntelligenceAndReportsInner />
    </AdminConfigProvider>
  );
}

// --- SUB-COMPONENTS ---

function InfoTooltip({ description, formula }: { description: string, formula: string }) {
  return (
    <div className="group relative inline-flex items-center mr-2 z-50">
      <Info size={16} className="text-slate-300 cursor-help hover:text-[#EF6B00] transition-colors" />
      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-[320px] max-w-[calc(100vw-2rem)] p-4 bg-[#002649] text-white text-right rounded-2xl shadow-2xl border border-blue-800">
        <p className="font-medium text-sm leading-relaxed mb-3">{description}</p>
        <div className="bg-slate-900/50 p-2.5 rounded-xl border border-white/10">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">נוסחת חישוב:</p>
          <p className="text-[#EF6B00] font-mono text-xs text-left" dir="ltr">{formula}</p>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  actual: string | number;
  target: string | number;
  status: "success" | "warning" | "danger";
  trendDirection: "up" | "down";
  trend: string;
  tooltipDesc: string;
  tooltipFormula: string;
}
function MetricCard({ label, actual, target, status, trendDirection, trend, tooltipDesc, tooltipFormula }: MetricCardProps) {
  const statusColors: Record<"success" | "warning" | "danger", string> = { success: "text-green-500", warning: "text-amber-500", danger: "text-red-500" };
  const bgColors: Record<"success" | "warning" | "danger", string> = { success: "bg-green-50 text-green-700", warning: "bg-amber-50 text-amber-700", danger: "bg-red-50 text-red-700" };
  
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-lg hover:border-blue-200 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-2">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</div>
          <InfoTooltip description={tooltipDesc} formula={tooltipFormula} />
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <div className={`text-4xl font-black tracking-tight ${statusColors[status]}`}>{actual}</div>
          <div className="text-sm font-bold text-slate-300">/ {target}</div>
        </div>
      </div>
      <div className={`text-[11px] font-black mt-4 inline-flex items-center gap-1 w-max px-3 py-1.5 rounded-xl ${bgColors[status]}`}>
        {trendDirection === "down" ? <TrendingDown size={14}/> : <TrendingUp size={14}/>}
        {trend} מול רבעון קודם
      </div>
    </div>
  );
}

function HeatmapCell({ value }: { value: number }) {
  let bgColor = "bg-green-50 text-green-700 border-green-100"; 
  if (value > 5 && value <= 10) bgColor = "bg-amber-50 text-amber-700 border-amber-100"; 
  if (value > 10 && value <= 20) bgColor = "bg-orange-100 text-orange-800 border-orange-200"; 
  if (value > 20) bgColor = "bg-red-500 text-white border-red-600 shadow-inner"; 

  return (
    <div className={`p-3 rounded-xl border flex items-center justify-center font-black text-sm transition-transform hover:scale-105 cursor-default ${bgColor}`}>
      {value}%
    </div>
  );
}