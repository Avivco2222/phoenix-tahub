"use client";

/**
 * CVAnalyzer — Tier-1 tool, heuristic first-pass (no LLM yet).
 *
 * Recruiter pastes CV text → component extracts likely fields with regex/keyword
 * heuristics and shows a structured preview: name guess, contact, years of
 * experience, technologies, education level, language. Output is editable so
 * the recruiter can fix mistakes before saving.
 *
 * The component is wired to call a future `POST /api/ai/cv-analyze` for richer
 * LLM-based extraction (currently disabled with a "Coming soon" badge).
 */

import React, { useMemo, useState } from "react";
import { FileSearch, Sparkles, Mail, Phone, Calendar, GraduationCap, Code, Globe, Copy } from "lucide-react";

interface Extracted {
  name?: string;
  email?: string;
  phone?: string;
  yearsOfExperience?: number;
  technologies: string[];
  educationLevel?: string;
  languages: string[];
}

const TECH_KEYWORDS = [
  // languages
  "Python", "JavaScript", "TypeScript", "Java", "Go", "Rust", "C++", "C#",
  "Kotlin", "Swift", "Ruby", "PHP", "Scala",
  // frontend
  "React", "Vue", "Angular", "Next.js", "Svelte", "Redux",
  // backend
  "Node.js", "Express", "FastAPI", "Django", "Flask", "Spring", "NestJS",
  // data
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
  "Snowflake", "BigQuery", "dbt", "Airflow", "Spark", "Kafka",
  // cloud / devops
  "AWS", "GCP", "Azure", "Kubernetes", "Docker", "Terraform", "Jenkins", "GitHub Actions",
  // ML
  "TensorFlow", "PyTorch", "scikit-learn", "pandas", "NumPy", "LangChain",
];

const EDUCATION_PATTERNS: Array<[RegExp, string]> = [
  [/\b(Ph\.?D|דוקטור|דוקטורט)\b/i, "PhD"],
  [/\b(M\.?Sc|Master|MBA|תואר שני|מאסטר)\b/i, "תואר שני"],
  [/\b(B\.?Sc|B\.?A|Bachelor|תואר ראשון|בוגר)\b/i, "תואר ראשון"],
];

const LANGUAGE_PATTERNS = [
  { pattern: /\b(Hebrew|עברית)\b/i, label: "עברית" },
  { pattern: /\b(English|אנגלית)\b/i, label: "אנגלית" },
  { pattern: /\b(Russian|רוסית)\b/i, label: "רוסית" },
  { pattern: /\b(Arabic|ערבית)\b/i, label: "ערבית" },
  { pattern: /\b(French|צרפתית)\b/i, label: "צרפתית" },
];

function analyze(text: string): Extracted {
  const result: Extracted = { technologies: [], languages: [] };

  // Email — standard pattern
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) result.email = emailMatch[0].toLowerCase();

  // Phone — Israeli + international
  const phoneMatch = text.match(/(\+972[-\s]?\d{1,2}[-\s]?\d{3}[-\s]?\d{4}|0\d{1,2}[-\s]?\d{3}[-\s]?\d{4})/);
  if (phoneMatch) result.phone = phoneMatch[0].replace(/[-\s]/g, "");

  // Name guess — first non-empty line that's 2-4 words, all letters
  const firstLines = text.split(/\n+/).slice(0, 5).map(l => l.trim()).filter(Boolean);
  for (const line of firstLines) {
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && /^[A-Za-z֐-׿\s]+$/.test(line)) {
      result.name = line;
      break;
    }
  }

  // Years of experience — patterns like "5 years" or "5 שנות"
  const yoeMatch = text.match(/(\d+)\+?\s*(?:years?|year|שנות|שנים)/i);
  if (yoeMatch) result.yearsOfExperience = parseInt(yoeMatch[1], 10);

  // Tech keywords — case-insensitive match
  const lower = text.toLowerCase();
  for (const kw of TECH_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      result.technologies.push(kw);
    }
  }

  // Education level — pick the highest matched
  for (const [pat, label] of EDUCATION_PATTERNS) {
    if (pat.test(text)) {
      result.educationLevel = label;
      break;
    }
  }

  // Languages
  for (const { pattern, label } of LANGUAGE_PATTERNS) {
    if (pattern.test(text)) result.languages.push(label);
  }

  return result;
}

