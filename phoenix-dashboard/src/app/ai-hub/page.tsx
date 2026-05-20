"use client";

/**
 * /ai-hub — "אפליקציות" (Apps) launcher.
 *
 * Phone/smart-TV inspired home screen: all apps visible at once, organized by
 * category sections, each app rendered as a large square tile (icon over label).
 * Click → opens the app inline (replaces grid view with the app's UI).
 *
 * Capabilities:
 *   - Recruiter can pin favorites (heart icon on tile) → appear in sidebar
 *   - Admin overrides (visibility + tags) loaded from /api/apps/config
 *   - Hidden apps: removed for non-admins, shown dimmed for admins
 *   - Tag rendering: "חדש" / "עדכון" / "בקרוב" — defaults overridable
 *   - URL state: ?cat=&tool= (keeps deep-links to specific apps working)
 *   - Migrates legacy ?tab= from old 4-tab page
 */

import React, { useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Zap, ArrowRightLeft, UserPlus, FileText,
  FileSearch, Mail as MailIcon, BookOpen,
  Briefcase, DollarSign, Phone, Calendar, Trophy, ShieldAlert, TrendingUp,
  ChevronRight, Pin, PinOff, EyeOff,
} from "lucide-react";

import MobilitySimulator from "./components/MobilitySimulator";
import SmartOnboarding from "./components/SmartOnboarding";
import ReportsGenerator from "./components/ReportsGenerator";
import ManagerWhisperer from "./components/ManagerWhisperer";
import CVAnalyzer from "./components/CVAnalyzer";
import WelcomeEmailGenerator from "./components/WelcomeEmailGenerator";
import InterviewQuestionsBank from "./components/InterviewQuestionsBank";
import JobDescriptionGenerator from "./components/JobDescriptionGenerator";
import PhoneScreenSummary from "./components/PhoneScreenSummary";
import RecruiterPerformanceCoach from "./components/RecruiterPerformanceCoach";
import CompensationBenchmark from "./components/CompensationBenchmark";
import SmartScheduler from "./components/SmartScheduler";
import HeadcountForecaster from "./components/HeadcountForecaster";
import SLAWatchdog from "./components/SLAWatchdog";

import { PageHeader } from "@/components/PageHeader";
import { applyOverrides, type EffectiveAppEntry } from "@/lib/tools-registry";
import { useAppConfig } from "@/lib/use-app-config";
import { useAppPins } from "@/lib/app-pins";
import { useSession } from "@/context/SessionContext";

// ---- Category metadata (visual only — IDs come from registry) ----
type CategoryId = EffectiveAppEntry["cat"];

const CATEGORY_META: Record<CategoryId, { title: string; subtitle: string; accent: string; bg: string }> = {
  pre:        { title: "לפני קליטה",      subtitle: "סינון מועמדים והכנה לראיון",        accent: "#3B82F6", bg: "bg-blue-50" },
  during:     { title: "בתהליך הגיוס",     subtitle: "תובנות וחישובים בזמן אמת",          accent: "#EF6B00", bg: "bg-orange-50" },
  onboarding: { title: "בקליטה",           subtitle: "ליווי עובד חדש מהיום הראשון",         accent: "#10B981", bg: "bg-emerald-50" },
  analytics:  { title: "ניתוח",            subtitle: "דוחות ותובנות מערכת",                accent: "#8B5CF6", bg: "bg-violet-50" },
};

// ---- App ID → icon + renderer (kept here because JSX/React can't live in lib/) ----
const APP_ICONS: Record<string, React.ReactNode> = {
  "cv-analyzer":         <FileSearch size={32} strokeWidth={1.5}/>,
  "questions":           <BookOpen size={32} strokeWidth={1.5}/>,
  "jd-generator":        <Briefcase size={32} strokeWidth={1.5}/>,
  "whisperer":           <Zap size={32} strokeWidth={1.5}/>,
  "mobility":            <ArrowRightLeft size={32} strokeWidth={1.5}/>,
  "compensation":        <DollarSign size={32} strokeWidth={1.5}/>,
  "phone-screen":        <Phone size={32} strokeWidth={1.5}/>,
  "scheduler":           <Calendar size={32} strokeWidth={1.5}/>,
  "smart-onboarding":    <UserPlus size={32} strokeWidth={1.5}/>,
  "welcome-email":       <MailIcon size={32} strokeWidth={1.5}/>,
  "reports":             <FileText size={32} strokeWidth={1.5}/>,
  "coach":               <Trophy size={32} strokeWidth={1.5}/>,
  "sla-watchdog":        <ShieldAlert size={32} strokeWidth={1.5}/>,
  "headcount-forecaster":<TrendingUp size={32} strokeWidth={1.5}/>,
};

