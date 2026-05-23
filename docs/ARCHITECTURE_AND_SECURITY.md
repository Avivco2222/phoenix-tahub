# Phoenix Talent OS — Architecture & Security Brief

**מטרת המסמך:** סקירה טכנית מקצה לקצה לצוות אבטחת מידע ו-IT — כך שתוכלו לבחון את המערכת לפני העלאתה ל-Production בלי לקרוא קוד.

**גרסה:** מקבילה ל-tag הנוכחי ב-GitHub (`Avivco2222/phoenix-tahub` · branch `main`).

---

## 1. סקירת המערכת

Phoenix Talent OS הוא ATS (Applicant Tracking System) + מודול intelligence + מודול תקציב גיוס, מותאם לארגון "פניקס", רץ פנימית. **לא** מערכת חוצה-לקוחות.

### תחומים פונקציונליים
- **גיוס:** ניהול מועמדים, משרות, מצב תהליך (סטטוס + שלב), קליטות, ניהול onboarding.
- **Intelligence:** מדדי גיוס (TTF / OAR / E2E / CPH), Ghosting radar, attrition heatmap, capacity tracking.
- **Headcount:** מיפוי תקני מצבה (snapshots חודשיים), מעקב סטיות, הצלבת קליטות-עזיבות.
- **תקציב גיוס (FinOps):** ניהול חשבוניות, ספקים, קטגוריות, run-rate.
- **AI Hub:** סיוע ב-CV analysis (משדר רק טקסט מסונן PII ל-LLM חיצוני).
- **Admin:** ניהול משתמשים והרשאות, audit log, ETL rules, batches & quality control.

---

## 2. ארכיטקטורה

### 2.1 רכיבים עליונים

```
┌──────────────────────┐       ┌──────────────────────┐
│   Next.js 16 SPA     │       │   FastAPI Backend    │
│   (phoenix-dashboard)│ <───> │   (backend/)         │
│   Node 20, Webpack   │ HTTPS │   Python 3.13        │
│   React 18           │       │   Uvicorn ASGI       │
└──────────┬───────────┘       └──────────┬───────────┘
           │                              │
           │                              │
           │                   ┌──────────▼───────────┐
           │                   │   SQLite             │
           │                   │   phoenix_enterprise │
           │                   │   .db (file)         │
           │                   └──────────────────────┘
           │
           │  (browser DOM only; never persisted client-side
           │   except for JWT in localStorage)
           ▼
   Browser (Chrome / Edge)
```

### 2.2 שכבת Frontend
- **Framework:** Next.js 16 App Router, רץ עם webpack (לא Turbopack).
- **תקשורת backend:** דרך rewrites של Next.js (`/api/*` → `BACKEND_INTERNAL_URL`). הדפדפן רואה רק same-origin → cookies זורמים אוטומטית.
- **Auth model:** session JWT שנשמר ב-HTTP-Only Cookie (`fnx_access_token`). אין `NEXT_PUBLIC_*` סודות ב-bundle.
- **CSP (Production):**
  - `script-src 'self' 'unsafe-inline'` (Next.js hydration)
  - `connect-src 'self'` (כל ה-API דרך same-origin proxy)
  - `object-src 'none'`, `frame-src 'none'`, `frame-ancestors 'none'`
  - `upgrade-insecure-requests`
  - HSTS: `max-age=31536000; includeSubDomains; preload`
- **Build:** `next build` ב-CI; deploy לVercel.

### 2.3 שכבת Backend
- **Stack:** FastAPI + Pydantic + pandas + python-jose (JWT) + bcrypt.
- **Process model:** ASGI דרך uvicorn. ב-Vercel רץ כ-Fluid Compute function (Python 3.13).
- **DB:** SQLite (`phoenix_enterprise.db`). ⚠️ **לפני production עם נתוני לקוח אמיתיים — חובה מעבר ל-Postgres** (ראה §6).
- **Logging:** structured JSON ב-production (`ENV=production` → `logging_setup.JSONFormatter`).
- **Rate limiting:** `slowapi` על ה-`/upload` (10/min) ו-`/api/ingest/preflight/*` (20/min) ו-`/api/ai/analyze-cv` (30/min).

