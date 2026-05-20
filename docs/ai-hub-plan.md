# תכנון `/ai-hub` — ארגון + פיצ'רים חדשים

## מצב נוכחי

4 טאבים בשורה, ללא קיבוץ:

| TabId | תווית | מה הוא עושה |
|-------|------|-------------|
| `whisperer` | Briefly | Manager Whisperer — תובנות ניהוליות |
| `mobility` | סימולטור שכר וניוד | מחשבון ניוד פנימי |
| `onboarding` | קליטת עובד | Smart Onboarding wizard |
| `reports` | מחולל דוחות AI | יצירת PDFs |

**בעיות:**
- אין מודל מנטלי משותף — Briefly וקליטה הם שני עולמות שונים
- אין הפרדה בין כלים שעוזרים **לפני הקליטה** (סקרינינג, רשימות), **בתהליך** (תובנות, simulator) ו-**אחרי קליטה** (onboarding)
- אין כלי ל-CV analysis למרות שזה הבקשה הכי שכיחה ממגייסים
- אין "ארגז כלים" בולט שמזמין מגייס/מנהל להשתמש בו ברגע הנכון

---

## ארגון חדש — 4 קטגוריות לפי שלב במחזור הגיוס

```
┌──────────────────────────────────────────────────────────────────┐
│  /ai-hub — ארגז כלים חכם                                          │
│                                                                  │
│  🔍 לפני קליטה     💬 בתהליך       📋 בקליטה      📊 ניתוח     │
│  ─────────────    ──────────      ────────       ────────       │
│  • CV Analyzer   • Briefly       • Onboarding   • Reports       │
│  • Talent Pool   • Mobility Sim  • Welcome Mail • Anomalies     │
│  • Source Mix    • Offer Builder                                │
│  • Questions Bank                                                │
└──────────────────────────────────────────────────────────────────┘
```

### 1. 🔍 לפני קליטה — pre-hire tools

| כלי | קיים? | מה הוא עושה |
|-----|-------|-------------|
| **CV Analyzer** | ❌ חדש | upload PDF/Docx → extract: שם, השכלה, ניסיון, technologies, fit-score מול תיק משרה |
| **Talent Pool Search** | ❌ חדש | semantic search על מועמדים קיימים: "Backend Python ב-Service עם 3+ שנים" → רשימה מדורגת |
| **Source Mix Optimizer** | ❌ חדש | היסטוריית מקורות → המלצה איפה לפרסם משרה חדשה לפי quality+cost+time-to-fill |
| **Interview Questions Bank** | ❌ חדש | בנק שאלות לפי role+stage (טכני/התנהגותי). מועדפות אישיות, היסטוריה לפי מועמד |

### 2. 💬 בתהליך — during-hire tools

| כלי | קיים? | מה הוא עושה |
|-----|-------|-------------|
| **Briefly (Manager Whisperer)** | ✅ קיים | תובנות יומיות למנהל גיוס |
| **Mobility Simulator** | ✅ קיים | חישוב שכר/ניוד פנימי |
| **Offer Letter Builder** | ❌ חדש | טופס + AI generated offer letter בעברית: שכר, benefits, תאריך התחלה |

### 3. 📋 בקליטה — onboarding tools

| כלי | קיים? | מה הוא עושה |
|-----|-------|-------------|
| **Smart Onboarding Wizard** | ✅ קיים | אשף 7-שלבים לקליטת עובד חדש |
| **Welcome Email Generator** | ❌ חדש | AI מייל בעברית: ברוכים הבאים + checklist + יום ראשון |

### 4. 📊 ניתוח — analytics & insights

| כלי | קיים? | מה הוא עושה |
|-----|-------|-------------|
| **Reports Generator** | ✅ קיים | מחולל PDFs |
| **Anomaly Detector** | ❌ חדש | חיפוש אנומליות בנתונים: spike נטישה, drop בהיצע, drift באיכות |

---

## UI החדש

### top-level: 4 כרטיסי-קטגוריה
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <CategoryCard
    id="pre"
    icon={<Search size={32}/>}
    title="לפני קליטה"
    subtitle="CV • Talent Pool • Sources • Questions"
    toolCount={4}
    accent="#3B82F6"
  />
  <CategoryCard id="during" icon={<MessageSquare size={32}/>} title="בתהליך"
                subtitle="Briefly • Mobility • Offer" toolCount={3} accent="#EF6B00"/>
  <CategoryCard id="onboarding" icon={<UserPlus size={32}/>} title="בקליטה"
                subtitle="Wizard • Welcome Mail" toolCount={2} accent="#10B981"/>
  <CategoryCard id="analytics" icon={<BarChart3 size={32}/>} title="ניתוח"
                subtitle="Reports • Anomalies" toolCount={2} accent="#8B5CF6"/>