const APP_RENDERERS: Record<string, () => React.ReactNode> = {
  "cv-analyzer":         () => <CVAnalyzer />,
  "questions":           () => <InterviewQuestionsBank />,
  "jd-generator":        () => <JobDescriptionGenerator />,
  "whisperer":           () => <ManagerWhisperer />,
  "mobility":            () => <MobilitySimulator />,
  "compensation":        () => <CompensationBenchmark />,
  "phone-screen":        () => <PhoneScreenSummary />,
  "scheduler":           () => <SmartScheduler />,
  "smart-onboarding":    () => <SmartOnboarding />,
  "welcome-email":       () => <WelcomeEmailGenerator />,
  "reports":             () => <ReportsGenerator />,
  "coach":               () => <RecruiterPerformanceCoach />,
  "sla-watchdog":        () => <SLAWatchdog />,
  "headcount-forecaster":() => <HeadcountForecaster />,
};

const TAG_META: Record<"new" | "update" | "coming_soon", { label: string; bg: string; fg: string }> = {
  new:         { label: "חדש",  bg: "bg-[#EF6B00]", fg: "text-white" },
  update:      { label: "עדכון", bg: "bg-blue-500", fg: "text-white" },
  coming_soon: { label: "בקרוב", bg: "bg-amber-200", fg: "text-amber-900" },
};

// ---- Component ----

