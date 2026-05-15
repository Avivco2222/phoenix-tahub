"use client";

/**
 * NotificationsTab — admin control center for in-app notifications.
 *
 * Three sections:
 *  1. Send a manual notification — target group OR specific users, with severity + link
 *  2. Notification history (last 100, across all users, filterable by category)
 *  3. Quick stats: count by category, read rate
 */

import React, { useEffect, useMemo, useState } from "react";
import { Bell, Send, RefreshCw, CheckCircle2, AlertTriangle, AlertOctagon, Info, Sparkles, ExternalLink, Users } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

/* ─────────────────────────────────────────────────────── types ─── */

interface User { id: string; full_name: string; email: string; role: string }

interface HistoryRow {
  id: string;
  message: string;
  severity: string;
  category: string;
  sent_by: string | null;
  sent_at: string;
  read_at: string | null;
  link: string | null;
  full_name: string | null;
  email: string | null;
}

/* ─────────────────────────────────────────────── constants ─── */

const SEVERITY_OPTS = [
  { value: "info",    label: "מידע",       color: "text-blue-600",   bg: "bg-blue-50" },
  { value: "success", label: "הצלחה",      color: "text-green-600",  bg: "bg-green-50" },
  { value: "warning", label: "אזהרה",      color: "text-amber-600",  bg: "bg-amber-50" },
  { value: "danger",  label: "דחיפות",     color: "text-red-600",    bg: "bg-red-50" },
  { value: "kudos",   label: "כל הכבוד!",  color: "text-purple-600", bg: "bg-purple-50" },
];

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  info:    <Info    size={14} />,
  success: <CheckCircle2 size={14} />,
  warning: <AlertTriangle size={14} />,
  danger:  <AlertOctagon size={14} />,
  kudos:   <Sparkles size={14} />,
};

const CATEGORY_LABEL: Record<string, string> = {
  general:    "כללי",
  manual:     "ידני",
  sla:        "SLA",
  inactivity: "חוסר פעילות",
  ingest:     "קליטת נתונים",
  quality:    "איכות",
  budget:     "תקציב",
};

const TARGET_GROUPS = [
  { value: "all_recruiters", label: "כל המגייסים" },
  { value: "all_admins",     label: "כל האדמינים" },
  { value: "all_hrbp",       label: "כל ה-HRBP" },
  { value: "all_users",      label: "כולם" },
  { value: "specific",       label: "משתמש/ים ספציפיים" },
];

/** Quick-link suggestions for the link field */
const QUICK_LINKS = [
  { label: "מועמדים",       value: "/candidates" },
  { label: "משרות",         value: "/jobs" },
  { label: "SLA Watchdog",  value: "/ai-hub?tool=sla-watchdog" },
  { label: "קליטת נתונים",  value: "/admin?group=data&sub=batches" },
  { label: "איכות נתונים",  value: "/admin?group=data&sub=quality" },
];

