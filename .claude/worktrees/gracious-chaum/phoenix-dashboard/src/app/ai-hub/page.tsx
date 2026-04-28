"use client";

import React, { useState } from "react";
import { Sparkles, ArrowRightLeft, UserPlus, FileText, Zap } from "lucide-react";

import MobilitySimulator from "./components/MobilitySimulator";
import SmartOnboarding from "./components/SmartOnboarding";
import ReportsGenerator from "./components/ReportsGenerator";
import ManagerWhisperer from "./components/ManagerWhisperer";

export default function SuperAiHub() {
  const [activeTab, setActiveTab] = useState("whisperer");

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 relative pb-20 px-4 md:px-8 pt-6 min-h-screen flex flex-col">
      
      <div className="shrink-0 border-b border-slate-200 pb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
              ארגז כלים <Sparkles className="text-[#EF6B00]" size={28} />
            </h1>
            <p className="text-slate-500 mt-2 font-medium">כלי ה-AI המתקדמים של מחלקת הגיוס.</p>
          </div>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-2">
          <TopTab id="whisperer" current={activeTab} onClick={setActiveTab} icon={<Zap size={16}/>} title="הלוחש למנהלים" />
          <TopTab id="mobility" current={activeTab} onClick={setActiveTab} icon={<ArrowRightLeft size={16}/>} title="סימולטור שכר וניוד" />
          <TopTab id="onboarding" current={activeTab} onClick={setActiveTab} icon={<UserPlus size={16}/>} title="קליטת עובד (Onboarding)" />
          <TopTab id="reports" current={activeTab} onClick={setActiveTab} icon={<FileText size={16}/>} title="מחולל דוחות AI" />
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl shadow-sm mb-10">
        {activeTab === "whisperer" && <ManagerWhisperer />}
        {activeTab === "mobility" && <MobilitySimulator />}
        {activeTab === "onboarding" && <SmartOnboarding />}
        {activeTab === "reports" && <ReportsGenerator />}
      </div>
    </div>
  );
}

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
