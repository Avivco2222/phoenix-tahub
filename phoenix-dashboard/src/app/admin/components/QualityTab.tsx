"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ShieldCheck, AlertTriangle, Users, Mail, Loader2, CheckCircle2, XCircle, Pencil, Briefcase, FileQuestion } from "lucide-react";
import RecordEditModal from "@/components/RecordEditModal";

interface QualitySummary {
  total_candidates: number;
  candidates_without_dedup_key: number;
  name_based_duplicate_groups: number;
  last_quality_score: number | null;
  last_quality_at: string | null;
  total_batches: number;
}

interface DuplicateGroup {
  name: string;
  ids: string[];
  phones: string[];
  emails: string[];
  count: number;
}

interface MissingRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  last_seen_at: string | null;
}

interface MissingPayload {
  total: number;
  limit: number;
  offset: number;
  items: MissingRow[];
}

interface JobWithoutRoleType {
  id: string;
  job_title: string;
  department: string | null;
  hiring_manager: string | null;
  opened_at: string | null;
}

interface JobsWithoutRoleTypePayload {
  total: number;
  limit: number;
  items: JobWithoutRoleType[];
}

interface ClosureWithoutReason {
  app_id: string;
  stage_code: string;
  closure_type: string | null;
  closure_stage: string | null;
  candidate_name: string | null;
  job_title: string | null;
  start_date: string | null;
}

interface ClosuresWithoutReasonPayload {
  total: number;
  limit: number;
  items: ClosureWithoutReason[];
}

interface SanityCheck {
  key: string;
  title: string;
  value: number;
  ok: boolean;
  hint: string;
  total?: number;
}

