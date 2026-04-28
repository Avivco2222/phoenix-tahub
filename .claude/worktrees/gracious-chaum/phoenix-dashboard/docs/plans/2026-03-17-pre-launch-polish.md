# Pre-Launch Polish & Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the FNX TAHub dashboard for demo-readiness: remove dead assets, replace `alert()` calls with a toast system, fix all TypeScript `any` types, confirm SessionGuard wraps all routes, and add offline mock fallbacks to every API-connected page.

**Architecture:** A single shared `useToast` hook + `<Toast>` component replaces all `alert()` / `globalThis.alert()` calls. TypeScript `any` is eliminated via per-component interfaces. Mock fallbacks follow the existing FinOps pattern (`try/catch → setXxx(MOCK_XXX)`). No new dependencies are introduced.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Lucide React

---

## TASK 0 — Dead-Code Asset Audit (LIST ONLY — await user approval before deletion)

**Files to propose for deletion:**

| File | Reason |
|---|---|
| `public/file.svg` | Next.js boilerplate — zero references in source |
| `public/globe.svg` | Next.js boilerplate — zero references in source |
| `public/next.svg` | Next.js boilerplate — zero references in source |
| `public/vercel.svg` | Next.js boilerplate — zero references in source |
| `public/window.svg` | Next.js boilerplate — zero references in source |

> ⚠️ **STOP HERE.** Present this list to the user and wait for explicit approval before running any `rm` or `git rm` commands.

---

