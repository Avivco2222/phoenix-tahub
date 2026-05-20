"use client";

/**
 * RecruiterPerformanceCoach — Personal weekly KPI scorecard.
 *
 * Pulls /api/admin/inbox-analytics (already returns per-recruiter aggregates)
 * and renders a personal scorecard: hires this month, avg time-to-fill, open
 * applications, ghosting rate. Adds 3 coaching suggestions based on rules.
 */

import React, { useEffect, useState } from "react";
import { Trophy, TrendingUp, AlertCircle, Target, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

interface PersonalKPIs {
  hires_month: number;
  open_applications: number;
  avg_days_open: number;
  ghosting_rate: number;
}

interface Suggestion { icon: React.ReactNode; title: string; detail: string; accent: string }

export default function RecruiterPerformanceCoach() {
  const [kpis, setKpis] = useState<PersonalKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [recruiter, setRecruiter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      // Pull our identity + global stats. The dashboard already exposes
      // a /stats endpoint with hired/open counts and avg_days_open.
      const apiBase = getApiBaseUrl();
      const [meRes, statsRes, intelRes] = await Promise.all([
        fetch(`${apiBase}/api/auth/me`, { credentials: "include" }),
        fetch(`${apiBase}/stats`, { credentials: "include" }),
        fetch(`${apiBase}/intelligence`, { credentials: "include" }),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        setRecruiter(me?.name ?? me?.email ?? "");
      }
      const stats = statsRes.ok ? await statsRes.json() : {};
      const intel = intelRes.ok ? await intelRes.json() : {};
      setKpis({
        hires_month: Number(stats?.hired_this_month ?? 0),
        open_applications: Number(stats?.active_processes ?? 0),
        avg_days_open: Number(stats?.avg_days_open ?? 0),
        ghosting_rate: Array.isArray(intel?.ghosting_risks) ? intel.ghosting_risks.length : 0,
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const suggestions: Suggestion[] = [];
  if (kpis) {
    if (kpis.avg_days_open > 45) {
      suggestions.push({
        icon: <AlertCircle size={16}/>, accent: "#EF4444",
        title: "ימי פתיחה ממוצעים גבוהים",
        detail: `הממוצע שלך הוא ${kpis.avg_days_open} ימים. נסה/י לתעדף 3 משרות שתקועות הכי הרבה זמן השבוע.`,
      });
    }
    if (kpis.ghosting_rate > 5) {
      suggestions.push({
        icon: <AlertCircle size={16}/>, accent: "#F59E0B",
        title: "מועמדים בסיכון ghosting",
        detail: `${kpis.ghosting_rate} מועמדים לא תקשרו מעל שבוע. שלח/י follow-up מותאם אישית.`,
      });
    }
    if (kpis.hires_month >= 3) {
      suggestions.push({
        icon: <Trophy size={16}/>, accent: "#10B981",
        title: "ביצועי קליטה מצוינים החודש 🎉",
        detail: `${kpis.hires_month} קליטות. שתף/י ב-Slack של ה-team את ה-source mix שעבד.`,
      });
    }
    if (kpis.open_applications > 30) {
      suggestions.push({
        icon: <Target size={16}/>, accent: "#3B82F6",
        title: "Pipeline מלא — תעדוף נדרש",
        detail: `${kpis.open_applications} מועמדים פעילים. מומלץ לסגור 10 שלא יקודמו ולשחרר זמן.`,
      });
    }
  }
  if (suggestions.length === 0 && kpis) {
    suggestions.push({
      icon: <TrendingUp size={16}/>, accent: "#3B82F6",
      title: "ביצוע יציב — שמור על הקצב",
      detail: "המדדים שלך נמצאים בטווח הנורמלי. המשך/י באותו ריתמוס ושים/י לב להתפתחות לאורך זמן.",
    });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <Trophy size={24}/>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#002649]">המאמן/ת הביצועי/ת</h3>
            <p className="text-sm text-slate-500">{recruiter ? `שלום ${recruiter}, ` : ""}הנה הסיכום השבועי שלך.</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-[#002649]">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""}/> רענן
        </button>
      </div>

      {loading && !kpis ? (
        <div className="text-center py-12 text-slate-400">טוען נתונים...</div>
      ) : !kpis ? (
        <div className="text-center py-12 text-slate-400">לא ניתן לטעון KPIs</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="קליטות החודש" value={kpis.hires_month} accent="#10B981"/>
            <KpiCard label="תהליכים פעילים" value={kpis.open_applications} accent="#3B82F6"/>
            <KpiCard label="ימי פתיחה ממוצע" value={kpis.avg_days_open} accent="#F59E0B" suffix=" ימים"/>
            <KpiCard label="בסיכון ghosting" value={kpis.ghosting_rate} accent="#EF4444"/>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-black text-[#002649]">המלצות לשבוע הבא</h4>
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                     style={{ background: `${s.accent}15`, color: s.accent }}>
                  {s.icon}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-[#002649]">{s.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-3">
            * המדדים מבוססים על שאילתות גלובליות; בגרסה הבאה יסוננו לפי המגייס/ת הספציפי/ת.
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent, suffix = "" }: { label: string; value: number; accent: string; suffix?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="text-2xl font-black mt-1" style={{ color: accent }}>{value}{suffix}</div>
    </div>
  );
}
