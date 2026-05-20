"use client";

import React, { useEffect, useState } from "react";
import { Network, Database, ArrowLeft, Loader2 } from "lucide-react";

interface Consumer { block: string; page: string }
interface SourceMap { table: string; consumers: Consumer[] }

export function ConsumerMapTab() {
  const [data, setData] = useState<SourceMap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    void fetch(`${apiBase}/api/admin/consumer-map`, { credentials: "include", cache: "no-store" })
      .then(r => r.json())
      .then(json => setData(json.sources ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#EF6B00]" /></div>;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h2 className="text-xl font-black text-[#002649] flex items-center gap-2">
        <Network size={22} strokeWidth={1.75} className="text-[#EF6B00]" />
        מפת צריכת נתונים
      </h2>
      <p className="text-sm text-slate-500">
        בכל פעם שאתה מבצע revert לאצווה או שינוי משמעותי בכללי טיוב — בלוקים אלו מושפעים. השתמש כדי להעריך השפעה לפני פעולה.
      </p>

      <div className="space-y-3">
        {data.map(s => (
          <div key={s.table} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-l from-[#002649]/5 to-[#EF6B00]/5 px-5 py-3 border-b border-slate-200 flex items-center gap-3">
              <Database size={18} strokeWidth={1.75} className="text-[#EF6B00]" />
              <div className="font-mono font-black text-[#002649]">{s.table}</div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{s.consumers.length} צרכנים</span>
            </div>
            <div className="divide-y divide-slate-100">
              {s.consumers.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <ArrowLeft size={14} className="text-slate-300" />
                    <span className="text-sm font-bold text-[#002649]">{c.block}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{c.page}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