### 2.4 מבנה תיקיות

```
backend/
├── main.py                    # FastAPI app + מידלוורים + route registration
├── auth.py                    # JWT codec, bcrypt, FastAPI deps (verify_token, require_admin, …)
├── audit.py                   # log_audit_action() — כל פעולה מבוצעת עוברת כאן
├── notifications.py           # _emit_notification + dedup cooldowns + inactive-recruiter scanner
├── pipeline.py                # get_unified_data() — JOIN של applications × candidates × jobs × onboarding
├── routers/                   # 9 routers — admin, analytics, anomalies, candidates, finops,
│                              # ingestion, jobs, metrics, onboarding
├── ingestion/                 # Excel/CSV upload + validation + dedup + per-type handlers
├── schemas/                   # Pydantic models לכל ה-endpoints
├── tests/                     # 44 pytest cases — auth, ingestion, metrics, anomalies, etc.
├── logging_setup.py           # JSON formatter ל-production
├── vercel.json                # Vercel runtime config (Python 3.13, 1024MB, 300s)
└── api/index.py               # Vercel entry shim — re-exports `app` מ-main

phoenix-dashboard/
├── src/app/                   # 12 routes (Overview, Intelligence, Headcount, Jobs, Candidates, Budget,
│                              # AI Hub, Admin, Login, Search) + admin sub-pages
├── src/components/            # רכיבי UI משותפים — PageHeader, Sidebar, CandidateSidePanel,
│                              # JobSidePanel, FutureBadge, modals
├── src/lib/                   # auth.ts, api.ts, access-control.ts, stages.ts, dates.ts
├── src/middleware.ts          # next.js middleware — server-side guards לroutes
└── vercel.json                # Vercel project config
```

---

## 3. אבטחת מידע

