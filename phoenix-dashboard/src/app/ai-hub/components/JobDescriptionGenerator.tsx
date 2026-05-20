"use client";

/**
 * JobDescriptionGenerator — Tier-1 tool (full feature).
 *
 * Recruiter picks role + seniority + department + perks → template-driven
 * Hebrew JD with inclusive language, structured sections, and copy/export.
 *
 * No LLM dependency for v1. The template engine combines role-specific
 * responsibility/requirement bullets from a static knowledge base with the
 * recruiter-provided overrides.
 */

import React, { useMemo, useState } from "react";
import { Briefcase, Copy, Download, Sparkles } from "lucide-react";

type Seniority = "junior" | "mid" | "senior" | "lead" | "manager";
type RoleKey =
  | "backend" | "frontend" | "fullstack" | "data" | "ml" | "devops"
  | "qa" | "pm" | "designer" | "sales" | "cs" | "hr" | "marketing" | "finance";

const ROLES: Record<RoleKey, {
  hebrew: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
}> = {
  backend: {
    hebrew: "Backend Engineer",
    responsibilities: [
      "פיתוח ותחזוקה של שירותי Backend ב-Python/Node.js/Java",
      "תכנון Endpoints ב-REST/gRPC ותכנון מודלים נתונים ב-DB",
      "כתיבת בדיקות יחידה ובדיקות אינטגרציה",
      "השתתפות פעילה ב-code review וב-design discussions",
      "אופטימיזציה של ביצועים וניתוח bottlenecks",
    ],
    requirements: [
      "ניסיון של 3+ שנים בפיתוח Backend",
      "שליטה ב-Python / Node.js / Go (לפחות אחד)",
      "ניסיון ב-SQL וב-NoSQL DBs",
      "הכרות עם Docker ו-CI/CD pipelines",
      "אנגלית טכנית טובה",
    ],
    niceToHave: ["ניסיון ב-AWS/GCP/Azure", "ניסיון ב-Kubernetes", "הכרות עם Event-Driven architectures (Kafka)"],
  },
  frontend: {
    hebrew: "Frontend Engineer",
    responsibilities: [
      "פיתוח ממשקי משתמש ב-React / Next.js / Vue",
      "אופטימיזציה של חוויית משתמש וביצועים",
      "שיתוף פעולה הדוק עם UX/UI Designers",
      "כתיבת קוד מודולרי וניתן לתחזוקה",
      "השתתפות ב-code reviews ושיפור הסטנדרטים",
    ],
    requirements: [
      "ניסיון של 3+ שנים בפיתוח Frontend מודרני",
      "שליטה מעמיקה ב-React/TypeScript",
      "ניסיון ב-CSS-in-JS / Tailwind / Styled Components",
      "הבנה של רספונסיביות ונגישות (a11y)",
      "ניסיון ב-state management (Redux/Zustand/Context)",
    ],
    niceToHave: ["ניסיון ב-Next.js App Router", "כתיבת בדיקות UI (Vitest/Playwright)", "ניסיון בעיצוב Design Systems"],
  },
  fullstack: {
    hebrew: "Fullstack Engineer",
    responsibilities: [
      "פיתוח end-to-end של פיצ'רים: Frontend, Backend ו-DB",
      "תכנון ארכיטקטורת מערכת לתכונות חדשות",
      "אחריות על ה-feature מאפיון ועד production",
      "code reviews וחניכה של מפתחים זוטרים",
    ],
    requirements: [
      "ניסיון של 4+ שנים בפיתוח Fullstack",
      "שליטה ב-React/TypeScript ובשפת Backend (Python/Node.js)",
      "ניסיון בבניית REST APIs ועיצוב סכמות DB",
      "ניסיון ב-cloud ו-CI/CD",
    ],
    niceToHave: ["ניסיון בארכיטקטורה מבוזרת (microservices)", "ניסיון ב-Real-time systems (WebSockets)"],
  },
  data: {
    hebrew: "Data Analyst / Data Engineer",
    responsibilities: [
      "בניית pipelines ETL/ELT לאיסוף וניקוי נתונים",
      "תכנון Data Warehouse models (star schema, snowflake)",
      "כתיבת queries מורכבים ב-SQL לתמיכה ב-business decisions",
      "פיתוח דשבורדים והגדרת KPIs",
    ],
    requirements: [
      "ניסיון של 2+ שנים ב-Data Engineering / Analytics",
      "שליטה ב-SQL מתקדם",
      "ניסיון ב-Python (pandas, numpy)",
      "הכרות עם BI tools (Tableau/Looker/PowerBI)",
    ],
    niceToHave: ["ניסיון ב-dbt", "ניסיון ב-Airflow", "ניסיון ב-Snowflake/BigQuery"],
  },
  ml: {
    hebrew: "ML Engineer",
    responsibilities: [
      "פיתוח ופריסה של מודלי ML לפרודקשן",
      "בניית data pipelines למשימות training",
      "מעקב ושיפור ביצועי מודלים",
      "שיתוף פעולה עם Product וניהול לבחירת use-cases",
    ],
    requirements: [
      "ניסיון של 3+ שנים ב-ML/Data Science",
      "שליטה ב-Python (sklearn, PyTorch / TensorFlow)",
      "ניסיון בפריסת מודלים (MLOps)",
      "הבנה סטטיסטית/מתמטית חזקה",
    ],
    niceToHave: ["ניסיון ב-LLMs / NLP", "ניסיון ב-MLflow / Kubeflow"],
  },
  devops: {
    hebrew: "DevOps / SRE",
    responsibilities: [
      "ניהול תשתיות cloud (AWS/GCP/Azure)",
      "תכנון ותחזוקת CI/CD pipelines",
      "ניטור ו-incident response",
      "אוטומציה של תהליכים ידניים (IaC)",
    ],
    requirements: [
      "ניסיון של 3+ שנים ב-DevOps/SRE",
      "ניסיון ב-Kubernetes ו-Docker",
      "ניסיון ב-Terraform/CloudFormation",
      "scripting ב-Bash/Python",
    ],
    niceToHave: ["ניסיון ב-monitoring (Datadog/Grafana/Prometheus)", "אבטחת מידע / SOC2"],
  },
  qa: {
    hebrew: "QA Engineer",
    responsibilities: [
      "תכנון וביצוע test plans למוצרים שונים",
      "אוטומציה של בדיקות (UI/API)",
      "שיתוף פעולה הדוק עם developers",
      "ניהול bug tracking ושיפור תהליכי איכות",
    ],
    requirements: [
      "ניסיון של 2+ שנים ב-QA",
      "ניסיון בכתיבת אוטומציה (Playwright/Cypress/Selenium)",
      "הבנה של Agile/Scrum",
    ],
    niceToHave: ["ניסיון ב-API testing (Postman/REST Assured)", "ניסיון ב-load testing"],
  },
  pm: {
    hebrew: "Product Manager",
    responsibilities: [
      "הגדרת חזון ו-roadmap למוצר",
      "עבודה הדוקה עם Engineering, Design ו-Sales",
      "ניתוח KPIs והובלת decision making מבוסס דאטה",
      "כתיבת PRDs ותעדוף backlog",
    ],
    requirements: [
      "ניסיון של 3+ שנים בניהול מוצר",
      "יכולות אנליטיות חזקות",
      "אנגלית גבוהה — כתב ודיבור",
      "ניסיון בעבודה עם UX/UI Designers",
    ],
    niceToHave: ["ניסיון ב-B2B SaaS", "רקע טכני (תואר במדמ\"ח / הנדסה)"],
  },
  designer: {
    hebrew: "UX/UI Designer",
    responsibilities: [
      "עיצוב חוויית משתמש וממשקים מודרניים",
      "ביצוע user research ובדיקות שמישות",
      "בניית Design System ו-style guides",
      "שיתוף פעולה הדוק עם Frontend Engineers",
    ],
    requirements: [
      "ניסיון של 3+ שנים בעיצוב Product",
      "שליטה ב-Figma / Sketch",
      "Portfolio שמדגים work ויזואלי ו-IxD",
      "ידע בעקרונות UX",
    ],
    niceToHave: ["ניסיון בעיצוב mobile-first", "הבנה ב-Frontend (CSS/HTML basics)"],
  },
  sales: {
    hebrew: "Account Manager / Sales",
    responsibilities: [
      "סגירת עסקאות עם לקוחות חדשים וקיימים",
      "ניהול pipeline ו-forecasting",
      "ניהול שיחות גילוי, demos, ו-negotiations",
      "שיתוף פעולה עם Marketing ו-Customer Success",
    ],
    requirements: [
      "ניסיון של 2+ שנים במכירות B2B",
      "track record מוכח של עמידה ב-quota",
      "אנגלית עסקית מעולה",
      "שליטה ב-CRM (Salesforce/HubSpot)",
    ],
    niceToHave: ["ניסיון במכירות SaaS", "ניסיון ב-MEDDIC / Challenger sales methodology"],
  },
  cs: {
    hebrew: "Customer Success Specialist",
    responsibilities: [
      "הצלחת לקוחות מ-onboarding עד renewal",
      "ניהול escalations וזיהוי risks",
      "הובלת QBRs ו-account reviews",
      "שיתוף feedback עם Product",
    ],
    requirements: [
      "ניסיון של 2+ שנים ב-Customer Success / Account Management",
      "כישורים בין-אישיים מעולים",
      "אנגלית מצוינת",
      "יכולת לפתור בעיות באופן עצמאי",
    ],
    niceToHave: ["ניסיון בחברת SaaS", "הכרות עם CS tools (Gainsight/ChurnZero)"],
  },
  hr: {
    hebrew: "People Partner / HRBP",
    responsibilities: [
      "ליווי מנהלים ועובדים בתהליכי people",
      "תכנון וביצוע יוזמות learning & development",
      "ניהול ביצועים ו-feedback culture",
      "תמיכה ב-employee engagement",
    ],
    requirements: [
      "ניסיון של 3+ שנים ב-HR Business Partner",
      "תואר ראשון רלוונטי",
      "כישורים בין-אישיים גבוהים",
      "ניסיון בעבודה בסביבת hi-tech",
    ],
    niceToHave: ["ניסיון ב-OD", "הכרות עם HRIS (Workday/BambooHR)"],
  },
  marketing: {
    hebrew: "Marketing Specialist",
    responsibilities: [
      "תכנון וביצוע קמפיינים marketing דיגיטליים",
      "ניהול content calendar וייצור תוכן",
      "מעקב KPIs (CAC, CTR, conversion)",
      "שיתוף פעולה עם Sales וב-RevOps",
    ],
    requirements: [
      "ניסיון של 2+ שנים ב-Marketing",
      "ניסיון ב-paid media (Google Ads/LinkedIn)",
      "כישורים אנליטיים",
      "אנגלית גבוהה",
    ],
    niceToHave: ["ניסיון ב-B2B SaaS", "ניסיון ב-marketing automation (HubSpot/Marketo)"],
  },
  finance: {
    hebrew: "Financial Analyst",
    responsibilities: [
      "תכנון תקציבי וניהול forecasts",
      "ניתוח דוחות פיננסיים והבעת insights",
      "הכנת presentations להנהלה",
      "שיתוף פעולה עם Accounting / FP&A",
    ],
    requirements: [
      "ניסיון של 2+ שנים ב-Financial Analysis",
      "תואר ראשון בחשבונאות/כלכלה/מינהל עסקים",
      "שליטה גבוהה ב-Excel",
      "אנגלית גבוהה",
    ],
    niceToHave: ["CPA / ACCA", "ניסיון ב-NetSuite / SAP", "ניסיון ב-SaaS metrics (ARR, MRR, churn)"],
  },
};

