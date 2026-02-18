"use client";

import React, { useState, useMemo } from "react";
import { 
  Briefcase, Search, Download, TrendingUp, TrendingDown,
  LayoutGrid, List, MoreVertical, Mail, Zap, MessageSquare,
  Check, Settings, X, Save, RotateCcw, Info, Calculator, Users
} from "lucide-react";

interface Job {
  id: string; title: string; dept: string; type: string; recruiter: string;
  coordinator: string; openDate: string; status: string; candidates: number;
  activeInProcess: number; newCVsWeek: number; offersSent: number;
  isCritical: boolean; sla: number; prevScore: number; closeDate?: string;
}

interface ScoredJob extends Job { currentScore: number }

interface AlgoConfig {
  baseSLA: Record<string, number>;
  minActive: Record<string, number>;
  criticalPenalty: number; offerBonus: number; pulseBonus: number;
  pipelinePenalty: number; threshold: number;
  overrides: { depts: Record<string, number>; recruiters: Record<string, number>; jobs: Record<string, number> };
}

// --- Mock Data ---
const INITIAL_JOBS = [
  { id: "101", title: "מפתח Backend Java", dept: "R&D", type: "tech", recruiter: "מור אהרון", coordinator: "שירן לוי", openDate: "2026-01-10", status: "open", candidates: 45, activeInProcess: 4, newCVsWeek: 12, offersSent: 0, isCritical: true, sla: 37, prevScore: 65 },
  { id: "101-b", title: "מפתח Backend Java", dept: "R&D", type: "tech", recruiter: "גיא רג'ואן", coordinator: "שירן לוי", openDate: "2025-11-05", status: "closed", closeDate: "2025-12-15", candidates: 12, activeInProcess: 0, newCVsWeek: 0, offersSent: 0, isCritical: false, sla: 40, prevScore: 42 },
  { id: "202", title: "נציג/ת שירות לקוחות", dept: "Service", type: "mass", recruiter: "ליטל גולדפרב", coordinator: "אביב כהן", openDate: "2026-02-01", status: "open", candidates: 150, activeInProcess: 22, newCVsWeek: 40, offersSent: 1, isCritical: false, sla: 15, prevScore: 85 },
  { id: "303", title: "אנליסט נתונים בכיר", dept: "Finance", type: "pro", recruiter: "מור אהרון", coordinator: "שירן לוי", openDate: "2026-01-20", status: "open", candidates: 32, activeInProcess: 4, newCVsWeek: 2, offersSent: 0, isCritical: false, sla: 27, prevScore: 78 },
  { id: "404", title: "מנהל/ת מוצר", dept: "Product", type: "pro", recruiter: "רז בר-און", coordinator: "אביב כהן", openDate: "2025-12-01", status: "closed", closeDate: "2026-01-15", candidates: 85, activeInProcess: 0, newCVsWeek: 0, offersSent: 0, isCritical: false, sla: 45, prevScore: 40 },
  { id: "505", title: "ראש צוות DevOps", dept: "R&D", type: "tech", recruiter: "גיא רג'ואן", coordinator: "שירן לוי", openDate: "2026-02-10", status: "open", candidates: 8, activeInProcess: 3, newCVsWeek: 1, offersSent: 0, isCritical: true, sla: 6, prevScore: 94 },
  { id: "606", title: "ארכיטקט תוכנה", dept: "R&D", type: "tech", recruiter: "גיא רג'ואן", coordinator: "שירן לוי", openDate: "2025-12-01", status: "open", candidates: 12, activeInProcess: 1, newCVsWeek: 0, offersSent: 0, isCritical: true, sla: 80, prevScore: 40 },
];

