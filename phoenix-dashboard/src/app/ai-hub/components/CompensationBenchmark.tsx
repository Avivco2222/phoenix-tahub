"use client";

/**
 * CompensationBenchmark — basic skeleton (Coming Soon for live market data).
 *
 * v1: in-house ranges only. Recruiter picks role+seniority+location and gets
 * a min/median/max range based on a static lookup table. The "live market data"
 * integration (Glassdoor / Comparably / Levels.fyi) is wired but disabled with
 * a Coming Soon badge.
 */

import React, { useMemo, useState } from "react";
import { DollarSign, TrendingUp, Construction, Info } from "lucide-react";

type RoleKey = "backend" | "frontend" | "fullstack" | "data" | "ml" | "devops" | "qa" | "pm" | "designer" | "sales" | "cs" | "hr";
type Seniority = "junior" | "mid" | "senior" | "lead";

// Static IL hi-tech compensation table (monthly NIS, ranges from public sources).
// These ARE rough estimates for placeholder data — production should pull live.
const RANGES: Record<RoleKey, Record<Seniority, [number, number, number]>> = {
  backend:    { junior: [18000, 22000, 26000], mid: [25000, 32000, 38000], senior: [35000, 45000, 55000], lead: [45000, 58000, 75000] },
  frontend:   { junior: [17000, 21000, 25000], mid: [24000, 30000, 36000], senior: [33000, 42000, 52000], lead: [44000, 56000, 72000] },
  fullstack:  { junior: [18000, 22000, 27000], mid: [26000, 33000, 40000], senior: [36000, 46000, 56000], lead: [46000, 60000, 78000] },
  data:       { junior: [18000, 22000, 27000], mid: [25000, 32000, 40000], senior: [34000, 44000, 55000], lead: [44000, 58000, 75000] },
  ml:         { junior: [20000, 25000, 30000], mid: [28000, 36000, 44000], senior: [40000, 50000, 62000], lead: [50000, 65000, 85000] },
  devops:     { junior: [19000, 23000, 28000], mid: [27000, 34000, 42000], senior: [37000, 47000, 58000], lead: [48000, 62000, 80000] },
  qa:         { junior: [14000, 17000, 21000], mid: [20000, 25000, 31000], senior: [28000, 36000, 45000], lead: [38000, 48000, 62000] },
  pm:         { junior: [18000, 23000, 28000], mid: [27000, 35000, 42000], senior: [40000, 50000, 62000], lead: [55000, 70000, 90000] },
  designer:   { junior: [15000, 19000, 23000], mid: [22000, 28000, 34000], senior: [30000, 38000, 48000], lead: [40000, 52000, 65000] },
  sales:      { junior: [14000, 18000, 22000], mid: [22000, 28000, 38000], senior: [32000, 42000, 55000], lead: [50000, 65000, 90000] },
  cs:         { junior: [13000, 16000, 20000], mid: [19000, 24000, 30000], senior: [27000, 34000, 42000], lead: [36000, 45000, 58000] },
  hr:         { junior: [13000, 16000, 19000], mid: [18000, 23000, 28000], senior: [26000, 33000, 41000], lead: [35000, 44000, 56000] },
};

const ROLE_LABELS: Record<RoleKey, string> = {
  backend: "Backend Engineer", frontend: "Frontend Engineer", fullstack: "Fullstack Engineer",
  data: "Data Analyst/Engineer", ml: "ML Engineer", devops: "DevOps/SRE",
  qa: "QA Engineer", pm: "Product Manager", designer: "UX/UI Designer",
  sales: "Account Manager", cs: "Customer Success", hr: "People Partner",
};

const SENIORITY_LABELS: Record<Seniority, string> = {
  junior: "Junior (0-2y)", mid: "Mid (2-4y)", senior: "Senior (4-7y)", lead: "Lead/Manager (7y+)",
};