</div>
```

### בתוך קטגוריה: grid של tool tiles
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
  {tools.map(tool => (
    <ToolTile
      key={tool.id}
      icon={tool.icon}
      title={tool.title}
      description={tool.shortDescription}
      onClick={() => openTool(tool.id)}
      badge={tool.usageCount}
    />
  ))}
</div>
```

### לחיצה על tool → drawer/modal עם התוכן המלא
- כלי קצר (כמו Mobility Simulator): modal
- כלי ארוך (כמו Onboarding wizard): full-page route בתוך `/ai-hub/{tool-id}`

---

## פיצ'רים חדשים — סדר עדיפויות מומלץ

### 🥇 Tier 1 — Quick wins (1-2 ימים כל אחד)
1. **CV Analyzer** — ROI הכי גבוה. מגייסים מבזבזים 80% מהזמן על קריאת CVs.
   - upload → openai/anthropic API → extract structured fields → save to `candidates` + `cv_analyses` table
   - fit-score מול job: עוטף את GPT-4 עם system prompt שמקבל את ה-job description ואת ה-CV
2. **Welcome Email Generator** — מהיר, פשוט, עוזר מהרגע הראשון.
   - input: candidate name, role, start_date, manager
   - prompt template + LLM → HTML email
3. **Interview Questions Bank** — שולחני בלי AI בהתחלה. רשימה סטטית לפי role. שלב 2: התאמה לפי CV.

### 🥈 Tier 2 — מעמיק (3-5 ימים כל אחד)
4. **Talent Pool Search** — דורש embeddings על candidates. שני שלבים: (a) job→embed (b) חיפוש vector. עלות: storage + compute.
5. **Offer Letter Builder** — דורש form רחב + LLM + PDF generator. אבל ROI מצוין.

### 🥉 Tier 3 — אסטרטגי (5+ ימים)
6. **Anomaly Detector** — דורש baseline learning. אופציה: rule-based ראשון (z-score על KPIs) → ML שלב 2.
7. **Source Mix Optimizer** — דורש היסטוריה מספקת + מודל קלאסיפיקציה.

---

## עמודה רוחב — תשתית AI משותפת

כל הכלים החדשים חולקים:
- **`/api/ai/complete`** — endpoint generic ל-LLM calls (provider-agnostic: OpenAI / Anthropic / local)
- **`ai_invocations` table** — לוג של כל הקריאות עם cost tracking + retry
- **rate limiting** משותף ב-`limiter.limit("30/minute")`
- **system prompts** מרוכזים ב-`backend/prompts/` עם versioning
- **fallback graceful** — אם ה-LLM זמין/לא, ה-UI מציג מצב "AI unavailable, fallback to manual"

קובץ חדש: `backend/ai_client.py` — wrapper סביב ה-providers, עם circuit breaker ולוג.

---

## קבצים שיווצרו / ישונו

### חדשים
- `phoenix-dashboard/src/app/ai-hub/components/CategoryCard.tsx`
- `phoenix-dashboard/src/app/ai-hub/components/ToolTile.tsx`
- `phoenix-dashboard/src/app/ai-hub/components/CVAnalyzer.tsx`
- `phoenix-dashboard/src/app/ai-hub/components/WelcomeEmailGenerator.tsx`
- `phoenix-dashboard/src/app/ai-hub/components/QuestionsBank.tsx`
- `backend/ai_client.py` — LLM wrapper
- `backend/prompts/` — directory של system prompts
- migration: `cv_analyses`, `ai_invocations` tables

### ישונו
- `phoenix-dashboard/src/app/ai-hub/page.tsx` — שכתוב ל-CategoryCards + tool routing
- `backend/main.py` — endpoints חדשים: `/api/ai/cv-analyze`, `/api/ai/welcome-email`, `/api/ai/talent-search`

### לא נוגעים
- ManagerWhisperer, MobilitySimulator, SmartOnboarding, ReportsGenerator — נשארים אבל נכנסים לקטגוריה הנכונה
- `/api/onboarding/*` — אין שינוי

---

## אומדנים

- **Tier 1 (3 פיצ'רים + ארגון מחדש)**: 5-7 ימי עבודה
- **Tier 2**: עוד 6-10 ימים
- **Tier 3**: עוד 10+ ימים

---

## פתוח להחלטה

1. איזה Tier 1 פיצ'ר ראשון? (המלצה: **CV Analyzer** — הכי משנה את היומיום)
2. ספק LLM — OpenAI / Anthropic / שניהם דרך AI Gateway? המלצה: Anthropic Claude (איכות עברית טובה) דרך `@anthropic-ai/sdk`.
3. עלות AI per-month — האם להגדיר תקציב גלובלי? המלצה: כן, עם usage dashboard ב-`/admin/performance`.
4. האם רוצים להוסיף קטגוריה 5 "🎯 אינטגרציות" (LinkedIn, Glassdoor, ATS חיצוני)? כרגע מחוץ ל-scope.
