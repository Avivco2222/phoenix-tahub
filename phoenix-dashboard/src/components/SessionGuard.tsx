"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, ShieldCheck } from "lucide-react";

const TIMEOUT_MS = 20 * 60 * 1000;

export default function SessionGuard() {
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const lockScreen = useCallback(() => {
    setIsLocked(true);
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
    if (password === "222222") {
      setIsLocked(false);
      setPassword("");
      setError("");
    } else {
      setError("סיסמה שגויה. נסה שוב.");
    }
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
