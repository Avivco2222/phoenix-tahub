# Targets & Automations Tab — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 6-line "Under Construction" placeholder in the Admin Hub's יעדים ואוטומציות tab with a live Formula Editor, Automation Rule Builder, Visibility Toggles panel, and an Integrity Header — all backed by a shared React Context hook that reads/writes to the backend `system_settings` table.

**Architecture:** Feature folder under `src/app/admin/components/targets/`. A single `AdminConfigProvider` wraps the `AdminCommandCenter` component in `admin/page.tsx`, giving every panel and the analytics tab access to the same in-memory config via `useAdminConfig()`. The backend gains two endpoints (`GET/POST /api/admin/config`) that serialize the config blob into the existing `system_settings` key-value table and call `log_audit_action` on every write.

**Tech Stack:** Next.js 16 App Router, React 19 Context API, TypeScript strict, Tailwind CSS v4, FastAPI + SQLite (`system_settings` table), existing `useToast` from `src/components/Toast.tsx`.

---

## Critical Rules (read before touching any file)

- **Never modify** Sidebar, FinOps, Briefly/ManagerWhisperer, MobilitySimulator, SmartOnboarding, ReportsGenerator.
- **Run `npx tsc --noEmit` after every task.** Zero new errors allowed.
- **Run `npx next build` only at Tasks 7 and 9** (full build is slow).
- All new `"use client"` files go in `src/app/admin/components/targets/`.
- `useToast` is imported from `@/components/Toast` (not from NotificationContext).
- The main export of `admin/page.tsx` will be renamed internally; a new thin wrapper becomes the default export.

---

## Task 1: Backend — GET + POST `/api/admin/config`

**Files:**
- Modify: `backend/main.py` (append after the last `@app.post` route, before the end of file)

**Step 1: Add the GET endpoint**

Append to `backend/main.py`:

```python
# ==========================================
# ADMIN CONFIG — KPI Formulas, Rules, Visibility
# ==========================================
ADMIN_CONFIG_DEFAULTS = {
    "formulas": [
        {"id": "conv_rate", "label": "Conversion Rate %", "varA": "hires", "op": "/", "varB": "offers", "scale": 100},
        {"id": "ttf", "label": "Time-to-Fill (avg)", "varA": "avg_days_open", "op": "+", "varB": None, "scale": 1},
    ],
    "rules": [
        {"id": "r1", "metric": "interviews_per_week", "op": "<", "threshold": 7,
         "action": "toast", "actionLabel": "ממוצע ראיונות נמוך מהיעד", "enabled": True},
    ],
    "visibility": {
        "kpi_conversion": True,
        "kpi_ttf": True,
        "chart_sources": True,
        "table_recruiters": True,
    }
}

@app.get("/api/admin/config")
async def get_admin_config():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT value FROM system_settings WHERE key='admin_config'")
    row = c.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return ADMIN_CONFIG_DEFAULTS

@app.post("/api/admin/config")
async def save_admin_config(request: Request, section: str = "general"):
    payload = await request.json()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT value FROM system_settings WHERE key='admin_config'")
    row = c.fetchone()
    existing = json.loads(row[0]) if row else {}
    merged = {**existing, **payload}
    c.execute(
        "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('admin_config', ?)",
        (json.dumps(merged),)
    )
    conn.commit()
    conn.close()
    changed_keys = list(payload.keys())
    log_audit_action(
        action="ADMIN_CONFIG_UPDATE",
        status="success",
        details=f"section={section} | keys_changed={changed_keys}",
        user="admin-frontend"
    )
    timestamp = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
    return {"status": "saved", "timestamp": timestamp}
```

**Step 2: Verify by starting the server and curling**

```bash
cd backend
uvicorn main:app --reload --port 8000
# In another terminal:
curl http://localhost:8000/api/admin/config
# Expected: JSON with formulas, rules, visibility keys
curl -X POST http://localhost:8000/api/admin/config?section=formulas \
  -H "Content-Type: application/json" \
  -d '{"formulas":[]}'
# Expected: {"status":"saved","timestamp":"..."}
```

