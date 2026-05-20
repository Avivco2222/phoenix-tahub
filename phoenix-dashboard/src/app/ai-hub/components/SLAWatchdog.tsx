"use client";

/**
 * SLAWatchdog — flags candidates / jobs / offers stuck longer than threshold.
 *
 * Reads /api/sla/alerts. The "Scan + Notify" action calls /api/sla/scan which
 * creates notifications for the responsible recruiter and all admins (with
 * 24-hour dedup). Recruiter sees the per-row recruiter name; admin sees all.
 */

import React, { useEffect, useState } from "react";
import { ShieldAlert, Clock, Briefcase, AlertCircle, RefreshCw, Bell, Send } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

interface CandidateBreach {
  candidate_id: string; candidate_name: string;
  job_id: string; job_title: string; recruiter: string;
  status: string; days_in_process: number; stage_code: string;
}
interface JobBreach {
  job_id: string; job_title: string; department: string;
  hiring_manager: string; opened_at: string;
}
interface OfferBreach {
  candidate_id: string; candidate_name: string;
  job_id: string; job_title: string; recruiter: string; days_in_process: number;
}
interface AlertsResponse {
  thresholds: { stale_candidate_days: number; stale_offer_days: number; open_job_days: number };
  candidates: CandidateBreach[];
  jobs: JobBreach[];
  offers: OfferBreach[];
  total_breaches: number;
}

