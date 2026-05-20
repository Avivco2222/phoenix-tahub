"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Loader2, ShieldCheck, Orbit } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [usf, setUsf] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !usf) {
      setError("נא להזין אימייל ומספר עובד");
      return;
    }

    setIsSubmitting(true);
    try {
      // Backend's auth/login still expects { email, password } — the USF IS the password.
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password: usf }),
      });

      if (!res.ok) {
        let detail: string | undefined;
        try {
          const data = await res.json();
          detail = data?.detail;
        } catch (jsonErr) {
          console.warn("[Login] Could not parse error response:", jsonErr);
        }
        setError(detail || "אימייל או מספר עובד שגויים");
        return;
      }

      // Successful login — redirect to home
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[Login] Network error:", err);
      setError("אין תקשורת עם השרת. בדקי חיבור ונסי שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center gap-2 mb-8">
          <div dir="ltr" className="flex items-center gap-2.5">
            <span className="text-[28px] font-bold text-[#002649] tracking-tight">FNX</span>
            <Orbit size={30} strokeWidth={1.5} className="text-[#EF6B00] drop-shadow-sm" />
            <div className="text-[28px] text-[#002649] tracking-tight flex items-baseline">
              <span className="font-black">TA</span>
              <span className="font-light">Hub</span>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-[0.25em]">
            Smart Hiring · Human Touch
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-10 space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-[#002649] rounded-2xl flex items-center justify-center text-white shadow-inner">
              <ShieldCheck size={28} />
            </div>
            <h1 className="text-2xl font-black text-[#002649]">כניסה למערכת</h1>
            <p className="text-sm text-slate-500 font-medium">
              נא להתחבר באמצעות פרטי המשתמש שקיבלת ממנהל המערכת
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="text-xs font-bold text-slate-500 mb-1.5 block">
                אימייל
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="w-full p-3.5 border border-slate-200 rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00] focus:ring-2 focus:ring-[#EF6B00]/20 transition-all"
                placeholder="name@fnx.co.il"
                required
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="usf" className="text-xs font-bold text-slate-500 mb-1.5 block">
                מספר עובד (USF)
              </label>
              <div className="relative">
                <Hash size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="usf"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={usf}
                  onChange={(e) => setUsf(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-3.5 pr-10 border border-slate-200 rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00] focus:ring-2 focus:ring-[#EF6B00]/20 transition-all"
                  required
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-bold"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#EF6B00] text-white p-4 rounded-xl font-black hover:bg-[#d65a00] transition-colors flex items-center justify-center gap-2 text-base shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" /> מתחבר...
              </>
            ) : (
              <>
                <ShieldCheck size={20} /> התחברות
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          שכחת סיסמה? פנה למנהל המערכת לאיפוס.
        </p>
      </div>
    </div>
  );
}