/** Quick message templates */
const TEMPLATES = [
  { label: "🔥 חריגת SLA",     message: "⏱️ נמצאה חריגת SLA — מועמד/ים תקועים מעל היעד. נא לטפל בדחיפות." },
  { label: "📊 עדכון שבועי",    message: "שלום! תזכורת לעדכן סטטוס מועמדים וסגור פניות פתוחות לפני סוף השבוע." },
  { label: "⚠️ בדיקת נתונים",  message: "⚠️ נא לבדוק את תקינות הנתונים במערכת ולדווח על אי-התאמות." },
  { label: "✅ כל הכבוד!",      message: "כל הכבוד על הביצועים השבוע! המשיכו כך 💪" },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

/* ─────────────────────────────────────────── component ─── */

export default function NotificationsTab() {
  /* ── Send section state ── */
  const [users, setUsers] = useState<User[]>([]);
  const [targetGroup, setTargetGroup] = useState("all_recruiters");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  /* ── History section state ── */
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("");

  /* ── Load users + history on mount ── */
  useEffect(() => {
    void loadUsers();
    void loadHistory();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/users`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : (data.users ?? []));
      }
    } catch { /* silently ignore */ }
  };

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/notifications/history?limit=100`, { credentials: "include" });
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistLoading(false);
    }
  };

  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const byCat: Record<string, number> = {};
    let totalRead = 0;
    for (const row of history) {
      byCat[row.category] = (byCat[row.category] ?? 0) + 1;
      if (row.read_at) totalRead++;
    }
    const readRate = history.length ? Math.round((totalRead / history.length) * 100) : 0;
    return { byCat, readRate, total: history.length };
  }, [history]);

  /* ── Send handler ── */
  const handleSend = async () => {
    const isSpecific = targetGroup === "specific";
    if (isSpecific && !selectedIds.length) return;
    if (!message.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const body: Record<string, unknown> = {
        message: message.trim(),
        severity,
        category: "manual",
      };
      if (link.trim()) body.link = link.trim();
      if (isSpecific) {
        body.user_ids = selectedIds;
      } else {
        body.target_group = targetGroup;
      }
      const res = await fetch(`${getApiBaseUrl()}/api/admin/notifications/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult(`✅ נשלחה ל-${data.delivered} משתמשים`);
        setMessage("");
        setLink("");
        setSelectedIds([]);
        void loadHistory();
      } else {
        setSendResult(`❌ שגיאה: ${(data as { detail?: string }).detail ?? "Unknown error"}`);
      }
    } finally {
      setSending(false);
    }
  };

  const toggleUser = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filteredHistory = catFilter
    ? history.filter(r => r.category === catFilter)
    : history;

  const sendLabel = targetGroup === "specific"
    ? `שלח ל-${selectedIds.length} משתמשים`
    : TARGET_GROUPS.find(g => g.value === targetGroup)?.label ?? "שלח";

  const canSend = !sending && message.trim() && (targetGroup !== "specific" || selectedIds.length > 0);

  /* ── Render ── */
  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Bell size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#002649]">ניהול התראות</h2>
            <p className="text-sm text-slate-500">שלח התראות ידניות לקבוצות משתמשים וצפה בהיסטוריה.</p>
          </div>
        </div>
        <button onClick={loadHistory} disabled={histLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-[#002649]">
          <RefreshCw size={12} className={histLoading ? "animate-spin" : ""} /> רענן
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="סה״כ התראות" value={stats.total} color="blue" />
        <StatCard label="שיעור קריאה" value={`${stats.readRate}%`} color="green" />
        {Object.entries(stats.byCat).slice(0, 2).map(([cat, count]) => (
          <StatCard key={cat} label={CATEGORY_LABEL[cat] ?? cat} value={count} color="slate" />
        ))}
      </div>

      {/* ── SEND SECTION ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h3 className="font-black text-[#002649] text-sm flex items-center gap-2">
          <Send size={14} className="text-[#EF6B00]" /> שלח התראה ידנית
        </h3>

        {/* Quick templates */}
        <div>
          <span className="text-xs font-bold text-slate-500 block mb-2">תבניות מהירות</span>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map(t => (
              <button key={t.label} onClick={() => setMessage(t.message)}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-[#EF6B00] transition-colors">
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target group */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-2">
            <Users size={12} className="inline ml-1" />נמענים
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {TARGET_GROUPS.map(g => (
              <button key={g.value} onClick={() => setTargetGroup(g.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  targetGroup === g.value
                    ? "bg-[#002649] text-white border-[#002649]"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}>
                {g.label}
              </button>
            ))}
          </div>

          {/* Specific user picker — shown only when "specific" is selected */}
          {targetGroup === "specific" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500">בחר משתמשים</span>
                <div className="flex gap-2 text-[10px]">
                  <button onClick={() => setSelectedIds(users.map(u => u.id))} className="text-blue-600 hover:underline font-bold">בחר הכל</button>
                  <button onClick={() => setSelectedIds([])} className="text-slate-400 hover:underline">נקה</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {users.map(u => (
                  <label key={u.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      selectedIds.includes(u.id)
                        ? "border-[#EF6B00] bg-orange-50 text-[#002649] font-bold"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <input type="checkbox" className="hidden"
                      checked={selectedIds.includes(u.id)}
                      onChange={() => toggleUser(u.id)} />
                    <span className={`w-2 h-2 rounded-full shrink-0 ${selectedIds.includes(u.id) ? "bg-[#EF6B00]" : "bg-slate-200"}`} />
                    <span className="truncate">{u.full_name || u.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Message */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">תוכן ההתראה</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="כתוב/י כאן את תוכן ההתראה..."
            maxLength={2000}
            rows={3}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#EF6B00] text-[#002649]"
          />
          <div className="text-[10px] text-slate-400 text-left mt-0.5">{message.length}/2000</div>
        </div>

        {/* Severity + Link */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-40">
            <label className="text-xs font-bold text-slate-600 block mb-1">רמת חומרה</label>
            <div className="flex gap-1.5 flex-wrap">
              {SEVERITY_OPTS.map(opt => (
                <button key={opt.value} onClick={() => setSeverity(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors ${
                    severity === opt.value
                      ? `${opt.bg} ${opt.color} border-current`
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs font-bold text-slate-600 block mb-1">קישור (אופציונלי)</label>
            <div className="flex flex-col gap-1">
              <input
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="/candidates"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#EF6B00] text-[#002649] font-mono"
              />
              <div className="flex flex-wrap gap-1">
                {QUICK_LINKS.map(ql => (
                  <button key={ql.value} onClick={() => setLink(ql.value)}
                    className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-orange-50 hover:text-[#EF6B00] transition-colors">
                    {ql.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Send button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
              canSend
                ? "bg-[#EF6B00] text-white hover:bg-[#d65a00]"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Send size={14} /> {sending ? "שולח..." : sendLabel}
          </button>
          {sendResult && (
            <span className={`text-xs font-bold ${sendResult.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
              {sendResult}
            </span>
          )}
        </div>
      </div>

      {/* ── HISTORY SECTION ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-black text-sm text-[#002649]">היסטוריית התראות ({filteredHistory.length})</span>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="text-xs font-bold border border-slate-200 rounded-md px-2 py-1 bg-white text-[#002649] focus:outline-none focus:border-[#EF6B00]">
            <option value="">כל הקטגוריות</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {histLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs">טוען...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">אין התראות</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] font-bold text-slate-500 bg-slate-50/50 sticky top-0">
                <tr>
                  <th className="text-right p-3 w-8"></th>
                  <th className="text-right p-3">הודעה</th>
                  <th className="text-center p-3 w-24 hidden md:table-cell">קטגוריה</th>
                  <th className="text-center p-3 w-24 hidden md:table-cell">נמען</th>
                  <th className="text-right p-3 w-36">תאריך</th>
                  <th className="text-center p-3 w-16">נקרא</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(row => (
                  <tr key={row.id} className={`border-t border-slate-50 hover:bg-slate-50/50 ${row.read_at ? "opacity-70" : ""}`}>
                    <td className="p-3 text-center">
                      <span className={SEVERITY_OPTS.find(s => s.value === row.severity)?.color ?? "text-slate-400"}>
                        {SEVERITY_ICON[row.severity] ?? SEVERITY_ICON.info}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-[#002649] line-clamp-2 max-w-xs">{row.message}</div>
                      {row.link && (
                        <a href={row.link} className="text-[10px] text-[#EF6B00] flex items-center gap-1 mt-0.5 hover:underline">
                          <ExternalLink size={10} /> {row.link}
                        </a>
                      )}
                    </td>
                    <td className="p-3 text-center hidden md:table-cell">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {CATEGORY_LABEL[row.category] ?? row.category}
                      </span>
                    </td>
                    <td className="p-3 text-center hidden md:table-cell">
                      <div className="text-slate-600 text-[10px]">{row.full_name || row.email || "—"}</div>
                    </td>
                    <td className="p-3 text-slate-500 text-[10px]">{formatDate(row.sent_at)}</td>
                    <td className="p-3 text-center">
                      {row.read_at
                        ? <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                        : <span className="w-2 h-2 rounded-full bg-[#EF6B00] mx-auto block" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── sub-components ── */
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue:  "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    slate: "bg-slate-50 text-slate-700",
  };
  return (
    <div className={`rounded-xl p-4 ${colors[color] ?? colors.slate}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-medium opacity-70 mt-0.5">{label}</div>
    </div>
  );
}
