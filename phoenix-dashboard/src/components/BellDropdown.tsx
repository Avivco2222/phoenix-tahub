"use client";
import React, { useState, useCallback } from 'react';
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, AlertOctagon, Info, CheckCircle2, Sparkles, X, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { useNotifications, type Notification, type NotificationSeverity } from "@/context/NotificationContext";
import { useSession } from "@/context/SessionContext";

/** Role-aware fallback link per category.
 *  Admin/hrbp → admin panel; recruiter → recruiter-friendly pages.
 *  Pure function (not a hook) so it can be called inside render/map. */
function getFallbackLink(category: string | undefined, role: string): string {
  const links: Record<string, Record<string, string>> = {
    sla: {
      admin:     "/ai-hub?tool=sla-watchdog",
      recruiter: "/ai-hub?tool=sla-watchdog",
      hrbp:      "/ai-hub?tool=sla-watchdog",
    },
    inactivity: {
      admin:     "/admin?group=settings&sub=permissions",
      recruiter: "/",
      hrbp:      "/",
    },
    ingest: {
      admin:     "/admin?group=data&sub=batches",
      recruiter: "/ai-hub",
      hrbp:      "/ai-hub",
    },
    quality: {
      admin:     "/admin?group=data&sub=quality",
      recruiter: "/ai-hub",
      hrbp:      "/ai-hub",
    },
    manual:  { admin: "", recruiter: "", hrbp: "" },
    general: { admin: "", recruiter: "", hrbp: "" },
  };
  return (category && links[category]?.[role]) ?? "";
}

const SEVERITY_STYLE: Record<NotificationSeverity, { icon: React.ReactNode; color: string; bg: string }> = {
  danger:  { icon: <AlertOctagon size={16}/>, color: "text-red-600",    bg: "bg-red-50/40" },
  warning: { icon: <AlertTriangle size={16}/>, color: "text-amber-600", bg: "bg-amber-50/40" },
  success: { icon: <CheckCircle2 size={16}/>, color: "text-green-600",  bg: "bg-green-50/40" },
  kudos:   { icon: <Sparkles size={16}/>,     color: "text-purple-600", bg: "bg-purple-50/40" },
  info:    { icon: <Info size={16}/>,         color: "text-blue-600",   bg: "bg-blue-50/40" },
};

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  sla:        { label: "SLA",    color: "bg-red-100 text-red-700" },
  inactivity: { label: "פעילות", color: "bg-amber-100 text-amber-700" },
  ingest:     { label: "קליטה",  color: "bg-blue-100 text-blue-700" },
  quality:    { label: "איכות",  color: "bg-purple-100 text-purple-700" },
  manual:     { label: "הודעה",  color: "bg-slate-100 text-slate-600" },
  general:    { label: "מערכת",  color: "bg-slate-100 text-slate-500" },
};

