# Design: Health Scan, FinOps Offline Fallback & Auth Audit Logging

**Date:** 2026-03-17
**Approach chosen:** Option B — Backend-Integrated Audit
**Status:** Approved for implementation

---

## 1. Scope

Three focused tasks:

1. **Broken imports & missing env vars** — fix `NEXT_PUBLIC_API_URL` gap
2. **FinOps offline fallback** — `budget/page.tsx` serves mock data when backend is unreachable
3. **Auth audit logging** — `SessionGuard` reports lock/unlock events to the backend `audit_logs` table; no PII logged

---

## 2. Architecture

```
phoenix-dashboard/              backend/
├── .env.local (NEW)            └── main.py
│   NEXT_PUBLIC_API_URL=            ├── POST /api/auth/log  (NEW route)
│   http://localhost:8000           │   → log_audit_action()
│                                   └── audit_logs table (EXISTING)
├── src/app/budget/page.tsx
│   fetchFinopsData()
│   ├── success  → use real data
│   └── catch    → MOCK_FINOPS_DATA + offline badge
│
├── src/components/SessionGuard.tsx
│   lockScreen()    → POST /api/auth/log {event:"SESSION_LOCKED"}
│   handleUnlock()
│   ├── success    → POST /api/auth/log {event:"SESSION_RESTORED"}
│   └── failure    → POST /api/auth/log {event:"UNLOCK_FAILED"}
│   all calls: .catch(() => console.warn("[Auth]", event))
│
└── src/app/ai-hub/components/
    └── ManagerWhisperer.tsx
        └── (already offline — add clarifying comment only)
```

---

## 3. Components

### 3a. `.env.local` (new file)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
- Not committed to git (already in `.gitignore` by Next.js convention)
- Unblocks all existing `process.env.NEXT_PUBLIC_API_URL` references

### 3b. `budget/page.tsx` — FinOps mock fallback
- Add `MOCK_FINOPS_DATA` constant: representative data for all FinOps categories
- Wrap `fetchFinopsData` in `try/catch`
- On catch: `setData(MOCK_FINOPS_DATA)`, set a boolean `isOfflineMode` state flag
- Render a subtle amber banner: `"⚠️ מצב לא מקוון — מוצגים נתוני הדגמה"` when offline

### 3c. `SessionGuard.tsx` — auth event logging
```ts
async function logAuthEvent(event: string, details: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) { console.warn("[Auth]", event, details); return; }
  await fetch(`${apiUrl}/api/auth/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, details, timestamp: new Date().toISOString() })
  }).catch(() => console.warn("[Auth fallback]", event));
}
```

Events logged (no PII — no password, no username from form):

| Trigger | Event name | Details field |
|---|---|---|
| Inactivity timer fires | `SESSION_LOCKED` | `"inactivity timeout 20min"` |
| Wrong password | `UNLOCK_FAILED` | `"invalid attempt"` |
| Correct password | `SESSION_RESTORED` | `"session resumed"` |

### 3d. `backend/main.py` — new auth log route
```python
class AuthLogPayload(BaseModel):
    event: str
    details: str = ""
    timestamp: str = ""

@app.post("/api/auth/log")
async def auth_log(payload: AuthLogPayload):
    log_audit_action(
        action=payload.event,
        status="auth",
        details=payload.details,
        user="frontend"
    )
    return {"status": "logged"}
```

---

## 4. Data Flow

```
User idle 20min
  → SessionGuard.lockScreen()
    → logAuthEvent("SESSION_LOCKED", "inactivity timeout 20min")
      → POST /api/auth/log  ──→  log_audit_action()  ──→  audit_logs DB
      → (if offline) console.warn("[Auth]", "SESSION_LOCKED")

User submits wrong password
  → handleUnlock() → setError()
    → logAuthEvent("UNLOCK_FAILED", "invalid attempt")

User submits correct password
  → handleUnlock() → setIsLocked(false)
    → logAuthEvent("SESSION_RESTORED", "session resumed")
```

---

## 5. Error Handling

- All `logAuthEvent` calls are fire-and-forget — a backend failure **never** blocks the UI
- FinOps catch block renders mock data silently — users see a non-blocking offline banner
- If `NEXT_PUBLIC_API_URL` is undefined, `logAuthEvent` short-circuits to `console.warn`

---

## 6. PII Policy

- No passwords are ever included in any log payload
- No candidate names, emails, phone numbers, or IDs are logged in auth events
- `details` field contains only pre-defined strings (no user input)

---

## 7. Files Changed

| File | Change |
|---|---|
| `phoenix-dashboard/.env.local` | CREATE — defines `NEXT_PUBLIC_API_URL` |
| `phoenix-dashboard/src/app/budget/page.tsx` | MODIFY — add mock fallback + offline banner |
| `phoenix-dashboard/src/components/SessionGuard.tsx` | MODIFY — add `logAuthEvent`, call on lock/unlock/fail |
| `phoenix-dashboard/src/app/ai-hub/components/ManagerWhisperer.tsx` | MODIFY — add offline comment only |
| `backend/main.py` | MODIFY — add `AuthLogPayload` model + `POST /api/auth/log` route |

---

## 8. Out of Scope

- Replacing the hardcoded password with an env var (future work)
- Adding mock fallback to `admin/`, `ai-hub/ReportsGenerator`, `SmartOnboarding` (separate task)
- Real JWT/session-based auth
