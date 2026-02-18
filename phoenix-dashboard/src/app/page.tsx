"use client";

import React, { useEffect, useMemo, useState } from "react";
import { 
  Users, CheckCircle, Clock, AlertTriangle, BarChart3, 
  Filter, Target, ShieldCheck, Briefcase, UserCheck, 
  Activity, Layers, Bell, CheckCircle2, Archive, Trophy,
  ThumbsUp, Send, Plus, Trash2, Info, 
  PieChart, Percent, UserMinus, ArrowDownToLine, Zap,
  ChevronDown, ChevronUp, ArrowUpDown, BadgeDollarSign,
  ArrowRightLeft, Linkedin, RotateCcw, ArrowRight
} from "lucide-react";
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart as RechartsPie, Pie, Cell } from 'recharts';

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

// --- Roles & Meta ---
const ROLES = [
  { id: "admin", title: "מנהל.ת גיוס (אדמין)", icon: <ShieldCheck size={16} /> },
  { id: "recruiter", title: "מגייס.ת (מור)", icon: <UserCheck size={16} /> },
  { id: "hrbp", title: "HRBP / מנהל.ת מחלקה", icon: <Briefcase size={16} /> },
  { id: "hiring_manager", title: "מנהל.ת מגייס.ת", icon: <Target size={16} /> }
];

const FILTERS_META = {
  departments: ["R&D", "Sales & Service", "Finance", "Marketing", "HR"],
  jobs: ["אנליסט נתונים", "מפתח Backend Java", "נציג/ת מכירות", "מנהל/ת מוצר", "ראש צוות R&D"],
  recruiters: ["מור אהרון", "ליטל גולדפרב", "גיא רג'ואן", "רז בר-און", "אביב כהן"]
};

// --- Mock Data: AI Tasks ---
const INITIAL_AI_TASKS = [
  { id: "t1", severity: "high", tags: ["AI Insight", "SLA"], title: "משרה אדומה - אנליסט נתונים", desc: "המשרה פתוחה 45 ימים (מעל תקן). נוצל 100% מתקציב הקמפיין ללא הגעה ליעד ראיונות.", assignee: "ליטל גולדפרב", status: "open", time: "לפני שעתיים" },
  { id: "t2", severity: "positive", tags: ["AI Performance", "שימור"], title: "שיא שבועי בראיונות טלפוניים!", desc: "גיא קיים השבוע 24 ראיונות טלפוניים, עלייה של 30% ביחס לממוצע החודשי שלו. מגמה חיובית מאוד במשפך ה-R&D.", assignee: "גיא רג'ואן", status: "open", time: "היום בבוקר" },
  { id: "t3", severity: "medium", tags: ["AI Insight", "Ghosting"], title: "מועמד בסיכון נטישה (Ghosting)", desc: "המועמד דניאל כהן סיים ראיון HR לפני 14 יום. ממתין למשוב ממנהל מקצועי (R&D).", assignee: "מור אהרון", status: "open", time: "אתמול" }
];

// --- Mock Data: Secondary Analytics ---
const recruiterLeaderboard = [ 
  { name: 'מור', hires: 4, active_jobs: 14, avg_sla: 28, score: 95 }, 
  { name: 'גיא', hires: 5, active_jobs: 12, avg_sla: 25, score: 92 }, 
  { name: 'רז', hires: 3, active_jobs: 18, avg_sla: 31, score: 88 }, 
  { name: 'ליטל', hires: 1, active_jobs: 15, avg_sla: 42, score: 70 } 
];

