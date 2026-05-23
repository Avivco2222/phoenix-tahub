# מדריך מדדים — Phoenix Talent OS

**מסמך זה משרת מגייסות, HRBPs ומנהלי גיוס** — לכל בלוק במערכת מוסבר מה הוא מודד, איך זה נמדד, ולמה זה רלוונטי ל-day-to-day. בנוסף, לכל בלוק יש הפניה מדויקת לקובץ + שורה בקוד כדי שמהנדס שירצה לרדת לעומק יוכל למצוא את המקור בלי לחפש.

## תוכן עניינים

1. [מבט על — Overview Dashboard (`/`)](#1-מבט-על-overview-dashboard)
   1. [סה״כ קליטות בפועל](#11-סהכ-קליטות-בפועל)
   2. [סה״כ עזיבות (Attrition)](#12-סהכ-עזיבות-attrition)
   3. [סה״כ קורות חיים](#13-סהכ-קורות-חיים)
   4. [יחס המרה (E2E Conversion)](#14-יחס-המרה-e2e-conversion)
   5. [זמן איוש ממוצע (TTF)](#15-זמן-איוש-ממוצע-ttf)
   6. [אחוז חתימת חוזים (OAR)](#16-אחוז-חתימת-חוזים-oar)
   7. [עלות ממוצעת לאיוש (CPH)](#17-עלות-ממוצעת-לאיוש-cph)
   8. [מועמדים בסיכון (Ghosting)](#18-מועמדים-בסיכון-ghosting)
   9. [איכות הגיוס (Quality of Hire) ⏳ עתידי](#19-איכות-הגיוס-quality-of-hire--עתידי)
   10. [משפך המרות (Funnel)](#110-משפך-המרות-funnel)
   11. [מקורות אסטרטגיים (Strategic Sources)](#111-מקורות-אסטרטגיים-strategic-sources)
   12. [סיבות עזיבת עובדים](#112-סיבות-עזיבת-עובדים)
   13. [סיבות דחיית מועמדים / הסרת מועמדות ⏳ עתידי](#113-סיבות-דחיית-מועמדים-הסרת-מועמדות--עתידי)
2. [תובנות ותחזיות — Intelligence (`/intelligence`)](#2-תובנות-ותחזיות-intelligence)
   1. [זמן איוש ממוצע (TTF)](#21-זמן-איוש-ממוצע-ttf)
   2. [שיעור קיבול הצעות (OAR)](#22-שיעור-קיבול-הצעות-oar)
   3. [שיעור ניוד פנימי](#23-שיעור-ניוד-פנימי)
   4. [שיעור עזיבה מוקדמת](#24-שיעור-עזיבה-מוקדמת)
   5. [מפת חום עזיבות (Attrition Heatmap)](#25-מפת-חום-עזיבות-attrition-heatmap)
   6. [מעקב עומס מגייסות (Capacity Tracker)](#26-מעקב-עומס-מגייסות-capacity-tracker)
   7. [רדאר Ghosting](#27-רדאר-ghosting)
3. [דוח שליטה — Headcount (`/headcount`)](#3-דוח-שליטה-headcount)
   1. [חריגת מצבה — תקן מול בפועל](#31-חריגת-מצבה-תקן-מול-בפועל)
   2. [דלת מסתובבת](#32-דלת-מסתובבת)
   3. [עזיבות](#33-עזיבות)
   4. [קליטות בתקופה](#34-קליטות-בתקופה)
   5. [משרות פעילות](#35-משרות-פעילות)
   6. [מטריצת תקינה](#36-מטריצת-תקינה)
4. [ניהול תקציב — Budget (`/budget`)](#4-ניהול-תקציב-budget)
   1. [ניצול תקציב מול יעד כללי](#41-ניצול-תקציב-מול-יעד-כללי)
   2. [התפלגות קטגוריות](#42-התפלגות-קטגוריות)
   3. [קצב שריפת תקציב (Run Rate)](#43-קצב-שריפת-תקציב-run-rate)
5. [מילון מונחים](#5-מילון-מונחים)

---

## 1. מבט על — Overview Dashboard

**Route:** `/` · **קובץ:** `phoenix-dashboard/src/app/page.tsx` · **Endpoint מרכזי:** `GET /api/dashboard/metrics` (`backend/routers/metrics.py:75`)

הדף הראשי. KPIs ברמת ארגון מלא, עם slicers (timeframe / department / recruiter) שמשנים את כל המספרים בו-זמנית.

### 1.1 סה״כ קליטות בפועל
- **מה זה מודד:** כמה מועמדים חתמו על חוזה (סטטוס "קליטה", "גיוס", או "התקבל") בתקופה שנבחרה.
- **למה זה חשוב לך:** המספר הכי טהור של הצלחת הגיוס. עליו נבחנים יעדי רבעון.
- **מקור נתונים:** טבלת `applications` ב-SQLite, עמודת `status`.
- **נוסחה:**
  ```
  COUNT(*) FROM applications
    WHERE status LIKE '%קליטה%' OR status LIKE '%גיוס%' OR status LIKE '%התקבל%'
    AND start_date BETWEEN period_start AND period_end
  ```
- **קוד:** `backend/routers/metrics.py:115` (`hired_df`)
- **תווית משנית:** `±X% מול שנה שעברה` — דלתא ל-YoY (`metrics.hires_yoy_pct`). כשטווח הזמן הוא "הכל" — חיווי זה מוסתר (אין השוואה משמעותית).

### 1.2 סה״כ עזיבות (Attrition)
- **מה זה מודד:** כמה עובדים עזבו את הארגון בתקופה.
- **למה זה חשוב לך:** מאזן את הקליטות. אם אתה קולט 50 ועוזבים 60 — המצבה קטנה בפועל.
- **מקור נתונים:** טבלת `attrition_events`.
- **נוסחה:**
  ```
  COUNT(*) FROM attrition_events
    WHERE leave_date BETWEEN period_start AND period_end
  ```
- **קוד:** `backend/routers/metrics.py:178` (`attrition_total`)

### 1.3 סה״כ קורות חיים
- **מה זה מודד:** סך כל המועמדים הפעילים שהוגשו למערכת (כולל אלו שכבר אוישו/נדחו).
- **למה זה חשוב לך:** נפח. גם כשהמרה נמוכה, נפח אומר שיש לך גוף נתונים לעשות איתו דברים בעתיד.
- **מקור נתונים:** unified view של `applications × candidates × jobs`.
- **נוסחה:** `COUNT(*)` של ה-unified view אחרי applying filters.
- **קוד:** `backend/routers/metrics.py:111` (`total`)

### 1.4 יחס המרה (E2E Conversion)
- **מה זה מודד:** איזה אחוז מקורות החיים נקלטו בפועל.
- **למה זה חשוב לך:** איכות הסינון. שיעור גבוה = אתה לא מבזבז זמן על מועמדים לא רלוונטיים.
- **נוסחה:**
  ```
  (hires / total_applications) × 100
  ```
- **בנצ'מארק:** השוק עומד על ~0.5% (1 ל-200). שיעור גבוה יותר = ערוצי גיוס איכותיים.
- **קוד:** `backend/routers/metrics.py:124` (`e2e_pct`)

### 1.5 זמן איוש ממוצע (TTF)
- **מה זה מודד:** כמה ימים בממוצע לוקח מפתיחת תקן עד חתימה.
- **למה זה חשוב לך:** "כמה זמן אני מבריא משרה". יעד מקובל: ≤ 40 ימים.
- **מקור נתונים:** עמודת `days_in_process` ב-`applications` לרשומות שסטטוסן קליטה/גיוס/התקבל.
- **נוסחה:**
  ```
  AVG(days_in_process) WHERE status ∈ {קליטה, גיוס, התקבל}
  ```
- **הערה:** **ממוצע** (mean), לא חציון. בעבר התווית כתבה "חציוני" וזה היה לא נכון — תוקן ב-Phase 3B.
- **קוד:** `backend/routers/metrics.py:128` (`avg_days`)

### 1.6 אחוז חתימת חוזים (OAR)
- **מה זה מודד:** מתוך כל המועמדים שהגיעו לשלב הצעת השכר, איזה אחוז חתמו.
- **למה זה חשוב לך:** מדד תחרותיות שכר. OAR נמוך = הצעות השכר שלך לא תחרותיות.
- **נוסחה (קירוב — ראה למטה):**
  ```
  OAR = hired / (hired + offers_pending + rejected) × 100
      = התקבל / (התקבל + הצעה + נדחה) × 100
  ```
- **למה "קירוב":** ה-DB מחזיק רק את הסטטוס הנוכחי של כל אפליקציה — אין היסטוריית מעברים. לכן "נדחה" יכול לכלול גם דחיות בשלב הסינון, לא רק אחרי הצעה. המספר נוטה כלפי מטה. **שיפור עתידי:** טבלת `application_status_history` עם timestamps.
- **בנצ'מארק:** 80% הוא יעד סביר. מתחת לזה = לבדוק שכר מול שוק.
- **קוד:** `backend/routers/metrics.py:125-126` (`oar_pct`)

### 1.7 עלות ממוצעת לאיוש (CPH)
- **מה זה מודד:** כמה כסף בממוצע אנחנו משלמים לכל איוש (פרסום, השמה, רישיונות).
- **למה זה חשוב לך:** ROI של הגיוס. אם CPH של LinkedIn = ₪10K אבל של Referral = ₪3K — תזיז תקציב.
- **מקור נתונים:** `finops_invoices.amount` (sum) חלקי `hires` count.
- **נוסחה:**
  ```
  CPH = SUM(finops_invoices.amount in period) / COUNT(hires in period)
  ```
- **הערה:** כרגע כל החשבוניות נכללות (לא רק "פרסום/גיוס"). מסנן קטגוריות יתווסף ברגע שמיפוי הקטגוריות יציב.
- **קוד:** `backend/routers/metrics.py:171` (`cph`)

### 1.8 מועמדים בסיכון (Ghosting)
- **מה זה מודד:** מועמדים פעילים שתקועים יותר מ-14 ימים בלי תזוזת סטטוס.
- **למה זה חשוב לך:** רשימת "טפל בי עכשיו". כל מועמד כאן הוא מועמד שעלול לוותר אם לא תזיז אותו.
- **חשוב:** זה **שונה** מ-SLA — SLA בודק אם המגייסת חרגה (29 יום למוקדים, 44 לאחרים). Ghosting בודק אם המועמד תקוע.
- **נוסחה:**
  ```
  COUNT(*) WHERE is_active = TRUE AND days_in_process > 14
  ```
- **קוד:** `backend/routers/metrics.py:140-141` (`ghosting_count`)

### 1.9 איכות הגיוס (Quality of Hire) ⏳ עתידי
- **מה זה מודד:** אחוז המגויסים שנשארו בארגון מעל שנה.
- **למה זה חשוב לך:** הגביע הקדוש של הגיוס. גם 200 קליטות לא שוות הרבה אם 80% עוזבים בתוך שנה.
- **למה ⏳:** דורש סנכרון עם HRIS — נתוני ביצועי עובד 6/12 חודשים אחרי הקליטה.
- **הצעה לעתיד:** integration לפי `candidate_id` → `employee_id` → טבלת `performance_reviews`.
- **קוד (Placeholder + FutureBadge):** `phoenix-dashboard/src/app/page.tsx:646-651`

### 1.10 משפך המרות (Funnel)
- **מה זה מודד:** כמה מועמדים בכל שלב — קורות חיים → סינון → ראיון → הצעה → קליטה.
- **למה זה חשוב לך:** "איפה המעמדים נופלים". אם 90% נשירה בסינון = פתח קריטריונים. אם 60% נשירה בהצעה = שכר.
- **מקור נתונים:** ספירות text-match על `applications.status`.
- **נוסחה:**
  ```
  for each stage in [קורות חיים, סינון, ראיון, הצעה, קליטה]:
      stage_count = COUNT(*) WHERE status LIKE '%<stage_pattern>%'
      stage_percentage = (stage_count / total_applications) × 100
  ```
- **קוד:** `backend/routers/metrics.py:143-153`

### 1.11 מקורות אסטרטגיים (Strategic Sources)
- **מה זה מודד:** לכל מקור (ניוד פנימי / חבר מביא חבר / לינקדאין): כמה CVs באו ממנו וכמה מהם נקלטו.
- **למה זה חשוב לך:** ROI לפי ערוץ. הזז תקציב לערוץ עם הכי הרבה קליטות יחסית ל-CVs.
- **מקור נתונים:** `candidates.source` (group-by).
- **נוסחה:** לכל מקור: `cvs = COUNT(*)` ו-`hires = COUNT(*) WHERE status ∈ {hired}`.
- **קוד:** `backend/routers/metrics.py:154-167` (`sources_breakdown`)

### 1.12 סיבות עזיבת עובדים
- **מה זה מודד:** Top-5 הסיבות שעובדים שאת/ה גייסת עזבו.
- **למה זה חשוב לך:** איכות הציפיות שאת/ה יוצר/ת בראיון. "שכר" שמופיע ב-Top-3 = בעיית compensation. "שינוי קריירה" = בעיית fit.
- **מקור נתונים:** `attrition_events.reason`.
- **נוסחה:**
  ```sql
  SELECT reason, COUNT(*) FROM attrition_events
    WHERE leave_date BETWEEN start AND end
    GROUP BY reason ORDER BY COUNT(*) DESC LIMIT 5
  ```
- **קוד:** `backend/routers/metrics.py:185-194` (`attrition_reasons`)

### 1.13 סיבות דחיית מועמדים / הסרת מועמדות ⏳ עתידי
- **למה ⏳:** ה-schema הנוכחי מחזיק רק status, לא reason. דורש:
  - הוספת שדה `rejection_reason` / `withdrawal_reason` ל-`applications`.
  - עדכון מסך עריכת מועמד שיכריח את המגייסת לתייג סיבה בעת שינוי סטטוס.
- **קוד (FutureBadge):** `phoenix-dashboard/src/app/page.tsx:801-811`

---

## 2. תובנות ותחזיות — Intelligence

**Route:** `/intelligence` · **קובץ:** `phoenix-dashboard/src/app/intelligence/page.tsx` · **Endpoints:** `GET /intelligence` + `GET /api/dashboard/metrics` + `GET /api/intelligence/extended`

מסך אנליטיקה מעמיק יותר. ל-HRBP / ADMIN בלבד. מציג את אותם KPIs כמו במבט-על, אך עם פירוקים נוספים (heatmap, capacity).

### 2.1 זמן איוש ממוצע (TTF)
זהה ל-§1.5 (אותו `metrics.avg_days_to_hire`).

### 2.2 שיעור קיבול הצעות (OAR)
זהה ל-§1.6. **הערה ל-history:** הנוסחה הקודמת ב-Intelligence הייתה `hires / (hires + ghosting)` — שגויה כי ghosting ≠ rejected offer. תוקנה ב-Phase 3C.

### 2.3 שיעור ניוד פנימי
- **מה זה מודד:** איזה אחוז מהקליטות הגיעו מתוך הארגון.
- **למה זה חשוב לך:** מדד שימור + מוטיבציה. ניוד פנימי גבוה = הארגון מאפשר צמיחה.
- **מקור נתונים:** `candidates.source = 'Internal'` (case-insensitive).
- **נוסחה:**
  ```
  internal_mobility = internal_hires / total_hires × 100
  ```
- **יעד:** 15% (מקובל בשוק).
- **קוד:** `backend/routers/metrics.py:149-152` (`internal_mobility_pct`)

### 2.4 שיעור עזיבה מוקדמת
- **מה זה מודד:** מתוך עזיבות עם נתוני ותק — איזה אחוז עזב תוך < 12 חודשי העסקה.
- **למה זה חשוב לך:** עזיבה מוקדמת = או שאת/ה גייסת לא מתאים, או שהארגון לא קלט נכון. שני מקרים שאת/ה אחראית להם.
- **מקור נתונים:** join של `attrition_events` עם `hires` לפי שם (case-insensitive).
- **נוסחה:**
  ```
  tenure_days = leave_date - hire_date
  early_attrition_pct = COUNT(tenure_days < 365) / total_attrition_with_tenure × 100
  ```
- **הערה לדמו:** נתוני הדמו הנוכחיים אין להם חפיפה בין hires לattrition לפי שם, אז הערך הוא 0%. הקוד נכון; ברגע שהנתונים האמיתיים יזרמו עם candidate_id מקושר — ימולא אוטומטית.
- **קוד:** `backend/routers/metrics.py:255-264` (`early_attrition_pct`)

### 2.5 מפת חום עזיבות (Attrition Heatmap)
- **מה זה מודד:** מטריצה של חטיבה × bucket-של-ותק (0-3m / 3-6m / 6-12m / 1-2y). ככל שהתא אדום יותר, יותר עזיבות באותו bucket באותה חטיבה.
- **למה זה חשוב לך:** מגלה דפוסי עזיבה: "כולם עוזבים אחרי 3-6 חודשי הכשרה" → בעיית אונבורדינג. "כל R&D עוזב אחרי שנה" → בעיית compensation.
- **מקור נתונים:** אותו join כמו §2.4.
- **קוד:** `backend/routers/metrics.py:267-284` + `phoenix-dashboard/src/app/intelligence/page.tsx:373-388`

### 2.6 מעקב עומס מגייסות (Capacity Tracker)
- **מה זה מודד:** לכל מגייסת — כמה תיקים פעילים יש לה, ומה הממוצע ימי תהליך.
- **למה זה חשוב לך:** מניעת שחיקה + חלוקת משאבים. מגייסת עם 25 תיקים פעילים = להעביר חלק.
- **מקור נתונים:** group-by על `applications` פעילות לפי `recruiter`.
- **נוסחה לתיקים פעילים:** `COUNT(applications) WHERE recruiter = X AND is_active = TRUE`.
- **הערה:** פירוק לפי סוג משרה (Mass/Pro/Tech) הוא ⏳ עתידי — דורש שדה `role_type` ב-`jobs` שעוד לא קיים.
- **קוד:** `backend/routers/metrics.py:288-305` (`recruiter_capacity`)

### 2.7 רדאר Ghosting
זהה ל-§1.8, אבל מציג את הרשימה הפרטנית (top 8 מועמדים) ולא רק את הספירה.

---

## 3. דוח שליטה — Headcount

**Route:** `/headcount` · **קובץ:** `phoenix-dashboard/src/app/headcount/page.tsx` · **Endpoint:** `GET /api/headcount` + `GET /api/dashboard/metrics`

מסך אדמיניסטרציה למיפוי תקני מצבה (Standard) מול בפועל (Current).

### 3.1 חריגת מצבה — תקן מול בפועל
- **מה זה מודד:** היחידה עם הסטייה הגדולה ביותר בין תקן מצבה ל-בפועל.
- **למה זה חשוב לך:** מיקוד פעולה. "ב-R&D Backend חוסר 5 אנשים" = להזיז משאבי גיוס לשם.
- **מקור נתונים:** `headcount_snapshots` (היחידה והחטיבה עם הגאפ הגדול ביותר).
- **נוסחה:**
  ```
  for each row in headcount_snapshots:
      gap = standard - current
  worst = row with MAX(|gap|)
  ```
- **קוד:** `phoenix-dashboard/src/app/headcount/page.tsx:246-261` (computed in-component)

### 3.2 דלת מסתובבת (Revolving Door)
- **מה זה מודד:** % עזיבות מתוך תקן מצבה, ממוצע על כל היחידות.
- **למה זה חשוב לך:** אינדיקטור לתקינות הצוות. אם הדלת מסתובבת ב-30% — יש בעיית retention רחבה.
- **נוסחה:**
  ```
  per unit: volatility = attrition_ytd / standard × 100
  avgVolatility = AVG(volatility across all units)
  ```
- **קוד:** `phoenix-dashboard/src/app/headcount/page.tsx:89-92`

### 3.3 עזיבות
- סך כל ה-`attrition_ytd` על פני כל יחידות ה-`headcount_snapshots`.
- **קוד:** `phoenix-dashboard/src/app/headcount/page.tsx:138`

### 3.4 קליטות בתקופה
- **מה זה מודד:** סך הקליטות בתקופה (לא רק חודש נוכחי — שונה משם הקודם של התווית).
- **נוסחה:** `hires_in_period` מ-`/api/dashboard/metrics`.
- **קוד:** `phoenix-dashboard/src/app/headcount/page.tsx:286`

### 3.5 משרות פעילות
- **מה זה מודד:** כמה משרות פתוחות יש כרגע. **לא** כולל סגורות.
- **נוסחה:** `COUNT(jobs) WHERE is_active = TRUE`.
- **קוד:** `phoenix-dashboard/src/app/headcount/page.tsx:163-167`

### 3.6 מטריצת תקינה
- **מה זה מודד:** טבלת יחידה → מחלקה → תקן/בפועל/פער/משרות פתוחות/עזיבות.
- **מקור נתונים:** `headcount_snapshots` מסונן לחודש העדכני ביותר.
- **קוד:** `phoenix-dashboard/src/app/headcount/page.tsx:300-355` (rendered as the matrix UI)

---

## 4. ניהול תקציב — Budget

**Route:** `/budget` · **קובץ:** `phoenix-dashboard/src/app/budget/page.tsx` · **Endpoint:** `GET /api/finops/data`

### 4.1 ניצול תקציב מול יעד כללי
- **מה זה מודד:** % ניצול ביחס ליעד.
- **נוסחה:**
  ```
  totalSpend = SUM(mappedInvoices.amount)
  budgetTarget = SUM(categories[].target)
  utilization = (totalSpend / budgetTarget) × 100
  ```
- **הערה:** עד Phase 3C `budgetTarget = 380000` היה hardcoded. עכשיו מחושב כסיכום של כל target-ים של הקטגוריות שניתן לערוך מתוך ה-UI.
- **קוד:** `phoenix-dashboard/src/app/budget/page.tsx:96-105`

### 4.2 התפלגות קטגוריות
- pie chart של הוצאות לפי `category`. נשאב מ-`mappedInvoices.reduce({ category → amount })`.
- **קוד:** `phoenix-dashboard/src/app/budget/page.tsx:286-289`

### 4.3 קצב שריפת תקציב (Run Rate)
- **מה זה מודד:** הוצאה חודשית ממוצעת + תחזית מתי יסתיים התקציב הנוכחי.
- **נוסחה:**
  ```
  monthlyRunRate = totalSpend / monthsElapsed
  monthsLeft = (budgetTarget - totalSpend) / monthlyRunRate
  estimatedEndMonth = current_month + monthsLeft
  ```
- **קוד:** `phoenix-dashboard/src/app/budget/page.tsx:292-298`

---

## 5. מילון מונחים

- **TTF (Time to Fill):** זמן ממוצע מפתיחת תקן עד חתימת חוזה.
- **OAR (Offer Acceptance Rate):** אחוז הצעות שנחתמו מתוך כל ההצעות שהוגשו.
- **CPH (Cost Per Hire):** עלות ממוצעת לכל איוש.
- **E2E Conversion:** קליטות חלקי קורות חיים (End-to-End).
- **Ghosting:** מועמדים תקועים מעל 14 יום בלי תזוזת סטטוס.
- **SLA Breach:** מגייסת חרגה מזמן יעד (29 יום למוקדים, 44 לאחרים).
- **YoY (Year-over-Year):** השוואה לשנה הקודמת.
- **Attrition / Retention:** עזיבות / שימור.
- **Quality of Hire:** איכות הקליטות הנמדדת בעמידה בארגון לאחר שנה.

---

## נספח: בלוקים שמוגדרים "עתידי" — מה דרוש להפעלתם

| בלוק | מה חסר | פיתוח נדרש |
|---|---|---|
| Quality of Hire (§1.9) | אינטגרציית HRIS | join `candidates.id` ↔ HRIS `employee_id` + טבלת `performance_reviews` |
| סיבות דחיה (§1.13) | שדה `rejection_reason` | להוסיף עמודה ל-`applications` + UI שמכריח תיוג בעת שינוי סטטוס ל"נדחה" |
| סיבות הסרת מועמדות (§1.13) | שדה `withdrawal_reason` | אותו רעיון; עמודה נוספת + UI |
| מפת חום עזיבות (§2.5) — אדום/ירוק | סף השוואה היסטורי | חישוב ממוצע חברה לשנים קודמות = בנצ'מארק לתאים |
| Capacity Tracker — פירוק mass/pro/tech (§2.6) | טאקסונומיית `role_type` ב-`jobs` | להוסיף enum + מילון מיפוי משם המשרה לקטגוריה |

---

**עדכון אחרון:** Phase 3D של מסע ה-audit. כל בלוק עבר verification של פורמולה + מקור נתונים. בעיות תוויתיות (כמו "חציוני" → "ממוצע") תוקנו. מספרים שדורשים מקור חיצוני סומנו במפורש בכתום (`עתידי`).
