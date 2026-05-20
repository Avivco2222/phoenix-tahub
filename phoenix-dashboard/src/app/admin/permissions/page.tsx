"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { useSession } from "@/context/SessionContext";
import {
  ShieldCheck, UserPlus, Edit3, Briefcase, Search,
  CheckCircle2, XCircle, Copy, FileSpreadsheet,
  Clock, MapPin, GitPullRequest, Activity, ShieldQuestion,
  UserCheck, Eye, Send, Hash, Loader2,
  ShieldAlert, Lock
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

// --- Types ---
type Role = "admin" | "hrbp" | "recruiter" | "hiring_manager";
type Module = "dashboard" | "candidates" | "intelligence" | "finops" | "admin";

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  employee_number?: string | null;
  status: "active" | "suspended" | "expired";
  lastLogin: string;
  permissions: {
    modules: Module[];
    dynamicRule?: string;      // 3. Rule-Based Access
    contextIP?: "all" | "office_only"; // 4. Context-Aware Access
    expiresAt?: string | null; // 5. Time-Bound Access
    delegatedTo?: string | null; // 1. Proxy/Delegation
  };
}

// --- Mock Data ---
const ROLES_MAP: Record<Role, { label: string, color: string }> = {
  admin: { label: "מנהל.ת מערכת (Admin)", color: "bg-purple-100 text-purple-800 border-purple-200" },
  hrbp: { label: "HRBP", color: "bg-blue-100 text-blue-800 border-blue-200" },
  recruiter: { label: "מגייס.ת", color: "bg-green-100 text-green-800 border-green-200" },
  hiring_manager: { label: "מנהל.ת מגייס.ת", color: "bg-orange-100 text-orange-800 border-orange-200" }
};

// Backend user schema (subset returned by /api/admin/users)
interface BackendUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  employee_number: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

const ROLE_RULES: Record<Role, string> = {
  admin: "גישה מלאה (Global)",
  hrbp: "מתכלל אגף — צפייה רוחבית",
  recruiter: "המשרות שמשויכות אליך",
  hiring_manager: "המשרות שלי בלבד",
};

function backendToFrontend(u: BackendUser): User {
  // Map backend (minimal) schema to frontend User. Advanced ABAC fields keep defaults.
  return {
    id: u.id,
    name: u.full_name,
    email: u.email,
    role: u.role,
    employee_number: u.employee_number,
    status: u.is_active ? "active" : "suspended",
    lastLogin: u.last_login_at ? new Date(u.last_login_at).toLocaleString("he-IL") : "טרם",
    permissions: {
      modules: [],
      dynamicRule: ROLE_RULES[u.role] ?? "—",
      contextIP: "all",
      expiresAt: null,
      delegatedTo: null,
    },
  };
}

// Real pending access requests come from /api/admin/access-requests when wired (v1.1).
const PENDING_REQUESTS: { id: string; user: string; request: string; date: string }[] = [];

