"use client";

/**
 * JobCreateModal — the "+ job" form added in A9-FU UX wave 3.
 *
 * Calls POST /api/jobs. Dedup is on (title, department); the existing
 * department list is preloaded from /api/jobs so the recruiter picks
 * a known org-unit instead of inventing a new one each time.
 * On 409 we offer to open the existing job's card instead of creating
 * a duplicate.
 */

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Loader2, X, AlertTriangle } from "lucide-react";
import { getAdminHeaders, getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface JobCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (info: { job_id: string }) => void;
}

const DEPT_FALLBACKS = ["R&D", "Sales", "Service", "Operations", "Marketing", "HR", "Finance"];

export default function JobCreateModal({ open, onClose, onCreated }: JobCreateModalProps) {
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [openedAt, setOpenedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [targetCount, setTargetCount] = useState(1);

  const [existingDepts, setExistingDepts] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [conflict, setConflict] = useState<{ id: string; title: string; dept: string } | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDepartment("");
      setHiringManager("");
      setOpenedAt(new Date().toISOString().slice(0, 10));
      setTargetCount(1);
      setErrorMsg("");
      setConflict(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/jobs`, { headers: getAdminHeaders() });
        if (!res.ok) return;
        const data: Array<{ department?: string }> = await res.json();
        const seen = new Set<string>();
        const list: string[] = [];
        for (const j of data) {
          const d = (j.department ?? "").trim();
          if (d && !seen.has(d)) {
            seen.add(d);
            list.push(d);
          }
        }
        setExistingDepts(list.length > 0 ? list : DEPT_FALLBACKS);
      } catch (err) {
        console.error("[JobCreateModal] dept fetch failed", err);
        setExistingDepts(DEPT_FALLBACKS);
      }
    })();
  }, [open]);

  const submit = async () => {
    setErrorMsg("");
    setConflict(null);

    if (!title.trim()) {
      setErrorMsg("שם משרה הוא שדה חובה.");
      return;
    }
    if (!department.trim()) {
      setErrorMsg("חטיבה היא שדה חובה — הדדופ במערכת עובד על הצמד (שם משרה, חטיבה).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          job_title: title.trim(),
          department: department.trim(),
          hiring_manager: hiringManager.trim() || null,
          opened_at: openedAt || null,
          target_count: Number.isFinite(targetCount) && targetCount > 0 ? targetCount : 1,
        }),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        const detail = body?.detail ?? {};
        setConflict({
          id: detail.existing_id ?? "",
          title: title.trim(),
          dept: department.trim(),
        });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body?.detail === "string" ? body.detail : (body?.detail?.message ?? "שגיאה ביצירת המשרה");
        setErrorMsg(msg);
        return;
      }

      const body = await res.json();
      showToast("משרה נוצרה", "success");
      onCreated({ job_id: body.job_id });
      onClose();
    } catch (err) {
      console.error("[JobCreateModal] submit failed", err);
      setErrorMsg("שגיאת רשת. נסה שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deptDatalistId = useMemo(() => "dept-options-" + Math.random().toString(36).slice(2, 8), []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-black text-lg text-[#002649] flex items-center gap-2">
            <Briefcase size={20} className="text-[#EF6B00]" />
            משרה חדשה
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {conflict ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 font-black">
                <AlertTriangle size={18} /> משרה זהה כבר קיימת
              </div>
              <p className="text-sm text-amber-900">
                הצירוף &lsquo;{conflict.title}&rsquo; בחטיבה &lsquo;{conflict.dept}&rsquo; כבר קיים. הדדופ במערכת
                מבוסס על הצמד (שם משרה, חטיבה).
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (conflict.id) window.location.href = `/jobs?selected=${encodeURIComponent(conflict.id)}`;
                  }}
                  className="px-4 py-2 rounded-xl bg-[#002649] text-white text-sm font-black hover:bg-[#EF6B00] transition-colors"
                >
                  פתח את המשרה הקיימת
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
              <Field label="שם משרה *">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Senior Backend Engineer"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm"
                />
              </Field>

              <Field label="חטיבה *">
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  list={deptDatalistId}
                  placeholder="R&D"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm"
                />
                <datalist id={deptDatalistId}>
                  {existingDepts.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </Field>

              <Field label="מנהל מגייס">
                <input
                  type="text"
                  value={hiringManager}
                  onChange={(e) => setHiringManager(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="תאריך פתיחה">
                  <input
                    type="date"
                    value={openedAt}
                    onChange={(e) => setOpenedAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm"
                  />
                </Field>
                <Field label="תקן">
                  <input
                    type="number"
                    min={1}
                    value={targetCount}
                    onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-[#EF6B00] text-sm"
                  />
                </Field>
              </div>

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
              שמור משרה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