const SENIORITY_LABELS: Record<Seniority, string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Tech Lead",
  manager: "Manager",
};

const SENIORITY_MIN_YEARS: Record<Seniority, number> = {
  junior: 0, mid: 2, senior: 4, lead: 6, manager: 7,
};

interface FormState {
  role: RoleKey;
  seniority: Seniority;
  jobTitle: string;
  department: string;
  location: string;
  remote: "office" | "hybrid" | "remote";
  companyDescription: string;
  customPerks: string;
}

const DEFAULT_FORM: FormState = {
  role: "backend",
  seniority: "mid",
  jobTitle: "",
  department: "R&D",
  location: "תל אביב",
  remote: "hybrid",
  companyDescription: "הפניקס היא חברת הביטוח הוותיקה והגדולה בישראל, מובילה בשירותי ביטוח חיים, בריאות, פיננסים ופנסיה.",
  customPerks: "ביטוח בריאות פרטי, קרן השתלמות, ימי וולנטרי, שיגרת חדר כושר",
};

const buildJD = (f: FormState) => {
  const role = ROLES[f.role];
  const yearsReq = SENIORITY_MIN_YEARS[f.seniority];
  const title = f.jobTitle.trim() || `${SENIORITY_LABELS[f.seniority]} ${role.hebrew}`;

  const reqs = role.requirements.map(r =>
    r.replace(/(\d+)\+/, () => `${yearsReq}+`)
  );

  const remoteLabel = { office: "מהמשרד בלבד", hybrid: "היברידי (3 ימי משרד)", remote: "Remote מלא" }[f.remote];

  return `# ${title}
**${f.department} · ${f.location} · ${remoteLabel}**

## על החברה
${f.companyDescription}

## תיאור התפקיד
${role.responsibilities.map(r => `- ${r}`).join("\n")}

## דרישות חובה
${reqs.map(r => `- ${r}`).join("\n")}

## נחמד שיהיה (Nice to have)
${role.niceToHave.map(r => `- ${r}`).join("\n")}

## למה תרצה/י להצטרף אלינו
- ${f.customPerks.split(",").map(s => s.trim()).filter(Boolean).join("\n- ")}
- תרבות של למידה מתמדת
- צוות מקצועי, שיתופי וחם
- אפשרויות גידול והתפתחות אמיתיות

## להגשת מועמדות
[פרטי קשר / לינק להגשה]

---
*ב${f.department} ${f.companyDescription.split(".")[0]} אנו מאמינים בגיוון והכלה. הזדמנויות שוות לכל המועמדים/ות ללא הבדל מין, גיל, מוצא, נטייה מינית או יכולת.*
`;
};

