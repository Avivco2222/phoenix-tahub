"use client";

import React, { useEffect, useState } from "react";
import { Mail, Phone, Briefcase, User, Calendar, Building2, Activity, ExternalLink, Loader2, Pencil } from "lucide-react";
import { SidePanel } from "@/components/SidePanel";
import { StageBadge } from "@/components/StageBadge";
import { getApiBaseUrl } from "@/lib/api";
import { STAGE_ORDER, getStageMeta, type UnifiedStage } from "@/lib/stages";
import RecordEditModal from "@/components/RecordEditModal";

interface CandidateRow {
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
  unified_stage?: UnifiedStage;
  days_in_process?: number;
  start_date?: string;
  onboarding_id?: string | null;
  onboarding_status?: string | null;
  onboarding_start_date?: string | null;
  id_num?: string | null;
  // Lineage — which ingestion batch first created this candidate row.
  // Useful when the admin needs to trace "where did this person come from?"
  first_ingested_batch?: string | null;
  last_seen_at?: string | null;
}

interface OnboardingRecord {
  id: string;
  name: string;
  id_num?: string;
  role?: string;
  department?: string;
  manager?: string;
  start_date?: string;
  status: string;
  created_at?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  status: string;
  details: string;
  user: string;
}

interface CandidateDetailResponse {
  candidate: CandidateRow;
  onboarding: OnboardingRecord | null;
  audit_logs: AuditLog[];
}

interface CandidateSidePanelProps {
  open: boolean;
  candidateKey: string | null; // candidate_id, name or id_num
  onClose: () => void;
}