export function QualityTab() {
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [missing, setMissing] = useState<MissingPayload | null>(null);
  // Audit Phase 4 / Wave C — two new data-gap surfaces. Same shape as
  // `missing`: total + items + pagination metadata so the chip count is
  // accurate even when the table is paginated.
  const [jobsWithoutRoleType, setJobsWithoutRoleType] = useState<JobsWithoutRoleTypePayload | null>(null);
  const [closuresWithoutReason, setClosuresWithoutReason] = useState<ClosuresWithoutReasonPayload | null>(null);
  const [sanity, setSanity] = useState<SanityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<{ id: string; data: Record<string, unknown> } | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d, m, sn, jrt, cwr] = await Promise.all([
        fetch(`${apiBase}/api/admin/quality/summary`, { credentials: "include", cache: "no-store" }).then(r => r.json()),
        fetch(`${apiBase}/api/admin/quality/duplicates?limit=30`, { credentials: "include", cache: "no-store" }).then(r => r.json()),
        fetch(`${apiBase}/api/admin/quality/missing?limit=500`, { credentials: "include", cache: "no-store" }).then(r => r.json()),
        fetch(`${apiBase}/api/admin/quality/sanity`, { credentials: "include", cache: "no-store" }).then(r => r.json()),
        fetch(`${apiBase}/api/admin/quality/jobs-without-role-type?limit=500`, { credentials: "include", cache: "no-store" }).then(r => r.json()),
        fetch(`${apiBase}/api/admin/quality/closures-without-reason?limit=500`, { credentials: "include", cache: "no-store" }).then(r => r.json()),
      ]);
      setSummary(s);
      setDuplicates(Array.isArray(d) ? d : []);
      // `missing` shape changed in Wave C: server now wraps results in
      // {total, limit, offset, items}. We defensively unwrap so an older
      // server (returning a bare array) still renders without crashing.
      setMissing(
        m && typeof m === "object" && "items" in m
          ? (m as MissingPayload)
          : { total: Array.isArray(m) ? m.length : 0, limit: 500, offset: 0, items: Array.isArray(m) ? m : [] },
      );
      setSanity(Array.isArray(sn?.checks) ? sn.checks : []);
      setJobsWithoutRoleType(jrt && typeof jrt === "object" && "items" in jrt ? jrt : null);
      setClosuresWithoutReason(cwr && typeof cwr === "object" && "items" in cwr ? cwr : null);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { void load(); }, [load]);

  if (loading || !summary) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#EF6B00]" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-xl font-black text-[#002649] flex items-center gap-2">
        <ShieldCheck size={22} strokeWidth={1.75} className="text-[#EF6B00]" />
        בקרת איכות הדאטה
      </h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="סה״כ מועמדים" value={summary.total_candidates} tone="blue" />
        <KpiCard label="ללא מפתח dedup" value={summary.candidates_without_dedup_key} tone={summary.candidates_without_dedup_key > 0 ? "amber" : "green"}
                 hint="שורות ללא טלפון ולא אימייל — לא ניתנות לאיחוד אוטומטי" />
        <KpiCard label="כפילויות שמיות" value={summary.name_based_duplicate_groups} tone={summary.name_based_duplicate_groups > 0 ? "amber" : "green"}
                 hint="קבוצות מועמדים עם אותו שם אך IDs שונים" />
        <KpiCard label="ציון איכות אחרון" value={summary.last_quality_score != null ? `${summary.last_quality_score}%` : "—"} tone="orange" />
      </div>

      {/* Sanity checks */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-black text-[#002649] mb-3 flex items-center gap-2">
          <AlertTriangle size={18} strokeWidth={1.75} className="text-amber-600" />
          בדיקות שפיות בין-טבלאיות
        </h3>
        <div className="space-y-2">
          {sanity.map(c => (
            <div key={c.key} className={`flex items-start gap-3 p-3 rounded-xl border ${c.ok ? "bg-emerald-50/50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              {c.ok ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" /> : <XCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#002649] flex items-center gap-2">
                  {c.title}
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${c.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-200 text-amber-900"}`}>
                    {c.value}{c.total !== undefined ? ` / ${c.total}` : ""}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{c.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Duplicates */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-black text-[#002649] mb-3 flex items-center gap-2">
          <Users size={18} strokeWidth={1.75} className="text-indigo-600" />
          כפילויות חשודות ({duplicates.length})
        </h3>
        {duplicates.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">אין כפילויות שמיות לזיהוי. מצוין.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {duplicates.map(g => (
              <div key={g.name} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="font-black text-[#002649]">{g.name}</div>
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{g.count} רשומות</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500 grid grid-cols-3 gap-2">
                  <div title="IDs">IDs: {g.ids.slice(0, 3).join(", ")}{g.ids.length > 3 ? "..." : ""}</div>
                  <div title="phones">📞 {g.phones.filter(p => p !== "-").join(", ") || "—"}</div>
                  <div title="emails">✉️ {g.emails.filter(e => e !== "-").join(", ") || "—"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Missing contact info — paginated; chip shows the FULL count not
          the displayed slice. */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-black text-[#002649] mb-3 flex items-center gap-2">
          <Mail size={18} strokeWidth={1.75} className="text-rose-600" />
          מועמדים ללא טלפון ולא אימייל
          {missing && (
            <span className="text-xs font-mono bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
              {missing.items.length} מתוך {missing.total.toLocaleString()}
            </span>
          )}
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          שורות אלו יקלטו כחדשות בכל העלאה (אין דרך לזהות שאותו אדם כבר נמצא במערכת). הוסף ידנית טלפון/אימייל כדי לאפשר dedup.
        </p>
        {!missing || missing.items.length === 0 ? (
          <p className="text-sm text-emerald-700 text-center py-4 bg-emerald-50 rounded-xl">כל המועמדים הקיימים ניתנים ל-dedup. ✓</p>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {missing.items.map(r => (
              <div key={r.id} className="flex items-center justify-between text-xs px-3 py-1.5 hover:bg-slate-50 rounded-lg">
                <span className="font-bold text-[#002649]">{r.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-[10px]">{r.source || "—"}</span>
                  <button
                    onClick={() => setEditTarget({ id: r.id, data: r as unknown as Record<string, unknown> })}
                    className="flex items-center gap-1 text-[#EF6B00] font-bold hover:underline"
                    title="הוסף פרטי קשר"
                  >
                    <Pencil size={11} />
                    תקן
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audit Phase 4 / Wave C — jobs missing role_type classification.
          Without it, the Capacity Tracker on /intelligence can't break
          load down by sector (מטה / קו / מוקדים / טכנולוגי). */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-black text-[#002649] mb-3 flex items-center gap-2">
          <Briefcase size={18} strokeWidth={1.75} className="text-amber-600" />
          משרות ללא סיווג גזרה (role_type)
          {jobsWithoutRoleType && (
            <span className="text-xs font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
              {jobsWithoutRoleType.items.length} מתוך {jobsWithoutRoleType.total.toLocaleString()}
            </span>
          )}
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          סיווג גזרה (מטה / קו / מוקדים / טכנולוגי) דרוש כדי לכלול את המשרה ב-Capacity Tracker וב-CPH לפי גזרה.
        </p>
        {!jobsWithoutRoleType || jobsWithoutRoleType.items.length === 0 ? (
          <p className="text-sm text-emerald-700 text-center py-4 bg-emerald-50 rounded-xl">כל המשרות מסווגות לגזרה. ✓</p>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {jobsWithoutRoleType.items.map(j => (
              <div key={j.id} className="flex items-center justify-between text-xs px-3 py-1.5 hover:bg-slate-50 rounded-lg">
                <span className="font-bold text-[#002649]">{j.job_title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-[10px]">{j.department || "—"}</span>
                  <button
                    onClick={() => setEditTarget({ id: j.id, data: j as unknown as Record<string, unknown> })}
                    className="flex items-center gap-1 text-[#EF6B00] font-bold hover:underline"
                    title="הוסף סיווג גזרה"
                  >
                    <Pencil size={11} />
                    סווג
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audit Phase 4 / Wave C — applications closed (REJECTED /
          WITHDRAWN) but with no closure_reason_code attached. Could be
          legacy rows from before the closure schema landed, or rows
          created through a code-path that bypasses the new reason
          requirement. Either way: visible here so admin can backfill. */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-black text-[#002649] mb-3 flex items-center gap-2">
          <FileQuestion size={18} strokeWidth={1.75} className="text-violet-600" />
          סגירות תהליך ללא סיבה
          {closuresWithoutReason && (
            <span className="text-xs font-mono bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
              {closuresWithoutReason.items.length} מתוך {closuresWithoutReason.total.toLocaleString()}
            </span>
          )}
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          תהליכי גיוס שהסתיימו (נדחו/הוסרו) ללא תיוג סיבה. דרוש לתחזוקת ה-pies של &quot;סיבות דחיה / הסרה&quot; במבט-על.
        </p>
        {!closuresWithoutReason || closuresWithoutReason.items.length === 0 ? (
          <p className="text-sm text-emerald-700 text-center py-4 bg-emerald-50 rounded-xl">כל הסגירות מתוייגות עם סיבה. ✓</p>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {closuresWithoutReason.items.map(r => (
              <div key={r.app_id} className="flex items-center justify-between text-xs px-3 py-1.5 hover:bg-slate-50 rounded-lg">
                <span className="font-bold text-[#002649]">
                  {r.candidate_name || "—"}
                  <span className="text-slate-400 font-normal mr-2"> · {r.job_title || "—"}</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {r.stage_code} · {r.closure_stage || "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit modal */}
      {editTarget && (
        <RecordEditModal
          entityType="candidate"
          entityId={editTarget.id}
          initialData={editTarget.data}
          onSave={() => {
            setEditTarget(null);
            void load();
          }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, tone, hint }: { label: string; value: number | string; tone: "blue" | "amber" | "green" | "orange"; hint?: string }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50/50 text-blue-700",
    amber: "border-amber-300 bg-amber-50 text-amber-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-[#EF6B00]",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`} title={hint}>
      <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-3xl font-black mt-1">{value}</div>
    </div>
  );
}
