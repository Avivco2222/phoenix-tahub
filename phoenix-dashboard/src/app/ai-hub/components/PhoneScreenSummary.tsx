"use client";

/**
 * PhoneScreenSummary — Tier-1 tool (full).
 *
 * Recruiter types bullet notes during/after a phone screen → the tool extracts
 * structured insight: strengths, concerns, missing info, recommended next step.
 *
 * v1 uses keyword classification (no LLM): each bullet line is classified into
 * one of 4 buckets based on Hebrew/English signal words. The recruiter can
 * drag-edit which bucket a line belongs to before exporting.
 */

import React, { useMemo, useState } from "react";
import { Phone, ThumbsUp, AlertTriangle, HelpCircle, ArrowRightCircle, Copy } from "lucide-react";

type Bucket = "strength" | "concern" | "missing" | "next";

const POSITIVE_SIGNALS = [
  "מצוין", "טוב מאוד", "מרשים", "חזק", "מנוסה", "experience", "strong", "excellent",
  "מומחה", "מוביל", "שולט", "בקיא", "skilled", "expert", "knows", "מומלץ",
];
const NEGATIVE_SIGNALS = [
  "חוסר", "בעיה", "חלש", "חששות", "תהיות", "לא ברור", "אדום", "concern", "weak",
  "missing", "gap", "מטריד", "תקיעה", "אין ניסיון", "לא מתאים",
];
const QUESTION_SIGNALS = [
  "?", "לבדוק", "להבהיר", "לא יודע", "לא מצוין", "לברר", "נדרש מידע",
  "follow up", "tbd", "to check",
];
const NEXT_SIGNALS = [
  "להתקדם", "ראיון", "next step", "schedule", "פוליו", "פרונט אל פרונט", "מבחן",
  "פגישה", "advance", "decline", "לדחות", "לסיים", "לאשר",
];

function classify(line: string): Bucket {
  const lower = line.toLowerCase();
  if (NEXT_SIGNALS.some(s => lower.includes(s.toLowerCase()))) return "next";
  if (QUESTION_SIGNALS.some(s => lower.includes(s.toLowerCase()))) return "missing";
  if (NEGATIVE_SIGNALS.some(s => lower.includes(s.toLowerCase()))) return "concern";
  if (POSITIVE_SIGNALS.some(s => lower.includes(s.toLowerCase()))) return "strength";
  return "strength"; // default optimistic
}

interface ClassifiedLine { id: string; bucket: Bucket; text: string }

const BUCKET_META: Record<Bucket, { label: string; icon: React.ReactNode; accent: string; bg: string }> = {
  strength: { label: "חוזקות", icon: <ThumbsUp size={14}/>, accent: "#10B981", bg: "bg-emerald-50 border-emerald-200" },
  concern: { label: "חששות", icon: <AlertTriangle size={14}/>, accent: "#EF4444", bg: "bg-rose-50 border-rose-200" },
  missing: { label: "מידע חסר", icon: <HelpCircle size={14}/>, accent: "#F59E0B", bg: "bg-amber-50 border-amber-200" },
  next: { label: "צעדים הבאים", icon: <ArrowRightCircle size={14}/>, accent: "#3B82F6", bg: "bg-blue-50 border-blue-200" },
};