export default function JobsPage() {
  const [viewMode, setViewMode] = useState("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recruiterFilter, setRecruiterFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showAdmin, setShowAdmin] = useState(false);

  // --- States עבור הוספת פקטור באדמין ---
  const [overrideDept, setOverrideDept] = useState("");
  const [overrideFactor, setOverrideFactor] = useState(1.1);

  // --- הגדרות אלגוריתם ---
  const [algoConfig, setAlgoConfig] = useState<AlgoConfig>({
    baseSLA: { mass: 29, pro: 44, tech: 59 },
    minActive: { mass: 18, pro: 6, tech: 5 },
    criticalPenalty: 20,
    offerBonus: 25,
    pulseBonus: 10,
    pipelinePenalty: 15,
    threshold: 60,
    overrides: { depts: { "Service": 1.1 }, recruiters: {}, jobs: {} }
  });

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setRecruiterFilter("all");
    setDeptFilter("all");
    setSortBy("newest");
  };

  const handleExport = () => {
    const headers = ["ID,Title,Status,Dept,Recruiter,SLA,Candidates,HealthScore\n"];
    const rows = filteredJobs.map(j => `${j.id},${j.title},${j.status},${j.dept},${j.recruiter},${j.sla},${j.candidates},${j.currentScore}%`);
    const blob = new Blob([headers + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Phoenix_TAHub_Jobs.csv";
    link.click();
  };

  // הוספת ומחיקת פקטור באדמין
  const addOverride = () => {
    if (!overrideDept) return;
    setAlgoConfig({
        ...algoConfig,
        overrides: {
            ...algoConfig.overrides,
            depts: { ...algoConfig.overrides.depts, [overrideDept]: overrideFactor }
        }
    });
    setOverrideDept("");
    setOverrideFactor(1.1);
  };

  const removeOverride = (dept: string) => {
    const newDepts = { ...algoConfig.overrides.depts };
    delete newDepts[dept];
    setAlgoConfig({
        ...algoConfig,
        overrides: { ...algoConfig.overrides, depts: newDepts }
    });
  };

  // --- ליבת האלגוריתם (5 פרמטרים) ---
  const calculateHealthScore = (job: Job) => {
    if (job.status === 'closed') return 0;
    let score = 100;
    
    // 1. קנס SLA (2 נק' לכל יום חריגה)
    const limit = algoConfig.baseSLA[job.type] || 30;
    if (job.sla > limit) score -= (job.sla - limit) * 2;
    
    // 2. קנס צינור מועמדים פעיל
    const minNeeded = algoConfig.minActive[job.type] || 5;
    if (job.activeInProcess < minNeeded) score -= algoConfig.pipelinePenalty;
    
    // 3. בונוס דופק קו"ח השבוע
    if (job.newCVsWeek > 10) score += algoConfig.pulseBonus;
    
    // 4. בונוס הצעת חוזה
    if (job.offersSent > 0) score += algoConfig.offerBonus;
    
    // 5. קנס משרה קריטית
    if (job.isCritical) score -= algoConfig.criticalPenalty;
    
    // פקטור החרגות (יחידות ארגוניות)
    const deptFactor = algoConfig.overrides.depts[job.dept] || 1;
    score = score * deptFactor;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getScoreColor = (score: number) => {
    if (score > 80) return "text-green-600 bg-green-50 border-green-100";
    if (score >= algoConfig.threshold) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-red-600 bg-red-50 border-red-100";
  };

  const filteredJobs = useMemo(() => {
    let result = INITIAL_JOBS.map(j => ({ ...j, currentScore: calculateHealthScore(j) }));
    if (searchTerm) result = result.filter(j => j.title.includes(searchTerm) || j.id.includes(searchTerm));
    if (statusFilter !== "all") result = result.filter(j => j.status === statusFilter);
    if (recruiterFilter !== "all") result = result.filter(j => j.recruiter === recruiterFilter);
    if (deptFilter !== "all") result = result.filter(j => j.dept === deptFilter);

    result.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.openDate).getTime() - new Date(a.openDate).getTime();
      if (sortBy === "oldest") return new Date(a.openDate).getTime() - new Date(b.openDate).getTime();
      if (sortBy === "sla_high") return b.sla - a.sla;
      if (sortBy === "sla_low") return a.sla - b.sla;
      if (sortBy === "score_low") return a.currentScore - b.currentScore;
      return 0;
    });
    return result;
  }, [searchTerm, statusFilter, recruiterFilter, deptFilter, sortBy, algoConfig]);

  return (
    <div className="w-full min-h-screen bg-slate-50/30 pb-20 text-right overflow-x-hidden" dir="rtl">
      
      {/* --- Sticky Header --- */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-8 py-6 space-y-6 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
              ניהול משרות ותקנים <Briefcase className="text-[#EF6B00]" size={32} />
            </h1>
            <p className="text-slate-500 mt-2 font-medium italic">הצלבת נתוני ATS (פתוחות) מול דוח קליטות (סגורות) + דירוג בריאות חכם</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAdmin(true)} className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-[#EF6B00] transition-all shadow-sm flex items-center gap-2 font-bold text-sm">
                <Settings size={18} /> הגדרות אלגוריתם
            </button>
            <button onClick={resetFilters} className="p-2.5 text-slate-400 hover:text-red-500 transition-all font-bold text-sm flex items-center gap-1 bg-slate-50 rounded-xl border border-transparent hover:border-red-100">
                <RotateCcw size={16} /> נקה
            </button>
            <div className="flex bg-white border rounded-xl p-1 shadow-sm mx-1">
                <button onClick={() => setViewMode("table")} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-[#002649] text-white' : 'text-slate-400'}`}><List size={18} /></button>
                <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#002649] text-white' : 'text-slate-400'}`}><LayoutGrid size={18} /></button>
            </div>
            <button onClick={handleExport} className="bg-[#002649] text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#EF6B00] transition-all shadow-lg">
                <Download size={18} /> ייצוא רשימה
            </button>
          </div>
        </div>

        {/* --- סרגל סינון --- */}
        <div className="max-w-[1600px] mx-auto bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="חפש משרה או קוד..." className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#EF6B00] text-sm font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <select className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">כל הסטטוסים</option>
              <option value="open">🟢 משרות פתוחות</option>
              <option value="closed">⚪ משרות שנסגרו</option>
            </select>
            <select className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none" value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)}>
              <option value="all">כל המגייסים</option>
              {Array.from(new Set(INITIAL_JOBS.map(j => j.recruiter))).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="all">כל החטיבות</option>
              {Array.from(new Set(INITIAL_JOBS.map(j => j.dept))).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="bg-[#002649] text-white p-2.5 rounded-xl text-sm font-bold outline-none cursor-pointer" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">📅 הכי חדש</option>
              <option value="oldest">⌛ הכי ישן</option>
              <option value="sla_high">🔥 SLA גבוה (חריגה)</option>
              <option value="score_low">❤️ משרות "חולות" תחילה</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        {viewMode === "table" ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm min-w-full">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase whitespace-nowrap">מזהה & משרה</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">סטטוס</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">בריאות (Score)</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase whitespace-nowrap">חטיבה</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase whitespace-nowrap">צוות גיוס</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase whitespace-nowrap">תאריך פתיחה</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">SLA נוכחי</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">מועמדים</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center whitespace-nowrap">פעולות AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-black text-[#002649] text-sm group-hover:text-[#EF6B00] transition-colors whitespace-nowrap">{job.title}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {job.id}</div>
                    </td>
                    
                    {/* צבע אפור לסטטוס סגורה */}
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${job.status === 'open' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {job.status === 'open' ? 'פתוחה' : 'סגורה'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      {job.status === 'open' ? (
                          <div className="flex flex-col items-center gap-1">
                              <div className={`px-2.5 py-0.5 rounded-lg font-black text-xs border ${getScoreColor(job.currentScore)}`}>
                                  {job.currentScore}%
                              </div>
                              <div className="flex items-center gap-1 text-[9px] font-bold">
                                  {job.currentScore >= job.prevScore ? <TrendingUp size={10} className="text-green-500"/> : <TrendingDown size={10} className="text-red-500"/>}
                                  <span className={job.currentScore >= job.prevScore ? 'text-green-600' : 'text-red-600'}>{Math.abs(job.currentScore - job.prevScore)}%</span>
                              </div>
                          </div>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-600 text-sm whitespace-nowrap">{job.dept}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-[#002649] border border-slate-200">
                            {job.recruiter.substring(0,2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-700">{job.recruiter}</div>
                          <div className="text-[10px] text-slate-400">רכז/ת: {job.coordinator}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-500 whitespace-nowrap">{job.openDate}</td>
                    <td className="px-6 py-4 text-center">
                      <div className={`text-sm font-black whitespace-nowrap ${job.sla > 30 ? 'text-red-500' : 'text-[#002649]'}`}>
                        {job.sla} ימים
                      </div>
                      <div className="w-20 bg-slate-100 h-1.5 rounded-full mt-1.5 mx-auto overflow-hidden">
                        <div className={`h-full ${job.sla > 30 ? 'bg-red-500' : 'bg-[#EF6B00]'}`} style={{ width: `${Math.min(job.sla * 2.5, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-black shadow-sm border border-blue-100">
                        <Users size={12} /> {job.candidates}
                      </div>
                      {job.status === 'open' && (
                          <div className="text-[9px] text-slate-400 font-bold mt-1">מתוכם {job.activeInProcess} פעילים</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center relative">
                      <ConditionalAction job={job} threshold={algoConfig.threshold} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredJobs.filter(j => j.status === 'open').map(job => (
              <div key={job.id} className={`bg-white rounded-[2rem] p-6 border-2 shadow-sm relative group transition-all ${job.currentScore < algoConfig.threshold ? 'border-red-100' : 'border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-4">
                      <div className={`text-2xl font-black p-3 rounded-2xl border ${getScoreColor(job.currentScore)}`}>{job.currentScore}%</div>
                      <ConditionalAction job={job} threshold={algoConfig.threshold} isGrid={true} />
                  </div>
                  <h3 className="font-black text-[#002649] text-lg">{job.title}</h3>
                  <div className="flex items-center gap-2 mt-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-[#002649] border border-slate-200">{job.recruiter.substring(0,2)}</div>
                    <p className="text-slate-500 text-xs font-bold">{job.dept} | {job.recruiter}</p>
                  </div>
                  <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-500">SLA נוכחי:</span>
                          <span className={job.sla > 30 ? 'text-red-500' : 'text-[#002649]'}>{job.sla} ימים</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-500">מועמדים (פעילים):</span>
                          <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1"><Users size={10}/> {job.candidates} ({job.activeInProcess})</span>
                      </div>
                  </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Admin Modal --- */}
      {showAdmin && (
        <div className="fixed inset-0 bg-[#002649]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 duration-300 my-8">
                <div className="flex justify-between items-start mb-8 border-b pb-6 border-slate-100">
                    <div>
                        <h2 className="text-3xl font-black text-[#002649] flex items-center gap-3"><Settings className="text-[#EF6B00]"/> שליטה בליבת האלגוריתם</h2>
                        <p className="text-slate-400 font-bold mt-1">עדכון פרמטרים גלובליים והחרגות פרטניות (TAHub Admin)</p>
                    </div>
                    <button onClick={() => setShowAdmin(false)} className="p-3 bg-slate-50 rounded-full hover:bg-slate-100 transition-all"><X size={24}/></button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 text-right">
                    
                    {/* צד א' - הסבר הנוסחא והפקטורים */}
                    <div className="space-y-6">
                        <h3 className="font-black text-lg text-[#002649] flex items-center gap-2 underline decoration-[#EF6B00] decoration-4 underline-offset-8">
                            <Calculator size={20} /> נוסחת חישוב בריאות המשרה
                        </h3>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                            <p className="text-sm font-bold text-slate-600 mb-4">ציון הבסיס הוא 100%. האלגוריתם משקלל את 5 הפרמטרים הבאים:</p>
                            <ul className="space-y-3 text-xs font-bold text-slate-700">
                                <li className="flex gap-2"><span className="text-red-500 shrink-0">1. SLA:</span> הפחתה של 2 נקודות על כל יום שחורג מהיעד המוגדר.</li>
                                <li className="flex gap-2"><span className="text-red-500 shrink-0">2. פייפליין חסר:</span> הפחתה של {algoConfig.pipelinePenalty} נק' אם כמות הפעילים קטנה מהמינימום.</li>
                                <li className="flex gap-2"><span className="text-green-600 shrink-0">3. דופק השבוע:</span> תוספת של {algoConfig.pulseBonus} נק' אם התקבלו מעל 10 קו"ח השבוע.</li>
                                <li className="flex gap-2"><span className="text-green-600 shrink-0">4. הצעת חוזה:</span> תוספת של {algoConfig.offerBonus} נק' אם יש מועמד בשלב הצעה.</li>
                                <li className="flex gap-2"><span className="text-red-500 shrink-0">5. משרה קריטית:</span> הפחתה אוטומטית של {algoConfig.criticalPenalty} נק' למשרות רגישות.</li>
                            </ul>
                            <div className="mt-4 pt-4 border-t border-slate-200 text-[10px] text-slate-400 italic">
                                * לאחר השקלול, ניתן להכפיל בפקטור החרגה חטיבתי. ציון סופי נשמר בטווח של 0-100.
                            </div>
                        </div>

                        {/* הגדרת חריגות ופקטורים - הוחזר במלואו! */}
                        <h3 className="font-black text-lg text-[#002649] mt-8 flex items-center gap-2 underline decoration-[#EF6B00] decoration-4 underline-offset-8">החרגות ופקטורים חטיבתיים</h3>
                        <div className="space-y-5">
                            <div>
                                <label htmlFor="threshold-input" className="text-xs font-black text-slate-400 block mb-2">סף התראה (מתחת לציון זה המשרה נחשבת &apos;חולה&apos;)</label>
                                <input id="threshold-input" type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 ring-[#EF6B00]/20 outline-none" value={algoConfig.threshold} onChange={(e) => setAlgoConfig({...algoConfig, threshold: Number(e.target.value)})} />
                            </div>
                            
                            <div className="border border-slate-200 p-4 rounded-2xl bg-white shadow-sm space-y-4">
                                <label htmlFor="override-dept" className="text-xs font-black text-slate-400 block">הוסף פקטור (למשל: Service, 1.1)</label>
                                <div className="flex gap-2">
                                    <input id="override-dept" type="text" placeholder="שם חטיבה (למשל: Service)" className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm focus:ring-2 ring-[#EF6B00]/20 outline-none" value={overrideDept} onChange={(e) => setOverrideDept(e.target.value)} />
                                    <input type="number" step="0.1" placeholder="פקטור" className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm text-center focus:ring-2 ring-[#EF6B00]/20 outline-none" value={overrideFactor} onChange={(e) => setOverrideFactor(Number(e.target.value))} />
                                    <button onClick={addOverride} className="bg-[#002649] text-white px-4 rounded-lg font-bold text-xs hover:bg-[#EF6B00] transition-colors">הוסף</button>
                                </div>
                                
                                {/* הצגת הפקטורים הפעילים */}
                                {Object.keys(algoConfig.overrides.depts).length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                                        {Object.entries(algoConfig.overrides.depts).map(([dept, factor]) => (
                                            <div key={dept} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-black border border-blue-100">
                                                <span>{dept}: {factor}x</span>
                                                <button onClick={() => removeOverride(dept)} className="text-blue-400 hover:text-red-500 transition-colors"><X size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3 text-amber-700">
                                <Info size={20} className="shrink-0" />
                                <p className="text-xs font-bold leading-relaxed">שינוי הפקטור משפיע על הציון הסופי באופן יחסי. פקטור של 1.1 מגדיל את הציון ב-10%, פקטור של 0.9 מקשיח אותו.</p>
                            </div>
                        </div>
                    </div>

                    {/* צד ב' - שליטה בפרמטרים */}
                    <div className="space-y-6">
                        <h3 className="font-black text-lg text-[#002649] flex items-center gap-2 underline decoration-[#EF6B00] decoration-4 underline-offset-8">יעדי SLA ומועמדים</h3>
                        <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-200">
                            {['mass', 'pro', 'tech'].map(type => (
                                <div key={type} className="grid grid-cols-3 gap-4 items-center border-b border-slate-200 pb-3 last:border-0">
                                    <span className="text-xs font-black uppercase text-slate-400">{type === 'mass' ? 'מסה' : type === 'pro' ? 'מקצועי' : 'טכנולוגי'}</span>
                                    <div>
                                        <label htmlFor={`sla-${type}`} className="text-[10px] font-bold block mb-1">SLA יעד</label>
                                        <input id={`sla-${type}`} type="number" className="w-full bg-white border border-slate-200 p-2.5 rounded-xl font-bold text-sm focus:ring-2 ring-[#EF6B00]/20 outline-none" value={algoConfig.baseSLA[type]} onChange={(e) => setAlgoConfig({ ...algoConfig, baseSLA: {...algoConfig.baseSLA, [type]: Number.parseInt(e.target.value)} })} />
                                    </div>
                                    <div>
                                        <label htmlFor={`min-${type}`} className="text-[10px] font-bold block mb-1">מינימום פעילים</label>
                                        <input id={`min-${type}`} type="number" className="w-full bg-white border border-slate-200 p-2.5 rounded-xl font-bold text-sm focus:ring-2 ring-[#EF6B00]/20 outline-none" value={algoConfig.minActive[type]} onChange={(e) => setAlgoConfig({ ...algoConfig, minActive: {...algoConfig.minActive, [type]: Number.parseInt(e.target.value)} })} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-slate-100">
                    <button onClick={() => setShowAdmin(false)} className="w-full py-5 bg-[#002649] text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-[#EF6B00] transition-all shadow-xl shadow-blue-900/20 text-lg">
                        <Save size={24}/> שמור הגדרות מערכת והחל על כל המשרות
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// --- רכיב פעולות כולל חיבור לאאוטלוק ובלי פס גלילה ---
function ConditionalAction({ job, threshold, isGrid = false }: Readonly<{ job: ScoredJob; threshold: number; isGrid?: boolean }>) {
  const [open, setOpen] = useState(false);
  const isNeedsAction = job.status === 'open' && job.currentScore < threshold;

  // פונקציה לפתיחת האאוטלוק
  const handleMailToManager = () => {
    const subject = encodeURIComponent(`עדכון סטטוס חשוב: משרת ${job.title} (ID: ${job.id})`);
    const body = encodeURIComponent(
      `היי,\n\nמערכת TAHub מזהה כי משרת ${job.title} דורשת את תשומת ליבנו.\n\n` +
      `נתונים נוכחיים:\n` +
      `- ימים באוויר (SLA): ${job.sla} ימים\n` +
      `- מדד בריאות המשרה: ${job.currentScore}%\n` +
      `- מועמדים פעילים: ${job.activeInProcess}\n\n` +
      `אשמח אם נוכל לתאם שיחה קצרה בקרוב כדי לבחון כיצד לקדם את הגיוס, האם נדרש דיוק בפרופיל או תגבור מקורות.\n\n` +
      `בברכה,\n${job.recruiter}`
    );
    globalThis.location.href = `mailto:?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  if (!isNeedsAction) {
    return (
      <div className="flex items-center justify-center text-green-500 bg-green-50 w-8 h-8 rounded-full mx-auto border border-green-100 shadow-inner">
        <Check size={16} strokeWidth={3} />
      </div>
    );
  }

  // הפתרון לפס הגלילה: שימוש ב- right-0 כדי לפתוח פנימה
  return (
    <div className={`relative ${isGrid ? '' : 'flex justify-center'}`}>
      <button 
        onClick={() => setOpen(!open)} 
        className="w-10 h-10 bg-red-50 text-red-600 rounded-2xl border border-red-100 hover:bg-red-100 transition-all flex items-center justify-center animate-bounce-subtle shadow-sm relative z-10"
      >
        <MoreVertical size={20} />
      </button>
      
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}></div>
          <div className={`absolute z-50 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 
            ${isGrid ? 'top-full mt-2 right-0' : 'bottom-full mb-2 right-0'}`}>
              <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase border-b border-slate-50 mb-1 text-right">המלצות AI מגייסת</div>
              
              {/* כפתור חיבור לאאוטלוק */}
              <button onClick={handleMailToManager} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors group text-right">
                  <Mail size={16} className="text-blue-500" />
                  <span className="text-xs font-black text-slate-700">שלח מייל למנהל מגייס</span>
              </button>
              
              <button onClick={() => setOpen(false)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors group text-right">
                  <Zap size={16} className="text-amber-500" />
                  <span className="text-xs font-black text-slate-700">בקש תגבור מקורות</span>
              </button>
              
              <button onClick={() => setOpen(false)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors group text-right">
                  <MessageSquare size={16} className="text-red-500" />
                  <span className="text-xs font-black text-slate-700">קבע שיחת סטטוס</span>
              </button>
          </div>
        </>
      )}
    </div>
  );
}