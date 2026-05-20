"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, Loader2, ArrowLeftCircle, Building2, User, Pencil } from "lucide-react";
import { SidePanel } from "@/components/SidePanel";
import { StageBadge } from "@/components/StageBadge";
import { CandidateSidePanel } from "@/components/CandidateSidePanel";
import { getApiBaseUrl } from "@/lib/api";
import { STAGE_ORDER, getStageMeta, type UnifiedStage } from "@/lib/stages";
import RecordEditModal from "@/components/RecordEditModal";

interface JobMeta {
  job_id?: string;
  job_title?: string;
  department?: string;
  recruiter?: string;
}

interface CandidateRow {
  candidate_id?: string;
  candidate_name?: string;
  recruiter?: string;
  days_in_process?: number;
  unified_stage?: UnifiedStage;
  status?: string;
  id_num?: string | null;
  onboarding_id?: string | null;
}

interface JobCandidatesResponse {
  job: JobMeta | null;
  by_stage: Record<UnifiedStage, CandidateRow[]>;
  total: number;
}

interface JobSidePanelProps {
  open: boolean;
  jobKey: string | null; // job_id or job_title
  initialStage?: UnifiedStage | "";
  onClose: () => void;
}

export function JobSidePanel({ open, jobKey, initialStage = "", onClose }: JobSidePanelProps) {
  const [data, setData] = useState<JobCandidatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<UnifiedStage | "">(initialStage);
  const [drilledCandidate, setDrilledCandidate] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => { setActiveStage(initialStage); }, [initialStage, jobKey]);

  useEffect(() => {
    if (!open || !jobKey) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${getApiBaseUrl()}/api/jobs/${encodeURIComponent(jobKey)}/candidates`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async res => {
        if (!res.ok) throw new Error(`שגיאה (${res.status})`);
        return res.json() as Promise<JobCandidatesResponse>;
      })
      .then(json => { if (!cancelled) setData(json); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "שגיאה לא ידועה"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, jobKey]);

  const job = data?.job;

  // List of candidates filtered by the active stage tab.
  const candidates = useMemo(() => {
    if (!data) return [];
    if (!activeStage) {
      return STAGE_ORDER.flatMap(s => data.by_stage?.[s] ?? []);
    }
    return data.by_stage?.[activeStage] ?? [];
  }, [data, activeStage]);

  const counts = useMemo(() => {
    const m: Partial<Record<UnifiedStage | "ALL", number>> = { ALL: 0 };
    if (data?.by_stage) {
      let total = 0;
      for (const s of STAGE_ORDER) {
        const c = data.by_stage[s]?.length ?? 0;
        m[s] = c;
        total += c;
      }
      m.ALL = total;
    }
    return m;
  }, [data]);

  return (
    <>
      <SidePanel
        open={open && !drilledCandidate}
        onClose={onClose}
        ariaLabel={`פרטי משרה ${job?.job_title ?? ""}`}
        header={
          job ? (
            <div className="space-y-2 pl-12">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#002649]/5 to-[#EF6B00]/10 text-[#EF6B00] flex items-center justify-center border border-[#002649]/10 shadow-sm shrink-0">
                  <Briefcase size={22} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black text-[#002649] truncate" title={job.job_title}>
                    {job.job_title || "—"}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium truncate">
                    {job.department || ""}{job.recruiter ? ` · מגייסת: ${job.recruiter}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setEditOpen(true)}
                  className="p-2 text-slate-400 hover:text-[#002649] hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                  title="ערוך משרה"
                >
                  <Pencil size={16} />
                </button>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5">
                סה"כ מועמדים: {data?.total ?? 0}
              </span>
            </div>
          ) : (
            <div className="pl-12"><h2 className="text-lg font-black text-[#002649]">פרטי משרה</h2></div>
          )
        }
      >
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-[#EF6B00]" />
          </div>
        )}
        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm font-medium">
            {error}
          </div>
        )}
        {!loading && !error && data && (
          <div className="space-y-5 pb-8">
            {/* Stage tabs */}
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="סינון מועמדי משרה">
              <StageTab active={!activeStage} label="הכל" count={counts.ALL ?? 0} onClick={() => setActiveStage("")} />
              {STAGE_ORDER.map(stage => {
                const c = counts[stage] ?? 0;
                if (c === 0) return null; // hide empty stages inside a job to reduce noise
                return (
                  <StageTab
                    key={stage}
                    active={activeStage === stage}
                    label={getStageMeta(stage).short}
                    count={c}
                    onClick={() => setActiveStage(stage)}
                  />
                );
              })}
            </div>

            {/* Candidates list */}
            {candidates.length === 0 ? (
              <div className="text-center text-sm text-slate-400 font-medium py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                אין מועמדים בשלב זה.
              </div>
            ) : (
              <ul className="space-y-2">
                {candidates.map(c => (
                  <li key={c.candidate_id ?? c.candidate_name}>
                    <button
                      type="button"
                      onClick={() => setDrilledCandidate(c.candidate_id ?? c.candidate_name ?? null)}
                      className="w-full flex items-center justify-between gap-3 bg-white border border-slate-200 hover:border-[#EF6B00] rounded-xl px-3 py-2.5 transition-colors text-right group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[#002649] truncate flex items-center gap-2">
                          <User size={14} strokeWidth={1.75} className="text-slate-400 shrink-0" />
                          <span className="truncate">{c.candidate_name || "—"}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <StageBadge stage={c.unified_stage} size="sm" compact />
                          {typeof c.days_in_process === "number" && (
                            <span>{c.days_in_process} ימים</span>
                          )}
                          {c.recruiter && <span>· {c.recruiter}</span>}
                        </div>
                      </div>
                      <ArrowLeftCircle size={18} strokeWidth={1.75} className="text-slate-300 group-hover:text-[#EF6B00] transition-colors shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Recruiter / dept summary for clarity */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">פרטי משרה</h3>
              <div className="flex items-center gap-2 text-sm text-[#002649]">
                <Building2 size={14} strokeWidth={1.75} className="text-slate-400" />
                <span className="font-medium">{job?.department || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#002649]">
                <User size={14} strokeWidth={1.75} className="text-slate-400" />
                <span className="font-medium">{job?.recruiter || "—"}</span>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      <CandidateSidePanel
        open={!!drilledCandidate}
        candidateKey={drilledCandidate}
        onClose={() => setDrilledCandidate(null)}
      />
      {editOpen && job?.job_id && (
        <RecordEditModal
          entityType="job"
          entityId={job.job_id}
          initialData={job as Record<string, unknown>}
          onSave={(updated) => {
            setData((prev) =>
              prev ? { ...prev, job: { ...prev.job, ...(updated as Partial<JobMeta>) } } : prev
            );
            setEditOpen(false);
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}

function StageTab({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`text-xs font-bold rounded-lg px-3 py-1.5 border transition-colors ${
        active
          ? "bg-[#002649] text-white border-[#002649]"
          : "bg-white border-slate-200 text-slate-600 hover:border-[#002649]"
      }`}
    >
      {label}
      <span className={`mr-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-black rounded-full ${
        active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700"
      }`}>{count}</span>
    </button>
  );
}
