"use client";

/**
 * AuditLogTab — server-side filterable view over /api/security/audit-logs.
 *
 * Replaces the password-gated audit table that lived behind /admin/security.
 * Admins are already authenticated as ADMIN/HRBP via the session cookie, so
 * a separate "security password" gate added friction without adding safety.
 *
 * Filters (action / user / batch_id / date range / free-text q) and
 * pagination are pushed to the backend so we can show meaningful history
 * instead of only the latest 50 rows.
 *
 * Deep-link: passing ?audit_batch=<batch_id> on the admin page pre-fills
 * the batch filter, used by BatchesTab to jump straight to the activity
 * for a specific upload.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Search, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getAdminHeaders, getApiBaseUrl } from "@/lib/api";

interface AuditLog {
  id: string;
  date: string;
  time: string;
  action: string;
  status: string;
  details: string;
  user: string;
  ip_address: string;
  is_destructive: boolean;
}

const PAGE_SIZE = 50;

export default function AuditLogTab() {
  const search = useSearchParams();
  const initialBatch = search.get("audit_batch") ?? "";

  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [user, setUser] = useState("");
  const [batchId, setBatchId] = useState(initialBatch);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setFetchError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (action) params.set("action", action);
      if (user) params.set("user", user);
      if (batchId) params.set("batch_id", batchId);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      const res = await fetch(
        `${getApiBaseUrl()}/api/security/audit-logs?${params.toString()}`,
        { headers: getAdminHeaders() },
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      setLogs(await res.json());
    } catch (err) {
      console.error("[AuditLog] fetch failed", err);
      setFetchError("שגיאה בטעינת יומן הביקורת.");
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [q, action, user, batchId, dateFrom, dateTo, offset]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const reset = () => {
    setQ("");
    setAction("");
    setUser("");
    setBatchId("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  };

  const statusClass = useMemo(
    () => (status: string) => {
      if (status === "Success" || status === "ok") return "bg-green-100 text-green-700";
      if (status === "Warning" || status === "warn") return "bg-yellow-100 text-yellow-700";
      return "bg-red-100 text-red-700";
    },
    [],
  );

  const hasFilters = !!(q || action || user || batchId || dateFrom || dateTo);
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const isAtFirstPage = offset === 0;
  const isPartialPage = logs.length < PAGE_SIZE;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <h3 className="font-black text-xl text-[#002649] flex items-center gap-2">
            <Activity size={20} className="text-blue-500" /> יומן ביקורת (Audit Log)
          </h3>
          {hasFilters && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-bold text-[#EF6B00] hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} /> נקה סינון
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative col-span-1 lg:col-span-2">
            <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
              placeholder="חפש פעולה / משתמש / IP / פרטים..."
              className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-[#EF6B00]"
            />
          </div>
          <input
            type="text"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setOffset(0);
            }}
            placeholder="פעולה (e.g. BATCH_REVERTED)"
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-[#EF6B00]"
          />
          <input
            type="text"
            value={user}
            onChange={(e) => {
              setUser(e.target.value);
              setOffset(0);
            }}
            placeholder="משתמש"
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-[#EF6B00]"
          />
          <input
            type="text"
            value={batchId}
            onChange={(e) => {
              setBatchId(e.target.value);
              setOffset(0);
            }}
            placeholder="batch_id (deep-link מ-Batches)"
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-[#EF6B00] font-mono"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setOffset(0);
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-[#EF6B00]"
            />
            <span className="text-xs text-slate-400">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setOffset(0);
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-[#EF6B00]"
            />
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
          {fetchError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-white text-slate-400 font-bold text-xs uppercase border-b border-slate-100 sticky top-0">
            <tr>
              <th className="px-6 py-4">מזהה</th>
              <th className="px-6 py-4">תאריך</th>
              <th className="px-6 py-4">זמן</th>
              <th className="px-6 py-4">פעולה</th>
              <th className="px-6 py-4">סטטוס</th>
              <th className="px-6 py-4">IP</th>
              <th className="px-6 py-4">פרטים</th>
              <th className="px-6 py-4">משתמש</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                  טוען...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                  {hasFilters
                    ? "אין רשומות תואמות. נסה לרכך את הסינון."
                    : "יומן הביקורת ריק."}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className={`hover:bg-slate-50 transition-colors group ${log.is_destructive ? "bg-red-50/40" : ""}`}
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{log.id}</td>
                  <td className="px-6 py-4 font-bold text-slate-700">{log.date}</td>
                  <td className="px-6 py-4 font-bold text-slate-700">{log.time}</td>
                  <td className="px-6 py-4 font-bold text-[#002649]">{log.action}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${statusClass(log.status)}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-600">{log.ip_address}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs max-w-md truncate" title={log.details}>
                    {log.details}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{log.user}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
        <span className="text-xs text-slate-500 font-bold">
          עמוד {page} ({logs.length} רשומות בעמוד זה)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={isAtFirstPage || isLoading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronRight size={14} /> הקודם
          </button>
          <button
            type="button"
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={isPartialPage || isLoading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            הבא <ChevronLeft size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
