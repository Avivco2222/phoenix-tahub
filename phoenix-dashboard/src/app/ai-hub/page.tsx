"use client";

import React, { useState } from "react";
import { 
  Bot, FileText, Send, UserPlus, Calculator, 
  Car, Laptop, Sparkles, CheckCircle2, ArrowRightLeft, 
  Building2, Server, ShieldCheck, Loader2,
  BadgeDollarSign, Info, Target
} from "lucide-react";

export default function SuperAiHub() {
  const [activeTab, setActiveTab] = useState("onboarding");

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 relative pb-20 px-2 md:px-6 h-[calc(100vh-100px)] flex flex-col">
      
      {/* Header */}
      <div className="shrink-0 mb-2">
        <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
       ארגז כלים<Sparkles className="text-[#EF6B00]" size={28} />
        </h1>
        <p className="text-slate-500 mt-2 font-medium">ארגז הכלים היומיומי: אוטומציות תפעוליות, מחוללי דוחות וסימולציות גיוס.</p>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        
        {/* Sidebar Menu */}
        <div className="w-full md:w-64 flex flex-col gap-2 shrink-0">
          <MenuButton id="onboarding" current={activeTab} onClick={setActiveTab} icon={<UserPlus size={18}/>} title="קליטת עובד (Onboarding)" desc="Fan-out אוטומטי למחלקות" />
          <MenuButton id="mobility" current={activeTab} onClick={setActiveTab} icon={<ArrowRightLeft size={18}/>} title="סימולטור ניוד פנימי" desc="פערי כישורים ושכר" />
          <MenuButton id="reports" current={activeTab} onClick={setActiveTab} icon={<FileText size={18}/>} title="מחולל דוחות ומצגות" desc="סיכומי סטטוס להנהלה" />
          <MenuButton id="chat" current={activeTab} onClick={setActiveTab} icon={<Bot size={18}/>} title="עוזר תקשורת AI" desc="ניסוח מיילים ומשובים" />
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-y-auto">
          {activeTab === "onboarding" && <SmartOnboarding />}
          {activeTab === "mobility" && <MobilitySimulator />}
          {activeTab === "reports" && <ReportsGenerator />}
          {activeTab === "chat" && <ComingSoon title="עוזר תקשורת מול מועמדים ומנהלים" icon={<Bot size={48} className="text-purple-200"/>} />}
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 1. Smart Onboarding Form (Fan-out Logic)
// ==========================================
function SmartOnboarding() {
  const [step, setStep] = useState(1);
  
  const handleLaunch = () => {
    setStep(2);
    setTimeout(() => setStep(3), 3500);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-xl font-black text-[#002649] flex items-center gap-2"><UserPlus className="text-blue-500"/> טופס קליטה מרכזי (Smart Onboarding)</h2>
        <p className="text-sm text-slate-500 mt-1">הזן את נתוני העובד החדש פעם אחת בלבד. המערכת תפצל את הבקשות ותשגר אותן אוטומטית למחלקות התפעול.</p>
      </div>

      <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
        {step === 1 && (
          <div className="max-w-2xl mx-auto space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-6">
              <div><label htmlFor="employee-name" className="block text-xs font-bold text-slate-500 mb-2">שם העובד.ת הנקלט</label><input id="employee-name" type="text" className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-[#EF6B00] bg-slate-50" placeholder="לדוגמא: דניאל כהן" /></div>
              <div><label htmlFor="employee-id" className="block text-xs font-bold text-slate-500 mb-2">תעודת זהות</label><input id="employee-id" type="text" className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-[#EF6B00] bg-slate-50" placeholder="לצורך הקמה ב-HRIS" /></div>
              <div><label htmlFor="employee-role" className="block text-xs font-bold text-slate-500 mb-2">תפקיד מיועד</label><input id="employee-role" type="text" className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-[#EF6B00] bg-slate-50" defaultValue="מפתח Backend Java" /></div>
              <div><label htmlFor="employee-start-date" className="block text-xs font-bold text-slate-500 mb-2">תאריך תחילת עבודה</label><input id="employee-start-date" type="date" className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-[#EF6B00] bg-slate-50 text-slate-600" /></div>
            </div>

            {/* IT & Logistics Provisions */}
            <div className="pt-6 border-t border-slate-100">
              <h3 className="font-bold text-[#002649] mb-4 text-sm">ציוד והרשאות (Provisions)</h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#002649]" />
                  <Laptop className="text-slate-400" size={20}/>
                  <div><div className="font-bold text-sm text-[#002649]">מחשב נייד וציוד היקפי</div><div className="text-[10px] text-slate-500">נשלח למחלקת IT</div></div>
                </label>
                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#002649]" />
                  <Building2 className="text-slate-400" size={20}/>
                  <div><div className="font-bold text-sm text-[#002649]">הקצאת עמדת עבודה</div><div className="text-[10px] text-slate-500">נשלח למחלקת לוגיסטיקה</div></div>
                </label>
                <label htmlFor="provision-parking" className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input id="provision-parking" type="checkbox" className="w-5 h-5 accent-[#002649]" />
                  <Car className="text-slate-400" size={20}/>
                  <div><div className="font-bold text-sm text-[#002649]">אישור כניסה לחניון</div><div className="text-[10px] text-slate-500">נשלח לקב״ט הפניקס</div></div>
                </label>
                <label htmlFor="provision-ad" className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input id="provision-ad" type="checkbox" defaultChecked className="w-5 h-5 accent-[#002649]" />
                  <Server className="text-slate-400" size={20}/>
                  <div><div className="font-bold text-sm text-[#002649]">פתיחת משתמש (Active Directory)</div><div className="text-[10px] text-slate-500">בקשת הרשאות מ-InfoSec</div></div>
                </label>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button onClick={handleLaunch} className="bg-[#002649] text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-[#EF6B00] transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform">
                <Send size={18}/> שגר תהליך קליטה (Fan-out)
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="h-full flex flex-col items-center justify-center space-y-8">
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#EF6B00] rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-blue-500"><Send size={32} className="animate-pulse"/></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-black text-xl text-[#002649]">מפצל בקשות למחלקות התפעול...</h3>
              <p className="text-slate-500 text-sm animate-pulse">פותח טיקט ב-IT Service Desk...</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="h-full flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 size={48} />
            </div>
            <div className="text-center">
              <h3 className="font-black text-2xl text-[#002649] mb-2">תהליך הקליטה שוגר בהצלחה!</h3>
              <p className="text-slate-500 mb-8">המערכת יצרה 4 טיקטים נפרדים בצורה אוטומטית.</p>
              
              <div className="flex justify-center gap-4 text-left">
                 <StatusBadge icon={<Server size={14}/>} title="IT SysAdmin" status="Ticket #4021" />
                 <StatusBadge icon={<Building2 size={14}/>} title="Logistics" status="Desk Assigned" />
                 <StatusBadge icon={<ShieldCheck size={14}/>} title="Security" status="Pending Badge" />
              </div>
            </div>
            <button onClick={() => setStep(1)} className="mt-8 text-blue-600 font-bold text-sm hover:underline">קלוט עובד נוסף</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. Internal Mobility & Salary Simulator
// ==========================================
function MobilitySimulator() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(false);

  const handleSimulate = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setResult(true);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-xl font-black text-[#002649] flex items-center gap-2"><ArrowRightLeft className="text-purple-500"/> סימולטור ניוד פנימי (Mobility)</h2>
        <p className="text-sm text-slate-500 mt-1">בחר עובד.ת קיים לבחינת התאמה למשרה פתוחה. ה-AI ינתח פערי כישורים (Skills Gap) ויציג מודל שכר מומלץ לחתימה.</p>
      </div>
      
      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-6 mb-8 items-center bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
           <div className="flex-1 w-full">
             <label htmlFor="mobility-source-employee" className="block text-xs font-bold text-slate-500 mb-2">עובד.ת בארגון (מקור)</label>
             <select id="mobility-source-employee" className="w-full p-3 border border-slate-200 rounded-xl font-bold text-[#002649] bg-slate-50 outline-none">
               <option>דניאל לוי - נציג תמיכה טכנית (ותק: 1.5 שנים)</option>
               <option>שירן כהן - רכזת שיווק</option>
             </select>
           </div>
           <div className="shrink-0 text-slate-300 hidden md:block"><ArrowRightLeft size={24} /></div>
           <div className="flex-1 w-full">
             <label htmlFor="mobility-target-job" className="block text-xs font-bold text-slate-500 mb-2">משרה פתוחה (יעד)</label>
             <select id="mobility-target-job" className="w-full p-3 border border-slate-200 rounded-xl font-bold text-[#002649] bg-slate-50 outline-none">
               <option>QA Engineer (אוטומציה)</option>
               <option>מנהל תיקי לקוחות (B2B)</option>
             </select>
           </div>
           <button onClick={handleSimulate} className="shrink-0 bg-[#002649] text-white px-6 py-3 rounded-xl font-black mt-6 md:mt-0 hover:bg-purple-600 transition-colors flex items-center gap-2 shadow-sm">
             {analyzing ? <Loader2 size={18} className="animate-spin"/> : <Calculator size={18}/>}
             הרץ סימולציה
           </button>
        </div>

        {result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-8">
             
             {/* Skills Gap Analysis */}
             <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-1 h-full bg-green-500"></div>
               <h3 className="font-bold text-[#002649] mb-4 flex items-center gap-2"><Target size={18} className="text-green-500"/> ניתוח התאמת כישורים</h3>
               <div className="text-4xl font-black text-green-600 mb-1">82%</div>
               <p className="text-sm font-bold text-slate-500 mb-6">התאמה גבוהה למעבר (High Match)</p>
               
               <div className="space-y-3">
                 <div>
                   <div className="flex justify-between text-xs font-bold mb-1"><span className="text-slate-700">היכרות עם מוצרי החברה</span><span className="text-green-600">100% (קיים)</span></div>
                   <div className="w-full bg-slate-100 h-2 rounded-full"><div className="bg-green-500 h-full w-full rounded-full"></div></div>
                 </div>
                 <div>
                   <div className="flex justify-between text-xs font-bold mb-1"><span className="text-slate-700">כתיבת סקריפטים (Python/JS)</span><span className="text-orange-500">פער קל (נדרשת הכשרה)</span></div>
                   <div className="w-full bg-slate-100 h-2 rounded-full"><div className="bg-orange-500 h-full w-[60%] rounded-full"></div></div>
                 </div>
               </div>
             </div>

             {/* Salary Simulation */}
             <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
               <h3 className="font-bold text-[#002649] mb-4 flex items-center gap-2"><BadgeDollarSign size={18} className="text-blue-500"/> השלכות שכר ותקציב</h3>
               
               <div className="flex items-end gap-4 mb-6 pb-6 border-b border-slate-100">
                 <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase">שכר נוכחי (תמיכה)</p>
                   <div className="text-xl font-bold text-slate-600">₪11,500</div>
                 </div>
                 <div className="text-blue-500 font-black mb-1"><ArrowRightLeft size={16}/></div>
                 <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase">הצעת שכר מומלצת (QA)</p>
                   <div className="text-2xl font-black text-[#002649]">₪15,000</div>
                 </div>
               </div>

               <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium border border-blue-100 flex items-start gap-3">
                 <Info size={18} className="shrink-0 mt-0.5 text-blue-500"/>
                 <div>
                   <strong>תובנת AI:</strong> ההצעה נמוכה ב-15% מהממוצע החיצוני לתפקיד QA, אך מגלמת עליית שכר משמעותית של 30% לעובד. הניוד יחסוך לארגון כ-₪28,000 בעלויות גיוס השמה.
                 </div>
               </div>
               
               <button className="w-full mt-4 border-2 border-[#002649] text-[#002649] font-bold py-2 rounded-xl hover:bg-[#002649] hover:text-white transition-colors">
                 צור טופס שינוי תנאים
               </button>
             </div>

          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 3. AI Reports & Presentations Generator
// ==========================================
function ReportsGenerator() {
  const [generating, setGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [reportType, setReportType] = useState("weekly_hiring");

  const handleGenerate = () => {
    setGenerating(true);
    setReportReady(false);
    // Simulate AI Generation time
    setTimeout(() => {
      setGenerating(false);
      setReportReady(true);
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-[#002649] flex items-center gap-2">
            <FileText className="text-blue-500"/> מחולל דוחות
          </h2>
          <p className="text-sm text-slate-500 mt-1">יצירת סיכומי מנהלים, מצגות סטטוס ודוחות אנליטיים בלחיצת כפתור מתוך נתוני המערכת.</p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Input Form */}
        <div className="space-y-6">
          <div>
            <span className="block text-sm font-bold text-[#002649] mb-2">סוג הדוח המבוקש</span>
            <div className="space-y-2">
              <label htmlFor="report-type-weekly" className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${reportType === 'weekly_hiring' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}>
                <input id="report-type-weekly" type="radio" name="reportType" checked={reportType === 'weekly_hiring'} onChange={() => setReportType('weekly_hiring')} className="w-4 h-4 accent-blue-600" aria-label="סטטוס גיוס שבועי להנהלה" />
                <div>
                  <div className="font-bold text-slate-700">סטטוס גיוס שבועי להנהלה</div>
                  <div className="text-xs text-slate-500">סיכום קליטות, צווארי בקבוק ומדדי SLA.</div>
                </div>
              </label>
              <label htmlFor="report-type-diversity" className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${reportType === 'diversity' ? 'bg-pink-50 border-pink-500 shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}>
                <input id="report-type-diversity" type="radio" name="reportType" checked={reportType === 'diversity'} onChange={() => setReportType('diversity')} className="w-4 h-4 accent-pink-600" aria-label="דוח גיוון והכלה YTD" />
                <div>
                  <div className="font-bold text-slate-700">דוח גיוון והכלה YTD</div>
                  <div className="text-xs text-slate-500">עמידה ביעדי 3%, פילוחי שכר ומגדר.</div>
                </div>
              </label>
              <label htmlFor="report-type-hm" className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${reportType === 'hm_update' ? 'bg-orange-50 border-[#EF6B00] shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}>
                <input id="report-type-hm" type="radio" name="reportType" checked={reportType === 'hm_update'} onChange={() => setReportType('hm_update')} className="w-4 h-4 accent-[#EF6B00]" aria-label="עדכון למנהל מגייס ספציפי" />
                <div>
                  <div className="font-bold text-slate-700">עדכון למנהל מגייס ספציפי</div>
                  <div className="text-xs text-slate-500">סטטוס מועמדים פעילים לפי מחלקה לבחירה.</div>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
<div>
            <label htmlFor="report-format" className="block text-xs font-bold text-slate-500 mb-1">פורמט ייצוא</label>
              <select id="report-format" className="w-full p-2 border border-slate-200 rounded-lg outline-none font-bold text-slate-700">
                <option>מצגת (PowerPoint)</option>
                <option>מסמך (PDF)</option>
                <option>טקסט לאימייל</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-language" className="block text-xs font-bold text-slate-500 mb-1">שפה</label>
              <select id="report-language" className="w-full p-2 border border-slate-200 rounded-lg outline-none font-bold text-slate-700">
                <option>עברית</option>
                <option>English</option>
              </select>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={generating} className="w-full bg-[#002649] text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-[#EF6B00] transition-colors shadow-md disabled:opacity-70">
            {generating ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>}
            {generating ? 'מנתח נתונים ומייצר מסמך...' : 'חולל דוח באמצעות AI'}
          </button>
        </div>

        {/* Output Area */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {generating && (
             <div className="absolute inset-0 bg-[#002649]/5 backdrop-blur-sm flex flex-col items-center justify-center z-10">
               <Loader2 className="text-[#EF6B00] animate-spin mb-4" size={40}/>
               <p className="text-sm font-bold text-[#002649]">מושך נתוני ATS ו-FinOps...</p>
               <p className="text-xs text-slate-500 mt-1">מנסח תקציר מנהלים...</p>
             </div>
          )}

          {!reportReady && !generating && (
            <div className="text-slate-400">
              <FileText size={48} className="mx-auto mb-4 opacity-50"/>
              <p className="font-bold text-lg">תצוגה מקדימה</p>
              <p className="text-sm">הדוח שייווצר יופיע כאן ויהיה מוכן להורדה.</p>
            </div>
          )}

          {reportReady && (
            <div className="animate-in slide-in-from-bottom-4 w-full h-full flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 size={24}/>
                </div>
                <div className="text-left flex flex-col gap-2">
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition-colors">הורד קובץ PPTX</button>
                  <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">שתף ישירות במייל</button>
                </div>
              </div>
              
              <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl p-4 text-right overflow-y-auto">
                <h4 className="font-black text-[#002649] border-b pb-2 mb-2">תקציר מנהלים (AI Summary):</h4>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  במהלך החודש האחרון נקלטו <strong>28 עובדים חדשים</strong> לחברה. 
                  מגמת הגיוס ב-R&D חיובית עם עמידה ביעד ה-SLA (ממוצע 34 ימים), עם זאת אנו מזהים חריגה של 12% בתקציב חברות ההשמה ביחס לרבעון המקביל.
                  <br/><br/>
                  המלצת המערכת: להסטת תקציבים לקמפיין לינקדאין ממומן עבור משרות ״ראש צוות״ שכרגע מסומנות כקריטיות למחלקת הפיתוח.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Helpers
// ==========================================
interface MenuButtonProps {
  id: string;
  current: string;
  onClick: (id: string) => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}

function MenuButton({ id, current, onClick, icon, title, desc }: Readonly<MenuButtonProps>) {
  const active = current === id;
  return (
    <button onClick={() => onClick(id)} className={`flex items-start gap-3 p-4 rounded-xl transition-all text-right w-full border ${
      active ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-100' : 'border-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-800'
    }`}>
      <div className={`mt-0.5 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`}>{icon}</div>
      <div>
        <div className={`font-bold text-sm ${active ? 'text-[#002649]' : ''}`}>{title}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

interface StatusBadgeProps {
  icon: React.ReactNode;
  title: string;
  status: string;
}

function StatusBadge({ icon, title, status }: Readonly<StatusBadgeProps>) {
  return (
    <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm min-w-[120px]">
      <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase mb-1">{icon} {title}</div>
      <div className="font-black text-[#002649] text-xs">{status}</div>
    </div>
  );
}

interface ComingSoonProps {
  title: string;
  icon: React.ReactNode;
}

function ComingSoon({ title, icon }: Readonly<ComingSoonProps>) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center animate-in fade-in zoom-in-95">
      <div className="mb-6">{icon}</div>
      <h3 className="font-black text-2xl text-slate-300 mb-2">{title}</h3>
      <p className="text-sm font-medium max-w-md">המודול נמצא כרגע בפיתוח ויחובר למנוע ה-LLM בגרסה הבאה. תוכל לייצר פה טקסטים, דוחות ומיילים בצורה אוטומטית לחלוטין.</p>
    </div>
  );
}
