"use client";

import React, { useState } from "react";
import { FileText, Loader2, Download } from "lucide-react";

export default function ReportsGenerator() {
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
