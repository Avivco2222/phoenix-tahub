"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Users, Building2, Receipt, Target, Clock, FileText, Loader2,
  CheckCircle2, Plus, HeartHandshake, Power, Briefcase, Calculator, Sparkles,
  UserMinus, X, Zap, Scale, Save, Layers, ShieldCheck, AlertOctagon, RefreshCw, Trash2, Edit3,
  Filter, Download, History, AlertTriangle, Undo2
} from "lucide-react";
import { AdminConfigProvider, useAdminConfig } from "./components/targets/useAdminConfig";
import TargetsTab from "./components/targets/TargetsTab";
import { getAdminAuthHeader, getAdminHeaders, getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useDataVersionRefresh } from "@/context/DataVersionContext";
import { BatchesTab } from "./components/BatchesTab";
import { QualityTab } from "./components/QualityTab";
import AdminShell from "./components/AdminShell";
import AppsManagementTab from "./components/AppsManagementTab";
import AuditLogTab from "./components/AuditLogTab";
import NotificationsTab from "./components/NotificationsTab";
import SmartIngestPanel from "./components/SmartIngestPanel";

export interface FileStatus {
  name: string;
  date: string;
  rows: string | number;
  status: "pending" | "success" | "error";
  errorMsg?: string;
}

// --- Admin page types ---
interface SystemHealthLog {
  id: string;
  timestamp: string;
  action: string;
  status: string;
  details: string;
  user: string;
  filename: string;
  upload_date: string;
  rows_processed: number;
  log_id: string;
}

interface MissingDataAlert {
  type: string;
  message: string;
  count: number;
  field: string;
}

interface SystemHealthData {
  missing_data: MissingDataAlert[];
  logs: SystemHealthLog[];
  candidate_count: number;
  job_count: number;
  last_upload: string;
  health_score: number;
  total_records: number;
}

// Inbox-analytics interfaces (AnalyticsTaskType / AnalyticsRecruiter /
// AnalyticsData / TypeBar / RecruiterRow) removed in A9-FU UX cleanup
// along with the demo backend endpoint at /api/admin/inbox-analytics.

interface StatMiniCardProps {
  label: string;
  value: string | number;
  sub: string;
  color: string;
}

interface DropzoneBoxProps {
  fileType: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  status: { status: string; name: string; rows: number | string; errorMsg?: string };
  inputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: (fileType: string) => Promise<void>;
  uploading: boolean;
  downloadingTemplate: boolean;
}

interface TabNavProps {
  id: string;
  active: string;
  setter: (id: string) => void;
  icon: React.ReactNode;
  label: string;
}

interface FileMeta {
  title: string;
  icon: React.ReactNode;
  color: string;
}

interface PreflightReport {
  filename: string;
  schema_version: string;
  payload_hash: string;
  rows_received: number;
  duplicate_rows: number;
  duplicate_rate: number;
  mandatory_issue_rows: number;
  error_rate: number;
  can_ingest: boolean;
  max_error_rate: number;
}

interface BatchStatusRow {
  batch_id: string;
  filename: string;
  schema_version: string;
  status: string;
  rows_received: number;
  rows_loaded: number;
  rows_rejected: number;
  duplicate_rows: number;
  quality_score: number;
}

interface EtlRule {
  id?: string;
  col_name: string;
  condition: string;
  action: string;
  active: boolean;
}

const normalizeErrorMessage = (detail: unknown, fallback = "שגיאת קריאת קובץ"): string => {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first && typeof (first as { msg?: unknown }).msg === "string") {
      return (first as { msg: string }).msg;
    }
    const asJson = JSON.stringify(detail);
    return asJson && asJson !== "[]" ? asJson : fallback;
  }
  if (detail && typeof detail === "object") {
    if ("msg" in detail && typeof (detail as { msg?: unknown }).msg === "string") {
      return (detail as { msg: string }).msg;
    }
    if ("detail" in detail && typeof (detail as { detail?: unknown }).detail === "string") {
      return (detail as { detail: string }).detail;
    }
    const asJson = JSON.stringify(detail);
    return asJson && asJson !== "{}" ? asJson : fallback;
  }
  return fallback;
};

