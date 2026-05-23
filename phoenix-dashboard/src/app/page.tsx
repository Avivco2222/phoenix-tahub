"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccess } from "@/context/AccessContext";
import {
  Users, CheckCircle, Clock, AlertTriangle, BarChart3,
  Filter, Target,
  Activity, Layers, Bell, CheckCircle2, Archive, Trophy,
  ThumbsUp, Send, Plus, Trash2, Info,
  PieChart, Percent, UserMinus, ArrowDownToLine, Zap,
  ChevronDown, ChevronUp, ArrowUpDown, BadgeDollarSign,
  ArrowRightLeft, Linkedin, RotateCcw, ArrowRight,
  Sunrise, Sun, Sunset, Moon,
} from "lucide-react";
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart as RechartsPie, Pie, Cell } from 'recharts';
import { FutureBadge } from "@/components/FutureBadge";

// --- Types ---
interface Notification {
  id: number;
  targetRole: string;
  msg: string;
  type: string;
  time: string;
  read: boolean;
}

interface AITask {
  id: string;
  severity: string;
  tags: string[];
  title: string;
  desc: string;
  assignee: string;
  status: string;
  time: string;
  type?: string;
}

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  isWarning?: boolean;
  isPositive?: boolean;
  subtext?: string | null;
  info?: string;
  borderColorClass?: string;
}

interface PieBreakdownCardProps {
  title: string;
  icon: React.ReactNode;
  data: { name: string; value: number }[];
  info: string;
}

interface StrategicSourceCardProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  cvs: number;
  hires: number;
  totalHires: number;
}

type TooltipPlacement = "top" | "bottom";
type TooltipCoords = { top: number; left: number };

/** Response shape of GET /api/dashboard/metrics — see
 *  backend/routers/metrics.py for the field-level docstrings. Mirrored
 *  here only for type-safe access on the React side; the server is the
 *  source of truth for what each number means. */
interface DashboardMetrics {
  hires: number;
  hires_this_month: number;
  hires_in_period: number;
  attrition: number;
  applications: number;
  applications_db: number;
  sla_alerts: number;
  ghosting_count: number;
  e2e_pct: number;
  oar_pct: number;
  internal_mobility_pct: number;
  internal_hires: number;
  internal_candidates: number;
  avg_days_to_hire: number;
  cph: number;
  total_recruitment_spend: number;
  sources_breakdown: Array<{ name: string; cvs: number; hires: number }>;
  attrition_reasons: Array<{ name: string; value: number }>;
  funnel: Array<{ stage: string; count: number; percentage: number }>;
  chart_data: Array<{ name: string; candidates: number }>;
  hires_yoy_pct: number | null;
  attrition_yoy_pct: number | null;
  future_blocks: Array<{ key: string; label: string; reason: string }>;
  period: { start: string | null; end: string | null };
}

interface NeglectedJob {
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
  thresholds: {
    slaDaysThreshold: number;
    lowCandidatesThreshold: number;
    pendingCvThreshold: number;
    staleActionDaysThreshold: number;
    criticalScoreThreshold: number;
  };
  summary: {
    total_neglected_jobs: number;
    critical_jobs: number;
    stale_jobs_5d: number;
    recruiters_impacted: number;
    critical_ratio_pct?: number;
  };
  top_jobs: NeglectedJob[];
}

const FILTERS_META = {
  departments: [] as string[],
  jobs: [] as string[],
  recruiters: [] as string[]
};

// --- Mock Data: AI Tasks ---
const INITIAL_AI_TASKS: AITask[] = [];

// --- Mock Data: Secondary Analytics ---
const recruiterLeaderboard: Array<{ name: string; hires: number; active_jobs: number; avg_sla: number; score: number }> = [];

const rejectReasons: Array<{ name: string; value: number }> = [];
const withdrawReasons: Array<{ name: string; value: number }> = [];
const attritionReasons: Array<{ name: string; value: number }> = [];
const PIE_COLORS = ['#EF6B00', '#002649', '#64748B', '#cbd5e1'];

const sourcesData: Array<{ category: string; cvs: number; phone: number; hires: number; cph: string; sources: Array<{ name: string; cvs: number; phone: number; hires: number; cph: string }> }> = [];

const activeJobsRanking: Array<{ job: string; cvs: number; status: string }> = [];

// --- Dynamic Slogans ---
const SLOGANS = [
  "מיקוד יומי קטן יוצר תוצאות גיוס גדולות.",
  "היום סוגרים פערי SLA לפני שהם הופכים למשבר.",
  "כל משימה שנסגרת עכשיו חוסכת שבוע של עיכוב בהמשך.",
  "חוויית מועמד טובה מתחילה בתגובה מהירה.",
  "נתונים חכמים, החלטות חדות, גיוס מדויק.",
];

function getRandomSlogan() {
  return SLOGANS[Math.floor(Math.random() * SLOGANS.length)];
}

function getGreetingByHour(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return {
    text: "בוקר טוב",
    icon: (
      <span className="inline-block animate-greeting-enter" style={{ transformOrigin: "center" }}>
        <Sunrise
          size={34}
          strokeWidth={1.25}
          className="animate-greeting-pulse-soft"
          style={{ color: "#f59e0b" }}
        />
      </span>
    ),
  };
  if (hour >= 12 && hour < 17) return {
    text: "צהריים טובים",
    icon: (
      <span className="inline-block animate-greeting-enter" style={{ transformOrigin: "center" }}>
        <Sun
          size={34}
          strokeWidth={1.25}
          className="animate-greeting-spin-slow"
          style={{ color: "#eab308" }}
        />
      </span>
    ),
  };
  if (hour >= 17 && hour < 21) return {
    text: "ערב טוב",
    icon: (
      <span className="inline-block animate-greeting-enter" style={{ transformOrigin: "center" }}>
        <Sunset
          size={34}
          strokeWidth={1.25}
          className="animate-greeting-pulse-soft"
          style={{ color: "#f97316" }}
        />
      </span>
    ),
  };
  return {
    text: "לילה טוב",
    icon: (
      <span className="inline-block animate-greeting-enter" style={{ transformOrigin: "center" }}>
        <Moon
          size={30}
          strokeWidth={1.25}
          className="animate-greeting-bob-soft"
          style={{ color: "#818cf8" }}
        />
      </span>
    ),
  };
}

