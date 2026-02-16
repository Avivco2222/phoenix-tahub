"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, Clock, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// --- MOCK DATA FOR DEMO ---
const MOCK_CANDIDATES = [
  { id: 1, candidate_name: "דניאל כהן", job_title: "מפתח Backend Java", status: "ראיון HR", recruiter: "מור אהרון", days_in_process: 14, department: "R&D" },
  { id: 2, candidate_name: "שיר גולן", job_title: "נציג/ת מכירות", status: "ראיון טלפוני", recruiter: "גיא רג'ואן", days_in_process: 5, department: "Sales & Service" },
  { id: 3, candidate_name: "אלכס רובין", job_title: "אנליסט נתונים", status: "ראיון ממליצים", recruiter: "ליטל גולדפרב", days_in_process: 46, department: "Finance" },
  { id: 4, candidate_name: "מיכל אהרוני", job_title: "מנהל/ת מוצר", status: "ראיון ממליצים", recruiter: "רז בר-און", days_in_process: 22, department: "R&D" },
  { id: 5, candidate_name: "עומר לוי", job_title: "ראש צוות R&D", status: "הצעת שכר", recruiter: "מור אהרון", days_in_process: 28, department: "R&D" },
  { id: 6, candidate_name: "נועה שור", job_title: "מפתח Backend Java", status: "קליטה בארגון", recruiter: "גיא רג'ואן", days_in_process: 35, department: "R&D" },
  { id: 7, candidate_name: "יובל דותן", job_title: "נציג/ת מכירות", status: "דחייה - שכר", recruiter: "רז בר-און", days_in_process: 12, department: "Sales & Service" },
  { id: 8, candidate_name: "עידו פלג", job_title: "אנליסט נתונים", status: "מבחן מקצועי", recruiter: "ליטל גולדפרב", days_in_process: 19, department: "Finance" },
  { id: 9, candidate_name: "טליה קליין", job_title: "מפתח Backend Java", status: "ראיון מקצועי 2", recruiter: "מור אהרון", days_in_process: 42, department: "R&D" },
  { id: 10, candidate_name: "אריאל בן דוד", job_title: "מנהל/ת מוצר", status: "קליטה בארגון", recruiter: "אביב כהן", days_in_process: 18, department: "R&D" },
  { id: 11, candidate_name: "רועי גבע", job_title: "נציג/ת מכירות", status: "קורות חיים", recruiter: "גיא רג'ואן", days_in_process: 2, department: "Sales & Service" },
  { id: 12, candidate_name: "הדר מנור", job_title: "מפתח Backend Java", status: "ראיון טלפוני", recruiter: "מור אהרון", days_in_process: 8, department: "R&D" },
  { id: 13, candidate_name: "יותם הראל", job_title: "ראש צוות R&D", status: "דחייה - מקצועית", recruiter: "אביב כהן", days_in_process: 55, department: "R&D" },
  { id: 14, candidate_name: "מאיה כץ", job_title: "נציג/ת מכירות", status: "קליטה בארגון", recruiter: "גיא רג'ואן", days_in_process: 15, department: "Sales & Service" },
  { id: 15, candidate_name: "גיא עמר", job_title: "אנליסט נתונים", status: "הסרת מועמדות", recruiter: "ליטל גולדפרב", days_in_process: 30, department: "Finance" },
  { id: 16, candidate_name: "ליאור פרידמן", job_title: "מפתח Backend Java", status: "ראיון HR", recruiter: "רז בר-און", days_in_process: 11, department: "R&D" },
  { id: 17, candidate_name: "סתיו קורן", job_title: "מנהל/ת מוצר", status: "מבחן מקצועי", recruiter: "מור אהרון", days_in_process: 25, department: "R&D" },
  { id: 18, candidate_name: "איתי שחר", job_title: "נציג/ת מכירות", status: "ראיון HR", recruiter: "גיא רג'ואן", days_in_process: 6, department: "Sales & Service" },
  { id: 19, candidate_name: "נוגה אלון", job_title: "מפתח Backend Java", status: "הצעת שכר", recruiter: "רז בר-און", days_in_process: 21, department: "R&D" },
  { id: 20, candidate_name: "רון דביר", job_title: "אנליסט נתונים", status: "ראיון טלפוני", recruiter: "ליטל גולדפרב", days_in_process: 4, department: "Finance" }
];

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("days_in_process");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // פונקציית סימולציה שמחליפה את קריאת השרת
  const fetchMockCandidates = () => {
    setLoading(true);
    
    setTimeout(() => {
      // 1. חיפוש
      let filtered = MOCK_CANDIDATES.filter(c => 
        c.candidate_name.includes(search) || 
        c.job_title.includes(search) || 
        c.recruiter.includes(search)
      );

      // 2. מיון
      filtered = filtered.sort((a: any, b: any) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        
        if (typeof valA === 'string') {
          return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortDir === "asc" ? valA - valB : valB - valA;
      });

      // מעדכנים את הסטייט עם הנתונים המעובדים
      setCandidates(filtered);
      setLoading(false);
    }, 400); // השהייה קלה לתחושת טעינה אמיתית
  };

  useEffect(() => {
    fetchMockCandidates();
  }, [page, search, sortBy, sortDir]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  const SortableHeader = ({ label, column }: { label: string, column: string }) => {
    const isActive = sortBy === column;
    return (
      <th 
        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group select-none text-right"
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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto px-2 md:px-6">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#002649]">מאגר מועמדים 👥</h1>
          <p className="text-slate-500 mt-1 font-medium">צפייה ומיון חכם של כלל המועמדים במערכת (Demo Mode)</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80 shadow-sm">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="חיפוש מועמד, משרה או מגייסת..."
              className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-200 focus:border-[#EF6B00] focus:ring-1 focus:ring-[#EF6B00] outline-none transition-all font-medium text-sm text-[#002649]"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button className="bg-white border border-slate-200 p-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-[#EF6B00] transition-colors shadow-sm">
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* The Smart Data Grid */}
      <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#002649] text-white font-bold border-b border-slate-200 text-xs uppercase tracking-wider">
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
                    <td colSpan={6} className="px-6 py-6">
                      <div className="h-4 bg-slate-100 rounded-full w-full"></div>
                    </td>
                  </tr>
                ))
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-bold">
                    לא נמצאו מועמדים התואמים לחיפוש
                  </td>
                </tr>
              ) : (
                candidates.map((c, i) => (
                  <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-6 py-4 font-black text-[#002649]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black text-xs shrink-0 shadow-sm border border-blue-200">
                          {c.candidate_name?.charAt(0) || "?"}
                        </div>
                        {c.candidate_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{c.job_title}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm
                        ${c.status?.includes('קליטה') || c.status?.includes('גיוס') ? 'bg-green-100 text-green-700 border border-green-200' : 
                          c.status?.includes('הסרה') || c.status?.includes('דחייה') ? 'bg-red-50 text-red-600 border border-red-100' :
                          c.status?.includes('הצעת שכר') ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                          'bg-blue-50 text-blue-700 border border-blue-100'
                        }
                      `}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-bold">{c.recruiter}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-black ${c.days_in_process > 40 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100' : 'text-[#002649]'}`}>
                          {c.days_in_process}
                        </span>
                        {c.days_in_process > 40 && <Clock size={14} className="text-red-500 animate-pulse" title="מועמד חורג מ-SLA" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-bold">{c.department}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
          <span className="text-xs font-bold text-slate-500">מציג {candidates.length} מועמדים</span>
          <div className="flex gap-2">
            <button 
              disabled={true}
              className="p-2 rounded-lg bg-white disabled:opacity-40 transition-all border border-slate-200 text-[#002649] shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
            <button 
              disabled={true}
              className="p-2 rounded-lg bg-white disabled:opacity-40 transition-all border border-slate-200 text-[#002649] shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}