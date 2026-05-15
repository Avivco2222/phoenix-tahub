"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import {
  FileText, Loader2, Download, BarChart2, Briefcase,
  Calendar, ChevronDown, CheckCircle2, AlertTriangle, Info
} from "lucide-react";
import { getAdminHeaders, getApiBaseUrl } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobOption {
  job_id: string | null;
  job_title: string;
  department: string;
  recruiter: string;
  is_active: boolean;
  active_candidates: number;
  /** ISO date string of earliest application, used as default date_from */
  start_date?: string;
}

type ReportTab = "weekly" | "manager";

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = globalThis.URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => globalThis.URL.revokeObjectURL(url), 5000);
}

// ── Sub-component: tab button ─────────────────────────────────────────────────

function TabBtn({
  active, onClick, icon, label, desc,
}: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-start gap-3 p-4 rounded-2xl border-2 text-right transition-all ${
        active
          ? "border-[#002649] bg-[#002649]/5"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className={`mt-0.5 p-2 rounded-xl ${active ? "bg-[#002649] text-white" : "bg-slate-100 text-slate-500"}`}>
        {icon}
      </div>
      <div>
        <div className={`font-bold text-sm ${active ? "text-[#002649]" : "text-slate-700"}`}>{label}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReportsGenerator() {
  const { showToast } = useToast();
  const apiBase = getApiBaseUrl();

  const [tab, setTab]             = useState<ReportTab>("manager");
  const [generating, setGenerating] = useState(false);

  // Manager report state
  const [jobs, setJobs]               = useState<JobOption[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo]     = useState<string>(today());

  // Fetch jobs on mount
  useEffect(() => {
    setLoadingJobs(true);
    fetch(`${apiBase}/api/jobs?status=all`, {
      credentials: "include",
      headers: getAdminHeaders(),
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: JobOption[]) => {
        setJobs(data);
        // Auto-select first active job
        const first = data.find((j: JobOption) => j.is_active) ?? data[0];
        if (first) setSelectedJobId(first.job_id ?? first.job_title);
      })
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
  }, [apiBase]);

  // When job changes, reset date_from to earliest known date (we don't have it here,
  // so just clear it — backend defaults to earliest application date)
  const selectedJob = jobs.find(j => (j.job_id ?? j.job_title) === selectedJobId);

  // ── Generate weekly PDF ──────────────────────────────────────────────────
  const generateWeekly = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${apiBase}/api/tools/generate-report`, {
        method: "POST",
        headers: getAdminHeaders(),
        credentials: "include",
        body: JSON.stringify({ type: "weekly" }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "TAHub_Weekly_Report.pdf");
      showToast("הדוח הורד בהצלחה ✅", "success");
    } catch {
      showToast("שגיאה בהפקת הדוח — ודא שהשרת פעיל", "error");
    } finally {
      setGenerating(false);
    }
  };

  // ── Generate manager PDF ─────────────────────────────────────────────────
  const generateManager = async () => {
    if (!selectedJobId) {
      showToast("יש לבחור משרה תחילה", "error");
      return;
    }
    setGenerating(true);
    try {
      const job = jobs.find(j => (j.job_id ?? j.job_title) === selectedJobId);
      const body: Record<string, string> = {
        job_id:    job?.job_id    ?? "",
        job_title: job?.job_title ?? "",
        date_from: dateFrom,
        date_to:   dateTo || today(),
      };

      const res = await fetch(`${apiBase}/api/tools/generate-manager-report`, {
        method:  "POST",
        headers: getAdminHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Failed");
      }
      const filename = res.headers.get("content-disposition")
        ?.match(/filename="?([^"]+)"?/)?.[1] ?? "manager_report.pdf";
      downloadBlob(await res.blob(), filename);
      showToast("הדוח הורד בהצלחה ✅", "success");
    } catch (e) {
      showToast(`שגיאה: ${e instanceof Error ? e.message : "ודא שהשרת פעיל"}`, "error");
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50/30 p-5 rounded-b-3xl">
      <div className="max-w-2xl mx-auto w-full space-y-5 mt-4">

        {/* Header */}
        <div>
          <h2 className="text-xl font-black text-[#002649] flex items-center gap-2 mb-1">
            <FileText className="text-[#EF6B00]" size={20}/>
            מחולל דוחות PDF
          </h2>
          <p className="text-xs text-slate-500">הפקת דוחות מנוהל ישירות מנתוני המערכת</p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-3">
          <TabBtn
            active={tab === "manager"}
            onClick={() => setTab("manager")}
            icon={<Briefcase size={16}/>}
            label="דוח מרכז למנהל"
            desc="משפך גיוס + סטטוס נוכחי לפי משרה"
          />
          <TabBtn
            active={tab === "weekly"}
            onClick={() => setTab("weekly")}
            icon={<BarChart2 size={16}/>}
            label="סיכום שבועי"
            desc="סיכום כולל לכל המשרות + SLA"
          />
        </div>

        {/* ── Manager Report Form ── */}
        {tab === "manager" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">

            {/* Job selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Briefcase size={13} className="text-[#EF6B00]"/>
                בחר משרה
              </label>
              <div className="relative">
                <select
                  value={selectedJobId}
                  onChange={e => setSelectedJobId(e.target.value)}
                  disabled={loadingJobs}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-[#002649] focus:outline-none focus:ring-2 focus:ring-[#EF6B00]/30 disabled:opacity-50"
                >
                  <option value="">
                    {loadingJobs ? "טוען משרות..." : "— בחר משרה —"}
                  </option>
                  {jobs.map(j => (
                    <option key={j.job_id ?? j.job_title} value={j.job_id ?? j.job_title}>
                      {j.job_title}
                      {j.department ? ` · ${j.department}` : ""}
                      {j.is_active ? "" : " [סגורה]"}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              </div>

              {/* Job meta preview */}
              {selectedJob && (
                <div className="flex flex-wrap gap-3 pt-1">
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    👤 {selectedJob.recruiter || "—"}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    🏢 {selectedJob.department || "—"}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedJob.is_active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"
                  }`}>
                    {selectedJob.is_active ? "● פעילה" : "● סגורה"}
                  </span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {selectedJob.active_candidates ?? 0} מועמדים פעילים
                  </span>
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar size={13} className="text-[#EF6B00]"/>
                טווח תאריכים לניתוח משפך
              </label>
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <div className="text-[10px] text-slate-400 mb-1">מתאריך</div>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || today()}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-[#002649] focus:outline-none focus:ring-2 focus:ring-[#EF6B00]/30"
                  />
                </div>
                <div className="text-slate-300 mt-4">→</div>
                <div className="flex-1">
                  <div className="text-[10px] text-slate-400 mb-1">עד תאריך</div>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    max={today()}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-[#002649] focus:outline-none focus:ring-2 focus:ring-[#EF6B00]/30"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info size={10}/>
                ברירת מחדל: מתאריך פתיחת המשרה ועד היום
              </p>
            </div>

            {/* What's included */}
            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-3 space-y-1.5">
              <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">הדוח כולל:</div>
              {[
                { icon: <CheckCircle2 size={11}/>, text: "סטטוס pipeline נוכחי — כמה מועמדים בכל שלב היום" },
                { icon: <CheckCircle2 size={11}/>, text: "משפך גיוס בטווח תאריכים — כניסות + שיעורי המרה" },
                { icon: <CheckCircle2 size={11}/>, text: "רשימת מועמדים מפורטת לפי שלב (שם, ימים בתהליך, סטטוס)" },
                { icon: <AlertTriangle size={11}/>, text: "איתור חסמים ואזהרות SLA אוטומטיות" },
                { icon: <CheckCircle2 size={11}/>, text: "תובנות מנהל — המלצות על סמך הנתונים" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px] text-blue-800">
                  <span className="text-blue-500 mt-0.5 shrink-0">{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>

            {/* Generate button */}
            <button
              onClick={() => void generateManager()}
              disabled={generating || !selectedJobId}
              className="w-full bg-[#002649] text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-[#EF6B00] transition-colors shadow-md disabled:opacity-60 text-base"
            >
              {generating
                ? <><Loader2 className="animate-spin" size={20}/> מייצר דוח PDF...</>
                : <><Download size={20}/> הפק דוח מנהל</>
              }
            </button>
          </div>
        )}

        {/* ── Weekly Report ── */}
        {tab === "weekly" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="space-y-1">
              <h3 className="font-bold text-[#002649] text-sm">סיכום שבועי — כל המשרות</h3>
              <p className="text-xs text-slate-500">
                דוח מצטבר עם סיכום גיוסים, חריגות SLA ותובנות כלליות
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 space-y-1">
              {["סה״כ גיוסים בתהליך", "חריגות SLA לפי מחלקה", "תובנת AI על מגמות"].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-slate-600">
                  <CheckCircle2 size={11} className="text-green-500"/>
                  {item}
                </div>
              ))}
            </div>
            <button
              onClick={() => void generateWeekly()}
              disabled={generating}
              className="w-full bg-[#002649] text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-[#EF6B00] transition-colors shadow-md disabled:opacity-60 text-base"
            >
              {generating
                ? <><Loader2 className="animate-spin" size={20}/> מייצר...</>
                : <><Download size={20}/> הורד דוח שבועי</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
