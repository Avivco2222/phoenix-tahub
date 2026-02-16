"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { 
  Receipt, UploadCloud, Edit3, Plus, 
  PieChart, FileText, BadgeDollarSign, Target, ArrowDownToLine, 
  Building2, TrendingUp, Search, Trash2, Eye, ChevronDown, ChevronUp,
  CalendarDays, Flame, History
} from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

interface Category {
  id: number;
  name: string;
  target: number;
  previousYearSpend: number;
  previous_year_spend?: number;
  code: string;
  notes: string;
  subcategories: string[];
}

interface Vendor {
  id: string;
  name: string;
  defaultCategory?: string;
  default_category?: string;
  totalPaid?: number;
  total_paid?: number;
  activeInvoices?: number;
  active_invoices?: number;
}

interface Invoice {
  id: string;
  vendor: string;
  date: string;
  dueDate?: string;
  due_date?: string;
  budgetMonth?: string;
  budget_month?: string;
  amount: number;
  category: string;
  subcategory: string;
  status: string;
  note: string;
  fileUrl?: string;
  file_url?: string;
}

interface TabBtnProps {
  id: string;
  current: string;
  onClick: (id: string) => void;
  icon: ReactNode;
  label: string;
  alert?: number;
}

const DEFAULT_CATEGORIES = [
  { id: 1, name: "חברות השמה", target: 150000, previousYearSpend: 135000, code: "HR-01", notes: "עמלות טכנולוגי", subcategories: ["השמת בכיר"] },
  { id: 2, name: "שיווק ופרסום", target: 80000, previousYearSpend: 95000, code: "HR-02", notes: "קמפיינים", subcategories: ["קמפיין ממומן"] },
  { id: 3, name: "כללי למיפוי", target: 0, previousYearSpend: 0, code: "NA", notes: "תיבת ממתינים", subcategories: ["אחר"] }
];

const PIE_COLORS = ['#002649', '#EF6B00', '#3b82f6', '#8b5cf6', '#10b981', '#f43f5e', '#14b8a6'];

function getStatusColor(status: string): string {
  if (status === 'שולם') return 'bg-slate-100 text-slate-500';
  if (status.includes('ממתין')) return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
}

