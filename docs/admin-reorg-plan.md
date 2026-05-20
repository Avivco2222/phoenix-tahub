# תכנון ארגון `/admin` — מ-7 טאבים שטוחים ל-3 קבוצות

## הבעיה

כיום `/admin` מציג 7 טאבים בשורה אחת, כולם באותה רמת היררכיה:

| # | TabId | תווית | תפקיד עיקרי |
|---|-------|------|-------------|
| 1 | `data` | ניהול דאטה (Live Dropzones) | העלאת 7 סוגי קבצים |
| 2 | `rules` | אזור הסגר ומדיניות טיוב | חוקי קווארנטינה ETL |
| 3 | `batches` | היסטוריית אצוות | רשימת batches + revert |
| 4 | `quality` | בקרת איכות | rejected_rows browser |
| 5 | `consumer-map` | מפת צריכת נתונים | אילו דשבורדים צורכים אילו טבלאות |
| 6 | `analytics` | מעקב ביצועים (AI Inbox) | התראות + KPIs טכניים |
| 7 | `targets` | יעדים ואוטומציות | KPI formulas + rules + visibility |

**בעיות:**
- שורה ארוכה של 7 טאבים — לא נקלטת ב-glance
- אין הבחנה בין "פעולה יומית" (העלאת קבצים) ל-"הגדרה חד-פעמית" (יעדים, חוקים)
- שמות מילוליים ארוכים — "אזור הסגר ומדיניות טיוב" קריא רק אחרי שיודעים מה זה
- כפתור "ניהול הרשאות ומשתמשים" מנותק כ-link חיצוני — לא חלק מהטופולוגיה

## המבנה החדש — 3 קבוצות

```
┌────────────────────────────────────────────────────────────────┐
│  /admin                                                        │
│  ┌──────────────┬──────────────────┬─────────────────────┐    │
│  │   📥 דאטה    │   ⚙️ הגדרות      │   📊 ביצועים        │    │
│  ├──────────────┼──────────────────┼─────────────────────┤    │
│  │ • Dropzones  │ • יעדים ו-KPIs   │ • מעקב ביצועים      │    │
│  │ • היסטוריה   │ • חוקי טיוב      │ • מפת צריכה         │    │
│  │ • בקרת איכות │ • הרשאות         │                     │    │
│  └──────────────┴──────────────────┴─────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

### קבוצה 1: 📥 דאטה (זרימה יומית)
המשתמש נכנס לפה כדי **לעשות משהו עכשיו** — להעלות, לבדוק, לתקן.

| Sub-tab | תוכן | מקור היום |
|---------|------|-----------|
| **קליטה** (default) | 7 dropzones + diff mode | `data` |
| **היסטוריית אצוות** | רשימת batches + revert | `batches` |
| **בקרת איכות** | rejected_rows + reasons | `quality` |

### קבוצה 2: ⚙️ הגדרות (תצורה חד-פעמית)
המשתמש נכנס לפה כדי **להגדיר התנהגות** — חוקים, יעדים, מי רואה מה.

| Sub-tab | תוכן | מקור היום |
|---------|------|-----------|
| **יעדים ו-KPIs** | formulas + rules + visibility + thresholds | `targets` |
| **חוקי טיוב** | קווארנטינה + transformation rules | `rules` |
| **הרשאות ומשתמשים** | רשימת משתמשים + role assignment | link → `/admin/permissions` |

### קבוצה 3: 📊 ביצועים (תצפיתיות)
המשתמש נכנס לפה כדי **להבין את המערכת** — מה זז, מה נצרך, מה אנומלי.

| Sub-tab | תוכן | מקור היום |
|---------|------|-----------|
| **AI Inbox** (default) | התראות + KPI deltas | `analytics` |
| **מפת צריכת נתונים** | data lineage / consumer map | `consumer-map` |

---

## איך זה נראה ב-UI

### Top-level: 3 כפתורי-קבוצה גדולים (לא טאבים מינימליסטיים)
```tsx
<div className="grid grid-cols-3 gap-3">
  <GroupCard
    id="data"
    icon={<Download size={28}/>}
    title="דאטה"
    subtitle="קליטה • היסטוריה • איכות"
    badge={pendingBatches}  // אם יש batches חדשות
    active={group === "data"}
  />
  <GroupCard id="settings" icon={<Settings size={28}/>} title="הגדרות"
             subtitle="יעדים • חוקים • הרשאות" />
  <GroupCard id="performance" icon={<Activity size={28}/>} title="ביצועים"
             subtitle="AI Inbox • מפת צריכה" />
