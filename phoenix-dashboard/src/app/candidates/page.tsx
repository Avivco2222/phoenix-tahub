"use client";

import React, { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAccess } from "@/context/AccessContext";
import { formatDateHe } from "@/lib/dates";
import { getAdminHeaders, getApiBaseUrl } from "@/lib/api";
import { canMutateData } from "@/lib/access-control";
import { PageHeader } from "@/components/PageHeader";
import { StageBadge } from "@/components/StageBadge";
import { StageFilterChips } from "@/components/StageFilterChips";
import { CandidateSidePanel } from "@/components/CandidateSidePanel";
import { useDataVersion } from "@/context/DataVersionContext";
import type { UnifiedStage } from "@/lib/stages";
import {
  Users, Search, Briefcase, Plus, UserCheck,
  Clock, XCircle, CheckCircle2, Edit3, Trash2,
  Lock, CheckSquare, Save, Settings, X,
  Car, Smartphone, Coffee, Download, Send, UserMinus, UserCheck2, Loader2
} from "lucide-react";
import SmartOnboarding from "@/app/ai-hub/components/SmartOnboarding";

// --- Types ---
interface OnboardingRecord {
  id: string;
  name: string;
  id_num: string;
  role: string;
  department: string;
  manager: string;
  start_date: string;
  has_car?: boolean;
  parking_type?: string;
  car_num: string;
  has_mobile?: boolean;
  has_cibus?: boolean;
  is_referral?: boolean;
  referral_name: string;
  referral_id: string;
  diversity: string;
  status: "pending" | "completed" | "cancelled" | "left_company"; // הוספנו סטטוס עזיבה
  created_at: string;
}

interface PipelineCandidate {
  candidate_name: string;
  job_title: string;
  status: string;
  recruiter: string;
  days_in_process: number;
}

// Unified row from the new /candidates endpoint — applications JOIN candidates
// JOIN jobs LEFT JOIN onboarding, with `unified_stage` derived from both
// applications.stage_code and onboarding.status.
interface UnifiedCandidate {
  candidate_id?: string;
  candidate_name?: string;
  email?: string;
  phone?: string;
  source?: string;
  job_id?: string;
  job_title?: string;
  department?: string;
  recruiter?: string;
  status?: string;
  stage_code?: string;
  unified_stage?: import("@/lib/stages").UnifiedStage;
  days_in_process?: number;
  start_date?: string;
  onboarding_id?: string | null;
  onboarding_status?: string | null;
  onboarding_start_date?: string | null;
  id_num?: string | null;
}

interface UnifiedResponse {
  data: UnifiedCandidate[];
  total: number;
  total_by_stage: Partial<Record<import("@/lib/stages").UnifiedStage | "ALL", number>>;
}

const MOCK_DATA: OnboardingRecord[] = [];

