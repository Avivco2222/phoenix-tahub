"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const TIMEOUT_MS = 20 * 60 * 1000;

// --- Auth Audit Logging ---
// Fire-and-forget: never blocks the UI. Falls back to console if backend is offline.
// PII POLICY: payload contains only pre-defined event names and static detail strings.
// No passwords, no user input, no candidate data is ever sent.
async function logAuthEvent(event: string, details: string): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.warn("[Auth]", event, details);
    return;
  }
  try {
    await fetch(`${apiUrl}/api/auth/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        details,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    console.warn("[Auth fallback]", event, details);
  }
}

export default function SessionGuard() {
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const lockScreen = useCallback(() => {
    setIsLocked(true);
    logAuthEvent("SESSION_LOCKED", "inactivity timeout 20min");
  }, []);

  useEffect(() => {
    if (isLocked) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(lockScreen, TIMEOUT_MS);
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
    };
  }, [isLocked, lockScreen]);

  if (!isLocked) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      try {
        const apiUrl = getApiBaseUrl();
        // Unified-password flow: send the cookie so the backend can resolve
        // the user's email from the session and verify against users.password_hash.
        // Same credentials as login / /admin/security — no separate PIN.
        const res = await fetch(`${apiUrl}/api/auth/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ password }),
        });
        if (!res.ok) {
          throw new Error("invalid password");
        }
        setIsLocked(false);
        setPassword("");
        setError("");
        logAuthEvent("SESSION_RESTORED", "session resumed by user");
      } catch {
        setError("סיסמה שגויה. נסה שוב.");
        logAuthEvent("UNLOCK_FAILED", "invalid unlock attempt");
      }
    })();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-24 h-24 bg-[#002649] rounded-full flex items-center justify-center text-white mb-2 shadow-inner">
          <Lock size={48} />
        </div>
        
        <div>
          <h2 className="text-2xl font-black text-[#002649]">המושב ננעל</h2>
          <p className="text-slate-500 mt-2 font-medium text-sm leading-relaxed">
            מטעמי אבטחת מידע והגנה על פרטיות המועמדים, המערכת ננעלה עקב חוסר פעילות.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4 pt-4">
          <label htmlFor="session-password" className="sr-only">סיסמת הרשאה</label>
          <input 
            id="session-password"
            type="password" 
            placeholder="סיסמת הרשאה..." 
            className="w-full text-center p-4 rounded-xl border border-slate-200 focus:border-[#EF6B00] focus:ring-2 focus:ring-[#EF6B00]/20 outline-none transition-all font-mono text-xl tracking-widest shadow-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm font-bold animate-pulse">{error}</p>}
          
          <button type="submit" className="w-full bg-[#EF6B00] text-white p-4 rounded-xl font-black hover:bg-[#d65a00] transition-colors flex items-center justify-center gap-2 text-lg shadow-md">
            <ShieldCheck size={20} /> חידוש סשן
          </button>
        </form>
      </div>
    </div>
  );
}
