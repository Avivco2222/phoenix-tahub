# Health Scan, FinOps Offline Fallback & Auth Audit Logging — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the missing `NEXT_PUBLIC_API_URL` env var, make FinOps serve mock data when the backend is offline, and write lock/unlock events to the backend's existing `audit_logs` table — with no PII logged.

**Architecture:** Five small, independent changes. The env var fix unblocks all existing `fetch()` calls. The FinOps fallback wraps the existing `fetchFinopsData` catch block. The auth logging adds a fire-and-forget helper to `SessionGuard` that calls a new `/api/auth/log` FastAPI route which reuses the already-present `log_audit_action()` function. Briefly (`ManagerWhisperer`) already works offline — it needs only a clarifying comment.

**Tech Stack:** Next.js 16, TypeScript, React 19, FastAPI (Python), SQLite via `sqlite3`

---

## Task 1: Create `.env.local` with `NEXT_PUBLIC_API_URL`

**Files:**
- Create: `phoenix-dashboard/.env.local`

**Step 1: Create the file**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Full file content — nothing else. No trailing newline required.

**Step 2: Verify it is git-ignored**

Run from `phoenix-dashboard/`:
```bash
git check-ignore -v .env.local
```
Expected output: `.gitignore:1:.env.local` (or similar — any line confirming it is ignored).
If it is NOT ignored, add `.env.local` to `phoenix-dashboard/.gitignore`.

**Step 3: Confirm Next.js picks it up**

Run from `phoenix-dashboard/`:
```bash
npx next info
```
No error expected. (Full dev server is not needed yet.)

**Step 4: Commit**

```bash
git add phoenix-dashboard/.env.local
git commit -m "feat: add .env.local with NEXT_PUBLIC_API_URL for local dev"
```

---

## Task 2: FinOps offline fallback in `budget/page.tsx`

**Files:**
- Modify: `phoenix-dashboard/src/app/budget/page.tsx`

**Context:** `fetchFinopsData` already has a `try/catch` at line 99–123. The `catch` block currently only calls `console.error`. We need to:
1. Add a new `isOfflineMode` state boolean
2. In the `catch` block, populate all three state slices with mock data and set `isOfflineMode(true)`
3. Add a visible but non-blocking amber banner just below the page header

**Step 1: Add `isOfflineMode` state**

Find this block (around line 76–96, after `const [activeTab, setActiveTab]`):
```tsx
  const [isLoading, setIsLoading] = useState(true);
```

Add immediately after it:
```tsx
  const [isOfflineMode, setIsOfflineMode] = useState(false);
```

**Step 2: Replace the `catch` block in `fetchFinopsData`**

Find the current catch block:
```tsx
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
```

Replace it with:
```tsx
    } catch (e) {
      console.warn("[FinOps] Backend offline — loading mock data", e);
      setIsOfflineMode(true);
      setCategories(DEFAULT_CATEGORIES);
      setVendors([
        { id: "v1", name: "LinkedIn Talent Solutions", defaultCategory: "שיווק ופרסום", totalPaid: 42000, activeInvoices: 2 },
        { id: "v2", name: "AllJobs Premium", defaultCategory: "שיווק ופרסום", totalPaid: 18500, activeInvoices: 1 },
        { id: "v3", name: "טכנולוגי בע\"מ", defaultCategory: "חברות השמה", totalPaid: 65000, activeInvoices: 3 },
      ]);
      setInvoices([
        { id: "INV-001", vendor: "LinkedIn Talent Solutions", date: "2026-01-15", dueDate: "2026-02-15", budgetMonth: "ינואר 2026", amount: 21000, category: "שיווק ופרסום", subcategory: "קמפיין ממומן", status: "שולם", note: "Q1 Campaign", fileUrl: null, due_date: "2026-02-15", budget_month: "ינואר 2026", file_url: null },
        { id: "INV-002", vendor: "טכנולוגי בע\"מ", date: "2026-02-01", dueDate: "2026-03-01", budgetMonth: "פברואר 2026", amount: 35000, category: "חברות השמה", subcategory: "השמת בכיר", status: "ממתין לאישור הנהח״ש", note: "Senior R&D hire", fileUrl: null, due_date: "2026-03-01", budget_month: "פברואר 2026", file_url: null },
        { id: "INV-003", vendor: "AllJobs Premium", date: "2026-02-20", dueDate: "2026-03-20", budgetMonth: "פברואר 2026", amount: 18500, category: "שיווק ופרסום", subcategory: "קמפיין ממומן", status: "ממתין למיפוי", note: "", fileUrl: null, due_date: "2026-03-20", budget_month: "פברואר 2026", file_url: null },
      ]);
    } finally {
```

