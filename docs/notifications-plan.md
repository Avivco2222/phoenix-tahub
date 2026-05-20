# 🔔 אפיון מערכת התראות (Notifications) — Phoenix TAHub

## Context

המערכת מתחילה לייצר התראות אוטומטיות מטריגרים שונים (SLA Watchdog, Inactive Recruiter, Quality Alerts), אבל:

- **אין הבחנה לפי קהל יעד** — כל התראה נוצרת לכל admin + recruiter רלוונטי, בלי הגדרה מה כל role באמת רוצה לקבל
- **אין UI להעדפות משתמש** — המשתמש לא יכול לבחור אילו טיפוסי התראות להחזיק
- **אין שליחה יזומה מ-Admin** — endpoint `POST /api/admin/notifications/send` קיים אבל אין UI
- **התראות מגיעות רק כש-MERgC פתוחה** — אם המגייסת לא נכנסה למערכת, היא לא יודעת על SLA breach קריטי

המסמך הזה מאפיין מערכת שלמה ונותן roadmap הטמעה ב-3 שלבים.

---

## 1. טקסונומיה — סוגי התראות לפי תפקיד

| תפקיד | מה הוא רוצה לקבל |
|-------|------------------|
| **Recruiter** | קליטה חדשה במשרה שלי, מועמד תקוע מעל SLA, הצעה לא נענתה תוך X ימים, ראיון מתוזמן לי, message מ-Admin, batch חדש שהשפיע על pipeline שלי |
| **Hiring Manager** | מועמד הגיע ל-OFFER במשרה שלי, צריכות לאישורי, ראיון מתוזמן לי, SLA breach בצוות שלי |
| **HR / People Partner** | קליטת עובד חדשה (start_date מתקרב), עזיבה רשומה, headcount gap > 10%, diversity gap warning |
| **Admin** | כל ה-SLA breaches בארגון, recruiter inactive 3+ ימים, batch ingest נכשל, quality score ירד מתחת לסף, חריגת תקציב |
| **כולם** | broadcast מ-Admin (תחזוקה, הכרזות), system-wide הודעות |

---

## 2. ארכיטקטורת DB — שינויים נדרשים

### טבלאות חדשות
```sql
-- העדפות התראה לכל משתמש: באילו ערוצים, אילו קטגוריות, באיזו תדירות.
CREATE TABLE notification_preferences (
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,           -- 'sla_breach', 'new_application', 'offer_expiring', etc.
    in_app BOOLEAN NOT NULL DEFAULT 1,
    email BOOLEAN NOT NULL DEFAULT 0,
    browser_push BOOLEAN NOT NULL DEFAULT 0,
    digest_freq TEXT DEFAULT 'realtime',  -- 'realtime' | 'hourly' | 'daily' | 'off'
    PRIMARY KEY (user_id, category)
);

-- רישום של push subscriptions (Web Push API endpoints).
CREATE TABLE push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,           -- ה-URL שמספק ה-browser
    p256dh_key TEXT NOT NULL,         -- public key לקריפטוגרפיה
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    UNIQUE(user_id, endpoint)
);

-- digest queue — התראות שאמורות להישלח במייל יומי/שעתי.
CREATE TABLE notification_digest_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    queued_at TEXT NOT NULL,
    sent_at TEXT,
    digest_freq TEXT NOT NULL         -- 'hourly' | 'daily'
);
```

### תוספות ל-`notifications` קיים
```sql
ALTER TABLE notifications ADD COLUMN category TEXT;     -- ל-routing לפי העדפות
ALTER TABLE notifications ADD COLUMN delivery_channels TEXT;  -- JSON: ['in_app','email','push']
ALTER TABLE notifications ADD COLUMN action_url TEXT;   -- deep-link ליעד (e.g. /candidates?id=...)
ALTER TABLE notifications ADD COLUMN expires_at TEXT;   -- ל-cleanup אוטומטי
```

---

## 3. קטלוג קטגוריות (Notification Categories)

