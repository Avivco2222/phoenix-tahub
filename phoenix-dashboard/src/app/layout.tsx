import type { Metadata } from "next";
import { Heebo } from "next/font/google"; // יבוא רשמי של הפונט
import "./globals.css";
import { LayoutDashboard, Users, Settings, Search, PieChart, Brain, BadgeDollarSign, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link"; // לניווט מהיר
import { NotificationProvider } from "@/context/NotificationContext";
import { BellDropdown } from "@/components/BellDropdown";

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
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} flex h-screen overflow-hidden bg-[#F8FAFC]`}>
        <NotificationProvider>
          {/* === SIDEBAR === */}
          <aside className="w-72 bg-white border-l border-slate-200 flex flex-col shadow-sm z-50">
            <div className="h-24 flex flex-col justify-center px-8 border-b border-slate-100">
              <div className="font-black text-2xl tracking-tight text-[#002649] mb-1">
                The FNX <span className="text-[#EF6B00]">TAHub</span>
              </div>
              <div className="text-[10px] font-bold text-slate-400 leading-tight">
                Smart Hiring. People Driven.<br/>Automating Success.
              </div>
            </div>

            <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
              <NavItem href="/" icon={<LayoutDashboard size={20} />} label="מבט על" />
              <NavItem href="/intelligence" icon={<Brain size={20} />} label="תובנות ותחזיות" />
              <NavItem href="/jobs" icon={<PieChart size={20} />} label="משרות" />
              <NavItem href="/candidates" icon={<Users size={20} />} label="מועמדים" />
              <NavItem href="/budget" icon={<BadgeDollarSign size={20} />} label="ניהול תקציב" />

              <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                שימושי
              </div>
              <NavItem href="/ai-hub" icon={<Zap size={20} />} label="ארגז כלים" />

              <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                מערכת
              </div>
              <NavItem href="/admin" icon={<Settings size={20} />} label="הגדרות Admin" />
              <NavItem href="/admin/permissions" icon={<ShieldCheck size={20} />} label="הרשאות ומשתמשים" />
            </nav>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#002649] text-white flex items-center justify-center font-bold">
                  אב
                </div>
                <div>
                  <div className="text-sm font-bold text-[#002649]">אביב כהן</div>
                  <div className="text-xs text-slate-500">מנהל גיוס ראשי</div>
                </div>
              </div>
            </div>
          </aside>

          {/* === MAIN CONTENT === */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm shrink-0">
              <div className="relative w-96">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  placeholder="חיפוש מועמד, משרה או תהליך..."
                  className="w-full py-2 pr-10 pl-4 bg-slate-100 border-none rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-[#EF6B00] outline-none transition-all"
                />
              </div>
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

// חזרנו לקומפוננטה המקורית שלך - נקייה, אחידה ומקצועית
function NavItem({ icon, label, href = "#" }: Readonly<{ icon: React.ReactNode; label: string; href?: string }>) {
  return (
    <Link href={href} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#EF6B00] transition-all duration-200 focus:bg-[#002649] focus:text-white">
      {icon}
      <span>{label}</span>
    </Link>
  );
}