const rejectReasons = [ { name: "שכר נמוך מהשוק", value: 45 }, { name: "גמישות/היברידי", value: 25 }, { name: "רילוקיישן/מרחק", value: 15 }, { name: "אחר", value: 15 } ];
const withdrawReasons = [ { name: "הצעה מתחרה", value: 50 }, { name: "שכר נמוך", value: 20 }, { name: "תהליך ארוך מדי", value: 20 }, { name: "אחר", value: 10 } ];
const attritionReasons = [ { name: "שכר ותנאים", value: 40 }, { name: "חוסר אופק קידום", value: 30 }, { name: "מנהל ישיר", value: 20 }, { name: "אישי/רילוקיישן", value: 10 } ];
const PIE_COLORS = ['#EF6B00', '#002649', '#64748B', '#cbd5e1'];

const sourcesData = [
  { category: "חברות השמה", cvs: 150, phone: 45, hires: 5, cph: "₪28,000", sources: [
    { name: "נישה פלייסמנט", cvs: 80, phone: 25, hires: 3, cph: "₪30,000" },
    { name: "GotFriends", cvs: 70, phone: 20, hires: 2, cph: "₪25,000" }
  ]},
  { category: "אתרי דרושים", cvs: 1200, phone: 80, hires: 2, cph: "₪4,500", sources: [
    { name: "AllJobs", cvs: 800, phone: 50, hires: 1, cph: "₪6,000" },
    { name: "Drushim", cvs: 400, phone: 30, hires: 1, cph: "₪3,000" }
  ]},
  { category: "מקורות אורגניים", cvs: 450, phone: 120, hires: 14, cph: "₪1,200", sources: [
    { name: "חבר מביא חבר", cvs: 150, phone: 60, hires: 9, cph: "₪3,500" },
    { name: "LinkedIn (אורגני)", cvs: 200, phone: 40, hires: 3, cph: "₪0" },
    { name: "אתר קריירה", cvs: 100, phone: 20, hires: 2, cph: "₪0" }
  ]}
];

const activeJobsRanking = [
  { job: "מפתח Backend Java", cvs: 145, status: "תקין" },
  { job: "מנהל/ת מוצר", cvs: 85, status: "תקין" },
  { job: "אנליסט נתונים", cvs: 32, status: "אזהרה" },
  { job: "נציג/ת מכירות - מוקד", cvs: 12, status: "קריטי" },
  { job: "ראש צוות R&D", cvs: 4, status: "קריטי" }
];

// --- Dynamic Slogans ---
const SLOGANS = [
  "כיף לראות אותך, מה יעניין אותך לחקור איתי היום?",
  "הקפה מוכן? ☕ בוא נצלול לנתונים...",
  "עוד יום, עוד הזדמנות לשבור שיאי גיוס!",
  "האלגוריתם עבד כל הלילה, יש לנו תובנות חמות בשבילך 🔥",
  "מוכן למצוא את הטאלנט הבא של הפניקס?",
  "מספרים לא משקרים, אבל הם בהחלט מספרים סיפור 📖",
  "מאחורי כל גרף מסתתר עובד (או מועמד שסינן אותנו 😉)",
  "זמן מעולה לקבל החלטות מבוססות דאטה 🎯"
];

