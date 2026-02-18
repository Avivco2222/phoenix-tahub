"use client";

import React, { useState } from "react";
import { 
  Users, Search, Briefcase, Plus, UserCheck, 
  Clock, XCircle, CheckCircle2, Edit3, Trash2,
  Lock, CheckSquare, Save, Settings,
  Car, Smartphone, Coffee, Download, Send, UserMinus, UserCheck2, Loader2
} from "lucide-react";

// --- Types ---
interface OnboardingRecord {
  id: string;
  name: string;
  id_num: string;
  role: string;
  department: string;
  manager: string;
  start_date: string;
  has_car?: boolean;
  parking_type?: string;
  car_num: string;
  has_mobile?: boolean;
  has_cibus?: boolean;
  is_referral?: boolean;
  referral_name: string;
  referral_id: string;
  diversity: string;
  status: "pending" | "completed" | "cancelled" | "left_company"; // הוספנו סטטוס עזיבה
  created_at: string;
}

const MOCK_DATA: OnboardingRecord[] = [
  { id: "1", name: "דניאל כהן", id_num: "034567891", role: "מפתח Backend", department: "חטיבת טכנולוגיות", manager: "אביב", start_date: "2026-03-01", has_car: false, parking_type: "בזכאות", car_num: "123-45-678", has_mobile: true, has_cibus: true, is_referral: true, referral_name: "ישראל ישראלי", referral_id: "12345", diversity: "", status: "pending", created_at: "2026-02-18" },
  { id: "2", name: "מיכל אהרוני", id_num: "204958321", role: "מנהלת פרויקטים", department: "מטה", manager: "שלי", start_date: "2026-02-25", has_car: true, parking_type: "בזכאות", car_num: "", has_mobile: true, has_cibus: true, is_referral: false, referral_name: "", referral_id: "", diversity: "עמותת שווים", status: "pending", created_at: "2026-02-15" },
  { id: "3", name: "ירון לוי", id_num: "023459812", role: "אנליסט נתונים", department: "פיננסים", manager: "מרסל", start_date: "2026-01-01", has_car: false, parking_type: "לא", car_num: "", has_mobile: false, has_cibus: true, is_referral: false, referral_name: "", referral_id: "", diversity: "", status: "completed", created_at: "2025-11-10" },
  { id: "4", name: "שירן גבאי", id_num: "305847129", role: "מגייסת בכירה", department: "משאבי אנוש", manager: "אביב", start_date: "2026-02-10", has_car: false, parking_type: "ללא זכאות", car_num: "888-22-333", has_mobile: true, has_cibus: true, is_referral: true, referral_name: "בת-אל", referral_id: "99988", diversity: "קרבה משפחתית", status: "completed", created_at: "2026-01-20" },
  { id: "5", name: "רועי פלד", id_num: "049384722", role: "איש סיסטם", department: "חטיבת טכנולוגיות", manager: "נדב", start_date: "2025-08-15", has_car: false, parking_type: "בזכאות", car_num: "55-666-77", has_mobile: true, has_cibus: false, is_referral: false, referral_name: "", referral_id: "", diversity: "", status: "left_company", created_at: "2025-07-01" },
  { id: "6", name: "נועה כרמל", id_num: "228374611", role: "רפרנטית שירות", department: "שירות לקוחות", manager: "דנה", start_date: "2026-03-15", has_car: false, parking_type: "לא", car_num: "", has_mobile: false, has_cibus: true, is_referral: false, referral_name: "", referral_id: "", diversity: "חברה ערבית", status: "pending", created_at: "2026-02-19" }
];

