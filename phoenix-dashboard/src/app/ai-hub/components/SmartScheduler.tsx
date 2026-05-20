"use client";

/**
 * SmartScheduler — basic UI + Coming Soon for live calendar sync.
 *
 * v1 lets the recruiter manually capture availability slots from 3 participants
 * (recruiter, hiring manager, candidate) and the tool finds intersection
 * windows. The full Outlook/Google Calendar integration is wired but disabled
 * (Coming Soon badge on those buttons).
 */

import React, { useMemo, useState } from "react";
import { Calendar, Clock, Plus, X, Construction, Send } from "lucide-react";

type ParticipantId = "recruiter" | "manager" | "candidate";

interface Slot { id: string; date: string; startTime: string; endTime: string }

interface Participant { id: ParticipantId; label: string; color: string; slots: Slot[] }

const DEFAULT_PARTICIPANTS: Participant[] = [
  { id: "recruiter", label: "מגייס/ת", color: "#3B82F6", slots: [] },
  { id: "manager", label: "מנהל/ת מגייס/ת", color: "#EF6B00", slots: [] },
  { id: "candidate", label: "מועמד/ת", color: "#10B981", slots: [] },
];

const newSlot = (): Slot => ({
  id: `S-${Math.random().toString(36).slice(2, 8)}`,
  date: "",
  startTime: "09:00",
  endTime: "10:00",
});

// Intersect: a window appears in the output ONLY if all 3 participants have
// some availability that overlaps in that date+time range. We approximate by
// converting (date, startTime, endTime) to numeric minutes-from-epoch ranges.
const slotToRange = (s: Slot): [number, number] | null => {
  if (!s.date || !s.startTime || !s.endTime) return null;
  const start = new Date(`${s.date}T${s.startTime}`).getTime();
  const end = new Date(`${s.date}T${s.endTime}`).getTime();
  if (end <= start) return null;
  return [start, end];
};

const intersectRanges = (a: [number, number][], b: [number, number][]): [number, number][] => {
  const out: [number, number][] = [];
  for (const [as, ae] of a) {
    for (const [bs, be] of b) {
      const s = Math.max(as, bs), e = Math.min(ae, be);
      if (e - s >= 30 * 60 * 1000) out.push([s, e]); // at least 30 min window
    }
  }
  return out;
};

const fmtRange = (ms1: number, ms2: number) => {
  const d1 = new Date(ms1), d2 = new Date(ms2);
  const date = d1.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
  const t1 = d1.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const t2 = d2.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${t1}–${t2}`;
};

export default function SmartScheduler() {
  const [participants, setParticipants] = useState<Participant[]>(DEFAULT_PARTICIPANTS);

  const updateSlot = (pid: ParticipantId, slot: Slot) =>
    setParticipants(prev => prev.map(p => p.id === pid ? { ...p, slots: p.slots.map(s => s.id === slot.id ? slot : s) } : p));
  const addSlot = (pid: ParticipantId) =>
    setParticipants(prev => prev.map(p => p.id === pid ? { ...p, slots: [...p.slots, newSlot()] } : p));
  const removeSlot = (pid: ParticipantId, sid: string) =>
    setParticipants(prev => prev.map(p => p.id === pid ? { ...p, slots: p.slots.filter(s => s.id !== sid) } : p));

  const matches = useMemo(() => {
    const ranges = participants.map(p =>
      p.slots.map(slotToRange).filter((r): r is [number, number] => r !== null)
    );
    if (ranges.some(r => r.length === 0)) return [];
    let acc = ranges[0];
    for (let i = 1; i < ranges.length; i++) acc = intersectRanges(acc, ranges[i]);
    return acc.slice(0, 5);
  }, [participants]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
          <Calendar size={24}/>
        </div>
        <div>
          <h3 className="text-xl font-black text-[#002649]">מתאם/ת ראיונות חכם/ה</h3>
          <p className="text-sm text-slate-500">הוסף/י זמינויות של 3 משתתפים — נמצא חלונות משותפים.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {participants.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: p.color }}/>
                <div className="font-black text-sm text-[#002649]">{p.label}</div>
              </div>
              <button onClick={() => addSlot(p.id)} className="text-[#EF6B00] hover:bg-orange-50 rounded-md p-1">
                <Plus size={16}/>
              </button>
            </div>

            <div className="space-y-2">
              {p.slots.length === 0 && (
                <div className="text-xs text-slate-400 italic text-center py-3">לחץ + להוספת חלון</div>
              )}
              {p.slots.map(s => (
                <div key={s.id} className="bg-slate-50 rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <input type="date" value={s.date} onChange={e => updateSlot(p.id, { ...s, date: e.target.value })}
                      className="text-xs font-bold flex-1 bg-white border border-slate-200 rounded px-2 py-1"/>
                    <button onClick={() => removeSlot(p.id, s.id)} className="text-slate-400 hover:text-rose-500 p-1">
                      <X size={12}/>
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <input type="time" value={s.startTime} onChange={e => updateSlot(p.id, { ...s, startTime: e.target.value })}
                      className="font-bold bg-white border border-slate-200 rounded px-2 py-1 flex-1"/>
                    <span className="text-slate-400">–</span>
                    <input type="time" value={s.endTime} onChange={e => updateSlot(p.id, { ...s, endTime: e.target.value })}
                      className="font-bold bg-white border border-slate-200 rounded px-2 py-1 flex-1"/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-2xl p-5 border border-blue-100">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={18} className="text-blue-600"/>
          <div className="font-black text-sm text-[#002649]">חלונות משותפים (לפחות 30 דקות)</div>
        </div>
        {matches.length === 0 ? (
          <div className="text-sm text-slate-500 py-2">
            {participants.some(p => p.slots.length === 0)
              ? "מלא/י חלונות לכל 3 המשתתפים כדי לראות חלונות משותפים."
              : "לא נמצאו חלונות משותפים. נסה/י להציע זמינויות נוספות."}
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map(([s, e], i) => (
              <div key={i} className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                <div className="font-bold text-sm text-[#002649]">{fmtRange(s, e)}</div>
                <button disabled className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed flex items-center gap-1">
                  <Send size={12}/> שלח הזמנה <span className="text-[9px] uppercase bg-amber-200 text-amber-800 px-1 rounded">בקרוב</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Construction size={20} className="text-amber-600 flex-shrink-0 mt-0.5"/>
        <div>
          <div className="font-bold text-sm text-amber-900 mb-1">בקרוב — אינטגרציה ל-Outlook/Google Calendar</div>
          <div className="text-xs text-amber-800">
            כעת מקבלים זמינות ידנית. בגרסה הבאה ייובאו אוטומטית free/busy ממיילים מחוברים + שליחת invites דרך MS Graph / Google Calendar API.
          </div>
        </div>
      </div>
    </div>
  );
}
