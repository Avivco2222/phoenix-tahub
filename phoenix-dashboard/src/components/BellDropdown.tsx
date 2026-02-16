"use client";
import React, { useState } from 'react';
import { Bell, AlertTriangle, Info, X } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";

export function BellDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAllAsRead, clearNotification } = useNotifications();

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:bg-slate-100 hover:text-[#002649] rounded-full transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border border-white font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[9999] animate-in fade-in zoom-in-95 origin-top-left">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-[#002649] text-sm">התראות מערכת</h3>
              <button onClick={markAllAsRead} className="text-[10px] text-blue-600 font-bold hover:underline">סמן כנקרא</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">אין התראות חדשות</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`p-4 flex gap-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/20' : ''}`}>
                    <div className={`mt-1 shrink-0 ${n.type === 'warning' ? 'text-red-500' : 'text-blue-500'}`}>
                      {n.type === 'warning' ? <AlertTriangle size={16}/> : <Info size={16}/>}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-700 leading-tight font-medium">{n.msg}</p>
                      <span className="text-[9px] text-slate-400 mt-1 block">{n.time}</span>
                    </div>
                    <button onClick={() => clearNotification(n.id)} className="text-slate-300 hover:text-red-500"><X size={14}/></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
