"use client";

/**
 * StageChangeModal — workflow dialog for moving a candidate to a new
 * stage. The dedicated dialog (vs. the generic RecordEditModal) exists
 * because closures (REJECTED / WITHDRAWN) carry structured metadata —
 * a `closure_reason_code` from the closure_taxonomy table that the
 * recruiter MUST pick before the server accepts the transition.
 *
 * Flow:
 *   1. Show the candidate's current stage and the full set of next
 *      stages as clickable cards.
 *   2. User clicks a target stage.
 *      a. Non-closure target (e.g. OFFER, HR_INTERVIEW) — confirm
 *         button enabled immediately.
 *      b. Closure target (REJECTED / WITHDRAWN) — show a second
 *         section with the reason dropdown filtered by closure_type.
 *         The confirm button stays disabled until a reason is picked.
 *   3. On submit, PATCH /api/candidates/{key}/stage with the right
 *      payload shape. The server validates the closure_type matches
 *      the stage and rejects unknown / inactive reasons.
 *
 * The reason taxonomy is fetched once when the modal opens via
 * GET /api/taxonomy/closure-reasons so admin edits to the table show
 * up here without a code change.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X, ArrowRight, AlertTriangle } from "lucide-react";
import { STAGE_ORDER, getStageMeta, type UnifiedStage } from "@/lib/stages";
import { getApiBaseUrl } from "@/lib/api";

interface ClosureReason {
  code: string;
  label_he: string;
  closure_type: "rejected" | "withdrawn";
  sort_order: number;
  captured_by_default: "bot" | "recruiter" | "system" | null;
}

interface StageChangeModalProps {
  open: boolean;
  onClose: () => void;
  /** The candidate's id / name / id_num — the URL param of the
   *  PATCH endpoint accepts any of these. */
  candidateKey: string;
  /** Current stage code — used to highlight where the candidate is
   *  now in the list of targets. */
  currentStage: UnifiedStage;
  /** Display name for the dialog header. */
  candidateName?: string;
  /** Fired after a successful transition so the parent page can
   *  refetch the candidate / re-render the stage badge. */
  onChanged: () => void;
}

const CLOSURE_STAGES: ReadonlySet<UnifiedStage> = new Set(["REJECTED", "WITHDRAWN"]);

export default function StageChangeModal({
  open,
  onClose,
  candidateKey,
  currentStage,
  candidateName,
  onChanged,
}: StageChangeModalProps) {
  const apiBase = getApiBaseUrl();
  const [target, setTarget] = useState<UnifiedStage | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [notes, setNotes] = useState("");
  const [reasons, setReasons] = useState<ClosureReason[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the modal opens (so a previous attempt doesn't bleed).
  useEffect(() => {
    if (open) {
      setTarget(null);
      setReasonCode("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  // Fetch the reason taxonomy once when opened. Cheap call, ~25 rows.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/api/taxonomy/closure-reasons`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: ClosureReason[] = await res.json();
        if (!cancelled) setReasons(data);
      } catch (err) {
        if (!cancelled) console.error("[StageChangeModal] taxonomy fetch failed", err);
      }
    })();
    return () => { cancelled = true; };
  }, [open, apiBase]);

  const isClosure = useMemo(() => target !== null && CLOSURE_STAGES.has(target), [target]);
  const expectedClosureType = target === "REJECTED" ? "rejected" : target === "WITHDRAWN" ? "withdrawn" : null;
  const filteredReasons = useMemo(
    () => reasons.filter(r => r.closure_type === expectedClosureType),
    [reasons, expectedClosureType],
  );

  const canSubmit = !!target && (!isClosure || !!reasonCode) && !submitting;

  const submit = useCallback(async () => {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { stage_code: target };
      if (notes.trim()) body.notes = notes.trim();
      if (isClosure) body.closure_reason_code = reasonCode;
      const res = await fetch(`${apiBase}/api/candidates/${encodeURIComponent(candidateKey)}/stage`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const msg = (payload && payload.detail && (payload.detail.message ?? payload.detail)) ?? `HTTP ${res.status}`;
        setError(typeof msg === "string" ? msg : "שגיאה בעדכון השלב");
        return;
      }
      onChanged();
      onClose();
    } catch (err) {
      console.error("[StageChangeModal] submit failed", err);
      setError("שגיאת רשת — נסה שוב");
    } finally {
      setSubmitting(false);
    }
  }, [target, notes, isClosure, reasonCode, apiBase, candidateKey, onChanged, onClose]);

  if (!open) return null;

  // Order the cards: forward stages first, terminal closures last.
  const orderedStages = STAGE_ORDER.filter(s => s !== currentStage && s !== "ACTIVE");

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-[#002649]">שינוי שלב בתהליך</h3>
            {candidateName && (
              <p className="text-xs text-slate-500 mt-1">
                {candidateName} · שלב נוכחי:{" "}
                <span className="font-bold text-[#002649]">{getStageMeta(currentStage).label}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {/* Stage selector */}
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">בחר שלב יעד:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {orderedStages.map(s => {
                const meta = getStageMeta(s);
                const active = target === s;
                const isClose = CLOSURE_STAGES.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setTarget(s); setReasonCode(""); setError(null); }}
                    className={`text-right p-3 rounded-xl border transition-all ${
                      active
                        ? "border-[#EF6B00] bg-[#EF6B00]/5 shadow-sm"
                        : isClose
                          ? "border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                          : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-black text-sm text-[#002649]">{meta.label}</div>
                    <div className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-snug">{meta.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Closure-reason selector — appears only when the target is a
              closure stage and the taxonomy fetch completed. */}
          {isClosure && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
                <AlertTriangle size={16} /> נדרשת סיבה לסגירה
              </div>
              <p className="text-xs text-rose-700/80 leading-relaxed">
                מעבר ל-{getStageMeta(target!).label} מחייב בחירת סיבה מתוך הטאקסונומיה.
                הנתונים נכנסים לבלוקי &quot;סיבות דחיה / הסרה&quot; במבט-על.
              </p>
              <select
                value={reasonCode}
                onChange={e => setReasonCode(e.target.value)}
                className="w-full text-sm font-bold text-[#002649] bg-white border border-rose-200 rounded-xl px-3 py-2 outline-none focus:border-rose-400"
              >
                <option value="" disabled>— בחר סיבה —</option>
                {filteredReasons.map(r => (
                  <option key={r.code} value={r.code}>
                    {r.label_he}{r.captured_by_default === "bot" ? " · (BOT)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional free-text notes — useful for "other" reasons */}
          {target && (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">הערה (אופציונלי):</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full text-sm text-[#002649] bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-[#EF6B00] resize-none"
                placeholder="הקשר נוסף שיופיע ב-audit log"
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="px-5 py-2 text-sm font-black text-white bg-[#002649] hover:bg-[#EF6B00] rounded-xl flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            עדכן שלב
          </button>
        </div>
      </div>
    </div>
  );
}
