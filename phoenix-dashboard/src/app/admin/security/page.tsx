"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Lock, Unlock, Power, Clock, EyeOff, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

interface AuditLog {
  id: string;
  time: string;
  action: string;
  status: string;
  details: string;
  user: string;
}

export default function SecurityAndPrivacyPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [aiEnabled, setAiEnabled] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSecurityData = useCallback(async () => {
    try {
      const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/security/status`);
      const statusData = await statusRes.json();
      setAiEnabled(statusData.ai_enabled);

      const logsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/security/audit-logs`);
      const logsData = await logsRes.json();
      setLogs(logsData);
    } catch (error) {
      console.error("Failed to fetch security data", error);
    }
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      fetchSecurityData();
    }
  }, [isUnlocked, fetchSecurityData]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "222222") {
      setIsUnlocked(true);
      setErrorMsg("");
    } else {
      setErrorMsg("סיסמה שגויה. נסיון הגישה מתועד.");
    }
  };

  const toggleAi = async () => {
    if (isLoading) return;
    setIsLoading(true);
    const newState = !aiEnabled;

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/security/toggle-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const getStatusClass = (status: string) => {
    if (status === 'Success') return 'bg-green-100 text-green-700';
    if (status === 'Warning') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
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
            <p className="text-slate-500 mt-2 font-medium text-sm">הגישה לניהול הגנת המידע והפרטיות מוגבלת למורשים בלבד.</p>
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

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 px-2 md:px-6 pb-20">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
            הגנת המידע ופרטיות <ShieldAlert className="text-red-500" size={32} />
          </h1>
          <p className="text-slate-500 mt-2 font-medium">המערכת מחוברת ישירות למסד הנתונים (Live Environment).</p>
        </div>
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-green-200">
          <CheckCircle2 size={18} /> חיבור Backend מאובטח פעיל
        </div>
      </div>

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
            <span className="text-4xl font-black text-[#002649]">20</span>
            <span className="text-slate-500 font-bold mb-1">דקות</span>
          </div>
          <p className="text-sm text-slate-600 font-medium mb-4">
            המערכת נועלת משתמשים באופן אוטומטי לפי תקן ISO-27001.
          </p>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#EF6B00] w-full"></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-black text-xl text-[#002649] flex items-center gap-2">
            <Activity size={20} className="text-blue-500" /> יומן פעולות שרת (Live Audit Log)
          </h3>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-white text-slate-400 font-bold text-xs uppercase border-b border-slate-100 sticky top-0">
              <tr>
                <th className="px-6 py-4">מזהה</th>
                <th className="px-6 py-4">זמן (Live)</th>
                <th className="px-6 py-4">פעולה</th>
                <th className="px-6 py-4">סטטוס</th>
                <th className="px-6 py-4">פרטים נוספים</th>
                <th className="px-6 py-4">משתמש</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    אין רשומות עדיין. נסה לכבות ולהדליק את מנוע ה-AI כדי לייצר את הרשומה הראשונה במסד הנתונים.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{log.id}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{log.time}</td>
                    <td className="px-6 py-4 font-bold text-[#002649]">{log.action}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${getStatusClass(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{log.details}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{log.user}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