| `category` | מתי נוצר | תפקידים שמקבלים כברירת מחדל | חומרה |
|-----------|----------|---------------------------------|--------|
| `sla_candidate_stuck` | candidate stuck > 14 ימים בשלב | recruiter (האחראי), admin | warning |
| `sla_offer_expiring` | offer pending > 7 ימים | recruiter, hiring_manager, admin | critical |
| `sla_job_open_long` | משרה פתוחה > 60 ימים | hiring_manager, admin | warning |
| `recruiter_inactive` | recruiter לא נכנסה למערכת 3+ ימים | recruiter (עצמה), admin | warning |
| `new_application` | מועמד חדש הוגש למשרה | recruiter, hiring_manager (של אותה משרה) | info |
| `stage_advanced` | מועמד התקדם שלב | recruiter | info |
| `hire_completed` | קליטה הושלמה | recruiter, hiring_manager, hr | success |
| `start_date_approaching` | תאריך התחלה בעוד 7 ימים | hr, hiring_manager | info |
| `attrition_recorded` | עזיבה נרשמה ב-DB | hr, admin | info |
| `headcount_gap` | gap > 10% בחטיבה | hr, admin | warning |
| `diversity_warning` | diversity ratio ירד מתחת לסף | hr, admin | warning |
| `quality_score_low` | quality score ירד מתחת ל-70 | admin | warning |
| `batch_ingest_failed` | קליטת batch נכשלה | admin | critical |
| `budget_overrun` | חריגת תקציב לקטגוריה | admin, hr | warning |
| `admin_broadcast` | הודעה ידנית מ-Admin | configurable | info/warning |

---

## 4. UI חדשים שצריך לבנות

### 4.1 `/admin` → ⚙️ הגדרות → סאב-טאב **"שליחת התראות"** (חדש)

טופס לאדמין:
```
┌──────────────────────────────────────────────────────────┐
│ 🔔 שלח התראה ידנית                                       │
├──────────────────────────────────────────────────────────┤
│ קהל יעד: ⦿ כל המגייסות    ⦿ כל המנהלים                  │
│           ⦿ כל ה-HR        ⦿ משתמש ספציפי [dropdown]    │
│           ⦿ Custom: tag-based [להוסיף tags]            │
│                                                          │
│ קטגוריה: [admin_broadcast ▼]                            │
│ חומרה:    ⦿ Info  ⦿ Warning  ⦿ Critical                │
│ ערוצים:   ☑ In-app  ☐ Email  ☐ Browser push           │
│                                                          │
│ הודעה (RTL, תומך emoji):                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│ Action URL (אופציונלי): [_________________]            │
│                                                          │
│ [תצוגה מקדימה] [שלח עכשיו] [תזמן ל-______]            │
└──────────────────────────────────────────────────────────┘
```

ה-Admin רואה לוג של כל ההתראות ששלח, כולל read rates.

### 4.2 `/settings/notifications` (חדש, accessible לכל user)

מטריקס קטגוריה × ערוץ:
```
                    In-App   Email   Browser Push   תדירות
SLA / מועמד תקוע      ☑        ☐         ☑          Realtime
SLA / הצעה תלויה      ☑        ☑         ☑          Realtime
מועמד חדש             ☑        ☐         ☐          Daily Digest
batch failed          ☑        ☑         ☐          Realtime
admin broadcast       ☑        ☑         ☑          Realtime
...
```

כפתור "הפעל Push בדפדפן" → triggers `Notification.requestPermission()` + רישום ב-`push_subscriptions`.

### 4.3 Bell Dropdown (קיים) — שיפורים
- חלוקה לפי קטגוריה (📌 דחוף / 📅 היום / ✅ ארכיון)
- כפתור "סמן הכל כנקרא"
- חיפוש בתוך התראות
- לחיצה על התראה → גם מסמנת as read וגם מעבירה ל-`action_url`

---

## 5. ערוצי שליחה (Channels)

### 5.1 In-app (קיים — Bell Dropdown)
✅ ממומש. `notifications` table → `/api/notifications/me`.

### 5.2 Email
**שלב 1 (Easy):** Resend / SendGrid API. כל התראה נשלחת בנפרד.
**שלב 2 (Better):** Daily digest — סקריפט שרץ ב-8:00 כל בוקר, מקבץ כל התראות `digest_freq='daily'` מ-24 השעות האחרונות, ושולח מייל אחד מסכם.

תבנית בעברית עם דגלי חומרה צבעוניים.

### 5.3 Browser Push (Web Push API)
**מפתח לקריטריון "תזכורת למגייסת להיכנס למערכת":**

```typescript
// frontend
const reg = await navigator.serviceWorker.register('/sw.js');
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_PUBLIC_KEY,
});
await fetch('/api/notifications/push/subscribe', {
  method: 'POST', credentials: 'include',
  body: JSON.stringify(sub),
});
```

```python
# backend (using pywebpush)
from pywebpush import webpush
webpush(
    subscription_info={...},
    data=json.dumps({"title": "Phoenix", "body": msg, "url": action_url}),
    vapid_private_key=VAPID_PRIVATE_KEY,
    vapid_claims={"sub": "mailto:admin@fnx.co.il"},
)
```