**Step 3: Commit**

```bash
git -C /c/fnxdata add backend/main.py
git -C /c/fnxdata commit -m "feat: add GET/POST /api/admin/config with audit logging"
```

---

## Task 2: `useAdminConfig.ts` — Shared Context Hook

**Files:**
- Create: `phoenix-dashboard/src/app/admin/components/targets/useAdminConfig.ts`

**Step 1: Create the file with full content**

```typescript
"use client";
import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface KpiFormula {
  id: string;
  label: string;
  varA: string;
  op: "/" | "*" | "+" | "-";
  varB: string | null;
  scale: number;
}

export interface AutomationRule {
  id: string;
  metric: string;
  op: "<" | ">" | "=";
  threshold: number;
  action: "toast" | "email" | "flag";
  actionLabel: string;
  enabled: boolean;
}

export interface VisibilityConfig {
  kpi_conversion: boolean;
  kpi_ttf:        boolean;
  chart_sources:  boolean;
  table_recruiters: boolean;
}

export interface AdminConfig {
  formulas:   KpiFormula[];
  rules:      AutomationRule[];
  visibility: VisibilityConfig;
}

// ── Hardcoded fallback (used when backend is offline) ────────────────────────

export const HARDCODED_DEFAULTS: AdminConfig = {
  formulas: [
    { id: "conv_rate", label: "Conversion Rate %",  varA: "hires",        op: "/", varB: "offers",    scale: 100 },
    { id: "ttf",       label: "Time-to-Fill (avg)", varA: "avg_days_open", op: "+", varB: null,        scale: 1   },
  ],
  rules: [
    {
      id: "r1", metric: "interviews_per_week", op: "<", threshold: 7,
      action: "toast", actionLabel: "ממוצע ראיונות נמוך מהיעד", enabled: true,
    },
  ],
  visibility: {
    kpi_conversion:   true,
    kpi_ttf:          true,
    chart_sources:    true,
    table_recruiters: true,
  },
};

// ── Context ──────────────────────────────────────────────────────────────────

interface AdminConfigCtx {
  config:    AdminConfig;
  save:      (patch: Partial<AdminConfig>, section: "formulas" | "rules" | "visibility") => Promise<void>;
  isLoading: boolean;
  isOffline: boolean;
  lastSaved: string | null;
}

const AdminConfigContext = createContext<AdminConfigCtx | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function AdminConfigProvider({ children }: { children: React.ReactNode }) {
  const [config,    setConfig]    = useState<AdminConfig>(HARDCODED_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/config`);
      const data = await res.json() as AdminConfig;
      setConfig({ ...HARDCODED_DEFAULTS, ...data });
      setIsOffline(false);
    } catch {
      console.warn("[AdminConfig] Backend offline — using hardcoded defaults");
      setIsOffline(true);
      setConfig(HARDCODED_DEFAULTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(
    async (patch: Partial<AdminConfig>, section: "formulas" | "rules" | "visibility") => {
      const next = { ...config, ...patch };
      const res  = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/config?section=${section}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }
      );
      if (!res.ok) throw new Error("SAVE_FAILED");
      const data = await res.json() as { status: string; timestamp: string };
      setConfig(next);
      setLastSaved(data.timestamp ?? new Date().toISOString());
    },
    [config]
  );

  return (
    <AdminConfigContext.Provider value={{ config, save, isLoading, isOffline, lastSaved }}>
      {children}
    </AdminConfigContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useAdminConfig(): AdminConfigCtx {
  const ctx = useContext(AdminConfigContext);
  if (!ctx) throw new Error("useAdminConfig must be used inside AdminConfigProvider");
  return ctx;
}

// ── Formula evaluator (shared by FormulaEditor + Analytics) ──────────────────

const MOCK_METRICS: Record<string, number> = {
  hires: 12, offers: 35, interviews: 89, avg_days_open: 23, applications: 210,
  interviews_per_week: 5,
};

export function evalFormula(f: KpiFormula, metrics: Record<string, number> = MOCK_METRICS): number {
  const a = metrics[f.varA] ?? 0;
  const b = f.varB !== null ? (metrics[f.varB] ?? 0) : 1;
  if (f.op === "/" && b === 0) return 0;
  switch (f.op) {
    case "/": return (a / b) * f.scale;
    case "*": return  a * b  * f.scale;
    case "+": return (a + b) * f.scale;
    case "-": return (a - b) * f.scale;
    default:  return a;
  }
}
```

**Step 2: Type-check**

```bash
cd /c/fnxdata/phoenix-dashboard && npx tsc --noEmit
```
Expected: 0 new errors.

**Step 3: Commit**

```bash
git -C /c/fnxdata add phoenix-dashboard/src/app/admin/components/targets/useAdminConfig.ts
git -C /c/fnxdata commit -m "feat: add AdminConfigProvider context hook with offline fallback"
```

---

## Task 3: `FormulaEditor.tsx`

**Files:**
- Create: `phoenix-dashboard/src/app/admin/components/targets/FormulaEditor.tsx`

**Step 1: Create the file**

```tsx
"use client";
import React, { useState } from "react";
import { Plus, Trash2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAdminConfig, evalFormula, KpiFormula } from "./useAdminConfig";
import { useToast } from "@/components/Toast";

const VARIABLES = ["hires", "offers", "interviews", "avg_days_open", "applications"];
const OPERATORS: Array<KpiFormula["op"]> = ["/", "*", "+", "-"];
const OP_LABELS: Record<string, string> = { "/": "÷", "*": "×", "+": "+", "-": "−" };

function isValid(f: KpiFormula): boolean {
  if (!f.label.trim()) return false;
  if (!f.varA) return false;
  // divide-by-zero guard: varB is "offers" (35 in mock) — safe; but catch zero explicitly
  if (f.op === "/" && f.varB === null) return false;
  return true;
}

function preview(f: KpiFormula): string {
  if (!isValid(f)) return "—";
  const result = evalFormula(f);
  if (result === 0 && f.op === "/") return "⚠ חלוקה באפס";
  return `= ${result.toFixed(1)}${f.scale === 100 ? "%" : ""}`;
}

export default function FormulaEditor() {
  const { config, save, isOffline } = useAdminConfig();
  const { showToast } = useToast();
  const [formulas, setFormulas] = useState<KpiFormula[]>(config.formulas);
  const [isSaving, setIsSaving] = useState(false);

  const allValid = formulas.every(isValid);

  const update = (idx: number, patch: Partial<KpiFormula>) =>
    setFormulas(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));

  const addRow = () =>
    setFormulas(prev => [
      ...prev,
      { id: `kpi_${Date.now()}`, label: "", varA: "hires", op: "/", varB: "offers", scale: 100 },
    ]);

  const removeRow = (idx: number) =>
    setFormulas(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!allValid || isSaving) return;
    setIsSaving(true);
    try {
      await save({ formulas }, "formulas");
      showToast("פורמולות נשמרו בהצלחה ✓", "success");
    } catch {
      showToast("שמירה נכשלה — נסה שוב", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#002649]">עורך נוסחאות KPI</h3>
        <div className="flex gap-2">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
          >
            <Plus size={14} /> הוסף נוסחה
          </button>
          <button
            onClick={handleSave}
            disabled={!allValid || isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#002649] text-white rounded-xl font-bold text-sm hover:bg-[#EF6B00] transition-all disabled:opacity-40"
          >
            <Save size={14} /> {isSaving ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>

      {isOffline && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs font-bold text-orange-700">
          <AlertCircle size={14} /> מצב אופליין — שינויים לא יישמרו עד שהשרת יחזור
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-12 gap-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
        <span className="col-span-3">שם מדד</span>
        <span className="col-span-2">משתנה A</span>
        <span className="col-span-1 text-center">פעולה</span>
        <span className="col-span-2">משתנה B</span>
        <span className="col-span-2 text-center">תצוגה מקדימה</span>
        <span className="col-span-2 text-center">סטטוס</span>
      </div>

      <div className="space-y-2">
        {formulas.map((f, idx) => {
          const valid   = isValid(f);
          const previewStr = preview(f);
          return (
            <div
              key={f.id}
              className={`grid grid-cols-12 gap-2 items-center p-3 rounded-2xl border transition-all ${
                valid ? "bg-white border-slate-100" : "bg-red-50 border-red-200"
              }`}
            >
              <input
                className="col-span-3 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-[#EF6B00] transition-colors"
                placeholder="שם מדד..."
                value={f.label}
                onChange={e => update(idx, { label: e.target.value })}
              />
              <select
                value={f.varA}
                onChange={e => update(idx, { varA: e.target.value })}
                className="col-span-2 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
              >
                {VARIABLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select
                value={f.op}
                onChange={e => update(idx, { op: e.target.value as KpiFormula["op"] })}
                className="col-span-1 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none text-center"
              >
                {OPERATORS.map(o => <option key={o} value={o}>{OP_LABELS[o]}</option>)}
              </select>
              <select
                value={f.varB ?? ""}
                onChange={e => update(idx, { varB: e.target.value || null })}
                className="col-span-2 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
              >
                <option value="">— ללא —</option>
                {VARIABLES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <div
                className={`col-span-2 text-xs font-black text-center ${
                  previewStr.startsWith("⚠") ? "text-red-500" : "text-emerald-600"
                }`}
              >
                {previewStr}
              </div>
              <div className="col-span-2 flex items-center justify-center gap-2">
                {valid
                  ? <CheckCircle2 size={14} className="text-emerald-500" />
                  : <AlertCircle  size={14} className="text-red-500" />}
                <button
                  onClick={() => removeRow(idx)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Type-check**

```bash
cd /c/fnxdata/phoenix-dashboard && npx tsc --noEmit
```
Expected: 0 new errors.

**Step 3: Commit**

```bash
git -C /c/fnxdata add phoenix-dashboard/src/app/admin/components/targets/FormulaEditor.tsx
git -C /c/fnxdata commit -m "feat: add FormulaEditor with live preview and validation"
```

---

## Task 4: `RuleBuilder.tsx`

**Files:**
- Create: `phoenix-dashboard/src/app/admin/components/targets/RuleBuilder.tsx`

**Step 1: Create the file**

```tsx
"use client";
import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Save, Zap } from "lucide-react";
import { useAdminConfig, AutomationRule } from "./useAdminConfig";
import { useToast } from "@/components/Toast";

const METRICS    = ["interviews_per_week", "avg_days_open", "hires", "offers", "applications"];
const OPS: Array<AutomationRule["op"]> = ["<", ">", "="];
const ACTIONS: { value: AutomationRule["action"]; label: string }[] = [
  { value: "toast",  label: "התראת Toast" },
  { value: "email",  label: "מייל (סימולציה)" },
  { value: "flag",   label: "סמן מנהל" },
];

// Live mock values — same shape as evalFormula's MOCK_METRICS
const LIVE_METRICS: Record<string, number> = {
  interviews_per_week: 5, avg_days_open: 23, hires: 12, offers: 35, applications: 210,
};

export default function RuleBuilder() {
  const { config, save } = useAdminConfig();
  const { showToast }    = useToast();
  const [rules,    setRules]    = useState<AutomationRule[]>(config.rules);
  const [isSaving, setIsSaving] = useState(false);
  const firedRef = useRef<Set<string>>(new Set());

  // Evaluate enabled rules against live metrics — fire once per session per rule
  useEffect(() => {
    rules.forEach(rule => {
      if (!rule.enabled || firedRef.current.has(rule.id)) return;
      const val = LIVE_METRICS[rule.metric] ?? 0;
      const triggered =
        rule.op === "<" ? val < rule.threshold :
        rule.op === ">" ? val > rule.threshold :
        val === rule.threshold;
      if (triggered) {
        firedRef.current.add(rule.id);
        showToast(`⚡ כלל הופעל: ${rule.actionLabel}`, "error");
      }
    });
  }, [rules, showToast]);

  const update = (idx: number, patch: Partial<AutomationRule>) =>
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const addRule = () =>
    setRules(prev => [...prev, {
      id: `r_${Date.now()}`, metric: "interviews_per_week", op: "<", threshold: 7,
      action: "toast", actionLabel: "כלל חדש", enabled: true,
    }]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save({ rules }, "rules");
      showToast("כללי אוטומציה נשמרו ✓", "success");
    } catch {
      showToast("שמירה נכשלה", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#002649] flex items-center gap-2">
          <Zap size={18} className="text-[#EF6B00]" /> בונה אוטומציות (If / Then)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={addRule}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
          >
            <Plus size={14} /> כלל חדש
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#002649] text-white rounded-xl font-bold text-sm hover:bg-[#EF6B00] transition-all disabled:opacity-40"
          >
            <Save size={14} /> {isSaving ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <div key={rule.id} className="p-4 bg-white border border-slate-100 rounded-2xl space-y-3">
            {/* IF row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black text-[#EF6B00] uppercase tracking-widest w-6">IF</span>
              <select
                value={rule.metric}
                onChange={e => update(idx, { metric: e.target.value })}
                className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
              >
                {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={rule.op}
                onChange={e => update(idx, { op: e.target.value as AutomationRule["op"] })}
                className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none w-14 text-center"
              >
                {OPS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input
                type="number"
                value={rule.threshold}
                onChange={e => update(idx, { threshold: Number(e.target.value) })}
                className="w-16 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none text-center"
              />
              {/* live indicator */}
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                (() => {
                  const v = LIVE_METRICS[rule.metric] ?? 0;
                  const fired =
                    rule.op === "<" ? v < rule.threshold :
                    rule.op === ">" ? v > rule.threshold :
                    v === rule.threshold;
                  return fired ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700";
                })()
              }`}>
                {LIVE_METRICS[rule.metric] ?? "—"}
              </span>
            </div>

            {/* THEN row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black text-[#002649] uppercase tracking-widest w-6">THEN</span>
              <div className="flex gap-1.5">
                {ACTIONS.map(a => (
                  <button
                    key={a.value}
                    onClick={() => update(idx, { action: a.value })}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                      rule.action === a.value
                        ? "bg-[#002649] text-white border-[#002649]"
                        : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <input
                value={rule.actionLabel}
                onChange={e => update(idx, { actionLabel: e.target.value })}
                className="flex-1 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none min-w-0"
                placeholder="תיאור ההתראה..."
              />
              {/* enabled toggle */}
              <button
                onClick={() => update(idx, { enabled: !rule.enabled })}
                className={`w-10 h-5 rounded-full relative transition-all shrink-0 ${rule.enabled ? "bg-[#EF6B00]" : "bg-slate-300"}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm transition-all ${rule.enabled ? "right-[3px]" : "left-[3px]"}`} />
              </button>
              <button
                onClick={() => setRules(prev => prev.filter((_, i) => i !== idx))}
                className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Type-check**

```bash
cd /c/fnxdata/phoenix-dashboard && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git -C /c/fnxdata add phoenix-dashboard/src/app/admin/components/targets/RuleBuilder.tsx
git -C /c/fnxdata commit -m "feat: add RuleBuilder with frontend rule evaluation and toast firing"
```

---

## Task 5: `VisibilityToggles.tsx`

**Files:**
- Create: `phoenix-dashboard/src/app/admin/components/targets/VisibilityToggles.tsx`

**Step 1: Create the file**

```tsx
"use client";
import React, { useState } from "react";
import { Save, Eye, EyeOff } from "lucide-react";
import { useAdminConfig, VisibilityConfig } from "./useAdminConfig";
import { useToast } from "@/components/Toast";

const CARDS: { key: keyof VisibilityConfig; label: string; page: string }[] = [
  { key: "kpi_conversion",   label: "Conversion Rate %",  page: "דשבורד ראשי" },
  { key: "kpi_ttf",          label: "Time-to-Fill",       page: "דשבורד ראשי" },
  { key: "chart_sources",    label: "מקורות גיוס (גרף)", page: "דשבורד ראשי" },
  { key: "table_recruiters", label: "טבלת מגייסים",       page: "ביצועים" },
];

const MANAGER_PRESET:  VisibilityConfig = { kpi_conversion: true,  kpi_ttf: true,  chart_sources: true,  table_recruiters: false };
const RECRUITER_PRESET: VisibilityConfig = { kpi_conversion: false, kpi_ttf: true,  chart_sources: false, table_recruiters: true  };

export default function VisibilityToggles() {
  const { config, save } = useAdminConfig();
  const { showToast }    = useToast();
  const [vis,      setVis]      = useState<VisibilityConfig>(config.visibility);
  const [isSaving, setIsSaving] = useState(false);

  const toggle      = (key: keyof VisibilityConfig) => setVis(prev => ({ ...prev, [key]: !prev[key] }));
  const applyPreset = (preset: VisibilityConfig)    => setVis(preset);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await save({ visibility: vis }, "visibility");
      showToast("הגדרות תצוגה נשמרו ✓", "success");
    } catch {
      showToast("שמירה נכשלה", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Group by page
  const grouped = CARDS.reduce<Record<string, typeof CARDS>>((acc, c) => {
    (acc[c.page] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#002649]">ניהול תצוגת כרטיסים</h3>
        <div className="flex gap-2">
          <button
            onClick={() => applyPreset(MANAGER_PRESET)}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-black border border-blue-100 hover:bg-blue-100 transition-all"
          >
            פרופיל: מנהל
          </button>
          <button
            onClick={() => applyPreset(RECRUITER_PRESET)}
            className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl text-xs font-black border border-purple-100 hover:bg-purple-100 transition-all"
          >
            פרופיל: מגייס
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#002649] text-white rounded-xl font-bold text-sm hover:bg-[#EF6B00] transition-all disabled:opacity-40"
          >
            <Save size={14} /> {isSaving ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>

      {Object.entries(grouped).map(([page, cards]) => (
        <div key={page} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{page}</span>
          </div>
          {cards.map(c => (
            <div
              key={c.key}
              className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center gap-2">
                {vis[c.key]
                  ? <Eye    size={14} className="text-emerald-500" />
                  : <EyeOff size={14} className="text-slate-300" />}
                <span className={`text-sm font-bold transition-colors ${vis[c.key] ? "text-[#002649]" : "text-slate-400"}`}>
                  {c.label}
                </span>
              </div>
              <button
                onClick={() => toggle(c.key)}
                className={`w-10 h-5 rounded-full relative transition-all ${vis[c.key] ? "bg-emerald-500" : "bg-slate-200"}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm transition-all ${vis[c.key] ? "right-[3px]" : "left-[3px]"}`} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Type-check**

```bash
cd /c/fnxdata/phoenix-dashboard && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git -C /c/fnxdata add phoenix-dashboard/src/app/admin/components/targets/VisibilityToggles.tsx
git -C /c/fnxdata commit -m "feat: add VisibilityToggles with role presets"
```

---

## Task 6: `TargetsTab.tsx` — Orchestrator

**Files:**
- Create: `phoenix-dashboard/src/app/admin/components/targets/TargetsTab.tsx`

**Step 1: Create the file**

```tsx
"use client";
import React from "react";
import { Shield, WifiOff, CheckCircle2 } from "lucide-react";
import { useAdminConfig } from "./useAdminConfig";
import FormulaEditor    from "./FormulaEditor";
import RuleBuilder      from "./RuleBuilder";
import VisibilityToggles from "./VisibilityToggles";

export default function TargetsTab() {
  const { isOffline, isLoading, lastSaved } = useAdminConfig();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-[#EF6B00] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Integrity Header ── */}
      <div
        className={`flex items-center justify-between p-3 px-5 rounded-2xl border ${
          isOffline
            ? "bg-orange-50 border-orange-200"
            : "bg-emerald-50 border-emerald-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {isOffline
            ? <WifiOff     size={14} className="text-orange-600" />
            : <CheckCircle2 size={14} className="text-emerald-600" />}
          <span className={`text-xs font-black ${isOffline ? "text-orange-700" : "text-emerald-700"}`}>
            {isOffline
              ? "מצב אופליין — ברירת מחדל פעילה, שינויים לא יישמרו"
              : "מחובר לשרת — כל שמירה מתועדת ב-Audit Log"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
          <Shield size={11} />
          {lastSaved ? `נשמר לאחרונה: ${lastSaved}` : "טרם נשמר בסשן זה"}
        </div>
      </div>

      {/* ── Panels ── */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <FormulaEditor />
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <RuleBuilder />
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <VisibilityToggles />
      </div>
    </div>
  );
}
```

**Step 2: Type-check**

```bash
cd /c/fnxdata/phoenix-dashboard && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git -C /c/fnxdata add phoenix-dashboard/src/app/admin/components/targets/TargetsTab.tsx
git -C /c/fnxdata commit -m "feat: add TargetsTab orchestrator with integrity header"
```

---

## Task 7: Wire `admin/page.tsx` — Provider + Live KPI

**Files:**
- Modify: `phoenix-dashboard/src/app/admin/page.tsx`

**Step 1: Add imports at the top of the file (after existing imports)**

After the last existing import line, add:

```tsx
import { AdminConfigProvider, useAdminConfig, evalFormula } from "./components/targets/useAdminConfig";
import TargetsTab from "./components/targets/TargetsTab";
```

**Step 2: Rename the existing default export function**

Find:
```tsx
export default function AdminCommandCenter() {
```
Replace with:
```tsx
function AdminCommandCenter() {
```

**Step 3: Add `useAdminConfig` call at the top of `AdminCommandCenter`**

Find the first line after the opening `{` of `AdminCommandCenter` (which is `const [activeTab, setActiveTab] = useState("data");`) and add one line before it:

```tsx
  const { config: adminConfig } = useAdminConfig();
```

**Step 4: Replace the 6-line targets placeholder**

Find (lines 449–456):
```tsx
      {/* TAB 4: TARGETS (Parked) */}
      {activeTab === "targets" && (
        <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in-95">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400"><Workflow size={48} /></div>
          <h2 className="text-2xl font-black text-[#002649]">מפעל היעדים בבנייה</h2>
          <p className="text-slate-500 mt-2 text-center max-w-md">המודול הזה חונה כרגע בצד. אנחנו נחזור אליו לאחר שנסיים לייצב את מודולי הליבה של ארגז הכלים ובריאות המשרה.</p>
        </div>
      )}
```
Replace with:
```tsx
      {/* TAB 4: TARGETS & AUTOMATIONS */}
      {activeTab === "targets" && <TargetsTab />}
```

**Step 5: Wire live Conversion Rate KPI in the analytics tab**

In the analytics tab section (around line 401), find:
```tsx
            <StatMiniCard label="משימות AI שנוצרו" value={analyticsData.stats.total_tasks} sub="החודש" color="text-[#002649]" />
            <StatMiniCard label="ממוצע סגירה שבועי" value={`${analyticsData.stats.avg_close_rate}%`} sub="יעד: 85%" color="text-green-600" />
```
Replace with:
```tsx
            <StatMiniCard label="משימות AI שנוצרו" value={analyticsData.stats.total_tasks} sub="החודש" color="text-[#002649]" />
            <StatMiniCard
              label={adminConfig.formulas.find(f => f.id === "conv_rate")?.label ?? "Conversion Rate %"}
              value={`${evalFormula(adminConfig.formulas.find(f => f.id === "conv_rate") ?? adminConfig.formulas[0]).toFixed(1)}%`}
              sub="מחושב לפי נוסחת ה-Admin"
              color="text-green-600"
            />
```

**Step 6: Add the new default export wrapper at the very bottom of the file (after all sub-components)**

```tsx
export default function AdminPage() {
  return (
    <AdminConfigProvider>
      <AdminCommandCenter />
    </AdminConfigProvider>
  );
}
```

**Step 7: Type-check + build**

```bash
cd /c/fnxdata/phoenix-dashboard && npx tsc --noEmit && npx next build 2>&1 | tail -20
```
Expected: 0 errors, 11/11 routes.

**Step 8: Commit**

```bash
git -C /c/fnxdata add phoenix-dashboard/src/app/admin/page.tsx
git -C /c/fnxdata commit -m "feat: wire AdminConfigProvider and live KPI to admin page, replace targets placeholder"
```

---

## Task 8: Remove unused `Workflow` import (cleanup)

**Files:**
- Modify: `phoenix-dashboard/src/app/admin/page.tsx`

**Step 1: Remove `Workflow` from the lucide-react import**

Find:
```tsx
  Users, Building2, Receipt, Target, Workflow, Clock, FileText, Loader2,
```
Replace with:
```tsx
  Users, Building2, Receipt, Target, Clock, FileText, Loader2,
```

**Step 2: Type-check**

```bash
cd /c/fnxdata/phoenix-dashboard && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git -C /c/fnxdata add phoenix-dashboard/src/app/admin/page.tsx
git -C /c/fnxdata commit -m "chore: remove unused Workflow import from admin page"
```

---

## Task 9: Final end-to-end verification

**Step 1: Full production build**

```bash
cd /c/fnxdata/phoenix-dashboard && npx next build 2>&1 | tail -25
```
Expected: 11/11 routes, 0 errors.

**Step 2: Manual smoke test checklist**

With `backend/` running (`uvicorn main:app --reload`) and `npm run dev` in `phoenix-dashboard/`:

- [ ] Navigate to `/admin` → click **יעדים ואוטומציות** tab
- [ ] Integrity header shows 🟢 "מחובר לשרת"
- [ ] Formula Editor shows 2 default rows with live previews
- [ ] Add a row, change varA/varB — preview updates instantly
- [ ] Delete a row, try to save with empty label — Save button stays disabled ✓
- [ ] Save valid formulas — toast "נשמר ✓" appears
- [ ] Switch to **מעקב ביצועים** tab — "Conversion Rate %" card shows `evalFormula` result
- [ ] Go back to Targets → change the Conversion Rate formula (e.g. multiply by 50 instead of 100) → go back to Analytics → value updates without page reload ✓
- [ ] Rule Builder: toggle a rule off → no toast fires on that rule ✓
- [ ] Visibility Toggles: click "פרופיל: מגייס" → all toggles snap to preset ✓
- [ ] Stop the backend (`Ctrl+C`) → refresh `/admin` → Integrity header shows 🟠 "מצב אופליין" — page still works ✓
- [ ] Check SQLite: `SELECT * FROM audit_logs WHERE action='ADMIN_CONFIG_UPDATE'` — rows present ✓

**Step 3: Final commit (if any minor fixes needed)**

```bash
git -C /c/fnxdata add -A && git -C /c/fnxdata commit -m "fix: final polish after smoke test"
```