export default function CandidatesPage() {
  // Empty string → same-origin (Next.js rewrites in next.config.ts proxy
  // /candidates and /api/* to the backend). Using `??` instead of `||` keeps
  // the empty-string config from falling back to a literal localhost URL.
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const { showToast } = useToast();
  const { effectiveUser } = useAccess();
  const canEdit = canMutateData(effectiveUser.role);
  const strictLiveData = true;
  // --- Global States ---
  const [activeTab, setActiveTab] = useState<"pipeline" | "preboarding" | "active" | "archive">("preboarding");
  const [userRole, setUserRole] = useState<"recruiter" | "admin">("admin"); 
  
  // --- Data States ---
  const [onboardings, setOnboardings] = useState<OnboardingRecord[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineCandidate[]>([]);
  const [liveDataError, setLiveDataError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof OnboardingRecord, direction: 'asc' | 'desc' }>({ key: 'start_date', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OnboardingRecord["status"]>("completed");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const tab = params.get("tab");
    const q = params.get("q");
    const sortKey = params.get("sortKey");
    const sortDir = params.get("sortDir");
    if (tab === "preboarding" || tab === "active" || tab === "archive" || tab === "pipeline") {
      setActiveTab(tab);
    }
    if (q) setSearchTerm(q);
    if (
      sortKey === "name" ||
      sortKey === "id_num" ||
      sortKey === "role" ||
      sortKey === "department" ||
      sortKey === "manager" ||
      sortKey === "start_date" ||
      sortKey === "status" ||
      sortKey === "created_at"
    ) {
      setSortConfig((prev) => ({
        ...prev,
        key: sortKey,
      }));
    }
    if (sortDir === "asc" || sortDir === "desc") {
      setSortConfig((prev) => ({ ...prev, direction: sortDir }));
    }
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams(globalThis.location.search);
    if (activeTab) params.set("tab", activeTab);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    else params.delete("q");
    params.set("sortKey", sortConfig.key);
    params.set("sortDir", sortConfig.direction);
    const query = params.toString();
    const nextUrl = query ? `${globalThis.location.pathname}?${query}` : globalThis.location.pathname;
    globalThis.history.replaceState(null, "", nextUrl);
  }, [activeTab, searchTerm, sortConfig, urlReady]);

  // Hoisted so it can be reused after the wizard submits a new record.
  const reloadOnboardings = React.useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/onboarding`, { headers: getAdminHeaders() });
      if (!res.ok) throw new Error("onboarding fetch failed");
      const rows = (await res.json()) as OnboardingRecord[];
      setOnboardings(Array.isArray(rows) ? rows : []);
    } catch {
      setOnboardings([]);
    }
  }, []);

  useEffect(() => {
    if (!canEdit) {
      setOnboardings([]);
      return;
    }
    void reloadOnboardings();
  }, [canEdit, reloadOnboardings]);

  useEffect(() => {
    const loadPipeline = async () => {
      try {
        setLiveDataError(null);
        const res = await fetch(`${apiBase}/candidates?page=1&limit=50`, { cache: "no-store" });
        if (!res.ok) throw new Error("candidates fetch failed");
        const payload = await res.json();
        setPipelineData(Array.isArray(payload?.data) ? payload.data : []);
      } catch {
        setLiveDataError("Live candidates API unavailable");
      }
    };
    loadPipeline();
  }, [apiBase]);

  // --- Modals State ---
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OnboardingRecord | null>(null);
  // Pre-onboarding wizard popup — opens via "קליטת עובד חדש" instead of the
  // legacy 4-field form (showForm). The legacy form stays for editing existing
  // records.
  const [showWizard, setShowWizard] = useState(false);

  // === Unified pipeline view (post-redesign) ===========================
  // The new primary data source for this page. Replaces the legacy 4-tab
  // split and joins applications + candidates + jobs + onboarding so the
  // recruiter sees ONE list spanning the full funnel.
  const [unifiedRows, setUnifiedRows] = useState<UnifiedCandidate[]>([]);
  const [totalByStage, setTotalByStage] = useState<UnifiedResponse["total_by_stage"]>({});
  const [stageFilter, setStageFilter] = useState<UnifiedStage | "">("");
  const [filterRecruiter, setFilterRecruiter] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterJob, setFilterJob] = useState("");
  const [filterDaysMin, setFilterDaysMin] = useState<string>("");
  const [filterDaysMax, setFilterDaysMax] = useState<string>("");
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);

  const reloadUnified = React.useCallback(async () => {
    setUnifiedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (stageFilter) params.set("stage", stageFilter);
      if (searchTerm) params.set("search", searchTerm);
      if (filterRecruiter) params.set("recruiter", filterRecruiter);
      if (filterDept) params.set("dept", filterDept);
      if (filterJob) params.set("job_id", filterJob);
      if (filterDaysMin) params.set("days_min", filterDaysMin);
      if (filterDaysMax) params.set("days_max", filterDaysMax);
      const res = await fetch(`${apiBase}/api/candidates?${params.toString()}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) throw new Error("unified fetch failed");
      const json = (await res.json()) as UnifiedResponse;
      setUnifiedRows(Array.isArray(json.data) ? json.data : []);
      setTotalByStage(json.total_by_stage || {});
    } catch {
      setUnifiedRows([]);
      setTotalByStage({});
    } finally {
      setUnifiedLoading(false);
    }
  }, [apiBase, stageFilter, searchTerm, filterRecruiter, filterDept, filterJob, filterDaysMin, filterDaysMax]);

  // Re-runs every time filters change OR a fresh batch lands (data_version bumps).
  const dataVersion = useDataVersion();
  useEffect(() => { void reloadUnified(); }, [reloadUnified, dataVersion]);

  // Recruiter / department options derived from the rows themselves so the
  // dropdowns stay in sync with what the user actually sees.
  const filterOptions = React.useMemo(() => {
    const recruiters = new Set<string>();
    const depts = new Set<string>();
    const jobs = new Map<string, string>(); // id → title
    for (const row of unifiedRows) {
      if (row.recruiter) recruiters.add(row.recruiter);
      if (row.department) depts.add(row.department);
      if (row.job_id && row.job_title) jobs.set(row.job_id, row.job_title);
    }
    return {
      recruiters: Array.from(recruiters).sort(),
      depts: Array.from(depts).sort(),
      jobs: Array.from(jobs.entries()).map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title)),
    };
  }, [unifiedRows]);

  const clearFilters = () => {
    setStageFilter("");
    setFilterRecruiter("");
    setFilterDept("");
    setFilterJob("");
    setFilterDaysMin("");
    setFilterDaysMax("");
    setSearchTerm("");
  };
  // =======================================================================

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // --- Checklist State ---
  const [showChecklist, setShowChecklist] = useState<string | null>(null);
  const PIPELINE_TAB_ENABLED = false;
  const [tasks, setTasks] = useState([
    { id: 1, text: 'ביצוע "יועסקו" ב-SAP', done: false },
    { id: 2, text: 'סגירת משרה במערכת EC', done: false },
    { id: 3, text: 'וידוא הסרת פרסומים (נילוסופט/לינקדאין)', done: false },
    { id: 4, text: 'שליחת שאלון עובד חדש (HRO)', done: false },
    { id: 5, text: 'וידוא כתובת ותאריך תחילה בנילוסופט', done: false }
  ]);
  const [isEditingTasks, setIsEditingTasks] = useState(false);

  useEffect(() => {
    if (!PIPELINE_TAB_ENABLED && activeTab === "pipeline") {
      setActiveTab("preboarding");
    }
  }, [activeTab, PIPELINE_TAB_ENABLED]);

  useEffect(() => {
    if (effectiveUser.role === "admin") {
      setUserRole("admin");
      return;
    }
    setUserRole("recruiter");
    if (activeTab === "archive") {
      setActiveTab("preboarding");
    }
  }, [activeTab, effectiveUser.role]);

  const confirmAction = (message: string) =>
    new Promise<boolean>((resolve) => {
      setConfirmDialog({
        message,
        onConfirm: () => {
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        },
      });
    });

  // --- Sorting & Filtering ---
  const handleSort = (key: keyof OnboardingRecord) => {
    setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
  };

  const currentKey = sortConfig?.key;
  const currentDir = sortConfig?.direction;

  const filteredAndSortedData = [...onboardings]
    .filter(r => {
      if (activeTab === 'preboarding') return r.status === 'pending';
      if (activeTab === 'active') return r.status === 'completed';
      if (activeTab === 'archive') return r.status === 'left_company' || r.status === 'cancelled';
      return false;
    })
    .filter(r => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        (r.name ?? '').toLowerCase().includes(s) ||
        (r.role ?? '').toLowerCase().includes(s) ||
        (r.department ?? '').toLowerCase().includes(s) ||
        (r.id_num ?? '').toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      if (!currentKey || !currentDir) return 0;
      const valA = a[currentKey as keyof typeof a] ?? "";
      const valB = b[currentKey as keyof typeof b] ?? "";
      if (valA < valB) return currentDir === 'asc' ? -1 : 1;
      if (valA > valB) return currentDir === 'asc' ? 1 : -1;
      return 0;
    });

  // --- Actions ---
  const updateStatus = (id: string, newStatus: "completed" | "cancelled" | "left_company") => {
    // In real app: fetch to backend. Here we update the local mock state.
    setOnboardings(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedData.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredAndSortedData.map((r) => r.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const applyBulkStatus = async () => {
    if (!canEdit) return;
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/onboarding/bulk-update`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ ids: selectedIds, status: bulkStatus }),
      });
      if (!res.ok) throw new Error("bulk update failed");
      setOnboardings((prev) => prev.map((row) => (selectedIds.includes(row.id) ? { ...row, status: bulkStatus } : row)));
      showToast("עדכון גורף נשמר בהצלחה", "success");
      setSelectedIds([]);
    } catch {
      showToast("עדכון גורף נכשל", "error");
    } finally {
      setBulkLoading(false);
    }
  };

  const escapeCsvValue = (value: string | number | boolean | null | undefined) => {
    const text = String(value ?? "");
    return `"${text.replaceAll("\"", "\"\"")}"`;
  };

  const exportToExcel = () => {
    const headers = "שם מלא,תעודת זהות,תפקיד,יחידה,מנהל ישיר,תאריך תחילה,זכאות רכב,סוג חניה,מספר רכב,נייד,סיבוס,סטטוס\n";
    const rows = filteredAndSortedData.map(r => 
      [
        escapeCsvValue(r.name),
        escapeCsvValue(r.id_num),
        escapeCsvValue(r.role),
        escapeCsvValue(r.department),
        escapeCsvValue(r.manager),
        escapeCsvValue(r.start_date),
        escapeCsvValue(r.has_car ? "כן" : "לא"),
        escapeCsvValue(r.parking_type ?? ""),
        escapeCsvValue(r.car_num),
        escapeCsvValue(r.has_mobile ? "כן" : "לא"),
        escapeCsvValue(r.has_cibus ? "כן" : "לא"),
        escapeCsvValue(r.status),
      ].join(",")
    ).join("\n");
    
    // הוספת BOM כדי שהאקסל יקרא עברית תקינה
    const blob = new Blob(["\ufeff" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Phoenix_Candidates_Report_${activeTab}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-4 pt-6">
      
      {/* Header (uniform PageHeader, sidebar-matching Users icon) */}
      <PageHeader
        icon={<Users size={28} strokeWidth={1.75} />}
        title="ניהול מועמדים"
        subtitle="ניהול משפך הגיוס, טרום קליטה, ועובדים שנקלטו בארגון."
        actions={
          effectiveUser.role === "admin" ? (
            <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500">תצוגה כ:</span>
              <select value={userRole} onChange={e => {setUserRole(e.target.value as "recruiter" | "admin"); if(e.target.value==='recruiter' && activeTab==='archive') setActiveTab('preboarding');}} className="bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#002649] p-1.5 outline-none cursor-pointer">
                <option value="recruiter">מגייסת (Recruiter)</option>
                <option value="admin">מנהלת מערכת (Admin)</option>
              </select>
            </div>
          ) : null
        }
      />

      {/* Stage filter chips — single row covering the entire funnel. */}
      <StageFilterChips active={stageFilter} counts={totalByStage} onChange={setStageFilter} />

      {/* Filters bar — recruiter / dept / job / days range. */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם מועמד, משרה או מגייסת..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:ring-2 ring-[#EF6B00]/20"
          />
        </div>
        <select value={filterRecruiter} onChange={(e) => setFilterRecruiter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 outline-none">
          <option value="">כל המגייסות</option>
          {filterOptions.recruiters.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 outline-none">
          <option value="">כל המחלקות</option>
          {filterOptions.depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterJob} onChange={(e) => setFilterJob(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 outline-none max-w-[200px]">
          <option value="">כל המשרות</option>
          {filterOptions.jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
          ימים בתהליך:
          <input type="number" min={0} value={filterDaysMin} onChange={(e) => setFilterDaysMin(e.target.value)} placeholder="מ-" className="w-14 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center" />
          <input type="number" min={0} value={filterDaysMax} onChange={(e) => setFilterDaysMax(e.target.value)} placeholder="עד" className="w-14 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center" />
        </div>
        <button onClick={clearFilters} className="text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1 px-3 py-2 rounded-lg border border-transparent hover:bg-red-50">
          <XCircle size={14} /> נקה
        </button>
      </div>

      {/* Unified candidates table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        {!canEdit && (
          <div className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
            מצב צפייה בלבד פעיל עבור התפקיד הנוכחי.
          </div>
        )}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-wrap gap-3">
          <h2 className="text-base font-black text-[#002649] flex items-center gap-2">
            <Users size={18} strokeWidth={1.75} className="text-[#EF6B00]" />
            {unifiedRows.length} מועמדים בציר הנוכחי
            {unifiedLoading && <Loader2 size={14} className="animate-spin text-[#EF6B00]" />}
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={exportToExcel} className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-colors">
              <Download size={16} className="text-green-600"/> ייצוא
            </button>
            <button onClick={() => setShowWizard(true)} disabled={!canEdit} className="bg-[#002649] text-white px-5 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-[#EF6B00] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              <Plus size={16}/> קליטת עובד חדש
            </button>
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#002649] text-white font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">שם מועמד.ת</th>
                <th className="px-4 py-3">משרה / מחלקה</th>
                <th className="px-4 py-3 text-center">שלב</th>
                <th className="px-4 py-3 text-center">מגייסת</th>
                <th className="px-4 py-3 text-center">ימים בשלב</th>
                <th className="px-4 py-3 text-center">תאריך תחילה</th>
                <th className="px-4 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unifiedRows.map((row) => {
                const key = (row.candidate_id || row.id_num || row.candidate_name || "").toString();
                const onboardingMatch = row.onboarding_id ? onboardings.find(o => o.id === row.onboarding_id) : null;
                const isStale = (row.days_in_process ?? 0) > 30;
                const startDateStr = row.onboarding_start_date || row.start_date || "";
                return (
                  <tr
                    key={key + (row.job_id || "")}
                    onClick={() => setSelectedCandidateKey(key)}
                    className={`hover:bg-orange-50/40 cursor-pointer transition-colors ${row.unified_stage === 'REJECTED' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-black text-[#002649]">{row.candidate_name || "—"}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {row.id_num ? `ת.ז: ${row.id_num}` : (row.email || "")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-700 truncate max-w-[200px]" title={row.job_title}>{row.job_title || "—"}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{row.department || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StageBadge stage={row.unified_stage} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">{row.recruiter || "—"}</td>
                    <td className={`px-4 py-3 text-center font-mono font-bold ${isStale ? "text-red-600" : "text-slate-600"}`}>
                      {row.days_in_process ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-mono text-slate-500">
                      {startDateStr ? formatDateHe(startDateStr) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {onboardingMatch && (
                          <button
                            onClick={() => { setEditingRecord(onboardingMatch); setShowForm(true); }}
                            disabled={!canEdit}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                            title="ערוך תיק קליטה"
                          ><Edit3 size={16} /></button>
                        )}
                        <button
                          onClick={() => setSelectedCandidateKey(key)}
                          className="p-1.5 text-slate-500 hover:text-[#EF6B00] hover:bg-orange-50 rounded-lg transition-colors"
                          title="פתח פרטי מועמד"
                        ><UserCheck size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {unifiedRows.length === 0 && !unifiedLoading && (
                <tr><td colSpan={7} className="text-center py-16 text-slate-400 font-medium">אין מועמדים תחת הסינון הנוכחי.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pipeline tab — disabled legacy; kept the data fetch above for future use. */}
      {false && PIPELINE_TAB_ENABLED && activeTab === "pipeline" && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          {strictLiveData && liveDataError && (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
              מצב Live קשיח פעיל: לא נטענו נתוני מועמדים מהשרת.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#002649] text-white font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">מועמד</th>
                  <th className="px-6 py-4">משרה</th>
                  <th className="px-6 py-4">סטטוס</th>
                  <th className="px-6 py-4">מגייס</th>
                  <th className="px-6 py-4 text-center">ימים בתהליך</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pipelineData.map((row, idx) => (
                  <tr key={`${row.candidate_name}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-bold text-[#002649]">{row.candidate_name}</td>
                    <td className="px-6 py-3">{row.job_title}</td>
                    <td className="px-6 py-3">{row.status}</td>
                    <td className="px-6 py-3">{row.recruiter}</td>
                    <td className="px-6 py-3 text-center font-bold">{row.days_in_process}</td>
                  </tr>
                ))}
                {pipelineData.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-slate-400 font-medium">אין נתוני ATS זמינים כרגע.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legacy table — superseded by the unified view above. Keeping the
          structure dead-coded under `false` for now so the OnboardingFormModal,
          checklist modal and bulk-update flows that reference these pieces can
          still build. Will be removed once the unified flow handles everything. */}
      {false && activeTab !== "pipeline" && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 min-h-[500px] flex flex-col">
          {!canEdit && (
            <div className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
              מצב צפייה בלבד פעיל עבור התפקיד הנוכחי. פעולות עריכה נחסמו.
            </div>
          )}
          {selectedIds.length > 0 && (
            <div className="mx-5 mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-sm font-black text-blue-800">{selectedIds.length} רשומות נבחרו</div>
              <div className="flex items-center gap-2">
                <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as OnboardingRecord["status"])} className="text-xs font-bold border border-blue-200 rounded-lg px-2 py-2 bg-white">
                  <option value="pending">ממתין לתחילה</option>
                  <option value="completed">נקלט בהצלחה</option>
                  <option value="cancelled">בוטל</option>
                  <option value="left_company">לא פעיל</option>
                </select>
                <button onClick={applyBulkStatus} disabled={bulkLoading || !canEdit} className="px-4 py-2 rounded-lg bg-[#002649] text-white text-xs font-black hover:bg-[#EF6B00] disabled:opacity-60">
                  החל עדכון גורף
                </button>
              </div>
            </div>
          )}
          
          {/* Toolbar */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-wrap gap-4">
            <div className="relative w-full md:w-96">
              <Search size={18} className="absolute right-3 top-3 text-slate-400" />
              <input type="text" placeholder="חיפוש לפי שם, ת.ז, תפקיד או מחלקה..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-[#EF6B00] outline-none shadow-sm" />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={exportToExcel} className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-colors">
                <Download size={18} className="text-green-600"/> ייצוא נתונים
              </button>
              
              {activeTab === "preboarding" && (
                <button onClick={() => setShowWizard(true)} disabled={!canEdit} className="bg-[#002649] text-white px-5 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-[#EF6B00] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  <Plus size={18}/> קליטת עובד חדש
                </button>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#002649] text-white font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4 text-center">
                    <input type="checkbox" checked={filteredAndSortedData.length > 0 && selectedIds.length === filteredAndSortedData.length} onChange={toggleSelectAll} disabled={!canEdit} className="w-4 h-4 accent-[#EF6B00] disabled:opacity-50" />
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-white/10" onClick={() => handleSort('name')}>שם מועמד.ת</th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-white/10" onClick={() => handleSort('role')}>תפקיד ויחידה</th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-white/10" onClick={() => handleSort('start_date')}>תאריך תחילה</th>
                  <th className="px-6 py-4 text-center">התאמות ולוגיסטיקה</th>
                  <th className="px-6 py-4 text-center">סטטוס</th>
                  <th className="px-6 py-4 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedData.map((record) => (
                  <tr key={record.id} className={`hover:bg-slate-50 transition-colors ${record.status === 'left_company' ? 'opacity-60 bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-4 text-center">
                      <input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggleSelectOne(record.id)} disabled={!canEdit} className="w-4 h-4 accent-[#EF6B00] disabled:opacity-50" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-black text-[#002649] text-base flex items-center gap-2">
                        {record.name}
                        {record.status === 'left_company' && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1"><UserMinus size={10}/> עזב/ה</span>}
                      </div>
                      <div className="text-xs text-slate-500 font-bold mt-1">ת.ז: {record.id_num}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">{record.role}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{record.department} <span className="mx-1">|</span> מנהל: {record.manager}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-mono font-bold px-3 py-1.5 rounded-lg ${activeTab==='preboarding' ? 'bg-orange-50 text-[#EF6B00]' : 'bg-slate-100 text-slate-600'}`}>{formatDateHe(record.start_date)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 justify-center max-w-[250px] mx-auto">
                        {record.has_car && <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"><Car size={12}/> רכב חברה</span>}
                        {!record.has_car && record.parking_type !== 'לא' && record.parking_type && <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded text-[10px] font-bold">חניה: {record.parking_type} {record.car_num ? `(${record.car_num})` : ''}</span>}
                        {record.has_mobile && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"><Smartphone size={12}/> נייד</span>}
                        {record.has_cibus && <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"><Coffee size={12}/> סיבוס</span>}
                        {record.is_referral && <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded text-[10px] font-bold">חמ&quot;ח: {record.referral_name}</span>}
                        {record.diversity && <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded text-[10px] font-bold">{record.diversity}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {record.status === 'pending' && <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-100/50 border border-orange-200 px-3 py-1 rounded-xl text-xs font-bold"><Clock size={14}/> ממתין לתחילה</span>}
                      {record.status === 'completed' && <span className="inline-flex items-center gap-1 text-green-600 bg-green-100/50 border border-green-200 px-3 py-1 rounded-xl text-xs font-bold"><CheckCircle2 size={14}/> נקלט בהצלחה</span>}
                      {record.status === 'left_company' && <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl text-xs font-bold"><UserMinus size={14}/> לא פעיל</span>}
                      {record.status === 'cancelled' && <span className="inline-flex items-center gap-1 text-red-600 bg-red-100/50 border border-red-200 px-3 py-1 rounded-xl text-xs font-bold"><XCircle size={14}/> בוטל</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {activeTab === 'preboarding' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => {setEditingRecord(record); setShowForm(true);}} disabled={!canEdit} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed" title="ערוך ועדכן"><Edit3 size={18}/></button>
                          <button onClick={() => updateStatus(record.id, 'completed')} disabled={!canEdit} className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200 disabled:opacity-50 disabled:cursor-not-allowed" title="אשר שהתחיל/ה לעבוד"><CheckCircle2 size={18}/></button>
                          <button onClick={() => { void (async () => { if (await confirmAction("לבטל קליטה (No-Show)?")) updateStatus(record.id, "cancelled"); })(); }} disabled={!canEdit} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed" title="ביטול קליטה"><Trash2 size={18}/></button>
                        </div>
                      ) : activeTab === 'active' && record.status === 'completed' ? (
                        <button onClick={() => { void (async () => { if (await confirmAction("לדווח על סיום העסקה?")) updateStatus(record.id, "left_company"); })(); }} disabled={!canEdit} className="text-slate-400 hover:text-red-500 text-xs font-bold flex items-center gap-1 justify-center mx-auto hover:bg-red-50 p-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"><UserMinus size={14}/> דווח עזיבה</button>
                      ) : (
                        <button onClick={() => { if (canEdit) { setEditingRecord(record); setShowForm(true); } }} disabled={!canEdit} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100 disabled:opacity-50 disabled:cursor-not-allowed">
                          {canEdit ? "צפה בתיק" : "צפייה בלבד"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAndSortedData.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-16 text-slate-400 font-medium">אין נתונים להצגה.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* Side-panel: candidate drill-down. Reads /api/candidates/{key}. */}
      <CandidateSidePanel
        open={!!selectedCandidateKey}
        candidateKey={selectedCandidateKey}
        onClose={() => setSelectedCandidateKey(null)}
      />

      {/* MODAL 1: THE ONBOARDING EDIT FORM         */}
      {/* ========================================= */}
      {showForm && (
        <OnboardingFormModal
          onClose={() => setShowForm(false)}
          existingRecord={editingRecord}
          onSaveSuccess={(record, isNew) => {
             setShowForm(false);
             setEditingRecord(null);
             if (isNew) {
               setOnboardings((prev) => [record, ...prev]);
               setTasks((prev) => prev.map((task) => ({ ...task, done: false })));
               setShowChecklist(record.name);
             } else {
               setOnboardings((prev) => prev.map((row) => (row.id === record.id ? record : row)));
             }
          }}
        />
      )}

      {/* MODAL 1b: PRE-ONBOARDING WIZARD POPUP       */}
      {/* ========================================== */}
      {/* The full SmartOnboarding wizard rendered as a centered popup. The
          wizard owns its own success/exit UX; we just provide the close +
          refresh hooks. Closing via X, ESC, or backdrop click is allowed. */}
      {showWizard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="אשף קליטת עובד חדש"
          className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowWizard(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowWizard(false); }}
        >
          <div className="relative bg-white w-full max-w-[1200px] max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setShowWizard(false)}
              aria-label="סגור אשף"
              className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-slate-200 text-slate-500 hover:text-[#EF6B00] flex items-center justify-center shadow-md transition-colors"
            >
              <X size={18} />
            </button>
            <SmartOnboarding
              onClose={() => setShowWizard(false)}
              onSubmitted={() => { void reloadOnboardings(); }}
            />
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL 2: RECRUITER CHECKLIST              */}
      {/* ========================================= */}
      {showChecklist && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
            <div className="bg-[#002649] text-white p-6 text-center relative">
              <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-[#002649] shadow-lg"><CheckCircle2 size={32}/></div>
              <h2 className="text-2xl font-black">הקליטה שוגרה בהצלחה!</h2>
              <p className="text-blue-200 mt-1">מיילים אוטומטיים נשלחו ל-HRO ולקב&quot;ט עבור {showChecklist}.</p>
              <button onClick={() => setShowChecklist(null)} className="absolute top-4 right-4 text-white/50 hover:text-white"><XCircle size={24}/></button>
            </div>
            
            <div className="p-8">
              <div className="flex justify-between items-end mb-6">
                 <div>
                   <h3 className="font-black text-lg text-[#002649] flex items-center gap-2"><CheckSquare className="text-[#EF6B00]"/> צ&apos;קליסט סגירת משרה</h3>
                   <p className="text-xs text-slate-500 font-bold mt-1">חובה להשלים את הפעולות הבאות כדי למנוע תקלות.</p>
                 </div>
                 <button onClick={() => setIsEditingTasks(!isEditingTasks)} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg"><Settings size={14}/> {isEditingTasks ? 'סיים עריכה' : 'ערוך משימות'}</button>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {tasks.map(task => (
                  <div key={task.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${task.done && !isEditingTasks ? 'bg-green-50 border-green-200 opacity-60' : 'bg-slate-50 border-slate-200 hover:border-blue-300'}`}>
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      {!isEditingTasks && <input type="checkbox" checked={task.done} onChange={() => setTasks(tasks.map(t => t.id === task.id ? {...t, done: !t.done} : t))} className="w-5 h-5 accent-green-600" />}
                      {isEditingTasks ? (
                         <input type="text" value={task.text} onChange={(e) => setTasks(tasks.map(t => t.id === task.id ? {...t, text: e.target.value} : t))} className="flex-1 bg-white border border-blue-200 rounded p-1 text-sm font-bold text-[#002649] outline-none" />
                      ) : (
                         <span className={`text-sm font-bold ${task.done ? 'text-green-700 line-through' : 'text-[#002649]'}`}>{task.text}</span>
                      )}
                    </label>
                    {isEditingTasks && <button onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>}
                  </div>
                ))}
              </div>

              {!isEditingTasks && (
                 <button onClick={() => setShowChecklist(null)} className="w-full bg-[#EF6B00] text-white py-3.5 rounded-xl font-black text-lg shadow-lg hover:bg-[#d65a00] transition-colors mt-8">
                   סיימתי, סגור חלון
                 </button>
              )}
            </div>
          </div>
        </div>
      )}
      {confirmDialog && (
        <div className="fixed inset-0 z-[210] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-black text-[#002649]">אישור פעולה</h3>
              <p className="text-sm text-slate-600 mt-2">{confirmDialog.message}</p>
            </div>
            <div className="p-4 bg-slate-50 flex justify-end gap-3">
              <button onClick={confirmDialog.onCancel} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200">ביטול</button>
              <button onClick={confirmDialog.onConfirm} className="px-5 py-2 rounded-lg font-bold text-white bg-[#002649] hover:bg-[#EF6B00]">אישור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: The Onboarding Edit Form
// ==========================================
interface FormModalProps { onClose: () => void; existingRecord: OnboardingRecord | null; onSaveSuccess: (record: OnboardingRecord, isNew: boolean) => void }

function OnboardingFormModal({ onClose, existingRecord, onSaveSuccess }: Readonly<FormModalProps>) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<Partial<OnboardingRecord>>(existingRecord || {
    name: "", id_num: "", role: "", department: "", manager: "", start_date: "",
    has_car: false, parking_type: "לא", car_num: "",
    has_mobile: false, has_cibus: false,
    is_referral: false, referral_name: "", referral_id: "", diversity: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [sendUpdateNotification, setSendUpdateNotification] = useState(false); // הצ'קבוקס החדש לעדכונים

  const isValidIsraeliId = (rawId: string) => {
    const digits = rawId.replace(/\D/g, "");
    if (!/^\d{5,9}$/.test(digits)) return false;
    const padded = digits.padStart(9, "0");
    let sum = 0;
    for (let i = 0; i < padded.length; i += 1) {
      const num = Number(padded[i]) * ((i % 2) + 1);
      sum += num > 9 ? num - 9 : num;
    }
    return sum % 10 === 0;
  };

  const handleCarToggle = (checked: boolean) => {
    setFormData(prev => ({ ...prev, has_car: checked, ...(checked ? { parking_type: "בזכאות", car_num: "" } : {}) }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.role) { showToast("חובה להזין לפחות שם ותפקיד", "error"); return; }
    if (!isValidIsraeliId(formData.id_num ?? "")) {
      showToast("תעודת זהות אינה תקינה (כולל ספרת ביקורת)", "error");
      return;
    }
    setIsSaving(true);
    
    // סימולציה של שליחת הנתונים לשרת + מיילים
    setTimeout(() => {
      setIsSaving(false);
      if (sendUpdateNotification) {
        showToast("עדכון שותפים — שליחת מייל אוטומטית בקרוב", "coming-soon");
      }
      const savedRecord: OnboardingRecord = {
        id: existingRecord?.id ?? `ob-${Date.now()}`,
        name: formData.name ?? "",
        id_num: formData.id_num ?? "",
        role: formData.role ?? "",
        department: formData.department ?? "",
        manager: formData.manager ?? "",
        start_date: formData.start_date ?? new Date().toISOString().slice(0, 10),
        has_car: Boolean(formData.has_car),
        parking_type: formData.parking_type ?? "לא",
        car_num: formData.car_num ?? "",
        has_mobile: Boolean(formData.has_mobile),
        has_cibus: Boolean(formData.has_cibus),
        is_referral: Boolean(formData.is_referral),
        referral_name: formData.referral_name ?? "",
        referral_id: formData.referral_id ?? "",
        diversity: formData.diversity ?? "",
        status: existingRecord?.status ?? "pending",
        created_at: existingRecord?.created_at ?? new Date().toISOString(),
      };
      onSaveSuccess(savedRecord, !existingRecord);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-2xl font-black text-[#002649] flex items-center gap-2">
            <UserCheck className="text-[#EF6B00]"/> {existingRecord ? "צפייה ועריכת תיק מועמד" : "טופס קליטת עובד"}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"><XCircle size={24}/></button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 space-y-8 bg-slate-50/30">
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-[#002649] mb-4 text-sm border-b pb-2">פרטים אישיים וארגוניים</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">שם מלא</label><input type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">תעודת זהות</label><input type="text" value={formData.id_num} onChange={e=>setFormData({...formData, id_num: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">תאריך תחילת עבודה</label><input type="date" value={formData.start_date} onChange={e=>setFormData({...formData, start_date: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">תפקיד מיועד</label><input type="text" value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">יחידה / מחלקה</label><input type="text" value={formData.department} onChange={e=>setFormData({...formData, department: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">מנהל ישיר</label><input type="text" value={formData.manager} onChange={e=>setFormData({...formData, manager: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-[#002649] mb-4 text-sm border-b pb-2">לוגיסטיקה וזכאויות</h3>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[#002649]"><input type="checkbox" checked={formData.has_mobile} onChange={e=>setFormData({...formData, has_mobile: e.target.checked})} className="w-4 h-4 accent-[#EF6B00]"/> נייד</label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[#002649]"><input type="checkbox" checked={formData.has_cibus} onChange={e=>setFormData({...formData, has_cibus: e.target.checked})} className="w-4 h-4 accent-[#EF6B00]"/> סיבוס</label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[#002649]"><input type="checkbox" checked={formData.has_car} onChange={e=>handleCarToggle(e.target.checked)} className="w-4 h-4 accent-[#EF6B00]"/> רכב</label>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">זכאות חניה</label>
                <select value={formData.parking_type} onChange={e=>setFormData({...formData, parking_type: e.target.value})} disabled={formData.has_car} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none disabled:opacity-50">
                  <option value="לא">ללא זכאות</option>
                  <option value="בזכאות">בזכאות קבועה</option>
                  <option value="ללא זכאות">על בסיס מקום פנוי</option>
                </select>
              </div>
              {formData.parking_type !== "לא" && !formData.has_car && (
                 <div className="mt-3"><label className="text-xs font-bold text-slate-500 mb-1 block">מספר רכב</label><input type="text" value={formData.car_num || ''} onChange={e=>setFormData({...formData, car_num: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none" placeholder="123-45-678" /></div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-[#002649] mb-4 text-sm border-b pb-2">חבר מביא חבר / גיוון</h3>
              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[#002649]"><input type="checkbox" checked={formData.is_referral} onChange={e=>setFormData({...formData, is_referral: e.target.checked})} className="w-4 h-4 accent-[#002649]"/> חבר מביא חבר</label>
                {formData.is_referral && (
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div><label className="text-[10px] font-bold text-slate-500 mb-1 block">שם הממליץ</label><input type="text" value={formData.referral_name || ''} onChange={e=>setFormData({...formData, referral_name: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold outline-none" /></div>
                    <div><label className="text-[10px] font-bold text-slate-500 mb-1 block">ת.ז המפנה</label><input type="text" value={formData.referral_id || ''} onChange={e=>setFormData({...formData, referral_id: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold outline-none" /></div>
                  </div>
                )}
                
                <div className="pt-2 border-t">
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">אוכלוסיית יעד (גיוון והכלה)</label>
                  <select value={formData.diversity || ''} onChange={e=>setFormData({...formData, diversity: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold text-[#002649] outline-none">
                    <option value="">ללא שיוך מיוחד</option>
                    <option value="חברה ערבית">חברה ערבית</option>
                    <option value="חברה חרדית">חברה חרדית</option>
                    <option value="עמותת שווים">עמותת שווים (מוגבלויות)</option>
                    <option value="קרבה משפחתית">קרבה משפחתית להנהלה</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-between items-center gap-4">
          {existingRecord ? (
             <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 text-blue-800 font-bold text-sm hover:bg-blue-100 transition-colors">
               <input type="checkbox" checked={sendUpdateNotification} onChange={e=>setSendUpdateNotification(e.target.checked)} className="w-4 h-4 accent-blue-600" />
               <Send size={16}/> שלח עדכונים לשותפים (HRO/קב&quot;ט)
             </label>
          ) : <div></div>}
          
          <div className="flex gap-4">
            <button onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">ביטול</button>
            <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 font-black text-white bg-[#002649] hover:bg-[#EF6B00] rounded-xl transition-colors shadow-lg flex items-center gap-2">
              {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
              {existingRecord ? "שמור שינויים" : "שמור קליטה"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}