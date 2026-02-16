"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, Clock, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  
  // States למנגנון המיון החדש
  const [sortBy, setSortBy] = useState("days_in_process");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/candidates?page=${page}&limit=20&search=${search}&sort_by=${sortBy}&sort_dir=${sortDir}`);
      const data = await res.json();
      setCandidates(data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCandidates();
    }, 300);
    return () => clearTimeout(timer);
  }, [page, search, sortBy, sortDir]);

  // פונקציה שמטפלת בלחיצה על כותרת הטבלה
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setPage(1);
  };

  // רכיב עזר לציור הכותרת עם החץ
  const SortableHeader = ({ label, column }: { label: string, column: string }) => {
    const isActive = sortBy === column;
    return (
      <th 
        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-2">
          {label}
          <span className={`text-slate-400 ${isActive ? 'text-[#EF6B00]' : 'group-hover:text-slate-600'}`}>
            {isActive ? (sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.5} />}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#002649]">מאגר מועמדים 👥</h1>
          <p className="text-slate-500 mt-1">צפייה ומיון חכם של כלל המועמדים במערכת</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="חיפוש לפי שם, משרה או מגייס..."
              className="w-full pr-10 pl-4 py-2 rounded-lg border border-slate-200 focus:border-[#EF6B00] focus:ring-1 focus:ring-[#EF6B00] outline-none transition-all"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button className="bg-white border border-slate-200 p-2 rounded-lg text-slate-600 hover:bg-slate-50 shadow-sm">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* The Smart Data Grid */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-[#002649] font-bold border-b border-slate-200">
              <tr>
                <SortableHeader label="שם מועמד" column="candidate_name" />
                <SortableHeader label="משרה" column="job_title" />
                <SortableHeader label="סטטוס" column="status" />
                <SortableHeader label="מגייס/ת" column="recruiter" />
                <SortableHeader label="ימים בתהליך" column="days_in_process" />
                <SortableHeader label="מחלקה" column="department" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    לא נמצאו מועמדים התואמים לחיפוש
                  </td>
                </tr>
              ) : (
                candidates.map((c, i) => (
                  <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-[#002649]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                          {c.candidate_name?.charAt(0) || "?"}
                        </div>
                        {c.candidate_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{c.job_title}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap
                        ${c.status?.includes('קליטה') || c.status?.includes('גיוס') ? 'bg-green-100 text-green-700 border border-green-200' : 
                          c.status?.includes('הסרה') || c.status?.includes('דחייה') ? 'bg-red-50 text-red-600 border border-red-100' :
                          'bg-blue-50 text-blue-700 border border-blue-100'
                        }
                      `}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{c.recruiter}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-black ${c.days_in_process > 40 ? 'text-red-600' : 'text-slate-700'}`}>
                          {c.days_in_process}
                        </span>
                        {c.days_in_process > 40 && <Clock size={14} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{c.department}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
          <span className="text-xs font-bold text-slate-500">עמוד {page}</span>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-white disabled:opacity-50 transition-all border border-transparent hover:border-slate-200 text-[#002649]"
            >
              <ChevronRight size={18} />
            </button>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={candidates.length < 20}
              className="p-2 rounded-lg hover:bg-white disabled:opacity-50 transition-all border border-transparent hover:border-slate-200 text-[#002649]"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
