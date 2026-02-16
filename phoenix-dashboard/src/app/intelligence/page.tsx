"use client";

import { useState, useEffect } from "react";
import { 
  Brain, Filter, AlertTriangle, TrendingDown, Target, Zap, 
  HeartHandshake, Users, Briefcase, CheckCircle2, AlertCircle, 
  BarChart3, Download, Activity, TrendingUp, ChevronDown 
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';

// --- Static Data & Gauge Config ---
const totalHeadcount = 3500;
const currentDisabilityCount = 98; 
const targetDisabilityCount = Math.ceil(totalHeadcount * 0.03); 
const gaugeData = [
  { name: 'עובדים עם מוגבלות (קיים)', value: currentDisabilityCount },
  { name: 'פער ליעד', value: targetDisabilityCount - currentDisabilityCount },
];
const GAUGE_COLORS = ['#EF6B00', '#f1f5f9'];
const currentPct = ((currentDisabilityCount / totalHeadcount) * 100).toFixed(1);
const gapToTarget = targetDisabilityCount - currentDisabilityCount;

const designatedSourcesData = [
  { name: 'עמותת שווים', cvs: 85, interviews: 24, hires: 3 },
  { name: 'תעסוקה שווה', cvs: 62, interviews: 18, hires: 2 },
  { name: 'Call יכול', cvs: 45, interviews: 12, hires: 2 },
  { name: 'מרכז שיקום', cvs: 30, interviews: 8, hires: 1 },
];

// --- MOCK DATA FOR DEMO ---
const MOCK_INTELLIGENCE_DATA = {
  baseline: {
    current_hires: 28,
    avg_days: 38
  },
  ghosting_risks: [
    { candidate: "דניאל כהן", job: "מפתח Backend Java", risk_score: 85 },
    { candidate: "שיר גולן", job: "נציגת מכירות וביטוח", risk_score: 72 },
    { candidate: "אלכס רובין", job: "אנליסט נתונים", risk_score: 64 },
    { candidate: "מיכל אהרוני", job: "מנהלת מוצר", risk_score: 55 }
  ]
};

export default function IntelligenceAndReports() {
  const [data, setData] = useState<any>(null);
  const [budgetBoost, setBudgetBoost] = useState(0); 
  const [processSpeed, setProcessSpeed] = useState(0); 

  useEffect(() => {
    // מפעילים טיימר קצר כדי לתת תחושה של "טעינת AI", ומזריקים את נתוני המוקאפ.
    // הקריאה לשרת (fetch) מבוטלת למען יציבות המצגת.
    const timer = setTimeout(() => {
      setData(MOCK_INTELLIGENCE_DATA);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  if (!data) return <div className="p-8 text-[#002649] font-bold animate-pulse flex items-center gap-2"><Brain size={20} className="animate-bounce" /> מפעיל מנוע אינטליגנציה...</div>;

  const projectedHires = Math.round(data.baseline.current_hires * (1 + (budgetBoost / 100)));
  const projectedDays = Math.round(data.baseline.avg_days * (1 - (processSpeed / 100)));

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-in fade-in duration-500 pb-20 px-2 md:px-6">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
            אינטליגנציה וביצועים <Brain className="text-[#EF6B00]" size={32} />
          </h1>
          <p className="text-slate-500 mt-2 font-medium">מרכז התחזיות, מדדי המדיניות (SLA) וגיוון תעסוקתי.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#002649] text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-[#EF6B00] transition-all shadow-lg">
          <Download size={18} /> ייצוא דו"ח תקופתי
        </button>
      </div>

      {/* --- SECTION 1: TARGET VS ACTUAL (KPIs) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <TargetMetricCard label="זמן איוש (TTF)" actual="38 ימים" target="35 ימים" status="warning" trend="+8%" />
        <TargetMetricCard label="SLA משוב מנהל" actual="52 שעות" target="48 שעות" status="danger" trend="+4 שעות" />
        <TargetMetricCard label="ניוד פנימי" actual="18%" target="15%" status="success" trend="+3%" />
        <TargetMetricCard label="גיוון (מוגבלות)" actual={`${currentPct}%`} target="3%" status="warning" trend="-0.2%" />
      </div>

      {/* --- SECTION 2: SIMULATOR & GHOSTING --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* What-If Simulator */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-8 bg-gradient-to-br from-white to-blue-50/30 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-[#002649] text-[#EF6B00] rounded-xl shadow-md"><Zap size={24} /></div>
            <div>
              <h3 className="font-black text-xl text-[#002649]">What-If Simulator</h3>
              <p className="text-sm text-slate-500 font-medium">השפעת משאבים על ביצועי הגיוס בחודש הבא.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between font-bold text-[#002649]"><span>סורסינג / תקציב</span><span className="text-blue-600">+{budgetBoost}%</span></div>
                <input type="range" min="0" max="100" value={budgetBoost} onChange={(e) => setBudgetBoost(Number(e.target.value))} className="w-full accent-[#EF6B00]" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between font-bold text-[#002649]"><span>שיפור תהליך (SLA)</span><span className="text-green-600">-{processSpeed}%</span></div>
                <input type="range" min="0" max="50" value={processSpeed} onChange={(e) => setProcessSpeed(Number(e.target.value))} className="w-full accent-[#EF6B00]" />
              </div>
            </div>
            <div className="bg-white border border-slate-200 shadow-lg rounded-2xl p-6 relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-2 h-full bg-[#EF6B00]"></div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-[10px] font-black text-slate-400 uppercase">קצב גיוסים צפוי</p><div className="text-3xl font-black text-[#002649]">{projectedHires}</div></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase">TTF משוער</p><div className="text-3xl font-black text-[#002649]">{projectedDays} ימים</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Ghosting Radar */}
        <div className="glass-card rounded-3xl p-6 flex flex-col border-t-4 border-t-red-500 bg-white shadow-sm h-[350px]">
          <h3 className="font-bold text-lg text-[#002649] flex items-center gap-2 mb-4"><AlertTriangle size={20} className="text-red-500" />רדאר נטישה</h3>
          <div className="space-y-4 overflow-y-auto pr-2">
            {data.ghosting_risks.map((risk: any, idx: number) => (
              <div key={idx} className="bg-red-50/50 border border-red-100 p-3 rounded-xl hover:bg-red-100 transition-colors cursor-default">
                <div className="flex justify-between items-start">
                  <div><div className="font-bold text-red-900 text-sm">{risk.candidate}</div><div className="text-[10px] text-red-700">{risk.job}</div></div>
                  <div className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">{risk.risk_score}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- SECTION 3: DIVISIONAL PERFORMANCE --- */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Activity size={24} /></div>
          <h3 className="font-black text-2xl text-[#002649]">עמידה ביעדים לפי חטיבות</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
          <DivisionProgress label="חטיבת טכנולוגיה (R&D)" actual={65} target={90} status="danger" />
          <DivisionProgress label="חטיבת כספים" actual={92} target={85} status="success" />
          <DivisionProgress label="חטיבת לקוחות ושירות" actual={78} target={80} status="warning" />
          <DivisionProgress label="מטה ומשאבי אנוש" actual={85} target={70} status="success" />
        </div>
      </div>

      {/* --- SECTION 4: DIVERSITY & INCLUSION --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Gauge Chart */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col items-center relative">
          <h3 className="font-bold text-[#002649] flex items-center gap-2 w-full border-b pb-4 mb-4">
            <HeartHandshake size={20} className="text-pink-500"/> יעד תעסוקת עובדים עם מוגבלות
          </h3>
          <div className="relative w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={gaugeData} cx="50%" cy="80%" startAngle={180} endAngle={0} innerRadius={70} outerRadius={100} paddingAngle={0} dataKey="value" stroke="none">
                  {gaugeData.map((entry, index) => <Cell key={index} fill={GAUGE_COLORS[index]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
              <span className="text-5xl font-black text-[#002649]">{currentPct}%</span>
              <span className="text-xs font-bold text-slate-400 uppercase mt-2">יעד: 3%</span>
            </div>
          </div>
          <div className="w-full bg-slate-50 rounded-2xl p-4 mt-6 border border-slate-100 flex items-start gap-3">
            <AlertCircle className="text-[#EF6B00] shrink-0" size={18} />
            <p className="text-sm text-slate-700 leading-snug">חסרים <strong>{gapToTarget} תקנים</strong> להשלמת היעד מתוך מצבת של {totalHeadcount.toLocaleString()} עובדים.</p>
          </div>
        </div>

        {/* Designated Sources Bar Chart */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h3 className="font-bold text-[#002649] flex items-center gap-2 mb-8">
            <Target size={20} className="text-blue-500"/> אפקטיביות מקורות גיוון ("צבועים")
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={designatedSourcesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Legend iconType="circle" />
                <Bar dataKey="cvs" name="קורות חיים" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={25} />
                <Bar dataKey="hires" name="קליטות בפועל" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function TargetMetricCard({ label, actual, target, status, trend }: any) {
  const statusColors: any = { success: "text-green-500", warning: "text-orange-500", danger: "text-red-500" };
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-[#EF6B00]/30">
      <div className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className={`text-3xl font-black ${statusColors[status]}`}>{actual}</div>
        <div className="text-xs font-bold text-slate-300">/ {target}</div>
      </div>
      <div className={`text-[10px] font-black mt-3 inline-block px-2 py-0.5 rounded-full ${status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
        {trend} מהתקופה הקודמת
      </div>
    </div>
  );
}

function DivisionProgress({ label, actual, target, status }: any) {
  const barColors: any = { success: "bg-green-500", warning: "bg-[#EF6B00]", danger: "bg-red-500" };
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-bold">
        <span className="text-[#002649]">{label}</span>
        <span className="text-slate-400">{actual}% <span className="text-[10px] text-slate-300">(יעד: {target}%)</span></span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
        <div className={`h-full absolute left-0 top-0 transition-all duration-1000 ${barColors[status]}`} style={{ width: `${actual}%` }} />
        <div className="absolute h-full w-0.5 bg-slate-400 z-10 top-0" style={{ left: `${target}%` }} />
      </div>
    </div>
  );
}