export default function AppsLauncher() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { user } = useSession();
  const { overrides } = useAppConfig();
  const { isPinned, togglePin } = useAppPins();

  const isAdmin = user?.role === "admin";

  const effectiveApps = useMemo(() => applyOverrides(overrides), [overrides]);

  // Filter: non-admins don't see hidden apps; admins see them dimmed.
  const visibleApps = useMemo(
    () => effectiveApps.filter(a => isAdmin || !a.hidden),
    [effectiveApps, isAdmin],
  );

  // Group by category, preserving registry order within each.
  const byCategory = useMemo(() => {
    const out: Record<CategoryId, EffectiveAppEntry[]> = { pre: [], during: [], onboarding: [], analytics: [] };
    visibleApps.forEach(a => out[a.cat].push(a));
    return out;
  }, [visibleApps]);

  const currentTool = search.get("tool");
  const currentCat = (search.get("cat") as CategoryId | null) ?? null;
  const activeApp = currentTool
    ? effectiveApps.find(a => a.id === currentTool && (!currentCat || a.cat === currentCat)) ?? null
    : null;

  // Migrate legacy ?tab= from the old 4-tab layout (kept for backwards-compat
  // with existing bookmarks/links from before the redesign).
  useEffect(() => {
    const legacy = search.get("tab");
    if (!legacy) return;
    const map: Record<string, [CategoryId, string]> = {
      whisperer:  ["during", "whisperer"],
      mobility:   ["during", "mobility"],
      onboarding: ["onboarding", "smart-onboarding"],
      reports:    ["analytics", "reports"],
    };
    const next = map[legacy];
    if (next) {
      const params = new URLSearchParams(search.toString());
      params.delete("tab");
      params.set("cat", next[0]);
      params.set("tool", next[1]);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [search, pathname, router]);

  const openApp = (app: EffectiveAppEntry) => {
    const params = new URLSearchParams(search.toString());
    params.set("cat", app.cat);
    params.set("tool", app.id);
    router.push(`${pathname}?${params.toString()}`);
  };

  const goHome = () => {
    const params = new URLSearchParams(search.toString());
    params.delete("cat");
    params.delete("tool");
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  // ===== When an app is open: render the app full-bleed + breadcrumb =====
  if (activeApp) {
    const renderer = APP_RENDERERS[activeApp.id];
    return (
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-6 pb-20 space-y-4 min-h-screen flex flex-col">
        <button
          onClick={goHome}
          className="flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[#EF6B00] transition-colors w-fit"
        >
          <ChevronRight size={16}/> חזרה לאפליקציות
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
               style={{
                 background: CATEGORY_META[activeApp.cat].accent + "15",
                 color: CATEGORY_META[activeApp.cat].accent,
               }}>
            {APP_ICONS[activeApp.id]}
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#002649]">{activeApp.title}</h1>
            <p className="text-sm text-slate-500">{activeApp.description}</p>
          </div>
        </div>
        <div className="flex-1 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          {renderer ? renderer() : <div className="p-8 text-slate-400">אפליקציה זמנית אינה זמינה.</div>}
        </div>
      </div>
    );
  }

  // ===== Home view: phone-launcher style grid =====
  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-6 pb-20 space-y-8 min-h-screen">
      <PageHeader
        icon={<Zap size={28} strokeWidth={1.75}/>}
        title="אפליקציות"
        subtitle={`${visibleApps.length} כלים זמינים — לחיצה פותחת, סיכה מצמידה לסיידבר.`}
      />

      {(Object.keys(CATEGORY_META) as CategoryId[]).map(catId => {
        const apps = byCategory[catId];
        if (apps.length === 0) return null;
        const meta = CATEGORY_META[catId];
        return (
          <section key={catId} className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-black text-[#002649]">{meta.title}</h2>
              <span className="text-xs font-bold text-slate-400">{apps.length} אפליקציות</span>
              <div className="flex-1 h-px bg-slate-200"/>
              <span className="text-[11px] text-slate-400">{meta.subtitle}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {apps.map(app => {
                const pinned = isPinned(app.id);
                return (
                  <AppTile
                    key={app.id}
                    app={app}
                    pinned={pinned}
                    onOpen={() => openApp(app)}
                    onTogglePin={() => togglePin(app.id)}
                    accentColor={meta.accent}
                    bgColor={meta.bg}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Admin-only hint about hidden apps */}
      {isAdmin && visibleApps.some(a => a.hidden) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-center gap-2">
          <EyeOff size={14}/>
          אפליקציות מוסתרות מסומנות באייקון עין-עם-קו. מגייסים לא רואים אותן. ניתן לבטל ב-/admin → הגדרות → ניהול אפליקציות.
        </div>
      )}
    </div>
  );
}

// ---- Tile component ----
interface AppTileProps {
  app: EffectiveAppEntry;
  pinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  accentColor: string;
  bgColor: string;
}

function AppTile({ app, pinned, onOpen, onTogglePin, accentColor, bgColor }: AppTileProps) {
  const tag = app.effectiveTag;
  const isDisabled = tag === "coming_soon";
  return (
    <div
      className={`relative group rounded-2xl bg-white border transition-all p-4 flex flex-col items-center text-center gap-2 ${
        app.hidden ? "opacity-50 border-slate-300 border-dashed" : "border-slate-200 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300"
      }`}
    >
      {/* Tag pill — top-left in RTL */}
      {tag && (
        <span className={`absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${TAG_META[tag].bg} ${TAG_META[tag].fg}`}>
          {TAG_META[tag].label}
        </span>
      )}
      {/* Hidden marker (only visible to admins because non-admins don't see hidden apps) */}
      {app.hidden && (
        <span className="absolute top-2 right-2 text-slate-400" title="מוסתר מהמגייסים">
          <EyeOff size={12}/>
        </span>
      )}
      {/* Pin toggle — top-right; visible always so the user can quickly unpin too */}
      <button
        onClick={e => { e.stopPropagation(); onTogglePin(); }}
        className={`absolute top-2 ${app.hidden ? "right-6" : "right-2"} transition-colors p-1 rounded-md ${
          pinned
            ? "text-[#EF6B00] bg-orange-50 hover:bg-orange-100"
            : "text-slate-300 hover:text-slate-600 hover:bg-slate-100"
        }`}
        title={pinned ? "הסר נעיצה" : "הצמד לסיידבר"}
        aria-label={pinned ? "הסר נעיצה" : "הצמד לסיידבר"}
      >
        {pinned ? <Pin size={14} fill="currentColor"/> : <PinOff size={14}/>}
      </button>

      {/* Main click target — fills the tile minus the icon-buttons */}
      <button
        onClick={onOpen}
        className="flex flex-col items-center gap-2 w-full focus:outline-none"
        type="button"
      >
        <div
          className={`w-16 h-16 rounded-2xl ${bgColor} flex items-center justify-center mt-1`}
          style={{ color: accentColor }}
        >
          {APP_ICONS[app.id]}
        </div>
        <div className="font-bold text-sm text-[#002649] leading-tight line-clamp-2">{app.title}</div>
      </button>

      {isDisabled && (
        <div className="text-[10px] text-amber-700 font-bold">בפיתוח — תצוגה מקדימה זמינה</div>
      )}
    </div>
  );
}

