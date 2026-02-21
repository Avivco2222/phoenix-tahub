"use client";

import React, { useState, useMemo } from "react";
import { 
  Send, CheckCircle2, Zap, FileText, Target, 
  MessageSquare, Briefcase, Sparkles, UserCheck, 
  UploadCloud, Edit3, Eye, RefreshCw, X, Coins, 
  Hourglass, Award, Fingerprint, ListChecks, 
  Calendar, Info, ArrowUp, ArrowDown, Plus, Globe
} from "lucide-react";

// --- מאגר כישורים מתורגם (WEF 2025) ---
const SKILLS_BANK = [
  "חשיבה אנליטית", "חוסן וגמישות", "מנהיגות והשפעה", "חשיבה יצירתית",
  "מוטיבציה ומודעות", "אוריינות טכנולוגית", "אמפתיה והקשבה", "סקרנות ולמידה",
  "AI ודאטה", "חשיבה מערכתית", "אמינות ודיוק", "בקרת איכות", "אבטחת מידע", "תכנות"
];

// --- מודול מנהיגות הפניקס ---
const LEADERSHIP_MODEL = [
  { id: "together", label: "מצליחים יחד", color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
  { id: "leading", label: "מובילים את הדרך", color: "text-orange-600 bg-orange-50 border-orange-100" },
  { id: "performance", label: "מצטיינים בביצועים", color: "text-cyan-600 bg-cyan-50 border-cyan-100" },
  { id: "innovation", label: "מחויבים לחדשנות", color: "text-purple-600 bg-purple-50 border-purple-100" },
  { id: "customers", label: "מעצימים לקוחות", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  { id: "people", label: "חושבים אנשים", color: "text-pink-600 bg-pink-50 border-pink-100" }
];

const SYSTEM_JOBS = [
  { id: "j1", title: "אנליסט נתונים בכיר", manager: "דני כהן" },
  { id: "j2", title: "מפתח Backend Java", manager: "רונית לוי" },
];

const JOB_CANDIDATES: Record<string, any[]> = {
  "j1": [{ id: "c1", name: "דניאל אהרוני" }],
  "j2": [{ id: "c2", name: "מיכל לוי" }],
};

export default function BrieflyManagerBrief() {
  const [step, setStep] = useState<"input" | "draft" | "preview">("input");
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [showMarketModal, setShowMarketModal] = useState(false);
  
  const [rawInputs, setRawInputs] = useState({ phone: "", frontal: "", tests: "", additional: "" });
  const [selectedLeadership, setSelectedLeadership] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [includeMarketReview, setIncludeMarketReview] = useState(false);
  
  const [draft, setDraft] = useState({
    summary: "",
    detailedInsights: ["", "", "", ""],
    interviewQuestions: [] as string[],
    salaryExpectation: "",
    availability: "",
    recruiterPick: "",
    marketReview: ""
  });

  const job = useMemo(() => SYSTEM_JOBS.find(j => j.id === selectedJob), [selectedJob]);
  const candidateName = useMemo(() => JOB_CANDIDATES[selectedJob]?.find(c => c.id === selectedCandidate)?.name || "המועמד", [selectedJob, selectedCandidate]);

  const generateDraft = () => {
    setSelectedSkills(["חשיבה אנליטית", "AI ודאטה", "אמינות ודיוק"]);
    setSelectedLeadership("performance");
    setDraft({
      summary: `מועמד בעל יכולות ניתוח עמוקות מחברת 'הראל'. מציג שילוב נדיר של ירידה לפרטים יחד עם הבנה עסקית רחבה.`,
      detailedInsights: [
        "הפגין שליטה יוצאת דופן ב-SQL מורכב ובניית דאשבורדים אסטרטגיים.",
        "במבדק המקצועי קיבל ציון 95 - מהגבוהים שנראו בתפקיד זה.",
        "מביא איתו ניסיון בעבודה מול ממשקי הנהלה בכירים (C-Level).",
        "נכונות גבוהה לעבודה במודל היברידי גמיש."
      ],
      interviewQuestions: [
        "איך התמודדת עם פער טכנולוגי ב-SQL?",
        "תאר פרויקט מורכב שהובלת מאפס.",
        "מהן הציפיות שלך מהמנהל הישיר?"
      ],
      salaryExpectation: "25,000₪",
      availability: "30 יום",
      recruiterPick: "השילוב בין דיוק טכני להבנה עסקית רחבה, מועמד יציב מאוד שמתאים בדיוק לתרבות של המחלקה.",
      marketReview: "שוק האנליסטים כיום בתנופה. מתחרים (הראל, מנורה) מציעים חבילות דומות. יתרון לפניקס ביציבות ובאופק הקידום."
    });
    setStep("draft");
  };

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) setSelectedSkills(selectedSkills.filter(s => s !== skill));
    else if (selectedSkills.length < 5) setSelectedSkills([...selectedSkills, skill]);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...draft.interviewQuestions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newQuestions.length) {
      [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
      setDraft({ ...draft, interviewQuestions: newQuestions });
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 animate-in fade-in duration-500 pb-20 px-4" dir="rtl">
      
      {/* Header Compact */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#002649] text-white rounded-xl shadow-md"><Zap size={18} fill="#EF6B00" className="text-[#EF6B00]" /></div>
          <h1 className="text-xl font-black text-[#002649]">Briefly: מרכז תדרוך למנהל</h1>
        </div>
        <div className="flex gap-1.5 bg-slate-50 p-1 rounded-full">
          {['input', 'draft', 'preview'].map((s, i) => (
            <div key={s} className={`h-1 w-10 rounded-full transition-all ${step === s ? 'bg-[#EF6B00]' : i < (step === 'draft' ? 1 : 2) ? 'bg-[#002649]' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>

      {step === "input" && (
        <div className="grid grid-cols-12 gap-4 animate-in slide-in-from-bottom-2">
          <div className="col-span-4 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-md font-black text-[#002649] border-b pb-3">בחירת מועמד</h2>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">משרה</label>
                <select value={selectedJob} onChange={e=>setSelectedJob(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none"><option value="">בחרי משרה...</option>{SYSTEM_JOBS.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">מועמד</label>
                <select value={selectedCandidate} onChange={e=>setSelectedCandidate(e.target.value)} disabled={!selectedJob} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none disabled:opacity-30"><option value="">בחרי מועמד...</option>{JOB_CANDIDATES[selectedJob]?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-orange-50/20 transition-all relative cursor-pointer">
                <UploadCloud size={28} className="text-slate-300 mb-1" /><span className="text-[10px] font-black text-slate-500">{cvFile ? cvFile.name : "גררי קורות חיים"}</span>
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e=>e.target.files?.[0] && setCvFile(e.target.files[0])} />
              </div>
            </div>
          </div>
          <div className="col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
            <h2 className="text-lg font-black text-[#002649] border-b pb-3 mb-4 flex items-center gap-2"><MessageSquare size={18} className="text-blue-500"/> מאגר המידע (Intel)</h2>
            <div className="grid grid-cols-2 gap-4 flex-1">
              {[{id:'phone', lbl:'טלפוני'}, {id:'frontal', lbl:'פרונטלי'}, {id:'tests', lbl:'מבדקים'}, {id:'additional', lbl:'דגשים'}].map(f => (
                <div key={f.id} className="space-y-1"><label className="text-[10px] font-black text-blue-400 uppercase">{f.lbl}</label>
                  <textarea value={rawInputs[f.id as keyof typeof rawInputs]} onChange={e=>setRawInputs({...rawInputs, [f.id]:e.target.value})} className="w-full h-24 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white transition-all" />
                </div>
              ))}
            </div>
            <button onClick={generateDraft} disabled={!selectedCandidate || !cvFile} className="mt-4 w-full py-4 bg-[#002649] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-[#EF6B00] transition-all shadow-lg disabled:opacity-40"><RefreshCw size={20} /> לטיוטה החכמה</button>
          </div>
        </div>
      )}

      {step === "draft" && (
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl animate-in zoom-in-95 space-y-8">
          <div className="flex justify-between items-center border-b pb-4">
             <h2 className="text-xl font-black text-[#002649]">עריכת טיוטה למנהל</h2>
             <div className="flex gap-2">
               <button onClick={()=>setStep("input")} className="px-4 py-2 text-slate-400 font-black text-xs">ביטול</button>
               <button onClick={()=>setStep("preview")} className="bg-[#002649] text-white px-8 py-2.5 rounded-xl font-black text-sm shadow-xl flex items-center gap-2 hover:bg-[#EF6B00] transition-all"><Eye size={16}/> תצוגת מנהל</button>
             </div>
          </div>
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-7 space-y-6">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">תמצית מנהלים (Summary)</label>
                <textarea value={draft.summary} onChange={e=>setDraft({...draft, summary:e.target.value})} className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-[#002649] outline-none" />
              </div>

              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">תובנות מהתהליך (עד 5 בולטים)</label>
                {draft.detailedInsights.map((insight, idx)=>(<input key={idx} value={insight} onChange={e=>{let n=[...draft.detailedInsights]; n[idx]=e.target.value; setDraft({...draft, detailedInsights:n})}} className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-blue-200" placeholder={`תובנה ${idx+1}...`} />))}
              </div>

              {/* --- Restored Skills Selection --- */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase flex justify-between px-1">בחירת כישורים (עד 5) <span>{selectedSkills.length}/5</span></label>
                <div className="flex flex-wrap gap-2 p-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 min-h-[45px]">
                  {selectedSkills.map(skill => (
                    <span key={skill} className="bg-[#EF6B00] text-white px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-2 animate-in zoom-in-50">
                      {skill} <X size={12} className="cursor-pointer hover:scale-125 transition-transform" onClick={()=>toggleSkill(skill)}/>
                    </span>
                  ))}
                  {selectedSkills.length === 0 && <span className="text-[10px] text-slate-300 font-bold self-center mr-2 italic">טרם נבחרו כישורים...</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {SKILLS_BANK.map(skill => (
                    <button key={skill} onClick={()=>toggleSkill(skill)} disabled={!selectedSkills.includes(skill) && selectedSkills.length >= 5} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${selectedSkills.includes(skill) ? 'hidden' : 'bg-white text-slate-400 border-slate-100 hover:border-blue-200 hover:text-blue-500'}`}>{skill}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-5 space-y-6">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">עקרון מנהיגות הפניקס</label>
                <div className="grid grid-cols-2 gap-2">{LEADERSHIP_MODEL.map(m => (<button key={m.id} onClick={()=>setSelectedLeadership(m.id)} className={`p-2.5 rounded-xl border-2 text-[10px] font-black transition-all ${selectedLeadership === m.id ? 'border-orange-500 bg-orange-50 text-orange-700' : 'bg-white border-slate-50 text-slate-300 opacity-60 hover:opacity-100'}`}>{m.label}</button>))}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">שכר</label><input type="text" value={draft.salaryExpectation} onChange={e=>setDraft({...draft, salaryExpectation:e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs text-[#002649] outline-none" /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">זמינות</label><input type="text" value={draft.availability} onChange={e=>setDraft({...draft, availability:e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs text-[#002649] outline-none" /></div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-700 uppercase">צירוף סקירת שוק?</label>
                  <button onClick={()=>setIncludeMarketReview(!includeMarketReview)} className={`w-10 h-5 rounded-full relative transition-all ${includeMarketReview ? 'bg-[#EF6B00]' : 'bg-slate-300'}`}><div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all ${includeMarketReview ? 'left-1' : 'left-5.5'}`} /></button>
                </div>
                {includeMarketReview && <textarea value={draft.marketReview} onChange={e=>setDraft({...draft, marketReview: e.target.value})} className="w-full h-20 p-3 bg-white border border-orange-100 rounded-xl text-[10px] font-bold text-slate-600 outline-none placeholder:italic" placeholder="ה-AI ינסח כאן סקירה מהלינקדאין וטבלאות שכר..." />}
              </div>

              <div className="space-y-2 pt-2"><label className="text-[10px] font-black text-[#EF6B00] uppercase tracking-widest px-1 flex items-center gap-2"><Award size={12}/> Recruiter's Pick (TA Notes)</label>
                <textarea value={draft.recruiterPick} onChange={e=>setDraft({...draft, recruiterPick:e.target.value})} className="w-full bg-[#002649] p-4 rounded-[2rem] text-white text-xs h-24 font-medium outline-none focus:ring-1 ring-[#EF6B00]/40" />
              </div>

              {/* --- Restored Questions Management --- */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex justify-between">שאלות מפתח (עד 5) <Plus size={14} className="cursor-pointer text-blue-500 hover:scale-125" onClick={()=>{if(draft.interviewQuestions.length < 5) setDraft({...draft, interviewQuestions:[...draft.interviewQuestions, ""]})}}/></label>
                <div className="space-y-2">
                  {draft.interviewQuestions.map((q, i)=>(
                    <div key={i} className="flex gap-1 items-center bg-blue-50/50 p-1.5 rounded-xl border border-blue-100">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={()=>moveQuestion(i, 'up')} className="p-0.5 hover:text-[#EF6B00] text-slate-300"><ArrowUp size={12}/></button>
                        <button onClick={()=>moveQuestion(i, 'down')} className="p-0.5 hover:text-[#EF6B00] text-slate-300"><ArrowDown size={12}/></button>
                      </div>
                      <input value={q} onChange={e=>{let n=[...draft.interviewQuestions]; n[i]=e.target.value; setDraft({...draft, interviewQuestions:n})}} className="flex-1 bg-transparent border-none text-[10px] font-bold text-[#002649] outline-none" placeholder="הזיני שאלה..." />
                      <button onClick={()=>{let n=[...draft.interviewQuestions]; n.splice(i,1); setDraft({...draft, interviewQuestions:n})}} className="text-slate-300 hover:text-red-500 p-1"><X size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="animate-in fade-in duration-700 space-y-6">
           <div className="flex justify-between items-center px-4">
              <h2 className="text-xl font-black text-[#002649]">תצוגת המנהל (Premium Intelligence Card)</h2>
              <div className="flex gap-4 items-center">
                <button onClick={()=>setStep("draft")} className="text-[10px] font-black text-slate-400 hover:text-slate-600 transition-all uppercase tracking-widest">חזור לעריכה</button>
                <button onClick={() => alert("הבריף שוגר בהצלחה!")} className="bg-[#EF6B00] text-white px-10 py-3 rounded-2xl font-black text-sm shadow-xl flex items-center gap-2 hover:bg-[#002649] transition-all"><Send size={18}/> שגר בריף</button>
              </div>
           </div>

           {/* --- The Manager Brief --- */}
           <div className="max-w-[820px] mx-auto bg-white rounded-[4.5rem] border border-slate-100 shadow-[0_40px_80px_-20px_rgba(0,38,73,0.15)] overflow-hidden">
                <div className="bg-[#464EB8] p-3 text-white flex items-center gap-2 px-8">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center font-bold text-[8px]">TA</div>
                  <div className="text-[10px] font-bold tracking-tight">The Phoenix Recruitment &bull; עכשיו</div>
                </div>

                <div className="p-10 space-y-8 text-right bg-white relative">
                  
                  {/* Row 1: Header Command Bar [Icons & Side-by-side] */}
                  <div className="flex items-center justify-between bg-slate-50/80 p-5 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-[#002649] text-white rounded-3xl flex items-center justify-center text-2xl font-black shadow-lg">
                        {candidateName[0]}
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-[#002649] leading-tight tracking-tighter">{candidateName}</h3>
                        <div className="flex items-center gap-3">
                          <p className="text-blue-600 font-extrabold text-sm tracking-tight uppercase flex items-center gap-1.5"><Target size={14}/> {job?.title}</p>
                          {includeMarketReview && (
                            <button onClick={()=>setShowMarketModal(true)} className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-[9px] font-black hover:bg-orange-200 transition-all">
                              <Globe size={10}/> Market Intel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <button className="bg-[#002649] text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-xl hover:bg-[#EF6B00] transition-all">
                      <FileText size={16}/> קורות חיים
                    </button>
                  </div>

                  {/* Row 2: Executive Summary with Condensed Strip */}
                  <div className="space-y-0">
                    <div className="bg-slate-50/50 p-7 rounded-t-[2.5rem] border-x border-t border-slate-100 relative">
                      <Sparkles size={20} className="absolute top-4 left-4 text-[#EF6B00] opacity-30" />
                      <h4 className="text-[10px] font-black text-[#EF6B00] uppercase mb-2 tracking-widest flex items-center gap-1.5"><Zap size={12} fill="#EF6B00"/> תמצית מנהלים</h4>
                      <p className="text-md font-bold text-slate-700 leading-relaxed italic border-r-4 border-[#EF6B00]/20 pr-4">"{draft.summary}"</p>
                    </div>
                    
                    {/* Condensed Meta-Strip */}
                    <div className="bg-white border border-slate-100 p-3 rounded-b-[2.5rem] shadow-sm flex items-center justify-between px-8">
                       <div className="flex items-center gap-2">
                          <Fingerprint size={12} className="text-blue-400"/>
                          <div className="flex gap-1.5">
                            {selectedSkills.map(s=>(<span key={s} className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg">{s}</span>))}
                          </div>
                       </div>
                       {selectedLeadership && (
                         <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
                            <Award size={12} className="text-orange-400"/>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${LEADERSHIP_MODEL.find(m=>m.id===selectedLeadership)?.color}`}>
                               {LEADERSHIP_MODEL.find(m=>m.id===selectedLeadership)?.label}
                            </span>
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Row 4: Core Insights (The Meat) */}
                  <div className="space-y-4 px-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-50 pb-2 flex items-center gap-2 tracking-widest"><ListChecks size={14} className="text-blue-500"/> תובנות מרכזיות</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {draft.detailedInsights.filter(i=>i!=="").map((insight, idx)=>(
                        <div key={idx} className="flex gap-3 text-[13px] font-bold text-slate-600 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 leading-tight">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"/> {insight}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Row 5: Recruiter's Pick */}
                  <div className="bg-[#002649] p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-br from-[#EF6B00]/20 to-transparent opacity-40"></div>
                     <h4 className="text-[9px] font-black text-[#EF6B00] uppercase tracking-widest mb-2 flex items-center gap-2 relative z-10"><Award size={14}/> Recruiter's Pick (השורה התחתונה)</h4>
                     <p className="text-[13px] font-bold leading-relaxed italic relative z-10 opacity-95">"{draft.recruiterPick}"</p>
                  </div>

                  {/* Row 6: Key Questions */}
                  <div className="space-y-4 px-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-2">שאלות מפתח לראיון</h4>
                    <div className="space-y-2">
                      {draft.interviewQuestions.filter(q=>q!=="").map((q, i) => (
                        <div key={i} className="flex gap-3 text-xs font-bold text-slate-500 bg-white border border-slate-100 p-3 rounded-xl shadow-sm italic leading-snug">
                          <div className="w-1 h-1 rounded-full bg-[#EF6B00] mt-1.5 shrink-0"/> {q}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Row 7: Footer Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                      <div className="p-2 bg-white rounded-xl shadow-md text-[#EF6B00]"><Coins size={18}/></div>
                      <div><div className="text-[8px] font-black text-slate-400 uppercase">שכר</div><div className="text-xs font-black text-[#002649]">{draft.salaryExpectation}</div></div>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                      <div className="p-2 bg-white rounded-xl shadow-md text-blue-500"><Hourglass size={18}/></div>
                      <div><div className="text-[8px] font-black text-slate-400 uppercase">זמינות</div><div className="text-xs font-black text-[#002649]">{draft.availability}</div></div>
                    </div>
                    <div className="bg-slate-50/30 p-5 rounded-[2rem] border border-dashed border-slate-200 flex flex-col justify-center items-center text-slate-300">
                      <Info size={14} className="opacity-20 mb-0.5" />
                      <span className="text-[7px] font-black uppercase opacity-20 tracking-tighter">חיוויים נוספים (עתידי)</span>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-50">נא לבחור פעולה לקידום התהליך</p>
                    <div className="flex gap-4 w-full px-16">
                      <button onClick={()=>alert("זימון נשלח!")} className="flex-1 bg-[#22c55e] text-white py-6 rounded-[2.5rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-green-700 transition-all shadow-xl hover:scale-[1.03] transform"><CheckCircle2 size={24}/> מעוניין לראיין</button>
                      <button onClick={()=>setStep("input")} className="flex-1 bg-white text-slate-400 py-6 rounded-[2.5rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-slate-50 transition-all border-2 border-slate-100 shadow-sm"><X size={20}/> פחות רלוונטי</button>
                    </div>
                    <div className="flex items-center gap-2 opacity-40"><Calendar size={12}/> <span className="text-[9px] font-bold">סנכרון Outlook פעיל</span></div>
                  </div>
                </div>

                {/* --- Market Review Popup --- */}
                {showMarketModal && (
                  <div className="absolute inset-0 bg-[#002649]/95 backdrop-blur-sm z-[100] animate-in fade-in duration-300 flex items-center justify-center p-12">
                    <button onClick={()=>setShowMarketModal(false)} className="absolute top-8 left-8 text-white/50 hover:text-white"><X size={32}/></button>
                    <div className="max-w-xl text-right space-y-8">
                       <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                          <div className="p-3 bg-orange-500 text-white rounded-2xl"><Globe size={32}/></div>
                          <h2 className="text-3xl font-black text-white">סקירת שוק אסטרטגית</h2>
                       </div>
                       <p className="text-xl font-bold text-orange-200 leading-relaxed italic pr-6 border-r-4 border-orange-500">"{draft.marketReview}"</p>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/10"><h4 className="text-[10px] font-black text-white/40 uppercase mb-1">מתחרים ישירים</h4><p className="text-xs text-white font-bold">הראל, מגדל, כלל</p></div>
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/10"><h4 className="text-[10px] font-black text-white/40 uppercase mb-1">מגמת שכר</h4><p className="text-xs text-white font-bold">עלייה של 8% ב-2025</p></div>
                       </div>
                    </div>
                  </div>
                )}
           </div>
        </div>
      )}
    </div>
  );
}