function AdminCommandCenter() {
  const { config: adminConfig } = useAdminConfig();
  const { showToast } = useToast();
  // Push freshness signal to /candidates, /jobs, dashboard etc. after a batch lands.
  const refreshDataVersion = useDataVersionRefresh();
  const [activeTab, setActiveTab] = useState("data");
  
  // --- Live Data States ---
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [etlRules, setEtlRules] = useState<EtlRule[]>([]);
  const [batchBoard, setBatchBoard] = useState<BatchStatusRow[]>([]);
  const [showDiffMode, setShowDiffMode] = useState(false);
  const [lastPreflight, setLastPreflight] = useState<PreflightReport | null>(null);
  const [smartMode, setSmartMode] = useState(true);
  
  // --- Rules Form State ---
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<EtlRule>({ col_name: "", condition: "", action: "", active: true });
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  useEffect(() => {
    fetchSystemHealth();
    fetchEtlRules();
    fetchBatchBoard();
  }, []);

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

  // ==========================================
  // API FETCHERS (The Real Pipeline)
  // ==========================================
  const fetchSystemHealth = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/health`);
      if (res.ok) setSystemHealth(await res.json());
    } catch (e) { console.error("Error fetching health", e); }
  };

  const fetchEtlRules = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/rules`, { headers: getAdminHeaders() });
      if (res.ok) setEtlRules(await res.json());
    } catch (e) { console.error("Error fetching rules", e); }
  };

  const fetchBatchBoard = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/ingestion/batches?limit=20`, { headers: getAdminHeaders() });
      if (res.ok) setBatchBoard(await res.json());
    } catch (e) { console.error("Error fetching batches", e); }
  };

  // ==========================================
  // ACTIONS
  // ==========================================
  const handleLiveUpload = async (type: string, file: File) => {
    setIsUploading(type);
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

    try {
      // === Stage 1: typed preflight via the new unified pipeline ===
      const preflightForm = new FormData();
      preflightForm.append("file", file);
      const preflightRes = await fetch(`${apiBase}/api/ingest/preflight/${encodeURIComponent(type)}`, {
        method: "POST",
        credentials: "include",
        body: preflightForm,
      });
      const preflightData = (await preflightRes.json()) as {
        rows_total?: number;
        rows_valid?: number;
        rows_rejected?: number;
        required_columns?: string[];
        sample_rejections?: { reasons: string[]; row_keys: string[] }[];
        detail?: string;
      };
      if (!preflightRes.ok) {
        setFilesStatus(prev => ({ ...prev, [type]: { name: file.name, date: "-", rows: "נכשל", status: "error", errorMsg: preflightData.detail || "Preflight נכשל" } }));
        return;
      }
      const valid = preflightData.rows_valid || 0;
      const rejected = preflightData.rows_rejected || 0;
      const total = preflightData.rows_total || 0;
      if (valid === 0) {
        const sampleReasons = (preflightData.sample_rejections || []).slice(0, 3).map(r => r.reasons.join(", ")).join("; ");
        setFilesStatus(prev => ({ ...prev, [type]: { name: file.name, date: "-", rows: `נפסל (${rejected}/${total})`, status: "error", errorMsg: sampleReasons || "אף שורה לא עברה אימות" } }));
        return;
      }
      const approved = await confirmAction(
        `Preflight עבר.\nשורות כולל: ${total}\nתקפות לטעינה: ${valid}\nנדחו: ${rejected}\n\nלהמשיך להעלאה בפועל?`
      );
      if (!approved) {
        setFilesStatus(prev => ({ ...prev, [type]: { name: file.name, date: "-", rows: "בוטל", status: "pending" } }));
        return;
      }

      // === Stage 2: real ingest ===
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${apiBase}/api/ingest/${encodeURIComponent(type)}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = (await res.json()) as {
        status?: string;
        batch_id?: string;
        stats?: { received: number; inserted: number; updated: number; skipped_duplicate: number; rejected: number;
                  candidates_inserted?: number; applications_inserted?: number; applications_skipped?: number;
                  jobs_inserted?: number; };
        detail?: string;
      };

      if (res.ok && data.stats) {
        const s = data.stats;
        // Build a user-readable summary for the row status.
        const parts: string[] = [];
        if (s.candidates_inserted) parts.push(`${s.candidates_inserted} מועמדים חדשים`);
        if (s.candidates_inserted === 0 && s.applications_inserted) parts.push(`${s.applications_inserted} איטרציות חדשות`);
        if (s.inserted && !parts.length) parts.push(`${s.inserted} חדשות`);
        if (s.updated) parts.push(`${s.updated} עודכנו`);
        if (s.skipped_duplicate) parts.push(`${s.skipped_duplicate} כפילויות`);
        if (s.rejected) parts.push(`${s.rejected} נדחו`);
        const summary = parts.join(" · ") || `${s.received} עובדו`;

        setFilesStatus(prev => ({ ...prev, [type]: { name: file.name, date: new Date().toLocaleTimeString('he-IL'), rows: summary, status: "success" } }));
        fetchSystemHealth();
        fetchBatchBoard();
        // DataVersionContext normally polls every 30s. Trigger it immediately
        // so /candidates, /jobs, dashboard etc. show the fresh rows before the
        // admin even switches tabs.
        await refreshDataVersion();
        showToast(`✓ ${summary}`, "success");
      } else {
        setFilesStatus(prev => ({ ...prev, [type]: { name: file.name, date: new Date().toLocaleTimeString('he-IL'), rows: "נכשל", status: "error", errorMsg: data.detail || "Upload failed" } }));
      }
    } catch (error: unknown) {
      setFilesStatus(prev => ({ ...prev, [type]: { name: file.name, date: "-", rows: "נכשל", status: "error", errorMsg: error instanceof Error ? error.message : "השרת לא מגיב." } }));
    } finally {
      setIsUploading(null);
    }
  };

  const handleRevertUpload = async (logId: string) => {
    const approved = await confirmAction("האם למחוק את הרשומות של העלאה זו?");
    if (!approved) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/revert/${logId}`, { method: 'POST', headers: getAdminHeaders() });
      if (!res.ok) throw new Error("Rollback failed");
      fetchSystemHealth();
      fetchBatchBoard();
      showToast("בוצע Rollback בהצלחה", "success");
    } catch {
      showToast("שגיאה בביטול העלאה (Rollback)", "error");
    }
  };

  const handleSaveRule = async () => {
    if (!ruleForm.col_name || !ruleForm.action) return;
    try {
      const payload = editingRuleId ? { ...ruleForm, id: editingRuleId } : ruleForm;
      const res = await fetch(`${getApiBaseUrl()}/api/admin/rules`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("save rule failed");
      fetchEtlRules();
      setShowRuleForm(false);
      setEditingRuleId(null);
      setRuleForm({ col_name: "", condition: "", action: "", active: true });
      showToast("הכלל נשמר בהצלחה", "success");
    } catch (e) { 
      console.error(e);
      showToast("שמירת כלל נכשלה", "error");
    }
  };

  const handleDeleteRule = async (id: string) => {
    const approved = await confirmAction("למחוק כלל זה?");
    if (!approved) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/rules/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
      if (!res.ok) throw new Error("delete rule failed");
      fetchEtlRules();
      showToast("הכלל נמחק בהצלחה", "success");
    } catch {
      showToast("מחיקת כלל נכשלה", "error");
    }
  };

  const openEditRule = (rule: EtlRule) => {
    setRuleForm({ col_name: rule.col_name, condition: rule.condition, action: rule.action, active: rule.active });
    setEditingRuleId(rule.id!);
    setShowRuleForm(true);
  };
  const [downloadingTemplate, setDownloadingTemplate] = useState<string | null>(null);

  const handleDownloadTemplate = async (fileType: string) => {
    setDownloadingTemplate(fileType);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/ingestion/template/${fileType}`, {
        headers: getAdminAuthHeader(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(normalizeErrorMessage((body as { detail?: unknown }).detail, "הורדת תבנית נכשלה"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileType}-master-template.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFilesStatus(prev => ({
        ...prev,
        [fileType]: {
          ...prev[fileType],
          status: "error",
          rows: "תבנית",
          errorMsg: normalizeErrorMessage(error instanceof Error ? error.message : error, "הורדת תבנית נכשלה"),
        }
      }));
    } finally {
      setDownloadingTemplate(null);
    }
  };

  // --- File Upload Definitions ---
  const fileRefs: Record<string, React.RefObject<HTMLInputElement | null>> = { candidates: useRef(null), jobs: useRef(null), hires: useRef(null), diversity: useRef(null), headcount: useRef(null), budget: useRef(null), attrition: useRef(null) };
  const [filesStatus, setFilesStatus] = useState<Record<string, FileStatus>>({ candidates: { name: "ממתין", date: "-", rows: "-", status: "pending" }, jobs: { name: "ממתין", date: "-", rows: "-", status: "pending" }, hires: { name: "ממתין", date: "-", rows: "-", status: "pending" }, diversity: { name: "ממתין", date: "-", rows: "-", status: "pending" }, headcount: { name: "ממתין", date: "-", rows: "-", status: "pending" }, budget: { name: "ממתין", date: "-", rows: "-", status: "pending" }, attrition: { name: "ממתין", date: "-", rows: "-", status: "pending" } });
  const FILE_META: Record<string, FileMeta> = { candidates: { title: "מועמדים (ATS)", icon: <Users size={24} />, color: "blue" }, jobs: { title: "משרות פתוחות", icon: <Briefcase size={24} />, color: "orange" }, hires: { title: "קליטות", icon: <CheckCircle2 size={24} />, color: "green" }, diversity: { title: "גיוון", icon: <HeartHandshake size={24} />, color: "pink" }, headcount: { title: "תקן מצבה", icon: <Building2 size={24} />, color: "purple" }, budget: { title: "תקציב", icon: <Receipt size={24} />, color: "emerald" }, attrition: { title: "עזיבות", icon: <UserMinus size={24} />, color: "red" } };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-4">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
            מרכז שליטה ובקרה <ShieldCheck className="text-[#EF6B00]" size={32} />
          </h1>
          <p className="text-slate-500 mt-2 font-medium">קליטת נתונים (ETL), טיוב דאטה וניטור ביצועי מגייסים.</p>
        </div>
        
        {systemHealth && (
          <div className="flex items-center gap-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">בריאות נתונים (Health)</div>
              <div className={`text-3xl font-black ${systemHealth.health_score > 90 ? 'text-green-500' : systemHealth.health_score > 70 ? 'text-orange-500' : 'text-red-500'}`}>
                {systemHealth.health_score}%
              </div>
            </div>
            <div className="w-px h-10 bg-slate-200"></div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">רשומות פעילות במסד</div>
              <div className="text-2xl font-black text-[#002649]">{systemHealth.total_records.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* NAVIGATION — 3-group / sub-tab shell.
          Replaces 7 flat tabs with 3 groups. AdminShell owns the URL state
          (?group=&sub=) and fires onChange; we map the canonical sub-tab ids
          back to the legacy activeTab keys so the content blocks below stay
          untouched. */}
      <AdminShell
        badges={{
          batches: batchBoard.filter(b => b.status === "pending").length,
        }}
        onChange={({ sub }) => {
          const subToTab: Record<string, string> = {
            ingest: "data", batches: "batches", quality: "quality",
            targets: "targets", rules: "rules", permissions: "permissions",
            apps: "apps", notifications: "notifications",
            "audit-log": "audit-log",
          };
          const mapped = subToTab[sub] ?? "data";
          if (mapped !== activeTab) setActiveTab(mapped);
        }}
      />

      {/* APPS MANAGEMENT sub-tab — admin controls visibility + tags for the
          /ai-hub apps registry. */}
      {activeTab === "apps" && <AppsManagementTab />}

      {/* NOTIFICATIONS sub-tab — send manual notifications + view history. */}
      {activeTab === "notifications" && <NotificationsTab />}

      {/* AUDIT-LOG sub-tab (A9-FU UX wave 2) — server-side filterable view
          over audit_logs, no password gate. BatchesTab links here via
          ?audit_batch=<batch_id> to deep-link to a single batch's activity. */}
      {activeTab === "audit-log" && <AuditLogTab />}

      {/* PERMISSIONS sub-tab — link out to dedicated page (kept separate
          because it has its own RBAC checks + heavy state). */}
      {activeTab === "permissions" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#002649] text-white flex items-center justify-center">
            <Users size={28} />
          </div>
          <h3 className="text-xl font-black text-[#002649]">ניהול הרשאות ומשתמשים</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            דף הרשאות מנוהל בנפרד בשל בדיקות RBAC מורחבות ועריכה משולבת של משתמשים, מודולים וכללים דינמיים.
          </p>
          <Link
            href="/admin/permissions"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#002649] text-white font-black shadow-md hover:bg-[#EF6B00] transition-colors"
          >
            <Users size={16} />
            פתח דף הרשאות
          </Link>
        </div>
      )}

      {/* TAB 1: DATA DROPZONES */}
      {activeTab === "data" && (
        <div className="space-y-8 animate-in slide-in-from-right-4">

          {/* Smart Ingest / Advanced mode toggle */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-black text-[#002649]">
                {smartMode ? "Smart Ingest — Excel מאוחד" : "מצב מתקדם — 7 קבצים נפרדים"}
              </div>
              <div className="text-xs text-slate-500">
                {smartMode
                  ? "קובץ Excel אחד עם גיליונות מרובים — המערכת מנתבת אוטומטית לכל handler"
                  : "העלאה נפרדת לכל סוג נתון — מצב מתקדם עם Diff Mode"}
              </div>
            </div>
            <button
              onClick={() => setSmartMode((p) => !p)}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#002649] text-white hover:bg-[#EF6B00] transition-colors"
            >
              {smartMode ? "מצב מתקדם (7 קבצים)" : "Smart Ingest (Excel מאוחד)"}
            </button>
          </div>

          {smartMode ? (
            <SmartIngestPanel
              onSuccess={async () => {
                await refreshDataVersion();
                fetchBatchBoard();
                fetchSystemHealth();
              }}
            />
          ) : (
            <>
              {/* Advanced mode: Diff Mode toggle */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-[#002649]">Diff Mode בייבוא קבצים</div>
                  <div className="text-xs text-slate-500">השוואה מקדימה בין קובץ חדש למצב הנתונים לפני קליטה.</div>
                </div>
                <button onClick={() => setShowDiffMode((prev) => !prev)} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#002649] text-white hover:bg-[#EF6B00]">
                  {showDiffMode ? "הסתר Diff" : "הצג Diff"}
                </button>
              </div>
              {showDiffMode && lastPreflight && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <DiffStat label="Rows בקובץ" value={`${lastPreflight.rows_received}`} />
                  <DiffStat label="חדשים לקליטה" value={`${Math.max(0, lastPreflight.rows_received - lastPreflight.duplicate_rows - lastPreflight.mandatory_issue_rows)}`} />
                  <DiffStat label="כפולים (Update)" value={`${lastPreflight.duplicate_rows}`} />
                  <DiffStat label="שורות שייפסלו" value={`${lastPreflight.mandatory_issue_rows}`} />
                </div>
              )}
              {(systemHealth?.missing_data?.length ?? 0) > 0 && systemHealth && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
                  <AlertOctagon className="text-red-500 shrink-0" size={24} />
                  <div>
                    <h3 className="font-black text-red-800">התראות טיוב נתונים פעילות</h3>
                    <ul className="mt-2 space-y-1">
                      {systemHealth.missing_data.map((alert: MissingDataAlert, idx: number) => (
                        <li key={idx} className="text-sm font-bold text-red-700">⚠️ מצאנו {alert.count} רשומות חסרות: {alert.field}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Object.keys(filesStatus).map((key) => {
                  const meta = FILE_META[key];
                  return (
                    <DropzoneBox key={key} fileType={key} title={meta.title} icon={meta.icon} color={meta.color} status={filesStatus[key]} inputRef={fileRefs[key]} uploading={isUploading === key} onDownloadTemplate={handleDownloadTemplate} downloadingTemplate={downloadingTemplate === key}
                      onUpload={(e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleLiveUpload(key, f); }}
                    />
                  );
                })}
              </div>
            </>
          )}

          {(systemHealth?.logs?.length ?? 0) > 0 && systemHealth && (
             <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-8">
               <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                 <h3 className="font-black text-lg text-[#002649] flex items-center gap-2"><RefreshCw size={18} className="text-blue-500"/> היסטוריית טעינות (ETL Logs)</h3>
                 <button onClick={fetchSystemHealth} className="text-slate-400 hover:text-blue-600"><RefreshCw size={16}/></button>
               </div>
               <table className="w-full text-right text-sm">
                 <thead className="bg-white text-slate-400 font-bold text-xs uppercase border-b border-slate-100">
                   <tr><th className="px-6 py-3">קובץ</th><th className="px-6 py-3">תאריך סנכרון</th><th className="px-6 py-3">רשומות</th><th className="px-6 py-3">סטטוס</th><th className="px-6 py-3">פעולה</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {systemHealth.logs.map((log: SystemHealthLog, i: number) => (
                     <tr key={i} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-3 font-bold text-[#002649]">{log.filename}</td>
                       <td className="px-6 py-3 text-slate-500">{log.upload_date}</td>
                       <td className="px-6 py-3 font-mono font-bold text-blue-600">{log.rows_processed}</td>
                       <td className="px-6 py-3"><span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${log.status === 'Success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{log.status}</span></td>
                       <td className="px-6 py-3">
                         {log.status === 'Success' && <button onClick={() => handleRevertUpload(log.log_id)} className="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 text-xs font-bold"><Trash2 size={14}/> Rollback</button>}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          )}

          {batchBoard.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-8">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-black text-lg text-[#002649] flex items-center gap-2">
                  <Sparkles size={18} className="text-[#EF6B00]" /> Batch Status Board
                </h3>
                <button onClick={fetchBatchBoard} className="text-slate-400 hover:text-blue-600"><RefreshCw size={16}/></button>
              </div>
              <table className="w-full text-right text-sm">
                <thead className="bg-white text-slate-400 font-bold text-xs uppercase border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Batch</th>
                    <th className="px-6 py-3">קובץ</th>
                    <th className="px-6 py-3">סטטוס</th>
                    <th className="px-6 py-3">Received</th>
                    <th className="px-6 py-3">Loaded</th>
                    <th className="px-6 py-3">Rejected</th>
                    <th className="px-6 py-3">Dup</th>
                    <th className="px-6 py-3">Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {batchBoard.map((b) => (
                    <tr key={b.batch_id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-mono text-xs text-slate-500">{b.batch_id}</td>
                      <td className="px-6 py-3 font-bold text-[#002649]">{b.filename}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${b.status === 'committed' ? 'bg-green-100 text-green-700' : b.status === 'reverted' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-3">{b.rows_received}</td>
                      <td className="px-6 py-3">{b.rows_loaded}</td>
                      <td className="px-6 py-3">{b.rows_rejected}</td>
                      <td className="px-6 py-3">{b.duplicate_rows}</td>
                      <td className="px-6 py-3 font-black text-[#002649]">{b.quality_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DATA QUARANTINE & RULES */}
      {activeTab === "rules" && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
          <div className="bg-[#002649] text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row gap-6 items-center">
            <div className="p-4 bg-blue-500/20 rounded-full text-blue-300"><Layers size={48} /></div>
            <div>
              <h2 className="text-2xl font-black mb-2">מנוע טיוב נתונים אוטומטי (ETL Pipeline)</h2>
              <p className="text-blue-100 font-medium">המערכת מעבירה כל קובץ אקסל שנטען דרך חוקי הסינון שלהלן. ניתן לערוך, להוסיף ולמחוק חוקים שיחולו על ההעלאות הבאות.</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-[#002649] flex items-center gap-2"><Filter className="text-[#EF6B00]"/> חוקי נורמליזציה פעילים</h3>
              <button onClick={() => { setRuleForm({col_name: "", condition: "", action: "", active: true}); setEditingRuleId(null); setShowRuleForm(true); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-[#EF6B00] transition-all flex items-center gap-2 font-bold"><Plus size={16}/> כלל חדש</button>
            </div>

            {showRuleForm && (
              <div className="mb-6 p-5 bg-orange-50 border border-orange-200 rounded-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-black text-[#002649]">{editingRuleId ? "עריכת כלל קיים" : "הגדרת כלל חדש"}</span>
                  <button onClick={() => setShowRuleForm(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">עמודה באקסל (מטרה)</label>
                    <input type="text" value={ruleForm.col_name} onChange={e => setRuleForm({...ruleForm, col_name: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">תנאי (If)</label>
                    <input type="text" value={ruleForm.condition} onChange={e => setRuleForm({...ruleForm, condition: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">פעולת תיקון (Then)</label>
                    <input type="text" value={ruleForm.action} onChange={e => setRuleForm({...ruleForm, action: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveRule} className="bg-[#EF6B00] text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-md"><Save size={16}/> {editingRuleId ? "עדכן כלל" : "הפעל כלל"}</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {etlRules.map((rule) => (
                <div key={rule.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between group">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 w-48"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="font-bold text-[#002649] text-sm">{rule.col_name}</span></div>
                    <div className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm w-48 text-center">{rule.condition}</div>
                    <div className="text-slate-400 text-lg">➔</div>
                    <div className="text-sm font-black text-[#EF6B00] bg-orange-50 px-3 py-1.5 rounded-lg">{rule.action}</div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditRule(rule)} className="text-slate-400 hover:text-blue-600 p-1"><Edit3 size={18}/></button>
                    <button onClick={() => handleDeleteRule(rule.id!)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI INBOX ANALYTICS + CONSUMER MAP removed (A9-FU UX cleanup):
          the backend endpoints returned is_demo:true placeholder payloads
          with no real aggregation behind them. The "ביצועים" admin group
          was retired in AdminShell at the same time. */}

      {activeTab === "targets" && <TargetsTab />}

      {activeTab === "batches" && <BatchesTab onRefresh={async () => { await refreshDataVersion(); fetchBatchBoard(); }} />}

      {activeTab === "quality" && <QualityTab />}

      {confirmDialog && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-black text-[#002649]">אישור פעולה</h3>
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{confirmDialog.message}</p>
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

// --- SUB-COMPONENTS ---
function StatMiniCard({ label, value, sub, color }: StatMiniCardProps) { return ( <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p><div className={`text-3xl font-black ${color} mt-1`}>{value}</div><p className="text-[10px] font-bold text-slate-400 mt-1">{sub}</p></div> ); }
// TypeBar / RecruiterRow removed alongside the inbox-analytics view (A9-FU UX cleanup).
const DROPZONE_COLOR_MAP: Record<string, string> = { blue: "border-blue-200 bg-blue-50/50 hover:border-blue-500", orange: "border-orange-200 bg-orange-50/50 hover:border-orange-500", green: "border-green-200 bg-green-50/50 hover:border-green-500", pink: "border-pink-200 bg-pink-50/50 hover:border-pink-500", purple: "border-purple-200 bg-purple-50/50 hover:border-purple-500", emerald: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-500", red: "border-red-200 bg-red-50/50 hover:border-red-500" };
function DropzoneBox({ fileType, title, icon, color, status, inputRef, onUpload, onDownloadTemplate, uploading, downloadingTemplate }: DropzoneBoxProps) { const isError = status.status === "error"; return ( <div className={`border-2 border-dashed rounded-3xl p-6 transition-all flex flex-col items-center text-center relative group w-full ${isError ? 'border-red-500 bg-red-50' : DROPZONE_COLOR_MAP[color]}`}> <button type="button" className="w-full text-inherit" onClick={() => inputRef.current?.click()} > <input type="file" ref={inputRef} className="hidden" onChange={onUpload} accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" /> <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm mb-4 transition-transform mx-auto ${isError ? 'bg-red-500 text-white' : 'bg-white text-[#002649] group-hover:scale-110'}`}> {uploading ? <Loader2 size={24} className="animate-spin text-slate-400"/> : isError ? <X size={24} /> : icon} </div> <h3 className="font-black text-[#002649] text-sm mb-1">{title}</h3> <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">גרור/לחץ להעלאה</div> {isError ? ( <div className="w-full bg-red-100/80 p-3 rounded-2xl text-[10px] font-bold text-red-800 text-right border border-red-200"> שגיאה: {String(status.errorMsg ?? "שגיאת קריאת קובץ")} </div> ) : ( <div className="w-full bg-white p-3 rounded-2xl text-[10px] space-y-1.5 text-right text-slate-600 shadow-sm border border-slate-100"> <div className="flex justify-between items-center border-b border-slate-100 pb-1.5"><span className="font-bold opacity-50">קובץ:</span><span className="font-black text-[#002649] truncate max-w-[100px]">{status.name}</span></div> <div className="flex justify-between items-center"><span className="font-bold opacity-50">רשומות תקינות:</span><span className="font-black text-green-600">{status.rows}</span></div> </div> )} </button> <button type="button" className="mt-3 w-full bg-white/90 hover:bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-black text-[#002649] flex items-center justify-center gap-2 transition-colors" onClick={(e) => { e.stopPropagation(); void onDownloadTemplate(fileType); }} disabled={downloadingTemplate}> {downloadingTemplate ? <Loader2 size={14} className="animate-spin text-slate-500" /> : <Download size={14} />} {downloadingTemplate ? "מוריד תבנית..." : "הורד תבנית מאסטר (.xlsx)"} </button> </div> ); }
function TabNav({ id, active, setter, icon, label }: TabNavProps) { const isActive = active === id; return ( <button onClick={() => setter(id)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all ${isActive ? 'bg-[#002649] text-white shadow-md' : 'text-slate-500 hover:text-[#002649] hover:bg-slate-200/50'}`}> {icon} {label} </button> ); }

function DiffStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl bg-white border border-purple-100 px-3 py-2">
      <div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className="text-sm font-black text-[#002649] mt-1">{value}</div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminConfigProvider>
      <AdminCommandCenter />
    </AdminConfigProvider>
  );
}