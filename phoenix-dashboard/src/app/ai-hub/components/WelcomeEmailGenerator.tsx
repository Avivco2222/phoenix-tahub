"use client";

/**
 * WelcomeEmailGenerator — Tier-1 tool.
 *
 * Generates a personalized Hebrew welcome email for a new hire from a small
 * form (name, role, manager, start_date, department). Template-driven for
 * the first iteration; the same component can later wire to /api/ai/welcome-email
 * for richer LLM-personalized output.
 */

import React, { useMemo, useState } from "react";
import { Mail, Copy, Send, Calendar, User as UserIcon } from "lucide-react";

interface FormState {
  candidateName: string;
  jobTitle: string;
  department: string;
  managerName: string;
  startDate: string;     // YYYY-MM-DD
  firstDayLocation: string;
  firstDayTime: string;
  companyName: string;
}

const DEFAULT_FORM: FormState = {
  candidateName: "",
  jobTitle: "",
  department: "",
  managerName: "",
  startDate: "",
  firstDayLocation: "המשרד הראשי, רחוב הברזל 38, תל אביב",
  firstDayTime: "09:00",
  companyName: "הפניקס",
};

const formatHebrewDate = (iso: string): string => {
  if (!iso) return "[תאריך התחלה]";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
};

const buildEmail = (f: FormState) => {
  const name = f.candidateName.trim() || "[שם המועמד]";
  const role = f.jobTitle.trim() || "[תפקיד]";
  const mgr = f.managerName.trim() || "[שם המנהל]";
  const dept = f.department.trim() || "[חטיבה]";
  const dateLine = formatHebrewDate(f.startDate);

  const subject = `ברוכים הבאים ל${f.companyName} 🎉 — נתראה ב-${dateLine}`;

  const body = `שלום ${name},

אנחנו נרגשים לקבל אותך כחלק מצוות ${dept} ב${f.companyName} כ${role}.

📅 **יום ראשון בעבודה:** ${dateLine}, בשעה ${f.firstDayTime}
📍 **מיקום:** ${f.firstDayLocation}
👤 **המנהל/ת הישיר/ה שלך:** ${mgr} — יחכה לך בכניסה.

מה לצפות ביום הראשון?
• פגישת ברוכים הבאים עם ${mgr} (45 דקות)
• סדנת התמצאות בארגון ובמערכות (HR, 2 שעות)
• ארוחת צהריים משותפת עם הצוות
• פגישת היכרות 1:1 עם חברי הצוות

מה להביא?
• תעודת זהות לרישום HR
• פרטי חשבון בנק (לתלוש משכורת)
• מסמכי השכלה (תעודות אחרונות) — אם רלוונטי

🔗 **שאלות לפני יום ראשון?** תוכל/י לכתוב ישירות ל-${mgr} או ל-People Partner שיצור איתך קשר בקרוב.

נשמח לראות אותך!

צוות ${f.companyName}
`;

  return { subject, body };
};

export default function WelcomeEmailGenerator() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [copied, setCopied] = useState<"subject" | "body" | "all" | null>(null);

  const { subject, body } = useMemo(() => buildEmail(form), [form]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const copy = (text: string, key: "subject" | "body" | "all") => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const openInMail = () => {
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* FORM */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Mail size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#002649]">מחולל מייל ברוכים הבאים</h3>
            <p className="text-sm text-slate-500">מלא/י את הפרטים — מייל בעברית יתעדכן מיידית.</p>
          </div>
        </div>

        <Field label="שם המועמד/ת" icon={<UserIcon size={14}/>}>
          <input value={form.candidateName} onChange={e => set("candidateName", e.target.value)}
            placeholder="למשל: דנה כהן" className="input"/>
        </Field>
        <Field label="תפקיד">
          <input value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)}
            placeholder="Backend Engineer" className="input"/>
        </Field>
        <Field label="חטיבה">
          <input value={form.department} onChange={e => set("department", e.target.value)}
            placeholder="R&D" className="input"/>
        </Field>
        <Field label="שם המנהל/ת הישיר/ה">
          <input value={form.managerName} onChange={e => set("managerName", e.target.value)}
            placeholder="דוד לוי" className="input"/>
        </Field>
        <Field label="תאריך התחלה" icon={<Calendar size={14}/>}>
          <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
            className="input"/>
        </Field>
        <Field label="שעת התחלה ביום הראשון">
          <input type="time" value={form.firstDayTime} onChange={e => set("firstDayTime", e.target.value)}
            className="input"/>
        </Field>
        <Field label="מיקום יום ראשון">
          <input value={form.firstDayLocation} onChange={e => set("firstDayLocation", e.target.value)}
            className="input"/>
        </Field>
      </div>

      {/* PREVIEW */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3 sticky top-4 self-start">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-500">תצוגה מקדימה</div>
          <div className="flex gap-2">
            <button onClick={() => copy(subject + "\n\n" + body, "all")}
              className="text-xs font-bold px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-[#002649] flex items-center gap-1">
              <Copy size={12}/>
              {copied === "all" ? "הועתק" : "העתק הכל"}
            </button>
            <button onClick={openInMail}
              className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#EF6B00] text-white hover:bg-[#d65a00] flex items-center gap-1">
              <Send size={12}/> פתח במייל
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">נושא</div>
            <div className="flex items-start justify-between gap-2">
              <div className="font-black text-[#002649] flex-1">{subject}</div>
              <button onClick={() => copy(subject, "subject")} className="text-slate-400 hover:text-[#002649] p-1">
                <Copy size={12}/>
              </button>
            </div>
            {copied === "subject" && <div className="text-[10px] text-emerald-600 font-bold mt-1">הועתק</div>}
          </div>
          <div className="border-t border-slate-100 pt-3">
            <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">גוף המייל</div>
            <pre className="whitespace-pre-wrap text-sm text-[#002649] font-sans leading-relaxed">{body}</pre>
            <button onClick={() => copy(body, "body")}
              className="mt-2 text-xs font-bold text-[#EF6B00] hover:underline flex items-center gap-1">
              <Copy size={12}/>
              {copied === "body" ? "הועתק" : "העתק גוף המייל"}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-slate-400">
          הטמפלייט הזה גנרי ויציב. בגרסה הבאה (כשנפעיל את ה-LLM) הוא יתאים אישית את הטון לפי תרבות הצוות.
        </p>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #002649;
          background: white;
        }
        .input:focus {
          outline: none;
          border-color: #EF6B00;
        }
      `}</style>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
        {icon} {label}
      </label>
      {children}
    </div>
  );
}
