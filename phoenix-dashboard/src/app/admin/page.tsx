"use client";

import React, { useState, useRef } from "react";
import {
  Users, Building2, Receipt, Target, Workflow, Clock, FileText, Loader2,
  CheckCircle2, Plus, HeartHandshake, Power, Briefcase, Calculator, Sparkles,
  UserMinus, X, Zap, Scale, Save, BarChart3, Layers, ShieldCheck
} from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export interface FileStatus {
  name: string;
  date: string;
  rows: string;
}

export default function AdminCommandCenter() {
  const [activeTab, setActiveTab] = useState("data");
  const [isUploading, setIsUploading] = useState<string | null>(null);

  // --- AI Insights Logic ---
  const [aiInsight, setAiInsight] = useState("מזהה מגמת ירידה ב-SLA בחטיבת הטכנולוגיה. האם תרצה לייצר אוטומציה שתשלח תזכורת למנהלים?");
  const insightsPool = [
    "לפי הבנצ'מארק, נהוג שלכל מגייסת יש 20 משרות. אצלך הממוצע הוא 28. בצע התאמות במשאבים.",
    "זוהה צוואר בקבוק בשלב 'ראיון מקצועי' במחלקת כספים. מומלץ לקצר את זמן ההמתנה ל-48 שעות.",
    "מקור הגיוס 'לינקדאין' מציג יחס המרה גבוה ב-30% מהממוצע החודשי. מומלץ להסיט תקציב סורסינג.",
    "אחוז העזיבה בשנה הראשונה נמוך מהבנצ'מארק (8% מול 11%). איכות הגיוס שלך מצוינת."
  ];

  const handleCloseInsight = () => {
    setAiInsight("");
    setTimeout(() => {
      const next = insightsPool[Math.floor(Math.random() * insightsPool.length)];
      setAiInsight(next);
    }, 3000);
  };

  // --- Dynamic Lists (Targets & Automations) ---
  const [targets, setTargets] = useState<{ id: string; label: string; value: number; unit: string; active: boolean }[]>([
    { id: "t1", label: "TTF מקסימלי (R&D)", value: 45, unit: "ימים", active: true },
    { id: "t2", label: "TTF מקסימלי (שירות)", value: 14, unit: "ימים", active: true },
    { id: "t3", label: "כמות משרות למגייס", value: 20, unit: "תקנים", active: true },
    { id: "t4", label: "יעד גיוון (עובדי מוגבלות)", value: 3, unit: "%", active: true }
  ]);

  const [automations, setAutomations] = useState<{ id: string; if: string; action: string; active: boolean }[]>([
    { id: "a1", if: "חריגת SLA משוב מנהל > 48 שעות", action: "שלח 'פינג' למנהל המגייס במייל", active: true },
    { id: "a2", if: "מועמד ללא תזוזה > 10 ימים", action: "צור משימת Ghosting באינבוקס", active: true },
    { id: "a3", if: "סגירת משרה (Hired)", action: "שלח Fan-out ל-IT ולוגיסטיקה", active: true }
  ]);

  const [showNewTarget, setShowNewTarget] = useState(false);
  const [showNewAuto, setShowNewAuto] = useState(false);
  const [newTarget, setNewTarget] = useState({ label: "", value: "", unit: "ימים" });
  const [newAuto, setNewAuto] = useState({ if: "", action: "" });

  const addNewTarget = () => {
    if (!newTarget.label || !newTarget.value) return;
    setTargets([...targets, { id: `t-${Date.now()}`, ...newTarget, value: Number(newTarget.value), active: true }]);
    setShowNewTarget(false);
    setNewTarget({ label: "", value: "", unit: "ימים" });
  };

  const addNewAuto = () => {
    if (!newAuto.if || !newAuto.action) return;
    setAutomations([...automations, { id: `a-${Date.now()}`, ...newAuto, active: true }]);
    setShowNewAuto(false);
    setNewAuto({ if: "", action: "" });
  };

  // --- דאטה וקבצים ---
  const fileRefs: Record<string, React.RefObject<HTMLInputElement | null>> = {
    candidates: useRef<HTMLInputElement>(null), jobs: useRef<HTMLInputElement>(null), hires: useRef<HTMLInputElement>(null),
    diversity: useRef<HTMLInputElement>(null), headcount: useRef<HTMLInputElement>(null), budget: useRef<HTMLInputElement>(null), attrition: useRef<HTMLInputElement>(null)
  };

  const [filesStatus, setFilesStatus] = useState<Record<string, FileStatus>>({
    candidates: { name: "candidates_feb_26.xlsx", date: "16/02/2026", rows: "12,450" },
    jobs: { name: "open_roles_prod.csv", date: "15/02/2026", rows: "84" },
    hires: { name: "hires_q1.xlsx", date: "14/02/2026", rows: "28" },
    diversity: { name: "diversity_manual.xlsx", date: "01/02/2026", rows: "105" },
    headcount: { name: "fnx_headcount.csv", date: "16/02/2026", rows: "3,500" },
    budget: { name: "budget_actuals.xlsx", date: "10/02/2026", rows: "₪450K" },
    attrition: { name: "attrition_logs.csv", date: "16/02/2026", rows: "12" },
  });

  const handleUpload = (type: string) => {
    setIsUploading(type);
    setTimeout(() => {
      setFilesStatus((prev: Record<string, FileStatus>) => ({
        ...prev,
        [type]: { name: "קובץ_מעודכן.xlsx", date: "ממש עכשיו", rows: "מעבד..." }
      }));
      setIsUploading(null);
    }, 2000);
  };

  const FILE_META: Record<string, { title: string; icon: React.ReactNode; color: string }> = {
    candidates: { title: "דוח מועמדים (ATS)", icon: <Users size={24} />, color: "blue" },
    jobs: { title: "דוח משרות פתוחות", icon: <Briefcase size={24} />, color: "orange" },
    hires: { title: "דוח קליטות", icon: <CheckCircle2 size={24} />, color: "green" },
    diversity: { title: "גיוון והכלה", icon: <HeartHandshake size={24} />, color: "pink" },
    headcount: { title: "תקן מצבה (Headcount)", icon: <Building2 size={24} />, color: "purple" },
    budget: { title: "דוח תקציב", icon: <Receipt size={24} />, color: "emerald" },
    attrition: { title: "דוח עזיבות", icon: <UserMinus size={24} />, color: "red" }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* --- AI INSIGHT BUILDER --- */}
      {aiInsight && (
        <div className="bg-gradient-to-l from-[#002649] to-blue-900 text-white p-6 rounded-3xl shadow-xl border-r-8 border-[#EF6B00] relative animate-in slide-in-from-top-4">
          <button onClick={handleCloseInsight} className="absolute top-4 left-4 text-white/50 hover:text-white"><X size={20}/></button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#EF6B00] rounded-2xl shadow-lg animate-pulse"><Sparkles size={24} /></div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-widest text-[#EF6B00]">AI System Scan</h3>
              <p className="text-lg font-medium">{aiInsight}</p>
              <div className="flex gap-3 mt-4">
                <button className="bg-[#EF6B00] text-white px-4 py-2 rounded-xl font-black text-xs hover:scale-105 transition-all">בצע התאמות במדדים</button>
                <button onClick={handleCloseInsight} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-black text-xs transition-all">סרוק שוב</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- NAVIGATION --- */}
      <div className="flex gap-4 p-1 bg-slate-200/50 rounded-2xl w-fit">
        <TabNav id="data" active={activeTab} setter={setActiveTab} icon={<FileText size={18}/>} label="ניהול דאטה (Dropzones)" />
        <TabNav id="logic" active={activeTab} setter={setActiveTab} icon={<Calculator size={18}/>} label="לוגיקה ובנצ'מארקים" />
        <TabNav id="targets" active={activeTab} setter={setActiveTab} icon={<Target size={18}/>} label="מפעל יעדים ואוטומציות" />
        <TabNav id="analytics" active={activeTab} setter={setActiveTab} icon={<BarChart3 size={18}/>} label="ניטור ביצועי AI" />
      </div>

      {/* --- TAB 1: DATA DROPZONES --- */}
      {activeTab === "data" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-right-4">
          {Object.keys(filesStatus).map((key) => {
            const meta = FILE_META[key];
            return (
              <DropzoneBox
                key={key}
                title={meta.title}
                icon={meta.icon}
                color={meta.color}
                status={filesStatus[key]}
                inputRef={fileRefs[key]}
                onUpload={() => handleUpload(key)}
                uploading={isUploading === key}
              />
            );
          })}
        </div>
      )}

      {/* --- TAB 2: LOGIC & BENCHMARKS --- */}
      {activeTab === "logic" && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="font-black text-xl text-[#002649] flex items-center gap-2 px-2"><Calculator className="text-[#EF6B00]"/> נוסחאות המערכת</h3>
              <FormulaCard title="Time To Fill (TTF)" formula="Median(Contract_Date - Open_Date)" logic="מחושב חציונית לנטרול חריגים. בנצ'מארק שוק: 42 ימים." />
              <FormulaCard title="SLA משוב מנהל" formula="Avg(Feedback_Date - Forward_Date)" logic="זמן תגובה ממוצע של מנהל מגייס בשעות." />
              <FormulaCard title="Cost Per Hire (CPH)" formula="(Budget_Sum / Hires_Count)" logic="עלות כוללת של המקורות חלקי כמות המגויסים." />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8">
              <h3 className="font-black text-xl text-[#002649] flex items-center gap-2 mb-6"><Scale className="text-blue-500"/> Market Benchmarks (IL 2026)</h3>
              <div className="space-y-4">
                <BenchmarkRow label="TTF ממוצע בשוק (טכנולוגיה)" value="42 ימים" />
                <BenchmarkRow label="משרות פעילות למגייס" value="18-22 משרות" />
                <BenchmarkRow label="עלות גיוס ממוצעת" value="₪28,400" />
                <BenchmarkRow label="אחוז עזיבה בשנה הראשונה" value="11%" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: TARGETS & AUTOMATIONS --- */}
      {activeTab === "targets" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-right-4">
          
          {/* ניהול יעדים */}
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-[#002649] flex items-center gap-2"><Target className="text-[#EF6B00]"/> יעדי מחלקה (Targets)</h3>
              <button onClick={() => setShowNewTarget(true)} className="bg-slate-900 text-white p-2 rounded-xl hover:bg-[#EF6B00] transition-all"><Plus size={20}/></button>
            </div>

            {showNewTarget && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-orange-900 text-sm">הגדרת יעד חדש</span>
                  <button onClick={() => setShowNewTarget(false)}><X size={16}/></button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <input type="text" placeholder="שם המדד" className="p-2 border rounded-lg text-sm col-span-1" value={newTarget.label} onChange={e => setNewTarget({...newTarget, label: e.target.value})} />
                  <input type="number" placeholder="ערך" className="p-2 border rounded-lg text-sm col-span-1" value={newTarget.value} onChange={e => setNewTarget({...newTarget, value: e.target.value})} />
                  <select className="p-2 border rounded-lg text-sm col-span-1" value={newTarget.unit} onChange={e => setNewTarget({...newTarget, unit: e.target.value})}>
                    <option>ימים</option><option>שעות</option><option>%</option><option>₪</option>
                  </select>
                </div>
                <button onClick={addNewTarget} className="w-full bg-[#EF6B00] text-white py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2"><Save size={14}/> שמור יעד</button>
              </div>
            )}

            <div className="space-y-3 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {targets.map((t) => <TargetRow key={t.id} label={t.label} value={t.value} unit={t.unit} active={t.active} />)}
            </div>
          </div>

          {/* מנוע אוטומציות */}
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-[#002649] flex items-center gap-2"><Workflow className="text-blue-500"/> אוטומציות אופרטיביות</h3>
              <button onClick={() => setShowNewAuto(true)} className="bg-slate-900 text-white p-2 rounded-xl hover:bg-blue-500 transition-all"><Plus size={20}/></button>
            </div>

            {showNewAuto && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-blue-900 text-sm">יצירת חוק If/Then</span>
                  <button onClick={() => setShowNewAuto(false)}><X size={16}/></button>
                </div>
                <div className="space-y-3 mb-4">
                  <input type="text" placeholder="IF (תנאי)" className="w-full p-2 border rounded-lg text-sm" value={newAuto.if} onChange={e => setNewAuto({...newAuto, if: e.target.value})} />
                  <input type="text" placeholder="THEN (פעולה)" className="w-full p-2 border rounded-lg text-sm" value={newAuto.action} onChange={e => setNewAuto({...newAuto, action: e.target.value})} />
                </div>
                <button onClick={addNewAuto} className="w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2"><Zap size={14}/> הפעל אוטומציה</button>
              </div>
            )}

            <div className="space-y-3 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {automations.map((a) => <AutomationRow key={a.id} if={a.if} action={a.action} active={a.active} />)}
            </div>
          </div>
        </div>
      )}

{/* ========================================= */}
      {/* TAB 4: AI INBOX ANALYTICS (Advanced Ops) */}
      {/* ========================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-8 animate-in slide-in-from-left-4">
          
          {/* High Level Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatMiniCard label="משימות AI שנוצרו" value="1,240" sub="החודש" color="text-[#002649]" />
            <StatMiniCard label="ממוצע סגירה שבועי" value="92%" sub="יעד: 85%" color="text-green-600" />
            <StatMiniCard label="זמן תגובה (חציוני)" value="3.8" sub="שעות" color="text-blue-600" />
            <StatMiniCard label="חריגות SLA חוזרות" value="14" sub="דחופות" color="text-red-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* גרף מגמות - שעות עומס ב-Inbox */}
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-[#002649] flex items-center gap-2">
                  <Clock size={20} className="text-[#EF6B00]"/> עומס משימות לפי שעות היממה
                </h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full uppercase">זיהוי צווארי בקבוק</span>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[
                    {hour: '08:00', tasks: 12}, {hour: '10:00', tasks: 45}, {hour: '12:00', tasks: 38}, 
                    {hour: '14:00', tasks: 62}, {hour: '16:00', tasks: 55}, {hour: '18:00', tasks: 20}
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} hide />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Line type="monotone" dataKey="tasks" stroke="#EF6B00" strokeWidth={4} dot={{r: 6, fill: '#EF6B00'}} activeDot={{r: 8}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* התפלגות סוגי משימות - כאן מזהים חולשות! */}
            <div className="bg-[#002649] p-8 rounded-3xl text-white shadow-xl">
              <h3 className="font-black mb-6 flex items-center gap-2">
                <Layers size={20} className="text-[#EF6B00]"/> התפלגות נושאי המשימות
              </h3>
              <div className="space-y-5">
                <TypeBar label="סורסינג (נפח קו״ח)" pct={45} color="bg-orange-400" count="558" />
                <TypeBar label="חריגות SLA (מנהלים)" pct={30} color="bg-blue-400" count="372" />
                <TypeBar label="נטישה (Ghosting)" pct={15} color="bg-red-400" count="186" />
                <TypeBar label="אדמיניסטרציה / Onboarding" pct={10} color="bg-green-400" count="124" />
              </div>
              <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-[10px] text-blue-200 font-bold uppercase mb-1">AI Recommendation:</p>
                <p className="text-xs leading-relaxed opacity-80 font-medium">מרבית המשימות (45%) נובעות מחוסר בקו״ח. מומלץ להסיט תקציב ל-LinkedIn Ads בשבוע הקרוב.</p>
              </div>
            </div>

          </div>

          {/* לוח ניהול ביצועים אישי - Skill Heatmap */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-[#002649] flex items-center gap-2 text-xl">
                <ShieldCheck size={24} className="text-green-500"/> Personal Performance & Weakness Analysis
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="text-slate-400 font-black text-[10px] uppercase bg-slate-50">
                    <th className="p-4 rounded-r-2xl">מגייס.ת</th>
                    <th className="p-4 text-center">משימות דומיננטיות</th>
                    <th className="p-4 text-center">זמן תגובה (ממוצע)</th>
                    <th className="p-4 text-center">אחוז סגירה</th>
                    <th className="p-4 rounded-l-2xl">תובנת AI למנהל</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <RecruiterRow 
                    name="גיא רג'ואן" 
                    dominant="סורסינג ולינקדאין" 
                    time="1.2 שעות" 
                    rate="98%" 
                    insight="מצטיין תפעולית. רוב המשימות שלו הן מחסור בקו״ח - גיא זקוק ליותר תקציב פרסום." 
                    color="green"
                  />
                  <RecruiterRow 
                    name="ליטל גולדפרב" 
                    dominant="SLA מנהלים" 
                    time="14.5 שעות" 
                    rate="62%" 
                    insight="חולשה בניהול ממשקים. ליטל מתקשה להניע מנהלים למתן משוב בזמן. דורש חניכה." 
                    color="red"
                  />
                  <RecruiterRow 
                    name="מור אהרון" 
                    dominant="Ghosting" 
                    time="4.1 שעות" 
                    rate="89%" 
                    insight="עומס יתר. מור מנהלת 35 משרות במקביל, מה שיוצר 'חורים' בתקשורת מול מועמדים." 
                    color="orange"
                  />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- SUB-COMPONENTS ---

function getRecruiterDotColor(color: string): string {
  if (color === "green") return "bg-green-500";
  if (color === "red") return "bg-red-500";
  return "bg-orange-500";
}

function StatMiniCard({ label, value, sub, color }: Readonly<{ label: string; value: string; sub: string; color: string }>) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className={`text-3xl font-black ${color} mt-1`}>{value}</div>
      <p className="text-[10px] font-bold text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

function TypeBar({ label, pct, color, count }: Readonly<{ label: string; pct: number; color: string; count: string }>) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-bold">
        <span>{label}</span>
        <span className="opacity-60">{count} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RecruiterRow({ name, dominant, time, rate, insight, color }: Readonly<{ name: string; dominant: string; time: string; rate: string; insight: string; color: string }>) {
  const dotColor = getRecruiterDotColor(color);
  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="p-4 font-black text-[#002649] flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} /> {name}
      </td>
      <td className="p-4 text-center font-bold text-slate-600 text-xs">{dominant}</td>
      <td className="p-4 text-center font-black text-[#002649]">{time}</td>
      <td className="p-4 text-center">
        <span className={`px-2 py-1 rounded-lg font-bold text-[10px] ${color === 'red' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{rate}</span>
      </td>
      <td className="p-4 text-xs font-medium text-slate-500 italic max-w-xs">{insight}</td>
    </tr>
  );
}

const DROPZONE_COLOR_MAP: Record<string, string> = { blue: "border-blue-200 bg-blue-50/30 hover:border-blue-500", orange: "border-orange-200 bg-orange-50/30 hover:border-orange-500", green: "border-green-200 bg-green-50/30 hover:border-green-500", pink: "border-pink-200 bg-pink-50/30 hover:border-pink-500", purple: "border-purple-200 bg-purple-50/30 hover:border-purple-500", emerald: "border-emerald-200 bg-emerald-50/30 hover:border-emerald-500", red: "border-red-200 bg-red-50/30 hover:border-red-500" };

function DropzoneBox({ title, icon, color, status, inputRef, onUpload, uploading }: Readonly<{ title: string; icon: React.ReactNode; color: string; status: FileStatus; inputRef: React.RefObject<HTMLInputElement | null>; onUpload: () => void; uploading: boolean }>) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };
  return (
    <button
      type="button"
      className={`border-2 border-dashed rounded-3xl p-6 transition-all cursor-pointer flex flex-col items-center text-center relative group w-full text-inherit ${DROPZONE_COLOR_MAP[color]}`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={handleKeyDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onUpload(); }}
    >
      <input type="file" ref={inputRef} className="hidden" onChange={onUpload} />
      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">{uploading ? <Loader2 size={24} className="animate-spin text-slate-400"/> : icon}</div>
      <h3 className="font-black text-[#002649] text-sm mb-1">{title}</h3>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">גרור או לחץ להעלאה</div>
      <div className="w-full bg-white/60 p-3 rounded-2xl text-[10px] space-y-1 text-right text-slate-600">
        <div className="flex justify-between border-b border-black/5 pb-1"><span className="font-bold opacity-40">קובץ:</span><span className="font-black truncate max-w-[100px]">{status.name}</span></div>
        <div className="flex justify-between"><span className="font-bold opacity-40">עודכן:</span><span className="font-black">{status.date}</span></div>
      </div>
    </button>
  );
}

function FormulaCard({ title, formula, logic }: Readonly<{ title: string; formula: string; logic: string }>) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-3"><h4 className="font-black text-[#002649]">{title}</h4><div className="p-1 bg-slate-100 rounded-lg"><Calculator size={14} className="text-slate-400"/></div></div>
      <div className="bg-slate-900 text-[#EF6B00] font-mono text-xs p-3 rounded-xl mb-3">{formula}</div>
      <p className="text-xs text-slate-500 font-medium">{logic}</p>
    </div>
  );
}

function BenchmarkRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 mb-2">
      <span className="text-sm font-bold text-[#002649]">{label}</span>
      <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{value}</span>
    </div>
  );
}

function TargetRow({ label, value, unit, active }: Readonly<{ label: string; value: number; unit: string; active: boolean }>) {
  const [isActive, setIsActive] = useState(active);
  return (
    <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
      <div className="flex items-center gap-4"><div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-300'}`} /><span className="font-bold text-[#002649] text-sm">{label}</span></div>
      <div className="flex items-center gap-3"><input type="number" defaultValue={value} disabled={!isActive} className="w-16 bg-slate-100 p-1.5 rounded-lg font-black text-[#002649] outline-none text-center text-xs" /><span className="text-[10px] font-bold text-slate-400 uppercase w-8">{unit}</span><button onClick={() => setIsActive(!isActive)} className={`p-2 rounded-lg transition-all ${isActive ? 'text-green-500 hover:bg-green-50' : 'text-slate-300'}`}><Power size={18}/></button></div>
    </div>
  );
}

function AutomationRow({ if: ifCond, action, active }: Readonly<{ if: string; action: string; active: boolean }>) {
  const [isActive, setIsActive] = useState(active);
  return (
    <div className={`p-4 rounded-2xl border transition-all ${isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
      <div className="flex items-center justify-between"><div className="space-y-1"><div className="text-xs font-bold text-[#002649]"><span className="text-blue-500 mr-1 font-black">IF:</span> {ifCond}</div><div className="text-[11px] font-medium text-slate-500"><span className="text-[#EF6B00] font-black mr-1">THEN:</span> {action}</div></div><button onClick={() => setIsActive(!isActive)} className={`p-2 rounded-lg transition-all ${isActive ? 'text-blue-500 hover:bg-blue-50' : 'text-slate-300'}`}><Power size={18}/></button></div>
    </div>
  );
}

function TabNav({ id, active, setter, icon, label }: Readonly<{ id: string; active: string; setter: (id: string) => void; icon: React.ReactNode; label: string }>) {
  const isActive = active === id;
  return (
    <button onClick={() => setter(id)} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all ${isActive ? 'bg-white text-[#002649] shadow-sm' : 'text-slate-500 hover:text-[#002649]'}`}>
      {icon} {label}
    </button>
  );
}