**Step 3: Add the offline banner just inside the return**

Find the opening div of the return statement (around line 254–263):
```tsx
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
```

Replace ONLY the `<p>` subtitle line (keep h1 exactly as-is):
```tsx
          <p className="text-slate-500 mt-2">
            {isOfflineMode
              ? <span className="inline-flex items-center gap-1.5 text-amber-600 font-semibold">⚠️ מצב לא מקוון — מוצגים נתוני הדגמה. הפעל את השרת לנתונים אמיתיים.</span>
              : "אנליטיקה, תפעול חשבוניות וניהול ספקים (מסונכרן לשרת Live 🟢)"}
          </p>
```

**Step 4: Verify TypeScript compiles**

Run from `phoenix-dashboard/`:
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 5: Commit**

```bash
git add phoenix-dashboard/src/app/budget/page.tsx
git commit -m "feat(finops): add offline mock fallback with amber status banner"
```

---

## Task 3: Add `logAuthEvent` to `SessionGuard.tsx`

**Files:**
- Modify: `phoenix-dashboard/src/components/SessionGuard.tsx`

**Context:** The entire component is 90 lines. We add one helper function and three call sites. No PII ever enters the log payload — only pre-defined string literals.

**Step 1: Add the `logAuthEvent` helper after the imports**

Find the line:
```tsx
const TIMEOUT_MS = 20 * 60 * 1000;
```

Add this block immediately after it:
```tsx
// --- Auth Audit Logging ---
// Fire-and-forget: never blocks the UI. Falls back to console if backend is offline.
// PII POLICY: payload contains only pre-defined event names and static detail strings.
// No passwords, no user input, no candidate data is ever sent.
async function logAuthEvent(event: string, details: string): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.warn("[Auth]", event, details);
    return;
  }
  try {
    await fetch(`${apiUrl}/api/auth/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        details,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    console.warn("[Auth fallback]", event, details);
  }
}
```

**Step 2: Call `logAuthEvent` in `lockScreen`**

Find:
```tsx
  const lockScreen = useCallback(() => {
    setIsLocked(true);
  }, []);
```

Replace with:
```tsx
  const lockScreen = useCallback(() => {
    setIsLocked(true);
    logAuthEvent("SESSION_LOCKED", "inactivity timeout 20min");
  }, []);
```

**Step 3: Call `logAuthEvent` in `handleUnlock`**

Find:
```tsx
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "222222") {
      setIsLocked(false);
      setPassword("");
      setError("");
    } else {
      setError("סיסמה שגויה. נסה שוב.");
    }
  };
```

Replace with:
```tsx
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "222222") {
      setIsLocked(false);
      setPassword("");
      setError("");
      logAuthEvent("SESSION_RESTORED", "session resumed by user");
    } else {
      setError("סיסמה שגויה. נסה שוב.");
      logAuthEvent("UNLOCK_FAILED", "invalid unlock attempt");
    }
  };
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 5: Commit**

```bash
git add phoenix-dashboard/src/components/SessionGuard.tsx
git commit -m "feat(auth): add fire-and-forget audit logging to SessionGuard — no PII"
```

---

## Task 4: Add `POST /api/auth/log` route to `backend/main.py`

**Files:**
- Modify: `backend/main.py`

**Context:** `log_audit_action(action, status, details, user)` already exists at line 49. The backend uses plain `dict` typed body parameters for some routes (e.g. `update_onboarding`). We follow the same pattern here using FastAPI's `Request` object for simplicity — no Pydantic needed.

**Step 1: Add the new route at the end of `main.py`**

Append the following at the very end of `backend/main.py`:

```python
# ==========================================
# AUTH AUDIT LOGGING
# ==========================================
@app.post("/api/auth/log")
async def auth_log(request: Request):
    """
    מקבל אירועי אבטחה מה-SessionGuard ורושם אותם ב-audit_logs.
    מדיניות PII: לא נשמרים סיסמאות, שמות משתמשים, או נתוני מועמדים.
    """
    try:
        payload = await request.json()
        event = str(payload.get("event", "UNKNOWN_EVENT"))
        details = str(payload.get("details", ""))
        timestamp = str(payload.get("timestamp", ""))

        # Sanitise: only allow known event names to prevent log injection
        allowed_events = {"SESSION_LOCKED", "SESSION_RESTORED", "UNLOCK_FAILED"}
        if event not in allowed_events:
            event = "UNKNOWN_EVENT"

        log_audit_action(
            action=event,
            status="auth",
            details=f"{details} | client_ts={timestamp}",
            user="frontend"
        )
        return {"status": "logged", "event": event}
    except Exception as e:
        # Never crash — auth logging must not block the client
        print(f"[auth/log] Failed to write audit log: {e}")
        return {"status": "error", "message": str(e)}
```