export default function DashboardPage() {
  const [currentRole, setCurrentRole] = useState("admin"); 
  const [tasks, setTasks] = useState(INITIAL_AI_TASKS);
  
  // Greeting Engine
  const [slogan, setSlogan] = useState("");
  const [greeting, setGreeting] = useState({ text: "בוקר טוב", icon: "🌅" });

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
  const [newTask, setNewTask] = useState({ title: "", desc: "", assignee: "מור אהרון", severity: "medium", type: "task" });

  useEffect(() => {
    // Random Slogan
    setSlogan(SLOGANS[Math.floor(Math.random() * SLOGANS.length)]);
    
    // Time of day logic
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting({ text: "בוקר טוב", icon: "🌅" });
    else if (hour >= 12 && hour < 17) setGreeting({ text: "צהריים טובים", icon: "☀️" });
    else if (hour >= 17 && hour < 21) setGreeting({ text: "ערב טוב", icon: "🌇" });
    else setGreeting({ text: "לילה טוב", icon: "🌙" });
  }, []);

  // --- Dynamic Live Data (Slicers Engine) - computed via useMemo (deterministic seed for purity) ---
  type ChartPoint = { name: string; candidates: number; compCandidates?: number };
  const kpis = useMemo(() => {
    const deptFactor = department !== 'all' ? 0.4 : 1;
    const jobFactor = job !== 'all' ? 0.15 : 1;
    const recFactor = recruiter !== 'all' ? 0.25 : 1;
    const timeFactor = timeframe === 'year' ? 12 : timeframe === 'q1' ? 3 : timeframe === 'week' ? 0.25 : 1;
    const factor = deptFactor * jobFactor * recFactor * timeFactor;
    const seed = (timeframe.length + department.length * 7 + job.length * 31 + recruiter.length * 13) % 100 / 100;
    const e2eNoise = 1 + (seed * 0.1 - 0.05);
    return {
      hires: Math.max(1, Math.floor(28 * factor)),
      attrition: Math.max(0, Math.floor(4 * factor)),
      applications: Math.max(10, Math.floor(8400 * factor)),
      e2e: Number((0.33 * e2eNoise).toFixed(2)),
      ttf: Math.max(12, Math.floor(34 * (1.1 - factor * 0.1))),
      oar: Math.min(100, Math.floor(84 * (1 + factor * 0.05))),
      cph: Math.max(1500, Math.floor(7820 * (1.2 - factor * 0.2))),
      ghosting: Math.max(0, Math.floor(3 * factor))
    };
  }, [timeframe, department, job, recruiter]);

  const dynamicChart = useMemo<ChartPoint[]>(() => {
    const deptFactor = department !== 'all' ? 0.4 : 1;
    const jobFactor = job !== 'all' ? 0.15 : 1;
    const recFactor = recruiter !== 'all' ? 0.25 : 1;
    const timeFactor = timeframe === 'year' ? 12 : timeframe === 'q1' ? 3 : timeframe === 'week' ? 0.25 : 1;
    const factor = deptFactor * jobFactor * recFactor * timeFactor;
    const seed = (timeframe.length + department.length * 7 + job.length * 31 + recruiter.length * 13) % 100 / 100;
    const noise = 1 + seed * 0.2;
    return [
      { name: "נק' 1", candidates: Math.floor(120 * factor * noise), compCandidates: Math.floor(100 * factor * noise) },
      { name: "נק' 2", candidates: Math.floor(180 * factor * noise), compCandidates: Math.floor(150 * factor * noise) },
      { name: "נק' 3", candidates: Math.floor(140 * factor * noise), compCandidates: Math.floor(160 * factor * noise) },
      { name: "נק' 4", candidates: Math.floor(210 * factor * noise), compCandidates: Math.floor(190 * factor * noise) }
    ];
  }, [timeframe, department, job, recruiter]);

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
    
    // Simulate inactivity warning
    if (currentRole === "recruiter" && !notifications.some(n => n.type === 'warning')) {
      addNotification("recruiter", "לא נכנסת כבר 3 ימים למערכת. נוכחותך הרציפה נדרשת על מנת למנוע חריגות SLA, לשמור על חוויית מועמד, ולעמוד ביעדי המחלקה.", "warning");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole]);

  // --- Actions ---
  const handleTaskAction = (id: string, action: string, task: AITask) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: action } : t));
    if (action === 'done' && currentRole === 'recruiter') addNotification('admin', `מור אהרון השלימה משימה: ${task.title}`, 'success');
  };

  const handleKudos = (task: AITask) => {
    handleTaskAction(task.id, 'done', task); 
    addNotification(task.assignee === 'מור אהרון' ? 'recruiter' : 'other', `קיבלת פרגון מאביב! ${task.title}`, 'kudos');
  };

  const handleCreateManualTask = () => {
    if (!newTask.title) return;
    const isKudos = newTask.type === "kudos";
    const task = { id: `m-${Date.now()}`, severity: isKudos ? "positive" : newTask.severity, tags: ["ידני", isKudos ? "שימור" : "משימת מנהל"], title: newTask.title, desc: newTask.desc, assignee: newTask.assignee, status: "open", time: "עכשיו" };
    setTasks([task, ...tasks]);
    addNotification(newTask.assignee === 'מור אהרון' ? 'recruiter' : 'other', isKudos ? `קיבלת פרגון חדש מאביב: ${task.title}` : `משימה חדשה מאביב: ${task.title}`, isKudos ? 'kudos' : 'ping');
    setIsCreatingTask(false);
    setNewTask({ title: "", desc: "", assignee: "מור אהרון", severity: "medium", type: "task" });
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

  const visibleTasks = tasks.filter(t => (viewMode === "active" ? t.status === "open" : t.status !== "open") && (currentRole === "admin" || (currentRole === "recruiter" && t.assignee === "מור אהרון")));
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
          <h1 className="text-4xl font-black text-[#002649] tracking-tight flex items-center gap-3">
            {greeting.text}, אביב <span className="text-4xl">{greeting.icon}</span>
          </h1>
          <p className="text-slate-500 mt-2 font-bold text-xs">
            {slogan}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-purple-50 p-1 rounded-xl border border-purple-200 shadow-sm relative">
            <span className="text-[9px] font-black text-purple-800 absolute -top-2 right-2 bg-purple-200 px-1.5 rounded shadow-sm">סימולטור הרשאות</span>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => setCurrentRole(r.id)} className={`group relative p-2 rounded-lg text-xs transition-all ${currentRole === r.id ? 'bg-white text-purple-900 shadow-sm ring-1 ring-purple-300' : 'text-purple-600 hover:bg-purple-100'}`}>
                {r.icon}
                {/* Custom Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-[#002649] text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-[9999]">
                   {r.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- GLOBAL SLICERS (REFINED) --- */}
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
          {currentRole !== "hrbp" && FILTERS_META.departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select className="bg-slate-50 hover:bg-slate-100 transition-colors border border-transparent text-slate-700 text-xs rounded-lg outline-none py-1.5 px-2 min-w-[130px] cursor-pointer" value={job} onChange={(e) => setJob(e.target.value)}>
          <option value="all">כל המשרות</option>
          {FILTERS_META.jobs.map(j => <option key={j} value={j}>{j}</option>)}
        </select>

        {currentRole === "admin" && (
          <select className="bg-slate-50 hover:bg-slate-100 transition-colors border border-transparent text-slate-700 text-xs rounded-lg outline-none py-1.5 px-2 min-w-[130px] cursor-pointer" value={recruiter} onChange={(e) => setRecruiter(e.target.value)}>
            <option value="all">כל המגייסים</option>
            {FILTERS_META.recruiters.map(r => <option key={r} value={r}>{r}</option>)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard title="סה״כ קליטות בפועל" value={kpis.hires} icon={<CheckCircle className="text-green-600" size={20}/>} borderColorClass="border-t-green-500" subtext={compareMode !== 'none' ? "⬆️ גידול של 15% בהשוואה" : null} 
            info="מניית כל המועמדים שסטטוס ה-ATS שלהם השתנה ל'קליטה' או 'גיוס' בטווח התאריכים והסינונים שנבחרו." />
          
          <KpiCard title="סה״כ עזיבות (Attrition)" value={kpis.attrition} isWarning={kpis.attrition > 5} icon={<UserMinus className="text-orange-500" size={20}/>} borderColorClass="border-t-orange-500" subtext={compareMode !== 'none' ? "⬇️ ירידה בנטישה בהשוואה" : null}
            info="עובדים שעזבו את הארגון בטווח הזמן שנבחר. הנתון נשאב מקובץ ה-HRIS שמוזן למערכת." />
            
          <KpiCard title="סה״כ קורות חיים" value={kpis.applications.toLocaleString()} icon={<Users className="text-blue-500" size={20}/>} borderColorClass="border-t-blue-500"
            info="נפח קורות החיים המלא שנכנס למערכת מכלל המקורות." />
            
          <KpiCard title="יחס המרה (E2E Conversion)" value={`${kpis.e2e}%`} icon={<Percent className="text-purple-500" size={20}/>} borderColorClass="border-t-purple-500" subtext="בנצ'מארק שוק: 0.5%"
            info="אחוז המועמדים שנקלטו בפועל מתוך סך קורות החיים שהוגשו (קליטות חלקי קורות חיים). מודד את איכות הסינון בערוצי המקור." />
        </div>

        {/* ROW 2: ADVANCED KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard title={currentRole === 'recruiter' ? "ימי SLA ממוצעים שלי" : "זמן איוש חציוני (TTF)"} value={`${kpis.ttf} ימים`} icon={<Clock className="text-purple-600" size={20}/>} borderColorClass="border-t-purple-600" subtext={kpis.ttf > 40 ? "חריגה מהיעד (40)" : "עמידה ביעד"} 
            info="TTF (Time to Fill): הזמן החציוני שלוקח לאייש משרה, מרגע פתיחתה במערכת ועד חתימת חוזה. חציון מנטרל משרות חריגות שנתקעו חודשים." />
          
          <KpiCard title="אחוז חתימת חוזים (OAR)" value={`${kpis.oar}%`} isPositive={kpis.oar >= 80} isWarning={kpis.oar < 80} icon={<Activity className="text-green-600" size={20}/>} borderColorClass="border-t-green-600" subtext="בנצ'מארק שוק: 80%"
              info="Offer Acceptance Rate: כמה מתוך הצעות השכר שניתנו התקבלו ונחתמו. מדד קריטי לבחינת תחרותיות השכר של הפניקס בשוק."/>

          {currentRole === "admin" || currentRole === "hrbp" ? (
            <KpiCard title="עלות ממוצעת לאיוש (CPH)" value={`₪${kpis.cph.toLocaleString()}`} icon={<BadgeDollarSign className="text-orange-600" size={20}/>} borderColorClass="border-t-orange-600" subtext="מחושב מתוך מודול FinOps" 
              info="Cost Per Hire: סך ההוצאות הישירות והעקיפות (פרסום, השמה, רישיונות) חלקי כמות המגויסים. מודל מלא מול FinOps." />
          ) : (
            <KpiCard title="מועמדים בסיכון (Ghosting)" value={kpis.ghosting} isWarning={kpis.ghosting > 0} icon={<AlertTriangle className="text-red-600" size={20}/>} borderColorClass="border-t-red-600" subtext="ממתינים לתשובה מעל 14 יום" 
              info="ספירת מועמדים פעילים שנמצאים ללא תזוזת סטטוס במערכת מעל לשבועיים, ועלולים לנטוש את התהליך." />
          )}

          {currentRole === "admin" && (
            <KpiCard title="איכות הגיוס (Quality of Hire)" value="92%" isPositive={true} icon={<Trophy className="text-yellow-500" size={20}/>} borderColorClass="border-t-yellow-500" subtext="אחוז הישרדות מעל שנה" 
              info="הגביע הקדוש של הגיוס: מודד איזה אחוז מהמגויסים נשארו בארגון למעלה משנה (Retention). מצליב נתוני ATS ישירות עם נתוני HRIS." />
          )}
        </div>

        {/* ROW 3: PIPELINE & FUNNEL */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 h-[400px] flex flex-col shadow-sm hover:shadow-lg hover:z-50 transition-all">
            <h3 className="font-bold text-[#002649] flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><BarChart3 size={18} className="text-[#EF6B00]"/> נפח מועמדים לאורך זמן</div>
              {compareMode !== 'none' && <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">משווה: {getPrimaryName()} מול {getCompareName()}</div>}
            </h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
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
              {[
                { stage: "קורות חיים", count: kpis.applications, pct: 100, color: "bg-[#002649]", drop: null },
                { stage: "סינון / ראיון טלפוני", count: Math.floor(kpis.applications * 0.25), pct: 25, color: "bg-blue-800", drop: "-5%" },
                { stage: "ראיון HR / מקצועי", count: Math.floor(kpis.applications * 0.10), pct: 10, color: "bg-blue-600", drop: "-11%" },
                { stage: "הצעות שכר", count: Math.floor(kpis.hires * 1.5), pct: 2.1, color: "bg-blue-400", drop: "+4%" },
                { stage: "קליטות בארגון", count: kpis.hires, pct: 1.7, color: "bg-green-500", drop: "+2%" }
              ].map((s, i) => (
                <div key={i} className="relative">
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1 z-10 relative px-1"><span>{s.stage}</span><span>{s.count.toLocaleString()} ({s.pct}%)</span></div>
                  <div className="w-full bg-slate-100 h-6 rounded-lg overflow-hidden group"><div className={`h-full ${s.color} transition-all duration-1000`} style={{width: `${s.pct}%`}}></div></div>
                  {compareMode !== 'none' && s.drop && <div className={`absolute -bottom-2.5 left-4 text-[9px] font-black px-1.5 rounded border ${s.drop.includes('-') ? 'bg-red-50 text-red-600 border-red-200 z-20 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 z-20'}`}>{s.drop} בהשוואה</div>}
                </div>
              ))}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8">
               <StrategicSourceCard title="ניוד פנימי" icon={<ArrowRightLeft className="text-purple-600"/>} color="purple" cvs={45} hires={5} totalHires={kpis.hires} />
               <StrategicSourceCard title="חבר מביא חבר" icon={<Users className="text-green-600"/>} color="green" cvs={150} hires={9} totalHires={kpis.hires} />
               <StrategicSourceCard title="לינקדאין (אורגני וממומן)" icon={<Linkedin className="text-blue-600"/>} color="blue" cvs={200} hires={3} totalHires={kpis.hires} />
            </div>

          </div>
        )}

        {/* ROW 5: REASONS BREAKDOWN (3 PIES) */}
        {(currentRole === "admin" || currentRole === "hrbp") && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8">
            <PieBreakdownCard title="סיבות דחיית מועמדים" icon={<UserMinus size={18} className="text-orange-500"/>} data={rejectReasons} info="מדוע אנחנו דחינו מועמדים? עוזר לדייק דרישות משרה." />
            <PieBreakdownCard title="סיבות הסרת מועמדות" icon={<AlertTriangle size={18} className="text-red-500"/>} data={withdrawReasons} info="מדוע מועמדים פרשו מהתהליך בעצמם? חיוני לזיהוי בעיות שכר." />
            <PieBreakdownCard title="סיבות עזיבת עובדים" icon={<ArrowDownToLine size={18} className="text-purple-500"/>} data={attritionReasons} info="מדוע עובדים חדשים עזבו בשנה הראשונה? (מידע מ-HRIS)." />
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
                              <button onClick={() => addNotification(task.assignee === 'מור אהרון' ? 'recruiter' : 'other', `נשלחה אליך תזכורת מאביב לטיפול ב: ${task.title}`, 'ping')} className="p-2 text-orange-500 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors tooltip-trigger" title="שלח תזכורת למגייס (Ping)">
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
         <ResponsiveContainer width="100%" height="100%">
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
    <div className="relative group flex items-center justify-center">
      <div className="text-slate-300 hover:text-[#EF6B00] cursor-help p-1 transition-colors">
        <Info size={16}/>
      </div>
      <div className="absolute bottom-full right-0 mb-3 w-72 p-4 bg-[#002649] text-white text-xs font-medium rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] border border-slate-700 leading-relaxed text-right pointer-events-none">
        {text}
        <div className="absolute top-full right-4 border-8 border-transparent border-t-[#002649]"></div>
      </div>
    </div>
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