ה-`sw.js` מטפל ב-`push` event:
```javascript
self.addEventListener('push', e => {
  const data = e.data.json();
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/logo.png',
    data: { url: data.url }, dir: 'rtl', lang: 'he',
  }));
});
```

**זה הפתרון:** גם כשהמערכת סגורה, ה-OS דוחף notification → המגייסת רואה toast → לוחצת → המערכת נפתחת לדף הנכון.

### 5.4 Outlook / Teams (אופציונלי, שלב 3)
דרך MS Graph API. נדרש OAuth setup. נתון לארגון.

---

## 6. Roadmap הטמעה — 3 גלים

### גל 1 (1-2 שבועות) — תשתית בסיסית
- [ ] DB migrations (`notification_preferences`, `push_subscriptions`, `notifications` columns)
- [ ] Backend: `GET/PUT /api/notifications/preferences` — קריאה ועדכון העדפות
- [ ] Frontend: `/settings/notifications` עמוד עם המטריקס
- [ ] Backend: `notification.category` נכתב על כל insert
- [ ] Frontend: BellDropdown מציג category badge

### גל 2 (1-2 שבועות) — Email + Admin push
- [ ] Email integration (Resend/SendGrid)
- [ ] Daily digest job (Cron — או cron MCP)
- [ ] Admin UI: `/admin?group=settings&sub=notifications` form ידני לשליחה
- [ ] templates HTML/RTL בעברית

### גל 3 (2-3 שבועות) — Browser Push
- [ ] VAPID keys (one-time setup)
- [ ] `/sw.js` service worker
- [ ] `/api/notifications/push/subscribe` + `/unsubscribe`
- [ ] Browser permission prompt + onboarding UX
- [ ] `webpush` library integration ב-backend
- [ ] Cron MCP: שעה 8 כל בוקר → push לכל מגייסת שיש לה > 5 התראות ולא נכנסה היום

---

## 7. Cron MCP — תרחיש "תזכורת למגייסת"

הסיפור שביקשת:

> "תזכורת למגייסת להיכנס למערכת"

המימוש:
1. **Cron MCP task יומי 08:00**: סקריפט שבודק לכל recruiter: האם `last_login_at` > 18 שעות AND `unread_notifications > 5`?
2. אם כן: שלח push notification:
   - **כותרת:** "Phoenix מחכה לך"
   - **גוף:** "יש לך 7 התראות חדשות. 2 דחופות (SLA)."
   - **action_url:** `/?focus=alerts`
3. המגייסת לוחצת על הtoast במחשב/טלפון → הדפדפן נפתח ל-Phoenix → היא רואה את ה-7 התראות מיד.

זה עובד **גם כשהדפדפן סגור** כל עוד ה-service worker רשום. ב-mobile, זה כמו push של אפליקציה רגילה.

---

## 8. הרשאות ואבטחה

- **`GET /api/notifications/me`** — רק המשתמש שלו עצמו (כבר ממומש)
- **`POST /api/admin/notifications/send`** — admin only (כבר ממומש)
- **`POST /api/notifications/push/subscribe`** — כל user מחובר; חייב להיות subscription רק לעצמו
- **`GET/PUT /api/notifications/preferences`** — רק על העדפות שלו עצמו
- **Cron MCP scans (`/api/sla/scan`, `/api/admin/check-inactive-recruiters`)** — admin only או system-only token

---

## 9. עלויות וסיכונים

| פריט | עלות חודשית | סיכון |
|------|-------------|--------|
| Email (Resend) | ~$20 ל-50K emails | low |
| Web Push | free | low (delivery לא 100% מובטח) |
| MS Graph (Teams) | free if ב-tenant | medium (OAuth setup) |
| Cron MCP scans | minimal | low |

**סיכון UX:** spam של notifications → preferences UI חייב להיות מוכן לפני שמדליקים email/push, אחרת users מבטלים את הסכמה.

---

## 10. KPIs להצלחה

- 80% מהמגייסות מסכימות ל-browser push בשבוע הראשון
- < 5% של "unsubscribe all"
- ירידה של 30% בזמן תגובה ל-SLA breaches
- 95% של critical alerts נקראים תוך שעה

---

## פתוחים להחלטה

1. **ספק email** — Resend (פשוט) או SendGrid (corporate)?
2. **Web Push VAPID keys** — מי מגנרר ושומר? (admin → env var)
3. **Daily digest שעה** — 8:00? 9:00? מתואם לתרבות הצוות?
4. **Push permission prompt** — אקטיבי מהיום הראשון, או onboarding נפרד?
5. **Mobile** — האם הפיתוח כולל PWA install prompt? (שיווי-משקל בין reach לבין UX)
