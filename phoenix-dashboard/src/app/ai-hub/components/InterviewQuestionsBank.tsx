"use client";

/**
 * InterviewQuestionsBank — Tier-1 tool, no LLM required.
 *
 * Static bank of behavioral + technical questions, filterable by role and stage.
 * Recruiter picks role → stage → sees curated list. Can copy individual questions
 * or the whole list to clipboard. Future iteration: per-candidate history +
 * AI-personalised follow-ups based on CV.
 */

import React, { useMemo, useState } from "react";
import { BookOpen, Copy, Search } from "lucide-react";

type Stage = "screening" | "technical" | "behavioral" | "manager" | "final";
type Role = "backend" | "frontend" | "fullstack" | "data" | "devops" | "qa" | "pm" | "sales" | "cs" | "hr";

interface Question {
  id: string;
  role: Role | "*";       // "*" = applies to all roles
  stage: Stage;
  text: string;
  followups?: string[];
}

const ROLE_LABELS: Record<Role, string> = {
  backend: "Backend Engineer",
  frontend: "Frontend Engineer",
  fullstack: "Fullstack Engineer",
  data: "Data / ML",
  devops: "DevOps / SRE",
  qa: "QA Engineer",
  pm: "Product Manager",
  sales: "Sales / Account",
  cs: "Customer Success",
  hr: "HR / People",
};

const STAGE_LABELS: Record<Stage, string> = {
  screening: "סינון ראשוני",
  technical: "ראיון טכני",
  behavioral: "ראיון התנהגותי",
  manager: "ראיון מנהל",
  final: "ראיון סיכום",
};

const QUESTIONS: Question[] = [
  // --- Screening (applies to all roles) ---
  { id: "s1", role: "*", stage: "screening", text: "ספר/י לי קצרות על הניסיון המקצועי שלך בשנים האחרונות." },
  { id: "s2", role: "*", stage: "screening", text: "למה התעניינת דווקא במשרה הזו?" },
  { id: "s3", role: "*", stage: "screening", text: "מהן הציפיות שלך מתפקיד הבא שלך?" },
  { id: "s4", role: "*", stage: "screening", text: "מהי טווח השכר שאת/ה מצפה לקבל?" },
  { id: "s5", role: "*", stage: "screening", text: "מתי תוכל/י להתחיל לעבוד?" },

  // --- Behavioral (cross-role) ---
  { id: "b1", role: "*", stage: "behavioral", text: "ספר/י על מצב שבו הייתה לך מחלוקת חריפה עם עמית/ה בעבודה. איך פתרתם אותה?",
    followups: ["מה היה הלקח?", "האם הגעתם לפתרון יחד או שמישהו ויתר?"] },
  { id: "b2", role: "*", stage: "behavioral", text: "תאר/י פעם שנכשלת בפרויקט. מה קרה?",
    followups: ["מה היית עושה אחרת היום?"] },
  { id: "b3", role: "*", stage: "behavioral", text: "ספר/י על משימה שבה היית צריך/ה ללמוד טכנולוגיה חדשה מהר מאוד." },
  { id: "b4", role: "*", stage: "behavioral", text: "איך את/ה מתמודד/ת עם דד-ליין צפוף?" },
  { id: "b5", role: "*", stage: "behavioral", text: "תן/י דוגמה לפעם שהיית צריך/ה לקבל החלטה ללא כל המידע." },

  // --- Backend technical ---
  { id: "t-be-1", role: "backend", stage: "technical",
    text: "הסבר/י את ההבדל בין SQL ל-NoSQL. מתי תבחר/י באחד מהם?" },
  { id: "t-be-2", role: "backend", stage: "technical",
    text: "מה זה idempotency ב-REST API ולמה הוא חשוב?",
    followups: ["איזה HTTP methods נחשבים idempotent?"] },
  { id: "t-be-3", role: "backend", stage: "technical",
    text: "תאר/י כיצד היית מתכנן/ת מערכת לסליקת תשלומים בקנה מידה גדול." },
  { id: "t-be-4", role: "backend", stage: "technical",
    text: "מה ההבדל בין Process ל-Thread? באיזה מקרה תבחר/י באחד מהם?" },

  // --- Frontend technical ---
  { id: "t-fe-1", role: "frontend", stage: "technical",
    text: "הסבר/י את ההבדל בין SSR, SSG ו-CSR ב-Next.js." },
  { id: "t-fe-2", role: "frontend", stage: "technical",
    text: "מה זה Virtual DOM ולמה React משתמש בו?" },
  { id: "t-fe-3", role: "frontend", stage: "technical",
    text: "איך היית מטפל/ת ב-state management באפליקציה גדולה?",
    followups: ["מתי לבחור ב-Redux ומתי ב-Context?"] },

  // --- Fullstack ---
  { id: "t-fs-1", role: "fullstack", stage: "technical",
    text: "תאר/י end-to-end flow של בקשת login: מהדפדפן עד מסד הנתונים וחזרה." },

  // --- Data / ML ---
  { id: "t-da-1", role: "data", stage: "technical",
    text: "מה ההבדל בין supervised ל-unsupervised learning?" },
  { id: "t-da-2", role: "data", stage: "technical",
    text: "תאר/י cross-validation. למה משתמשים בה?" },

  // --- DevOps ---
  { id: "t-do-1", role: "devops", stage: "technical",
    text: "תאר/י pipeline CI/CD מודרני. אילו שלבים יש בו?" },
  { id: "t-do-2", role: "devops", stage: "technical",
    text: "ההבדל בין VM, Container ו-Serverless. מתי לבחור בכל אחד?" },

  // --- QA ---
  { id: "t-qa-1", role: "qa", stage: "technical",
    text: "מה ההבדל בין black-box ל-white-box testing?" },

  // --- Product Manager ---
  { id: "t-pm-1", role: "pm", stage: "technical",
    text: "תאר/י איך היית מתעדף/ת backlog של 50 פיצ'רים." },
  { id: "t-pm-2", role: "pm", stage: "technical",
    text: "ספר/י על KPI שעקבת אחריו. למה דווקא הוא?" },

  // --- Sales ---
  { id: "t-sl-1", role: "sales", stage: "technical",
    text: "תאר/י עסקה גדולה שסגרת. מה היה האתגר?" },

  // --- Customer Success ---
  { id: "t-cs-1", role: "cs", stage: "technical",
    text: "ספר/י על לקוח שעמד לעזוב והצלחת לשמור עליו." },

  // --- HR ---
  { id: "t-hr-1", role: "hr", stage: "technical",
    text: "איך את/ה ניגש/ת לבניית תוכנית onboarding לעובד חדש?" },

  // --- Manager round (cross-role) ---
  { id: "m1", role: "*", stage: "manager",
    text: "איך את/ה רואה את התפקיד הזה משתלב במסלול הקריירה שלך?" },
  { id: "m2", role: "*", stage: "manager",
    text: "תאר/י את סגנון הניהול המועדף עליך." },
  { id: "m3", role: "*", stage: "manager",
    text: "מה אתה רוצה לדעת על החברה ועל הצוות?" },

  // --- Final round ---
  { id: "f1", role: "*", stage: "final",
    text: "יש לך שאלות לפני שאתה מקבל החלטה?" },
  { id: "f2", role: "*", stage: "final",
    text: "מה יכול לגרום לך לבחור בהצעה אחרת על פנינו?" },
];

