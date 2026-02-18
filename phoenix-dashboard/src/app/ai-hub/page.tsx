"use client";

import React, { useState, useEffect } from "react";
import { 
  Bot, FileText, UserPlus,
  Sparkles, CheckCircle2, ArrowRightLeft, 
  ShieldCheck, Loader2,
  BadgeDollarSign, Download, Trash2, PlusCircle, Printer,
  CheckSquare, Settings,
  UploadCloud, File as FileIcon, AlertCircle, ChevronRight, ChevronLeft, Mail, XCircle
} from "lucide-react";

export default function SuperAiHub() {
  const [activeTab, setActiveTab] = useState("mobility");

  return (
    // הוסר ה-h-screen שחנק את התצוגה והוחלף ב-min-h-screen כדי לאפשר גלילה טבעית
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 relative pb-20 px-4 md:px-8 pt-6 min-h-screen flex flex-col">
      
      <div className="shrink-0 border-b border-slate-200 pb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
              ארגז כלים <Sparkles className="text-[#EF6B00]" size={28} />
            </h1>
            <p className="text-slate-500 mt-2 font-medium">ארגז הכלים היומיומי: סימולציות שכר, קליטת עובדים, אוטומציות ודוחות.</p>
          </div>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-2">
          <TopTab id="mobility" current={activeTab} onClick={setActiveTab} icon={<ArrowRightLeft size={16}/>} title="סימולטור שכר וניוד" />
          <TopTab id="onboarding" current={activeTab} onClick={setActiveTab} icon={<UserPlus size={16}/>} title="קליטת עובד (Onboarding)" />
          <TopTab id="reports" current={activeTab} onClick={setActiveTab} icon={<FileText size={16}/>} title="מחולל דוחות AI" />
          <TopTab id="chat" current={activeTab} onClick={setActiveTab} icon={<Bot size={16}/>} title="עוזר תקשורת AI" />
        </div>
      </div>

      {/* הקופסה הראשית נפתחה כדי שהתוכן יוכל "לנשום" ללא גלילה פנימית */}
      <div className="flex-1 bg-white border border-slate-200 rounded-3xl shadow-sm mb-10">
        {activeTab === "mobility" && <MobilitySimulator />}
        {activeTab === "onboarding" && <SmartOnboarding />}
        {activeTab === "reports" && <ReportsGenerator />}
        {activeTab === "chat" && <ComingSoon title="עוזר תקשורת מול מועמדים ומנהלים" icon={<Bot size={48} className="text-purple-200"/>} />}
      </div>

    </div>
  );
}

// ==========================================
// 1. HORIZONTAL TAB NAVIGATION
// ==========================================
interface TopTabProps { id: string; current: string; onClick: (id: string) => void; icon: React.ReactNode; title: string }