**Step 2: Verify the backend starts without errors**

Run from `backend/`:
```bash
uvicorn main:app --reload --port 8000
```
Expected: server starts, no import errors, no syntax errors.
Press `Ctrl+C` to stop.

**Step 3: Smoke-test the new endpoint**

With the server running, in a separate terminal:
```bash
curl -s -X POST http://localhost:8000/api/auth/log \
  -H "Content-Type: application/json" \
  -d '{"event":"SESSION_LOCKED","details":"inactivity timeout 20min","timestamp":"2026-03-17T10:00:00.000Z"}' \
  | python3 -m json.tool
```
Expected output:
```json
{
    "status": "logged",
    "event": "SESSION_LOCKED"
}
```

**Step 4: Verify the row landed in the DB**

```bash
sqlite3 backend/phoenix_enterprise.db \
  "SELECT id, timestamp, action, status, details, user FROM audit_logs ORDER BY timestamp DESC LIMIT 3;"
```
Expected: a row with `action=SESSION_LOCKED`, `status=auth`, `user=frontend`.

**Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): add POST /api/auth/log route wired to existing audit_logs table"
```

---

## Task 5: Add offline comment to `ManagerWhisperer.tsx` (Briefly)

**Files:**
- Modify: `phoenix-dashboard/src/app/ai-hub/components/ManagerWhisperer.tsx`

**Context:** Briefly is already 100% offline — `generateDraft()` sets hardcoded mock data with zero API calls. This task just adds a comment so future developers know this is intentional.

**Step 1: Add a comment above `generateDraft`**

Find:
```tsx
  const generateDraft = () => {
    setSelectedSkills(["חשיבה אנליטית", "AI ודאטה", "אמינות ודיוק"]);
```

Replace with:
```tsx
  // OFFLINE-SAFE: generateDraft() is intentionally 100% local.
  // All data here is hardcoded mock. No API call is made.
  // When real AI integration is added, replace this body with a fetch() call
  // to NEXT_PUBLIC_API_URL/api/tools/generate-brief and keep the mock as fallback.
  const generateDraft = () => {
    setSelectedSkills(["חשיבה אנליטית", "AI ודאטה", "אמינות ודיוק"]);
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add phoenix-dashboard/src/app/ai-hub/components/ManagerWhisperer.tsx
git commit -m "docs(briefly): clarify ManagerWhisperer is intentionally offline-only mock"
```

---

## Final Verification

**Step 1: TypeScript full build**

Run from `phoenix-dashboard/`:
```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 2: Lint check**

```bash
npx eslint src --max-warnings 0
```
Expected: no new warnings introduced.

**Step 3: Dev server smoke-test**

```bash
npm run dev
```
Open http://localhost:3000/budget — should render without errors.
Open http://localhost:3000/ai-hub — Briefly loads, generate draft works offline.

**Step 4: Auth logging end-to-end**

1. Open http://localhost:3000 in browser
2. Leave tab idle for 20 minutes (or temporarily reduce `TIMEOUT_MS` to `5000` in `SessionGuard.tsx` for testing)
3. Confirm lock screen appears
4. Check backend terminal for log write
5. Enter wrong password → confirm `UNLOCK_FAILED` appears in DB
6. Enter correct password `222222` → confirm `SESSION_RESTORED` appears in DB

Query to check:
```bash
sqlite3 backend/phoenix_enterprise.db \
  "SELECT action, status, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 5;"
```

**Step 5: Offline FinOps test**

1. Stop the backend server
2. Reload http://localhost:3000/budget
3. Confirm the amber banner appears: `⚠️ מצב לא מקוון — מוצגים נתוני הדגמה`
4. Confirm charts, vendor list, and invoice table all render with mock data

---

## Commit Summary

| Commit | Message |
|---|---|
| 1 | `feat: add .env.local with NEXT_PUBLIC_API_URL for local dev` |
| 2 | `feat(finops): add offline mock fallback with amber status banner` |
| 3 | `feat(auth): add fire-and-forget audit logging to SessionGuard — no PII` |
| 4 | `feat(backend): add POST /api/auth/log route wired to existing audit_logs table` |
| 5 | `docs(briefly): clarify ManagerWhisperer is intentionally offline-only mock` |
