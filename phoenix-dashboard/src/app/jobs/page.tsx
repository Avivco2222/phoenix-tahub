"use client";

import React, { useState, useMemo } from "react";
import { 
  Briefcase, Search, Filter, ArrowUpDown, 
  CheckCircle2, Clock, Users, Building2, 
  Calendar, UserCheck, ChevronDown, Download
} from "lucide-react";

// --- Mock Data מורחב המדמה הצלבה בין דוחות ---
const INITIAL_JOBS = [
  { id: "101", title: "מפתח Backend Java", dept: "R&D", recruiter: "מור אהרון", coordinator: "שירן לוי", openDate: "2026-01-10", status: "open", candidates: 45, sla: 37 },
  { id: "101", title: "מפתח Backend Java", dept: "R&D", recruiter: "גיא רג'ואן", coordinator: "שירן לוי", openDate: "2025-11-05", status: "closed", closeDate: "2025-12-15", candidates: 12, sla: 40 },
  { id: "202", title: "נציג/ת שירות לקוחות", dept: "Service", recruiter: "ליטל גולדפרב", coordinator: "אביב כהן", openDate: "2026-02-01", status: "open", candidates: 150, sla: 15 },
  { id: "303", title: "אנליסט נתונים בכיר", dept: "Finance", recruiter: "מור אהרון", coordinator: "שירן לוי", openDate: "2026-01-20", status: "open", candidates: 32, sla: 27 },
  { id: "404", title: "מנהל/ת מוצר", dept: "Product", recruiter: "רז בר-און", coordinator: "אביב כהן", openDate: "2025-12-01", status: "closed", closeDate: "2026-01-15", candidates: 85, sla: 45 },
  { id: "505", title: "ראש צוות DevOps", dept: "R&D", recruiter: "גיא רג'ואן", coordinator: "שירן לוי", openDate: "2026-02-10", status: "open", candidates: 8, sla: 6 },
];

export default function JobsPage() {
  // --- States לסינון ומיון ---
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, open, closed
  const [recruiterFilter, setRecruiterFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, sla_high, sla_low

  // --- לוגיקת סינון ומיון ---
  const filteredJobs = useMemo(() => {
    let result = [...INITIAL_JOBS];

    if (searchTerm) {
      result = result.filter(j => j.title.includes(searchTerm) || j.id.includes(searchTerm));
    }
    if (statusFilter !== "all") {
      result = result.filter(j => j.status === statusFilter);
    }
    if (recruiterFilter !== "all") {
      result = result.filter(j => j.recruiter === recruiterFilter);
    }
    if (deptFilter !== "all") {
      result = result.filter(j => j.dept === deptFilter);
    }

    // מיון
    result.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.openDate).getTime() - new Date(a.openDate).getTime();
      if (sortBy === "oldest") return new Date(a.openDate).getTime() - new Date(b.openDate).getTime();
      if (sortBy === "sla_high") return b.sla - a.sla;
      if (sortBy === "sla_low") return a.sla - b.sla;
      return 0;
    });

    return result;
  }, [searchTerm, statusFilter, recruiterFilter, deptFilter, sortBy]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
            ניהול משרות ותקנים <Briefcase className="text-[#EF6B00]" size={32} />
          </h1>
          <p className="text-slate-500 mt-2 font-medium italic">הצלבת נתוני ATS (פתוחות) מול דוח קליטות (סגורות)</p>
        </div>
        <button className="bg-[#002649] text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#EF6B00] transition-all shadow-lg">
          <Download size={18} /> ייצוא רשימה
        </button>
      </div>

      {/* --- סרגל סינון מתקדם --- */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* חיפוש חופשי */}
          <div className="relative lg:col-span-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="חפש משרה או קוד..." 
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#EF6B00] text-sm font-bold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* סטטוס משרה */}
          <select 
            className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">כל הסטטוסים</option>
            <option value="open">🟢 משרות פתוחות</option>
            <option value="closed">🔴 משרות שנסגרו (קליטה)</option>
          </select>

          {/* מגייס/ת */}
          <select 
            className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none"
            value={recruiterFilter}
            onChange={(e) => setRecruiterFilter(e.target.value)}
          >
            <option value="all">כל המגייסים</option>
            <option value="מור אהרון">מור אהרון</option>
            <option value="גיא רג'ואן">גיא רג'ואן</option>
            <option value="ליטל גולדפרב">ליטל גולדפרב</option>
          </select>

          {/* יחידה ארגונית */}
          <select 
            className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold outline-none"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">כל החטיבות</option>
            <option value="R&D">R&D</option>
            <option value="Service">שירות</option>
            <option value="Finance">כספים</option>
          </select>

          {/* מיון */}
          <select 
            className="bg-[#002649] text-white p-2.5 rounded-xl text-sm font-bold outline-none cursor-pointer"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">📅 הכי חדש</option>
            <option value="oldest">⌛ הכי ישן</option>
            <option value="sla_high">🔥 SLA גבוה (חריגה)</option>
            <option value="sla_low">⚡ SLA נמוך (מהיר)</option>
          </select>
        </div>
      </div>

      {/* --- טבלת המשרות --- */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">מזהה & משרה</th>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center">סטטוס</th>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">חטיבה</th>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">צוות גיוס</th>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">תאריך פתיחה</th>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center">SLA נוכחי</th>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center">מועמדים</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredJobs.map((job, idx) => (
              <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-black text-[#002649] text-sm group-hover:text-[#EF6B00] transition-colors">{job.title}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {job.id}</div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    job.status === 'open' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
                  }`}>
                    {job.status === 'open' ? 'פתוחה' : 'סגורה (קליטה)'}
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-slate-600 text-sm">{job.dept}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-[#002649]">{job.recruiter.substring(0,2)}</div>
                    <div>
                      <div className="text-xs font-bold text-slate-700">{job.recruiter}</div>
                      <div className="text-[10px] text-slate-400">רכז/ת: {job.coordinator}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-500">{job.openDate}</td>
                <td className="px-6 py-4 text-center">
                  <div className={`text-sm font-black ${job.sla > 30 ? 'text-red-500' : 'text-[#002649]'}`}>
                    {job.sla} ימים
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full ${job.sla > 30 ? 'bg-red-500' : 'bg-[#EF6B00]'}`} style={{ width: `${Math.min(job.sla * 2.5, 100)}%` }} />
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black shadow-sm">
                    <Users size={12} /> {job.candidates}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredJobs.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <Briefcase size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold text-lg">לא נמצאו משרות העונות לסינון הנבחר</p>
          </div>
        )}
      </div>
    </div>
  );
}