function TopTab({ id, current, onClick, icon, title }: Readonly<TopTabProps>) {
  const active = current === id;
  return (
    <button 
      onClick={() => onClick(id)} 
      className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
        active 
        ? 'bg-slate-50 border-[#EF6B00] text-[#002649]' 
        : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-[#002649]'
      }`}
    >
      <span className={active ? 'text-[#EF6B00]' : 'text-slate-400'}>{icon}</span>
      {title}
    </button>
  );
}

// ==========================================
// 2. Compensation & Salary Simulator (Pro V3)
// ==========================================
interface CustomField { id: string; label: string; amount: number }
interface CompSlice {
  base: number; global: number;
  pension_pct: number; severance_pct: number; loss_of_earning_pct: number;
  kh_pct: number; kh_base_type: string;
  meals: number; travel: number; holiday: number; welfare: number; health: number; car: number; bonus: number;
  agency_fee_pct: number;
  customFields: CustomField[];
}

function MobilitySimulator() {
  const [isComparative, setIsComparative] = useState(false);
  
  const [personal, setPersonal] = useState({
    name: "אביב כהן", id: "034567891", role: "מפתח Backend", 
    dept: "חטיבת טכנולוגיות (R&D)", manager: "ישראל ישראלי", startDate: "01/05/2026"
  });

  const [compData, setCompData] = useState<{ proposed: CompSlice; current: CompSlice }>({
    proposed: {
      base: 15000, global: 1500,
      pension_pct: 6.5, severance_pct: 8.33, loss_of_earning_pct: 0.95,
      kh_pct: 7.5, kh_base_type: 'total',
      meals: 840, travel: 323, holiday: 92, welfare: 33, health: 0, car: 0, bonus: 0,
      agency_fee_pct: 0,
      customFields: [{ id: "c1", label: "בונוס חתימה", amount: 5000 }]
    },
    current: {
      base: 12000, global: 0,
      pension_pct: 6.0, severance_pct: 8.33, loss_of_earning_pct: 0,
      kh_pct: 0, kh_base_type: 'base',
      meals: 400, travel: 250, holiday: 0, welfare: 0, health: 0, car: 0, bonus: 0,
      agency_fee_pct: 0,
      customFields: []
    }
  });

  const updateField = (type: 'proposed' | 'current', field: string, value: string | number) => {
    setCompData(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  };

  const addCustomField = (type: 'proposed' | 'current') => {
    const newField: CustomField = { id: `cf-${Date.now()}`, label: "רכיב חדש...", amount: 0 };
    setCompData(prev => ({...prev, [type]: {...prev[type], customFields: [...prev[type].customFields, newField]}}));
  };
  const updateCustomField = (type: 'proposed' | 'current', id: string, key: string, value: string | number) => {
    setCompData(prev => ({...prev, [type]: {...prev[type], customFields: prev[type].customFields.map(f => f.id === id ? { ...f, [key]: value } : f)}}));
  };
  const removeCustomField = (type: 'proposed' | 'current', id: string) => {
    setCompData(prev => ({...prev, [type]: {...prev[type], customFields: prev[type].customFields.filter(f => f.id !== id)}}));
  };

  const calculateMetrics = (data: CompSlice) => {
    const gross = data.base + data.global;
    
    let kh_base_amount = 0;
    if (data.kh_base_type === 'base') kh_base_amount = data.base;
    else if (data.kh_base_type === 'total') kh_base_amount = gross;
    else if (data.kh_base_type === 'ceiling') kh_base_amount = Math.min(gross, 15712);

    const social_value = (gross * (data.pension_pct / 100)) + (gross * (data.severance_pct / 100)) + (kh_base_amount * (data.kh_pct / 100));
    const benefits_value = data.meals + data.travel + data.holiday + data.welfare + data.health + data.car + (data.bonus / 12);
    const custom_value = data.customFields.reduce((sum: number, f: CustomField) => sum + Number(f.amount), 0);
    
    const total_value = gross + social_value + benefits_value + custom_value;
    const employer_cost = total_value + (gross * (data.loss_of_earning_pct / 100)); 
    const agency_fee = gross * (data.agency_fee_pct / 100);

    return { gross, total_value, employer_cost, custom_value, agency_fee };
  };

  const propMetrics = calculateMetrics(compData.proposed);
  const currMetrics = calculateMetrics(compData.current);
  const deltaValue = propMetrics.total_value - currMetrics.total_value;

  const handleGeneratePDF = () => {
    const printWindow = globalThis.open('', '', 'width=900,height=1000');
    if (!printWindow) { globalThis.alert("אנא אפשר חלונות קופצים (Pop-ups) כדי לייצר את המסמך"); return; }

    const colCount = isComparative ? 3 : 2;
    const customRows = compData.proposed.customFields.map((f: CustomField) =>
      `<tr><td>${f.label}</td>${isComparative ? '<td>-</td>' : ''}<td class="highlight" style="color:#EF6B00;">₪${Number(f.amount).toLocaleString()}</td></tr>`
    ).join('');

    const htmlContent = `<html dir="rtl" lang="he"><head><title>הצעת שכר - הפניקס</title><style>
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:40px;color:#002649}
.header{text-align:center;border-bottom:4px solid #EF6B00;padding-bottom:20px;margin-bottom:30px}
.logo{font-size:42px;font-weight:900;color:#EF6B00;letter-spacing:-1px}
.title{font-size:24px;font-weight:bold;margin-top:10px;color:#002649}
.grid-2{display:flex;justify-content:space-between;gap:20px;margin-bottom:30px}
.info-box{background:#f8fafc;padding:20px;border-radius:12px;flex:1;border:1px solid #e2e8f0}
.info-box h3{margin-top:0;color:#002649;font-size:16px;border-bottom:2px solid #EF6B00;padding-bottom:8px;display:inline-block}
.info-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px}
.info-row strong{color:#475569}
.total-box{background:#002649;color:white;padding:30px;text-align:center;border-radius:16px;margin-bottom:30px}
.total-box .lbl{font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#93c5fd}
.total-box .val{font-size:48px;font-weight:900;color:#EF6B00;margin:10px 0}
table{width:100%;border-collapse:collapse;margin-bottom:30px;font-size:14px}
th{background:#002649;color:white;padding:12px;text-align:right}
td{border-bottom:1px solid #e2e8f0;padding:12px}
tr:nth-child(even){background:#f8fafc}
.row-group{background:#e2e8f0 !important;font-weight:bold;color:#475569}
.highlight{font-weight:bold;color:#002649}
.disclaimer{font-size:11px;color:#64748b;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:20px;text-align:justify}
@media print{body{-webkit-print-color-adjust:exact}.no-print{display:none}}
</style></head><body>
<div class="header"><div class="logo">הפניקס</div><div class="title">חבילת תגמול והצעת שכר</div></div>
<div class="grid-2">
  <div class="info-box"><h3>פרטי מועמד</h3>
    <div class="info-row"><strong>שם מלא:</strong><span>${personal.name}</span></div>
    <div class="info-row"><strong>תעודת זהות:</strong><span>${personal.id}</span></div></div>
  <div class="info-box"><h3>פרטי משרה</h3>
    <div class="info-row"><strong>תפקיד:</strong><span>${personal.role}</span></div>
    <div class="info-row"><strong>יחידה:</strong><span>${personal.dept}</span></div>
    <div class="info-row"><strong>מנהל ישיר:</strong><span>${personal.manager}</span></div>
    <div class="info-row"><strong>תאריך יעד לקליטה:</strong><span>${personal.startDate}</span></div></div>
</div>
<div class="total-box">
  <div class="lbl">שווי חבילת התגמול החודשית (Total Rewards)</div>
  <div class="val">₪${propMetrics.total_value.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
  <div style="font-size:12px;color:#cbd5e1">כולל שכר יסוד, תוספות, שווי כספי של הטבות נלוות והפרשות פנסיוניות ממעסיק.</div>
</div>
<table><thead><tr><th>רכיב תגמול</th>${isComparative ? '<th>מצב נוכחי</th>' : ''}<th>הצעת הפניקס</th></tr></thead><tbody>
<tr class="row-group"><td colspan="${colCount}">שכר ותוספות (ברוטו)</td></tr>
<tr><td>שכר בסיס</td>${isComparative ? `<td>₪${compData.current.base.toLocaleString()}</td>` : ''}<td class="highlight">₪${compData.proposed.base.toLocaleString()}</td></tr>
<tr><td>שעות נוספות גלובליות</td>${isComparative ? `<td>₪${compData.current.global.toLocaleString()}</td>` : ''}<td class="highlight">₪${compData.proposed.global.toLocaleString()}</td></tr>
<tr class="row-group"><td colspan="${colCount}">תנאים סוציאליים (הפרשות מעסיק)</td></tr>
<tr><td>פנסיה / תגמולים</td>${isComparative ? `<td>${compData.current.pension_pct}%</td>` : ''}<td>${compData.proposed.pension_pct}%</td></tr>
<tr><td>קרן השתלמות <span style="font-size:10px;color:#64748b;">(${compData.proposed.kh_base_type === 'base' ? 'מבסיס' : compData.proposed.kh_base_type === 'total' ? 'מכולל' : 'עד תקרת מס'})</span></td>${isComparative ? `<td>${compData.current.kh_pct}%</td>` : ''}<td>${compData.proposed.kh_pct}%</td></tr>
<tr><td>פיצויים</td>${isComparative ? `<td>${compData.current.severance_pct}%</td>` : ''}<td>${compData.proposed.severance_pct}%</td></tr>
<tr class="row-group"><td colspan="${colCount}">הטבות ותנאים נלווים</td></tr>
<tr><td>כרטיס הסעדה (סיבוס/תן ביס)</td>${isComparative ? `<td>₪${compData.current.meals.toLocaleString()}</td>` : ''}<td>₪${compData.proposed.meals.toLocaleString()}</td></tr>
<tr><td>נסיעות חודשי</td>${isComparative ? `<td>₪${compData.current.travel.toLocaleString()}</td>` : ''}<td>₪${compData.proposed.travel.toLocaleString()}</td></tr>
<tr><td>שי לחג (מגולם ברמה חודשית)</td>${isComparative ? `<td>₪${compData.current.holiday.toLocaleString()}</td>` : ''}<td>₪${compData.proposed.holiday.toLocaleString()}</td></tr>
<tr><td>תקציב רווחה / הדרכה (חודשי)</td>${isComparative ? `<td>₪${compData.current.welfare.toLocaleString()}</td>` : ''}<td>₪${compData.proposed.welfare.toLocaleString()}</td></tr>
${compData.proposed.customFields.length > 0 ? `<tr class="row-group"><td colspan="${colCount}">תוספות והתאמות מיוחדות</td></tr>${customRows}` : ''}
</tbody></table>
<div class="disclaimer"><strong>הצהרה משפטית:</strong> המסמך הינו הצעת שכר שיווקית (סימולציה) בלבד ואינו מהווה חוזה עבודה מחייב או הבטחה לתעסוקה. הסכומים המופיעים בו הינם במונחי ברוטו משוערים, לפני ניכויי חובה כדין (מס הכנסה, ביטוח לאומי, מס בריאות וכדומה) והם כפופים לשינויים בהתאם לחקיקה, לנהלי החברה ולהסכם העבודה האישי שייחתם בין הצדדים, ככל שייחתם. מסמך זה תקף ל-30 ימים מיום הפקתו. תנאי העסקה סופיים ומלאים יקבעו אך ורק במסגרת הסכם העבודה הרשמי.</div>
</body></html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  const colSpan = isComparative ? 3 : 2;

  return (
    <div className="bg-slate-50/50 rounded-b-3xl pb-10">
      
      <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center gap-4 bg-white rounded-t-3xl">
        <h2 className="text-2xl font-black text-[#002649] flex items-center gap-2"><BadgeDollarSign className="text-emerald-500"/> מנוע חישוב: סימולטור שכר (Total Rewards)</h2>
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner shrink-0">
          <button onClick={() => setIsComparative(false)} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${!isComparative ? 'bg-white text-[#002649] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>הצעת שכר (Stand Alone)</button>
          <button onClick={() => setIsComparative(true)} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isComparative ? 'bg-white text-[#002649] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>השוואה למצב קיים</button>
        </div>
      </div>

      <div className="p-6 md:p-10 flex flex-col xl:flex-row gap-10">
        
        {/* אזור העבודה - רחב ומרווח למניעת גלילה */}
        <div className="flex-1 space-y-8">
          
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 xl:p-8">
            <h3 className="font-bold text-[#002649] border-b border-slate-100 pb-3 mb-5 text-lg">פרטים אישיים ומזהים</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
              <div><label htmlFor="cb-name" className="text-xs font-bold text-slate-500 mb-1 block">שם מועמד.ת</label><input id="cb-name" type="text" value={personal.name} onChange={e=>setPersonal({...personal, name: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="cb-id" className="text-xs font-bold text-slate-500 mb-1 block">ת.ז</label><input id="cb-id" type="text" value={personal.id} onChange={e=>setPersonal({...personal, id: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="cb-role" className="text-xs font-bold text-slate-500 mb-1 block">תפקיד מיועד</label><input id="cb-role" type="text" value={personal.role} onChange={e=>setPersonal({...personal, role: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="cb-dept" className="text-xs font-bold text-slate-500 mb-1 block">יחידה ארגונית</label><input id="cb-dept" type="text" value={personal.dept} onChange={e=>setPersonal({...personal, dept: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="cb-mgr" className="text-xs font-bold text-slate-500 mb-1 block">מנהל ישיר</label><input id="cb-mgr" type="text" value={personal.manager} onChange={e=>setPersonal({...personal, manager: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="cb-date" className="text-xs font-bold text-slate-500 mb-1 block">תאריך קליטה</label><input id="cb-date" type="date" value={personal.startDate} onChange={e=>setPersonal({...personal, startDate: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-bold text-[#002649] bg-slate-50 outline-none focus:border-[#EF6B00]" /></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <table className="w-full text-base text-right">
              <thead className="bg-[#002649] text-white">
                <tr>
                  <th className="p-4 font-bold">רכיב תגמול</th>
                  <th className="p-4 font-bold text-center border-r border-white/20 w-64 text-[#EF6B00]">הצעה חדשה</th>
                  {isComparative && <th className="p-4 font-bold text-center border-r border-white/20 bg-slate-800 w-56">מצב נוכחי</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-100/50 font-bold"><td colSpan={colSpan} className="p-3 text-slate-500 text-[11px] uppercase tracking-wider">שכר בסיס ותוספות</td></tr>
                <tr>
                  <td className="p-4 font-bold text-[#002649]">שכר בסיס (ברוטו)</td>
                  <td className="p-3 border-r border-slate-100"><input type="number" value={compData.proposed.base || ''} onChange={e=>updateField('proposed', 'base', Number(e.target.value))} className="w-full p-3 bg-blue-50/50 rounded-xl text-center font-black text-xl text-blue-700 outline-none focus:border-[#EF6B00] border border-transparent" /></td>
                  {isComparative && <td className="p-3 border-r border-slate-100"><input type="number" value={compData.current.base || ''} onChange={e=>updateField('current', 'base', Number(e.target.value))} className="w-full p-3 border border-slate-200 rounded-xl text-center font-bold text-slate-600 outline-none" /></td>}
                </tr>
                <tr>
                  <td className="p-4 font-bold text-[#002649]">נוספות גלובליות</td>
                  <td className="p-3 border-r border-slate-100"><input type="number" value={compData.proposed.global || ''} onChange={e=>updateField('proposed', 'global', Number(e.target.value))} className="w-full p-3 bg-blue-50/50 rounded-xl text-center font-bold text-blue-700 outline-none" /></td>
                  {isComparative && <td className="p-3 border-r border-slate-100"><input type="number" value={compData.current.global || ''} onChange={e=>updateField('current', 'global', Number(e.target.value))} className="w-full p-3 border border-slate-200 rounded-xl text-center font-bold text-slate-600 outline-none" /></td>}
                </tr>

                <tr className="bg-slate-100/50 font-bold"><td colSpan={colSpan} className="p-3 text-slate-500 text-[11px] uppercase tracking-wider">סוציאלי (הפרשות מעסיק)</td></tr>
                <tr>
                  <td className="p-4 font-bold text-[#002649]">פנסיה / תגמולים</td>
                  <td className="p-3 border-r border-slate-100"><select value={compData.proposed.pension_pct} onChange={e=>updateField('proposed', 'pension_pct', Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl text-center font-bold text-slate-700 outline-none"><option value={5}>5.00%</option><option value={6}>6.00%</option><option value={6.5}>6.50%</option><option value={7.5}>7.50%</option></select></td>
                  {isComparative && <td className="p-3 border-r border-slate-100"><select value={compData.current.pension_pct} onChange={e=>updateField('current', 'pension_pct', Number(e.target.value))} className="w-full p-3 border border-slate-200 rounded-xl text-center font-bold text-slate-600 outline-none"><option value={5}>5.00%</option><option value={6}>6.00%</option><option value={6.5}>6.50%</option><option value={7.5}>7.50%</option></select></td>}
                </tr>
                <tr>
                  <td className="p-4 font-bold text-[#002649] flex flex-col gap-1.5">
                    קרן השתלמות
                  </td>
                  <td className="p-3 border-r border-slate-100">
                    <div className="flex gap-2">
                      <select value={compData.proposed.kh_pct} onChange={e=>updateField('proposed', 'kh_pct', Number(e.target.value))} className="w-1/3 p-3 bg-slate-50 rounded-xl text-center font-bold text-slate-700 outline-none"><option value={0}>0%</option><option value={2.5}>2.5%</option><option value={5}>5%</option><option value={7.5}>7.5%</option></select>
                      <select value={compData.proposed.kh_base_type} onChange={e=>updateField('proposed', 'kh_base_type', e.target.value)} className="w-2/3 p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none">
                        <option value="base">משכר בסיס בלבד</option>
                        <option value="total">משכר בסיס + גלובליות</option>
                        <option value="ceiling">עד תקרת מס (15,712)</option>
                      </select>
                    </div>
                  </td>
                  {isComparative && (
                    <td className="p-3 border-r border-slate-100">
                      <div className="flex gap-2">
                        <select value={compData.current.kh_pct} onChange={e=>updateField('current', 'kh_pct', Number(e.target.value))} className="w-1/3 p-3 border border-slate-200 rounded-xl text-center font-bold text-slate-600 outline-none"><option value={0}>0%</option><option value={2.5}>2.5%</option><option value={5}>5%</option><option value={7.5}>7.5%</option></select>
                        <select value={compData.current.kh_base_type} onChange={e=>updateField('current', 'kh_base_type', e.target.value)} className="w-2/3 p-3 border border-slate-200 rounded-xl text-[12px] font-bold text-slate-600 outline-none"><option value="base">מבסיס</option><option value="total">מכולל</option><option value="ceiling">עד תקרה</option></select>
                      </div>
                    </td>
                  )}
                </tr>

                <tr className="bg-slate-100/50 font-bold"><td colSpan={colSpan} className="p-3 text-slate-500 text-[11px] uppercase tracking-wider">הטבות נלוות (שווי)</td></tr>
                <tr><td className="p-4 font-bold text-[#002649]">כרטיס הסעדה</td><td className="p-3 border-r border-slate-100"><input type="number" value={compData.proposed.meals || ''} onChange={e=>updateField('proposed', 'meals', Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl text-center font-bold text-slate-700 outline-none" /></td>{isComparative && <td className="p-3 border-r border-slate-100"><input type="number" value={compData.current.meals || ''} onChange={e=>updateField('current', 'meals', Number(e.target.value))} className="w-full p-3 border border-slate-200 rounded-xl text-center font-bold text-slate-600 outline-none" /></td>}</tr>
                <tr><td className="p-4 font-bold text-[#002649]">נסיעות חודשי</td><td className="p-3 border-r border-slate-100"><input type="number" value={compData.proposed.travel || ''} onChange={e=>updateField('proposed', 'travel', Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl text-center font-bold text-slate-700 outline-none" /></td>{isComparative && <td className="p-3 border-r border-slate-100"><input type="number" value={compData.current.travel || ''} onChange={e=>updateField('current', 'travel', Number(e.target.value))} className="w-full p-3 border border-slate-200 rounded-xl text-center font-bold text-slate-600 outline-none" /></td>}</tr>
                <tr><td className="p-4 font-bold text-[#002649]">שי לחג (גילום)</td><td className="p-3 border-r border-slate-100"><input type="number" value={compData.proposed.holiday || ''} onChange={e=>updateField('proposed', 'holiday', Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl text-center font-bold text-slate-700 outline-none" /></td>{isComparative && <td className="p-3 border-r border-slate-100"><input type="number" value={compData.current.holiday || ''} onChange={e=>updateField('current', 'holiday', Number(e.target.value))} className="w-full p-3 border border-slate-200 rounded-xl text-center font-bold text-slate-600 outline-none" /></td>}</tr>
                <tr><td className="p-4 font-bold text-[#002649]">הדרכה ורווחה</td><td className="p-3 border-r border-slate-100"><input type="number" value={compData.proposed.welfare || ''} onChange={e=>updateField('proposed', 'welfare', Number(e.target.value))} className="w-full p-3 bg-slate-50 rounded-xl text-center font-bold text-slate-700 outline-none" /></td>{isComparative && <td className="p-3 border-r border-slate-100"><input type="number" value={compData.current.welfare || ''} onChange={e=>updateField('current', 'welfare', Number(e.target.value))} className="w-full p-3 border border-slate-200 rounded-xl text-center font-bold text-slate-600 outline-none" /></td>}</tr>

                <tr className="bg-slate-100/50 font-bold"><td colSpan={colSpan} className="p-3 text-slate-500 text-[11px] uppercase tracking-wider">התאמות מיוחדות למסמך (שדה חופשי)</td></tr>
                {compData.proposed.customFields.map((field: CustomField) => (
                  <tr key={field.id}>
                    <td className="p-3 pl-6 relative">
                      <input type="text" value={field.label} onChange={e => updateCustomField('proposed', field.id, 'label', e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl font-bold text-[#002649] outline-none focus:border-[#EF6B00]" placeholder="שם הרכיב..." />
                      <button onClick={() => removeCustomField('proposed', field.id)} className="absolute left-2 top-6 text-slate-300 hover:text-red-500"><Trash2 size={20}/></button>
                    </td>
                    <td className="p-3 border-r border-slate-100"><input type="number" value={field.amount || ''} onChange={e=>updateCustomField('proposed', field.id, 'amount', Number(e.target.value))} className="w-full p-3 bg-orange-50/50 rounded-xl text-center font-black text-[#EF6B00] outline-none" placeholder="₪סכום" /></td>
                    {isComparative && <td className="p-3 border-r border-slate-100 text-center text-slate-300 text-sm bg-slate-50/50">לא זמין</td>}
                  </tr>
                ))}
                <tr>
                  <td colSpan={colSpan} className="p-4 text-center bg-white border-t border-slate-200">
                    <button onClick={() => addCustomField('proposed')} className="text-blue-600 font-bold text-sm flex items-center justify-center gap-2 mx-auto hover:text-blue-800"><PlusCircle size={16}/> הוסף רכיב נוסף (מענק, רכב, ביגוד)</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-8 relative overflow-hidden text-white shadow-xl mt-8">
            <h3 className="font-black text-blue-300 text-base mb-6 relative z-10 flex items-center gap-2">
              <ShieldCheck size={20}/> אזור מסווג למגייסת (לא מופיע במסמך השיווקי)
            </h3>
            <div className="grid grid-cols-2 gap-8 relative z-10">
              <div className="bg-white/10 p-5 rounded-2xl border border-white/10">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">עלות מעסיק חודשית מוערכת</p>
                <p className="text-4xl font-black text-white mt-2">₪{propMetrics.employer_cost.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
              </div>
              <div className="bg-white/10 p-5 rounded-2xl border border-white/10">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">תשלום לחברת השמה (חד פעמי)</p>
                  <select value={compData.proposed.agency_fee_pct} onChange={e=>updateField('proposed', 'agency_fee_pct', Number(e.target.value))} className="text-sm bg-slate-800 rounded-lg p-1.5 outline-none text-slate-200 font-bold border border-slate-700 cursor-pointer">
                    <option value={0}>ללא ספק (0%)</option>
                    <option value={80}>80% שכר</option>
                    <option value={100}>100% שכר</option>
                    <option value={120}>120% שכר</option>
                  </select>
                </div>
                <p className="text-4xl font-black text-red-400">₪{propMetrics.agency_fee.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Presentation Panel */}
        <div className="w-full xl:w-[500px] shrink-0">
          <div className="bg-[#002649] rounded-3xl p-10 shadow-2xl relative overflow-hidden flex flex-col text-white sticky top-10">
            <div className="absolute top-0 right-0 w-full h-3 bg-gradient-to-r from-transparent via-[#EF6B00] to-transparent opacity-50"></div>
            
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black mb-2 text-white">חבילת תגמול והצעת שכר</h2>
              <p className="text-lg font-bold text-[#EF6B00] mb-1">{personal.name} <span className="text-slate-400">|</span> {personal.role}</p>
              <p className="text-sm text-blue-200">יחידה: {personal.dept}</p>
            </div>

            <div className="bg-white/5 rounded-3xl p-8 text-center mb-10 border border-white/10">
              <p className="text-sm font-bold text-blue-300 uppercase tracking-widest mb-3">שווי חבילה חודשי (Total Rewards)</p>
              <div className="text-6xl font-black text-[#EF6B00]">₪{propMetrics.total_value.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
            </div>

            {isComparative && deltaValue !== 0 && (
              <div className={`mb-10 p-5 rounded-2xl border-2 flex items-center justify-between font-black text-xl ${deltaValue > 0 ? 'bg-green-500/20 border-green-400 text-green-300' : 'bg-red-500/20 border-red-400 text-red-300'}`}>
                <div className="flex items-center gap-3"><ArrowRightLeft size={24}/> פער שווי מהמצב הקיים:</div>
                <div>{deltaValue > 0 ? '+' : ''}₪{deltaValue.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
              </div>
            )}

            <div className="space-y-4 mb-10 text-base">
              <div className="flex justify-between font-bold border-b border-white/10 pb-3"><span className="text-slate-300">שכר בסיס + גלובליות</span><span>₪{propMetrics.gross.toLocaleString()}</span></div>
              <div className="flex justify-between font-bold border-b border-white/10 pb-3"><span className="text-slate-300">הפרשות סוציאליות (מעסיק)</span><span>₪{(propMetrics.total_value - propMetrics.gross - propMetrics.custom_value - compData.proposed.meals - compData.proposed.travel - compData.proposed.holiday - compData.proposed.welfare).toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
              <div className="flex justify-between font-bold border-b border-white/10 pb-3"><span className="text-slate-300">הטבות נלוות</span><span>₪{(compData.proposed.meals + compData.proposed.travel + compData.proposed.holiday + compData.proposed.welfare).toLocaleString()}</span></div>
              {propMetrics.custom_value > 0 && <div className="flex justify-between font-black border-b border-white/10 pb-3 pt-2"><span className="text-[#EF6B00]">תוספות ומענקים מיוחדים</span><span className="text-[#EF6B00]">₪{propMetrics.custom_value.toLocaleString()}</span></div>}
            </div>

            <div className="mt-auto">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-[11px] text-blue-200/60 leading-relaxed font-medium text-justify mb-8">
                <strong>הצהרה משפטית:</strong> המסמך הינו הצעת שכר שיווקית (סימולציה) בלבד ואינו מחייב בקשירת יחסי עובד-מעסיק. תוקף ההצעה ל-30 יום. כל סכום הנקוב כ"שווי" הינו ברוטו. תנאי ההעסקה הסופיים ייקבעו בהתאם לחוזה חתום בלבד.
              </div>
              <button onClick={handleGeneratePDF} className="w-full bg-[#EF6B00] text-white py-5 rounded-2xl font-black text-xl shadow-lg hover:shadow-xl hover:bg-[#d65a00] transition-all flex items-center justify-center gap-3">
                <Printer size={28}/> הדפס מסמך הצעת שכר (PDF)
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 3. Smart Onboarding Wizard (4 Steps Flow)
// ==========================================
interface OnboardingTask { id: number; text: string; done: boolean }

function SmartOnboarding() {
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

  // חישוב אוטומטי של תאריך חבר מביא חבר
  useEffect(() => {
    if (formData.startDate && formData.isReferral && !formData.refDate) {
      const d = new Date(formData.startDate);
      d.setMonth(d.getMonth() + 3);
      setFormData(prev => ({ ...prev, refDate: d.toISOString().split('T')[0] }));
    }
  }, [formData.startDate, formData.isReferral, formData.refDate]);

  // לוגיקת החסימה והסנכרון בין רכב לחניה
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

          {/* Stepper עם יישור מושלם לאמצע */}
          <div className="relative w-full max-w-5xl mx-auto mt-6">
            {/* פס הרקע האפור */}
            <div className="absolute top-5 left-12 right-12 h-1.5 bg-slate-100 -z-10 rounded-full overflow-hidden">
               {/* פס ההתקדמות הכתום */}
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

      {/* אזור התוכן הראשי - רחב ומרווח למניעת מסגרת כפולה */}
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
            
            {/* עמודה ימנית: מועמדות וגיוון */}
            <div className="bg-slate-50/50 rounded-3xl border border-slate-100 p-8 space-y-6">
              <h3 className="text-xl font-black text-[#002649] border-b pb-3">הפניות וגיוון באוכלוסיה</h3>
              
              <div className="space-y-5">
                <label htmlFor="wz-ref" className="flex items-center gap-3 p-5 border rounded-xl bg-white shadow-sm cursor-pointer transition-all hover:border-[#EF6B00]">
                  <input id="wz-ref" type="checkbox" checked={formData.isReferral} onChange={e=>setFormData({...formData, isReferral: e.target.checked})} className="w-6 h-6 accent-[#002649]" />
                  <span className="font-black text-lg text-[#002649]">נקלט במסגרת 'חבר מביא חבר'</span>
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

            {/* עמודה שמאלית: זכאויות לוגיסטיות */}
            <div className="bg-slate-50/50 rounded-3xl border border-slate-100 p-8 space-y-6">
              <h3 className="text-xl font-black text-[#002649] border-b pb-3">זכאויות ולוגיסטיקה</h3>
              
              <div className="flex gap-8 p-5 bg-white shadow-sm rounded-xl border border-slate-200 mb-6">
                <label htmlFor="wz-mob" className="flex items-center gap-2 cursor-pointer font-black text-[#002649]"><input id="wz-mob" type="checkbox" checked={formData.hasMobile} onChange={e=>setFormData({...formData, hasMobile: e.target.checked})} className="w-5 h-5 accent-[#EF6B00]"/> זכאות לנייד</label>
                <label htmlFor="wz-cib" className="flex items-center gap-2 cursor-pointer font-black text-[#002649]"><input id="wz-cib" type="checkbox" checked={formData.hasCibus} onChange={e=>setFormData({...formData, hasCibus: e.target.checked})} className="w-5 h-5 accent-[#EF6B00]"/> כרטיס הסעדה</label>
                <label htmlFor="wz-car" className="flex items-center gap-2 cursor-pointer font-black text-[#002649]"><input id="wz-car" type="checkbox" checked={formData.hasCar} onChange={e=>setFormData({...formData, hasCar: e.target.checked})} className="w-5 h-5 accent-[#EF6B00]"/> זכאות לרכב חברה</label>
              </div>

              {/* לוגיקת החניה והרכב (מופרדת כפי שביקשת) */}
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
                  <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-[#EF6B00]" /> העובד יעבור אוטומטית לטבלת "ממתינים לקליטה".</li>
                  <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-[#EF6B00]" /> לוגים ישלחו למחלקות (HRO, לוגיסטיקה, גיוון).</li>
                  {formData.isReferral && <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" /> טריגר תשלום (חמ"ח) ינעל מול השכר ל-{formData.refDate}.</li>}
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

// ==========================================
// 4. AI Reports Generator
// ==========================================
function ReportsGenerator() {
  const [generating, setGenerating] = useState(false);
  
  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tools/generate-report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: "weekly" })
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'Report.pdf'; document.body.appendChild(a); a.click(); a.remove();
    } catch {
      globalThis.alert("שגיאה בהפקת הדוח.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30 p-6 rounded-b-3xl">
      <div className="max-w-xl mx-auto mt-10 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        <div>
          <h2 className="text-xl font-black text-[#002649] flex items-center gap-2 mb-2"><FileText className="text-blue-500"/> מחולל דוחות (PDF)</h2>
          <p className="text-sm text-slate-500">שאיבת נתונים מה-Database האמיתי של המערכת ויצירת דוח סיכום להנהלה.</p>
        </div>
        <button onClick={handleGeneratePDF} disabled={generating} className="w-full bg-[#002649] text-white py-4 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-[#EF6B00] transition-colors shadow-md disabled:opacity-70 text-lg">
          {generating ? <Loader2 className="animate-spin" size={24}/> : <Download size={24}/>}
          {generating ? 'מייצר קובץ...' : 'הורד דוח שבועי (PDF)'}
        </button>
      </div>
    </div>
  );
}

// Helpers
interface ComingSoonProps { title: string; icon: React.ReactNode }
function ComingSoon({ title, icon }: Readonly<ComingSoonProps>) {
  return ( <div className="py-32 flex flex-col items-center justify-center text-slate-400 text-center animate-in fade-in zoom-in-95 bg-slate-50/50 rounded-b-3xl"><div className="mb-6">{icon}</div><h3 className="font-black text-2xl text-slate-300 mb-2">{title}</h3><p className="text-sm font-medium max-w-md">מודול בבנייה</p></div> );
}