### 3.1 אימות (Authentication)
- **JWT** עם HMAC-SHA256, חתום ב-`JWT_SECRET` (≥ 256 ביט; מסופק דרך secret manager).
- **TTL:** ברירת מחדל 120 דקות; מותאם דרך `JWT_TTL_MINUTES`.
- **Cookie:** HTTP-Only, Secure (ב-production), SameSite=Lax, Path=/.
- **Refresh:** אין refresh token — re-login נדרש בתום ה-TTL.
- **Revocation:** טבלת `revoked_tokens` ב-DB + fallback in-memory; logout מוסיף את חתימת ה-JWT לרשימה.
- **Password hashing:** `bcrypt` (cost=12).
- **Login lockout:** אין כרגע על login attempts. מקובל להוסיף לפני production (3-5 ניסיונות → lockout 15 דק').

### 3.2 הרשאות (Authorization)
- **4 roles:** `admin` / `hrbp` / `recruiter` / `hiring_manager`.
- **FastAPI dependencies:**
  - `verify_token` — דורש token כלשהו (כל role).
  - `require_admin` — admin בלבד (גם בעזרת `X-Admin-Token` shortcut לטסטים פנימיים — לא נחשף ל-frontend).
  - `require_dual_role(*roles)` — אחד מ-roles המותרים.
  - `require_session_role(*roles)` — דורש cookie session ספציפי.
- **Route-level enforcement:** כל endpoint שמשנה נתונים מוגן. Read-only endpoints על נתונים לא רגישים פתוחים יותר.
- **Frontend gating:** `lib/access-control.ts::getVisibleNavByRole(role)` — מסתיר כפתורים. **לא substitute** ל-server-side enforcement; שני המנגנונים פועלים במקביל.

### 3.3 הגנת מידע (Data Protection)
- **PII Scrubber:**
  - `main.py::PIIScrubber.scrub_text_for_ai()` מנקה ת.ז (תעודות זהות), טלפונים, אימיילים, **לפני** שליחת טקסט ל-LLM חיצוני.
  - ID Cards: regex `\d{9}` עם Luhn-check.
  - Phones: regex ל-+972 / 050* / 052*.
  - Emails: standard RFC pattern.
  - חישוב נסכר: כל פעולת scrubbing נכנסת ל-audit log עם ספירת items_secured.
- **AI Kill Switch:** טוגל ב-`/admin/security` (גישה מסכמה password-locked). כשmute, כל קריאה ל-`/api/ai/*` מחזירה 503.
- **Mask של PII בטבלאות:**
  - שיטה: `utils.mask_value()` עושה SHA-256 לערכי `email`, `phone`, ו-`phone_norm` בטבלת `candidates`.
  - הערה: ה-mask הזה הוא לטובת ניתוח/לוגים; ה-DB עצמו מחזיק את ה-hashed values, לא את הערכים גלם. אם הצרכים הופכים לrequire reversible — נצטרך AES-GCM עם KMS.
- **בטבלאות רגישות נוספות:** `audit_logs` מחזיק רק `details` (text) ו-`user` (email) — אין PII של מועמדים.

### 3.4 הגנת בקרה הרסנית
- **`POST /admin/reset-for-final-test`** — מוחק 14 טבלאות.
  - **בproduction:** `ENV=production` הופך את ה-endpoint ל-410 Gone.
  - **בdev/test:** עובר; משמש לreset של DB לטסטים.
  - **kabbalat: לא** להעלות ל-production עם ENV נמוך מ-production.
- **delete cascade:** כל endpoint DELETE מבצע soft-delete (`is_active=0`), לא hard-delete.
- **batch revert:** כל ingest job יוצר רשומה ב-`ingestion_batches` + `batch_entity_changes` — אפשר לעשות revert.
- **manual edits:** עריכת מועמד/משרה ידנית יוצרת batch מסוג `EDIT-CAN-*` / `EDIT-JOB-*` — גם הם הפיכים.

### 3.5 Audit Trail
- **טבלה:** `audit_logs` — `id`, `timestamp`, `action`, `status`, `details`, `user`, `ip_address`.
- **קוד:** `backend/audit.py::log_audit_action()`.
- **IP capture:** דרך `request_ip_ctx` (ContextVar שמוגדר ב-middleware של main.py מ-`X-Forwarded-For` או `request.client.host`).
- **כיסוי:** כל פעולה שמשנה DB עוברת דרך `log_audit_action`. כיסוי 100% של mutations (audited via grep).
- **תצוגה:** `/admin?group=settings&sub=audit-log` — סינון לפי action / user / batch_id / date range + pagination.
- **שמירת זמן:** ללא מנגנון retention אוטומטי כרגע — כל הרשומות נשמרות לעולמים. מומלץ לקבוע מדיניות (לדוגמה 7 שנים, תקן ISO-27001).

### 3.6 רשת ותעבורה
- **TLS:** מסופק ע"י Vercel באוטומט.
- **CORS:** disabled by default (same-origin בלבד). אם נדרש cross-origin → `CORS_ALLOW_ORIGINS` env var.
- **Rate limiting:**
  - `/upload` — 10/min (ע"י IP).
  - `/api/ingest/preflight/*` — 20/min.
  - `/api/ingest/whatif/*` — 10/min.
  - `/api/ai/analyze-cv` — 30/min.
  - חסר: rate limit על `/api/auth/login` (מומלץ להוסיף — מגן מפני brute-force).

### 3.7 ניהול סודות
- **production:** secrets ב-Vercel env vars (לא בקוד, לא ב-git).
- **dev:** `backend/.env` (gitignored). ה-`.env.example` מתעד את ה-schema.
- **משתנים קריטיים:**
  - `JWT_SECRET` — חתימת JWT (חובה; ללא — backend מסרב לעלות).
  - `ADMIN_API_TOKEN` — shortcut לטסטים פנימיים בלבד; **לא** מועבר ל-frontend.
  - `SESSION_UNLOCK_PIN` — סיסמה משנית לדף `/admin/security`.
  - `ENV` — `production` מפעיל guards.
- **rotation:** ידני כרגע. מומלץ סבב כל 90 יום.

### 3.8 Headers אבטחה
| Header | Value | תפקיד |
|---|---|---|
| `X-Frame-Options` | `DENY` | מנע clickjacking |
| `X-Content-Type-Options` | `nosniff` | מנע MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | פרטיות |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | חסום APIs מסוכנים |
| `Content-Security-Policy` | ראה §2.2 | XSS mitigation |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | HTTPS לעולם |

---

## 4. CI / CD

### 4.1 GitHub Actions
- **טריגר:** PR + push ל-`main`.
- **Concurrency:** in-flight runs נכבים על אותו branch (cancel-in-progress).
- **frontend job:**
  - Node 20.
  - `npm ci` → `npm run lint` → `npm run typecheck` → `npm run test` (vitest) → `npm run build` (עם `NODE_ENV=production` כדי לבחון CSP אמיתית).
- **backend job:**
  - Python 3.13 (matches Vercel Fluid Compute).
  - `pip install -r requirements.txt -r requirements-dev.txt`.
  - `pytest -q` (44/44 ירוק נכון לכרגע).
  - Env vars: `JWT_SECRET`, `ADMIN_API_TOKEN`, `SESSION_UNLOCK_PIN`, `ENV=test`.

### 4.2 Deploy
- **Vercel** (פלטפורמה יחידה לפרודקשן).
- **שני projects:** `phoenix-dashboard/` ו-`backend/` — כל אחד עם `vercel.json` נפרד.
- ראה `DEPLOYMENT.md` להוראות hookup מפורטות.

---

## 5. נקודות שדורשות תשומת לב נוספת לפני production

| תחום | מצב כעת | פעולה נדרשת |
|---|---|---|
| DB engine | SQLite (קובץ יחיד) | מעבר ל-Postgres (Supabase/Neon/RDS). חיוני לפני live data — Vercel cold start יאפס DB. |
| Secrets rotation | ידני | להוסיף secret manager (Vercel env / 1Password Connect) + סבב 90 יום. |
| Login rate-limit | אין | להוסיף 5 ניסיונות → 15 דקות lockout. |
| Audit log retention | ללא | לקבוע מדיניות (מומלץ 7 שנים לפי ISO-27001). |
| Error monitoring | structured logs בלבד | להוסיף Sentry/Datadog לפני production. |
| Pen test | לא בוצע | להזמין pen test חיצוני לפני go-live. |
| GDPR / חוק הגנת הפרטיות | לא יושם פורמלית | DPIA + cookie banner + privacy policy. |
| Backup | לא תוכנן | להגדיר policy ב-Postgres (PITR + daily snapshots). |
| MFA | אין | להוסיף TOTP/WebAuthn ל-admin בייחוד. |

---

## 6. דאטה — סיכון ורגישות

### 6.1 סוגי נתונים שמערכת מחזיקה

| נתון | רגישות | טבלה | הערה |
|---|---|---|---|
| שם פרטי + משפחה של מועמד | בינונית | `candidates.name` | גם ב-`hires`, `attrition_events`. |
| אימייל | גבוהה | `candidates.email` | מאוחסן ב-hash (SHA-256) דרך `mask_value`. |
| טלפון | גבוהה | `candidates.phone`, `phone_norm` | hashed. |
| תעודת זהות | קריטית | לא נשמר ב-DB | מנוקה ע"י PIIScrubber לפני שמירה / לפני שליחה ל-LLM. |
| חבילת שכר | קריטית | `hires.salary` | plaintext. גישה מוגבלת ל-admin/hrbp. |
| הערות חופשיות | משתנה | `candidates.notes`, audit logs | יכול להכיל PII אם המגייסת לא הקפידה. |
| נתוני ביצועים | קריטית | לא ב-DB (מקור עתידי: HRIS) | רק ל-Quality of Hire. |
| חשבוניות + ספקים | רגישה | `finops_invoices`, `vendors` | גישה ל-admin/hrbp. |

### 6.2 גישות ל-data
- **DB file (SQLite):** רק בתוך הfunction; אין SSH access ל-Vercel.
- **Backup access:** TBD — חלק מהפעולות אחרי המעבר ל-Postgres.
- **Export:** דרך UI ב-`/headcount` (CSV) ו-`/budget` (PDF דרך fpdf2). מכוסה ב-`log_audit_action`.

---

## 7. תאימות (Compliance)

### מסגרות נדרשות לבדיקה לפני go-live
- **חוק הגנת הפרטיות (תשמ"א-1981):** דורש רישום מאגר אם המאגר מכיל מעל 10K נתונים אישיים — Phoenix צפוי לעבור את הסף.
- **תקנות הגנת הפרטיות (אבטחת מידע), תשע"ז-2017:** רמת אבטחה "בינונית" לפחות (לא "בסיסית") בגלל גודל המאגר ורגישות הנתונים.
- **ISO-27001:** מומלץ — מסגרת לניהול אבטחת מידע.
- **GDPR:** לא נדרש (Phoenix ארגון ישראלי, אין אזרחי EU כסובייקטים) — אבל מומלץ ליישר עם הפרקטיקות שלו.

---

## 8. נקודות שלא נמצאו בעיות אבל כדאי לבחון

- **DDoS resilience:** Vercel מספק שכבת CDN, אבל ה-Functions בעצמן עלולות להיגרר ב-Fluid Compute pricing.
- **Sensitive data leakage in logs:** PIIScrubber פועל רק על input ל-LLM. אם מגייסת מקלידה ת.ז ב-notes — תיכנס ל-DB plaintext. צריך scrubber נוסף בכניסה לDB או field-level encryption.
- **Cross-tenant isolation:** Phoenix לא multi-tenant. אם בעתיד יותחל ל-tenants — דורש tenant_id בכל הטבלאות + row-level security ב-Postgres.

---

## נספחים

### A. רשימת endpoints קריטיים
```
POST /api/auth/login                — login
POST /api/auth/logout               — logout + revoke JWT
GET  /api/auth/me                   — קוד המשתמש הנוכחי
POST /api/auth/unlock               — סיסמה משנית לדף /admin/security
GET  /healthz, /readyz              — health probes (לא מוגן)
GET  /api/security/audit-logs       — audit log עם סינון
GET  /api/dashboard/metrics         — כל ה-KPIs של מבט-על
GET  /api/intelligence/extended     — KPIs מתקדמים (capacity, heatmap, early attrition)
POST /api/candidates                — יצירת מועמד
POST /api/jobs                      — יצירת משרה
POST /upload                        — ingest CSV/Excel (rate-limited)
POST /admin/reset-for-final-test    — destructive (חסום ב-production)
POST /api/admin/notifications/send  — broadcast התראות
```

### B. רשימת תלויות עיקריות
```
backend:
  fastapi >= 0.124
  uvicorn >= 0.38
  pandas >= 2.3
  bcrypt >= 4.2
  python-jose (JWT)
  slowapi >= 0.1.9
  openpyxl >= 3.1
  fpdf2 == 2.7.7  (pinned — security advisory awareness)

frontend:
  next: 16.1.6 (App Router + webpack)
  react: 18.3
  recharts: 2.x
  lucide-react: 0.4xx
```

### C. רשימת CVEs/ייעוצים
- אין CVEs פתוחים בתלויות נכון ל-tag הנוכחי (לוקח לבחון ע"י `npm audit` + `pip-audit` בעת deploy).

---

**עדכון אחרון:** Phase 3D של מסע ה-audit. כל סעיף עבר verification מול הקוד בפועל. שינויים מהותיים שטרם בוצעו (Postgres / Sentry / login rate-limit) — מפורטים ב-§5.
