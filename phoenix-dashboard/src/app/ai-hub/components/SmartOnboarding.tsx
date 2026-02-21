"use client";

import React, { useState, useEffect } from "react";
import { 
  UserPlus, ShieldCheck,
  PlusCircle, CheckCircle2, CheckSquare, Settings,
  UploadCloud, File as FileIcon, AlertCircle, ChevronRight, ChevronLeft, Mail, XCircle
} from "lucide-react";

interface OnboardingTask { id: number; text: string; done: boolean }

export default function SmartOnboarding() {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", idNum: "", startDate: "",
    jobTitle: "", jobNum: "", orgUnit: "", manager: "",
    isReferral: false, refName: "", refEmpNum: "", refBonus: "", refDate: "",
    hasDisability: false,
    hasFamilyTie: false, relativeName: "", tieType: "ראשונה",
    hasMobile: false, hasCibus: false, hasCar: false,
    parkingType: "לא", carNum: "", freeText: ""
  });

  useEffect(() => {
    if (formData.startDate && formData.isReferral && !formData.refDate) {
      const d = new Date(formData.startDate);
      d.setMonth(d.getMonth() + 3);
      setFormData(prev => ({ ...prev, refDate: d.toISOString().split('T')[0] }));
    }
  }, [formData.startDate, formData.isReferral, formData.refDate]);

  useEffect(() => {
    if (formData.hasCar) {
      setFormData(prev => ({ ...prev, parkingType: "בזכאות", carNum: "" }));
    }
  }, [formData.hasCar]);

  const [tasks, setTasks] = useState<OnboardingTask[]>([
    { id: 1, text: 'ביצוע ״יועסקו״ ב-SAP', done: false },
    { id: 2, text: 'סגירת משרה במערכת EC', done: false },
    { id: 3, text: 'וידוא הסרת פרסומים (נילוסופט/לינקדאין)', done: false },
    { id: 4, text: 'שליחת שאלון עובד חדש (HRO)', done: false },
    { id: 5, text: 'וידוא כתובת ותאריך תחילה בנילוסופט', done: false }
  ]);

  const [cvFile, setCvFile] = useState<globalThis.File | null>(null);
  const [otherFiles, setOtherFiles] = useState<globalThis.File[]>([]);

  const [routing, setRouting] = useState({
    referral: "hr-referrals@fnx.co.il", logistics: "car-fleet@fnx.co.il",
    diversity: "diversity@fnx.co.il", hro: "payroll@fnx.co.il"
  });

  const nextStep = () => {
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.idNum || !formData.startDate) {
        globalThis.alert("חובה למלא שם, ת.ז ותאריך תחילה.");
        return;
      }
    }
    if (step === 3) {
      if (tasks.some(t => !t.done)) {
        if (!globalThis.confirm("לא סימנת את כל משימות החובה בצ׳קליסט. האם להמשיך בכל זאת?")) return;
      }
    }
    setStep(step + 1);
  };

  const handleLaunch = async () => {
    if (!cvFile) { globalThis.alert("חובה להעלות קורות חיים לפני סיום התהליך."); return; }
    setIsSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/onboarding`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ ...formData, checklist: tasks, files: { cv: cvFile.name, others: otherFiles.map(f=>f.name) } })
      });
      const data = await res.json();
      if(data.status === "success") { 
        setStep(5);
      }
    } catch {
      globalThis.alert("שגיאת תקשורת מול השרת. אנא ודא שהשרת רץ."); 
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-b-3xl flex flex-col relative">
      
      {showSettings && (
        <div className="absolute top-4 left-4 w-80 bg-white shadow-2xl border border-slate-200 rounded-2xl p-5 z-50 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h4 className="font-black text-[#002649] flex items-center gap-2"><Mail size={16}/> מטריצת נמענים אוטומטית</h4>
            <button onClick={()=>setShowSettings(false)} className="text-slate-400"><XCircle size={18}/></button>
          </div>
          <div className="space-y-3 text-xs">
            <div><label htmlFor="rt-ref" className="font-bold text-slate-600 block">מייל חבר מביא חבר:</label><input id="rt-ref" type="text" value={routing.referral} onChange={e=>setRouting({...routing, referral:e.target.value})} className="w-full p-2 border rounded bg-slate-50" /></div>
            <div><label htmlFor="rt-log" className="font-bold text-slate-600 block">מייל לוגיסטיקה (רכב/חניה):</label><input id="rt-log" type="text" value={routing.logistics} onChange={e=>setRouting({...routing, logistics:e.target.value})} className="w-full p-2 border rounded bg-slate-50" /></div>
            <div><label htmlFor="rt-div" className="font-bold text-slate-600 block">מייל מחלקת גיוון:</label><input id="rt-div" type="text" value={routing.diversity} onChange={e=>setRouting({...routing, diversity:e.target.value})} className="w-full p-2 border rounded bg-slate-50" /></div>
          </div>
        </div>
      )}

      {step < 5 && (
        <div className="border-b border-slate-200 p-8">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-2xl font-black text-[#002649] flex items-center gap-2"><UserPlus className="text-[#EF6B00]"/> אשף טרום-קליטה (Pre-Boarding Wizard)</h2>
              <p className="text-sm text-slate-500 mt-1">תהליך מודרך לקליטת עובד חדש, כולל טיפול בזכאויות והפצת מידע למחלקות התפעול.</p>
            </div>
            <button onClick={()=>setShowSettings(!showSettings)} className="text-blue-600 hover:bg-blue-50 p-2.5 rounded-xl transition-colors font-bold text-sm flex items-center gap-2"><Settings size={18}/> הגדרות תפוצה</button>
          </div>

          <div className="relative w-full max-w-5xl mx-auto mt-6">
            <div className="absolute top-5 left-12 right-12 h-1.5 bg-slate-100 -z-10 rounded-full overflow-hidden">
               <div className="h-full bg-[#EF6B00] transition-all duration-500" style={{ width: `${((step-1)/3)*100}%` }}></div>
            </div>
            <div className="flex justify-between items-start">
              {['פרטים אישיים וארגוניים', 'מועמדות וזכאויות', "צ׳קליסט סגירה", 'מסמכים ושיגור'].map((label, idx) => {
                const num = idx + 1;
                return (
                  <div key={num} className="flex flex-col items-center gap-3 w-32">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg transition-all duration-300 ${step === num ? 'bg-[#002649] text-white shadow-xl scale-110 ring-4 ring-blue-50' : step > num ? 'bg-[#EF6B00] text-white' : 'bg-white text-slate-300 border-2 border-slate-200'}`}>
                      {step > num ? <CheckCircle2 size={24}/> : num}
                    </div>
                    <span className={`text-center text-[12px] leading-tight font-extrabold transition-colors ${step === num ? 'text-[#002649]' : step > num ? 'text-[#EF6B00]' : 'text-slate-400'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="p-8 md:p-12 w-full">
        
        {step === 1 && (
          <div className="animate-in slide-in-from-right-4 w-full">
            <h3 className="text-xl font-black text-[#002649] border-b pb-4 mb-6">פרטי המועמד.ת</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
              <div><label htmlFor="wz-fn" className="text-sm font-bold text-slate-500 mb-1.5 block">שם פרטי <span className="text-red-500">*</span></label><input id="wz-fn" type="text" value={formData.firstName} onChange={e=>setFormData({...formData, firstName: e.target.value})} className="w-full p-3.5 border rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="wz-ln" className="text-sm font-bold text-slate-500 mb-1.5 block">שם משפחה <span className="text-red-500">*</span></label><input id="wz-ln" type="text" value={formData.lastName} onChange={e=>setFormData({...formData, lastName: e.target.value})} className="w-full p-3.5 border rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="wz-id" className="text-sm font-bold text-slate-500 mb-1.5 block">תעודת זהות <span className="text-red-500">*</span></label><input id="wz-id" type="text" value={formData.idNum} onChange={e=>setFormData({...formData, idNum: e.target.value})} className="w-full p-3.5 border rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="wz-sd" className="text-sm font-bold text-slate-500 mb-1.5 block">תאריך תחילת עבודה <span className="text-red-500">*</span></label><input id="wz-sd" type="date" value={formData.startDate} onChange={e=>setFormData({...formData, startDate: e.target.value})} className="w-full p-3.5 border rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
            </div>
            <h3 className="text-xl font-black text-[#002649] border-b pb-4 mb-6">פרטי המשרה</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <div><label htmlFor="wz-jt" className="text-sm font-bold text-slate-500 mb-1.5 block">שם משרה</label><input id="wz-jt" type="text" value={formData.jobTitle} onChange={e=>setFormData({...formData, jobTitle: e.target.value})} className="w-full p-3.5 border rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="wz-jn" className="text-sm font-bold text-slate-500 mb-1.5 block">מספר משרה (Requisition)</label><input id="wz-jn" type="text" value={formData.jobNum} onChange={e=>setFormData({...formData, jobNum: e.target.value})} className="w-full p-3.5 border rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="wz-ou" className="text-sm font-bold text-slate-500 mb-1.5 block">שיוך ארגוני (רמה 3)</label><input id="wz-ou" type="text" value={formData.orgUnit} onChange={e=>setFormData({...formData, orgUnit: e.target.value})} className="w-full p-3.5 border rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="wz-mg" className="text-sm font-bold text-slate-500 mb-1.5 block">שם מנהל מגייס</label><input id="wz-mg" type="text" value={formData.manager} onChange={e=>setFormData({...formData, manager: e.target.value})} className="w-full p-3.5 border rounded-xl font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in slide-in-from-right-4 w-full grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="bg-slate-50/50 rounded-3xl border border-slate-100 p-8 space-y-6">
              <h3 className="text-xl font-black text-[#002649] border-b pb-3">הפניות וגיוון באוכלוסיה</h3>
              <div className="space-y-5">
                <label htmlFor="wz-ref" className="flex items-center gap-3 p-5 border rounded-xl bg-white shadow-sm cursor-pointer transition-all hover:border-[#EF6B00]">
                  <input id="wz-ref" type="checkbox" checked={formData.isReferral} onChange={e=>setFormData({...formData, isReferral: e.target.checked})} className="w-6 h-6 accent-[#002649]" />
                  <span className="font-black text-lg text-[#002649]">נקלט במסגרת &apos;חבר מביא חבר&apos;</span>
                </label>
                {formData.isReferral && (
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 p-5 border border-blue-200 bg-blue-50/50 rounded-xl animate-in zoom-in-95">
                    <div><label htmlFor="wz-rn" className="text-xs font-bold text-slate-500 mb-1.5 block">שם הממליץ</label><input id="wz-rn" type="text" value={formData.refName} onChange={e=>setFormData({...formData, refName: e.target.value})} className="w-full p-3 border rounded-xl bg-white shadow-sm" /></div>
                    <div><label htmlFor="wz-re" className="text-xs font-bold text-slate-500 mb-1.5 block">מספר עובד</label><input id="wz-re" type="text" value={formData.refEmpNum} onChange={e=>setFormData({...formData, refEmpNum: e.target.value})} className="w-full p-3 border rounded-xl bg-white shadow-sm" /></div>
                    <div><label htmlFor="wz-rb" className="text-xs font-bold text-slate-500 mb-1.5 block">סכום תגמול (₪)</label><input id="wz-rb" type="number" value={formData.refBonus} onChange={e=>setFormData({...formData, refBonus: e.target.value})} className="w-full p-3 border rounded-xl bg-white shadow-sm" /></div>
                    <div><label htmlFor="wz-rd" className="text-xs font-bold text-slate-500 mb-1.5 block">תאריך תשלום יעד</label><input id="wz-rd" type="date" value={formData.refDate} onChange={e=>setFormData({...formData, refDate: e.target.value})} className="w-full p-3 border rounded-xl bg-white shadow-sm font-bold text-blue-600" /></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-5 pt-4">
                  <label htmlFor="wz-dis" className="flex items-center gap-3 p-5 border rounded-xl bg-white shadow-sm cursor-pointer hover:border-slate-300">
                    <input id="wz-dis" type="checkbox" checked={formData.hasDisability} onChange={e=>setFormData({...formData, hasDisability: e.target.checked})} className="w-6 h-6 accent-[#002649]" />
                    <span className="font-bold text-[#002649]">עובד עם מוגבלות (גיוון)</span>
                  </label>
                  <label htmlFor="wz-fam" className="flex items-center gap-3 p-5 border rounded-xl bg-white shadow-sm cursor-pointer hover:border-slate-300">
                    <input id="wz-fam" type="checkbox" checked={formData.hasFamilyTie} onChange={e=>setFormData({...formData, hasFamilyTie: e.target.checked})} className="w-6 h-6 accent-[#002649]" />
                    <span className="font-bold text-[#002649]">קרבה משפחתית בארגון</span>
                  </label>
                </div>
                {formData.hasFamilyTie && (
                  <div className="grid grid-cols-2 gap-4 p-5 border border-orange-200 bg-orange-50/50 rounded-xl animate-in zoom-in-95">
                    <div><label htmlFor="wz-rel" className="text-xs font-bold text-slate-500 mb-1.5 block">שם עובד.ת קרוב.ה</label><input id="wz-rel" type="text" value={formData.relativeName} onChange={e=>setFormData({...formData, relativeName: e.target.value})} className="w-full p-3 border rounded-xl bg-white shadow-sm" /></div>
                    <div><label htmlFor="wz-tie" className="text-xs font-bold text-slate-500 mb-1.5 block">סוג קרבה</label><select id="wz-tie" value={formData.tieType} onChange={e=>setFormData({...formData, tieType: e.target.value})} className="w-full p-3 border rounded-xl bg-white shadow-sm"><option>ראשונה</option><option>שנייה</option></select></div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50/50 rounded-3xl border border-slate-100 p-8 space-y-6">
              <h3 className="text-xl font-black text-[#002649] border-b pb-3">זכאויות ולוגיסטיקה</h3>
              <div className="flex gap-8 p-5 bg-white shadow-sm rounded-xl border border-slate-200 mb-6">
                <label htmlFor="wz-mob" className="flex items-center gap-2 cursor-pointer font-black text-[#002649]"><input id="wz-mob" type="checkbox" checked={formData.hasMobile} onChange={e=>setFormData({...formData, hasMobile: e.target.checked})} className="w-5 h-5 accent-[#EF6B00]"/> זכאות לנייד</label>
                <label htmlFor="wz-cib" className="flex items-center gap-2 cursor-pointer font-black text-[#002649]"><input id="wz-cib" type="checkbox" checked={formData.hasCibus} onChange={e=>setFormData({...formData, hasCibus: e.target.checked})} className="w-5 h-5 accent-[#EF6B00]"/> כרטיס הסעדה</label>
                <label htmlFor="wz-car" className="flex items-center gap-2 cursor-pointer font-black text-[#002649]"><input id="wz-car" type="checkbox" checked={formData.hasCar} onChange={e=>setFormData({...formData, hasCar: e.target.checked})} className="w-5 h-5 accent-[#EF6B00]"/> זכאות לרכב חברה</label>
              </div>
              <div className="grid grid-cols-2 gap-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <label htmlFor="wz-park" className="text-sm font-bold text-slate-500 mb-1.5 block">זכאות חניה</label>
                  <select id="wz-park" value={formData.parkingType} onChange={e=>setFormData({...formData, parkingType: e.target.value})} disabled={formData.hasCar} className="w-full p-3.5 border rounded-xl font-bold text-[#002649] bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    <option value="לא">ללא זכאות חניה</option>
                    <option value="בזכאות">זכאות מלאה למקום קבוע</option>
                    <option value="ללא זכאות">זכאות כניסה (על בסיס מקום פנוי)</option>
                  </select>
                  {formData.hasCar && <p className="text-[11px] text-orange-600 font-bold mt-2">* חניה מאושרת אוטומטית עקב זכאות לרכב חברה.</p>}
                </div>
                {formData.parkingType !== "לא" && !formData.hasCar && (
                  <div className="animate-in fade-in"><label htmlFor="wz-cn" className="text-sm font-bold text-slate-500 mb-1.5 block">מספר רכב אישי (לאישורי כניסה)</label><input id="wz-cn" type="text" value={formData.carNum} onChange={e=>setFormData({...formData, carNum: e.target.value})} className="w-full p-3.5 border rounded-xl font-bold text-[#002649]" placeholder="123-45-678" /></div>
                )}
              </div>
              <div className="pt-4">
                <label htmlFor="wz-ft" className="text-sm font-bold text-slate-500 mb-1.5 block">הערות לוגיסטיקה / שכר (מלל חופשי)</label>
                <textarea id="wz-ft" value={formData.freeText} onChange={e=>setFormData({...formData, freeText: e.target.value})} className="w-full p-4 border rounded-xl font-medium text-slate-700 bg-white shadow-sm outline-none h-28" placeholder="הערות מיוחדות שיופיעו בתיק העובד..." />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in slide-in-from-right-4 w-full max-w-4xl mx-auto">
            <h3 className="text-2xl font-black text-[#002649] border-b pb-4 mb-6 flex items-center gap-3"><CheckSquare className="text-green-500" size={32}/> צ׳קליסט סגירת משרה חובה</h3>
            <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl flex items-start gap-3 mb-8 shadow-sm">
              <AlertCircle className="text-blue-500 shrink-0" size={24}/>
              <p className="text-base text-blue-900 font-medium">כדי לשמור על דאטה נקי במערכות הפניקס, אנא ודאי שביצעת את הפעולות הבאות לפני שיגור הקליטה הסופית.</p>
            </div>
            <div className="space-y-4">
              {tasks.map(task => (
                <label key={task.id} htmlFor={`cl-${task.id}`} className={`flex items-center gap-5 p-6 rounded-2xl border-2 cursor-pointer transition-all ${task.done ? 'bg-green-50 border-green-300' : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm'}`}>
                  <input id={`cl-${task.id}`} type="checkbox" checked={task.done} onChange={() => setTasks(prev => prev.map(t => t.id === task.id ? {...t, done: !t.done} : t))} className="w-7 h-7 accent-green-600" />
                  <span className={`text-xl font-bold ${task.done ? 'text-green-700 line-through opacity-60' : 'text-[#002649]'}`}>{task.text}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in slide-in-from-right-4 w-full max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <h3 className="text-2xl font-black text-[#002649] border-b pb-3">מסמכים מצורפים</h3>
                <div>
                  <h4 className="font-bold text-[#002649] text-lg flex items-center gap-2 mb-3">קורות חיים <span className="text-red-500 text-xs bg-red-50 px-2 py-1 rounded border border-red-100">חובת צירוף</span></h4>
                  <label className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all ${cvFile ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-500 bg-slate-50'}`}>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => { if(e.target.files?.[0]) setCvFile(e.target.files[0]); }} />
                    <UploadCloud size={48} className={cvFile ? 'text-green-600 mb-4' : 'text-blue-500 mb-4'}/>
                    <span className="font-black text-lg text-[#002649] text-center">{cvFile ? cvFile.name : 'לחצי כאן להעלאת מסמך קורות חיים'}</span>
                    {cvFile && <span className="text-base text-green-600 mt-2 font-black">✓ המסמך נקלט במערכת</span>}
                  </label>
                </div>
                <div>
                  <h4 className="font-bold text-slate-600 flex items-center gap-2 mb-3 text-base">מסמכים נלווים (המלצות / חוזה)</h4>
                  <label className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                    <input type="file" className="hidden" multiple onChange={e => { if(e.target.files) setOtherFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} />
                    <span className="text-base font-bold text-slate-500 flex items-center gap-2"><PlusCircle size={20}/> הוספת קבצים נוספים...</span>
                  </label>
                  {otherFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {otherFiles.map((f) => (
                        <div key={f.name} className="bg-slate-100 px-4 py-2 rounded-xl text-sm font-bold text-[#002649] flex items-center gap-2 border border-slate-200"><FileIcon size={16}/> {f.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#002649] p-10 rounded-3xl text-white shadow-2xl flex flex-col justify-center border-4 border-blue-900/50">
                <ShieldCheck size={64} className="text-[#EF6B00] mb-6" />
                <h4 className="font-black text-3xl mb-4">מוכנה לשיגור הקליטה?</h4>
                <p className="text-blue-200 text-base mb-8 leading-relaxed">בלחיצה על שיגור, המערכת תבצע את הפעולות הבאות ברקע ללא צורך במעורבות נוספת:</p>
                <ul className="text-base space-y-4 text-white font-medium">
                  <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-[#EF6B00]" /> העובד יעבור אוטומטית לטבלת &quot;ממתינים לקליטה&quot;.</li>
                  <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-[#EF6B00]" /> לוגים ישלחו למחלקות (HRO, לוגיסטיקה, גיוון).</li>
                  {formData.isReferral && <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" /> טריגר תשלום (חמ&quot;ח) ינעל מול השכר ל-{formData.refDate}.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="w-full flex flex-col items-center justify-center text-center py-20 animate-in zoom-in-95">
            <div className="w-32 h-32 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-8 shadow-inner ring-[12px] ring-green-50"><CheckCircle2 size={64} /></div>
            <h2 className="text-5xl font-black text-[#002649] mb-4">הקליטה שוגרה בהצלחה!</h2>
            <p className="text-slate-500 mb-12 max-w-2xl text-xl leading-relaxed">תיק העובד עבור {formData.firstName} {formData.lastName} הועבר למערכות התפעול. משימות הצ׳קליסט נרשמו ביומן, והתראות נשלחו למחלקות.</p>
            <div className="flex gap-4">
              <button onClick={() => {setStep(1); setCvFile(null); setOtherFiles([]);}} className="bg-[#EF6B00] text-white px-10 py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-[#d65a00] transition-colors">התחל קליטת עובד חדש</button>
            </div>
          </div>
        )}
      </div>
      
      {step < 5 && (
        <div className="border-t border-slate-200 bg-slate-50 p-8 rounded-b-3xl flex justify-between items-center w-full mt-auto">
          <button onClick={() => setStep(step - 1)} disabled={step === 1 || isSaving} className="px-8 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-30 flex items-center gap-2 text-lg">
            <ChevronRight size={20}/> חזרה
          </button>
          {step < 4 ? (
            <button onClick={nextStep} className="bg-[#002649] text-white px-14 py-4 rounded-xl font-black text-lg shadow-xl hover:bg-blue-800 transition-colors flex items-center gap-3">
              לשלב הבא <ChevronLeft size={20}/>
            </button>
          ) : (
            <button onClick={handleLaunch} disabled={isSaving || !cvFile} className="bg-[#EF6B00] text-white px-14 py-4 rounded-xl font-black text-lg shadow-xl hover:bg-[#d65a00] transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? <span className="animate-pulse">משגר קליטה למערכות...</span> : 'אישור ושיגור קליטה'} <Mail size={20}/>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