export default function CVAnalyzer() {
  const [cvText, setCvText] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [edited, setEdited] = useState<Extracted | null>(null);

  const extracted = useMemo(() => (cvText.trim() ? analyze(cvText) : null), [cvText]);

  const handleAnalyze = () => {
    if (extracted) {
      setEdited(extracted);
      setShowResults(true);
    }
  };

  const copySummary = () => {
    if (!edited) return;
    const lines = [
      `שם: ${edited.name || "—"}`,
      `אימייל: ${edited.email || "—"}`,
      `טלפון: ${edited.phone || "—"}`,
      `שנות ניסיון: ${edited.yearsOfExperience ?? "—"}`,
      `השכלה: ${edited.educationLevel || "—"}`,
      `שפות: ${edited.languages.join(", ") || "—"}`,
      `טכנולוגיות: ${edited.technologies.join(", ") || "—"}`,
    ];
    void navigator.clipboard.writeText(lines.join("\n"));
  };

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* INPUT */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileSearch size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#002649]">ניתוח קורות חיים</h3>
            <p className="text-sm text-slate-500">הדבק/י את תוכן הקובץ — נחלץ שדות אוטומטית.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <textarea
            value={cvText}
            onChange={e => setCvText(e.target.value)}
            placeholder="הדבק/י כאן את תוכן ה-CV (טקסט). תמיכה ב-PDF/Docx upload תופעל בגרסה הבאה."
            rows={16}
            className="w-full p-4 rounded-2xl text-sm font-mono text-[#002649] focus:outline-none resize-y"
          />
          <div className="border-t border-slate-100 p-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {cvText.length > 0 ? `${cvText.length.toLocaleString()} תווים` : "כתוב/י או הדבק/י תוכן כדי להתחיל"}
            </div>
            <div className="flex gap-2">
              <button
                disabled={!cvText.trim()}
                onClick={handleAnalyze}
                className="px-4 py-2 rounded-xl bg-[#EF6B00] text-white text-sm font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#d65a00] flex items-center gap-2"
              >
                <Sparkles size={14}/> נתח/י
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 p-4 bg-slate-50/50">
          <div className="flex items-start gap-3">
            <div className="text-xs text-slate-500 leading-relaxed">
              <span className="font-bold text-[#002649]">איך זה עובד:</span> השלב הראשון משתמש בחוקים מקומיים (regex / keyword matching) — מהיר, פרטי, ללא קריאות חיצוניות.
              העלאת PDF + ניתוח LLM עם fit-score מול תיק משרה — בקרוב.
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <div className="lg:col-span-2 space-y-3">
        {!showResults || !edited ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center min-h-[300px] flex flex-col items-center justify-center text-slate-400">
            <Sparkles size={36} strokeWidth={1.5} className="mb-3"/>
            <p className="text-sm font-bold">תוצאות הניתוח יוצגו כאן</p>
            <p className="text-xs mt-1">הדבק/י CV ולחץ/י על &quot;נתח/י&quot;</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="font-black text-[#002649]">פרופיל מועמד/ת</div>
              <button onClick={copySummary} className="text-xs font-bold text-[#EF6B00] hover:underline flex items-center gap-1">
                <Copy size={12}/> העתק סיכום
              </button>
            </div>
            <div className="p-4 space-y-3">
              <Row label="שם" icon={<FileSearch size={12}/>} value={edited.name}
                   onChange={v => setEdited({ ...edited, name: v })} />
              <Row label="אימייל" icon={<Mail size={12}/>} value={edited.email}
                   onChange={v => setEdited({ ...edited, email: v })} />
              <Row label="טלפון" icon={<Phone size={12}/>} value={edited.phone}
                   onChange={v => setEdited({ ...edited, phone: v })} />
              <Row label="שנות ניסיון" icon={<Calendar size={12}/>}
                   value={edited.yearsOfExperience !== undefined ? String(edited.yearsOfExperience) : ""}
                   onChange={v => setEdited({ ...edited, yearsOfExperience: v ? parseInt(v, 10) : undefined })} />
              <Row label="השכלה" icon={<GraduationCap size={12}/>} value={edited.educationLevel}
                   onChange={v => setEdited({ ...edited, educationLevel: v })} />

              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <Globe size={12}/> שפות
                </div>
                <div className="flex flex-wrap gap-1">
                  {edited.languages.length === 0 && <span className="text-xs text-slate-400">לא זוהו</span>}
                  {edited.languages.map(l => (
                    <span key={l} className="text-xs font-bold bg-slate-100 text-[#002649] px-2 py-0.5 rounded-full">{l}</span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  <Code size={12}/> טכנולוגיות ({edited.technologies.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {edited.technologies.length === 0 && <span className="text-xs text-slate-400">לא זוהו</span>}
                  {edited.technologies.map(t => (
                    <span key={t} className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, icon, value, onChange }: {
  label: string; icon: React.ReactNode; value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
        {icon} {label}
      </div>
      <input
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="w-full text-sm font-bold text-[#002649] bg-transparent border-b border-slate-100 py-1 focus:outline-none focus:border-[#EF6B00]"
      />
    </div>
  );
}