## TASK 1 — Create Shared Toast System

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/app/layout.tsx`

### Step 1: Create the Toast component + hook

```tsx
// src/components/Toast.tsx
"use client";
import { useState, useCallback, createContext, useContext, ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "coming-soon";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const iconMap: Record<ToastType, ReactNode> = {
    success: <CheckCircle2 size={18} className="text-green-500 shrink-0" />,
    error: <AlertTriangle size={18} className="text-red-500 shrink-0" />,
    info: <Info size={18} className="text-blue-500 shrink-0" />,
    "coming-soon": <Info size={18} className="text-orange-500 shrink-0" />,
  };

  const bgMap: Record<ToastType, string> = {
    success: "border-green-200 bg-green-50",
    error: "border-red-200 bg-red-50",
    info: "border-blue-200 bg-blue-50",
    "coming-soon": "border-orange-200 bg-orange-50",
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-lg text-sm font-bold text-[#002649] animate-in slide-in-from-bottom-4 duration-300 ${bgMap[t.type]} pointer-events-auto`}
          >
            {iconMap[t.type]}
            <span>{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="mr-2 opacity-40 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

### Step 2: Wrap layout with ToastProvider

In `src/app/layout.tsx`, add `ToastProvider` around the existing `NotificationProvider`:

```tsx
// Add to imports:
import { ToastProvider } from "@/components/Toast";

// Wrap the body content:
<ToastProvider>
  <NotificationProvider>
    <SessionGuard />
    {/* ... rest of layout ... */}
  </NotificationProvider>
</ToastProvider>
```

### Step 3: Verify TypeScript compiles

```bash
cd phoenix-dashboard && npx tsc --noEmit
```
Expected: 0 errors.

### Step 4: Commit

```bash
git add src/components/Toast.tsx src/app/layout.tsx
git commit -m "feat: add shared Toast notification system (replaces all alert() calls)"
```

---

## TASK 2 — Replace alert() in ManagerWhisperer (Briefly)

**Files:**
- Modify: `src/app/ai-hub/components/ManagerWhisperer.tsx`

### Step 1: Import and wire useToast

At the top of `ManagerWhisperer.tsx`, add:
```tsx
import { useToast } from "@/components/Toast";
```

Inside `BrieflyManagerBrief()`, add:
```tsx
const { showToast } = useToast();
```

### Step 2: Replace "שגר בריף" alert (line ~239)

```tsx
// BEFORE:
<button onClick={() => alert("הבריף שוגר בהצלחה!")} ...>

// AFTER:
<button onClick={() => showToast("הבריף שוגר בהצלחה! (שליחה אמיתית — בקרוב)", "coming-soon")} ...>
```

### Step 3: Replace "מעוניין לראיין" alert (line ~353)

```tsx
// BEFORE:
<button onClick={()=>alert("זימון נשלח!")} ...>

// AFTER:
<button onClick={() => showToast("זימון ראיון — סנכרון Outlook בקרוב", "coming-soon")} ...>
```

### Step 4: Fix JOB_CANDIDATES any type

```tsx
// BEFORE:
const JOB_CANDIDATES: Record<string, any[]> = { ... }

// AFTER:
interface Candidate { id: string; name: string }
const JOB_CANDIDATES: Record<string, Candidate[]> = { ... }
```

### Step 5: tsc --noEmit, then commit

```bash
git add src/app/ai-hub/components/ManagerWhisperer.tsx
git commit -m "fix: replace alert() with toast in Briefly, type JOB_CANDIDATES"
```

---

## TASK 3 — Replace alert() in Intelligence, Permissions, Candidates

**Files:**
- Modify: `src/app/intelligence/page.tsx`
- Modify: `src/app/admin/permissions/page.tsx`
- Modify: `src/app/candidates/page.tsx`

### Step 1: intelligence/page.tsx — replace alert + fix any types

Add `import { useToast } from "@/components/Toast";` at top.

Wire `const { showToast } = useToast();` inside the component.

```tsx
// Line ~109 — BEFORE:
alert("מייצר דוח מנהלים אקזקיוטיבי... (C-Level Summary)");

// AFTER:
showToast("ייצוא דוח C-Level — בקרוב", "coming-soon");
```

Fix the three `any` prop types for `MetricCard` (line ~562):
```tsx
// BEFORE:
function MetricCard({ label, actual, target, status, trend, tooltipDesc, tooltipFormula }: any)

// AFTER:
interface MetricCardProps {
  label: string;
  actual: string | number;
  target: string | number;
  status: "success" | "warning" | "danger";
  trend: string;
  tooltipDesc: string;
  tooltipFormula: string;
}
function MetricCard({ label, actual, target, status, trend, tooltipDesc, tooltipFormula }: MetricCardProps)
```

Replace `statusColors: any` and `bgColors: any` with typed Record:
```tsx
const statusColors: Record<"success" | "warning" | "danger", string> = { ... }
const bgColors: Record<"success" | "warning" | "danger", string> = { ... }
```

Replace `useState<any>(null)` with a proper interface based on `MOCK_INTELLIGENCE_DATA`'s shape:
```tsx
interface GhostingRisk { candidate: string; role: string; days: number; risk: string; }
interface IntelligenceData {
  ghosting_risks: GhostingRisk[];
  // add additional fields as needed by the render
}
const [data, setData] = useState<IntelligenceData | null>(null);
```

### Step 2: admin/permissions/page.tsx — replace alert

Add `import { useToast } from "@/components/Toast";` and wire hook.

```tsx
// BEFORE:
alert("מייצא דוח Access Review Matrix (CSV) לביקורת אבטחת מידע...");

// AFTER:
showToast("ייצוא Access Review Matrix — בקרוב", "coming-soon");
```

### Step 3: candidates/page.tsx — replace alerts

Wire `useToast`. Replace two alert calls:

```tsx
// Validation alert (line ~342) — keep meaningful, replace browser alert:
// BEFORE: return alert("חובה להזין לפחות שם ותפקיד")
// AFTER:
showToast("חובה להזין לפחות שם ותפקיד", "error");
return;

// Email notification alert (line ~349):
// BEFORE: alert("נשלח מייל עדכון לשותפים...")
// AFTER:
showToast("עדכון שותפים — שליחת מייל אוטומטית בקרוב", "coming-soon");
```

### Step 4: tsc --noEmit, then commit

```bash
git add src/app/intelligence/page.tsx src/app/admin/permissions/page.tsx src/app/candidates/page.tsx
git commit -m "fix: replace alert() with toast in intelligence, permissions, candidates"
```

---

## TASK 4 — Replace alert() in SmartOnboarding + ReportsGenerator

**Files:**
- Modify: `src/app/ai-hub/components/SmartOnboarding.tsx`
- Modify: `src/app/ai-hub/components/ReportsGenerator.tsx`

### Step 1: SmartOnboarding.tsx — replace alerts + add mock offline fallback

Wire `useToast`.

```tsx
// Validation (line ~60):
// BEFORE: globalThis.alert("חובה למלא שם...")
// AFTER:
showToast("חובה למלא שם, ת.ז ותאריך תחילה", "error");
return;

// CV validation (line ~73):
// BEFORE: globalThis.alert("חובה להעלות קורות חיים...")
// AFTER:
showToast("חובה להעלות קורות חיים לפני סיום התהליך", "error");
return;

// Server error catch (line ~86):
// BEFORE: globalThis.alert("שגיאת תקשורת מול השרת...")
// AFTER — add mock success so demo works offline:
} catch {
  // Backend offline: simulate success for demo
  console.warn("[Onboarding] Backend offline — using mock success");
  showToast("המערכת במצב הדגמה — הנתונים נשמרו לוקלית", "info");
  setStep(5); // advance to success screen
}
```

### Step 2: ReportsGenerator.tsx — replace alert

Wire `useToast`.

```tsx
// BEFORE:
globalThis.alert("שגיאה בהפקת הדוח.");

// AFTER:
showToast("שגיאה בהפקת הדוח — ודא שהשרת פעיל", "error");
```

### Step 3: tsc --noEmit, then commit

```bash
git add src/app/ai-hub/components/SmartOnboarding.tsx src/app/ai-hub/components/ReportsGenerator.tsx
git commit -m "fix: replace alert() with toast in SmartOnboarding + ReportsGenerator, add offline mock"
```

---

## TASK 5 — Fix TypeScript any in admin/page.tsx

**Files:**
- Modify: `src/app/admin/page.tsx`

### Step 1: Add typed interfaces for admin components

At the top of the file (after existing imports), add:

```tsx
// --- Admin page types ---
interface SystemHealthLog {
  id: string;
  timestamp: string;
  action: string;
  status: string;
  details: string;
  user: string;
}

interface SystemHealthData {
  missing_data: { type: string; message: string }[];
  logs: SystemHealthLog[];
  candidate_count: number;
  job_count: number;
  last_upload: string;
}

interface AnalyticsTaskType {
  label: string;
  pct: number;
  count: number;
  color: string;
}

interface AnalyticsRecruiter {
  name: string;
  dominant: string;
  time: string;
  rate: string;
  insight: string;
  color: string;
}

interface AnalyticsData {
  task_types: AnalyticsTaskType[];
  recruiters: AnalyticsRecruiter[];
}

interface StatMiniCardProps {
  label: string;
  value: string | number;
  sub: string;
  color: string;
}

interface TypeBarProps {
  label: string;
  pct: number;
  count: number;
  color: string;
}

interface RecruiterRowProps {
  name: string;
  dominant: string;
  time: string;
  rate: string;
  insight: string;
  color: "green" | "red" | "orange";
}

interface DropzoneBoxProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  status: { status: string; name: string; rows: number; errorMsg?: string };
  inputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
}

interface TabNavProps {
  id: string;
  active: string;
  setter: (id: string) => void;
  icon: React.ReactNode;
  label: string;
}
```

### Step 2: Apply types to state and functions

```tsx
// BEFORE:
const [systemHealth, setSystemHealth] = useState<any>(null);
const [analyticsData, setAnalyticsData] = useState<any>(null);

// AFTER:
const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
```

```tsx
// BEFORE:
} catch (error: any) {

// AFTER:
} catch (error: unknown) {
```

```tsx
// FILE_META value type
const FILE_META: Record<string, { title: string; icon: React.ReactNode; color: string }> = { ... }
```

### Step 3: Apply props interfaces to the 5 bottom-of-file components

Replace `}: any)` with the appropriate interface for `StatMiniCard`, `TypeBar`, `RecruiterRow`, `DropzoneBox`, `TabNav`.

Also fix inline `.map` callbacks:
```tsx
// systemHealth.missing_data.map((alert: any, idx) → ({ type, message }, idx)
// systemHealth.logs.map((log: any, i) → (log: SystemHealthLog, i)
// analyticsData.task_types.map((t: any, i) → (t: AnalyticsTaskType, i)
// analyticsData.recruiters.map((r: any, i) → (r: AnalyticsRecruiter, i)
// onUpload={(e: any) → onUpload={(e: React.ChangeEvent<HTMLInputElement>)
```

### Step 4: tsc --noEmit, then commit

```bash
git add src/app/admin/page.tsx
git commit -m "fix: eliminate all TypeScript any types in admin/page.tsx"
```

---

## TASK 6 — Fix TypeScript any in headcount/page.tsx

**Files:**
- Modify: `src/app/headcount/page.tsx`

### Step 1: Add typed interfaces

```tsx
interface TeamRole {
  role: string;
  count: number;
  open: number;
}

interface TeamData {
  teams: TeamRole[];
}

interface OrgUnit {
  unit: string;
  headcount: number;
  open: number;
  attrition: number;
}
```

### Step 2: Apply types

```tsx
// BEFORE:
const MOCK_TEAMS_ROLES: Record<string, any> = { ... }
const [selectedUnit, setSelectedUnit] = useState<any>(null);
function StatCard({ label, value, icon }: any)

// AFTER:
const MOCK_TEAMS_ROLES: Record<string, TeamData> = { ... }
const [selectedUnit, setSelectedUnit] = useState<OrgUnit | null>(null);
interface StatCardProps { label: string; value: string | number; icon: React.ReactNode }
function StatCard({ label, value, icon }: StatCardProps)
```

Fix inline `.map((item: any` → `.map((item: TeamRole`.

### Step 3: tsc --noEmit, then commit

```bash
git add src/app/headcount/page.tsx
git commit -m "fix: eliminate TypeScript any types in headcount/page.tsx"
```

---

## TASK 7 — Add Offline Mock Fallback to admin/security/page.tsx

**Files:**
- Modify: `src/app/admin/security/page.tsx`

### Step 1: Define mock security data

```tsx
const MOCK_SECURITY_DATA = {
  ai_enabled: true,
  logs: [
    { id: "LOG-DEMO-01", time: "2026-03-17 09:00:00", action: "SESSION_LOCKED", status: "auth", details: "inactivity timeout 20min | client_ts=...", user: "frontend" },
    { id: "LOG-DEMO-02", time: "2026-03-17 09:05:00", action: "SESSION_RESTORED", status: "auth", details: "session resumed by user | client_ts=...", user: "frontend" },
  ] as AuditLog[],
};
```

### Step 2: Update catch block in fetchSecurityData

```tsx
// BEFORE:
} catch (error) {
  console.error("Failed to fetch security data", error);
}

// AFTER:
} catch (error) {
  console.warn("[Security] Backend offline — showing mock data", error);
  setAiEnabled(MOCK_SECURITY_DATA.ai_enabled);
  setLogs(MOCK_SECURITY_DATA.logs);
}
```

### Step 3: tsc --noEmit, then commit

```bash
git add src/app/admin/security/page.tsx
git commit -m "fix: add offline mock fallback to security/audit-logs page for demo resilience"
```

---

## TASK 8 — Delete Approved Dead Assets

> ⚠️ Run this task ONLY after user confirms the list from Task 0.

**Files to delete:**
- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`

### Step 1: Delete files

```bash
cd phoenix-dashboard
git rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```

### Step 2: Build to confirm nothing broke

```bash
npx next build 2>&1 | tail -15
```
Expected: all 11 routes build ✅

### Step 3: Commit

```bash
git commit -m "chore: remove unused Next.js boilerplate SVG assets"
```

---

## TASK 9 — Final Verification

### Step 1: Full TypeScript check

```bash
npx tsc --noEmit
```
Expected: 0 errors.

### Step 2: Full production build

```bash
npx next build 2>&1 | tail -20
```
Expected: all routes ✅, no `any` warnings.

### Step 3: Grep for remaining alert() calls

```bash
grep -rn "alert(" src/ --include="*.tsx" --include="*.ts"
```
Expected: Only `MobilitySimulator.tsx` (legitimate print popup warning) — all others gone.

### Step 4: Grep for remaining any types

```bash
grep -rn ": any" src/ --include="*.tsx" --include="*.ts"
```
Expected: 0 results (or only in genuinely unavoidable third-party callback positions).

### Step 5: Confirm SessionGuard scope

```bash
grep -n "SessionGuard" src/app/layout.tsx
```
Expected: `<SessionGuard />` appears inside the root `<body>` — wraps all 11 routes. ✅

### Step 6: Commit + tag

```bash
git add -A
git commit -m "chore: pre-launch polish complete — toast system, strict types, mock fallbacks"
```
