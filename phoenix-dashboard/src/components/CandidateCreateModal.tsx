"use client";

/**
 * CandidateCreateModal — the "+ candidate" form added in A9-FU UX wave 3.
 *
 * Replaces the Excel-template round-trip for the single-candidate case:
 * download template → fill one row → preflight → upload becomes
 * one click → 6-field form → save.
 *
 * Calls POST /api/candidates. On 409 (dedup conflict on phone/email),
 * shows a secondary dialog with three choices instead of silently
 * over-writing or duplicating — the recruiter decides whether the
 * "duplicate" is actually the same person.
 */

import { useEffect, useState } from "react";
import { Loader2, UserPlus, X, AlertTriangle } from "lucide-react";
import { getAdminHeaders, getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface JobOption {
  job_id: string;
  job_title: string;
  department: string;
}

interface CandidateCreateModalProps {
  open: boolean;
  onClose: () => void;
  /** Fired after a successful create so the parent page can refetch its list.
   *  Receives the new candidate_id so the parent can scroll to / select it. */
  onCreated: (info: { candidate_id: string; application_id: string | null }) => void;
}

const STATUS_OPTIONS = ["חדש", "סינון", "ראיון", "הצעה", "התקבל", "נדחה"];

export default function CandidateCreateModal({ open, onClose, onCreated }: CandidateCreateModalProps) {
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("חדש");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [recruiter, setRecruiter] = useState("");

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [conflict, setConflict] = useState<{ id: string; name: string } | null>(null);

  // Reset state every time the modal opens so a previous attempt doesn't leak.
  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setEmail("");
      setJobId("");
      setStatus("חדש");
      setSource("");
      setNotes("");
      setRecruiter("");
      setErrorMsg("");
      setConflict(null);
    }
  }, [open]);

  // Pull the jobs list once when the modal opens so the dropdown is populated.
  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/jobs`, { headers: getAdminHeaders() });
        if (!res.ok) return;
        const data: Array<{ job_id?: string; id?: string; job_title: string; department?: string }> = await res.json();
        setJobs(
          data
            .filter((j) => j.job_id || j.id)
            .map((j) => ({ job_id: (j.job_id ?? j.id) as string, job_title: j.job_title, department: j.department ?? "" })),
        );
      } catch (err) {
        console.error("[CandidateCreateModal] jobs fetch failed", err);
      }
    })();
  }, [open]);

  const submit = async () => {
    setErrorMsg("");
    setConflict(null);

    if (!name.trim()) {
      setErrorMsg("שם הוא שדה חובה.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          source: source.trim() || null,
          notes: notes.trim() || null,
          job_id: jobId || null,
          status: jobId ? status : null,
          recruiter: jobId ? recruiter.trim() || null : null,
        }),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        const detail = body?.detail ?? {};
        setConflict({
          id: detail.conflicting_id ?? "",
          name: detail.conflicting_name ?? detail.message ?? "מועמד קיים",
        });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body?.detail === "string" ? body.detail : (body?.detail?.message ?? "שגיאה ביצירת המועמד");
        setErrorMsg(msg);
        return;
      }

      const body = await res.json();
      showToast("מועמד נוצר", "success");
      onCreated({ candidate_id: body.candidate_id, application_id: body.application_id ?? null });
      onClose();
    } catch (err) {
      console.error("[CandidateCreateModal] submit failed", err);
      setErrorMsg("שגיאת רשת. נסה שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-black text-lg text-[#002649] flex items-center gap-2">
            <UserPlus size={20} className="text-[#EF6B00]" />
            מועמד חדש
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {conflict ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 font-black">
                <AlertTriangle size={18} /> מועמד דומה כבר קיים
              </div>
              <p className="text-sm text-amber-900">
                המערכת זיהתה מועמד עם טלפון או אימייל זהה: <strong>{conflict.name}</strong>.
                האם זה אותו אדם?
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    // Navigate to the existing candidate's detail page so the
                    // recruiter can add a job to them via the side panel.
                    if (conflict.id) {
                      window.location.href = `/candidates?selected=${encodeURIComponent(conflict.id)}`;
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-[#002649] text-white text-sm font-black hover:bg-[#EF6B00] transition-colors"
                >
                  פתח את המועמד הקיים
                </button>
                <button
                  type="button"
                  onClick={() => setConflict(null)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50"
                >
                  חזור לטופס
                </button>
              </div>
            </div>
          ) : (
            <>
              <Field label="שם מלא *" required>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ישראלה ישראלי"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm"
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="טלפון">
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05X-XXXXXXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm font-mono"
                  />
                </Field>
                <Field label="אימייל">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm"
                  />
                </Field>
              </div>

              {!phone && !email && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ בלי טלפון או אימייל, המערכת לא תוכל לזהות כפילויות בעלייה הבאה.
                </p>
              )}

              <Field label="מקור">
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="LinkedIn / Referral / Direct"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm"
                />
              </Field>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-500 mb-3">
                  צרף למשרה (אופציונלי) — ייצור גם רשומת תהליך מועמדות.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="משרה">
                    <select
                      value={jobId}
                      onChange={(e) => setJobId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm bg-white"
                    >
                      <option value="">— ללא משרה —</option>
                      {jobs.map((j) => (
                        <option key={j.job_id} value={j.job_id}>
                          {j.job_title}{j.department ? ` · ${j.department}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="סטטוס תהליך">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      disabled={!jobId}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="מגייסת">
                  <input
                    type="text"
                    value={recruiter}
                    onChange={(e) => setRecruiter(e.target.value)}
                    disabled={!jobId}
                    placeholder="שם המגייסת המטפלת"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </Field>
              </div>

              <Field label="הערות">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm resize-none"
                />
              </Field>

              {errorMsg && (
                <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}
            </>
          )}
        </div>

        {!conflict && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#002649] text-white text-sm font-black hover:bg-[#EF6B00] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              שמור מועמד
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-500 mb-1">
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </span>
      {children}
    </label>
  );
}