export default function CandidatesPage() {
  // --- Global States ---
  const [activeTab, setActiveTab] = useState<"pipeline" | "preboarding" | "active" | "archive">("preboarding");
  const [userRole, setUserRole] = useState<"recruiter" | "admin">("admin"); 
  
  // --- Data States ---
  const [onboardings, setOnboardings] = useState<OnboardingRecord[]>(MOCK_DATA);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof OnboardingRecord, direction: 'asc' | 'desc' }>({ key: 'start_date', direction: 'asc' });

  // --- Modals State ---
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OnboardingRecord | null>(null);

  // --- Checklist State ---
  const [showChecklist, setShowChecklist] = useState<string | null>(null);
  const [tasks, setTasks] = useState([
    { id: 1, text: 'ביצוע "יועסקו" ב-SAP', done: false },
    { id: 2, text: 'סגירת משרה במערכת EC', done: false },
    { id: 3, text: 'וידוא הסרת פרסומים (נילוסופט/לינקדאין)', done: false },
    { id: 4, text: 'שליחת שאלון עובד חדש (HRO)', done: false },
    { id: 5, text: 'וידוא כתובת ותאריך תחילה בנילוסופט', done: false }
  ]);
  const [isEditingTasks, setIsEditingTasks] = useState(false);

  // --- Sorting & Filtering ---
  const handleSort = (key: keyof OnboardingRecord) => {
    setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
  };

  const filteredAndSortedData = [...onboardings]
    .filter(r => {
      if (activeTab === 'preboarding') return r.status === 'pending';
      if (activeTab === 'active') return r.status === 'completed' || r.status === 'left_company';
      if (activeTab === 'archive') return true; // הכל מהכל
      return false; // pipeline handled separately
    })
    .filter(r => r.name.includes(searchTerm) || r.role.includes(searchTerm) || r.department.includes(searchTerm) || r.id_num.includes(searchTerm))
    .sort((a: any, b: any) => {
      if (!sortConfig || !sortConfig.key) {
        return 0;
      }
      const key = sortConfig.key;
      const direction = sortConfig.direction;
      const valA = a[key] ?? "";
      const valB = b[key] ?? "";
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  // --- Actions ---
  const updateStatus = (id: string, newStatus: "completed" | "cancelled" | "left_company") => {
    // In real app: fetch to backend. Here we update the local mock state.
    setOnboardings(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  const exportToExcel = () => {
    const headers = "שם מלא,תעודת זהות,תפקיד,יחידה,מנהל ישיר,תאריך תחילה,זכאות רכב,סוג חניה,מספר רכב,נייד,סיבוס,סטטוס\n";
    const rows = filteredAndSortedData.map(r => 
      `${r.name},${r.id_num},${r.role},${r.department},${r.manager},${r.start_date},${r.has_car ? 'כן':'לא'},${r.parking_type},${r.car_num},${r.has_mobile ? 'כן':'לא'},${r.has_cibus ? 'כן':'לא'},${r.status}`
    ).join("\n");
    
    // הוספת BOM כדי שהאקסל יקרא עברית תקינה
    const blob = new Blob(["\ufeff" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Phoenix_Candidates_Report_${activeTab}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-4 pt-6">
      
      {/* Header & Role Switcher */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
            ניהול מועמדים <Users className="text-[#EF6B00]" size={32} />
          </h1>
          <p className="text-slate-500 mt-2 font-medium">ניהול משפך הגיוס, טרום קליטה, ועובדים שנקלטו בארגון.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-500">תצוגה כ:</span>
          <select value={userRole} onChange={e => {setUserRole(e.target.value as "recruiter" | "admin"); if(e.target.value==='recruiter' && activeTab==='archive') setActiveTab('preboarding');}} className="bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#002649] p-1.5 outline-none cursor-pointer">
            <option value="recruiter">מגייסת (Recruiter)</option>
            <option value="admin">מנהלת מערכת (Admin)</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        <button onClick={() => setActiveTab("pipeline")} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'pipeline' ? 'bg-[#002649] text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}><Briefcase size={18}/> מועמדים בתהליך</button>
        <button onClick={() => setActiveTab("preboarding")} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'preboarding' ? 'bg-[#EF6B00] text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
          <Clock size={18}/> ממתינים לקליטה
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs ml-1">{onboardings.filter(o=>o.status==='pending').length}</span>
        </button>
        <button onClick={() => setActiveTab("active")} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'active' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}><UserCheck2 size={18}/> קליטות</button>
        
        {userRole === 'admin' && (
          <button onClick={() => setActiveTab("archive")} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'archive' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}><Lock size={18} className={activeTab === 'archive' ? 'text-blue-400' : ''}/> ארכיון היסטורי (Admin)</button>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      {activeTab === "pipeline" && (
        <div className="bg-white border border-slate-200 p-24 rounded-3xl text-center text-slate-500 shadow-sm">
          <Briefcase size={64} className="mx-auto mb-6 text-slate-300"/>
          <h2 className="text-2xl font-black text-[#002649] mb-2">משפך המועמדים (ATS)</h2>
          <p className="text-base">כאן יופיעו מועמדים שנמצאים בתהליכי מיון שונים טרם סגירת חוזה.</p>
        </div>
      )}

      {activeTab !== "pipeline" && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 min-h-[500px] flex flex-col">
          
          {/* Toolbar */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-wrap gap-4">
            <div className="relative w-full md:w-96">
              <Search size={18} className="absolute right-3 top-3 text-slate-400" />
              <input type="text" placeholder="חיפוש לפי שם, ת.ז, תפקיד או מחלקה..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-[#EF6B00] outline-none shadow-sm" />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={exportToExcel} className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-colors">
                <Download size={18} className="text-green-600"/> ייצוא נתונים
              </button>
              
              {activeTab === "preboarding" && (
                <button onClick={() => window.location.href='/ai-hub'} className="bg-[#002649] text-white px-5 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-[#EF6B00] transition-colors shadow-sm">
                  <Plus size={18}/> קליטת עובד חדש
                </button>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#002649] text-white font-bold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:bg-white/10" onClick={() => handleSort('name')}>שם מועמד.ת</th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-white/10" onClick={() => handleSort('role')}>תפקיד ויחידה</th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-white/10" onClick={() => handleSort('start_date')}>תאריך תחילה</th>
                  <th className="px-6 py-4 text-center">התאמות ולוגיסטיקה</th>
                  <th className="px-6 py-4 text-center">סטטוס</th>
                  <th className="px-6 py-4 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedData.map((record) => (
                  <tr key={record.id} className={`hover:bg-slate-50 transition-colors ${record.status === 'left_company' ? 'opacity-60 bg-slate-50/50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-black text-[#002649] text-base flex items-center gap-2">
                        {record.name}
                        {record.status === 'left_company' && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1"><UserMinus size={10}/> עזב/ה</span>}
                      </div>
                      <div className="text-xs text-slate-500 font-bold mt-1">ת.ז: {record.id_num}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">{record.role}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{record.department} <span className="mx-1">|</span> מנהל: {record.manager}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-mono font-bold px-3 py-1.5 rounded-lg ${activeTab==='preboarding' ? 'bg-orange-50 text-[#EF6B00]' : 'bg-slate-100 text-slate-600'}`}>{new Date(record.start_date).toLocaleDateString('he-IL')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 justify-center max-w-[250px] mx-auto">
                        {record.has_car && <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"><Car size={12}/> רכב חברה</span>}
                        {!record.has_car && record.parking_type !== 'לא' && record.parking_type && <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded text-[10px] font-bold">חניה: {record.parking_type} {record.car_num ? `(${record.car_num})` : ''}</span>}
                        {record.has_mobile && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"><Smartphone size={12}/> נייד</span>}
                        {record.has_cibus && <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"><Coffee size={12}/> סיבוס</span>}
                        {record.is_referral && <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded text-[10px] font-bold">חמ&quot;ח: {record.referral_name}</span>}
                        {record.diversity && <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded text-[10px] font-bold">{record.diversity}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {record.status === 'pending' && <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-100/50 border border-orange-200 px-3 py-1 rounded-xl text-xs font-bold"><Clock size={14}/> ממתין לתחילה</span>}
                      {record.status === 'completed' && <span className="inline-flex items-center gap-1 text-green-600 bg-green-100/50 border border-green-200 px-3 py-1 rounded-xl text-xs font-bold"><CheckCircle2 size={14}/> נקלט בהצלחה</span>}
                      {record.status === 'left_company' && <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl text-xs font-bold"><UserMinus size={14}/> לא פעיל</span>}
                      {record.status === 'cancelled' && <span className="inline-flex items-center gap-1 text-red-600 bg-red-100/50 border border-red-200 px-3 py-1 rounded-xl text-xs font-bold"><XCircle size={14}/> בוטל</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {activeTab === 'preboarding' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => {setEditingRecord(record); setShowForm(true);}} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200" title="ערוך ועדכן"><Edit3 size={18}/></button>
                          <button onClick={() => updateStatus(record.id, 'completed')} className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200" title="אשר שהתחיל/ה לעבוד"><CheckCircle2 size={18}/></button>
                          <button onClick={() => {if(window.confirm('לבטל קליטה (No-Show)?')) updateStatus(record.id, 'cancelled')}} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200" title="ביטול קליטה"><Trash2 size={18}/></button>
                        </div>
                      ) : activeTab === 'active' && record.status === 'completed' ? (
                        <button onClick={() => {if(window.confirm('לדווח על סיום העסקה?')) updateStatus(record.id, 'left_company')}} className="text-slate-400 hover:text-red-500 text-xs font-bold flex items-center gap-1 justify-center mx-auto hover:bg-red-50 p-1.5 rounded"><UserMinus size={14}/> דווח עזיבה</button>
                      ) : (
                        <button onClick={() => {setEditingRecord(record); setShowForm(true);}} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100">צפה בתיק</button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAndSortedData.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-16 text-slate-400 font-medium">אין נתונים להצגה.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL 1: THE ONBOARDING EDIT FORM         */}
      {/* ========================================= */}
      {showForm && (
        <OnboardingFormModal 
          onClose={() => setShowForm(false)} 
          existingRecord={editingRecord}
          onSaveSuccess={(name) => {
             setShowForm(false);
             if (!editingRecord && name) setShowChecklist(name); 
          }}
        />
      )}

      {/* ========================================= */}
      {/* MODAL 2: RECRUITER CHECKLIST              */}
      {/* ========================================= */}
      {showChecklist && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
            <div className="bg-[#002649] text-white p-6 text-center relative">
              <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-[#002649] shadow-lg"><CheckCircle2 size={32}/></div>
              <h2 className="text-2xl font-black">הקליטה שוגרה בהצלחה!</h2>
              <p className="text-blue-200 mt-1">מיילים אוטומטיים נשלחו ל-HRO ולקב&quot;ט עבור {showChecklist}.</p>
              <button onClick={() => setShowChecklist(null)} className="absolute top-4 right-4 text-white/50 hover:text-white"><XCircle size={24}/></button>
            </div>
            
            <div className="p-8">
              <div className="flex justify-between items-end mb-6">
                 <div>
                   <h3 className="font-black text-lg text-[#002649] flex items-center gap-2"><CheckSquare className="text-[#EF6B00]"/> צ&apos;קליסט סגירת משרה</h3>
                   <p className="text-xs text-slate-500 font-bold mt-1">חובה להשלים את הפעולות הבאות כדי למנוע תקלות.</p>
                 </div>
                 <button onClick={() => setIsEditingTasks(!isEditingTasks)} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg"><Settings size={14}/> {isEditingTasks ? 'סיים עריכה' : 'ערוך משימות'}</button>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {tasks.map(task => (
                  <div key={task.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${task.done && !isEditingTasks ? 'bg-green-50 border-green-200 opacity-60' : 'bg-slate-50 border-slate-200 hover:border-blue-300'}`}>
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      {!isEditingTasks && <input type="checkbox" checked={task.done} onChange={() => setTasks(tasks.map(t => t.id === task.id ? {...t, done: !t.done} : t))} className="w-5 h-5 accent-green-600" />}
                      {isEditingTasks ? (
                         <input type="text" value={task.text} onChange={(e) => setTasks(tasks.map(t => t.id === task.id ? {...t, text: e.target.value} : t))} className="flex-1 bg-white border border-blue-200 rounded p-1 text-sm font-bold text-[#002649] outline-none" />
                      ) : (
                         <span className={`text-sm font-bold ${task.done ? 'text-green-700 line-through' : 'text-[#002649]'}`}>{task.text}</span>
                      )}
                    </label>
                    {isEditingTasks && <button onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>}
                  </div>
                ))}
              </div>

              {!isEditingTasks && (
                 <button onClick={() => setShowChecklist(null)} className="w-full bg-[#EF6B00] text-white py-3.5 rounded-xl font-black text-lg shadow-lg hover:bg-[#d65a00] transition-colors mt-8">
                   סיימתי, סגור חלון
                 </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: The Onboarding Edit Form
// ==========================================
interface FormModalProps { onClose: () => void; existingRecord: OnboardingRecord | null; onSaveSuccess: (name: string | undefined) => void }

function OnboardingFormModal({ onClose, existingRecord, onSaveSuccess }: Readonly<FormModalProps>) {
  const [formData, setFormData] = useState<Partial<OnboardingRecord>>(existingRecord || {
    name: "", id_num: "", role: "", department: "", manager: "", start_date: "",
    has_car: false, parking_type: "לא", car_num: "",
    has_mobile: false, has_cibus: false,
    is_referral: false, referral_name: "", referral_id: "", diversity: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [sendUpdateNotification, setSendUpdateNotification] = useState(false); // הצ'קבוקס החדש לעדכונים

  const handleCarToggle = (checked: boolean) => {
    setFormData(prev => ({ ...prev, has_car: checked, ...(checked ? { parking_type: "בזכאות", car_num: "" } : {}) }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.role) return alert("חובה להזין לפחות שם ותפקיד");
    setIsSaving(true);
    
    // סימולציה של שליחת הנתונים לשרת + מיילים
    setTimeout(() => {
      setIsSaving(false);
      if (sendUpdateNotification) {
        alert("נשלח מייל עדכון לשותפים (לוגיסטיקה/HRO) המדגיש את הנתונים שעודכנו.");
      }
      onSaveSuccess(formData.name);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-2xl font-black text-[#002649] flex items-center gap-2">
            <UserCheck className="text-[#EF6B00]"/> {existingRecord ? "צפייה ועריכת תיק מועמד" : "טופס קליטת עובד"}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"><XCircle size={24}/></button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 space-y-8 bg-slate-50/30">
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-[#002649] mb-4 text-sm border-b pb-2">פרטים אישיים וארגוניים</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">שם מלא</label><input type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">תעודת זהות</label><input type="text" value={formData.id_num} onChange={e=>setFormData({...formData, id_num: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">תאריך תחילת עבודה</label><input type="date" value={formData.start_date} onChange={e=>setFormData({...formData, start_date: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">תפקיד מיועד</label><input type="text" value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">יחידה / מחלקה</label><input type="text" value={formData.department} onChange={e=>setFormData({...formData, department: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">מנהל ישיר</label><input type="text" value={formData.manager} onChange={e=>setFormData({...formData, manager: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none focus:border-blue-500" /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-[#002649] mb-4 text-sm border-b pb-2">לוגיסטיקה וזכאויות</h3>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[#002649]"><input type="checkbox" checked={formData.has_mobile} onChange={e=>setFormData({...formData, has_mobile: e.target.checked})} className="w-4 h-4 accent-[#EF6B00]"/> נייד</label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[#002649]"><input type="checkbox" checked={formData.has_cibus} onChange={e=>setFormData({...formData, has_cibus: e.target.checked})} className="w-4 h-4 accent-[#EF6B00]"/> סיבוס</label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[#002649]"><input type="checkbox" checked={formData.has_car} onChange={e=>handleCarToggle(e.target.checked)} className="w-4 h-4 accent-[#EF6B00]"/> רכב</label>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">זכאות חניה</label>
                <select value={formData.parking_type} onChange={e=>setFormData({...formData, parking_type: e.target.value})} disabled={formData.has_car} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none disabled:opacity-50">
                  <option value="לא">ללא זכאות</option>
                  <option value="בזכאות">בזכאות קבועה</option>
                  <option value="ללא זכאות">על בסיס מקום פנוי</option>
                </select>
              </div>
              {formData.parking_type !== "לא" && !formData.has_car && (
                 <div className="mt-3"><label className="text-xs font-bold text-slate-500 mb-1 block">מספר רכב</label><input type="text" value={formData.car_num || ''} onChange={e=>setFormData({...formData, car_num: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none" placeholder="123-45-678" /></div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-[#002649] mb-4 text-sm border-b pb-2">חבר מביא חבר / גיוון</h3>
              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[#002649]"><input type="checkbox" checked={formData.is_referral} onChange={e=>setFormData({...formData, is_referral: e.target.checked})} className="w-4 h-4 accent-[#002649]"/> חבר מביא חבר</label>
                {formData.is_referral && (
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div><label className="text-[10px] font-bold text-slate-500 mb-1 block">שם הממליץ</label><input type="text" value={formData.referral_name || ''} onChange={e=>setFormData({...formData, referral_name: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold outline-none" /></div>
                    <div><label className="text-[10px] font-bold text-slate-500 mb-1 block">ת.ז המפנה</label><input type="text" value={formData.referral_id || ''} onChange={e=>setFormData({...formData, referral_id: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold outline-none" /></div>
                  </div>
                )}
                
                <div className="pt-2 border-t">
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">אוכלוסיית יעד (גיוון והכלה)</label>
                  <select value={formData.diversity || ''} onChange={e=>setFormData({...formData, diversity: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold text-[#002649] outline-none">
                    <option value="">ללא שיוך מיוחד</option>
                    <option value="חברה ערבית">חברה ערבית</option>
                    <option value="חברה חרדית">חברה חרדית</option>
                    <option value="עמותת שווים">עמותת שווים (מוגבלויות)</option>
                    <option value="קרבה משפחתית">קרבה משפחתית להנהלה</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-between items-center gap-4">
          {existingRecord ? (
             <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 text-blue-800 font-bold text-sm hover:bg-blue-100 transition-colors">
               <input type="checkbox" checked={sendUpdateNotification} onChange={e=>setSendUpdateNotification(e.target.checked)} className="w-4 h-4 accent-blue-600" />
               <Send size={16}/> שלח עדכונים לשותפים (HRO/קב&quot;ט)
             </label>
          ) : <div></div>}
          
          <div className="flex gap-4">
            <button onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">ביטול</button>
            <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 font-black text-white bg-[#002649] hover:bg-[#EF6B00] rounded-xl transition-colors shadow-lg flex items-center gap-2">
              {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
              {existingRecord ? "שמור שינויים" : "שמור קליטה"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}