import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { 
  LayoutDashboard, Users, Settings, PieChart, 
  Brain, BadgeDollarSign, ShieldCheck, Zap, Orbit, Building2 
} from "lucide-react";
import Link from "next/link"; 
import { NotificationProvider } from "@/context/NotificationContext";
import { BellDropdown } from "@/components/BellDropdown";
import SessionGuard from "@/components/SessionGuard";

// הגדרת הפונט
const heebo = Heebo({ 
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "The FNX TAHub",
  description: "Smart Hiring. People Driven. Automating Success.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  // === מערכת הרשאות (Role Based Access Control) ===
  // כרגע כדגל סטטי. בעתיד יתחבר למערכת Auth (למשל Token של המשתמש המחובר)
  const isAdmin = true; 

  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} flex h-screen overflow-hidden bg-[#F8FAFC]`}>
        <NotificationProvider>
          <SessionGuard />
          
          {/* === SIDEBAR === */}
          <aside className="w-64 bg-white border-l border-slate-200 flex flex-col shrink-0 h-full">

            {/* LOGO AREA */}
            <div className="px-6 py-6 border-b border-slate-100 group cursor-default">
              <div className="flex flex-col items-center justify-center gap-2 animate-in fade-in slide-in-from-top-4 duration-1000">
                <div dir="ltr" className="flex items-center gap-2.5">
                  <span className="text-[26px] font-bold text-[#002649] tracking-tight">FNX</span>
                  <Orbit size={28} strokeWidth={1.5} className="text-[#EF6B00] transition-all duration-700 ease-in-out group-hover:rotate-180 group-hover:scale-110 drop-shadow-sm group-hover:drop-shadow-[0_0_8px_rgba(239,107,0,0.5)]" />
                  <div className="text-[26px] text-[#002649] tracking-tight flex items-baseline">
                    <span className="font-black">TA</span>
                    <span className="font-light">Hub</span>
                  </div>
                </div>
                <div className="text-[9px] uppercase tracking-[0.25em] whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                  <span className="font-medium text-slate-400 group-hover:text-[#002649] transition-colors duration-500 flex items-center justify-center">
                    Smart Hiring
                    <span className="text-[#EF6B00]/60 mx-2 text-[12px] leading-none">&bull;</span>
                    Human Touch
                  </span>
                </div>
              </div>
            </div>

            {/* NAVIGATION */}
            <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
              <NavItem href="/" icon={<LayoutDashboard size={18} />} label="מבט על" />
              <NavItem href="/intelligence" icon={<Brain size={18} />} label="תובנות ותחזיות" />
              
              {/* מודול אסטרטגי - חשוף רק להנהלה/אדמין */}
              {isAdmin && (
                <NavItem href="/headcount" icon={<Building2 size={18} />} label="דוח שליטה" />
              )}

              <NavItem href="/jobs" icon={<PieChart size={18} />} label="משרות" />
              <NavItem href="/candidates" icon={<Users size={18} />} label="מועמדים" />
              
              {/* מודול תקציב - חשוף רק להנהלה/אדמין */}
              {isAdmin && (
                <NavItem href="/budget" icon={<BadgeDollarSign size={18} />} label="ניהול תקציב" />
              )}

              <div className="pt-4 pb-2 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                שימושי
              </div>
              <NavItem href="/ai-hub" icon={<Zap size={18} />} label="ארגז כלים" />

              <div className="pt-4 pb-2 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                מערכת
              </div>
              <NavItem href="/admin" icon={<Settings size={18} />} label="הגדרות Admin" />
              <NavItem href="/admin/permissions" icon={<ShieldCheck size={18} />} label="הרשאות ומשתמשים" />
            </nav>

            {/* USER PROFILE */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#002649] text-white flex items-center justify-center font-bold">
                  אב
                </div>
                <div>
                  <div className="text-sm font-bold text-[#002649]">אביב כהן</div>
                  <div className="text-xs text-slate-500">מנהל פרויקטים</div>
                </div>
              </div>
            </div>
          </aside>

          {/* === MAIN CONTENT === */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-end px-8 shadow-sm shrink-0">
              <div className="flex items-center gap-4">
                <BellDropdown />
              </div>
            </header>

            <div className="flex-1 overflow-auto p-4 md:p-8 relative">
              {children}
            </div>
          </main>
        </NotificationProvider>
      </body>
    </html>
  );
}

// === קומפוננטת ניווט ===
function NavItem({ icon, label, href = "#", isPremium = false }: Readonly<{ icon: React.ReactNode; label: string; href?: string; isPremium?: boolean }>) {
  return (
    <Link href={href} className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-[13px] font-medium text-[#002649]/90 hover:bg-slate-50 hover:text-[#EF6B00] transition-all duration-200 focus:bg-[#002649] focus:text-white group">
      <div className="flex items-center gap-4">
        <span className="text-slate-400 group-hover:text-[#EF6B00] transition-colors">{icon}</span>
        <span>{label}</span>
      </div>
      {/* נקודה כתומה ועדינה המציינת מודול ניהולי/אסטרטגי (כרגע כבויה עבור דוח שליטה) */}
      {isPremium && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#EF6B00] opacity-80" title="מודול אסטרטגי"></span>
      )}
    </Link>
  );
}