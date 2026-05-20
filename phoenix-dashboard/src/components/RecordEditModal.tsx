"use client";
import { useState } from "react";
import { X, Save, Loader2, AlertTriangle } from "lucide-react";

type EntityType = "candidate" | "job" | "application";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "tel" | "email" | "url" | "date" | "number" | "textarea";
  required?: boolean;
}

const FIELD_CONFIG: Record<EntityType, FieldDef[]> = {
  candidate: [
    { key: "name", label: "שם מלא", type: "text", required: true },
    { key: "phone", label: "טלפון", type: "tel" },
    { key: "email", label: "אימייל", type: "email" },
    { key: "source", label: "מקור", type: "text" },
    { key: "linkedin", label: "LinkedIn URL", type: "url" },
    { key: "notes", label: "הערות", type: "textarea" },
  ],
  job: [
    { key: "job_title", label: "כותרת משרה", type: "text", required: true },
    { key: "department", label: "חטיבה", type: "text", required: true },
    { key: "hiring_manager", label: "מנהל מגייס", type: "text" },
    { key: "opened_at", label: "תאריך פתיחה", type: "date" },
    { key: "closed_at", label: "תאריך סגירה", type: "date" },
    { key: "close_reason", label: "סיבת סגירה", type: "text" },
    { key: "target_count", label: "תקן", type: "number" },
  ],
  application: [
    { key: "recruiter", label: "מגייסת", type: "text" },
    { key: "application_date", label: "תאריך הגשה", type: "date" },
    { key: "days_in_process", label: "ימים בתהליך", type: "number" },
  ],
};

const ENDPOINT: Record<EntityType, (id: string) => string> = {
  candidate: (id) => `/api/candidates/${id}`,
  job: (id) => `/api/jobs/${id}`,
  application: (id) => `/api/applications/${id}`,
};

const TITLE: Record<EntityType, string> = {
  candidate: "עריכת מועמד",
  job: "עריכת משרה",
  application: "עריכת תהליך",
};

interface ConflictDetail {
  message: string;
  code?: string;
}

export default function RecordEditModal({
  entityType,
  entityId,
  initialData,
  onSave,
  onClose,
}: {
  entityType: EntityType;
  entityId: string;
  initialData: Record<string, unknown>;
  onSave: (updated: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const fields = FIELD_CONFIG[entityType];
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      const val = initialData[f.key];
      init[f.key] = val != null ? String(val) : "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ConflictDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setConflict(null);

    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = form[f.key];
      const original = initialData[f.key] != null ? String(initialData[f.key]) : "";
      if (v !== original) {
        body[f.key] = f.type === "number" ? Number(v) : v;
      }
    }

    try {
      const res = await fetch(ENDPOINT[entityType](entityId), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as Record<string, unknown>;
      if (res.status === 409) {
        const detail = data.detail as Record<string, string> | undefined;
        setConflict({ message: detail?.message ?? "קונפליקט — הנתון כבר קיים", code: detail?.code });
        setSaving(false);
        return;
      }
      if (!res.ok) {
        const detail = data.detail;
        setError(typeof detail === "string" ? detail : JSON.stringify(detail));
        setSaving(false);
        return;
      }
      const updated = (data[entityType] ?? data) as Record<string, unknown>;
      onSave(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  async function saveForce() {
    // Called when user explicitly overrides a conflict warning
    // We just ignore the conflict and send again — backend doesn't enforce
    // a "force" flag for these, so saving again after conflict is the override
    setConflict(null);
    await save();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-black text-[#002649] text-base">{TITLE[entityType]}</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Conflict warning */}
          {conflict && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-800 text-sm">{conflict.message}</div>
                <div className="text-xs text-amber-600 mt-1">
                  הנתון שהזנת כבר משויך לרשומה אחרת. האם לשמור בכל זאת?
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={saveForce}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    שמור בכל זאת
                  </button>
                  <button
                    onClick={() => setConflict(null)}
                    className="px-3 py-1.5 text-xs font-bold border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Generic error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Fields */}
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-bold text-slate-600">
                {f.label}
                {f.required && <span className="text-red-500 mr-1">*</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  rows={3}
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#002649] resize-none transition-colors"
                />
              ) : (
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#002649] transition-colors"
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-100 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-[#002649] text-white rounded-xl hover:bg-[#EF6B00] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}
