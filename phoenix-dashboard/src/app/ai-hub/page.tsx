"use client";

import React, { useState } from "react";
import { 
  Bot, FileText, Send, UserPlus,
  Sparkles, CheckCircle2, ArrowRightLeft, 
  Server, ShieldCheck, Loader2,
  BadgeDollarSign, Download, Trash2, PlusCircle, Printer
} from "lucide-react";

export default function SuperAiHub() {
  const [activeTab, setActiveTab] = useState("mobility");

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 relative pb-20 px-4 md:px-8 h-screen flex flex-col">
      
      <div className="shrink-0 pt-6 border-b border-slate-200 pb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
              ארגז כלים <Sparkles className="text-[#EF6B00]" size={28} />
            </h1>
            <p className="text-slate-500 mt-2 font-medium">ארגז הכלים היומיומי: סימולציות שכר, אוטומציות ומחוללי דוחות.</p>
          </div>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-2">
          <TopTab id="mobility" current={activeTab} onClick={setActiveTab} icon={<ArrowRightLeft size={16}/>} title="סימולטור שכר וניוד" />
          <TopTab id="onboarding" current={activeTab} onClick={setActiveTab} icon={<UserPlus size={16}/>} title="קליטת עובד (Onboarding)" />
          <TopTab id="reports" current={activeTab} onClick={setActiveTab} icon={<FileText size={16}/>} title="מחולל דוחות AI" />
          <TopTab id="chat" current={activeTab} onClick={setActiveTab} icon={<Bot size={16}/>} title="עוזר תקשורת AI" />
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
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
    <div className="flex flex-col h-full bg-slate-50/50">
      
      <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center gap-4 bg-white">
        <h2 className="text-xl font-black text-[#002649] flex items-center gap-2"><BadgeDollarSign className="text-emerald-500"/> מנוע חישוב: סימולטור שכר (Total Rewards)</h2>
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner shrink-0">
          <button onClick={() => setIsComparative(false)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isComparative ? 'bg-white text-[#002649] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>הצעת שכר (Stand Alone)</button>
          <button onClick={() => setIsComparative(true)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isComparative ? 'bg-white text-[#002649] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>השוואה למצב קיים</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col xl:flex-row gap-6">
        
        <div className="flex-1 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-[#002649] border-b border-slate-100 pb-2 mb-4">פרטים אישיים ומזהים</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label htmlFor="cb-name" className="text-[10px] font-bold text-slate-500 uppercase">שם מועמד.ת</label><input id="cb-name" type="text" value={personal.name} onChange={e=>setPersonal({...personal, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold text-[#002649] outline-none" /></div>
              <div><label htmlFor="cb-id" className="text-[10px] font-bold text-slate-500 uppercase">ת.ז</label><input id="cb-id" type="text" value={personal.id} onChange={e=>setPersonal({...personal, id: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold text-[#002649] outline-none" /></div>
              <div><label htmlFor="cb-role" className="text-[10px] font-bold text-slate-500 uppercase">תפקיד מיועד</label><input id="cb-role" type="text" value={personal.role} onChange={e=>setPersonal({...personal, role: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold text-[#002649] outline-none" /></div>
              <div><label htmlFor="cb-dept" className="text-[10px] font-bold text-slate-500 uppercase">יחידה ארגונית</label><input id="cb-dept" type="text" value={personal.dept} onChange={e=>setPersonal({...personal, dept: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold text-[#002649] outline-none" /></div>
              <div><label htmlFor="cb-mgr" className="text-[10px] font-bold text-slate-500 uppercase">מנהל ישיר</label><input id="cb-mgr" type="text" value={personal.manager} onChange={e=>setPersonal({...personal, manager: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold text-[#002649] outline-none" /></div>
              <div><label htmlFor="cb-date" className="text-[10px] font-bold text-slate-500 uppercase">תאריך קליטה</label><input id="cb-date" type="date" value={personal.startDate} onChange={e=>setPersonal({...personal, startDate: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold text-[#002649] outline-none text-slate-600" /></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#002649] text-white">
                <tr>
                  <th className="p-3 font-bold">רכיב תגמול</th>
                  <th className="p-3 font-bold text-center border-r border-white/20 w-64">הצעה חדשה</th>
                  {isComparative && <th className="p-3 font-bold text-center border-r border-white/20 bg-slate-800 w-56">מצב נוכחי</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-100/50 font-bold"><td colSpan={colSpan} className="p-2 text-slate-500 text-[10px] uppercase">שכר בסיס ותוספות</td></tr>
                <tr>
                  <td className="p-3 font-bold text-[#002649]">שכר בסיס (ברוטו)</td>
                  <td className="p-2 border-r border-slate-100"><input type="number" value={compData.proposed.base || ''} onChange={e=>updateField('proposed', 'base', Number(e.target.value))} className="w-full p-2 bg-blue-50/50 rounded-lg text-center font-bold text-blue-700 outline-none" /></td>
                  {isComparative && <td className="p-2 border-r border-slate-100"><input type="number" value={compData.current.base || ''} onChange={e=>updateField('current', 'base', Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-600 outline-none" /></td>}
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[#002649]">נוספות גלובליות</td>
                  <td className="p-2 border-r border-slate-100"><input type="number" value={compData.proposed.global || ''} onChange={e=>updateField('proposed', 'global', Number(e.target.value))} className="w-full p-2 bg-blue-50/50 rounded-lg text-center font-bold text-blue-700 outline-none" /></td>
                  {isComparative && <td className="p-2 border-r border-slate-100"><input type="number" value={compData.current.global || ''} onChange={e=>updateField('current', 'global', Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-600 outline-none" /></td>}
                </tr>

                <tr className="bg-slate-100/50 font-bold"><td colSpan={colSpan} className="p-2 text-slate-500 text-[10px] uppercase">סוציאלי (הפרשות מעסיק)</td></tr>
                <tr>
                  <td className="p-3 font-bold text-[#002649]">פנסיה / תגמולים</td>
                  <td className="p-2 border-r border-slate-100"><select value={compData.proposed.pension_pct} onChange={e=>updateField('proposed', 'pension_pct', Number(e.target.value))} className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold text-slate-700 outline-none"><option value={5}>5.00%</option><option value={6}>6.00%</option><option value={6.5}>6.50%</option><option value={7.5}>7.50%</option></select></td>
                  {isComparative && <td className="p-2 border-r border-slate-100"><select value={compData.current.pension_pct} onChange={e=>updateField('current', 'pension_pct', Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-600 outline-none"><option value={5}>5.00%</option><option value={6}>6.00%</option><option value={6.5}>6.50%</option><option value={7.5}>7.50%</option></select></td>}
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[#002649] flex flex-col gap-1">
                    קרן השתלמות
                  </td>
                  <td className="p-2 border-r border-slate-100">
                    <div className="flex gap-2">
                      <select value={compData.proposed.kh_pct} onChange={e=>updateField('proposed', 'kh_pct', Number(e.target.value))} className="w-1/3 p-2 bg-slate-50 rounded-lg text-center font-bold text-slate-700 outline-none"><option value={0}>0%</option><option value={2.5}>2.5%</option><option value={5}>5%</option><option value={7.5}>7.5%</option></select>
                      <select value={compData.proposed.kh_base_type} onChange={e=>updateField('proposed', 'kh_base_type', e.target.value)} className="w-2/3 p-2 bg-slate-50 rounded-lg text-xs font-bold text-slate-700 outline-none">
                        <option value="base">משכר בסיס בלבד</option>
                        <option value="total">משכר בסיס + גלובליות</option>
                        <option value="ceiling">עד תקרת מס (15,712)</option>
                      </select>
                    </div>
                  </td>
                  {isComparative && (
                    <td className="p-2 border-r border-slate-100">
                      <div className="flex gap-1">
                        <select value={compData.current.kh_pct} onChange={e=>updateField('current', 'kh_pct', Number(e.target.value))} className="w-1/3 p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-600 outline-none"><option value={0}>0%</option><option value={2.5}>2.5%</option><option value={5}>5%</option><option value={7.5}>7.5%</option></select>
                        <select value={compData.current.kh_base_type} onChange={e=>updateField('current', 'kh_base_type', e.target.value)} className="w-2/3 p-2 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 outline-none"><option value="base">מבסיס</option><option value="total">מכולל</option><option value="ceiling">עד תקרה</option></select>
                      </div>
                    </td>
                  )}
                </tr>

                <tr className="bg-slate-100/50 font-bold"><td colSpan={colSpan} className="p-2 text-slate-500 text-[10px] uppercase">הטבות נלוות (שווי)</td></tr>
                <tr><td className="p-3 font-bold text-[#002649]">כרטיס הסעדה</td><td className="p-2 border-r border-slate-100"><input type="number" value={compData.proposed.meals || ''} onChange={e=>updateField('proposed', 'meals', Number(e.target.value))} className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold text-slate-700 outline-none" /></td>{isComparative && <td className="p-2 border-r border-slate-100"><input type="number" value={compData.current.meals || ''} onChange={e=>updateField('current', 'meals', Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-600 outline-none" /></td>}</tr>
                <tr><td className="p-3 font-bold text-[#002649]">נסיעות חודשי</td><td className="p-2 border-r border-slate-100"><input type="number" value={compData.proposed.travel || ''} onChange={e=>updateField('proposed', 'travel', Number(e.target.value))} className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold text-slate-700 outline-none" /></td>{isComparative && <td className="p-2 border-r border-slate-100"><input type="number" value={compData.current.travel || ''} onChange={e=>updateField('current', 'travel', Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-600 outline-none" /></td>}</tr>
                <tr><td className="p-3 font-bold text-[#002649]">שי לחג (גילום)</td><td className="p-2 border-r border-slate-100"><input type="number" value={compData.proposed.holiday || ''} onChange={e=>updateField('proposed', 'holiday', Number(e.target.value))} className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold text-slate-700 outline-none" /></td>{isComparative && <td className="p-2 border-r border-slate-100"><input type="number" value={compData.current.holiday || ''} onChange={e=>updateField('current', 'holiday', Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-600 outline-none" /></td>}</tr>
                <tr><td className="p-3 font-bold text-[#002649]">הדרכה ורווחה</td><td className="p-2 border-r border-slate-100"><input type="number" value={compData.proposed.welfare || ''} onChange={e=>updateField('proposed', 'welfare', Number(e.target.value))} className="w-full p-2 bg-slate-50 rounded-lg text-center font-bold text-slate-700 outline-none" /></td>{isComparative && <td className="p-2 border-r border-slate-100"><input type="number" value={compData.current.welfare || ''} onChange={e=>updateField('current', 'welfare', Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-center font-bold text-slate-600 outline-none" /></td>}</tr>

                <tr className="bg-slate-100/50 font-bold"><td colSpan={colSpan} className="p-2 text-slate-500 text-[10px] uppercase">התאמות מיוחדות למסמך (שדה חופשי)</td></tr>
                {compData.proposed.customFields.map((field: CustomField) => (
                  <tr key={field.id}>
                    <td className="p-2 pl-6 relative">
                      <input type="text" value={field.label} onChange={e => updateCustomField('proposed', field.id, 'label', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-bold text-[#002649] outline-none focus:border-[#EF6B00]" placeholder="שם הרכיב..." />
                      <button onClick={() => removeCustomField('proposed', field.id)} className="absolute left-2 top-4 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </td>
                    <td className="p-2 border-r border-slate-100"><input type="number" value={field.amount || ''} onChange={e=>updateCustomField('proposed', field.id, 'amount', Number(e.target.value))} className="w-full p-2 bg-orange-50/50 rounded-lg text-center font-black text-[#EF6B00] outline-none" placeholder="₪סכום" /></td>
                    {isComparative && <td className="p-2 border-r border-slate-100 text-center text-slate-300 text-xs bg-slate-50/50">לא זמין</td>}
                  </tr>
                ))}
                <tr>
                  <td colSpan={colSpan} className="p-3 text-center bg-white border-t border-slate-200">
                    <button onClick={() => addCustomField('proposed')} className="text-blue-600 font-bold text-xs flex items-center justify-center gap-1 mx-auto hover:text-blue-800"><PlusCircle size={14}/> הוסף רכיב נוסף (מענק, רכב, ביגוד)</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 relative overflow-hidden text-white shadow-xl mt-8">
            <h3 className="font-black text-blue-300 text-sm mb-4 relative z-10 flex items-center gap-2">
              <ShieldCheck size={18}/> אזור מסווג למגייסת (לא מופיע במסמך השיווקי)
            </h3>
            <div className="grid grid-cols-2 gap-6 relative z-10">
              <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                <p className="text-xs font-bold text-slate-400 uppercase">עלות מעסיק חודשית מוערכת</p>
                <p className="text-3xl font-black text-white mt-1">₪{propMetrics.employer_cost.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
              </div>
              <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-slate-400 uppercase">תשלום השמה / ספק (חד פעמי)</p>
                  <select value={compData.proposed.agency_fee_pct} onChange={e=>updateField('proposed', 'agency_fee_pct', Number(e.target.value))} className="text-xs bg-slate-800 rounded p-1 outline-none text-slate-200 font-bold border border-slate-700">
                    <option value={0}>ללא ספק (0%)</option>
                    <option value={80}>80% שכר</option>
                    <option value={100}>100% שכר</option>
                    <option value={120}>120% שכר</option>
                  </select>
                </div>
                <p className="text-3xl font-black text-red-400">₪{propMetrics.agency_fee.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full xl:w-[480px] shrink-0 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#002649] to-[#EF6B00]"></div>
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-[#002649] mb-1">חבילת תגמול והצעת שכר</h2>
              <p className="text-sm font-bold text-[#EF6B00]">{personal.name} | {personal.role}</p>
              <p className="text-xs text-slate-400 mt-1">יחידה: {personal.dept}</p>
            </div>

            <div className="bg-[#002649] text-white rounded-2xl p-6 text-center mb-6 shadow-md transform hover:scale-105 transition-transform">
              <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">שווי חבילה חודשי (Total Rewards)</p>
              <div className="text-5xl font-black text-[#EF6B00]">₪{propMetrics.total_value.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
            </div>

            {isComparative && deltaValue !== 0 && (
              <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between font-bold ${deltaValue > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                <div className="flex items-center gap-2"><ArrowRightLeft size={18}/> פער שווי חבילה:</div>
                <div className="text-xl">{deltaValue > 0 ? '+' : ''}₪{deltaValue.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
              </div>
            )}

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm font-bold border-b border-slate-100 pb-2"><span className="text-slate-500">שכר בסיס + גלובליות</span><span className="text-[#002649]">₪{propMetrics.gross.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm font-bold border-b border-slate-100 pb-2"><span className="text-slate-500">הפרשות סוציאליות (מעסיק)</span><span className="text-[#002649]">₪{(propMetrics.total_value - propMetrics.gross - propMetrics.custom_value - compData.proposed.meals - compData.proposed.travel - compData.proposed.holiday - compData.proposed.welfare).toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
              <div className="flex justify-between text-sm font-bold border-b border-slate-100 pb-2"><span className="text-slate-500">הטבות נלוות</span><span className="text-[#002649]">₪{(compData.proposed.meals + compData.proposed.travel + compData.proposed.holiday + compData.proposed.welfare).toLocaleString()}</span></div>
              {propMetrics.custom_value > 0 && <div className="flex justify-between text-sm font-black border-b border-slate-100 pb-2 pt-2"><span className="text-[#EF6B00]">תוספות מיוחדות</span><span className="text-[#EF6B00]">₪{propMetrics.custom_value.toLocaleString()}</span></div>}
            </div>

            <div className="flex-1"></div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[10px] text-slate-500 leading-relaxed font-medium text-justify">
              <strong>הצהרה משפטית:</strong> המסמך הינו הצעת שכר שיווקית (סימולציה) בלבד ואינו מחייב את הפניקס בקשירת יחסי עובד-מעסיק. תוקף ההצעה הינו ל-30 יום. כל סכום הנקוב כ&quot;שווי&quot; הינו הערכת ברוטו לפני ניכויים כחוק. תנאי ההעסקה הסופיים ייקבעו בהתאם לחוזה חתום בלבד.
            </div>
          </div>

          <button onClick={handleGeneratePDF} className="w-full bg-[#EF6B00] text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:shadow-xl hover:bg-[#d65a00] transition-all flex items-center justify-center gap-2">
            <Printer size={24}/> הפק הצעת שכר (לשליחה למועמד)
          </button>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 3. Smart Onboarding Form (Live API)
// ==========================================
interface OnboardingTicket { dept: string; status: string }

function SmartOnboarding() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: "", role: "מפתח Backend Java", idNum: "", date: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [tickets, setTickets] = useState<OnboardingTicket[]>([]);
  
  const handleLaunch = async () => {
    if (!formData.name) { globalThis.alert("חובה להזין שם עובד"); return; }
    setStep(2);
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tools/fan-out`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
      });
      const data = await res.json();
      if(data.status === "success") { setTickets(data.tickets); setStep(3); }
    } catch {
      globalThis.alert("שגיאת תקשורת מול שרת ה-IT"); setStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30 p-6">
      <div className="max-w-2xl mx-auto w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in">
            <div>
              <h2 className="text-xl font-black text-[#002649] flex items-center gap-2 mb-1"><UserPlus className="text-blue-500"/> טופס קליטה מרכזי (Smart Onboarding)</h2>
              <p className="text-sm text-slate-500">הזן נתונים ולחץ שיגור. המערכת תפתח טיקטים אוטומטית במערכות ה-IT והלוגיסטיקה.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div><label htmlFor="ob-name" className="block text-xs font-bold text-slate-500 mb-2">שם העובד.ת הנקלט</label><input id="ob-name" type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-2.5 border rounded-xl outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="ob-id" className="block text-xs font-bold text-slate-500 mb-2">תעודת זהות</label><input id="ob-id" type="text" value={formData.idNum} onChange={e=>setFormData({...formData, idNum: e.target.value})} className="w-full p-2.5 border rounded-xl outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="ob-role" className="block text-xs font-bold text-slate-500 mb-2">תפקיד מיועד</label><input id="ob-role" type="text" value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} className="w-full p-2.5 border rounded-xl outline-none focus:border-[#EF6B00]" /></div>
              <div><label htmlFor="ob-date" className="block text-xs font-bold text-slate-500 mb-2">תאריך תחילת עבודה</label><input id="ob-date" type="date" value={formData.date} onChange={e=>setFormData({...formData, date: e.target.value})} className="w-full p-2.5 border rounded-xl outline-none focus:border-[#EF6B00] text-slate-600" /></div>
            </div>
            <button onClick={handleLaunch} className="w-full bg-[#002649] text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-[#EF6B00] transition-colors shadow-lg mt-4">
              <Send size={18}/> שגר תהליך קליטה
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="py-20 flex flex-col items-center justify-center space-y-6">
            <Loader2 size={48} className="text-[#EF6B00] animate-spin" />
            <h3 className="font-black text-xl text-[#002649]">משדר נתונים למערכות התפעול...</h3>
          </div>
        )}
        {step === 3 && (
          <div className="py-10 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner"><CheckCircle2 size={48} /></div>
            <div className="text-center">
              <h3 className="font-black text-2xl text-[#002649] mb-2">שיגור בוצע בהצלחה</h3>
              <p className="text-slate-500 mb-8">נפתחו טיקטים עבור {formData.name}:</p>
              <div className="flex flex-wrap justify-center gap-4 text-left">
                {tickets.map((t) => (
                  <div key={t.dept} className="bg-slate-50 border border-slate-200 p-3 rounded-xl min-w-[120px]">
                    <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase mb-1"><Server size={14}/> {t.dept}</div>
                    <div className="font-black text-[#002649] text-xs">{t.status}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => {setStep(1); setFormData({name:"", role:"", idNum:"", date:""});}} className="mt-8 text-blue-600 font-bold text-sm hover:underline">קלוט עובד נוסף</button>
          </div>
        )}
      </div>
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
    <div className="flex flex-col h-full bg-slate-50/30 p-6">
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
  return ( <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center animate-in fade-in zoom-in-95"><div className="mb-6">{icon}</div><h3 className="font-black text-2xl text-slate-300 mb-2">{title}</h3><p className="text-sm font-medium max-w-md">מודול בבנייה</p></div> );
}
