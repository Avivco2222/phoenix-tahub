"use client";

import { useState } from "react";
import { 
  ShieldCheck, UserPlus, Edit3, Trash2, Key, Mail, 
  Briefcase, Search, CheckCircle2, XCircle, AlertTriangle, Users
} from "lucide-react";

// --- נתוני דמה ראשוניים ---
const INITIAL_USERS = [
  { id: "u1", name: "אביב כהן", email: "avivc@fnx.co.il", role: "admin", scope: "all", status: "active", lastLogin: "היום, 08:30" },
  { id: "u2", name: "מור אהרון", email: "mora@fnx.co.il", role: "recruiter", scope: "all", status: "active", lastLogin: "היום, 09:15" },
  { id: "u3", name: "דן שפירא", email: "dans@fnx.co.il", role: "hiring_manager", scope: "R&D", status: "active", lastLogin: "אתמול, 14:20" },
  { id: "u4", name: "שרון לוי", email: "sharonl@fnx.co.il", role: "hrbp", scope: "Sales & Service", status: "suspended", lastLogin: "10/01/2026" }
];

const ROLES_MAP: Record<string, { label: string, color: string }> = {
  admin: { label: "מנהל.ת מערכת (Admin)", color: "bg-purple-100 text-purple-800 border-purple-200" },
  hrbp: { label: "HRBP", color: "bg-blue-100 text-blue-800 border-blue-200" },
  recruiter: { label: "מגייס.ת", color: "bg-green-100 text-green-800 border-green-200" },
  hiring_manager: { label: "מנהל.ת מגייס.ת", color: "bg-orange-100 text-orange-800 border-orange-200" }
};

const DEPARTMENTS = ["all", "R&D", "Sales & Service", "HR", "Finance", "Marketing"];

