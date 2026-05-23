"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useToast } from "@/components/Toast";
import { AdminConfigProvider, useAdminConfig } from "@/app/admin/components/targets/useAdminConfig";
import { formatDateHe } from "@/lib/dates";
import { getAdminHeaders, getApiBaseUrl } from "@/lib/api";
import { useAccess } from "@/context/AccessContext";
import { canMutateData } from "@/lib/access-control";
import {
  Briefcase, Search, Download, TrendingUp, TrendingDown,
  LayoutGrid, List, MoreVertical, Mail, Zap, MessageSquare,
  Check, Settings, X, Save, RotateCcw, Info, Calculator, Users, PieChart, Plus
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { JobSidePanel } from "@/components/JobSidePanel";
import JobCreateModal from "@/components/JobCreateModal";
import { STAGE_ORDER, getStageMeta, type UnifiedStage } from "@/lib/stages";
import { useDataVersion, useDataVersionRefresh } from "@/context/DataVersionContext";

interface Job {
  id: string; title: string; dept: string; type: string; recruiter: string;
  coordinator: string; openDate: string; status: string; candidates: number;
  activeInProcess: number; newCVsWeek: number; offersSent: number;
  isCritical: boolean; sla: number; prevScore: number; closeDate?: string;
  /** Per-unified-stage candidate count (SCREEN/INTERVIEW/OFFER/HIRED/...). */
  stageBreakdown?: Record<string, number>;
  /** Free-text reason captured from applications.status when the job is closed. */
  closeReason?: string;
}

interface ScoredJob extends Job { currentScore: number }
interface SlaReminder {
  key: string;
  title: string;
  recruiter: string;
  sla: number;
  limit: number;
  severity: "near" | "breach";
}

interface AlgoConfig {
  baseSLA: Record<string, number>;
  minActive: Record<string, number>;
  criticalPenalty: number; offerBonus: number; pulseBonus: number;
  pipelinePenalty: number; threshold: number;
  overrides: { depts: Record<string, number>; recruiters: Record<string, number>; jobs: Record<string, number> };
}

// --- Mock Data ---
const INITIAL_JOBS: Job[] = [];

function JobsPageInner() {
  // Empty → same-origin (Next.js rewrites in next.config.ts proxy /jobs).
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const { config, save } = useAdminConfig();
  const strictLiveData = true;
  const [viewMode, setViewMode] = useState("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recruiterFilter, setRecruiterFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showAdmin, setShowAdmin] = useState(false);
  const [jobsData, setJobsData] = useState<Job[]>([]);
  const [liveDataError, setLiveDataError] = useState<string | null>(null);
  // Side-panel state — drill into a single job to see its candidates by stage.
  const [drillJob, setDrillJob] = useState<{ key: string; initialStage: UnifiedStage | "" } | null>(null);
  // Triggers a refetch whenever a new batch lands via /api/ingest/{type}.
  const dataVersion = useDataVersion();
  // "+ job" modal — A9-FU UX wave 3. Bumps data_version on success so the
  // jobs list refetches via the existing useEffect hook.
  const [createOpen, setCreateOpen] = useState(false);
  const refreshDataVersion = useDataVersionRefresh();
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const [selectedJobTitles, setSelectedJobTitles] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"close" | "set_status" | "assign_recruiter">("close");
  const [bulkStatus, setBulkStatus] = useState("הקפאה");
  const [bulkRecruiter, setBulkRecruiter] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const { showToast } = useToast();
  const { effectiveUser } = useAccess();
  const canEdit = canMutateData(effectiveUser.role);
  const [urlReady, setUrlReady] = useState(false);
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);

  // --- States עבור הוספת פקטור באדמין ---
  const [overrideDept, setOverrideDept] = useState("");
  const [overrideFactor, setOverrideFactor] = useState(1.1);

  // --- הגדרות אלגוריתם ---
  const [algoConfig, setAlgoConfig] = useState<AlgoConfig>({
    baseSLA: { mass: 29, pro: 44, tech: 59 },
    minActive: { mass: 18, pro: 6, tech: 5 },
    criticalPenalty: 20,
    offerBonus: 25,
    pulseBonus: 10,
    pipelinePenalty: 15,
    threshold: 60,
    overrides: { depts: { "Service": 1.1 }, recruiters: {}, jobs: {} }
  });

  useEffect(() => {
    const saved = (config as unknown as { jobsAlgo?: AlgoConfig }).jobsAlgo;
    if (saved) setAlgoConfig(saved);
  }, [config]);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        setLiveDataError(null);
        // Pass status=all so closed jobs come back too. Backend remains
        // backwards-compatible: existing consumers (like the dashboard) that
        // don't pass status still get all jobs by default.
        const res = await fetch(`${apiBase}/api/jobs?status=all`, { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error("jobs fetch failed");
        const payload: Array<Record<string, unknown>> = await res.json();
        const mapped: Job[] = payload.map((row, idx) => {
          const isActive = row.is_active !== false; // default true if missing
          const breakdown = (row.stage_breakdown as Record<string, number>) || {};
          return {
            id: String(row.job_id ?? `api-${idx + 1}`),
            title: String(row.job_title ?? ""),
            dept: String(row.department ?? "General"),
            type: "pro",
            recruiter: String(row.recruiter ?? "לא שויך"),
            coordinator: "מערכת",
            openDate: new Date().toISOString().slice(0, 10),
            status: isActive ? "open" : "closed",
            candidates: Number(row.total_candidates ?? row.active_candidates ?? 0),
            activeInProcess: Number(row.active_candidates ?? 0),
            newCVsWeek: 0,
            offersSent: Number(breakdown.OFFER ?? 0),
            isCritical: Number(row.sla_breaches ?? 0) > 0,
            sla: Number(row.avg_days ?? 0),
            prevScore: 50,
            closeDate: row.closed_at ? String(row.closed_at) : undefined,
            // Stage breakdown is rendered as inline chips below the row title.
            stageBreakdown: breakdown,
            closeReason: row.close_reason ? String(row.close_reason) : undefined,
          } as Job & { stageBreakdown?: Record<string, number>; closeReason?: string };
        });
        if (mapped.length > 0) {
          setJobsData(mapped);
        }
      } catch {
        setLiveDataError("Live jobs API unavailable");
        setJobsData([]);
      }
    };
    loadJobs();
  }, [apiBase, strictLiveData, dataVersion]);

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const view = params.get("view");
    const q = params.get("q");
    const status = params.get("status");
    const recruiter = params.get("recruiter");
    const dept = params.get("dept");
    const sort = params.get("sort");
    if (view === "table" || view === "grid") setViewMode(view);
    if (q) setSearchTerm(q);
    if (status) setStatusFilter(status);
    if (recruiter) setRecruiterFilter(recruiter);
    if (dept) setDeptFilter(dept);
    if (sort) setSortBy(sort);
    try {
      const stored = globalThis.localStorage.getItem("jobs_sla_reminders_dismissed");
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) setDismissedReminders(parsed);
      }
    } catch {
      // no-op
    }
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams(globalThis.location.search);
    params.set("view", viewMode);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    else params.delete("q");
    if (statusFilter !== "all") params.set("status", statusFilter);
    else params.delete("status");
    if (recruiterFilter !== "all") params.set("recruiter", recruiterFilter);
    else params.delete("recruiter");
    if (deptFilter !== "all") params.set("dept", deptFilter);
    else params.delete("dept");
    params.set("sort", sortBy);
    const query = params.toString();
    const nextUrl = query ? `${globalThis.location.pathname}?${query}` : globalThis.location.pathname;
    globalThis.history.replaceState(null, "", nextUrl);
  }, [viewMode, searchTerm, statusFilter, recruiterFilter, deptFilter, sortBy, urlReady]);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setRecruiterFilter("all");
    setDeptFilter("all");
    setSortBy("newest");
  };

  const handleExport = () => {
    const escapeCsvValue = (value: string | number) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
    const headers = "ID,Title,Status,Dept,Recruiter,SLA,Candidates,HealthScore\n";
    const rows = filteredJobs.map((j) => [
      escapeCsvValue(j.id),
      escapeCsvValue(j.title),
      escapeCsvValue(j.status),
      escapeCsvValue(j.dept),
      escapeCsvValue(j.recruiter),
      escapeCsvValue(j.sla),
      escapeCsvValue(j.candidates),
      escapeCsvValue(`${j.currentScore}%`),
    ].join(","));
    const blob = new Blob(["\ufeff" + headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Phoenix_TAHub_Jobs.csv";
    link.click();
  };

  // הוספת ומחיקת פקטור באדמין
  const addOverride = () => {
    if (!overrideDept) return;
    setAlgoConfig({
        ...algoConfig,
        overrides: {
            ...algoConfig.overrides,
            depts: { ...algoConfig.overrides.depts, [overrideDept]: overrideFactor }
        }
    });
    setOverrideDept("");
    setOverrideFactor(1.1);
  };

  const removeOverride = (dept: string) => {
    const newDepts = { ...algoConfig.overrides.depts };
    delete newDepts[dept];
    setAlgoConfig({
        ...algoConfig,
        overrides: { ...algoConfig.overrides, depts: newDepts }
    });
  };

  // --- ליבת האלגוריתם (5 פרמטרים) ---
  const calculateHealthScore = (job: Job) => {
    if (job.status === 'closed') return 0;
    let score = 100;
    
    // 1. קנס SLA (2 נק' לכל יום חריגה)
    const limit = algoConfig.baseSLA[job.type] || 30;
    if (job.sla > limit) score -= (job.sla - limit) * 2;
    
    // 2. קנס צינור מועמדים פעיל
    const minNeeded = algoConfig.minActive[job.type] || 5;
    if (job.activeInProcess < minNeeded) score -= algoConfig.pipelinePenalty;
    
    // 3. בונוס דופק קו"ח השבוע
    if (job.newCVsWeek > 10) score += algoConfig.pulseBonus;
    
    // 4. בונוס הצעת חוזה
    if (job.offersSent > 0) score += algoConfig.offerBonus;
    
    // 5. קנס משרה קריטית
    if (job.isCritical) score -= algoConfig.criticalPenalty;
    
    // פקטור החרגות (יחידות ארגוניות)
    const deptFactor = algoConfig.overrides.depts[job.dept] || 1;
    score = score * deptFactor;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getScoreColor = (score: number) => {
    if (score > 80) return "text-green-600 bg-green-50 border-green-100";
    if (score >= algoConfig.threshold) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-red-600 bg-red-50 border-red-100";
  };

  const filteredJobs = useMemo(() => {
    let result = jobsData.map(j => ({ ...j, currentScore: calculateHealthScore(j) }));
    if (normalizedSearch) {
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(normalizedSearch) ||
          j.id.toLowerCase().includes(normalizedSearch)
      );
    }
    if (statusFilter !== "all") result = result.filter(j => j.status === statusFilter);
    if (recruiterFilter !== "all") result = result.filter(j => j.recruiter === recruiterFilter);
    if (deptFilter !== "all") result = result.filter(j => j.dept === deptFilter);

    result.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.openDate).getTime() - new Date(a.openDate).getTime();
      if (sortBy === "oldest") return new Date(a.openDate).getTime() - new Date(b.openDate).getTime();
      if (sortBy === "sla_high") return b.sla - a.sla;
      if (sortBy === "sla_low") return a.sla - b.sla;
      if (sortBy === "score_low") return a.currentScore - b.currentScore;
      return 0;
    });
    return result;
  }, [jobsData, normalizedSearch, statusFilter, recruiterFilter, deptFilter, sortBy, algoConfig]);

  const velocityForecast = useMemo(() => {
    const openJobs = jobsData.filter((j) => j.status === "open");
    const avgSla = openJobs.length ? Math.round(openJobs.reduce((sum, job) => sum + job.sla, 0) / openJobs.length) : 0;
    const avgActive = openJobs.length ? Math.round(openJobs.reduce((sum, job) => sum + job.activeInProcess, 0) / openJobs.length) : 0;
    const weeklyCloseCapacity = Math.max(1, Math.round(avgActive / 3));
    const etaWeeks = weeklyCloseCapacity > 0 ? Math.ceil(openJobs.length / weeklyCloseCapacity) : 0;
    return {
      openJobs: openJobs.length,
      avgSla,
      weeklyCloseCapacity,
      etaWeeks,
    };
  }, [jobsData]);

  const smartReminders = useMemo<SlaReminder[]>(() => {
    return jobsData
      .filter((job) => job.status === "open")
      .map((job) => {
        const limit = algoConfig.baseSLA[job.type] || 30;
        const severity: "near" | "breach" | null =
          job.sla > limit ? "breach" : job.sla >= Math.ceil(limit * 0.85) ? "near" : null;
        if (!severity) return null;
        return {
          key: `${job.id}:${severity}`,
          title: job.title,
          recruiter: job.recruiter,
          sla: job.sla,
          limit,
          severity,
        } satisfies SlaReminder;
      })
      .filter((item): item is SlaReminder => item !== null)
      .filter((item) => !dismissedReminders.includes(item.key))
      .sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === "breach" ? -1 : 1;
        return b.sla - a.sla;
      })
      .slice(0, 5);
  }, [jobsData, algoConfig.baseSLA, dismissedReminders]);

  const dismissReminder = (key: string) => {
    setDismissedReminders((prev) => {
      const next = [...prev, key];
      globalThis.localStorage.setItem("jobs_sla_reminders_dismissed", JSON.stringify(next));
      return next;
    });
  };

  const snoozeReminder = (key: string) => {
    dismissReminder(key);
    showToast("התזכורת נדחתה לשלב זה", "success");
  };

  const sendReminderMail = (jobTitle: string, recruiter: string, sla: number, limit: number) => {
    const subject = encodeURIComponent(`תזכורת SLA: ${jobTitle}`);
    const body = encodeURIComponent(
      `היי,\n\nתזכורת אוטומטית ממערכת TAHub:\n` +
      `המשרה "${jobTitle}" נמצאת על SLA ${sla} ימים (יעד: ${limit}).\n\n` +
      `נדרש עדכון סטטוס ופעולה לקידום הגיוס.\n\nתודה,\nTAHub`
    );
    globalThis.location.href = `mailto:?subject=${subject}&body=${body}`;
    showToast(`נפתחה טיוטת מייל למשרה ${jobTitle}`, "success");
  };

  const toggleSelectAllJobs = () => {
    if (selectedJobTitles.length === filteredJobs.length) {
      setSelectedJobTitles([]);
      return;
    }
    setSelectedJobTitles(filteredJobs.map((j) => j.title));
  };

  const toggleSelectOneJob = (title: string) => {
    setSelectedJobTitles((prev) => (prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title]));
  };

  const applyBulkJobsAction = async () => {
    if (!canEdit) return;
    if (selectedJobTitles.length === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/jobs/bulk-update`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          job_titles: selectedJobTitles,
          action: bulkAction,
          status: bulkAction === "set_status" ? bulkStatus : undefined,
          recruiter: bulkAction === "assign_recruiter" ? bulkRecruiter.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error("bulk jobs update failed");
      setJobsData((prev) =>
        prev.map((job) => {
          if (!selectedJobTitles.includes(job.title)) return job;
          if (bulkAction === "close") return { ...job, status: "closed" };
          if (bulkAction === "assign_recruiter") return { ...job, recruiter: bulkRecruiter.trim() || job.recruiter };
          return job;
        }),
      );
      showToast("פעולה גורפת נשמרה בהצלחה", "success");
      setSelectedJobTitles([]);
    } catch {
      showToast("פעולה גורפת נכשלה", "error");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/30 pb-20 text-right overflow-x-hidden" dir="rtl">
      
      {/* --- Header (uniform PageHeader, sidebar-matching PieChart icon) --- */}
      <div className="max-w-[1600px] mx-auto px-8 pt-6">
        <PageHeader
          icon={<PieChart size={28} strokeWidth={1.75} />}
          title="ניהול משרות ותקנים"
          subtitle="הצלבת נתוני ATS (פתוחות) מול דוח קליטות (סגורות) + דירוג בריאות חכם"
          actions={
            <div className="flex items-center gap-3">
            <button onClick={() => setCreateOpen(true)} className="bg-[#002649] text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#EF6B00] transition-all shadow-sm">
                <Plus size={16} /> משרה חדשה
            </button>
            <button onClick={() => setShowAdmin(true)} className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-[#EF6B00] transition-all shadow-sm flex items-center gap-2 font-bold text-sm">
                <Settings size={18} /> הגדרות אלגוריתם
            </button>
            <button onClick={resetFilters} className="p-2.5 text-slate-400 hover:text-red-500 transition-all font-bold text-sm flex items-center gap-1 bg-slate-50 rounded-xl border border-transparent hover:border-red-100">
                <RotateCcw size={16} /> נקה
            </button>
            <div className="flex bg-white border rounded-xl p-1 shadow-sm mx-1">
                <button onClick={() => setViewMode("table")} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-[#002649] text-white' : 'text-slate-400'}`}><List size={18} /></button>
                <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#002649] text-white' : 'text-slate-400'}`}><LayoutGrid size={18} /></button>
            </div>
            <button onClick={handleExport} className="bg-[#002649] text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#EF6B00] transition-all shadow-lg">
                <Download size={18} /> ייצוא רשימה
            </button>
            </div>
          }
        />
      </div>

      {/* Manual job-create form — replaces the Excel round-trip for the
          single-row case. Bumps data_version on success. */}
      <JobCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { void refreshDataVersion(); }}
      />

      <div className="max-w-[1600px] mx-auto px-8 mt-4 space-y-6">
        {/* --- סרגל סינון --- */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="חפש משרה או קוד..." className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#EF6B00] text-sm font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <select className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">כל הסטטוסים</option>
              <option value="open">🟢 משרות פתוחות</option>
              <option value="closed">⚪ משרות שנסגרו</option>
            </select>
            <select className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none" value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)}>
              <option value="all">כל המגייסים</option>
              {Array.from(new Set(jobsData.map(j => j.recruiter))).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="all">כל החטיבות</option>
              {Array.from(new Set(jobsData.map(j => j.dept))).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="bg-[#002649] text-white p-2.5 rounded-xl text-sm font-bold outline-none cursor-pointer" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">📅 הכי חדש</option>
              <option value="oldest">⌛ הכי ישן</option>
              <option value="sla_high">🔥 SLA גבוה (חריגה)</option>
              <option value="score_low">❤️ משרות &quot;חולות&quot; תחילה</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        {!canEdit && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
            מצב צפייה בלבד פעיל עבור התפקיד הנוכחי. פעולות עריכה נחסמו.
          </div>
        )}
        {smartReminders.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-black text-amber-800">תזכורות SLA חכמות</div>
              <div className="text-[11px] font-bold text-amber-700">{smartReminders.length} לטיפול</div>
            </div>
            <div className="space-y-2">
              {smartReminders.map((item) => (
                <div key={item.key} className="rounded-xl border border-amber-100 bg-white px-3 py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-800">
                      {item.title} · {item.recruiter}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500">
                      SLA {item.sla} ימים / יעד {item.limit} · {item.severity === "breach" ? "חריגה" : "מתקרב לחריגה"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => sendReminderMail(item.title, item.recruiter, item.sla, item.limit)} disabled={!canEdit} className="px-2 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed">
                      שלח תזכורת
                    </button>
                    <button onClick={() => snoozeReminder(item.key)} disabled={!canEdit} className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">
                      דחה
                    </button>
                    <button onClick={() => dismissReminder(item.key)} disabled={!canEdit} className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed">
                      טופל
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {selectedJobTitles.length > 0 && (
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm font-black text-blue-800">{selectedJobTitles.length} משרות נבחרו</div>
            <div className="flex items-center gap-2">
              <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value as "close" | "set_status" | "assign_recruiter")} className="text-xs font-bold border border-blue-200 rounded-lg px-2 py-2 bg-white">
                <option value="close">סגירה המונית</option>
                <option value="set_status">שינוי סטטוס</option>
                <option value="assign_recruiter">שיוך מגייס</option>
              </select>
              {bulkAction === "set_status" && (
                <input value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="text-xs font-bold border border-blue-200 rounded-lg px-2 py-2 bg-white w-40" placeholder="סטטוס" />
              )}
              {bulkAction === "assign_recruiter" && (
                <input value={bulkRecruiter} onChange={(e) => setBulkRecruiter(e.target.value)} className="text-xs font-bold border border-blue-200 rounded-lg px-2 py-2 bg-white w-40" placeholder="שם מגייס/ת" />
              )}
                <button onClick={applyBulkJobsAction} disabled={bulkLoading || !canEdit} className="px-4 py-2 rounded-lg bg-[#002649] text-white text-xs font-black hover:bg-[#EF6B00] disabled:opacity-60">
                החל פעולה
              </button>
            </div>
          </div>
        )}
        {strictLiveData && liveDataError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
            מצב Live קשיח פעיל: לא נטענו נתוני משרות מהשרת ולכן התצוגה ריקה.
          </div>
        )}
        <div className="mb-4 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-3">
          <ForecastCard label="משרות פתוחות" value={`${velocityForecast.openJobs}`} />
          <ForecastCard label="SLA ממוצע" value={`${velocityForecast.avgSla} ימים`} />
          <ForecastCard label="קצב סגירה שבועי חזוי" value={`${velocityForecast.weeklyCloseCapacity} משרות`} />
          <ForecastCard label="ETA לסגירת הצבר" value={velocityForecast.etaWeeks ? `${velocityForecast.etaWeeks} שבועות` : "—"} />
        </div>
        {viewMode === "table" ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm min-w-full">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-4 text-center">
                    <input type="checkbox" checked={filteredJobs.length > 0 && selectedJobTitles.length === filteredJobs.length} onChange={toggleSelectAllJobs} disabled={!canEdit} className="w-4 h-4 accent-[#EF6B00] disabled:opacity-50" />
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase whitespace-nowrap">מזהה & משרה</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">סטטוס</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">בריאות (Score)</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase whitespace-nowrap">חטיבה</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase whitespace-nowrap">צוות גיוס</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase whitespace-nowrap">תאריך פתיחה</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">SLA נוכחי</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">מועמדים</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">פעולות AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredJobs.map((job) => {
                  const slaLimit = algoConfig.baseSLA[job.type] || 30;
                  const isClosed = job.status !== "open";
                  // Stage breakdown chips — only stages with > 0 candidates,
                  // capped to top 3 to keep the row readable.
                  const breakdownEntries = STAGE_ORDER
                    .map(stage => ({ stage, count: job.stageBreakdown?.[stage] ?? 0 }))
                    .filter(e => e.count > 0)
                    .slice(0, 4);
                  return (
                  <tr
                    key={job.id}
                    onClick={() => setDrillJob({ key: job.id || job.title, initialStage: "" })}
                    className={`hover:bg-orange-50/40 transition-colors group cursor-pointer ${isClosed ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedJobTitles.includes(job.title)} onChange={() => toggleSelectOneJob(job.title)} disabled={!canEdit} className="w-4 h-4 accent-[#EF6B00] disabled:opacity-50" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-black text-[#002649] text-sm group-hover:text-[#EF6B00] transition-colors whitespace-nowrap">{job.title}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {job.id}</div>
                      {breakdownEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {breakdownEntries.map(({ stage, count }) => {
                            const meta = getStageMeta(stage);
                            return (
                              <button
                                key={stage}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDrillJob({ key: job.id || job.title, initialStage: stage }); }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.chip} hover:bg-slate-50 transition-colors`}
                              >
                                {count} {meta.short}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Status badge — open stays green; closed adds close_reason tooltip + date. */}
                    <td className="px-6 py-4 text-center">
                      <span
                        title={isClosed ? `סיבה: ${job.closeReason || "—"} · נסגר: ${job.closeDate || "—"}` : "משרה פעילה"}
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${job.status === 'open' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}
                      >
                        {job.status === 'open' ? 'פתוחה' : 'סגורה'}
                      </span>
                      {isClosed && job.closeDate && (
                        <div className="text-[9px] font-mono text-slate-400 mt-1">{job.closeDate.slice(0, 10)}</div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      {job.status === 'open' ? (
                          <div className="flex flex-col items-center gap-1">
                              <div className={`px-2.5 py-0.5 rounded-lg font-black text-xs border ${getScoreColor(job.currentScore)}`}>
                                  {job.currentScore}%
                              </div>
                              <div className="flex items-center gap-1 text-[9px] font-bold">
                                  {job.currentScore >= job.prevScore ? <TrendingUp size={10} className="text-green-500"/> : <TrendingDown size={10} className="text-red-500"/>}
                                  <span className={job.currentScore >= job.prevScore ? 'text-green-600' : 'text-red-600'}>{Math.abs(job.currentScore - job.prevScore)}%</span>
                              </div>
                          </div>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-600 text-sm whitespace-nowrap">{job.dept}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-[#002649] border border-slate-200">
                            {job.recruiter.substring(0,2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-700">{job.recruiter}</div>
                          <div className="text-[10px] text-slate-400">רכז/ת: {job.coordinator}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap">{formatDateHe(job.openDate)}</td>
                    <td className="px-6 py-4 text-center">
                      <div className={`text-sm font-black whitespace-nowrap ${job.sla > slaLimit ? 'text-red-500' : 'text-[#002649]'}`}>
                        {job.sla} ימים
                      </div>
                      <div className="w-20 bg-slate-100 h-1.5 rounded-full mt-1.5 mx-auto overflow-hidden">
                        <div className={`h-full ${job.sla > slaLimit ? 'bg-red-500' : 'bg-[#EF6B00]'}`} style={{ width: `${Math.min((job.sla / slaLimit) * 100, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-black shadow-sm border border-blue-100">
                        <Users size={12} /> {job.candidates}
                      </div>
                      {job.status === 'open' && (
                          <div className="text-[9px] text-slate-400 font-bold mt-1">מתוכם {job.activeInProcess} פעילים</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center relative">
                      <ConditionalAction job={job} threshold={algoConfig.threshold} canEdit={canEdit} />
                    </td>
                  </tr>
                  );
                })}
                {filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                      לא נמצאו משרות לפי הסינון שנבחר.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 flex items-center gap-2">
              <Info size={14} />
              תצוגת Grid ממוקדת במשרות פתוחות בלבד כדי להדגיש טיפול תפעולי.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredJobs.filter(j => j.status === 'open').map(job => (
              <div key={job.id} className={`bg-white rounded-[2rem] p-6 border-2 shadow-sm relative group transition-all ${job.currentScore < algoConfig.threshold ? 'border-red-100' : 'border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-4">
                      <div className={`text-2xl font-black p-3 rounded-2xl border ${getScoreColor(job.currentScore)}`}>{job.currentScore}%</div>
                      <ConditionalAction job={job} threshold={algoConfig.threshold} isGrid={true} canEdit={canEdit} />
                  </div>
                  <h3 className="font-black text-[#002649] text-lg">{job.title}</h3>
                  <div className="flex items-center gap-2 mt-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-[#002649] border border-slate-200">{job.recruiter.substring(0,2)}</div>
                    <p className="text-slate-500 text-xs font-bold">{job.dept} | {job.recruiter}</p>
                  </div>
                  <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-500">SLA נוכחי:</span>
                          <span className={job.sla > (algoConfig.baseSLA[job.type] || 30) ? 'text-red-500' : 'text-[#002649]'}>{job.sla} ימים</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-500">מועמדים (פעילים):</span>
                          <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1"><Users size={10}/> {job.candidates} ({job.activeInProcess})</span>
                      </div>
                  </div>
              </div>
            ))}
            </div>
            {filteredJobs.filter(j => j.status === 'open').length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400">
                אין משרות פתוחות להצגה בתצוגת Grid.
              </div>
            )}
          </>
        )}
      </div>

      {/* --- Admin Modal --- */}
      {showAdmin && (
        <div className="fixed inset-0 bg-[#002649]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 duration-300 my-8">
                <div className="flex justify-between items-start mb-8 border-b pb-6 border-slate-100">
                    <div>
                        <h2 className="text-3xl font-black text-[#002649] flex items-center gap-3"><Settings className="text-[#EF6B00]"/> שליטה בליבת האלגוריתם</h2>
                        <p className="text-slate-400 font-bold mt-1">עדכון פרמטרים גלובליים והחרגות פרטניות (TAHub Admin)</p>
                    </div>
                    <button onClick={() => setShowAdmin(false)} className="p-3 bg-slate-50 rounded-full hover:bg-slate-100 transition-all"><X size={24}/></button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 text-right">
                    
                    {/* צד א' - הסבר הנוסחא והפקטורים */}
                    <div className="space-y-6">
                        <h3 className="font-black text-lg text-[#002649] flex items-center gap-2 underline decoration-[#EF6B00] decoration-4 underline-offset-8">
                            <Calculator size={20} /> נוסחת חישוב בריאות המשרה
                        </h3>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                            <p className="text-sm font-bold text-slate-600 mb-4">ציון הבסיס הוא 100%. האלגוריתם משקלל את 5 הפרמטרים הבאים:</p>
                            <ul className="space-y-3 text-xs font-bold text-slate-700">
                                <li className="flex gap-2"><span className="text-red-500 shrink-0">1. SLA:</span> הפחתה של 2 נקודות על כל יום שחורג מהיעד המוגדר.</li>
                                <li className="flex gap-2"><span className="text-red-500 shrink-0">2. פייפליין חסר:</span> הפחתה של {algoConfig.pipelinePenalty} נקודות אם כמות הפעילים קטנה מהמינימום.</li>
                                <li className="flex gap-2"><span className="text-green-600 shrink-0">3. דופק השבוע:</span> תוספת של {algoConfig.pulseBonus} נקודות אם התקבלו מעל 10 קו&quot;ח השבוע.</li>
                                <li className="flex gap-2"><span className="text-green-600 shrink-0">4. הצעת חוזה:</span> תוספת של {algoConfig.offerBonus} נקודות אם יש מועמד בשלב הצעה.</li>
                                <li className="flex gap-2"><span className="text-red-500 shrink-0">5. משרה קריטית:</span> הפחתה אוטומטית של {algoConfig.criticalPenalty} נקודות למשרות רגישות.</li>
                            </ul>
                            <div className="mt-4 pt-4 border-t border-slate-200 text-[10px] text-slate-400 italic">
                                * לאחר השקלול, ניתן להכפיל בפקטור החרגה חטיבתי. ציון סופי נשמר בטווח של 0-100.
                            </div>
                        </div>

                        {/* הגדרת חריגות ופקטורים - הוחזר במלואו! */}
                        <h3 className="font-black text-lg text-[#002649] mt-8 flex items-center gap-2 underline decoration-[#EF6B00] decoration-4 underline-offset-8">החרגות ופקטורים חטיבתיים</h3>
                        <div className="space-y-5">
                            <div>
                                <label htmlFor="threshold-input" className="text-xs font-black text-slate-400 block mb-2">סף התראה (מתחת לציון זה המשרה נחשבת &apos;חולה&apos;)</label>
                                <input id="threshold-input" type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 ring-[#EF6B00]/20 outline-none" value={algoConfig.threshold} onChange={(e) => setAlgoConfig({...algoConfig, threshold: Number(e.target.value)})} />
                            </div>
                            
                            <div className="border border-slate-200 p-4 rounded-2xl bg-white shadow-sm space-y-4">
                                <label htmlFor="override-dept" className="text-xs font-black text-slate-400 block">הוסף פקטור (למשל: Service, 1.1)</label>
                                <div className="flex gap-2">
                                    <input id="override-dept" type="text" placeholder="שם חטיבה (למשל: Service)" className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm focus:ring-2 ring-[#EF6B00]/20 outline-none" value={overrideDept} onChange={(e) => setOverrideDept(e.target.value)} />
                                    <input type="number" step="0.1" placeholder="פקטור" className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm text-center focus:ring-2 ring-[#EF6B00]/20 outline-none" value={overrideFactor} onChange={(e) => setOverrideFactor(Number(e.target.value))} />
                                    <button onClick={addOverride} className="bg-[#002649] text-white px-4 rounded-lg font-bold text-xs hover:bg-[#EF6B00] transition-colors">הוסף</button>
                                </div>
                                
                                {/* הצגת הפקטורים הפעילים */}
                                {Object.keys(algoConfig.overrides.depts).length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                                        {Object.entries(algoConfig.overrides.depts).map(([dept, factor]) => (
                                            <div key={dept} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-black border border-blue-100">
                                                <span>{dept}: {factor}x</span>
                                                <button onClick={() => removeOverride(dept)} className="text-blue-400 hover:text-red-500 transition-colors"><X size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3 text-amber-700">
                                <Info size={20} className="shrink-0" />
                                <p className="text-xs font-bold leading-relaxed">שינוי הפקטור משפיע על הציון הסופי באופן יחסי. פקטור של 1.1 מגדיל את הציון ב-10%, פקטור של 0.9 מקשיח אותו.</p>
                            </div>
                        </div>
                    </div>

                    {/* צד ב' - שליטה בפרמטרים */}
                    <div className="space-y-6">
                        <h3 className="font-black text-lg text-[#002649] flex items-center gap-2 underline decoration-[#EF6B00] decoration-4 underline-offset-8">יעדי SLA ומועמדים</h3>
                        <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-200">
                            {['mass', 'pro', 'tech'].map(type => (
                                <div key={type} className="grid grid-cols-3 gap-4 items-center border-b border-slate-200 pb-3 last:border-0">
                                    <span className="text-xs font-black uppercase text-slate-400">{type === 'mass' ? 'מסה' : type === 'pro' ? 'מקצועי' : 'טכנולוגי'}</span>
                                    <div>
                                        <label htmlFor={`sla-${type}`} className="text-[10px] font-bold block mb-1">SLA יעד</label>
                                        <input id={`sla-${type}`} type="number" className="w-full bg-white border border-slate-200 p-2.5 rounded-xl font-bold text-sm focus:ring-2 ring-[#EF6B00]/20 outline-none" value={algoConfig.baseSLA[type]} onChange={(e) => setAlgoConfig({ ...algoConfig, baseSLA: {...algoConfig.baseSLA, [type]: Number.parseInt(e.target.value)} })} />
                                    </div>
                                    <div>
                                        <label htmlFor={`min-${type}`} className="text-[10px] font-bold block mb-1">מינימום פעילים</label>
                                        <input id={`min-${type}`} type="number" className="w-full bg-white border border-slate-200 p-2.5 rounded-xl font-bold text-sm focus:ring-2 ring-[#EF6B00]/20 outline-none" value={algoConfig.minActive[type]} onChange={(e) => setAlgoConfig({ ...algoConfig, minActive: {...algoConfig.minActive, [type]: Number.parseInt(e.target.value)} })} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-slate-100">
                    <button onClick={() => { void save(({ ...(config as object), jobsAlgo: algoConfig } as unknown) as Partial<import("@/app/admin/components/targets/useAdminConfig").AdminConfig>, "visibility"); setShowAdmin(false); }} className="w-full py-5 bg-[#002649] text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-[#EF6B00] transition-all shadow-xl shadow-blue-900/20 text-lg">
                        <Save size={24}/> שמור הגדרות מערכת והחל על כל המשרות
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Job side-panel — opens on row click. Lists candidates by stage. */}
      <JobSidePanel
        open={!!drillJob}
        jobKey={drillJob?.key ?? null}
        initialStage={drillJob?.initialStage ?? ""}
        onClose={() => setDrillJob(null)}
      />
    </div>
  );
}

function ForecastCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl border border-purple-100 bg-white px-3 py-2">
      <div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className="text-sm font-black text-[#002649] mt-1">{value}</div>
    </div>
  );
}

// --- רכיב פעולות כולל חיבור לאאוטלוק ובלי פס גלילה ---
function ConditionalAction({ job, threshold, isGrid = false, canEdit = true }: Readonly<{ job: ScoredJob; threshold: number; isGrid?: boolean; canEdit?: boolean }>) {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();
  const isNeedsAction = job.status === 'open' && job.currentScore < threshold;

  // פונקציה לפתיחת האאוטלוק
  const handleMailToManager = () => {
    const subject = encodeURIComponent(`עדכון סטטוס חשוב: משרת ${job.title} (ID: ${job.id})`);
    const body = encodeURIComponent(
      `היי,\n\nמערכת TAHub מזהה כי משרת ${job.title} דורשת את תשומת ליבנו.\n\n` +
      `נתונים נוכחיים:\n` +
      `- ימים באוויר (SLA): ${job.sla} ימים\n` +
      `- מדד בריאות המשרה: ${job.currentScore}%\n` +
      `- מועמדים פעילים: ${job.activeInProcess}\n\n` +
      `אשמח אם נוכל לתאם שיחה קצרה בקרוב כדי לבחון כיצד לקדם את הגיוס, האם נדרש דיוק בפרופיל או תגבור מקורות.\n\n` +
      `בברכה,\n${job.recruiter}`
    );
    globalThis.location.href = `mailto:?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  const handleComingSoon = (feature: string) => {
    showToast(`${feature} — בקרוב`, "coming-soon");
    setOpen(false);
  };

  if (!isNeedsAction || !canEdit) {
    return (
      <div className="flex items-center justify-center text-green-500 bg-green-50 w-8 h-8 rounded-full mx-auto border border-green-100 shadow-inner">
        <Check size={16} strokeWidth={3} />
      </div>
    );
  }

  // הפתרון לפס הגלילה: שימוש ב- right-0 כדי לפתוח פנימה
  return (
    <div className={`relative ${isGrid ? '' : 'flex justify-center'}`}>
      <button 
        onClick={() => setOpen(!open)} 
        className="w-10 h-10 bg-red-50 text-red-600 rounded-2xl border border-red-100 hover:bg-red-100 transition-all flex items-center justify-center animate-bounce-subtle shadow-sm relative z-10"
      >
        <MoreVertical size={20} />
      </button>
      
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}></div>
          <div className={`absolute z-50 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 
            ${isGrid ? 'top-full mt-2 right-0' : 'bottom-full mb-2 right-0'}`}>
              <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase border-b border-slate-50 mb-1 text-right">המלצות AI מגייסת</div>
              
              {/* כפתור חיבור לאאוטלוק */}
              <button onClick={handleMailToManager} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors group text-right">
                  <Mail size={16} className="text-blue-500" />
                  <span className="text-xs font-black text-slate-700">שלח מייל למנהל מגייס</span>
              </button>
              
              <button onClick={() => handleComingSoon("בקשת תגבור מקורות")} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors group text-right">
                  <Zap size={16} className="text-amber-500" />
                  <span className="text-xs font-black text-slate-700">בקש תגבור מקורות</span>
              </button>
              
              <button onClick={() => handleComingSoon("קביעת שיחת סטטוס")} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors group text-right">
                  <MessageSquare size={16} className="text-red-500" />
                  <span className="text-xs font-black text-slate-700">קבע שיחת סטטוס</span>
              </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <AdminConfigProvider>
      <JobsPageInner />
    </AdminConfigProvider>
  );
}