export default function SLAWatchdog() {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastNotif, setLastNotif] = useState<number | null>(null);
  const [thresholds, setThresholds] = useState({ stale_candidate_days: 14, stale_offer_days: 7, open_job_days: 60 });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        stale_candidate_days: String(thresholds.stale_candidate_days),
        stale_offer_days: String(thresholds.stale_offer_days),
        open_job_days: String(thresholds.open_job_days),
      });
      const res = await fetch(`${getApiBaseUrl()}/api/sla/alerts?${params}`, { credentials: "include" });
      if (res.ok) setAlerts(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const scan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/sla/scan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(thresholds),
      });
      if (res.ok) {
        const data = await res.json();
        setLastNotif(data.notifications_emitted ?? 0);
        setAlerts(data);
      }
    } finally {
      setScanning(false);
      setTimeout(() => setLastNotif(null), 5000);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert size={24}/>
          </div>
          <div>
            <h3 className="text-xl font-black text-[#002649]">SLA Watchdog</h3>
            <p className="text-sm text-slate-500">איתור תהליכים שתקעו מעבר לסף, ושליחת התראות אוטומטית.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-[#002649]">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""}/> רענן
          </button>
          <button onClick={scan} disabled={scanning} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#EF6B00] text-white hover:bg-[#d65a00]">
            <Send size={12} className={scanning ? "animate-pulse" : ""}/> סרוק + שלח התראות
          </button>
        </div>
      </div>

      {lastNotif !== null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-sm font-bold text-emerald-700">
          <Bell size={16}/> נשלחו {lastNotif} התראות חדשות (24h dedup פעיל)
        </div>
      )}

      {/* Threshold controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-bold text-slate-500 mb-2">ספי SLA (ימים)</div>
        <div className="grid grid-cols-3 gap-3">
          <Threshold label="מועמד תקוע בשלב" value={thresholds.stale_candidate_days}
            onChange={v => setThresholds(p => ({ ...p, stale_candidate_days: v }))}/>
          <Threshold label="הצעה תלויה" value={thresholds.stale_offer_days}
            onChange={v => setThresholds(p => ({ ...p, stale_offer_days: v }))}/>
          <Threshold label="משרה פתוחה" value={thresholds.open_job_days}
            onChange={v => setThresholds(p => ({ ...p, open_job_days: v }))}/>
        </div>
        <button onClick={load} className="mt-3 text-xs font-bold text-[#EF6B00] hover:underline">החל ספים מעודכנים</button>
      </div>

      {/* Summary */}
      {alerts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard label="מועמדים תקועים" value={alerts.candidates.length} accent="#F59E0B" icon={<Clock size={20}/>}/>
          <SummaryCard label="הצעות תלויות" value={alerts.offers.length} accent="#EF4444" icon={<AlertCircle size={20}/>}/>
          <SummaryCard label="משרות פתוחות" value={alerts.jobs.length} accent="#3B82F6" icon={<Briefcase size={20}/>}/>
        </div>
      )}

      {/* Tables */}
      {alerts && (
        <div className="space-y-4">
          {alerts.candidates.length > 0 && (
            <Section title={`מועמדים תקועים מעל ${alerts.thresholds.stale_candidate_days} ימים`} count={alerts.candidates.length} accent="#F59E0B">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>
                    <th className="text-right p-2">מועמד</th>
                    <th className="text-right p-2">משרה</th>
                    <th className="text-right p-2">שלב</th>
                    <th className="text-right p-2">מגייס/ת</th>
                    <th className="text-center p-2">ימים</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.candidates.map(c => (
                    <tr key={c.candidate_id + c.job_id} className="border-t border-slate-100">
                      <td className="p-2 font-bold text-[#002649]">{c.candidate_name}</td>
                      <td className="p-2 text-slate-600">{c.job_title}</td>
                      <td className="p-2"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{c.stage_code || c.status}</span></td>
                      <td className="p-2 text-slate-500">{c.recruiter || "—"}</td>
                      <td className="p-2 text-center font-black text-amber-600">{c.days_in_process}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {alerts.offers.length > 0 && (
            <Section title={`הצעות תלויות מעל ${alerts.thresholds.stale_offer_days} ימים`} count={alerts.offers.length} accent="#EF4444">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>
                    <th className="text-right p-2">מועמד</th>
                    <th className="text-right p-2">משרה</th>
                    <th className="text-right p-2">מגייס/ת</th>
                    <th className="text-center p-2">ימים</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.offers.map(o => (
                    <tr key={o.candidate_id + o.job_id} className="border-t border-slate-100">
                      <td className="p-2 font-bold text-[#002649]">{o.candidate_name}</td>
                      <td className="p-2 text-slate-600">{o.job_title}</td>
                      <td className="p-2 text-slate-500">{o.recruiter || "—"}</td>
                      <td className="p-2 text-center font-black text-rose-600">{o.days_in_process}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {alerts.jobs.length > 0 && (
            <Section title={`משרות פתוחות מעל ${alerts.thresholds.open_job_days} ימים`} count={alerts.jobs.length} accent="#3B82F6">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>
                    <th className="text-right p-2">משרה</th>
                    <th className="text-right p-2">חטיבה</th>
                    <th className="text-right p-2">מנהל מגייס</th>
                    <th className="text-right p-2">פתיחה</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.jobs.map(j => (
                    <tr key={j.job_id} className="border-t border-slate-100">
                      <td className="p-2 font-bold text-[#002649]">{j.job_title}</td>
                      <td className="p-2 text-slate-600">{j.department}</td>
                      <td className="p-2 text-slate-500">{j.hiring_manager || "—"}</td>
                      <td className="p-2 text-slate-500 text-xs">{j.opened_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {alerts.total_breaches === 0 && !loading && (
            <div className="text-center py-12 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <ShieldAlert size={36} className="mx-auto text-emerald-600 mb-3"/>
              <div className="font-black text-emerald-900">אין הפרות SLA כרגע — מצוין!</div>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-3">
        ההתראות נשלחות גם למגייס/ת האחראי/ת וגם לכל ה-Admins. 24h dedup פעיל — קריאה חוזרת לא תשלח התראה כפולה.
      </div>
    </div>
  );
}

function Threshold({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 block mb-1">{label}</label>
      <input type="number" min={1} value={value} onChange={e => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
        className="w-full text-sm font-bold text-[#002649] border border-slate-200 rounded-lg px-2 py-1.5"/>
    </div>
  );
}

function SummaryCard({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
           style={{ background: `${accent}15`, color: accent }}>{icon}</div>
      <div>
        <div className="text-xs font-bold text-slate-500">{label}</div>
        <div className="text-2xl font-black" style={{ color: accent }}>{value}</div>
      </div>
    </div>
  );
}

function Section({ title, count, accent, children }: { title: string; count: number; accent: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between" style={{ borderRightColor: accent, borderRightWidth: 4 }}>
        <div className="font-black text-sm text-[#002649]">{title}</div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${accent}15`, color: accent }}>{count}</span>
      </div>
      {children}
    </div>
  );
}