export default function JobDescriptionGenerator() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [copied, setCopied] = useState(false);

  const jd = useMemo(() => buildJD(form), [form]);

  const copy = () => {
    void navigator.clipboard.writeText(jd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob(["﻿" + jd], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `JD_${form.role}_${form.seniority}.md`;
    a.click();
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Briefcase size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#002649]">מחולל תיאורי משרה</h3>
            <p className="text-sm text-slate-500">בחר/י תפקיד וסניוריטי — JD בעברית עם שפה inclusive יתעדכן.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="תפקיד">
            <select value={form.role} onChange={e => set("role", e.target.value as RoleKey)} className="input">
              {(Object.entries(ROLES) as [RoleKey, typeof ROLES[RoleKey]][]).map(([k, v]) =>
                <option key={k} value={k}>{v.hebrew}</option>)}
            </select>
          </Field>
          <Field label="סניוריטי">
            <select value={form.seniority} onChange={e => set("seniority", e.target.value as Seniority)} className="input">
              {Object.entries(SENIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <Field label="כותרת מותאמת (אופציונלי)">
          <input value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)}
            placeholder="ברירת מחדל מחושבת אוטומטית" className="input"/>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="חטיבה">
            <input value={form.department} onChange={e => set("department", e.target.value)} className="input"/>
          </Field>
          <Field label="מיקום">
            <input value={form.location} onChange={e => set("location", e.target.value)} className="input"/>
          </Field>
        </div>
        <Field label="מודל עבודה">
          <select value={form.remote} onChange={e => set("remote", e.target.value as FormState["remote"])} className="input">
            <option value="office">מהמשרד בלבד</option>
            <option value="hybrid">היברידי</option>
            <option value="remote">Remote מלא</option>
          </select>
        </Field>
        <Field label="תיאור החברה">
          <textarea value={form.companyDescription} onChange={e => set("companyDescription", e.target.value)} rows={3} className="input"/>
        </Field>
        <Field label="הטבות (מופרדות בפסיק)">
          <textarea value={form.customPerks} onChange={e => set("customPerks", e.target.value)} rows={2} className="input"/>
        </Field>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-slate-500 flex items-center gap-1"><Sparkles size={12}/> תצוגה מקדימה</div>
            <div className="flex gap-2">
              <button onClick={copy} className="text-xs font-bold px-2.5 py-1 rounded-md bg-white border border-slate-200 flex items-center gap-1">
                <Copy size={12}/> {copied ? "הועתק" : "העתק"}
              </button>
              <button onClick={download} className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#EF6B00] text-white flex items-center gap-1">
                <Download size={12}/> הורד .md
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-[#002649] font-sans leading-relaxed bg-white p-4 rounded-xl border border-slate-200 max-h-[600px] overflow-y-auto">{jd}</pre>
        </div>
      </div>

      <style jsx>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; font-weight: 600; color: #002649; background: white; }
        .input:focus { outline: none; border-color: #EF6B00; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}
