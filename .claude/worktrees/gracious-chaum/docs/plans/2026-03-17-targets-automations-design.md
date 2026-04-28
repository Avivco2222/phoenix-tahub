# Design: Targets & Automations Tab (Admin Hub)
**Date:** 2026-03-17
**Status:** Approved — ready for implementation
**File affected:** `phoenix-dashboard/src/app/admin/page.tsx` (targets tab only)

---

## Overview

Replace the "Under Construction" placeholder in the Admin Hub's **יעדים ואוטומציות** tab with four production-quality panels:

1. **Formula Editor** — define KPI calculations (Conversion %, Time-to-Fill, etc.)
2. **Rule Builder** — If-This-Then-That automation rules, evaluated frontend-only
3. **Visibility Toggles** — show/hide dashboard cards per role
4. **Integrity Header** — online/offline indicator + audit trail confirmation

---

## Architecture Decision

**Chosen approach: Feature Folder (Option 3)**

```
src/app/admin/components/targets/
  ├── TargetsTab.tsx          — orchestrator, renders all panels
  ├── FormulaEditor.tsx       — Task 1: KPI formula builder
  ├── RuleBuilder.tsx         — Task 2: If/Then automation rules
  ├── VisibilityToggles.tsx   — Task 3: card show/hide per role
  └── useAdminConfig.ts       — shared hook: API + Context + fallback
```

Mirrors the existing `src/app/ai-hub/components/` pattern. Each file stays under 200 lines.

---

## Data Flow

### Backend (2 new endpoints in `main.py`)

```
GET  /api/admin/config
  → reads system_settings WHERE key='admin_config'
  → returns parsed JSON blob, or HARDCODED_DEFAULTS if missing

POST /api/admin/config?section=formulas|rules|visibility
  → writes JSON blob to system_settings
  → calls log_audit_action(action="ADMIN_CONFIG_UPDATE",
                           details=f"section={section}|keys_changed=...",
                           user="admin-frontend")
  → returns { status: "saved", timestamp: "..." }
```

### Config Blob Shape

```json
{
  "formulas": [
    { "id": "conv_rate", "label": "Conversion Rate %",   "varA": "hires",     "op": "/", "varB": "offers",    "scale": 100 },
    { "id": "ttf",       "label": "Time-to-Fill (avg)",  "varA": "avg_days",  "op": "=", "varB": null,        "scale": 1   }
  ],
  "rules": [
    {
      "id": "r1", "metric": "interviews_per_week", "op": "<", "threshold": 7,
      "action": "toast", "actionLabel": "ממוצע ראיונות נמוך מהיעד",
      "enabled": true
    }
  ],
  "visibility": {
    "kpi_conversion":    true,
    "kpi_ttf":           true,
    "chart_sources":     true,
    "table_recruiters":  true
  }
}
```

### Frontend State Sync (React Context)

`useAdminConfig` exposes a React Context so **both** the Admin targets tab and the main Analytics tab share the same in-memory config — no prop drilling, no page reload needed.

```
AdminConfigProvider (wraps layout or page)
  ├── on mount: GET /api/admin/config
  │     ├── success → hydrate context state
  │     └── fail    → isOffline=true, load HARDCODED_DEFAULTS
  ├── save(patch, section) → POST /api/admin/config?section=...
  │     ├── success → update context state → consumers re-render instantly
  │     └── fail    → toast "error", state NOT overwritten
  └── exposes: { config, save, isLoading, isOffline, lastSaved }

TargetsTab     → useAdminConfig() → reads + writes all sections
Analytics tab  → useAdminConfig() → reads config.formulas for KPI calculation
```

---

## Panel Designs

### Panel 1 — Formula Editor

- Table of KPI rows, each with: Label (text input) + Expression (3 dropdowns: varA / op / varB) + Live Preview
- **Variables:** `hires`, `offers`, `interviews`, `avg_days_open`, `applications`
- **Operators:** `÷`, `×`, `+`, `−`
- **Live preview:** evaluates against mock data values, shows result (e.g. `"= 34.2%"`)
- **Validation:** save button disabled if any row has empty label, empty varA, or divide-by-zero
- On save → `POST /api/admin/config?section=formulas` → toast "נשמר ✓"

### Panel 2 — Rule Builder

- List of If/Then cards
- **IF:** `[metric dropdown] [op: < > =] [number input]`
- **THEN:** radio — `Toast` | `Email (simulated)` | `Flag Manager`
- **Enabled toggle** per rule
- Rule engine runs on render against live state; `useRef` fired-set prevents repeat toasts per session
- On save → `POST /api/admin/config?section=rules`

### Panel 3 — Visibility Toggles

- Master list grouped by page (Dashboard / Intelligence / Candidates)
- Toggle per card; two preset buttons: **"מנהל"** / **"מגייס"**
- Persisted in `config.visibility`
- On save → `POST /api/admin/config?section=visibility`

### Panel 4 — Integrity Header (in TargetsTab.tsx)

- Slim status bar: 🟢 "מחובר לשרת" / 🟠 "מצב אופליין — ברירת מחדל"
- Shows last saved timestamp
- Shield icon confirming audit logging is active

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Backend offline on mount | `isOffline=true`, `HARDCODED_DEFAULTS` loaded, UI fully functional |
| POST fails | Toast "error", state NOT overwritten, user can retry |
| Divide-by-zero / empty formula | Inline red warning, save disabled |
| Rule fires repeatedly | `useRef` flag blocks re-fire within same session |

---

## Audit Logging

Every POST triggers:
```python
log_audit_action(
    action  = "ADMIN_CONFIG_UPDATE",
    status  = "success",
    details = f"section={section} | keys_changed={changed_keys}",
    user    = "admin-frontend"
)
```

No PII ever logged. `section` param distinguishes formula / rule / visibility changes.

---

## End-to-End Formula → Dashboard Link

The Analytics tab's "Conversion Rate" KPI card will call `useAdminConfig()` and evaluate:
```ts
const formula = config.formulas.find(f => f.id === 'conv_rate');
const result  = evalFormula(formula, mockMetrics); // e.g. 34.2
```
When an Admin saves a formula change → Context updates → Analytics card re-renders instantly. No page reload.

---

## YAGNI — Explicitly Out of Scope

- Real email dispatch (toast simulation only)
- Per-user visibility (global only; role presets are cosmetic)
- Formula versioning / rollback
- Scheduled/async rule evaluation
- logic_config.json file on disk

---

## Files to Create / Modify

| Action | File |
|---|---|
| **Create** | `src/app/admin/components/targets/useAdminConfig.ts` |
| **Create** | `src/app/admin/components/targets/TargetsTab.tsx` |
| **Create** | `src/app/admin/components/targets/FormulaEditor.tsx` |
| **Create** | `src/app/admin/components/targets/RuleBuilder.tsx` |
| **Create** | `src/app/admin/components/targets/VisibilityToggles.tsx` |
| **Modify** | `src/app/admin/page.tsx` — replace 6-line placeholder with `<TargetsTab />` |
| **Modify** | `src/app/admin/analytics tab` — wire `useAdminConfig` for live KPI |
| **Modify** | `backend/main.py` — add GET + POST `/api/admin/config` endpoints |