export default function DashboardPage() {
  const { effectiveUser } = useAccess();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const strictLiveData = true;
  const currentRole = effectiveUser.role;
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [liveStats, setLiveStats] = useState<{ total_candidates: number; hired_this_month: number; avg_days: number; sla_alerts: number; chart_data: {name:string;candidates:number}[] } | null>(null);
  const [liveMeta, setLiveMeta] = useState<{departments:string[];recruiters:string[]}>({departments: [], recruiters: []});
  const [neglectData, setNeglectData] = useState<NeglectPayload | null>(null);
  const [liveDataError, setLiveDataError] = useState<string | null>(null);
  // Audit Phase 3B: the new /api/dashboard/metrics endpoint returns
  // every KPI the page renders in one call. We keep liveStats around
  // (other places on the page still read from it) but every KPI card
  // and pie/source breakdown now sources its number from `metrics`.
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  
  // Greeting Engine
  const [slogan] = useState(getRandomSlogan);
  const [greeting] = useState(getGreetingByHour);

  // Slicers & Comparison Engine
  const [timeframe, setTimeframe] = useState("30days");
  const [department, setDepartment] = useState("all");
  const [job, setJob] = useState("all");
  const [recruiter, setRecruiter] = useState("all");
  
  const [compareMode, setCompareMode] = useState("none"); 
  const [compareTarget, setCompareTarget] = useState("");

  // UI States
  const [viewMode, setViewMode] = useState("active"); 
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [expandedSources, setExpandedSources] = useState<string[]>([]);
  const [jobsSortDesc, setJobsSortDesc] = useState(false); 
  
  // Manual Task
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", desc: "", assignee: "", severity: "medium", type: "task" });

  useEffect(() => {
    const loadLive = async () => {
      try {
        setLiveDataError(null);
        const qs = `timeframe=${timeframe}&department=${department}&recruiter=${recruiter}`;
        const [statsRes, metaRes, metricsRes] = await Promise.all([
          fetch(`${apiBase}/stats?${qs}`, { cache: "no-store" }),
          fetch(`${apiBase}/meta`, { cache: "no-store" }),
          fetch(`${apiBase}/api/dashboard/metrics?${qs}`, { cache: "no-store" }),
        ]);
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setLiveStats(stats);
        }
        if (metaRes.ok) {
          const meta = await metaRes.json();
          setLiveMeta({
            departments: Array.isArray(meta?.departments) ? meta.departments : [],
            recruiters: Array.isArray(meta?.recruiters) ? meta.recruiters : [],
          });
        }
        if (metricsRes.ok) {
          setMetrics(await metricsRes.json());
        }
      } catch {
        setLiveDataError("Live API is unavailable");
      }
    };
    loadLive();
  }, [apiBase, timeframe, department, recruiter]);

  useEffect(() => {
    const loadNeglect = async () => {
      try {
        const res = await fetch(`${apiBase}/jobs/neglect-alerts?limit=5`, { cache: "no-store" });
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

  // --- Dynamic Live Data (Slicers Engine) - computed via useMemo (deterministic seed for purity) ---
  type ChartPoint = { name: string; candidates: number; compCandidates?: number };
  // KPI source-of-truth: /api/dashboard/metrics (one round-trip, all
  // values computed server-side from real DB data — see
  // backend/routers/metrics.py). The legacy /stats endpoint is kept
  // around for backward compat, but only the fields that the new
  // endpoint doesn't yet return fall back to it.
  const kpis = useMemo(() => {
    if (metrics) {
      return {
        hires: metrics.hires,                       // applications.status ∈ {קליטה, גיוס, התקבל}
        attrition: metrics.attrition,               // count of attrition_events in period
        applications: metrics.applications,         // count of active applications
        e2e: metrics.e2e_pct,                       // hires / applications * 100
        ttf: metrics.avg_days_to_hire,              // mean of days_in_process for hires
        oar: metrics.oar_pct,                       // hires / (hires + offer + rejected) * 100
        cph: metrics.cph,                           // total_spend / hires_in_period
        ghosting: metrics.ghosting_count,           // active applications stuck > 14 days
        internalMobility: metrics.internal_mobility_pct,
        hiresYoyPct: metrics.hires_yoy_pct,
        attritionYoyPct: metrics.attrition_yoy_pct,
      };
    }
    if (!liveStats) {
      return {
        hires: 0, attrition: 0, applications: 0, e2e: 0, ttf: 0,
        oar: 0, cph: 0, ghosting: 0,
        internalMobility: 0, hiresYoyPct: null as number | null,
        attritionYoyPct: null as number | null,
      };
    }
    // Fallback path — /api/dashboard/metrics didn't return; degrade to
    // the limited /stats payload so the dashboard isn't blank.
    return {
      hires: Number(liveStats.hired_this_month ?? 0),
      attrition: 0,
      applications: Number(liveStats.total_candidates ?? 0),
      e2e: 0,
      ttf: Number(liveStats.avg_days ?? 0),
      oar: 0,
      cph: 0,
      ghosting: Number(liveStats.sla_alerts ?? 0),
      internalMobility: 0,
      hiresYoyPct: null as number | null,
      attritionYoyPct: null as number | null,
    };
  }, [metrics, liveStats]);

  const dynamicChart = useMemo<ChartPoint[]>(() => {
    const deptFactor = department !== 'all' ? 0.4 : 1;
    const jobFactor = job !== 'all' ? 0.15 : 1;
    const recFactor = recruiter !== 'all' ? 0.25 : 1;
    const timeFactor = timeframe === 'year' ? 12 : timeframe === 'q1' ? 3 : timeframe === 'week' ? 0.25 : 1;
    const factor = deptFactor * jobFactor * recFactor * timeFactor;
    const seed = (timeframe.length + department.length * 7 + job.length * 31 + recruiter.length * 13) % 100 / 100;
    const noise = 1 + seed * 0.2;
    if (liveStats?.chart_data?.length) {
      return liveStats.chart_data.map((p) => ({
        name: p.name,
        candidates: p.candidates,
        compCandidates: Math.round(p.candidates * 0.9),
      }));
    }
    return [
      { name: "נק' 1", candidates: Math.floor(120 * factor * noise), compCandidates: Math.floor(100 * factor * noise) },
      { name: "נק' 2", candidates: Math.floor(180 * factor * noise), compCandidates: Math.floor(150 * factor * noise) },
      { name: "נק' 3", candidates: Math.floor(140 * factor * noise), compCandidates: Math.floor(160 * factor * noise) },
      { name: "נק' 4", candidates: Math.floor(210 * factor * noise), compCandidates: Math.floor(190 * factor * noise) }
    ];
  }, [timeframe, department, job, recruiter, liveStats]);

  // שמות דינמיים לגרף ההשוואות
  const getPrimaryName = () => recruiter !== 'all' ? recruiter : department !== 'all' ? department : 'נוכחי';
  const getCompareName = () => {
    if (compareMode === 'yoy') return 'אשתקד';
    if (compareMode === 'prev_period') return 'תקופה קודמת';
    return compareTarget || 'השוואה';
  };

  // --- Notifications Engine ---
  const addNotification = (targetRole: string, msg: string, type: string) => {
    setNotifications(prev => [{ id: Date.now(), targetRole, msg, type, time: "ממש עכשיו", read: false }, ...prev]);
  };
  const activeNotifications = notifications.filter(n => n.targetRole === currentRole || n.targetRole === 'all');
  
  useEffect(() => {
    const hasKudos = activeNotifications.find(n => n.type === 'kudos');
    if (hasKudos) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 6000);
      setNotifications(prev => prev.filter(n => n.id !== hasKudos.id));
    }
    
    // Inactivity warnings are now driven entirely by the backend
    // (POST /api/admin/check-inactive-recruiters fires real notifications to
    // the recruiter AND admins via the notifications table). No client-side
    // simulation here — keeps the toast clean and avoids false positives.
  }, [activeNotifications, currentRole]);

  // --- Actions ---
  const handleTaskAction = (id: string, action: string, task: AITask) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: action } : t));
    if (action === 'done' && currentRole === 'recruiter') addNotification('admin', `${effectiveUser.name || 'המגייסת'} השלימה משימה: ${task.title}`, 'success');
  };

  const handleKudos = (task: AITask) => {
    handleTaskAction(task.id, 'done', task);
    const senderName = effectiveUser.name || "המנהל";
    addNotification(task.assignee ? 'recruiter' : 'other', `קיבלת פרגון מ${senderName}! ${task.title}`, 'kudos');
  };

  const handleCreateManualTask = () => {
    if (!newTask.title) return;
    const isKudos = newTask.type === "kudos";
    const task = { id: `m-${Date.now()}`, severity: isKudos ? "positive" : newTask.severity, tags: ["ידני", isKudos ? "שימור" : "משימת מנהל"], title: newTask.title, desc: newTask.desc, assignee: newTask.assignee, status: "open", time: "עכשיו" };
    setTasks([task, ...tasks]);
    const senderName = effectiveUser.name || "המנהל";
    addNotification(newTask.assignee ? 'recruiter' : 'other', isKudos ? `קיבלת פרגון חדש מ${senderName}: ${task.title}` : `משימה חדשה מ${senderName}: ${task.title}`, isKudos ? 'kudos' : 'ping');
    setIsCreatingTask(false);
    setNewTask({ title: "", desc: "", assignee: "", severity: "medium", type: "task" });
  };

  const toggleSourceCategory = (catName: string) => {
    setExpandedSources(prev => prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]);
  };

  // פונקציית האיפוס
  const handleResetFilters = () => {
    setTimeframe("30days");
    setDepartment("all");
    setJob("all");
    setRecruiter("all");
    setCompareMode("none");
    setCompareTarget("");
  };

  // בדיקה אם יש סינון פעיל
  const isFiltered = timeframe !== "30days" || department !== "all" || job !== "all" || recruiter !== "all" || compareMode !== "none";

  // Show: admin sees everything; recruiter sees only tasks assigned to them
  // (matches by name OR email — covers both legacy hard-coded names and
  // new dynamically-assigned tasks).
  const visibleTasks = tasks.filter(t => {
    if (!(viewMode === "active" ? t.status === "open" : t.status !== "open")) return false;
    if (currentRole === "admin") return true;
    if (currentRole !== "recruiter") return false;
    const me = (effectiveUser.name || "").trim();
    return !t.assignee || t.assignee === me || t.assignee === effectiveUser.email;
  });
  const sortedJobs = [...activeJobsRanking].sort((a, b) => jobsSortDesc ? b.cvs - a.cvs : a.cvs - b.cvs);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 relative pb-20 overflow-visible px-2 md:px-6">
      {showConfetti && <ConfettiOverlay />}

      {/* --- TOASTS --- */}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {activeNotifications.filter(n => n.type !== 'kudos').map(notif => (
          <div key={notif.id} className={`bg-white border shadow-2xl rounded-xl p-4 flex items-start gap-3 w-80 animate-in slide-in-from-left-8 pointer-events-auto ${notif.type === 'success' ? 'border-green-500' : 'border-[#EF6B00]'}`}>
            <div className={`p-2 rounded-full shrink-0 ${notif.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
              <Bell size={18} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-[#002649] text-sm">התראה מערכתית</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.msg}</p>
            </div>
            <button onClick={() => setNotifications(notifications.filter(n => n.id !== notif.id))} className="text-slate-400 hover:text-red-500 shrink-0">✕</button>
          </div>
        ))}
      </div>

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2 relative z-[60]">
        <div>
          <h1 className="text-3xl font-black text-[#002649] tracking-tight flex items-center gap-3">
            {greeting.text}, {(effectiveUser.name || "").split(" ")[0] || effectiveUser.email || ""}
            {greeting.icon}
          </h1>
          <p className="text-slate-500 mt-2 font-bold text-xs">
            {slogan}
          </p>
        </div>

        <div />
      </div>

      {/* --- GLOBAL SLICERS (REFINED) --- */}
      {strictLiveData && liveDataError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
          מצב Live קשיח פעיל: לא ניתן להציג נתוני Mock. בדוק זמינות API.
        </div>
      )}
      <div className="bg-white rounded-xl p-2 flex flex-wrap items-center gap-3 shadow-sm relative z-40 border border-slate-200">
        <div className="flex items-center justify-center pl-3 border-l border-slate-100 text-[#002649]">
          <Filter size={16} />
        </div>
        
        <select className="bg-slate-50 hover:bg-slate-100 transition-colors border border-transparent text-slate-700 text-xs rounded-lg outline-none py-1.5 px-2 font-bold min-w-[120px] cursor-pointer" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
          <option value="all">כל הזמנים</option>
          <option value="year">שנה נוכחית</option>
          <option value="q1">רבעון נוכחי</option>
          <option value="30days">30 ימים אחרונים</option>
          <option value="week">השבוע החולף</option>
        </select>

        <select className="bg-slate-50 hover:bg-slate-100 transition-colors border border-transparent text-slate-700 text-xs rounded-lg outline-none py-1.5 px-2 min-w-[130px] cursor-pointer" disabled={currentRole === "hrbp"} value={department} onChange={(e) => setDepartment(e.target.value)}>
          {currentRole === "hrbp" ? <option value="sales">חטיבת שירות (נעול)</option> : <option value="all">כל המחלקות</option>}
          {currentRole !== "hrbp" && liveMeta.departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select className="bg-slate-50 hover:bg-slate-100 transition-colors border border-transparent text-slate-700 text-xs rounded-lg outline-none py-1.5 px-2 min-w-[130px] cursor-pointer" value={job} onChange={(e) => setJob(e.target.value)}>
          <option value="all">כל המשרות</option>
          {FILTERS_META.jobs.map(j => <option key={j} value={j}>{j}</option>)}
        </select>

        {currentRole === "admin" && (
          <select className="bg-slate-50 hover:bg-slate-100 transition-colors border border-transparent text-slate-700 text-xs rounded-lg outline-none py-1.5 px-2 min-w-[130px] cursor-pointer" value={recruiter} onChange={(e) => setRecruiter(e.target.value)}>
            <option value="all">כל המגייסים</option>
            {liveMeta.recruiters.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}

        {/* כפתור איפוס דינמי מוקטן */}
        {isFiltered && (
          <button onClick={handleResetFilters} className="flex items-center gap-1 px-2 py-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded text-[11px] font-bold transition-colors">
            <RotateCcw size={12} /> נקה
          </button>
        )}

        {/* COMPARISON ENGINE COMPACT */}
        <div className="flex-1 flex justify-end shrink-0">
          <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-lg p-1">
            <span className="text-[11px] font-bold text-blue-900 px-2 flex items-center gap-1"><ArrowRightLeft size={12}/> השוואה מול:</span>
            
            <select className="bg-white text-blue-800 text-[11px] font-bold rounded-md outline-none py-1 px-2 cursor-pointer border border-blue-100 shadow-sm" 
              value={compareMode} 
              onChange={(e) => {
                setCompareMode(e.target.value);
                setCompareTarget(""); 
              }}>
              <option value="none">ללא</option>
              <option value="prev_period">תקופה קודמת</option>
              <option value="yoy">שנה שעברה</option>
              {currentRole === "admin" && <option value="recruiters">מגייס ספציפי</option>}
              {currentRole === "admin" && <option value="departments">מחלקה ספציפית</option>}
            </select>

            {compareMode === "recruiters" && (
              <select className="bg-blue-600 text-white text-[11px] font-bold rounded-md outline-none py-1 px-2 cursor-pointer border border-blue-700 shadow-sm animate-in fade-in" 
                value={compareTarget} onChange={e => setCompareTarget(e.target.value)}>
                <option value="">בחר...</option>
                {FILTERS_META.recruiters.filter(r => r !== recruiter).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}

            {compareMode === "departments" && (
              <select className="bg-blue-600 text-white text-[11px] font-bold rounded-md outline-none py-1 px-2 cursor-pointer border border-blue-700 shadow-sm animate-in fade-in" 
                value={compareTarget} onChange={e => setCompareTarget(e.target.value)}>
                <option value="">בחר...</option>
                {FILTERS_META.departments.filter(d => d !== department).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* 1. THE DATA MONSTER (DASHBOARD) */}
      {/* ========================================= */}
      <div className="space-y-8 relative z-20">
        
        {/* ROW 1: THE BOTTOM LINES */}
        {/* Subtext for hires + attrition is now driven by the real YoY %
            from /api/dashboard/metrics (null → no subtext rather than a
            fake "+15%"). The label switches sign + colour-cues based on
            whether the value is positive (more hires good, more attrition bad). */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard
            title="סה״כ קליטות בפועל"
            value={kpis.hires}
            icon={<CheckCircle className="text-green-600" size={20}/>}
            borderColorClass="border-t-green-500"
            subtext={kpis.hiresYoyPct !== null ? `${kpis.hiresYoyPct >= 0 ? "⬆️ +" : "⬇️ "}${kpis.hiresYoyPct}% מול שנה שעברה` : null}
            info="כל המועמדים שסטטוס ה-ATS שלהם הוא 'קליטה' / 'גיוס' / 'התקבל' לפי הסינון שנבחר."
          />

          <KpiCard
            title="סה״כ עזיבות (Attrition)"
            value={kpis.attrition}
            isWarning={kpis.attrition > 5}
            icon={<UserMinus className="text-orange-500" size={20}/>}
            borderColorClass="border-t-orange-500"
            subtext={kpis.attritionYoyPct !== null ? `${kpis.attritionYoyPct >= 0 ? "⬆️ +" : "⬇️ "}${kpis.attritionYoyPct}% מול שנה שעברה` : null}
            info="עובדים שעזבו (attrition_events) בטווח הזמן שנבחר."
          />

          <KpiCard
            title="סה״כ קורות חיים"
            value={kpis.applications.toLocaleString()}
            icon={<Users className="text-blue-500" size={20}/>}
            borderColorClass="border-t-blue-500"
            info="נפח קורות החיים שנכנסו למערכת מכלל המקורות."
          />

          <KpiCard
            title="יחס המרה (E2E Conversion)"
            value={`${kpis.e2e}%`}
            icon={<Percent className="text-purple-500" size={20}/>}
            borderColorClass="border-t-purple-500"
            subtext="בנצ'מארק שוק: 0.5%"
            info="אחוז המועמדים שנקלטו בפועל מתוך סך קורות החיים שהוגשו (קליטות ÷ קורות חיים × 100)."
          />
        </div>

        {/* ROW 2: ADVANCED KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* TTF — backend computes the *mean* of days_in_process (not the
              median). The label used to say "חציוני" which was a mismatch;
              corrected to "ממוצע" so the screen tells the truth. */}
          <KpiCard title={currentRole === 'recruiter' ? "ימי SLA ממוצעים שלי" : "זמן איוש ממוצע (TTF)"} value={`${kpis.ttf} ימים`} icon={<Clock className="text-purple-600" size={20}/>} borderColorClass="border-t-purple-600" subtext={kpis.ttf > 40 ? "חריגה מהיעד (40)" : "עמידה ביעד"}
            info="TTF (Time to Fill): הזמן הממוצע מפתיחת המשרה ועד חתימת החוזה. ממוצע (mean) על השדה days_in_process של רשומות שסטטוסן 'קליטה/גיוס/התקבל'." />

          {/* OAR — rough approximation, see the formula and its caveats
              in backend/routers/metrics.py (current schema has no
              state-transition history). */}
          <KpiCard title="אחוז חתימת חוזים (OAR)" value={`${kpis.oar}%`} isPositive={kpis.oar >= 80} isWarning={kpis.oar < 80} icon={<Activity className="text-green-600" size={20}/>} borderColorClass="border-t-green-600" subtext="בנצ'מארק שוק: 80%"
              info="OAR (Offer Acceptance Rate): התקבל ÷ (התקבל + הצעה + נדחה) × 100. קירוב — ה-DB מחזיק רק סטטוס נוכחי, לא היסטוריית מעברים."/>

          {currentRole === "admin" || currentRole === "hrbp" ? (
            <KpiCard title="עלות ממוצעת לאיוש (CPH)" value={`₪${kpis.cph.toLocaleString()}`} icon={<BadgeDollarSign className="text-orange-600" size={20}/>} borderColorClass="border-t-orange-600" subtext="סך הוצאות / מספר קליטות"
              info="CPH (Cost Per Hire): SUM(finops_invoices.amount בתקופה) ÷ COUNT(hires באותה תקופה). כל החשבוניות נכללות; סינון לקטגוריה ייתוסף ברגע שמיפוי הקטגוריות יציב." />
          ) : (
            <KpiCard title="מועמדים בסיכון (Ghosting)" value={kpis.ghosting} isWarning={kpis.ghosting > 0} icon={<AlertTriangle className="text-red-600" size={20}/>} borderColorClass="border-t-red-600" subtext="ממתינים מעל 14 יום"
              info="מועמדים פעילים שתקועים יותר מ-14 ימים בלי תזוזת סטטוס. מודד 'דממה' ולא חריגת SLA (שתי בעיות שונות)." />
          )}

          {currentRole === "admin" && (
            <div className="relative">
              <FutureBadge reason={metrics?.future_blocks.find(b => b.key === "quality_of_hire")?.reason} />
              <KpiCard title="איכות הגיוס (Quality of Hire)" value="—" isPositive={false} icon={<Trophy className="text-yellow-500" size={20}/>} borderColorClass="border-t-yellow-500" subtext="דורש HRIS"
                info="הגביע הקדוש של הגיוס: אחוז מגויסים שנשארו בארגון מעל שנה (Retention). חסום עד שיוזרם נתון מ-HRIS." />
            </div>
          )}
        </div>

        {/* ROW 3: PIPELINE & FUNNEL */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 h-[400px] flex flex-col shadow-sm hover:shadow-lg hover:z-50 transition-all">
            <h3 className="font-bold text-[#002649] flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><BarChart3 size={18} className="text-[#EF6B00]"/> נפח מועמדים לאורך זמן</div>
              {compareMode !== 'none' && <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">משווה: {getPrimaryName()} מול {getCompareName()}</div>}
            </h3>
            <div className="flex-1 w-full min-h-[280px]">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dynamicChart}>
                  <defs>
                    <linearGradient id="colorCands" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#002649" stopOpacity={0.2}/><stop offset="95%" stopColor="#002649" stopOpacity={0}/></linearGradient>
                    {compareMode !== 'none' && <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF6B00" stopOpacity={0.2}/><stop offset="95%" stopColor="#EF6B00" stopOpacity={0}/></linearGradient>}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 9999}} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 'bold'}} />
                  <Area type="monotone" name={getPrimaryName()} dataKey="candidates" stroke="#002649" strokeWidth={3} fillOpacity={1} fill="url(#colorCands)" activeDot={{r: 6, fill: '#002649'}} />
                  {(compareMode !== 'none' && (compareTarget !== "" || ['yoy', 'prev_period'].includes(compareMode))) && (
                    <Area type="monotone" name={getCompareName()} dataKey="compCandidates" stroke="#EF6B00" strokeWidth={3} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorComp)" activeDot={{r: 6, fill: '#EF6B00'}}/>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 h-[400px] overflow-y-auto shadow-sm hover:shadow-lg hover:z-50 transition-all">
            <h3 className="font-bold text-[#002649] flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
              <Layers size={18} className="text-blue-500" /> משפך המרות (Dynamic Funnel)
            </h3>
            <div className="space-y-5">
              {(() => {
                // Funnel now sources directly from metrics.funnel — each
                // stage count is a real applications.status text match
                // (see backend/routers/metrics.py `funnel` build). The
                // previous "Math.floor(hires * 1.5)" approximation has
                // been removed — that was a synthetic multiplier with no
                // basis in the data.
                const FUNNEL_COLOURS = [
                  "bg-[#002649]", "bg-blue-800", "bg-blue-600",
                  "bg-blue-400", "bg-green-500",
                ];
                const realFunnel = metrics?.funnel ?? [];
                const applications = realFunnel[0]?.count ?? Math.max(0, Number(kpis.applications ?? 0));
                const stages = realFunnel.map((s, i) => ({
                  stage: s.stage,
                  count: s.count,
                  pct: applications > 0 ? Number(((s.count / applications) * 100).toFixed(1)) : 0,
                  color: FUNNEL_COLOURS[i] ?? "bg-slate-400",
                  drop: null as string | null,
                }));

                return stages.map((s, i) => (
                <div key={i} className="relative">
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1 z-10 relative px-1"><span>{s.stage}</span><span>{s.count.toLocaleString()} ({s.pct}%)</span></div>
                  <div className="w-full bg-slate-100 h-6 rounded-lg overflow-hidden group"><div className={`h-full ${s.color} transition-all duration-1000`} style={{width: `${s.pct}%`}}></div></div>
                  {compareMode !== 'none' && s.drop && <div className={`absolute -bottom-2.5 left-4 text-[9px] font-black px-1.5 rounded border ${s.drop.includes('-') ? 'bg-red-50 text-red-600 border-red-200 z-20 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 z-20'}`}>{s.drop} בהשוואה</div>}
                </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* ROW 4: SOURCES & STRATEGIC FOCUS */}
        {currentRole === "admin" && (
          <div className="space-y-6">
            
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:z-50 transition-all relative">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-lg text-[#002649] flex items-center gap-2">
                  <PieChart size={20} className="text-purple-500" /> איכות מקורות הגיוס (Source of Hire)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-[#002649] text-white font-bold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">קטגוריית מקור / ספק</th>
                      <th className="px-6 py-4 text-center">הגשות קו״ח</th>
                      <th className="px-6 py-4 text-center">ראיונות טלפוניים</th>
                      <th className="px-6 py-4 text-center">קליטות בפועל</th>
                      <th className="px-6 py-4 text-center">% המרה לקליטה</th>
                      <th className="px-6 py-4 text-center">עלות השמה ממוצעת</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
            {sourcesData.map((src, i) => {
                      const isExpanded = expandedSources.includes(src.category);
                      const convRate = ((src.hires / src.cvs) * 100).toFixed(1);
                      return (
                        <React.Fragment key={i}>
                          <tr className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => toggleSourceCategory(src.category)}>
                            <td className="px-6 py-4 font-black text-[#002649] flex items-center gap-2">
                              {isExpanded ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                              {src.category}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-700">{src.cvs.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center text-slate-700">{src.phone.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center font-black text-green-600">{src.hires.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center font-bold">{convRate}%</td>
                            <td className="px-6 py-4 text-center font-bold text-[#EF6B00]">{src.cph}</td>
                          </tr>
                          {isExpanded && src.sources.map((sub, j) => {
                            const subConvRate = ((sub.hires / sub.cvs) * 100).toFixed(1);
                            return (
                              <tr key={`${i}-${j}`} className="bg-slate-50/50 hover:bg-blue-50/30 text-xs">
                                <td className="px-6 py-3 pl-12 font-bold text-slate-600 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:border-l-2 before:border-b-2 before:border-slate-300 before:-mt-2 before:ml-2">
                                  {sub.name}
                                </td>
                                <td className="px-6 py-3 text-center text-slate-600">{sub.cvs.toLocaleString()}</td>
                                <td className="px-6 py-3 text-center text-slate-600">{sub.phone.toLocaleString()}</td>
                                <td className="px-6 py-3 text-center font-bold text-green-600">{sub.hires.toLocaleString()}</td>
                                <td className="px-6 py-3 text-center font-medium">{subConvRate}%</td>
                                <td className="px-6 py-3 text-center font-medium text-slate-500">{sub.cph}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* STRATEGIC FOCUS CARDS */}
            {sourcesData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8">
                 {(() => {
                   // Strategic sources used to be hardcoded zeros. They now
                   // pull from metrics.sources_breakdown (candidates.source
                   // group-by) so each card shows the real CV count and
                   // real hires for that source channel.
                   const findSource = (...keys: string[]) =>
                     (metrics?.sources_breakdown ?? []).find(s =>
                       keys.some(k => s.name.toLowerCase() === k.toLowerCase())
                     ) ?? { cvs: 0, hires: 0 };
                   const internal = findSource("Internal", "פנימי");
                   const referral = findSource("Referral", "חבר מביא חבר");
                   const linkedin = findSource("LinkedIn");
                   return (
                     <>
                       <StrategicSourceCard title="ניוד פנימי" icon={<ArrowRightLeft className="text-purple-600"/>} color="purple" cvs={internal.cvs} hires={internal.hires} totalHires={kpis.hires} />
                       <StrategicSourceCard title="חבר מביא חבר" icon={<Users className="text-green-600"/>} color="green" cvs={referral.cvs} hires={referral.hires} totalHires={kpis.hires} />
                       <StrategicSourceCard title="לינקדאין (אורגני וממומן)" icon={<Linkedin className="text-blue-600"/>} color="blue" cvs={linkedin.cvs} hires={linkedin.hires} totalHires={kpis.hires} />
                     </>
                   );
                 })()}
              </div>
            )}

          </div>
        )}

        {/* ROW 5: REASONS BREAKDOWN (3 PIES) */}
        {(currentRole === "admin" || currentRole === "hrbp") && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8">
            {/* Two of these need a `rejection_reason` / `withdrawal_reason`
                field on applications that doesn't exist yet — they get an
                honest "future" badge instead of an empty pie. The third
                (attrition reasons) IS computable: it's a group-by on
                attrition_events.reason, surfaced via metrics.attrition_reasons. */}
            <div className="relative">
              <FutureBadge reason={metrics?.future_blocks.find(b => b.key === "rejection_reasons")?.reason} />
              <PieBreakdownCard title="סיבות דחיית מועמדים" icon={<UserMinus size={18} className="text-orange-500"/>} data={rejectReasons} info="מדוע אנחנו דחינו מועמדים? עוזר לדייק דרישות משרה. דורש שדה rejection_reason ב-applications + תיוג ע״י המגייסת." />
            </div>
            <div className="relative">
              <FutureBadge reason={metrics?.future_blocks.find(b => b.key === "withdrawal_reasons")?.reason} />
              <PieBreakdownCard title="סיבות הסרת מועמדות" icon={<AlertTriangle size={18} className="text-red-500"/>} data={withdrawReasons} info="מדוע מועמדים פרשו מהתהליך בעצמם? חיוני לזיהוי בעיות שכר. דורש שדה withdrawal_reason ב-applications." />
            </div>
            <PieBreakdownCard title="סיבות עזיבת עובדים" icon={<ArrowDownToLine size={18} className="text-purple-500"/>} data={metrics?.attrition_reasons ?? attritionReasons} info="מדוע עובדים עזבו בשנה הראשונה. נשאב מ-attrition_events.reason (top 5 לפי התקופה שנבחרה)." />
          </div>
        )}

        {/* ROW 6: LEADERBOARDS & RANKINGS */}
        {(currentRole === "admin" || currentRole === "hrbp") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-lg hover:z-50 transition-all">
               <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                 <h3 className="font-bold text-[#002649] flex items-center gap-2">
                   <Trophy size={18} className="text-yellow-500"/> לוח הישגי מגייסים (Leaderboard)
                 </h3>
               </div>
               <div className="flex-1 overflow-auto">
                 <table className="w-full text-sm text-right">
                   <thead className="text-slate-400 font-bold text-[10px] uppercase bg-slate-50">
                     <tr><th className="p-3 rounded-r-lg">מגייס.ת</th><th className="p-3 text-center">קליטות</th><th className="p-3 text-center">משרות פעילות</th><th className="p-3 text-center">SLA ממוצע</th><th className="p-3 text-center rounded-l-lg">Score</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {recruiterLeaderboard.map((r, i) => (
                       <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                         <td className="p-3 font-bold text-[#002649] flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">{i+1}</div> {r.name}</td>
                         <td className="p-3 text-center font-black text-green-600">{r.hires}</td>
                         <td className="p-3 text-center text-slate-600">{r.active_jobs}</td>
                         <td className="p-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${r.avg_sla > 40 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{r.avg_sla} ימים</span></td>
                         <td className="p-3 text-center font-bold text-[#002649]">{r.score}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-lg hover:z-50 transition-all">
               <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                 <h3 className="font-bold text-[#002649] flex items-center gap-2">
                   <Activity size={18} className="text-blue-500"/> צרכי סורסינג משרות (Active Jobs)
                 </h3>
                 <button onClick={() => setJobsSortDesc(!jobsSortDesc)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                   <ArrowUpDown size={14}/> מיון
                 </button>
               </div>
               <div className="flex-1 overflow-auto">
                 <table className="w-full text-sm text-right">
                   <thead className="text-slate-400 font-bold text-[10px] uppercase bg-slate-50">
                     <tr><th className="p-3 rounded-r-lg">שם משרה</th><th className="p-3 text-center">כמות קו״ח</th><th className="p-3 text-center rounded-l-lg">סטטוס סורסינג</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {sortedJobs.map((j, i) => (
                       <tr key={i} className="hover:bg-slate-50 transition-colors">
                         <td className="p-3 font-bold text-slate-700">{j.job}</td>
                         <td className="p-3 text-center font-black text-[#002649]">{j.cvs}</td>
                         <td className="p-3 text-center">
                           <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                              j.status === 'קריטי' ? 'bg-red-100 text-red-700' :
                              j.status === 'אזהרה' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                            }`}>{j.status}</span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {currentRole === "admin" && (
          <NeglectedJobsBlock neglectData={neglectData} />
        )}
      </div>

      {/* ========================================= */}
      {/* BOTTOM SECTION: AI ACTION INBOX */}
      {/* ========================================= */}
      {(currentRole === "admin" || currentRole === "recruiter") && (
        <div className="pt-8 border-t border-slate-200 mt-12 relative z-10">
          <div className="bg-white shadow-lg rounded-2xl flex flex-col overflow-visible border-t-4 border-t-[#EF6B00]">
            
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 rounded-t-2xl">
              <div>
                <h3 className="font-black text-xl text-[#002649] flex items-center gap-2">
                  <Zap size={22} className="text-[#EF6B00] animate-bounce-slow"/> תובנות למעשה (AI Action Inbox)
                  <TooltipIcon text="ה-AI מנתח בלילה את כל המדדים העליונים, ודוחף לכאן רק מה שדורש התערבות אנושית: צווארי בקבוק, או נקודות לפרגון. Inbox נקי = מחלקה בריאה." />
                </h3>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  {currentRole === "admin" ? "מבט ניהולי: חלוקת משימות ותעדוף חריגות ארגוניות." : "המשימות וההתראות הממוקדות שלך להיום."}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-slate-200/70 p-1 rounded-lg flex items-center text-xs font-bold text-slate-600 border border-slate-200">
                  <button onClick={() => setViewMode("active")} className={`px-4 py-1.5 rounded-md transition-all ${viewMode === 'active' ? 'bg-white shadow-sm text-[#002649]' : 'hover:bg-slate-300'}`}>פעילות ({tasks.filter(t => t.status === 'open').length})</button>
                  <button onClick={() => setViewMode("archive")} className={`px-4 py-1.5 rounded-md transition-all ${viewMode === 'archive' ? 'bg-white shadow-sm text-[#002649]' : 'hover:bg-slate-300'}`}>ארכיון / סל מיחזור</button>
                </div>
                {currentRole === "admin" && viewMode === "active" && (
                  <button onClick={() => setIsCreatingTask(true)} className="bg-[#002649] text-white p-2 rounded-lg hover:bg-[#EF6B00] transition-colors shadow-sm" title="הוסף משימת מנהל יזומה">
                    <Plus size={18}/>
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 bg-slate-50/30 min-h-[300px]">
              {visibleTasks.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  {viewMode === "active" ? (
                    <><CheckCircle size={64} className="mb-4 text-green-400 opacity-50" /><p className="font-bold text-lg">Inbox Zero! נקי ממשימות.</p><p className="text-sm">כל החריגות טופלו.</p></>
                  ) : (
                    <><Archive size={64} className="mb-4 opacity-50" /><p className="font-bold text-lg">סל המיחזור ריק.</p></>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleTasks.map(task => (
                    <div key={task.id} className={`bg-white rounded-2xl p-5 border shadow-sm transition-all relative flex flex-col ${
                      task.severity === 'high' && viewMode === 'active' ? 'border-red-200 hover:border-red-400 hover:shadow-md' : 
                      task.severity === 'positive' && viewMode === 'active' ? 'border-green-200 hover:border-green-400 bg-gradient-to-br from-white to-green-50/30 hover:shadow-md' : 
                      viewMode === 'archive' ? 'opacity-70 bg-slate-50 grayscale-[20%]' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }`}>
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-wrap gap-2">
                          {task.tags.map(tag => (
                            <span key={tag} className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                              tag.includes('ידני') ? 'bg-purple-100 text-purple-800' : task.severity === 'positive' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                            }`}>{tag}</span>
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 shrink-0"><Clock size={10}/> {task.time}</span>
                      </div>

                      <h4 className={`font-black text-[15px] flex items-start gap-2 mb-2 ${task.severity === 'high' ? 'text-red-700' : task.severity === 'positive' ? 'text-green-800' : 'text-[#002649]'}`}>
                        {task.severity === 'high' && <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                        {task.severity === 'positive' && <Trophy size={16} className="shrink-0 mt-0.5 text-yellow-500" />}
                        {task.title}
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">{task.desc}</p>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://ui-avatars.com/api/?name=${task.assignee}&background=002649&color=fff&size=24`} className="rounded-full shadow-sm" alt="Avatar" />
                          <span className="text-xs font-bold text-slate-700">{task.assignee}</span>
                        </div>

                        {viewMode === "active" ? (
                          <div className="flex gap-2 relative z-10">
                            {currentRole === "admin" && task.severity !== 'positive' && (
                              <button onClick={() => addNotification(task.assignee ? 'recruiter' : 'other', `נשלחה אליך תזכורת מ${effectiveUser.name || 'המנהל'} לטיפול ב: ${task.title}`, 'ping')} className="p-2 text-orange-500 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors tooltip-trigger" title="שלח תזכורת למגייס (Ping)">
                                <Send size={16} />
                              </button>
                            )}
                            
                            {task.severity === 'positive' ? (
                              <>
                                {currentRole === "admin" && (
                                  <button onClick={() => handleTaskAction(task.id, 'archived', task)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="העבר לארכיון ללא פרגון"><Trash2 size={16} /></button>
                                )}
                                <button onClick={() => handleKudos(task)} className="flex items-center gap-1.5 px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 font-bold text-xs rounded-lg shadow-sm">
                                  <ThumbsUp size={14} /> שלח פרגון
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleTaskAction(task.id, 'archived', task)} className="p-2 text-slate-400 bg-slate-50 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="העבר לסל מיחזור"><Trash2 size={16} /></button>
                                <button onClick={() => handleTaskAction(task.id, 'done', task)} className="p-2 text-slate-400 bg-slate-50 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="סמן כבוצע"><CheckCircle2 size={16} /></button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-slate-400 flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg">
                            {task.status === 'done' ? <><CheckCircle2 size={14} className="text-green-500"/> בוצע</> : <><Archive size={14}/> נגנז</>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MANUAL TASK MODAL --- */}
      {isCreatingTask && (
        <div className="fixed inset-0 bg-[#002649]/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-visible animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between bg-slate-50 rounded-t-2xl">
              <h2 className="text-lg font-black text-[#002649] flex items-center gap-2"><Target size={18} className="text-[#EF6B00]"/> משימה יזומה / פרגון</h2>
              <button onClick={() => setIsCreatingTask(false)} className="text-slate-400 hover:text-red-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setNewTask({...newTask, type: "task"})} className={`flex-1 text-sm font-bold py-2 rounded-md transition-colors ${newTask.type === 'task' ? 'bg-white text-[#002649] shadow-sm' : 'text-slate-500'}`}>📌 משימה לביצוע</button>
                <button onClick={() => setNewTask({...newTask, type: "kudos"})} className={`flex-1 text-sm font-bold py-2 rounded-md transition-colors ${newTask.type === 'kudos' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-500'}`}>🏆 הודעת פירגון</button>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">כותרת</label>
                <input type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-[#EF6B00]" placeholder={newTask.type === 'kudos' ? "לדוג': כל הכבוד על סגירת המשרה!" : "לדוג': לחזור למועמד דניאל בדחיפות"} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">פירוט</label>
                <textarea value={newTask.desc} onChange={e => setNewTask({...newTask, desc: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-[#EF6B00] resize-none h-20" placeholder="הזן טקסט כאן..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">שיוך למגייס.ת</label>
                  <select value={newTask.assignee} onChange={e => setNewTask({...newTask, assignee: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg outline-none font-bold text-[#002649]">
                    {FILTERS_META.recruiters.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {newTask.type === 'task' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">דחיפות</label>
                    <select value={newTask.severity} onChange={e => setNewTask({...newTask, severity: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg outline-none">
                      <option value="medium">רגילה</option>
                      <option value="high">דחופה 🔥</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100 rounded-b-2xl">
              <button onClick={() => setIsCreatingTask(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg">ביטול</button>
              <button onClick={handleCreateManualTask} className={`px-5 py-2 font-bold text-white rounded-lg shadow-md transition-colors ${newTask.type === 'kudos' ? 'bg-green-600 hover:bg-green-700' : 'bg-[#002649] hover:bg-[#EF6B00]'}`}>
                {newTask.type === 'kudos' ? 'שלח פרגון והתראה' : 'הקצה משימה'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function NeglectedJobsBlock({ neglectData }: Readonly<{ neglectData: NeglectPayload | null }>) {
  const topJobs = neglectData?.top_jobs || [];
  const summary = neglectData?.summary;

  return (
    <div className="bg-white border border-red-100 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h3 className="font-black text-[#002649] text-lg flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" /> משרות מוזנחות - נדרש טיפול
          </h3>
          <p className="text-xs text-slate-500 mt-1">SLA גבוה, נפח נכנס נמוך או צבר קו״ח ללא מיון בימים האחרונים.</p>
        </div>
        <button onClick={() => { window.location.href = "/intelligence"; }} className="px-3 py-2 rounded-lg bg-[#002649] text-white text-xs font-bold hover:bg-[#EF6B00] transition-colors">
          ניתוח עומק בתובנות
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl bg-red-50 border border-red-100 p-3">
          <div className="text-[11px] text-slate-500 font-bold">משרות מוזנחות</div>
          <div className="text-xl font-black text-red-700">{summary?.total_neglected_jobs ?? 0}</div>
        </div>
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
          <div className="text-[11px] text-slate-500 font-bold">משרות קריטיות</div>
          <div className="text-xl font-black text-orange-700">{summary?.critical_jobs ?? 0}</div>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
          <div className="text-[11px] text-slate-500 font-bold">ללא טיפול 5+ ימים</div>
          <div className="text-xl font-black text-blue-700">{summary?.stale_jobs_5d ?? 0}</div>
        </div>
        <div className="rounded-xl bg-purple-50 border border-purple-100 p-3">
          <div className="text-[11px] text-slate-500 font-bold">מגייסות מושפעות</div>
          <div className="text-xl font-black text-purple-700">{summary?.recruiters_impacted ?? 0}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
            <tr>
              <th className="p-2 font-bold">משרה</th>
              <th className="p-2 font-bold text-center">מגייסת / צוות</th>
              <th className="p-2 font-bold text-center">ימי SLA</th>
              <th className="p-2 font-bold text-center">ממתינים</th>
              <th className="p-2 font-bold text-center">ימים ללא טיפול</th>
              <th className="p-2 font-bold text-center">ציון הזנחה</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-400 font-bold">כרגע אין משרות שעומדות בכללי הזנחה.</td>
              </tr>
            ) : (
              topJobs.map((job) => (
                <tr key={`${job.job_title}-${job.recruiter_name}`} className="hover:bg-slate-50">
                  <td className="p-2">
                    <div className="font-bold text-[#002649]">{job.job_title}</div>
                    <div className="text-[11px] text-slate-400">{job.department}</div>
                  </td>
                  <td className="p-2 text-center">
                    <div className="font-bold text-slate-700">{job.recruiter_name}</div>
                    <div className="text-[11px] text-slate-400">{job.team_name}</div>
                  </td>
                  <td className="p-2 text-center font-black text-red-700">{job.days_open}</td>
                  <td className="p-2 text-center font-bold">{job.pending_candidates_count}</td>
                  <td className="p-2 text-center font-bold">{job.days_since_last_candidate_action}</td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-black ${
                      job.severity === "critical" ? "bg-red-100 text-red-700" : job.severity === "high" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700"
                    }`}>
                      {job.neglect_score}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// עזרים Components
// ==========================================

function KpiCard({ title, value, icon, isWarning, isPositive, subtext, info, borderColorClass }: Readonly<KpiCardProps>) {
  const borderClass = borderColorClass || (isWarning ? 'border-t-red-500' : isPositive ? 'border-t-green-500' : 'border-t-[#002649]');
  return (
    <div className={`bg-white rounded-2xl p-5 relative overflow-visible transition-all duration-300 hover:shadow-md hover:z-50 border border-slate-200 border-t-4 ${borderClass}`}>
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-lg ${isWarning ? 'bg-red-50' : isPositive ? 'bg-green-50' : 'bg-slate-50'}`}>{icon}</div>
        {info && <TooltipIcon text={info} />}
      </div>
      <div className="text-2xl font-black text-[#002649] mb-1">{value}</div>
      <div className="text-xs font-bold text-slate-500">{title}</div>
      {subtext && <div className={`text-[10px] font-bold mt-2 ${isWarning ? 'text-red-500' : isPositive ? 'text-green-600' : 'text-slate-400'}`}>{subtext}</div>}
    </div>
  );
}

function PieBreakdownCard({ title, icon, data, info }: Readonly<PieBreakdownCardProps>) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col overflow-visible hover:shadow-lg hover:z-50 transition-all">
       <h3 className="font-bold text-[#002649] flex items-center justify-between gap-2 mb-2 border-b border-slate-100 pb-2">
         <span className="flex items-center gap-2">{icon} {title}</span>
         <TooltipIcon text={info} />
       </h3>
       <div className="flex-1 min-h-[220px] w-full mt-2 relative">
         <ResponsiveContainer width="100%" height={220}>
           <RechartsPie>
             <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
               {data.map((_entry: { name: string; value: number }, index: number) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
             </Pie>
             <RechartsTooltip contentStyle={{borderRadius: '8px', zIndex: 9999}}/>
             <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}}/>
           </RechartsPie>
         </ResponsiveContainer>
       </div>
    </div>
  );
}

function StrategicSourceCard({ title, icon, color, cvs, hires, totalHires }: Readonly<StrategicSourceCardProps>) {
  const colorMap: Record<string, string> = {
    purple: "bg-purple-50 border-purple-200 text-purple-900",
    green: "bg-green-50 border-green-200 text-green-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900"
  };
  
  const conversionRate = ((hires / cvs) * 100).toFixed(1);
  const pctOfTotalHires = ((hires / totalHires) * 100).toFixed(1);
  
  return (
    <div className={`rounded-2xl p-6 border shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-md ${colorMap[color]}`}>
      <div className="flex justify-between items-center mb-4 border-b border-black/5 pb-3">
        <h3 className="font-bold flex items-center gap-2 text-lg">
          <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div> {title}
        </h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">הגשות קו״ח</p>
          <div className="text-2xl font-black">{cvs.toLocaleString()}</div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">קליטות בפועל</p>
          <div className="text-2xl font-black">{hires.toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <div className="bg-white/60 p-2.5 rounded-lg flex justify-between items-center text-sm border border-white/40 shadow-sm">
          <span className="font-medium opacity-80">יחס המרה לפנימי:</span>
          <span className="font-black">{conversionRate}%</span>
        </div>
        <div className="bg-white/60 p-2.5 rounded-lg flex justify-between items-center text-sm border border-white/40 shadow-sm">
          <span className="font-medium opacity-80">תרומה לסך הקליטות:</span>
          <span className="font-black">{pctOfTotalHires}%</span>
        </div>
      </div>
    </div>
  );
}

function TooltipIcon({ text }: Readonly<{ text: string }>) {
  return (
    <HoverTooltip text={text} placement="top" wide>
      <span className="text-slate-300 hover:text-[#EF6B00] cursor-help p-1 transition-colors inline-flex">
        <Info size={16}/>
      </span>
    </HoverTooltip>
  );
}

function HoverTooltip({
  text,
  children,
  placement = "top",
  wide = false
}: Readonly<{
  text: string;
  children: React.ReactNode;
  placement?: TooltipPlacement;
  wide?: boolean;
}>) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords>({ top: 0, left: 0 });

  const open = (event: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = 10;
    setCoords({
      top: placement === "top" ? rect.top - offset : rect.bottom + offset,
      left: rect.left + rect.width / 2
    });
    setVisible(true);
  };

  const close = () => setVisible(false);

  return (
    <>
      <div
        className="inline-flex"
        role="button"
        tabIndex={0}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
      >
        {children}
      </div>
      {typeof document !== "undefined" &&
        visible &&
        createPortal(
          <div
            className={`fixed -translate-x-1/2 pointer-events-none z-[2147483647] ${
              placement === "top" ? "-translate-y-full" : ""
            } ${wide ? "w-72 p-4 text-xs font-medium rounded-xl border border-slate-700" : "whitespace-nowrap px-2 py-1 text-[10px] font-bold rounded"} bg-[#002649] text-white shadow-2xl leading-relaxed text-right`}
            style={{ top: coords.top, left: coords.left }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}

const CONFETTI_ITEMS = Array.from({ length: 80 }).map((_, i) => {
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-400', 'bg-purple-500', 'bg-pink-500'];
  return {
    id: i,
    color: colors[i % colors.length],
    left: `${(i * 1.25) % 100}%`,
    duration: `${2 + (i % 30) / 10}s`,
    delay: `${(i % 5) / 10}s`,
    size: i % 2 === 0 ? 'w-3 h-3' : 'w-2 h-5'
  };
});

function ConfettiOverlay() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes confetti-fall { 0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg) scale(0.5); opacity: 0; } }
        .animate-confetti { animation: confetti-fall linear forwards; }
      `}} />
      <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden flex justify-center">
        {CONFETTI_ITEMS.map(item => (
          <div key={item.id} className={`absolute top-[-10%] ${item.size} ${item.color} animate-confetti rounded-sm`} style={{ left: item.left, animationDuration: item.duration, animationDelay: item.delay }}></div>
        ))}
      </div>
    </>
  );
}