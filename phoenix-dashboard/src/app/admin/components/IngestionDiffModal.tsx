"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { XCircle, Loader2, Plus, Pencil, Trash2, FileText } from "lucide-react";

type ChangeType = "insert" | "update" | "delete";

interface ChangeRow {
  id: number;
  entity_type: string;
  entity_id: string;
  change_type: ChangeType;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

interface DiffResponse {
  batch_id: string;
  counts: { insert: number; update: number; delete: number };
  total: number;
  rows: ChangeRow[];
}

interface Props {
  batchId: string;
  onClose: () => void;
}

const TAB_META: Record<ChangeType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  insert: { label: "הוספות", icon: <Plus size={14} />, color: "text-green-700", bg: "bg-green-50 border-green-200" },
  update: { label: "עדכונים", icon: <Pencil size={14} />, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  delete: { label: "מחיקות", icon: <Trash2 size={14} />, color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

export function IngestionDiffModal({ batchId, onClose }: Props) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const [activeTab, setActiveTab] = useState<ChangeType>("update");
  const [data, setData] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChanges = useCallback(async (type: ChangeType) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/admin/ingestion/batch/${encodeURIComponent(batchId)}/changes?type=${type}&limit=100`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`לא ניתן לטעון שינויים (${res.status})`);
        setData(null);
        return;
      }
      const json = (await res.json()) as DiffResponse;
      setData(json);
    } catch {
      setError("שגיאת רשת. ודאי שה-Backend פעיל.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, batchId]);

  useEffect(() => {
    fetchChanges(activeTab);
  }, [fetchChanges, activeTab]);

  // Pick the tab with most rows on first load if "update" is empty
  useEffect(() => {
    if (data && data.counts[activeTab] === 0) {
      const next = (Object.keys(data.counts) as ChangeType[]).find(k => data.counts[k] > 0);
      if (next && next !== activeTab) setActiveTab(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.batch_id]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002649] text-white flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#002649]">שינויי קליטה ברמת רשומה</h2>
              <div className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">{batchId}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
            <XCircle size={22} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-white">
          {(["insert", "update", "delete"] as ChangeType[]).map(tab => {
            const meta = TAB_META[tab];
            const count = data?.counts[tab] ?? 0;
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors border-b-2 ${
                  active
                    ? `${meta.color} border-current bg-slate-50/50`
                    : "text-slate-500 border-transparent hover:bg-slate-50"
                }`}
              >
                {meta.icon}
                {meta.label}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${active ? meta.bg : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={28} className="animate-spin text-[#EF6B00]" />
            </div>
          )}
          {!loading && error && (
            <div className="text-center py-16">
              <p className="text-red-600 font-bold mb-3">{error}</p>
              <button onClick={() => fetchChanges(activeTab)} className="bg-[#002649] text-white px-5 py-2 rounded-xl font-bold hover:bg-[#EF6B00] transition-colors">
                נסי שוב
              </button>
            </div>
          )}
          {!loading && !error && data && data.rows.length === 0 && (
            <div className="text-center py-16 text-slate-400 font-medium">
              {data.counts[activeTab] === 0
                ? `אין ${TAB_META[activeTab].label} ב-batch זה.`
                : "טוען..."}
            </div>
          )}
          {!loading && !error && data && data.rows.length > 0 && (
            <div className="space-y-3">
              {data.rows.map(row => (
                <ChangeCard key={row.id} row={row} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-100 bg-white flex justify-between items-center">
          <div className="text-xs text-slate-500 font-medium">
            {data ? (
              <>
                סה&quot;כ: <span className="font-black text-[#002649]">{data.total}</span> שינויים
                {data.counts.insert > 0 && <span className="text-green-600"> · +{data.counts.insert}</span>}
                {data.counts.update > 0 && <span className="text-amber-600"> · ~{data.counts.update}</span>}
                {data.counts.delete > 0 && <span className="text-red-600"> · -{data.counts.delete}</span>}
              </>
            ) : "—"}
          </div>
          <button onClick={onClose} className="px-6 py-2.5 font-bold text-white bg-[#002649] hover:bg-[#EF6B00] rounded-xl transition-colors">
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeCard({ row }: { row: ChangeRow }) {
  const meta = TAB_META[row.change_type];
  const before = useMemo(() => row.before ?? {}, [row.before]);
  const after = useMemo(() => row.after ?? {}, [row.after]);
  const allKeys = useMemo(
    () => Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort(),
    [before, after],
  );

  if (row.change_type === "update") {
    return (
      <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${meta.bg}`}>
        <div className="px-4 py-2 border-b border-slate-100 bg-white/80 flex items-center justify-between">
          <span className={`text-[11px] font-black uppercase tracking-wider ${meta.color} flex items-center gap-1.5`}>
            {meta.icon} {row.entity_type} · {row.entity_id}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">#{row.id}</span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 font-bold">
            <tr>
              <th className="px-4 py-2 text-right w-32">שדה</th>
              <th className="px-4 py-2 text-right">לפני</th>
              <th className="px-4 py-2 text-right">אחרי</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.map(key => {
              const b = before[key];
              const a = after[key];
              const changed = JSON.stringify(b) !== JSON.stringify(a);
              return (
                <tr key={key} className={`border-t border-slate-100 ${changed ? "bg-amber-50/40" : ""}`}>
                  <td className="px-4 py-2 font-bold text-slate-700">{key}</td>
                  <td className={`px-4 py-2 ${changed ? "text-red-600 line-through" : "text-slate-500"}`}>{formatValue(b)}</td>
                  <td className={`px-4 py-2 ${changed ? "text-green-700 font-bold" : "text-slate-500"}`}>{formatValue(a)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // insert / delete: show single side
  const payload = row.change_type === "insert" ? row.after : row.before;
  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${meta.bg}`}>
      <div className="px-4 py-2 border-b border-slate-100 bg-white/80 flex items-center justify-between">
        <span className={`text-[11px] font-black uppercase tracking-wider ${meta.color} flex items-center gap-1.5`}>
          {meta.icon} {row.entity_type} · {row.entity_id}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">#{row.id}</span>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {Object.entries(payload ?? {}).map(([key, value]) => (
            <tr key={key} className="border-t border-slate-100">
              <td className="px-4 py-2 font-bold text-slate-700 w-32">{key}</td>
              <td className={`px-4 py-2 ${meta.color}`}>{formatValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v || "—";
  return JSON.stringify(v);
}