function PermissionsTab() {
  const { showToast } = useToast();
  const { user: currentUser, impersonate } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "rules" | "context" | "delegation">("general");
  const [tempPasswordDialog, setTempPasswordDialog] = useState<{ email: string; password: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notifyTargets, setNotifyTargets] = useState<User[] | null>(null);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifySeverity, setNotifySeverity] = useState<"info" | "warning" | "danger" | "success">("info");
  const [isSendingNotify, setIsSendingNotify] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/users`, { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        showToast(`לא ניתן לטעון משתמשים (${res.status})`, "error");
        return;
      }
      const data = (await res.json()) as BackendUser[];
      setUsers(data.map(backendToFrontend));
    } catch {
      showToast("אין תקשורת עם השרת. ודאי שה-Backend פעיל.", "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [apiUrl, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- Send notification(s) ---
  const handleOpenNotify = (targets: User[]) => {
    if (targets.length === 0) return;
    setNotifyTargets(targets);
    setNotifyMessage("");
    setNotifySeverity("info");
  };

  const handleSendNotify = async () => {
    if (!notifyTargets || notifyTargets.length === 0) return;
    if (!notifyMessage.trim()) {
      showToast("נא להזין תוכן הודעה", "error");
      return;
    }
    setIsSendingNotify(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_ids: notifyTargets.map(u => u.id),
          message: notifyMessage.trim(),
          severity: notifySeverity,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data?.detail || `שליחה נכשלה (${res.status})`, "error");
        return;
      }
      const data = await res.json();
      showToast(`התראה נשלחה ל-${data.delivered} נמענים`, "success");
      setNotifyTargets(null);
      setNotifyMessage("");
      setSelectedUsers([]);
    } catch (err) {
      console.error("[handleSendNotify] error:", err);
      showToast("שגיאת רשת. נסי שוב.", "error");
    } finally {
      setIsSendingNotify(false);
    }
  };

  // --- "View as user" — admin impersonation ---
  const handleImpersonate = async (target: User) => {
    if (target.id === currentUser?.id) {
      showToast("אינך יכול להיכנס לנעלי עצמך", "info");
      return;
    }
    if (target.status !== "active") {
      showToast("לא ניתן להיכנס לנעלי משתמש מושעה", "error");
      return;
    }
    if (!window.confirm(`להיכנס לנעלי ${target.name} ולצפות במערכת בעיניו?\nכל הפעולות בסשן יירשמו בלוג.`)) {
      return;
    }
    try {
      await impersonate(target.id);
      // impersonate() redirects to "/" automatically
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impersonation נכשל", "error");
    }
  };

  // --- 8. Bulk Actions ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedUsers(users.map(u => u.id));
    else setSelectedUsers([]);
  };

  const handleSelectUser = (id: string) => {
    if (selectedUsers.includes(id)) setSelectedUsers(selectedUsers.filter(uid => uid !== id));
    else setSelectedUsers([...selectedUsers, id]);
  };

  const handleBulkAction = async (action: "suspend" | "clone") => {
    if (action === "suspend") {
      const targets = selectedUsers.slice();
      const results = await Promise.all(
        targets.map(id =>
          fetch(`${apiUrl}/api/admin/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ is_active: false }),
          }).then(r => r.ok)
        )
      );
      const failed = results.filter(ok => !ok).length;
      if (failed > 0) {
        showToast(`${failed} מתוך ${targets.length} השעיות נכשלו`, "error");
      } else {
        showToast(`${targets.length} משתמשים הושעו`, "success");
      }
      setSelectedUsers([]);
      fetchUsers();
    } else if (action === "clone" && selectedUsers.length === 1) {
      const sourceUser = users.find(u => u.id === selectedUsers[0]);
      if (sourceUser) {
        setEditingUser({ ...sourceUser, id: "", name: `${sourceUser.name} (עותק)`, email: "" });
        setActiveTab("general");
      }
    }
  };

  // --- 9. Export Matrix ---
  const handleExportMatrix = () => {
    showToast("ייצוא Access Review Matrix — בקרוב", "coming-soon");
  };

  // --- Modal Saves ---
  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (!editingUser.name.trim() || !editingUser.email.trim()) {
      showToast("חובה למלא שם ואימייל", "error");
      return;
    }
    if (!editingUser.id && !(editingUser.employee_number || "").trim()) {
      showToast("חובה למלא מספר עובד (USF) — הוא משמש גם כסיסמה", "error");
      return;
    }
    setIsSaving(true);
    try {
      if (editingUser.id) {
        // Update existing
        const res = await fetch(`${apiUrl}/api/admin/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            full_name: editingUser.name,
            role: editingUser.role,
            is_active: editingUser.status === "active",
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showToast(data?.detail || `עדכון נכשל (${res.status})`, "error");
          return;
        }
        showToast("המשתמש עודכן", "success");
      } else {
        // Create new
        const res = await fetch(`${apiUrl}/api/admin/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: editingUser.email,
            employee_number: editingUser.employee_number,
            full_name: editingUser.name,
            role: editingUser.role,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showToast(data?.detail || `יצירה נכשלה (${res.status})`, "error");
          return;
        }
        const data = await res.json();
        // The USF the admin entered is also the user's first-login password.
        setTempPasswordDialog({ email: data.email, password: data.employee_number || editingUser.employee_number || "" });
        showToast(`המשתמש ${data.email} נוצר. שתפי איתו את ה-USF — הוא הסיסמה הראשונית.`, "success");
      }
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error("[handleSaveUser] error:", err);
      showToast("שגיאת רשת. נסי שוב.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-4">
      
      <PageHeader
        icon={<ShieldCheck size={28} />}
        title="ניהול זהויות והרשאות (IAM)"
        subtitle="בקרת גישה תלוית-הקשר, חוקים דינמיים ואוטומציה תפעולית"
        actions={
          <>
            <button onClick={() => setShowTroubleshooter(true)} className="bg-slate-100 text-[#002649] px-4 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 shadow-sm">
              <ShieldQuestion size={18} className="text-[#EF6B00]" /> בוחן הרשאות
            </button>
            <button onClick={handleExportMatrix} className="bg-slate-100 text-[#002649] px-4 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 shadow-sm">
              <FileSpreadsheet size={18} className="text-green-600" /> Matrix דוח
            </button>
            <button onClick={() => { setEditingUser({ id: "", name: "", email: "", role: "hiring_manager", employee_number: "", status: "active", lastLogin: "טרם", permissions: { modules: [], dynamicRule: "Department = X", contextIP: "all", expiresAt: null, delegatedTo: null } }); setActiveTab("general"); }} className="bg-[#002649] text-white px-5 py-2.5 rounded-xl font-black hover:bg-[#EF6B00] transition-all flex items-center gap-2 shadow-sm whitespace-nowrap">
              <UserPlus size={18} /> משתמש חדש
            </button>
          </>
        }
      />

      {/* Top Alerts Panel (Feature 2 & 6) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 6. Self-Service Requests */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <div className="bg-blue-100 p-3 rounded-full text-blue-600 shrink-0"><GitPullRequest size={24} /></div>
          <div className="w-full">
            <h3 className="font-black text-[#002649] mb-1">בקשות גישה ממתינות (Self-Service)</h3>
            <div className="space-y-2 mt-3">
              {PENDING_REQUESTS.map(req => (
                <div key={req.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-50 text-sm">
                  <div><span className="font-bold">{req.user}</span> <span className="text-slate-500">מבקש/ת: {req.request}</span></div>
                  <div className="flex gap-2">
                    <button className="text-green-600 hover:bg-green-50 p-1.5 rounded"><CheckCircle2 size={16}/></button>
                    <button className="text-red-500 hover:bg-red-50 p-1.5 rounded"><XCircle size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Automated Pruning (Ghost Accounts) */}
        <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <div className="bg-orange-100 p-3 rounded-full text-[#EF6B00] shrink-0"><Activity size={24} /></div>
          <div>
            <h3 className="font-black text-[#002649] mb-1">ניקוי אוטומטי של חשבונות רפאים (Pruning)</h3>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              המערכת מזהה משתמשים שלא התחברו מעל 45 ימים. <br/>
              <span className="font-bold text-[#EF6B00]">2 חשבונות</span> הושעו אוטומטית השבוע (ביניהם: שרון לוי).
            </p>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="glass-card rounded-3xl overflow-hidden shadow-sm border border-slate-200 relative">
        
        {/* 8. Bulk Actions Floating Bar */}
        {selectedUsers.length > 0 && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-[#002649] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-20 animate-in slide-in-from-top-4">
            <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full text-sm">{selectedUsers.length} נבחרו</span>
            <div className="w-px h-5 bg-white/20"></div>
            {selectedUsers.length === 1 && (
              <button onClick={() => handleBulkAction("clone")} className="flex items-center gap-2 hover:text-[#EF6B00] transition-colors text-sm font-medium"><Copy size={16}/> שכפל הרשאות</button>
            )}
            <button
              onClick={() => handleOpenNotify(users.filter(u => selectedUsers.includes(u.id) && u.status === "active"))}
              className="flex items-center gap-2 hover:text-blue-300 transition-colors text-sm font-medium"
            >
              <Send size={16}/> שלח התראה
            </button>
            <button onClick={() => handleBulkAction("suspend")} className="flex items-center gap-2 hover:text-red-400 transition-colors text-sm font-medium"><XCircle size={16}/> השעיה גורפת</button>
            <button onClick={() => setSelectedUsers([])} className="ml-4 text-slate-400 hover:text-white"><XCircle size={18}/></button>
          </div>
        )}

        <div className="p-5 border-b border-slate-100 bg-white flex justify-between items-center">
          <h3 className="font-black text-xl text-[#002649]">מאגר משתמשים מרכזי</h3>
          <div className="relative w-80">
            <Search size={18} className="absolute right-3 top-2.5 text-slate-400" />
            <input type="text" placeholder="חיפוש..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[#EF6B00] outline-none" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input type="checkbox" onChange={handleSelectAll} checked={selectedUsers.length === users.length && users.length > 0} className="accent-[#EF6B00] w-4 h-4 cursor-pointer" />
                </th>
                <th className="px-6 py-4">משתמש</th>
                <th className="px-6 py-4">USF</th>
                <th className="px-6 py-4">תפקיד</th>
                <th className="px-6 py-4">בקרת גישה חכמה (Context & Rules)</th>
                <th className="px-6 py-4">סטטוס ותוקף</th>
                <th className="px-6 py-4 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {users
                .filter(u => {
                  const q = searchTerm.toLowerCase();
                  return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                })
                .map((user) => (
                <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${selectedUsers.includes(user.id) ? 'bg-orange-50/30' : ''} ${user.status === 'suspended' ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => handleSelectUser(user.id)} className="accent-[#EF6B00] w-4 h-4 cursor-pointer" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-black text-[#002649] text-base">{user.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono font-bold text-sm text-[#002649] bg-slate-100 px-2 py-1 rounded" dir="ltr">
                      {user.employee_number || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${ROLES_MAP[user.role].color}`}>
                      {ROLES_MAP[user.role].label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1.5">
                      {/* 3. Rule Based Access Indicator */}
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <Briefcase size={14} className="text-blue-500"/> {user.permissions.dynamicRule}
                      </div>
                      {/* 4. Context Aware Access Indicator */}
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <MapPin size={12} className={user.permissions.contextIP === 'office_only' ? 'text-orange-500' : 'text-green-500'}/> 
                        {user.permissions.contextIP === 'office_only' ? 'גישה מרשת משרדית בלבד' : 'גישה מכל כתובת IP (Web)'}
                      </div>
                      {/* 1. Delegation Indicator */}
                      {user.permissions.delegatedTo && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 w-max">
                          <UserCheck size={12}/> האציל סמכויות ל: {users.find(u=>u.id === user.permissions.delegatedTo)?.name}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {user.status === 'active' ? (
                        <span className="flex items-center gap-1 text-green-600 font-black text-xs"><CheckCircle2 size={14}/> פעיל</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 font-black text-xs"><Activity size={14}/> מושהה</span>
                      )}
                      {/* 5. Time-Bound Indicator */}
                      {user.permissions.expiresAt && (
                        <div className="text-[10px] text-orange-600 font-bold flex items-center gap-1 bg-orange-50 px-1 py-0.5 rounded">
                          <Clock size={10}/> פג תוקף: {user.permissions.expiresAt}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleImpersonate(user)}
                        title={user.id === currentUser?.id ? "לא ניתן להיכנס לעצמך" : `הכנס/י לנעליו של ${user.name}`}
                        aria-label={`הכנס/י לנעליו של ${user.name}`}
                        disabled={user.id === currentUser?.id || user.status !== "active"}
                        className="text-slate-400 hover:text-amber-600 transition-colors p-2 bg-slate-50 rounded-lg hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Eye size={18}/>
                      </button>
                      <button
                        onClick={() => handleOpenNotify([user])}
                        title={`שליחת התראה ל-${user.name}`}
                        aria-label={`שליחת התראה ל-${user.name}`}
                        disabled={user.status !== "active"}
                        className="text-slate-400 hover:text-blue-600 transition-colors p-2 bg-slate-50 rounded-lg hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Send size={18}/>
                      </button>
                      <button
                        onClick={() => { setEditingUser(user); setActiveTab("general"); }}
                        title="עריכה"
                        aria-label="עריכה"
                        className="text-slate-400 hover:text-[#002649] transition-colors p-2 bg-slate-50 rounded-lg hover:bg-slate-200"
                      >
                        <Edit3 size={18}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loadingUsers && (
                <tr><td colSpan={7} className="text-center py-16 text-slate-400 font-medium">טוען משתמשים...</td></tr>
              )}
              {!loadingUsers && users.length === 0 && (
                <tr><td colSpan={7} className="text-center py-16 text-slate-400 font-medium">אין משתמשים. צרי משתמש ראשון בכפתור &quot;משתמש חדש&quot;.</td></tr>
              )}
              {!loadingUsers && users.length > 0 && users.filter(u => {
                const q = searchTerm.toLowerCase();
                return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
              }).length === 0 && (
                <tr><td colSpan={7} className="text-center py-16 text-slate-400 font-medium">לא נמצאו תוצאות עבור החיפוש.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================= */}
      {/* ADVANCED USER EDITOR MODAL (IAM Controls) */}
      {/* ========================================= */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-[#002649] text-white">
              <h2 className="text-xl font-black flex items-center gap-3">
                <ShieldCheck className="text-[#EF6B00]" size={24}/> עריכת זהות ובקרת גישה (IAM)
              </h2>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><XCircle size={20}/></button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-64 bg-slate-50 border-l border-slate-100 p-4 flex flex-col gap-2">
                <button onClick={() => setActiveTab("general")} className={`text-right px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'general' ? 'bg-white text-[#002649] shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}>זהות ותפקיד (Role)</button>
                <button onClick={() => setActiveTab("rules")} className={`text-right px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'rules' ? 'bg-white text-[#002649] shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}>חוקים דינמיים (ABAC)</button>
                <button onClick={() => setActiveTab("context")} className={`text-right px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'context' ? 'bg-white text-[#002649] shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}>הקשר סביבתי (Context)</button>
                <button onClick={() => setActiveTab("delegation")} className={`text-right px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'delegation' ? 'bg-white text-[#002649] shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}>האצלת סמכויות (Proxy)</button>
              </div>

              <div className="flex-1 p-8 overflow-y-auto bg-white">
                
                {/* TAB 1: General & Time-Bound */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase">שם משתמש</label><input type="text" value={editingUser.name} onChange={e=>setEditingUser({...editingUser, name: e.target.value})} className="w-full p-3 border rounded-xl outline-none font-bold text-[#002649]" /></div>
                      <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase">דוא״ל</label><input type="email" value={editingUser.email} onChange={e=>setEditingUser({...editingUser, email: e.target.value})} className="w-full p-3 border rounded-xl outline-none font-mono text-sm" dir="ltr" /></div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-2">
                        <Hash size={12}/> מספר עובד (USF) — משמש גם כסיסמה ראשונית
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingUser.employee_number ?? ""}
                        onChange={e=>setEditingUser({...editingUser, employee_number: e.target.value})}
                        disabled={!!editingUser.id}
                        className="w-full p-3 border rounded-xl outline-none font-mono font-bold text-[#002649] disabled:bg-slate-100 disabled:cursor-not-allowed"
                        placeholder={editingUser.id ? "לא ניתן לשנות USF דרך כאן — בקשי איפוס ידני" : "לדוגמה: 198722"}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-[#002649] mb-3 uppercase">תפקיד מסגרת</label>
                      <select value={editingUser.role} onChange={e=>setEditingUser({...editingUser, role: e.target.value as Role})} className="w-full p-3 border rounded-xl font-bold text-[#002649]">
                        {Object.keys(ROLES_MAP).map(k => <option key={k} value={k}>{ROLES_MAP[k as Role].label}</option>)}
                      </select>
                    </div>
                    {/* 5. Time Bound Access */}
                    <div className="bg-orange-50 border border-orange-100 p-5 rounded-xl mt-6">
                      <h4 className="font-black text-orange-800 flex items-center gap-2 mb-2"><Clock size={16}/> גישה זמנית (Time-Bound Access)</h4>
                      <p className="text-xs text-orange-700 mb-4 font-medium">הגדר תאריך תפוגה להרשאה. בסיום, החשבון יושעה אוטומטית.</p>
                      <input type="date" value={editingUser.permissions.expiresAt || ""} onChange={e=>setEditingUser({...editingUser, permissions: {...editingUser.permissions, expiresAt: e.target.value || null}})} className="w-full p-3 border border-orange-200 rounded-xl outline-none font-bold text-[#002649]" />
                    </div>
                  </div>
                )}

                {/* TAB 2: Dynamic Rules (Feature 3) */}
                {activeTab === "rules" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-black text-[#002649] border-b pb-2">הרשאות מבוססות חוקים (Rule-Based)</h3>
                    <p className="text-sm text-slate-500 font-medium">במקום לשייך ידנית משרות, הגדר חוקים לוגיים שמתעדכנים אוטומטית.</p>
                    
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">תנאי 1: מחלקות (Department)</label>
                        <select className="w-full p-3 border border-slate-200 rounded-xl font-bold text-[#002649]">
                          <option>R&D או Product</option>
                          <option>Sales & Service</option>
                          <option>כל המחלקות (Global)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-black text-slate-400">AND / OR</div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">תנאי 2: סטטוס משרה</label>
                        <select className="w-full p-3 border border-slate-200 rounded-xl font-bold text-[#002649]">
                          <option>רק משרות פעילות (Active)</option>
                          <option>משרות דיסקרטיות בלבד (Confidential)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: Context-Aware (Feature 4) */}
                {activeTab === "context" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-black text-[#002649] border-b pb-2">בקרת גישה תלוית-הקשר (Context-Aware)</h3>
                    <p className="text-sm text-slate-500 font-medium mb-6">מנע דליפת מידע על ידי הגבלת אזורי ההתחברות של המשתמש.</p>
                    
                    <label className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${editingUser.permissions.contextIP === 'all' ? 'border-[#EF6B00] bg-orange-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="context" checked={editingUser.permissions.contextIP === 'all'} onChange={() => setEditingUser({...editingUser, permissions: {...editingUser.permissions, contextIP: 'all'}})} className="mt-1 accent-[#EF6B00]" />
                      <div>
                        <div className="font-black text-[#002649]">גישה מכל מקום (Web / Mobile)</div>
                        <div className="text-xs text-slate-500 mt-1">המשתמש יוכל להתחבר מהמשרד, מהבית או מבתי קפה.</div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${editingUser.permissions.contextIP === 'office_only' ? 'border-[#EF6B00] bg-orange-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="context" checked={editingUser.permissions.contextIP === 'office_only'} onChange={() => setEditingUser({...editingUser, permissions: {...editingUser.permissions, contextIP: 'office_only'}})} className="mt-1 accent-[#EF6B00]" />
                      <div>
                        <div className="font-black text-[#002649]">הגבלת גישה לרשת הארגונית בלבד (Office IP)</div>
                        <div className="text-xs text-slate-500 mt-1">גישה למערכת תתאפשר אך ורק מכתובות ה-IP המאושרות של הפניקס.</div>
                      </div>
                    </label>
                  </div>
                )}

                {/* TAB 4: Delegation (Feature 1) */}
                {activeTab === "delegation" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-black text-[#002649] border-b pb-2">האצלת סמכויות (Proxy Delegation)</h3>
                    <p className="text-sm text-slate-500 font-medium mb-6">אפשר למשתמש זה להעביר זמנית את סמכויותיו למשתמש אחר (למשל, בעת חופשה).</p>
                    
                    <div className="bg-purple-50 border border-purple-100 p-5 rounded-2xl">
                      <label className="block text-xs font-bold text-purple-800 mb-2 uppercase">משתמש ממלא מקום (Proxy User)</label>
                      <select 
                        value={editingUser.permissions.delegatedTo || ""} 
                        onChange={e => setEditingUser({...editingUser, permissions: {...editingUser.permissions, delegatedTo: e.target.value || null}})}
                        className="w-full p-3 border border-purple-200 rounded-xl outline-none font-bold text-[#002649]"
                      >
                        <option value="">ללא ממלא מקום (כבוי)</option>
                        {users.filter(u => u.id !== editingUser.id && u.status === 'active').map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({ROLES_MAP[u.role].label})</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-purple-600 font-bold mt-3 bg-white p-2 rounded-lg border border-purple-100">
                        הערה: המשתמש הנבחר יקבל את כל הרשאות הצפייה והעריכה של המשתמש הנוכחי, בנוסף להרשאותיו שלו.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
              <button onClick={() => setEditingUser(null)} disabled={isSaving} className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">ביטול</button>
              <button onClick={handleSaveUser} disabled={isSaving} className="px-8 py-3 font-black text-white bg-[#002649] hover:bg-[#EF6B00] rounded-xl transition-colors shadow-lg disabled:opacity-50">{isSaving ? "שומר..." : "שמור תצורת IAM"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* SEND NOTIFICATION DIALOG                  */}
      {/* ========================================= */}
      {notifyTargets && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-[#002649] text-white flex items-center justify-between">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Send className="text-[#EF6B00]" size={20}/> שליחת התראה
              </h2>
              <button onClick={() => setNotifyTargets(null)} disabled={isSendingNotify} className="p-1 text-white/70 hover:text-white"><XCircle size={20}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-2 uppercase">נמענים ({notifyTargets.length})</div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-32 overflow-y-auto flex flex-wrap gap-2">
                  {notifyTargets.map(t => (
                    <span key={t.id} className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold text-[#002649] flex items-center gap-1.5">
                      {t.name}
                      <span className="text-slate-400">·</span>
                      <span className="text-[10px] text-slate-500">{ROLES_MAP[t.role].label.replace(/\(.*?\)/g, "").trim()}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="notify-severity" className="text-xs font-bold text-slate-500 mb-2 block uppercase">דחיפות</label>
                <div className="grid grid-cols-4 gap-2" role="radiogroup">
                  {[
                    { v: "info" as const, label: "רגיל", color: "bg-blue-50 text-blue-700 border-blue-200", active: "bg-blue-600 text-white border-blue-600" },
                    { v: "success" as const, label: "חיובי", color: "bg-green-50 text-green-700 border-green-200", active: "bg-green-600 text-white border-green-600" },
                    { v: "warning" as const, label: "אזהרה", color: "bg-amber-50 text-amber-700 border-amber-200", active: "bg-amber-600 text-white border-amber-600" },
                    { v: "danger" as const, label: "דחוף", color: "bg-red-50 text-red-700 border-red-200", active: "bg-red-600 text-white border-red-600" },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      role="radio"
                      aria-checked={notifySeverity === opt.v}
                      onClick={() => setNotifySeverity(opt.v)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${notifySeverity === opt.v ? opt.active : opt.color}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="notify-message" className="text-xs font-bold text-slate-500 mb-2 block uppercase">תוכן ההודעה</label>
                <textarea
                  id="notify-message"
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  disabled={isSendingNotify}
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-[#EF6B00] focus:ring-2 focus:ring-[#EF6B00]/20 transition-all text-sm font-medium text-[#002649] resize-none"
                  rows={5}
                  placeholder="לדוגמה: תזכורת לסיום קליטה, הזמנה לישיבה, עדכון מערכת..."
                  maxLength={2000}
                />
                <div className="text-[10px] text-slate-400 text-left mt-1">{notifyMessage.length} / 2000</div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setNotifyTargets(null)} disabled={isSendingNotify} className="px-5 py-2 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">ביטול</button>
              <button
                onClick={handleSendNotify}
                disabled={isSendingNotify || !notifyMessage.trim()}
                className="px-6 py-2 font-black text-white bg-[#002649] hover:bg-[#EF6B00] rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {isSendingNotify ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                {isSendingNotify ? "שולח..." : `שלח ל-${notifyTargets.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* TEMP PASSWORD DIALOG (one-time display)   */}
      {/* ========================================= */}
      {tempPasswordDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-4 border-[#EF6B00]">
            <div className="px-6 py-4 bg-[#002649] text-white">
              <h2 className="text-lg font-black flex items-center gap-2">
                <ShieldCheck className="text-[#EF6B00]" size={22}/> סיסמה זמנית — צפייה חד-פעמית
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 font-medium">
                המשתמש <span className="font-black" dir="ltr">{tempPasswordDialog.email}</span> נוצר בהצלחה.
                <br />זוהי הסיסמה הזמנית — העתיקי אותה ושלחי למשתמש בערוץ מאובטח. <span className="font-black text-red-600">לא ניתן יהיה לראות אותה שוב.</span>
              </p>
              <div className="bg-slate-100 border-2 border-dashed border-slate-300 p-4 rounded-xl text-center">
                <code className="text-xl font-mono font-black text-[#002649] select-all" dir="ltr">{tempPasswordDialog.password}</code>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => navigator.clipboard?.writeText(tempPasswordDialog.password).then(() => showToast("הסיסמה הועתקה ללוח", "success"))}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-[#002649] px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Copy size={16}/> העתק ללוח
                </button>
                <button
                  onClick={() => setTempPasswordDialog(null)}
                  className="flex-1 bg-[#002649] hover:bg-[#EF6B00] text-white px-5 py-2.5 rounded-xl font-bold transition-colors"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* 7. TROUBLESHOOTER MODAL (בוחן הרשאות) */}
      {/* ========================================= */}
      {showTroubleshooter && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-black text-[#002649] flex items-center gap-2">
                <ShieldQuestion className="text-[#EF6B00]"/> בוחן גישה סינתטי (Troubleshooter)
              </h2>
              <button onClick={() => setShowTroubleshooter(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-slate-600 font-medium">בדוק מדוע למשתמש יש או אין גישה לנתון מסוים בהתבסס על המדיניות הארגונית.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500">בחר משתמש לבדיקה:</label>
                  <select className="w-full mt-1 p-2.5 border rounded-lg font-bold text-[#002649]"><option>דן שפירא (Hiring Manager)</option></select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">בחר משרה / יישות:</label>
                  <select className="w-full mt-1 p-2.5 border rounded-lg font-bold text-[#002649]"><option>VP R&D (Confidential)</option></select>
                </div>
              </div>

              <div className="bg-slate-900 text-green-400 p-4 rounded-xl font-mono text-xs leading-relaxed space-y-2">
                <div>&gt; Checking Role: Hiring_Manager [PASS]</div>
                <div>&gt; Checking Dept Rule: R&D [PASS]</div>
                <div className="text-red-400">&gt; Checking Confidentiality Flag: Job is marked Hidden for this user [FAIL]</div>
                <div className="mt-4 pt-2 border-t border-slate-700 text-white font-bold">RESULT: ACCESS DENIED 🔒</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* אזור ניווט לאבטחת מידע מתקדמת */}
      <div className="mt-12 p-8 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500 rounded-full blur-[80px] opacity-20"></div>
        <div className="relative z-10">
          <h3 className="text-2xl font-black flex items-center gap-3">
            <ShieldAlert className="text-red-400" size={28} />
            ניהול הגנת מידע ופרטיות (InfoSec)
          </h3>
          <p className="text-slate-400 mt-2 font-medium max-w-xl">
            גישה מאובטחת ליומני הבקרה (Audit Logs), שליטה במנועי ה-AI (Kill Switch) וניהול מדיניות חשיפת נתונים. מוגבל למנהלי מערכת בלבד.
          </p>
        </div>
        <Link href="/admin/security" className="relative z-10 bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-xl font-black transition-all shadow-lg flex items-center gap-2 whitespace-nowrap">
          <Lock size={18} /> כניסה לאזור המאובטח
        </Link>
      </div>

    </div>
  );
}

// Standalone route wrapper — kept for backward-compat. Primary UX is the
// "permissions" tab inside /admin (rendered via <PermissionsTab />).
export default function PermissionsEnterprisePage() {
  return <PermissionsTab />;
}