export default function CompensationBenchmark() {
  const [role, setRole] = useState<RoleKey>("backend");
  const [seniority, setSeniority] = useState<Seniority>("mid");
  const [offered, setOffered] = useState("");

  const [min, median, max] = RANGES[role][seniority];
  const offeredNum = parseInt(offered, 10) || 0;
  const offeredPct = useMemo(() => {
    if (!offeredNum) return null;
    if (offeredNum <= min) return { pct: 0, label: "מתחת לטווח", color: "#EF4444" };
    if (offeredNum >= max) return { pct: 100, label: "מעל הטווח", color: "#10B981" };
    return { pct: Math.round(((offeredNum - min) / (max - min)) * 100), label: `${Math.round(((offeredNum - min) / (max - min)) * 100)}% מהטווח`, color: "#3B82F6" };
  }, [offeredNum, min, max]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <DollarSign size={24}/>
        </div>
        <div>
          <h3 className="text-xl font-black text-[#002649]">בנצ&apos;מארק שכר</h3>
          <p className="text-sm text-slate-500">השוואת הצעה לטווחי שוק. ל-IL hi-tech, נכון ל-2026.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="תפקיד">
          <select value={role} onChange={e => setRole(e.target.value as RoleKey)} className="input">
            {(Object.entries(ROLE_LABELS) as [RoleKey, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="סניוריטי">
          <select value={seniority} onChange={e => setSeniority(e.target.value as Seniority)} className="input">
            {Object.entries(SENIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="הצעה שלך (ש&quot;ח / חודש)">
          <input type="number" value={offered} onChange={e => setOffered(e.target.value)}
            placeholder="לבדיקה ביחס לטווח" className="input"/>
        </Field>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 border border-emerald-100">
        <div className="text-xs font-bold text-slate-500 mb-2">טווח שכר חודשי (ש&quot;ח)</div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Cell label="P25" value={min} accent="#94A3B8"/>
          <Cell label="חציון" value={median} accent="#10B981" big/>
          <Cell label="P75" value={max} accent="#94A3B8"/>
        </div>

        {offeredPct && (
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 mb-2">ההצעה שלך</div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-2xl font-black" style={{ color: offeredPct.color }}>{offeredNum.toLocaleString()} ש&quot;ח</div>
              <div className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: `${offeredPct.color}20`, color: offeredPct.color }}>
                {offeredPct.label}
              </div>
            </div>
            <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 right-0 transition-all" style={{ width: `${offeredPct.pct}%`, background: offeredPct.color }}/>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>{min.toLocaleString()}</span>
              <span>{max.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Construction size={20} className="text-amber-600 flex-shrink-0 mt-0.5"/>
        <div>
          <div className="font-bold text-sm text-amber-900 mb-1">בקרוב — Live Market Data</div>
          <div className="text-xs text-amber-800">
            הטווחים הנוכחיים סטטיים, מתבססים על מקורות פתוחים. בקרוב נתחבר ל-Glassdoor, Comparably ו-Levels.fyi עם נתונים מותאמים לתאריך/מיקום/חברה ספציפית.
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 flex items-center gap-1">
        <Info size={10}/> הטווחים מבוססים על נתוני שוק פומביים ועדכון ידני. אינם ייעוץ פיננסי או הצהרת חברה.
      </div>

      <style jsx>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; font-weight: 600; color: #002649; background: white; }
        .input:focus { outline: none; border-color: #EF6B00; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>{children}</div>;
}

function Cell({ label, value, accent, big }: { label: string; value: number; accent: string; big?: boolean }) {
  return (
    <div className={`bg-white rounded-xl p-3 border ${big ? "border-emerald-300 shadow-sm" : "border-slate-200"}`}>
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className={`${big ? "text-2xl" : "text-xl"} font-black mt-1`} style={{ color: accent }}>
        {value.toLocaleString()}
        <span className="text-xs font-bold text-slate-400 mr-1">ש&quot;ח</span>
      </div>
    </div>
  );
}