</div>
```

### תוך כל קבוצה: שורת sub-tabs דקה
```tsx
<div className="border-b border-slate-200 mt-6">
  <div className="flex gap-1">
    <SubTab id="ingest" active={subtab} label="קליטה" badge={liveBatchCount} />
    <SubTab id="batches" active={subtab} label="היסטוריית אצוות" />
    <SubTab id="quality" active={subtab} label="בקרת איכות" badge={rejectedCount} />
  </div>
</div>
```

### state ב-URL
`?group=data&sub=ingest` — שמירה ב-URL ל-deep-link וריענון ידידותי.

---

## רווחים מצופים

1. **scan-ability**: 3 קבוצות → 7 sub-tabs מפוזרים. אדמין רואה בפעם הראשונה ומבין את המבנה.
2. **mental model**: "מה אני רוצה לעשות עכשיו?" → קבוצה. ואז "איזה חלק?" → sub-tab. שני צעדים נקיים במקום "לזכור מאיפה הגעתי".
3. **badges חיים בקבוצה**: ה-GroupCard מציג badge ("3 batches ממתינים", "5 חוקים מופרים") → תשומת לב נמשכת לקבוצה הנכונה.
4. **גידול עתידי**: הוספת tab חדש (למשל "Audit Trail" או "Export Center") נכנסת לקבוצה הנכונה בלי להגדיל את השורה הראשית.

---

## קבצים שיווצרו / ישונו

### חדשים
- `phoenix-dashboard/src/app/admin/components/AdminShell.tsx` — קומפוננטה אחת שמנהלת group + sub-tab state, מכילה את GroupCard ו-SubTab
- `phoenix-dashboard/src/app/admin/components/PermissionsTab.tsx` — wrapper שמטעין את התוכן הקיים מ-`/admin/permissions/page.tsx` בתוך טאב (במקום link חיצוני). השארת `/admin/permissions` כראוטר ידי-עוטף לתאימות לאחור.

### ישונו
- `phoenix-dashboard/src/app/admin/page.tsx` — שכתוב של JSX הנווט בלבד:
  - הסרת השורה של 7 ה-TabNav (lines 491-497)
  - הסרת ה-Link החיצוני להרשאות (lines 499-505)
  - הוספת `<AdminShell>` שעוטף את ה-`{activeTab === ...}` הקיימים
  - מיפוי old activeTab → group/sub:
    ```ts
    const TAB_MAP = {
      data: ["data", "ingest"],
      batches: ["data", "batches"],
      quality: ["data", "quality"],
      targets: ["settings", "targets"],
      rules: ["settings", "rules"],
      permissions: ["settings", "permissions"],
      analytics: ["performance", "inbox"],
      "consumer-map": ["performance", "consumer-map"],
    };
    ```

### לא נוגעים
- כל ה-tab content blocks (DropzoneTile, BatchesTab, QualityTab, ConsumerMapTab, TargetsTab) — המרכיבים נשארים זהים, רק הניווט אליהם משתנה.
- `/admin/permissions/page.tsx` — נשאר כראוטר עצמאי + נטען גם בתוך הטאב.
- `/admin/security` — נשאר עצמאי (כניסה ייעודית עם re-auth, ראה task #2).

---

## עלות / זמן

- **אומדן**: 2-3 שעות
- **סיכון**: נמוך. אין שינוי לוגיקה, רק re-shuffle של JSX wrapper.
- **בדיקות נדרשות**:
  - כל 7 ה-content blocks ממשיכים להיטען נכון
  - URL state נשמר אחרי refresh
  - badges מוצגים נכון בקבוצות
  - deep-link `?group=settings&sub=targets` עובד

---

## פתוח להחלטה

1. האם להציג את ה-GroupCards כקלפים גדולים תמיד, או רק כשורה דקה אחרי הבחירה הראשונה? (המלצה: גדולים תמיד — visual anchor)
2. האם להוסיף קבוצה רביעית "🔐 אבטחה" שתכלול את `/admin/security` (re-auth) ועוד דברים עתידיים? (כרגע security חי לבד; אפשר להשאיר ככה כי הוא דורש re-auth)
3. שמות הקבוצות — "דאטה / הגדרות / ביצועים" מקובלים? אלטרנטיבות: "קליטה / תצורה / תצפיתיות" או "Operate / Configure / Observe" (תרגום אופייני לעולם DevOps)