export function BellDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { notifications, unreadCount, freshArrival, markAllAsRead, clearNotification } = useNotifications();
  const { user } = useSession();
  const router = useRouter();

  const role = user?.role ?? "recruiter";

  const handleNotificationClick = useCallback((n: Notification) => {
    // Mark as read when clicked
    if (!n.read && n.remote) {
      void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/notifications/${encodeURIComponent(n.id)}/read`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
    // Resolve destination: explicit link → role-aware category fallback → nothing
    const dest = n.link || getFallbackLink(n.category, role);
    setIsOpen(false);
    if (dest) router.push(dest);
  }, [router, role]);

  return (
    <div className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); }}
        aria-label={`התראות${unreadCount > 0 ? ` (${unreadCount} חדשות)` : ""}`}
        className={`relative p-2 rounded-full transition-colors ${
          freshArrival
            ? "text-[#EF6B00] bg-orange-50 animate-bounce"
            : "text-slate-500 hover:bg-slate-100 hover:text-[#002649]"
        }`}
      >
        {/* Pulse ring when a fresh notification just arrived */}
        {freshArrival && (
          <span className="absolute inset-0 rounded-full bg-[#EF6B00]/20 animate-ping" />
        )}
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[9999] animate-in fade-in zoom-in-95 origin-top-left">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-[#002649] text-sm flex items-center gap-2">
                <Bell size={14} className="text-[#EF6B00]"/>
                התראות מערכת
                {unreadCount > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black">{unreadCount} חדשות</span>}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] text-blue-600 font-bold hover:underline">סמן הכל כנקרא</button>
                )}
                <button
                  onClick={() => { setShowPrefs(p => !p); }}
                  title="הגדרות התראות"
                  className={`p-1 rounded-lg transition-colors ${showPrefs ? "text-[#EF6B00] bg-orange-50" : "text-slate-400 hover:text-[#002649] hover:bg-slate-200"}`}
                >
                  <Settings2 size={14} />
                </button>
              </div>
            </div>

            {showPrefs && <NotificationPrefsPanel onClose={() => setShowPrefs(false)} />}

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs font-medium">
                  <Bell size={28} className="mx-auto mb-2 text-slate-300" />
                  אין התראות חדשות
                </div>
              ) : (
                notifications.map(n => {
                  const style = SEVERITY_STYLE[n.type] ?? SEVERITY_STYLE.info;
                  const dest = n.link || getFallbackLink(n.category, role);
                  const clickable = !!dest;
                  const badge = n.category ? CATEGORY_BADGE[n.category] : null;
                  const isLong = n.msg.length > 100;
                  const isExpanded = expandedId === n.id;

                  return (
                    <div
                      key={n.id}
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={() => { if (clickable) handleNotificationClick(n); }}
                      onKeyDown={e => { if (clickable && (e.key === "Enter" || e.key === " ")) handleNotificationClick(n); }}
                      className={`p-4 flex gap-3 border-b border-slate-50 transition-colors ${!n.read ? style.bg : ''} ${clickable ? "cursor-pointer hover:bg-orange-50/60" : "hover:bg-slate-50"}`}
                    >
                      <div className={`mt-0.5 shrink-0 ${style.color}`}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs text-slate-700 leading-tight font-medium whitespace-pre-wrap ${!isExpanded && isLong ? "line-clamp-3" : ""}`}>
                          {n.msg}
                        </p>
                        {/* "Read more" toggle for long non-navigable messages */}
                        {!clickable && isLong && (
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : n.id); }}
                            className="flex items-center gap-0.5 text-[9px] text-[#EF6B00] font-bold mt-1 hover:underline"
                          >
                            {isExpanded ? <><ChevronUp size={10}/> הסתר</> : <><ChevronDown size={10}/> קרא עוד</>}
                          </button>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {/* Category badge */}
                          {badge && (
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${badge.color}`}>
                              {badge.label}
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400 font-medium">{n.time}</span>
                          {n.sentBy && (<><span className="text-[9px] text-slate-300">·</span><span dir="ltr" className="text-[9px] text-slate-400 truncate max-w-[100px]">{n.sentBy}</span></>)}
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#EF6B00]" aria-label="חדש" />}
                          {clickable && <span className="text-[9px] text-[#EF6B00]/60 font-bold">← לחץ לפרטים</span>}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); clearNotification(n.id); }}
                        title="הסר"
                        aria-label="הסר התראה"
                        className="text-slate-300 hover:text-red-500 shrink-0 self-start"
                      >
                        <X size={14}/>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Inline notification preferences panel ────────────────────────────────────

const PREF_CATEGORIES: Array<{ id: string; label: string; desc: string }> = [
  { id: "sla",        label: "חריגות SLA",          desc: "מועמד / משרה תקוע/ה מעל היעד" },
  { id: "inactivity", label: "חוסר פעילות",          desc: "מגייסת לא פעילה מספר ימים" },
  { id: "ingest",     label: "קליטת קבצים",          desc: "קובץ נקלט / נדחה" },
  { id: "quality",    label: "איכות נתונים",          desc: "ציון איכות ירד מתחת לסף" },
  { id: "manual",     label: "הודעות ידניות",         desc: "הודעות שנשלחו על-ידי מנהל" },
  { id: "general",    label: "כללי",                  desc: "אירועי מערכת אחרים" },
];

function NotificationPrefsPanel({ onClose }: Readonly<{ onClose: () => void }>) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const [prefs, setPrefs] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [browserPerm, setBrowserPerm] = React.useState<NotificationPermission>("default");

  React.useEffect(() => {
    void fetch(`${apiUrl}/api/notifications/preferences`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, boolean>) => {
        const resolved: Record<string, boolean> = {};
        for (const cat of PREF_CATEGORIES) {
          resolved[cat.id] = data[cat.id] !== false;
        }
        setPrefs(resolved);
        setLoaded(true);
      })
      .catch(() => {
        const fallback: Record<string, boolean> = {};
        for (const cat of PREF_CATEGORIES) fallback[cat.id] = true;
        setPrefs(fallback);
        setLoaded(true);
      });
    if (typeof Notification !== "undefined") setBrowserPerm(Notification.permission);
  }, [apiUrl]);

  const toggle = (id: string) => setPrefs(prev => ({ ...prev, [id]: !prev[id] }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${apiUrl}/api/notifications/preferences`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      onClose();
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const requestBrowserPerm = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setBrowserPerm(perm);
  };

  if (!loaded) {
    return <div className="p-4 text-xs text-slate-400 text-center">טוען הגדרות…</div>;
  }

  return (
    <div className="border-b border-slate-200 bg-blue-50/40 p-4 space-y-3">
      <div className="text-[11px] font-black text-[#002649] uppercase tracking-wider">הגדרות התראות</div>

      {/* Browser notification permission */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-3 py-2">
        <div>
          <div className="text-xs font-bold text-slate-700">התראות דפדפן</div>
          <div className="text-[10px] text-slate-400">
            {browserPerm === "granted" ? "✅ מופעל" : browserPerm === "denied" ? "🚫 חסום בדפדפן" : "לא אושרו עדיין"}
          </div>
        </div>
        {browserPerm !== "granted" && browserPerm !== "denied" && (
          <button
            onClick={() => void requestBrowserPerm()}
            className="text-[10px] font-bold text-white bg-[#002649] px-2 py-1 rounded-lg hover:bg-[#EF6B00] transition-colors"
          >
            אפשר
          </button>
        )}
      </div>

      {/* Category toggles */}
      <div className="space-y-1.5">
        {PREF_CATEGORIES.map(cat => (
          <label key={cat.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={!!prefs[cat.id]}
              onChange={() => toggle(cat.id)}
              className="accent-[#EF6B00] w-3.5 h-3.5"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-700">{cat.label}</div>
              <div className="text-[10px] text-slate-400 truncate">{cat.desc}</div>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={() => void save()}
        disabled={saving}
        className="w-full py-2 bg-[#002649] text-white text-xs font-bold rounded-xl hover:bg-[#EF6B00] transition-colors disabled:opacity-60"
      >
        {saving ? "שומר…" : "שמור הגדרות"}
      </button>
    </div>
  );
}