export default function UnifiedBudgetPage() {
  const [activeTab, setActiveTab] = useState("analytics");
  const [isLoading, setIsLoading] = useState(true);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  const [budgetTarget] = useState(380000); 
  
  // Modals & States
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null); 
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Toggles & Search
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [isYoYCompare, setIsYoYCompare] = useState(false);

  // --- תקשורת לשרת הפייתון (API) ---
  const fetchFinopsData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/finops/data`);
      const data = await res.json();
      
      if (data.categories && data.categories.length > 0) {
        setCategories(data.categories.map((c: Category & { previous_year_spend?: number }) => ({...c, previousYearSpend: c.previous_year_spend ?? 0})));
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
      
      if (data.vendors) setVendors(data.vendors);
      
      if (data.invoices) {
        setInvoices(data.invoices.map((i: Invoice) => ({
          ...i, dueDate: i.due_date, budgetMonth: i.budget_month, fileUrl: i.file_url
        })));
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinopsData();
  }, []);

  // --- פעולות שמירה ל-DB (CRUD) ---
  const handleSaveInvoice = async (invoice: Invoice) => {
    if (invoice.category !== "כללי למיפוי" && invoice.status === "ממתין למיפוי") {
      invoice.status = "ממתין לאישור הנהח״ש";
    }
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/finops/save_invoice`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoice)
    });
    setEditingInvoice(null);
    fetchFinopsData(); 
  };

  const handleDeleteInvoice = async (id: string) => {
    if (globalThis.confirm("מחיקת החשבונית היא לצמיתות (תירשם ביומן מערכת). לאשר?")) {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/finops/invoice/${id}`, { method: "DELETE" });
      fetchFinopsData();
    }
  };

  const handleSaveVendor = async (vendor: Partial<Vendor>) => {
    const newVendor = vendor.id ? vendor : { ...vendor, id: `v-${Date.now()}` };
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/finops/save_vendor`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newVendor)
    });
    setEditingVendor(null);
    fetchFinopsData();
  };

  const handleSaveCategoriesDB = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/finops/save_categories`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(categories)
    });
    setIsCategoryManagerOpen(false);
    fetchFinopsData();
  };

  const handleVendorClick = (vendorName: string) => {
    setLedgerSearch(vendorName);
    setActiveTab("operations");
  };

  // --- העלאת קבצים אמיתית לשרת ---
  const uploadFileToServer = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/finops/upload_invoice`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      
      const data = await res.json();
      const extracted = data.extracted_data;
      
      // המרה לשמות שה-React מכיר
      const newInvoice = {
        ...extracted,
        fileUrl: extracted.file_url,
        budgetMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      };
      
      // שמירה מיידית למסד הנתונים
      await handleSaveInvoice(newInvoice);
      
    } catch (err) {
      console.error(err);
      alert("שגיאה בהעלאת הקובץ. ודא ששרת הפייתון רץ.");
    } finally {
      setIsUploading(false);
      // איפוס התיבה כדי שאפשר יהיה להעלות שוב את אותו קובץ אם נרצה
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => { 
    e.preventDefault(); 
    if (e.dataTransfer.files?.[0]) uploadFileToServer(e.dataTransfer.files[0]); 
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) uploadFileToServer(e.target.files[0]);
  };

  // --- חישובים אסטרטגיים ---
  const pendingInvoices = invoices.filter(inv => inv.category === "כללי למיפוי" || inv.status === "ממתין למיפוי");
  const mappedInvoices = invoices.filter(inv => inv.category !== "כללי למיפוי" && inv.status !== "ממתין למיפוי");
  
  const totalSpend = mappedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const budgetUtilization = budgetTarget > 0 ? (totalSpend / budgetTarget) * 100 : 0;

  const spendByCategory = mappedInvoices.reduce((acc: Record<string, number>, inv) => {
    acc[inv.category] = (acc[inv.category] || 0) + inv.amount;
    return acc;
  }, {});
  const pieData = Object.keys(spendByCategory).map(key => ({ name: key, value: spendByCategory[key] }));

  const monthsElapsed = 2; 
  const monthlyRunRate = totalSpend / monthsElapsed;
  const remainingBudget = budgetTarget - totalSpend;
  const monthsLeft = monthlyRunRate > 0 ? remainingBudget / monthlyRunRate : 0;
  const today = new Date();
  const estimatedEndMonth = new Date(today.getFullYear(), today.getMonth() + Math.floor(monthsLeft), 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  // --- פונקציות קטגוריות מקומיות ---
  const updateCategory = (id: number, field: string, value: string | number) => setCategories(categories.map(c => c.id === id ? { ...c, [field]: value } : c));
  const addCategory = () => setCategories([...categories, { id: Date.now(), name: "קטגוריה חדשה", target: 0, previousYearSpend: 0, code: "NEW", notes: "", subcategories: ["כללי"] }]);
  const deleteCategory = (id: number) => globalThis.confirm("למחוק?") && setCategories(categories.filter(c => c.id !== id));
  const addSubcategory = (catId: number) => {
    const subName = prompt("הכנס שם תת-קטגוריה:");
    if (subName) setCategories(categories.map(c => c.id === catId ? { ...c, subcategories: [...c.subcategories, subName] } : c));
  };
  const removeSubcategory = (catId: number, subToRemove: string) => setCategories(categories.map(c => c.id === catId ? { ...c, subcategories: c.subcategories.filter((s: string) => s !== subToRemove) } : c));


  if (isLoading) {
    return <div className="flex justify-center items-center h-96"><div className="w-10 h-10 border-4 border-[#002649] border-t-[#EF6B00] rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
            ניהול תקציב (FinOps) <BadgeDollarSign className="text-[#EF6B00]" size={32} />
          </h1>
          <p className="text-slate-500 mt-2">אנליטיקה, תפעול חשבוניות וניהול ספקים (מסונכרן לשרת Live 🟢)</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          <TabBtn id="analytics" current={activeTab} onClick={setActiveTab} icon={<PieChart size={16}/>} label="דשבורד ואנליטיקה" />
          <TabBtn id="operations" current={activeTab} onClick={setActiveTab} icon={<Receipt size={16}/>} label="יומן ותפעול" alert={pendingInvoices.length} />
          <TabBtn id="vendors" current={activeTab} onClick={setActiveTab} icon={<Building2 size={16}/>} label="ספקים (CRM)" />
        </div>
      </div>

      {/* ========================================= */}
      {/* TAB 1: ANALYTICS & DRILL-DOWN */}
      {/* ========================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-2xl p-6 border-t-4 border-t-[#002649]">
              <div className="flex items-center gap-2 text-slate-500 mb-2 font-bold"><Target size={18} /> ניצול תקציב מול יעד כללי</div>
              <div className="text-4xl font-black text-[#002649]">₪{totalSpend.toLocaleString()}</div>
              <div className="flex justify-between text-xs font-bold text-slate-400 mt-4 mb-1">
                <span>נוצל ({budgetUtilization.toFixed(1)}%)</span>
                <span>יעד: ₪{budgetTarget.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${budgetUtilization > 85 ? 'bg-red-500' : 'bg-[#EF6B00]'}`} style={{width: `${budgetUtilization}%`}}></div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border-t-4 border-t-blue-500">
              <div className="flex items-center gap-2 text-slate-500 mb-2 font-bold"><PieChart size={18} /> התפלגות קטגוריות אב</div>
              <div className="h-32 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value) => `₪${Number(value).toLocaleString()}`} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 bg-gradient-to-br from-white to-orange-50 border border-orange-100 flex flex-col justify-center relative overflow-hidden">
              <Flame size={120} className="absolute -left-6 -bottom-6 text-orange-500/10" />
              <div className="flex items-center gap-2 text-orange-800 mb-3 font-bold relative z-10"><TrendingUp size={18} /> קצב שריפת תקציב (Run Rate)</div>
              <div className="text-sm text-slate-700 leading-relaxed font-medium relative z-10">
                ההוצאה החודשית הממוצעת עומדת על <strong>₪{monthlyRunRate.toLocaleString()}</strong>.<br/>
                בקצב ההוצאות הנוכחי, התקציב שלך צפוי להסתיים ב-
                <span className="font-black text-red-600 mr-1">{estimatedEndMonth}</span>.
              </div>
              <button onClick={() => setIsCategoryManagerOpen(true)} className="mt-4 text-xs font-bold text-[#EF6B00] bg-orange-100 px-4 py-2 rounded-lg hover:bg-orange-200 w-fit relative z-10">
                ניהול מילון ויעדי קטגוריות
              </button>
            </div>
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
              <h3 className="font-bold text-lg text-[#002649] flex items-center gap-2">
                <ArrowDownToLine size={18} className="text-blue-500"/> תמונת מצב תקציבית (Drill-Down)
              </h3>
              <button 
                onClick={() => setIsYoYCompare(!isYoYCompare)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${isYoYCompare ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              >
                <History size={14} /> השוואה לשנה קודמת (YoY)
              </button>
            </div>
            
            <div className="divide-y divide-slate-100">
              {categories.filter(c => c.name !== "כללי למיפוי").map(category => {
                const catSpend = spendByCategory[category.name] || 0;
                const catUtil = category.target > 0 ? (catSpend / category.target) * 100 : 0;
                const isExpanded = expandedCategory === category.id;
                const prevSpend = category.previousYearSpend || 0;
                const yoyChange = prevSpend > 0 ? ((catSpend - prevSpend) / prevSpend) * 100 : 0;

                return (
                  <div key={category.id} className="bg-white">
                    <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setExpandedCategory(isExpanded ? null : category.id)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedCategory(isExpanded ? null : category.id)}>
                      <div className="flex items-center gap-4 flex-1">
                        {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                        <div>
                          <div className="font-black text-[#002649] text-base flex items-center gap-2">
                            {category.name}
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">{category.code}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{category.notes}</div>
                        </div>
                      </div>
                      
                      <div className="w-1/3 px-8 hidden md:block">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                          <span>{catUtil.toFixed(1)}%</span>
                          <span>₪{catSpend.toLocaleString()} / ₪{category.target.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${catUtil > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${Math.min(catUtil, 100)}%`}}></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-48 justify-end">
                        {isYoYCompare && prevSpend > 0 && (
                          <div className={`text-[10px] font-black px-2 py-1 rounded-md border ${yoyChange > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                            {yoyChange > 0 ? '⬆️' : '⬇️'} {Math.abs(yoyChange).toFixed(0)}%
                          </div>
                        )}
                        <div className="font-black text-lg text-[#002649] text-right">
                          ₪{catSpend.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-slate-50/80 p-6 border-t border-slate-100 shadow-inner">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">פירוט הוצאות לפי תת-קטגוריה</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {category.subcategories.map((sub: string) => {
                            const subSpend = mappedInvoices.filter(inv => inv.category === category.name && inv.subcategory === sub).reduce((s, inv) => s + inv.amount, 0);
                            return (
                              <div key={sub} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                                <span className="font-bold text-slate-700">{sub}</span>
                                <span className="font-black text-[#002649]">₪{subSpend.toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* TAB 2: OPERATIONS (תפעול חשבוניות תחתון) */}
      {/* ========================================= */}
      {activeTab === "operations" && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          
          {pendingInvoices.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-amber-200/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black shadow-inner">{pendingInvoices.length}</div>
                  <div>
                    <h2 className="font-black text-amber-900">חשבוניות למיפוי (Inbox)</h2>
                    <p className="text-xs text-amber-700">חשבוניות שחולצו ע&quot;י ה-AI וממתינות לאישור חודש שיוך וקטגוריה.</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {pendingInvoices.map(inv => (
                  <div key={inv.id} className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-[#002649] truncate">{inv.vendor}</div>
                      <div className="font-black text-amber-600">₪{inv.amount.toLocaleString()}</div>
                    </div>
                    <button onClick={() => setEditingInvoice(inv)} className="w-full bg-amber-100 text-amber-800 font-bold text-xs py-2 rounded-lg hover:bg-amber-200 mt-2">
                      מפה וסווג חשבונית
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* The REAL Upload Dropzone */}
            <div 
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && document.getElementById('actual-file-input')?.click()}
              className="lg:col-span-1 border-2 border-dashed border-slate-300 bg-white rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#002649] hover:bg-slate-50 transition-colors relative"
              onDragOver={(e)=>e.preventDefault()} 
              onDrop={handleDrop}
              onClick={() => document.getElementById('actual-file-input')?.click()}
            >
              <input 
                type="file" 
                id="actual-file-input" 
                className="hidden" 
                onChange={handleFileInputChange} 
                accept=".pdf,image/jpeg,image/png"
              />
              
              {isUploading ? (
                <div className="text-center animate-pulse">
                  <UploadCloud size={32} className="text-[#EF6B00] mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-slate-700">מעלה וקורא מסמך...</h4>
                </div>
              ) : (
                <div className="text-center">
                  <Receipt size={24} className="text-blue-500 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-[#002649]">גרור או לחץ להעלאה</h4>
                  <p className="text-xs text-slate-500 mt-1">PDF או תמונה (JPG/PNG)</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-3 glass-card rounded-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="font-bold text-[#002649] flex items-center gap-2"><FileText size={18}/> יומן חשבוניות מלא</h3>
                <div className="relative w-full md:w-64">
                  <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="חיפוש ספק, קטגוריה..." 
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-[#EF6B00] outline-none"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-[#002649] text-white font-bold">
                    <tr>
                      <th className="px-4 py-3">ספק</th>
                      <th className="px-4 py-3">קטגוריה</th>
                      <th className="px-4 py-3">תאריך חשבונית</th>
                      <th className="px-4 py-3">חודש שיוך</th>
                      <th className="px-4 py-3">סכום</th>
                      <th className="px-4 py-3">סטטוס</th>
                      <th className="px-4 py-3 text-center">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.filter(i => i.vendor.includes(ledgerSearch) || i.category.includes(ledgerSearch)).map((inv) => (
                      <tr key={inv.id} className="hover:bg-blue-50 group transition-colors">
                        <td className="px-4 py-3 font-bold text-[#002649] truncate max-w-[120px]">{inv.vendor}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-bold text-slate-700">{inv.category}</div>
                          <div className="text-[10px] text-slate-400">{inv.subcategory}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{inv.date}</td>
                        <td className="px-4 py-3">
                           <span className="flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded text-xs font-bold w-fit">
                             <CalendarDays size={12}/> {inv.budgetMonth || "חסר שיוך"}
                           </span>
                        </td>
                        <td className="px-4 py-3 font-black text-slate-800">₪{inv.amount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${getStatusColor(inv.status)}`}>{inv.status}</span>
                        </td>
                        <td className="px-4 py-3 text-center flex justify-center gap-3">
                          <button onClick={() => setViewingImage(inv.fileUrl || null)} className="text-slate-400 hover:text-blue-500" title="צפה במסמך"><Eye size={16}/></button>
                          <button onClick={() => setEditingInvoice(inv)} className="text-slate-400 hover:text-[#EF6B00]" title="ערוך"><Edit3 size={16}/></button>
                          <button onClick={() => handleDeleteInvoice(inv.id)} className="text-slate-400 hover:text-red-500" title="מחק"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {invoices.length === 0 && <div className="p-8 text-center text-slate-400 font-bold">יומן החשבוניות ריק. העלה חשבונית כדי להתחיל.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* TAB 3: VENDORS CRM (ניהול ספקים) */}
      {/* ========================================= */}
      {activeTab === "vendors" && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
              <h3 className="font-bold text-lg text-[#002649] flex items-center gap-2"><Building2 size={20} className="text-[#EF6B00]"/> מאגר ספקים</h3>
              <div className="flex gap-3">
                <div className="relative">
                  <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
                  <input type="text" placeholder="חיפוש ספק..." value={vendorSearch} onChange={(e)=>setVendorSearch(e.target.value)} className="w-48 pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-[#EF6B00] outline-none" />
                </div>
                <button onClick={() => setEditingVendor({ name: "", defaultCategory: "" })} className="bg-[#002649] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-[#EF6B00]">
                  <Plus size={16} /> ספק חדש
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-[#002649] text-white font-bold">
                  <tr>
                    <th className="px-6 py-4">שם ספק</th><th className="px-6 py-4">קטגוריה ראשית</th>
                    <th className="px-6 py-4">חשבוניות פתוחות</th><th className="px-6 py-4">סה״כ שולם</th>
                    <th className="px-6 py-4 text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendors.filter(v => v.name.includes(vendorSearch)).map(vendor => (
                    <tr key={vendor.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-black text-[#002649]">{vendor.name}</td>
                      <td className="px-6 py-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{vendor.defaultCategory}</span></td>
                      <td className="px-6 py-4">
                        {(vendor.activeInvoices ?? vendor.active_invoices ?? 0) > 0 ? (
                          <button onClick={() => handleVendorClick(vendor.name)} className="bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-3 py-1 rounded-full text-xs transition-colors shadow-sm">
                            {vendor.activeInvoices ?? vendor.active_invoices} ממתינות (צפה)
                          </button>
                        ) : (<span className="text-slate-400 text-xs">אין חובות</span>)}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">₪{(vendor.totalPaid ?? vendor.total_paid ?? 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-center flex justify-center gap-3">
                        <button onClick={() => setEditingVendor(vendor)} className="text-slate-400 hover:text-blue-500"><Edit3 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vendors.length === 0 && <div className="p-8 text-center text-slate-400 font-bold">מאגר הספקים ריק. הקם ספק חדש.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODALS */}
      {/* ========================================= */}
      
      {/* VENDOR EDITOR MODAL */}
      {editingVendor && (
        <div className="fixed inset-0 bg-[#002649]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between bg-slate-50">
              <h2 className="text-xl font-black text-[#002649]">{editingVendor.id ? "עריכת ספק" : "הקמת ספק חדש"}</h2>
              <button onClick={() => setEditingVendor(null)} className="text-slate-500 hover:text-red-500 font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">שם ספק רשמי</label>
                <input type="text" value={editingVendor.name} onChange={e => setEditingVendor({...editingVendor, name: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg font-bold outline-none focus:border-[#EF6B00]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">קטגוריית ברירת מחדל למיפוי</label>
                <select value={editingVendor.defaultCategory} onChange={e => setEditingVendor({...editingVendor, defaultCategory: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-[#EF6B00]">
                  <option value="">בחר קטגוריה...</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setEditingVendor(null)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg">ביטול</button>
              <button onClick={() => handleSaveVendor(editingVendor)} className="px-6 py-2 font-bold text-white bg-[#002649] hover:bg-[#EF6B00] rounded-lg">שמור ספק</button>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {isCategoryManagerOpen && (
        <div className="fixed inset-0 bg-[#002649]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-black text-[#002649]">ניהול מילון ויעדי קטגוריות</h2>
                <p className="text-xs text-slate-500 mt-1">ערוך סעיפי תקציב, יעדים, והשוואה לשנה קודמת.</p>
              </div>
              <button onClick={() => setIsCategoryManagerOpen(false)} className="p-2 hover:bg-slate-200 rounded-full font-bold">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {categories.map(cat => (
                <div key={cat.id} className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm relative">
                  {cat.name !== "כללי למיפוי" && <button onClick={() => deleteCategory(cat.id)} className="absolute top-4 left-4 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-100 pb-4 mb-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">שם קטגוריה</label>
                      <input type="text" value={cat.name} onChange={(e) => updateCategory(cat.id, 'name', e.target.value)} disabled={cat.name === "כללי למיפוי"} className="w-full font-bold text-[#002649] text-lg border-b border-transparent focus:border-[#EF6B00] outline-none bg-transparent" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">סעיף תקציבי / קוד</label>
                      <input type="text" value={cat.code} onChange={(e) => updateCategory(cat.id, 'code', e.target.value)} className="w-full font-mono text-sm text-slate-600 border border-slate-200 rounded p-1 outline-none focus:border-[#EF6B00]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">יעד שנתי נוכחי (₪)</label>
                      <input type="number" value={cat.target} onChange={(e) => updateCategory(cat.id, 'target', Number(e.target.value))} className="w-full font-black text-[#002649] border border-slate-200 rounded p-1 outline-none focus:border-[#EF6B00]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">הוצאה בפועל אשתקד (₪)</label>
                      <input type="number" value={cat.previousYearSpend || 0} onChange={(e) => updateCategory(cat.id, 'previousYearSpend', Number(e.target.value))} className="w-full font-black text-slate-500 border border-slate-200 rounded p-1 outline-none focus:border-[#EF6B00] bg-slate-50" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">תתי קטגוריות</label>
                    <div className="flex flex-wrap gap-2">
                      {cat.subcategories.map((sub: string) => (
                        <span key={sub} className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 border border-slate-200">
                          {sub} {cat.name !== "כללי למיפוי" && <button onClick={() => removeSubcategory(cat.id, sub)} className="hover:text-red-500 text-lg leading-none">&times;</button>}
                        </span>
                      ))}
                      {cat.name !== "כללי למיפוי" && (
                        <button onClick={() => addSubcategory(cat.id)} className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-blue-100">
                          <Plus size={14} /> הוסף
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addCategory} className="w-full border-2 border-dashed border-slate-300 text-slate-500 font-bold py-4 rounded-xl hover:border-[#EF6B00] hover:text-[#EF6B00] flex justify-center gap-2 transition-colors">
                <Plus size={18}/> קטגוריה חדשה
              </button>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setIsCategoryManagerOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg">ביטול וסגירה</button>
              <button onClick={handleSaveCategoriesDB} className="px-6 py-2 font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-md">שמור שינויים בשרת</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Editor Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-[#002649]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between bg-slate-50">
              <h2 className="text-xl font-black text-[#002649]">עריכת חשבונית / מיפוי</h2>
              <button onClick={() => setEditingInvoice(null)} className="text-slate-500 font-bold">✕</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">ספק</label>
                <select value={editingInvoice.vendor} onChange={e => setEditingInvoice({...editingInvoice, vendor: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg outline-none font-bold text-[#002649]">
                  {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-bold text-[#EF6B00] mb-1 flex items-center gap-1">
                  <CalendarDays size={14}/> חודש שיוך תקציבי (Accrual)
                </label>
                <input type="month" value={editingInvoice.budgetMonth || ""} onChange={e => setEditingInvoice({...editingInvoice, budgetMonth: e.target.value})} className="w-full p-2 border border-[#EF6B00] bg-orange-50/30 rounded-lg font-bold text-[#002649] outline-none" />
              </div>

              <div className="col-span-2 md:col-span-1 mt-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">תאריך חשבונית (רשמי)</label>
                <input type="text" value={editingInvoice.date} disabled className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg font-mono text-slate-500" />
              </div>

              <div className="col-span-2 md:col-span-1 mt-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">סכום (₪)</label>
                <input type="number" value={editingInvoice.amount} onChange={e => setEditingInvoice({...editingInvoice, amount: Number(e.target.value)})} className="w-full p-2 border border-slate-200 rounded-lg font-black text-lg" />
              </div>

              <div className="col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100 mt-2">
                <label className="block text-xs font-black text-blue-800 mb-2">קטגוריה תקציבית</label>
                <div className="grid grid-cols-2 gap-4">
                  <select value={editingInvoice.category} onChange={e => setEditingInvoice({...editingInvoice, category: e.target.value, subcategory: categories.find(c => c.name === e.target.value)?.subcategories[0] || ""})} className="w-full p-2 border border-blue-200 rounded-lg font-bold text-[#002649] outline-none">
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <select value={editingInvoice.subcategory} onChange={e => setEditingInvoice({...editingInvoice, subcategory: e.target.value})} className="w-full p-2 border border-blue-200 rounded-lg outline-none">
                    {categories.find(c => c.name === editingInvoice.category)?.subcategories.map((s: string) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">הערות ליומן (Notes)</label>
                <input type="text" value={editingInvoice.note} onChange={e => setEditingInvoice({...editingInvoice, note: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg outline-none" placeholder="לדוג׳: עבור קמפיין מפתחי Java..." />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setEditingInvoice(null)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg">ביטול</button>
              <button onClick={() => handleSaveInvoice(editingInvoice)} className="px-6 py-2 font-bold text-white bg-[#002649] hover:bg-[#EF6B00] rounded-lg shadow-md transition-colors">שמור חשבונית</button>
            </div>
          </div>
        </div>
      )}

      {/* View Image Modal */}
      {viewingImage && (
        <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Escape' && setViewingImage(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setViewingImage(null)}>
          <div role="dialog" className="bg-white p-2 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col items-center overflow-hidden" onClick={e => e.stopPropagation()}>
             <div className="w-full flex justify-between p-4 border-b border-slate-100 bg-slate-50">
               <h3 className="font-bold text-[#002649]">תצוגת מסמך מקור</h3>
               <button onClick={() => setViewingImage(null)} className="font-bold text-red-500 hover:text-red-700">✕ סגור</button>
             </div>
             <div className="w-full flex-1 bg-slate-100 flex items-center justify-center overflow-auto p-4">
                {viewingImage ? (
                  <iframe src={`${process.env.NEXT_PUBLIC_API_URL}/${viewingImage}`} className="w-full h-[70vh] border-0 rounded-lg shadow-sm" title="Invoice Document"/>
                ) : (
                  <div className="text-slate-400 font-bold">לא צורף מסמך מקור (חשבונית הוקלדה ידנית)</div>
                )}
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

function TabBtn({ id, current, onClick, icon, label, alert }: Readonly<TabBtnProps>) {
  const isActive = current === id;
  return (
    <button onClick={() => onClick(id)} className={`relative flex items-center gap-2 px-5 py-2 font-bold text-sm transition-all rounded-lg ${isActive ? 'bg-white text-[#002649] shadow-sm' : 'text-slate-500 hover:text-[#002649] hover:bg-white/50'}`}>
      {icon} {label}
      {(alert ?? 0) > 0 && <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-black">{alert}</span>}
    </button>
  );
}