export default function InterviewQuestionsBank() {
  const [role, setRole] = useState<Role>("backend");
  const [stage, setStage] = useState<Stage>("screening");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return QUESTIONS.filter(item => {
      if (item.stage !== stage) return false;
      if (item.role !== "*" && item.role !== role) return false;
      if (q && !item.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [role, stage, search]);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyAll = () => {
    const all = filtered.map((q, i) => `${i + 1}. ${q.text}`).join("\n");
    copy(all, "ALL");
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <BookOpen size={24} />
        </div>
        <div>
          <h3 className="text-xl font-black text-[#002649]">בנק שאלות לראיונות</h3>
          <p className="text-sm text-slate-500">בחר/י תפקיד ושלב — שאלות מותאמות יוצגו אוטומטית.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">תפקיד</label>
          <select value={role} onChange={e => setRole(e.target.value as Role)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#002649] focus:outline-none focus:border-[#EF6B00]">
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">שלב הראיון</label>
          <select value={stage} onChange={e => setStage(e.target.value as Stage)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#002649] focus:outline-none focus:border-[#EF6B00]">
            {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">חיפוש בתוך השאלות</label>
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="טיפ: 'דד-ליין', 'idempotent'..."
              className="w-full pr-8 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#EF6B00]" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="text-sm text-slate-500">
          נמצאו <span className="font-black text-[#002649]">{filtered.length}</span> שאלות
        </div>
        <button onClick={copyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-[#002649] transition-colors">
          <Copy size={12}/>
          {copied === "ALL" ? "הועתק!" : "העתק הכל"}
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-8">אין שאלות במצב הזה. נסה/י תפקיד או שלב אחר.</div>
        )}
        {filtered.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black text-slate-400">#{i + 1}</span>
                  {q.role === "*" && <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">כללי</span>}
                </div>
                <p className="text-sm font-medium text-[#002649] leading-relaxed">{q.text}</p>
                {q.followups && q.followups.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-4 list-disc text-xs text-slate-500">
                    {q.followups.map((f, j) => <li key={j}>{f}</li>)}
                  </ul>
                )}
              </div>
              <button onClick={() => copy(q.text, q.id)}
                className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#002649] transition-colors"
                title="העתק">
                <Copy size={14} />
              </button>
            </div>
            {copied === q.id && (
              <div className="mt-2 text-[10px] text-emerald-600 font-bold">הועתק ללוח</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
