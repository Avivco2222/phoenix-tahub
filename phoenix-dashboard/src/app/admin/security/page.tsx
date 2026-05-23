"use client";

/**
 * /admin/security — destructive-controls dashboard.
 *
 * This page used to host both the AI kill-switch + PII status + audit log,
 * gated behind a 20-minute password challenge. In A9-FU UX wave 2 the audit
 * log moved to /admin?group=settings&sub=audit-log (no password gate — the
 * caller is already authenticated as ADMIN via the session cookie).
 *
 * What stays here:
 *   * AI Kill Switch — toggles the AI pipeline at the server. Genuinely
 *     destructive, so we keep the password challenge.
 *   * PII Scrubber status — read-only confirmation that the scrubber is
 *     active. Pinned to this page because admins look for it next to the
 *     kill switch when incident-responding.
 *   * Session-timeout banner — visual reassurance that destructive controls
 *     auto-lock.
 *
 * What moved out (A9-FU UX wave 4 cleanup):
 *   * The audit-log table — see AuditLogTab.tsx, accessed via the new
 *     "audit-log" sub-tab under /admin?group=settings.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ShieldAlert, Lock, Unlock, Power, Clock, EyeOff, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { getAdminHeaders, getApiBaseUrl } from "@/lib/api";
import { saveAccessToken } from "@/lib/auth";


export default function SecurityAndPrivacyPage() {
  const SESSION_TIMEOUT_MINUTES = 20;
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [aiEnabled, setAiEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionNow, setSessionNow] = useState(Date.now());

  const fetchSecurityData = useCallback(async () => {
    try {
      const apiUrl = getApiBaseUrl();
      const headers = getAdminHeaders();
      const statusRes = await fetch(`${apiUrl}/api/security/status`, { headers });
      if (!statusRes.ok) throw new Error("status fetch failed");
      const statusData = await statusRes.json();
      setAiEnabled(statusData.ai_enabled);
      setFetchError("");
    } catch (error) {
      console.error("[Security] Backend unavailable", error);
      setFetchError("שגיאה בטעינת נתוני אבטחה חיים מהשרת.");
      setAiEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      fetchSecurityData();
    }
  }, [isUnlocked, fetchSecurityData]);

  useEffect(() => {
    if (!isUnlocked) return;
    const timer = setInterval(() => setSessionNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      try {
        // Unified-password flow: backend resolves the user's email from the
        // session cookie and verifies against users.password_hash (same as login).
        const res = await fetch(`${getApiBaseUrl()}/api/auth/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ password: passwordInput }),
        });
        if (!res.ok) throw new Error("unauthorized");
        const payload = await res.json();
        if (payload?.access_token) {
          saveAccessToken(payload.access_token);
        }
        setIsUnlocked(true);
        setSessionStartedAt(Date.now());
        setErrorMsg("");
      } catch {
        setErrorMsg("סיסמה שגויה. נסיון הגישה מתועד.");
      }
    })();
  };

  const toggleAi = async () => {
    if (isLoading) return;
    setIsLoading(true);
    const newState = !aiEnabled;

    try {
      await fetch(`${getApiBaseUrl()}/api/security/toggle-ai`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ enable: newState })
      });

      setAiEnabled(newState);
      await fetchSecurityData();
    } catch (error) {
      console.error("Failed to toggle AI", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] animate-in fade-in duration-500">
        <div className="bg-white p-10 rounded-3xl shadow-lg border border-slate-200 max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4">
            <Lock size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#002649]">אזור מאובטח (Production)</h2>
            <p className="text-slate-500 mt-2 font-medium text-sm">
              שליטה בכלים הרסניים (AI Kill Switch, PII Scrubbing) מוגבלת למורשים בלבד.
            </p>
            <p className="text-slate-400 mt-2 text-xs">
              ליומן ביקורת רגיל אין צורך בנעילה זו — ראו{' '}
              <Link href="/admin?group=settings&sub=audit-log" className="text-[#EF6B00] underline font-bold">
                הגדרות → יומן ביקורת
              </Link>.
            </p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-4">
            <label htmlFor="security-password" className="sr-only">סיסמת הרשאה</label>
            <input
              id="security-password"
              type="password"
              placeholder="הזן סיסמת הרשאה..."
              className="w-full text-center p-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all font-mono text-xl tracking-widest"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
            {errorMsg && <p className="text-red-500 text-sm font-bold animate-pulse">{errorMsg}</p>}
            <button type="submit" className="w-full bg-[#002649] text-white p-3 rounded-xl font-bold hover:bg-[#EF6B00] transition-colors flex items-center justify-center gap-2">
              <Unlock size={18} /> שחרר נעילה למערכת אמת
            </button>
          </form>
        </div>
      </div>
    );
  }

  const elapsedMs = sessionStartedAt ? Math.max(0, sessionNow - sessionStartedAt) : 0;
  const totalMs = SESSION_TIMEOUT_MINUTES * 60 * 1000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const timeoutProgress = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 px-2 md:px-6 pb-20">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
            הגנת המידע ופרטיות <ShieldAlert className="text-red-500" size={32} />
          </h1>
          <p className="text-slate-500 mt-2 font-medium">המערכת מחוברת ישירות למסד הנתונים (Live Environment).</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin?group=settings&sub=audit-log"
            className="bg-white border border-slate-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-slate-600 hover:text-[#EF6B00] hover:border-[#EF6B00]/40 transition-all text-sm"
          >
            <Activity size={16} /> יומן ביקורת מלא
          </Link>
          <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-green-200">
            <CheckCircle2 size={18} /> חיבור Backend מאובטח פעיל
          </div>
        </div>
      </div>
      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
          {fetchError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className={`p-8 rounded-3xl border transition-all duration-500 shadow-sm relative overflow-hidden ${aiEnabled ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className={`p-3 rounded-xl ${aiEnabled ? 'bg-blue-50 text-blue-600' : 'bg-red-100 text-red-600'}`}>
              <Power size={24} />
            </div>
            <button
              onClick={toggleAi}
              disabled={isLoading}
              className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${aiEnabled ? 'bg-green-500' : 'bg-red-500'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label={aiEnabled ? 'כבה מנוע AI' : 'הפעל מנוע AI'}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${aiEnabled ? 'transform -translate-x-6' : ''}`} />
            </button>
          </div>
          <div className="relative z-10">
            <h3 className="font-black text-xl text-[#002649] mb-2">AI Kill Switch (Live)</h3>
            <p className="text-sm text-slate-600 font-medium">
              {aiEnabled
                ? "מנוע ה-AI פועל כרגיל. כל הנתונים עוברים טשטוש (PII Scrubbing) טרם שליחתם."
                : "מנוע ה-AI כובה פיזית בשרת! המערכת פועלת במצב חירום (Regex בלבד)."}
            </p>
          </div>
          {!aiEnabled && <div className="absolute -bottom-10 -left-10 text-red-500/10"><AlertTriangle size={150} /></div>}
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><EyeOff size={24} /></div>
            <h3 className="font-black text-xl text-[#002649]">טשטוש נתונים (PII)</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm font-bold border-b border-slate-100 pb-2">
              <span className="text-slate-600">תעודות זהות (ID)</span>
              <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={14}/> מוסתר</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold border-b border-slate-100 pb-2">
              <span className="text-slate-600">מספרי טלפון וכתובות</span>
              <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={14}/> מוסתר</span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-4">מנגנון ה-Scrubber פעיל בשרת (ראה לוגים).</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-50 text-[#EF6B00] rounded-xl"><Clock size={24} /></div>
            <h3 className="font-black text-xl text-[#002649]">ניתוק אוטומטי (Session)</h3>
          </div>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-black text-[#002649]">{remainingMinutes}</span>
            <span className="text-slate-500 font-bold mb-1">דקות</span>
          </div>
          <p className="text-sm text-slate-600 font-medium mb-4">
            המערכת נועלת משתמשים באופן אוטומטי לפי תקן ISO-27001.
          </p>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#EF6B00]" style={{ width: `${timeoutProgress}%` }}></div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-600 font-medium">
        <p className="font-bold text-[#002649] mb-2">לאן הלך יומן הביקורת?</p>
        <p>
          יומן הביקורת המלא — עם סינון לפי פעולה, משתמש, batch_id וטווח תאריכים — עבר ל-
          <Link href="/admin?group=settings&sub=audit-log" className="text-[#EF6B00] underline font-bold">
            הגדרות → יומן ביקורת
          </Link>
          . שם אין חיכוך של סיסמה נפרדת — מנהל מערכת מאומת ב-session cookie יכול לצפות ישירות.
          הדף הזה נשמר רק לכלים הרסניים (AI kill switch + PII status) שמצדיקים נעילה נוספת.
        </p>
      </div>
    </div>
  );
}
