"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  module: "jobs" | "candidates" | "headcount";
};

const STATIC_INDEX: SearchItem[] = [
  { id: "job-open", title: "משרות פתוחות", subtitle: "מעבר למסך משרות", href: "/jobs", module: "jobs" },
  { id: "candidate-pipeline", title: "ניהול מועמדים", subtitle: "מעבר למסך מועמדים", href: "/candidates", module: "candidates" },
  { id: "headcount-report", title: "דוח שליטה ארגוני", subtitle: "מעבר למסך Headcount", href: "/headcount", module: "headcount" },
];

export default function SmartSearchPage() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!normalized) return STATIC_INDEX;
    return STATIC_INDEX.filter(
      (item) =>
        item.title.toLowerCase().includes(normalized) ||
        item.subtitle.toLowerCase().includes(normalized) ||
        item.module.toLowerCase().includes(normalized),
    );
  }, [normalized]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-black text-[#002649]">חיפוש חכם רוחבי</h1>
        <p className="text-slate-500 mt-2">חיפוש מהיר בין מודולים מרכזיים ושמירת הקשר ניווט.</p>
      </div>

      <div className="relative">
        <Search size={18} className="absolute right-3 top-3 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חפש משרה, מועמד, דוח..."
          className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:border-[#EF6B00]"
        />
      </div>

      <div className="space-y-3">
        {results.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-[#EF6B00] transition-colors"
          >
            <div className="text-sm font-black text-[#002649]">{item.title}</div>
            <div className="text-xs text-slate-500 mt-1">{item.subtitle}</div>
          </Link>
        ))}
        {results.length === 0 && <div className="text-sm font-bold text-slate-400">לא נמצאו תוצאות.</div>}
      </div>
    </div>
  );
}