export default function PhoneScreenSummary() {
  const [candidateName, setCandidateName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [classified, setClassified] = useState<ClassifiedLine[]>([]);
  const [copied, setCopied] = useState(false);

  const analyze = () => {
    const lines = notes
      .split(/\n+/)
      .map(l => l.trim())
      .map(l => l.replace(/^[-*•]\s*/, ""))
      .filter(Boolean);
    setClassified(lines.map((l, i) => ({ id: `L-${i}`, bucket: classify(l), text: l })));
  };

  const moveTo = (id: string, bucket: Bucket) =>
    setClassified(prev => prev.map(l => l.id === id ? { ...l, bucket } : l));

  const grouped = useMemo(() => {
    const out: Record<Bucket, ClassifiedLine[]> = { strength: [], concern: [], missing: [], next: [] };
    classified.forEach(l => out[l.bucket].push(l));
    return out;
  }, [classified]);

  const buildSummary = () => {
    const sections = (Object.keys(BUCKET_META) as Bucket[]).map(b => {
      const lines = grouped[b];
      if (lines.length === 0) return "";
      return `## ${BUCKET_META[b].label}\n${lines.map(l => `- ${l.text}`).join("\n")}`;
    }).filter(Boolean).join("\n\n");
    return `# סיכום שיחת סינון\n**מועמד/ת:** ${candidateName || "—"}\n**משרה:** ${jobTitle || "—"}\n\n${sections}`;
  };

  const copy = () => {
    void navigator.clipboard.writeText(buildSummary());
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const overallRec = useMemo(() => {
    const s = grouped.strength.length;
    const c = grouped.concern.length;
    if (s > c * 2) return { label: "להתקדם לראיון טכני", color: "text-emerald-700 bg-emerald-100" };
    if (c > s) return { label: "לדחות / שיחה משלימה", color: "text-rose-700 bg-rose-100" };
    return { label: "להמשיך לבדיקה", color: "text-amber-700 bg-amber-100" };
  }, [grouped]);

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Phone size={24}/>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#002649]">סיכום שיחת סינון</h3>
            <p className="text-sm text-slate-500">הקלד/י bullets — נסווג לחוזקות / חששות / מידע חסר / next.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="שם המועמד/ת"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#002649]"/>
          <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="משרה"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#002649]"/>
        </div>

        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={14}
          placeholder={`הדבק/י או הקלד/י bullets, אחד בכל שורה. לדוגמה:\n\n- שולט מצוין ב-Python\n- חוסר ניסיון ב-K8s\n- לא ברור אם רוצה לעבור לתל-אביב\n- להתקדם לראיון טכני`}
          className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono text-[#002649] focus:outline-none focus:border-[#EF6B00] resize-y"/>

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">{notes.split(/\n/).filter(l => l.trim()).length} שורות</div>
          <button onClick={analyze} disabled={!notes.trim()}
            className="px-4 py-2 rounded-xl bg-[#EF6B00] text-white text-sm font-black disabled:opacity-40 hover:bg-[#d65a00]">
            סווג/י
          </button>
        </div>
      </div>

      <div className="lg:col-span-3 space-y-3">
        {classified.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400 min-h-[400px] flex items-center justify-center">
            <div>
              <Phone size={36} strokeWidth={1.5} className="mx-auto mb-3"/>
              <p className="text-sm font-bold">לחץ/י על &quot;סווג/י&quot; להמשך</p>
            </div>
          </div>
        ) : (
          <>
            <div className={`rounded-xl p-3 flex items-center justify-between ${overallRec.color}`}>
              <div className="font-black text-sm">המלצה כללית: {overallRec.label}</div>
              <button onClick={copy} className="text-xs font-bold flex items-center gap-1 bg-white/40 px-2.5 py-1 rounded">
                <Copy size={12}/> {copied ? "הועתק" : "העתק סיכום"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(BUCKET_META) as Bucket[]).map(b => (
                <div key={b} className={`rounded-xl border p-3 ${BUCKET_META[b].bg}`}>
                  <div className="flex items-center gap-2 mb-2 font-black text-sm" style={{ color: BUCKET_META[b].accent }}>
                    {BUCKET_META[b].icon} {BUCKET_META[b].label} ({grouped[b].length})
                  </div>
                  <ul className="space-y-1">
                    {grouped[b].map(l => (
                      <li key={l.id} className="text-xs text-[#002649] bg-white/70 rounded-lg px-2 py-1.5 flex items-start gap-2">
                        <span className="flex-1">{l.text}</span>
                        <select value={l.bucket} onChange={e => moveTo(l.id, e.target.value as Bucket)}
                          className="text-[10px] bg-transparent border border-slate-200 rounded px-1 font-bold">
                          {(Object.keys(BUCKET_META) as Bucket[]).map(o => <option key={o} value={o}>{BUCKET_META[o].label}</option>)}
                        </select>
                      </li>
                    ))}
                    {grouped[b].length === 0 && <li className="text-xs text-slate-400 italic">אין פריטים</li>}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
