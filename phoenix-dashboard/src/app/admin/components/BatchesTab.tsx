"use client";

import React, { useCallback, useEffect, useState } from "react";
import { History, Loader2, Undo2, RotateCcw, AlertTriangle, Activity } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";

interface Batch {
  batch_id: string;
  file_type: string;
  filename: string;
  status: string;
  rows_received: number;
  rows_loaded: number;
  rows_rejected: number;
  duplicate_rows: number;
  quality_score: number;
  started_at: string;
  finished_at: string | null;
}

interface BatchesTabProps {
  onRefresh: () => void | Promise<void>;
}

interface RejectedRow {
  id: number;
  row_index: number | null;
  reason_code: string | null;
  reason_detail: string | null;
  raw_row: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  committed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  reverted: "bg-slate-100 text-slate-600 border-slate-300",
};

export function BatchesTab({ onRefresh }: BatchesTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  /** Open the new AuditLogTab pre-filtered to this batch's activity.
   *  audit_logs.details holds the batch_id mention, so the server-side
   *  filter on /api/security/audit-logs?batch_id=<id> picks it up. */
  const openAuditForBatch = (batchId: string) => {
    const params = new URLSearchParams(search.toString());
    params.set("group", "settings");
    params.set("sub", "audit-log");
    params.set("audit_batch", batchId);
    router.replace(`${pathname}?${params.toString()}`);
  };
  const { showToast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [reverting, setReverting] = useState<string | null>(null);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [rejRows, setRejRows] = useState<Record<string, RejectedRow[]>>({});

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("file_type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      params.set("limit", "100");
      const res = await fetch(`${apiBase}/api/admin/batches?${params.toString()}`, { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as Batch[];
      setBatches(Array.isArray(data) ? data : []);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, filterType, filterStatus]);

  useEffect(() => { void load(); }, [load]);

  const loadRejected = async (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      return;
    }
    if (!rejRows[batchId]) {
      try {
        const res = await fetch(
          `${apiBase}/api/admin/ingestion/batch/${encodeURIComponent(batchId)}/rejected?limit=50`,
          { credentials: "include" }
        );
        const d = await res.json() as { rows?: RejectedRow[] };
        setRejRows((p) => ({ ...p, [batchId]: d.rows ?? [] }));
      } catch {
        setRejRows((p) => ({ ...p, [batchId]: [] }));
      }
    }
    setExpandedBatch(batchId);
  };

  const handleRevert = async (batchId: string) => {
    if (!confirm(`האם לבטל את האצווה ${batchId}? פעולה זו תמחק/תחזיר את כל השורות שנוצרו או עודכנו ב-batch זה.`)) return;
    setReverting(batchId);
    try {
      const res = await fetch(`${apiBase}/api/admin/batches/${encodeURIComponent(batchId)}/revert`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✓ Batch בוטל. ${data.reverted_rows} שורות הוחזרו.`, "success");
        await onRefresh();
        await load();
      } else {
        showToast(`שגיאה: ${data.detail || "ביטול נכשל"}`, "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "ביטול נכשל", "error");
    } finally {
      setReverting(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-black text-[#002649] flex items-center gap-2">
          <History size={22} strokeWidth={1.75} className="text-[#EF6B00]" />
          היסטוריית אצוות — {batches.length} רשומות
        </h2>
        <div className="flex items-center gap-2">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-white border border-slate-200 rounded-lg text-xs font-bold px-3 py-2">
            <option value="">כל הסוגים</option>
            <option value="candidates">מועמדים</option>
            <option value="jobs">משרות</option>
            <option value="hires">קליטות</option>
            <option value="diversity">גיוון</option>
            <option value="headcount">תקן מצבה</option>
            <option value="budget">תקציב</option>
            <option value="attrition">עזיבות</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white border border-slate-200 rounded-lg text-xs font-bold px-3 py-2">
            <option value="">כל הסטטוסים</option>
            <option value="committed">מקובע</option>
            <option value="failed">נכשל</option>
            <option value="reverted">בוטל</option>
          </select>
          <button onClick={() => void load()} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[#EF6B00]" />
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-16 text-slate-400 font-bold">אין אצוות תחת הסינון הנוכחי.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-black text-slate-500">Batch</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500">סוג</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500">קובץ</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 text-center">סטטוס</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 text-center">נטענו</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 text-center">נדחו</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 text-center">איכות</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500">זמן</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map(b => {
                const cls = STATUS_STYLES[b.status] || "bg-slate-100 text-slate-600 border-slate-200";
                const isExpanded = expandedBatch === b.batch_id;
                return (
                  <React.Fragment key={b.batch_id}>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{b.batch_id}</td>
                      <td className="px-4 py-3 font-bold text-slate-700 text-xs">{b.file_type || "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 truncate max-w-[180px]" title={b.filename}>{b.filename}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${cls}`}>{b.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">{b.rows_loaded}</td>
                      <td className="px-4 py-3 text-center">
                        {b.rows_rejected > 0 ? (
                          <button
                            onClick={() => void loadRejected(b.batch_id)}
                            className="font-mono font-bold text-amber-600 hover:text-amber-800 hover:underline text-xs"
                          >
                            {b.rows_rejected} {isExpanded ? "▴" : "▾"}
                          </button>
                        ) : (
                          <span className="font-mono font-bold text-rose-500">{b.rows_rejected}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-[#002649]">{b.quality_score}%</td>
                      <td className="px-4 py-3 text-[10px] text-slate-500 font-mono">{(b.finished_at || b.started_at).slice(0, 19).replace("T", " ")}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openAuditForBatch(b.batch_id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="הצג ביומן הביקורת — סנן אוטומטית ל-batch_id זה"
                          >
                            <Activity size={16} />
                          </button>
                          {b.status === "committed" && (
                            <button
                              onClick={() => void handleRevert(b.batch_id)}
                              disabled={reverting === b.batch_id}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                              title="בטל אצווה — מוחק/מחזיר כל השורות"
                            >
                              {reverting === b.batch_id ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />}
                            </button>
                          )}
                          {b.status === "reverted" && (
                            <span className="text-[10px] text-slate-400">בוטל</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${b.batch_id}-rej`}>
                        <td colSpan={9} className="p-0">
                          <div className="bg-amber-50 border-t border-amber-100 px-6 py-4">
                            {(rejRows[b.batch_id] ?? []).length === 0 ? (
                              <p className="text-xs text-amber-700">לא נמצאו שורות נדחות שמורות.</p>
                            ) : (
                              <table className="w-full text-xs text-right">
                                <thead>
                                  <tr className="text-amber-700 font-bold border-b border-amber-200">
                                    <th className="pb-2">שורה</th>
                                    <th className="pb-2">סיבה</th>
                                    <th className="pb-2">נתונים</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-amber-100">
                                  {(rejRows[b.batch_id] ?? []).map(r => (
                                    <tr key={r.id}>
                                      <td className="py-1 font-mono text-slate-500">{r.row_index ?? "—"}</td>
                                      <td className="py-1 text-red-600 max-w-[200px]">{r.reason_detail || r.reason_code || "—"}</td>
                                      <td className="py-1 font-mono text-slate-500 truncate max-w-xs">
                                        {(() => {
                                          try {
                                            return JSON.stringify(JSON.parse(r.raw_row || "{}")).slice(0, 120);
                                          } catch {
                                            return (r.raw_row || "").slice(0, 120);
                                          }
                                        })()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <span><b>Revert:</b> מוחק שורות שנוצרו ב-batch ומחזיר ערכים קודמים לשורות שעודכנו. נתונים תלויים (כמו applications שמצביעים על candidate שנמחק) עלולים להישבר — נסה תחילה revert על batch קטן.</span>
      </div>
    </div>
  );
}
