"use client";
import { useRef, useState } from "react";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface SmartSheetResult {
  sheet_name: string;
  detected_type: string | null;
  confidence: number;
  received: number;
  inserted: number;
  updated: number;
  rejected: number;
  skipped_duplicate: number;
  batch_id: string | null;
  status: "success" | "error" | "skipped" | "pending";
  error: string | null;
}

interface SmartIngestResult {
  status: "success" | "partial" | "failed";
  filename: string;
  sheets: SmartSheetResult[];
  data_version: number | null;
}

const TYPE_HE: Record<string, string> = {
  jobs: "משרות",
  candidates: "מועמדים",
  hires: "גיוסים",
  headcount: "תקן מצבה",
  diversity: "גיוון",
  attrition: "עזיבות",
  budget: "תקציב",
};

export default function SmartIngestPanel({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">(
    "idle"
  );
  const [result, setResult] = useState<SmartIngestResult | null>(null);
  const [dlTemplate, setDlTemplate] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      alert("יש להעלות קובץ .xlsx בלבד");
      return;
    }
    setState("uploading");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/ingest/smart", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          (data as { detail?: string }).detail ?? "שגיאת שרת"
        );
      setResult(data as SmartIngestResult);
      setState("done");
      if ((data as SmartIngestResult).status !== "failed") onSuccess?.();
    } catch (e: unknown) {
      setState("error");
      setResult(null);
      alert(e instanceof Error ? e.message : "שגיאה");
    }
  }

  async function downloadTemplate() {
    setDlTemplate(true);
    try {
      const res = await fetch("/api/ingest/smart-template", {
        credentials: "include",
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Phoenix_SmartIngest_Template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDlTemplate(false);
    }
  }

  const successCount =
    result?.sheets.filter((s) => s.status === "success").length ?? 0;
  const totalIn =
    result?.sheets.reduce((a, s) => a + s.inserted + s.updated, 0) ?? 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-[#002649] text-base">
            Smart Ingest — Excel מאוחד
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            קובץ Excel אחד עם עד 7 גיליונות — המערכת מזהה ומעבדת הכל
            אוטומטית
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          disabled={dlTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-[#002649] hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {dlTemplate ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          הורד תבנית
        </button>
      </div>

      {/* Dropzone — shown when not in done state */}
      {state !== "done" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) upload(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors select-none
            ${
              dragOver
                ? "border-[#EF6B00] bg-orange-50"
                : "border-slate-200 hover:border-[#002649] hover:bg-slate-50"
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          {state === "uploading" ? (
            <Loader2 size={32} className="animate-spin text-[#002649]" />
          ) : (
            <Upload size={32} className="text-slate-400" />
          )}
          <div className="text-sm font-bold text-slate-500 text-center">
            {state === "uploading"
              ? "מעלה ומעבד גיליונות..."
              : "גרור קובץ .xlsx לכאן או לחץ לבחירה"}
          </div>
          {state === "idle" && (
            <div className="text-xs text-slate-400">
              המערכת מזהה אוטומטית: משרות, מועמדים, גיוסים, תקן, גיוון,
              עזיבות, תקציב
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {state === "done" && result && (
        <div className="space-y-4">
          {/* Summary banner */}
          <div
            className={`rounded-2xl p-4 flex items-center gap-3 text-sm font-bold
            ${
              result.status === "success"
                ? "bg-green-50 text-green-800"
                : result.status === "partial"
                ? "bg-amber-50 text-amber-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {result.status === "success" ? (
              <CheckCircle2 size={18} />
            ) : result.status === "partial" ? (
              <AlertTriangle size={18} />
            ) : (
              <XCircle size={18} />
            )}
            {result.status === "success"
              ? `נקלטו ${successCount} גיליונות — סה"כ ${totalIn} שורות עודכנו/נוספו`
              : result.status === "partial"
              ? `${successCount} מתוך ${result.sheets.length} גיליונות נקלטו`
              : "הטעינה נכשלה — אין גיליונות שזוהו"}
          </div>

          {/* Per-sheet table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="text-slate-400 font-bold border-b border-slate-100">
                <tr>
                  <th className="pb-2 pr-0">גיליון</th>
                  <th className="pb-2">זוהה כ</th>
                  <th className="pb-2 text-center">קיבל</th>
                  <th className="pb-2 text-center">חדש</th>
                  <th className="pb-2 text-center">עדכון</th>
                  <th className="pb-2 text-center">נדחה</th>
                  <th className="pb-2">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {result.sheets.map((s) => (
                  <tr key={s.sheet_name} className="hover:bg-slate-50/50">
                    <td className="py-2 font-bold text-[#002649]">
                      {s.sheet_name}
                    </td>
                    <td className="py-2 text-slate-600">
                      {s.detected_type
                        ? TYPE_HE[s.detected_type] ?? s.detected_type
                        : "—"}
                      {s.detected_type && s.confidence < 1 && (
                        <span className="text-slate-400 ml-1">
                          ({Math.round(s.confidence * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-2 font-mono text-center">{s.received}</td>
                    <td className="py-2 font-mono text-center text-green-600">
                      {s.inserted}
                    </td>
                    <td className="py-2 font-mono text-center text-blue-600">
                      {s.updated}
                    </td>
                    <td className="py-2 font-mono text-center text-red-500">
                      {s.rejected}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col gap-0.5 items-end">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black
                          ${
                            s.status === "success"
                              ? "bg-green-100 text-green-700"
                              : s.status === "skipped"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {s.status === "success"
                            ? "✓ נקלט"
                            : s.status === "skipped"
                            ? "דולג"
                            : "שגיאה"}
                        </span>
                        {s.error && (
                          <span className="text-red-500 text-[10px] max-w-[160px] truncate">
                            {s.error}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => {
              setState("idle");
              setResult(null);
            }}
            className="text-xs font-bold text-[#002649] hover:underline"
          >
            ← העלאה נוספת
          </button>
        </div>
      )}
    </div>
  );
}
