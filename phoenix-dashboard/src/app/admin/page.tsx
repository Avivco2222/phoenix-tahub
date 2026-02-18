"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Users, Building2, Receipt, Target, Workflow, Clock, FileText, Loader2,
  CheckCircle2, Plus, HeartHandshake, Power, Briefcase, Calculator, Sparkles,
  UserMinus, X, Zap, Scale, Save, BarChart3, Layers, ShieldCheck, AlertOctagon, RefreshCw, Trash2, Edit3
} from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export interface FileStatus {
  name: string;
  date: string;
  rows: string | number;
  status: "pending" | "success" | "error";
  errorMsg?: string;
}

interface EtlRule {
  id?: string;
  col_name: string;
  condition: string;
  action: string;
  active: boolean;
}

export default function AdminCommandCenter() {
  const [activeTab, setActiveTab] = useState("data");
  
  // --- Live Data States ---
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [etlRules, setEtlRules] = useState<EtlRule[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  
  // --- Rules Form State ---
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<EtlRule>({ col_name: "", condition: "", action: "", active: true });

  useEffect(() => {
    fetchSystemHealth();
    fetchEtlRules();
    fetchAnalytics();
  }, []);

  // ==========================================
  // API FETCHERS (The Real Pipeline)
  // ==========================================
  const fetchSystemHealth = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/health`);
      if (res.ok) setSystemHealth(await res.json());
    } catch (e) { console.error("Error fetching health", e); }
  };

  const fetchEtlRules = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/rules`);
      if (res.ok) setEtlRules(await res.json());
    } catch (e) { console.error("Error fetching rules", e); }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/inbox-analytics`);
      if (res.ok) setAnalyticsData(await res.json());
    } catch (e) { console.error("Error fetching analytics", e); }
  };

  // ==========================================
  // ACTIONS
  // ==========================================
  const handleLiveUpload = async (type: string, file: File) => {
    setIsUploading(type);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload`, { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        setFilesStatus(prev => ({ ...prev, [type]: { name: file.name, date: new Date().toLocaleTimeString('he-IL'), rows: data.rows_processed, status: "success" } }));
        fetchSystemHealth(); 
      } else {
        setFilesStatus(prev => ({ ...prev, [type]: { name: file.name, date: new Date().toLocaleTimeString('he-IL'), rows: "נכשל", status: "error", errorMsg: data.detail || "שגיאת קריאת קובץ" } }));
      }
    } catch (error: any) {
      setFilesStatus(prev => ({ ...prev, [type]: { name: file.name, date: "-", rows: "נכשל", status: "error", errorMsg: "השרת לא מגיב." } }));
    } finally {
      setIsUploading(null);
    }
  };

  const handleRevertUpload = async (logId: string) => {
    if(!window.confirm("האם למחוק את הרשומות של העלאה זו?")) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/revert/${logId}`, { method: 'POST' });
    fetchSystemHealth();
  };

  const handleSaveRule = async () => {
    if (!ruleForm.col_name || !ruleForm.action) return;
    try {
      const payload = editingRuleId ? { ...ruleForm, id: editingRuleId } : ruleForm;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchEtlRules();
      setShowRuleForm(false);
      setEditingRuleId(null);
      setRuleForm({ col_name: "", condition: "", action: "", active: true });
    } catch (e) { console.error(e); }
  };

  const handleDeleteRule = async (id: string) => {
    if(!window.confirm("למחוק כלל זה?")) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/rules/${id}`, { method: 'DELETE' });
    fetchEtlRules();
  };

  const openEditRule = (rule: EtlRule) => {
    setRuleForm({ col_name: rule.col_name, condition: rule.condition, action: rule.action, active: rule.active });
    setEditingRuleId(rule.id!);
    setShowRuleForm(true);
  };

  // --- File Upload Definitions ---
  const fileRefs: Record<string, React.RefObject<HTMLInputElement | null>> = { candidates: useRef(null), jobs: useRef(null), hires: useRef(null), diversity: useRef(null), headcount: useRef(null), budget: useRef(null), attrition: useRef(null) };
  const [filesStatus, setFilesStatus] = useState<Record<string, FileStatus>>({ candidates: { name: "ממתין", date: "-", rows: "-", status: "pending" }, jobs: { name: "ממתין", date: "-", rows: "-", status: "pending" }, hires: { name: "ממתין", date: "-", rows: "-", status: "pending" }, diversity: { name: "ממתין", date: "-", rows: "-", status: "pending" }, headcount: { name: "ממתין", date: "-", rows: "-", status: "pending" }, budget: { name: "ממתין", date: "-", rows: "-", status: "pending" }, attrition: { name: "ממתין", date: "-", rows: "-", status: "pending" } });
  const FILE_META: Record<string, any> = { candidates: { title: "מועמדים (ATS)", icon: <Users size={24} />, color: "blue" }, jobs: { title: "משרות פתוחות", icon: <Briefcase size={24} />, color: "orange" }, hires: { title: "קליטות", icon: <CheckCircle2 size={24} />, color: "green" }, diversity: { title: "גיוון", icon: <HeartHandshake size={24} />, color: "pink" }, headcount: { title: "תקן מצבה", icon: <Building2 size={24} />, color: "purple" }, budget: { title: "תקציב", icon: <Receipt size={24} />, color: "emerald" }, attrition: { title: "עזיבות", icon: <UserMinus size={24} />, color: "red" } };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-4">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
            מרכז שליטה ובקרה <ShieldCheck className="text-[#EF6B00]" size={32} />
          </h1>
          <p className="text-slate-500 mt-2 font-medium">קליטת נתונים (ETL), טיוב דאטה וניטור ביצועי מגייסים.</p>
        </div>
        
        {systemHealth && (
          <div className="flex items-center gap-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">בריאות נתונים (Health)</div>
              <div className={`text-3xl font-black ${systemHealth.health_score > 90 ? 'text-green-500' : systemHealth.health_score > 70 ? 'text-orange-500' : 'text-red-500'}`}>
                {systemHealth.health_score}%
              </div>
            </div>
            <div className="w-px h-10 bg-slate-200"></div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">רשומות פעילות במסד</div>
              <div className="text-2xl font-black text-[#002649]">{systemHealth.total_records.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* NAVIGATION */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200">
        <TabNav id="data" active={activeTab} setter={setActiveTab} icon={<FileText size={18}/>} label="ניהול דאטה (Live Dropzones)" />
        <TabNav id="rules" active={activeTab} setter={setActiveTab} icon={<Filter size={18}/>} label="אזור הסגר ומדיניות טיוב" />
        <TabNav id="analytics" active={activeTab} setter={setActiveTab} icon={<BarChart3 size={18}/>} label="מעקב ביצועים (AI Inbox)" />
        <TabNav id="targets" active={activeTab} setter={setActiveTab} icon={<Target size={18}/>} label="יעדים ואוטומציות (בבנייה)" />
      </div>

      {/* TAB 1: DATA DROPZONES */}
      {activeTab === "data" && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
          {systemHealth?.missing_data?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
              <AlertOctagon className="text-red-500 shrink-0" size={24} />
              <div>
                <h3 className="font-black text-red-800">התראות טיוב נתונים פעילות</h3>
                <ul className="mt-2 space-y-1">
                  {systemHealth.missing_data.map((alert: any, idx: number) => (
                    <li key={idx} className="text-sm font-bold text-red-700">⚠️ מצאנו {alert.count} רשומות חסרות: {alert.field}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Object.keys(filesStatus).map((key) => {
              const meta = FILE_META[key];
              return (
                <DropzoneBox key={key} title={meta.title} icon={meta.icon} color={meta.color} status={filesStatus[key]} inputRef={fileRefs[key]} uploading={isUploading === key}
                  onUpload={(e: any) => { const f = e.target.files?.[0]; if (f) handleLiveUpload(key, f); }}
                />
              );
            })}
          </div>

          {systemHealth?.logs?.length > 0 && (
             <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-8">
               <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                 <h3 className="font-black text-lg text-[#002649] flex items-center gap-2"><RefreshCw size={18} className="text-blue-500"/> היסטוריית טעינות (ETL Logs)</h3>
                 <button onClick={fetchSystemHealth} className="text-slate-400 hover:text-blue-600"><RefreshCw size={16}/></button>
               </div>
               <table className="w-full text-right text-sm">
                 <thead className="bg-white text-slate-400 font-bold text-xs uppercase border-b border-slate-100">
                   <tr><th className="px-6 py-3">קובץ</th><th className="px-6 py-3">תאריך סנכרון</th><th className="px-6 py-3">רשומות</th><th className="px-6 py-3">סטטוס</th><th className="px-6 py-3">פעולה</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {systemHealth.logs.map((log: any, i: number) => (
                     <tr key={i} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-3 font-bold text-[#002649]">{log.filename}</td>
                       <td className="px-6 py-3 text-slate-500">{log.upload_date}</td>
                       <td className="px-6 py-3 font-mono font-bold text-blue-600">{log.rows_processed}</td>
                       <td className="px-6 py-3"><span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${log.status === 'Success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{log.status}</span></td>
                       <td className="px-6 py-3">
                         {log.status === 'Success' && <button onClick={() => handleRevertUpload(log.log_id)} className="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 text-xs font-bold"><Trash2 size={14}/> Rollback</button>}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          )}
        </div>
      )}

      {/* TAB 2: DATA QUARANTINE & RULES */}
      {activeTab === "rules" && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
          <div className="bg-[#002649] text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row gap-6 items-center">
            <div className="p-4 bg-blue-500/20 rounded-full text-blue-300"><Layers size={48} /></div>
            <div>
              <h2 className="text-2xl font-black mb-2">מנוע טיוב נתונים אוטומטי (ETL Pipeline)</h2>
              <p className="text-blue-100 font-medium">המערכת מעבירה כל קובץ אקסל שנטען דרך חוקי הסינון שלהלן. ניתן לערוך, להוסיף ולמחוק חוקים שיחולו על ההעלאות הבאות.</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-[#002649] flex items-center gap-2"><Filter className="text-[#EF6B00]"/> חוקי נורמליזציה פעילים</h3>
              <button onClick={() => { setRuleForm({col_name: "", condition: "", action: "", active: true}); setEditingRuleId(null); setShowRuleForm(true); }} className="bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-[#EF6B00] transition-all flex items-center gap-2 font-bold"><Plus size={16}/> כלל חדש</button>
            </div>

            {showRuleForm && (
              <div className="mb-6 p-5 bg-orange-50 border border-orange-200 rounded-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-black text-[#002649]">{editingRuleId ? "עריכת כלל קיים" : "הגדרת כלל חדש"}</span>
                  <button onClick={() => setShowRuleForm(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">עמודה באקסל (מטרה)</label>
                    <input type="text" value={ruleForm.col_name} onChange={e => setRuleForm({...ruleForm, col_name: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">תנאי (If)</label>
                    <input type="text" value={ruleForm.condition} onChange={e => setRuleForm({...ruleForm, condition: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">פעולת תיקון (Then)</label>
                    <input type="text" value={ruleForm.action} onChange={e => setRuleForm({...ruleForm, action: e.target.value})} className="w-full p-2.5 border rounded-lg font-bold text-[#002649] outline-none" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveRule} className="bg-[#EF6B00] text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-md"><Save size={16}/> {editingRuleId ? "עדכן כלל" : "הפעל כלל"}</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {etlRules.map((rule) => (
                <div key={rule.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between group">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 w-48"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="font-bold text-[#002649] text-sm">{rule.col_name}</span></div>
                    <div className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm w-48 text-center">{rule.condition}</div>
                    <div className="text-slate-400"><XAxis size={14}/></div>
                    <div className="text-sm font-black text-[#EF6B00] bg-orange-50 px-3 py-1.5 rounded-lg">{rule.action}</div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditRule(rule)} className="text-slate-400 hover:text-blue-600 p-1"><Edit3 size={18}/></button>
                    <button onClick={() => handleDeleteRule(rule.id!)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI INBOX ANALYTICS */}
      {activeTab === "analytics" && analyticsData && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatMiniCard label="משימות AI שנוצרו" value={analyticsData.stats.total_tasks} sub="החודש" color="text-[#002649]" />
            <StatMiniCard label="ממוצע סגירה שבועי" value={`${analyticsData.stats.avg_close_rate}%`} sub="יעד: 85%" color="text-green-600" />
            <StatMiniCard label="זמן תגובה (חציוני)" value={analyticsData.stats.median_response_hours} sub="שעות" color="text-blue-600" />
            <StatMiniCard label="חריגות SLA חוזרות" value={analyticsData.stats.urgent_sla_breaches} sub="דחופות" color="text-red-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-[#002649] flex items-center gap-2"><Clock size={20} className="text-[#EF6B00]"/> עומס משימות לפי שעות היממה</h3>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.hourly_trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Line type="monotone" dataKey="tasks" stroke="#EF6B00" strokeWidth={4} dot={{r: 6, fill: '#EF6B00'}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#002649] p-8 rounded-3xl text-white shadow-xl">
              <h3 className="font-black mb-6 flex items-center gap-2"><Layers size={20} className="text-[#EF6B00]"/> התפלגות נושאי המשימות</h3>
              <div className="space-y-5">
                {analyticsData.task_types.map((t: any, i: number) => (
                  <TypeBar key={i} label={t.label} pct={t.pct} color={t.color} count={t.count} />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <h3 className="font-black text-[#002649] flex items-center gap-2 text-xl mb-8"><ShieldCheck size={24} className="text-green-500"/> Personal Performance</h3>
            <table className="w-full text-right">
              <thead><tr className="text-slate-400 font-black text-[10px] uppercase bg-slate-50"><th className="p-4 rounded-r-2xl">מגייס.ת</th><th className="p-4">משימה דומיננטית</th><th className="p-4">זמן תגובה</th><th className="p-4">אחוז סגירה</th><th className="p-4 rounded-l-2xl">תובנת AI למנהל</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {analyticsData.recruiters.map((r: any, i: number) => (
                  <RecruiterRow key={i} {...r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TARGETS (Parked) */}
      {activeTab === "targets" && (
        <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in-95">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400"><Workflow size={48} /></div>
          <h2 className="text-2xl font-black text-[#002649]">מפעל היעדים בבנייה</h2>
          <p className="text-slate-500 mt-2 text-center max-w-md">המודול הזה חונה כרגע בצד. אנחנו נחזור אליו לאחר שנסיים לייצב את מודולי הליבה של ארגז הכלים ובריאות המשרה.</p>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---
function StatMiniCard({ label, value, sub, color }: any) { return ( <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p><div className={`text-3xl font-black ${color} mt-1`}>{value}</div><p className="text-[10px] font-bold text-slate-400 mt-1">{sub}</p></div> ); }
function TypeBar({ label, pct, color, count }: any) { return ( <div className="space-y-1.5"><div className="flex justify-between text-[11px] font-bold"><span>{label}</span><span className="opacity-60">{count} ({pct}%)</span></div><div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div></div> ); }
function RecruiterRow({ name, dominant, time, rate, insight, color }: any) { const dotColor = color === "green" ? "bg-green-500" : color === "red" ? "bg-red-500" : "bg-orange-500"; return ( <tr className="hover:bg-slate-50 transition-colors group"><td className="p-4 font-black text-[#002649] flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${dotColor}`} /> {name}</td><td className="p-4 font-bold text-slate-600 text-xs">{dominant}</td><td className="p-4 font-black text-[#002649]">{time}</td><td className="p-4"><span className={`px-2 py-1 rounded-lg font-bold text-[10px] ${color === 'red' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{rate}</span></td><td className="p-4 text-xs font-medium text-slate-500 italic max-w-xs">{insight}</td></tr> ); }
const DROPZONE_COLOR_MAP: Record<string, string> = { blue: "border-blue-200 bg-blue-50/50 hover:border-blue-500", orange: "border-orange-200 bg-orange-50/50 hover:border-orange-500", green: "border-green-200 bg-green-50/50 hover:border-green-500", pink: "border-pink-200 bg-pink-50/50 hover:border-pink-500", purple: "border-purple-200 bg-purple-50/50 hover:border-purple-500", emerald: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-500", red: "border-red-200 bg-red-50/50 hover:border-red-500" };
function DropzoneBox({ title, icon, color, status, inputRef, onUpload, uploading }: any) { const isError = status.status === "error"; return ( <button type="button" className={`border-2 border-dashed rounded-3xl p-6 transition-all cursor-pointer flex flex-col items-center text-center relative group w-full text-inherit ${isError ? 'border-red-500 bg-red-50' : DROPZONE_COLOR_MAP[color]}`} onClick={() => inputRef.current?.click()} > <input type="file" ref={inputRef} className="hidden" onChange={onUpload} accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" /> <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm mb-4 transition-transform ${isError ? 'bg-red-500 text-white' : 'bg-white text-[#002649] group-hover:scale-110'}`}> {uploading ? <Loader2 size={24} className="animate-spin text-slate-400"/> : isError ? <X size={24} /> : icon} </div> <h3 className="font-black text-[#002649] text-sm mb-1">{title}</h3> <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">גרור/לחץ להעלאה</div> {isError ? ( <div className="w-full bg-red-100/80 p-3 rounded-2xl text-[10px] font-bold text-red-800 text-right border border-red-200"> שגיאה: {status.errorMsg} </div> ) : ( <div className="w-full bg-white p-3 rounded-2xl text-[10px] space-y-1.5 text-right text-slate-600 shadow-sm border border-slate-100"> <div className="flex justify-between items-center border-b border-slate-100 pb-1.5"><span className="font-bold opacity-50">קובץ:</span><span className="font-black text-[#002649] truncate max-w-[100px]">{status.name}</span></div> <div className="flex justify-between items-center"><span className="font-bold opacity-50">רשומות תקינות:</span><span className="font-black text-green-600">{status.rows}</span></div> </div> )} </button> ); }
import { Filter } from "lucide-react";
function TabNav({ id, active, setter, icon, label }: any) { const isActive = active === id; return ( <button onClick={() => setter(id)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all ${isActive ? 'bg-[#002649] text-white shadow-md' : 'text-slate-500 hover:text-[#002649] hover:bg-slate-200/50'}`}> {icon} {label} </button> ); }