export function CandidateSidePanel({ open, candidateKey, onClose }: CandidateSidePanelProps) {
  const [data, setData] = useState<CandidateDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!open || !candidateKey) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${getApiBaseUrl()}/api/candidates/${encodeURIComponent(candidateKey)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async res => {
        if (!res.ok) throw new Error(res.status === 404 ? "המועמד לא נמצא" : `שגיאה (${res.status})`);
        return res.json() as Promise<CandidateDetailResponse>;
      })
      .then(json => { if (!cancelled) setData(json); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "שגיאה לא ידועה"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, candidateKey]);

  const candidate = data?.candidate;
  const stage = (candidate?.unified_stage || "ACTIVE") as UnifiedStage;
  const stageMeta = getStageMeta(stage);

  // Position the active stage on a simple horizontal timeline so the user
  // immediately sees how far along the candidate is in the funnel.
  const stageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <>
    <SidePanel
      open={open}
      onClose={onClose}
      ariaLabel={`פרטי מועמד ${candidate?.candidate_name ?? ""}`}
      header={
        candidate ? (
          <div className="space-y-2 pl-12">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#002649]/5 to-[#EF6B00]/10 text-[#002649] flex items-center justify-center border border-[#002649]/10 shadow-sm shrink-0">
                <User size={22} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black text-[#002649] truncate" title={candidate.candidate_name}>
                  {candidate.candidate_name || "—"}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {candidate.id_num ? `ת.ז: ${candidate.id_num}` : (candidate.candidate_id || "")}
                </p>
              </div>
              <button
                onClick={() => setEditOpen(true)}
                className="p-2 text-slate-400 hover:text-[#002649] hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                title="ערוך מועמד"
              >
                <Pencil size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StageBadge stage={stage} size="md" />
              {typeof candidate.days_in_process === "number" && (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5">
                  {candidate.days_in_process} ימים בתהליך
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="pl-12 space-y-2">
            <h2 className="text-lg font-black text-[#002649]">פרטי מועמד</h2>
          </div>
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
      {!loading && !error && candidate && (
        <div className="space-y-6 pb-8">
          {/* Stage timeline */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">ציר שלבים</h3>
            <div className="flex items-center gap-1">
              {STAGE_ORDER.map((s, i) => {
                const meta = getStageMeta(s);
                const reached = i <= stageIndex && stage !== "REJECTED";
                const isCurrent = i === stageIndex;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                      className={`h-1.5 w-full rounded-full ${
                        isCurrent ? "bg-[#EF6B00]" : reached ? "bg-[#002649]" : "bg-slate-200"
                      }`}
                      title={meta.label}
                    />
                    <span className={`text-[9px] font-bold truncate w-full text-center ${
                      isCurrent ? "text-[#EF6B00]" : reached ? "text-[#002649]" : "text-slate-400"
                    }`}>
                      {meta.short}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{stageMeta.description}</p>
          </section>

          {/* Contact */}
          <section className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">פרטי קשר</h3>
            <Row icon={<Mail size={14} strokeWidth={1.75} />} label="אימייל" value={candidate.email || "—"} mono />
            <Row icon={<Phone size={14} strokeWidth={1.75} />} label="טלפון" value={candidate.phone || "—"} mono />
            <Row icon={<Briefcase size={14} strokeWidth={1.75} />} label="משרה" value={candidate.job_title || "—"} />
            <Row icon={<Building2 size={14} strokeWidth={1.75} />} label="מחלקה" value={candidate.department || "—"} />
            <Row icon={<User size={14} strokeWidth={1.75} />} label="מגייסת" value={candidate.recruiter || "—"} />
            <Row icon={<ExternalLink size={14} strokeWidth={1.75} />} label="מקור" value={candidate.source || "—"} />
            {candidate.start_date && (
              <Row icon={<Calendar size={14} strokeWidth={1.75} />} label="תחילת תהליך" value={candidate.start_date} />
            )}
            {/* Lineage: first ingest batch + last seen — admin can trace the data origin. */}
            {(candidate.first_ingested_batch || candidate.last_seen_at) && (
              <div className="border-t border-slate-200 pt-2 mt-2 space-y-1.5">
                {candidate.first_ingested_batch && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-bold text-slate-400 uppercase tracking-wider">מקור (batch)</span>
                    <span className="font-mono text-slate-600">{candidate.first_ingested_batch}</span>
                  </div>
                )}
                {candidate.last_seen_at && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-bold text-slate-400 uppercase tracking-wider">עודכן לאחרונה</span>
                    <span className="font-mono text-slate-600">{candidate.last_seen_at.slice(0, 16).replace("T", " ")}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Onboarding card (if linked) */}
          {data?.onboarding && (
            <section className="bg-orange-50/40 rounded-2xl border border-orange-200 p-4 space-y-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-orange-800">קליטה לעבודה</h3>
              <Row icon={<Calendar size={14} strokeWidth={1.75} />} label="תאריך תחילה" value={data.onboarding.start_date || "—"} />
              <Row icon={<Briefcase size={14} strokeWidth={1.75} />} label="תפקיד" value={data.onboarding.role || "—"} />
              <Row icon={<User size={14} strokeWidth={1.75} />} label="מנהל ישיר" value={data.onboarding.manager || "—"} />
              <Row icon={<Activity size={14} strokeWidth={1.75} />} label="סטטוס קליטה" value={data.onboarding.status} />
            </section>
          )}

          {/* Audit log */}
          {data?.audit_logs && data.audit_logs.length > 0 && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">פעילות אחרונה</h3>
              <ul className="space-y-1.5">
                {data.audit_logs.slice(0, 5).map(log => (
                  <li key={log.id} className="text-[11px] flex items-center justify-between gap-3 bg-white border border-slate-100 rounded-lg px-3 py-1.5">
                    <span className="font-medium text-slate-700 truncate" title={log.details}>{log.action}</span>
                    <span className="text-slate-400 font-mono text-[10px] shrink-0">{log.timestamp.slice(0, 16)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </SidePanel>
    {editOpen && candidate?.candidate_id && (
      <RecordEditModal
        entityType="candidate"
        entityId={candidate.candidate_id}
        initialData={candidate as Record<string, unknown>}
        onSave={(updated) => {
          setData((prev) =>
            prev ? { ...prev, candidate: { ...prev.candidate, ...(updated as Partial<CandidateRow>) } } : prev
          );
          setEditOpen(false);
        }}
        onClose={() => setEditOpen(false)}
      />
    )}
    </>
  );
}

function Row({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-400 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
        <span className={`text-sm text-[#002649] font-medium ${mono ? "font-mono" : ""} break-words`}>{value}</span>
      </div>
    </div>
  );
}