export default function PermissionsPage() {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);

  // חישובים מהירים
  const activeUsersCount = users.filter(u => u.status === "active").length;
  const adminCount = users.filter(u => u.role === "admin").length;

  const handleSaveUser = (user: any) => {
    if (user.id) {
      setUsers(users.map(u => u.id === user.id ? user : u));
    } else {
      setUsers([...users, { ...user, id: `u-${Date.now()}`, status: "active", lastLogin: "טרם התחבר.ה" }]);
    }
    setEditingUser(null);
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm("האם אתה בטוח שברצונך להשעות משתמש זה? מטעמי תיעוד Data Governance, המשתמש לא יימחק כליל אלא יושעה.")) {
      setUsers(users.map(u => u.id === id ? { ...u, status: "suspended" } : u));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-[#002649] flex items-center gap-3">
            ניהול הרשאות מערכת <ShieldCheck className="text-[#EF6B00]" size={32} />
          </h1>
          <p className="text-slate-500 mt-2">הקמת משתמשים, הגדרת תפקידים (RBAC), ותיחום הרשאות מידע מחלקתי.</p>
        </div>
        <button 
          onClick={() => setEditingUser({ name: "", email: "", role: "hiring_manager", scope: "all" })}
          className="bg-[#002649] text-white px-5 py-2.5 rounded-lg font-bold hover:bg-[#EF6B00] transition-all flex items-center gap-2 shadow-sm"
        >
          <UserPlus size={18} /> הוסף משתמש
        </button>
      </div>

      {/* KPIs & Security Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-6 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 text-slate-500 mb-2 font-bold"><Users size={18} /> משתמשים פעילים</div>
          <div className="text-3xl font-black text-[#002649]">{activeUsersCount}</div>
        </div>
        <div className="glass-card rounded-2xl p-6 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 text-slate-500 mb-2 font-bold"><Key size={18} /> הרשאות מנהל (Admins)</div>
          <div className="text-3xl font-black text-[#002649]">{adminCount}</div>
        </div>
        <div className="glass-card rounded-2xl p-6 bg-orange-50 border border-orange-100 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-orange-800 mb-2 font-bold"><AlertTriangle size={18} /> בקרת אבטחה פעילה</div>
          <p className="text-xs text-slate-700 font-medium leading-relaxed">
            המערכת חוסמת אוטומטית גישה לנתוני פיננסים (FinOps) עבור משתמשים שאינם בתפקיד Admin או HRBP.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-bold text-lg text-[#002649]">מאגר משתמשי Phoenix OS</h3>
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="חיפוש לפי שם או דוא״ל..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-[#EF6B00] outline-none"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#002649] text-white font-bold">
              <tr>
                <th className="px-6 py-4">שם משתמש</th>
                <th className="px-6 py-4">תפקיד מערכתי (Role)</th>
                <th className="px-6 py-4">תחום הרשאת דאטה (Scope)</th>
                <th className="px-6 py-4">סטטוס חיבור</th>
                <th className="px-6 py-4 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.filter(u => u.name.includes(searchTerm) || u.email.includes(searchTerm)).map((user) => (
                <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${user.status === 'suspended' ? 'opacity-50 bg-slate-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-black text-[#002649] text-base">{user.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${ROLES_MAP[user.role].color}`}>
                      {ROLES_MAP[user.role].label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Briefcase size={14} className="text-slate-400" />
                      <span className="font-bold text-slate-700">{user.scope === 'all' ? 'כלל הארגון (Global)' : user.scope}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.status === 'active' ? (
                      <div>
                        <span className="flex items-center gap-1 text-green-600 font-bold text-xs mb-1"><CheckCircle2 size={14}/> פעיל</span>
                        <span className="text-[10px] text-slate-400">התחבר: {user.lastLogin}</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 font-bold text-xs"><XCircle size={14}/> מושהה</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center flex justify-center gap-3 mt-2">
                    <button onClick={() => setEditingUser(user)} className="text-slate-400 hover:text-blue-500 transition-colors p-1" title="ערוך הרשאות"><Edit3 size={18}/></button>
                    {user.status === 'active' && (
                      <button onClick={() => handleDeleteUser(user.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="השעה משתמש"><Trash2 size={18}/></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================= */}
      {/* USER EDITOR MODAL */}
      {/* ========================================= */}
      {editingUser && (
        <div className="fixed inset-0 bg-[#002649]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-[#002649] flex items-center gap-2">
                <ShieldCheck className="text-[#EF6B00]"/> {editingUser.id ? "עריכת הרשאות משתמש" : "הקמת משתמש חדש"}
              </h2>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">✕</button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">שם מלא</label>
                  <input type="text" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-[#EF6B00] font-bold text-[#002649]" placeholder="לדוג׳: ישראל ישראלי" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">כתובת דוא״ל פנים ארגונית</label>
                  <div className="relative">
                    <Mail size={16} className="absolute right-3 top-3 text-slate-400" />
                    <input type="email" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-[#EF6B00] font-mono text-sm text-[#002649]" dir="ltr" placeholder="email@fnx.co.il" />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 space-y-5">
                <div>
                  <label className="block text-xs font-black text-[#002649] mb-2">תפקיד מערכתי (Role)</label>
                  <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-2.5 border border-blue-200 rounded-lg outline-none font-bold text-[#002649] cursor-pointer">
                    {Object.keys(ROLES_MAP).map(key => (
                      <option key={key} value={key}>{ROLES_MAP[key].label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">קובע אילו מסכים ותפריטים יהיו זמינים למשתמש בסרגל הצד.</p>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#002649] mb-2">חשיפה לדאטה (Data Scope)</label>
                  <select value={editingUser.scope} onChange={e => setEditingUser({...editingUser, scope: e.target.value})} className="w-full p-2.5 border border-blue-200 rounded-lg outline-none font-bold text-slate-700 cursor-pointer">
                    <option value="all">כלל הארגון (Global View)</option>
                    {DEPARTMENTS.filter(d => d !== "all").map(dep => (
                      <option key={dep} value={dep}>הגבל לחטיבת: {dep}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">קובע אילו מועמדים, משרות ותקציבים המשתמש רשאי לראות בדשבורד.</p>
                </div>
              </div>
              
              {editingUser.id && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">סטטוס חשבון</label>
                  <select value={editingUser.status} onChange={e => setEditingUser({...editingUser, status: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg outline-none">
                    <option value="active">פעיל - רשאי להתחבר</option>
                    <option value="suspended">מושהה - חסום מגישה</option>
                  </select>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setEditingUser(null)} className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">ביטול</button>
              <button onClick={() => handleSaveUser(editingUser)} className="px-6 py-2.5 font-bold text-white bg-[#002649] hover:bg-[#EF6B00] rounded-lg transition-colors shadow-md">
                שמור הרשאות
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
