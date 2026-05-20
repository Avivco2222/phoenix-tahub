# test_data/ — קבצי טסט ל-7 צינורות הקליטה

קבצי CSV מוכנים להעלאה דרך 7 ה-dropzones ב-`/admin`. עברית, UTF-8, פסיק כמפריד. הכותרות זהות לתבנית המאסטר שאפשר להוריד מ-`/admin/ingestion/template/{file_type}`.

## הקבצים

| # | קובץ | סוג ingest | שורות | מה מבדוק |
|---|------|------------|-------|-----------|
| 01 | `01_candidates.csv` | candidates | 15 | מועמדים+iterations. כולל 3 שורות `דנה כהן` עם אותו מפתח (דדופ), שורה אחת בלי טלפון (`ליאת ארז`), שורה אחת בלי אימייל וגם בלי טלפון (`איתי כץ`) |
| 02 | `02_jobs.csv` | jobs | 12 | 8 פתוחות + 4 סגורות. שמות וחטיבות זהים ל-jobs שמופיעים ב-`01_candidates.csv` (מבדוק את upsert לפי job_title+department) |
| 03 | `03_hires.csv` | hires | 8 | קליטות בפועל. חלק מקושרות למועמדים מ-#1 לפי שם (`שירה רוזן`, `דניאל אדרי`) — מבדוק את ה-matching האוטומטי |
| 04 | `04_diversity.csv` | diversity | 16 | 3 חודשים × חטיבות × ממדים (gender/age_range) |
| 05 | `05_headcount.csv` | headcount | 12 | 2 חודשים × תפקידים. ה-attrition_ytd אמור להתאים לאירועי `07_attrition.csv` (בקרת איכות תזהיר על פערים) |
| 06 | `06_budget.csv` | budget | 10 | חשבוניות עם `INV-2026-XXX`. כולל שורות `ממתין למיפוי` שצריכות להגיע לטאב "מיפוי" ב-`/budget` |
| 07 | `07_attrition.csv` | attrition | 6 | אירועי עזיבה ב-6 חודשים אחרונים, מיקס וולונטרי/לא-וולונטרי |

## שימוש מהיר

### דרך UI
1. Login כ-admin → `/admin`
2. לכל אחד מ-7 ה-dropzones — גרור את הקובץ המתאים
3. עקוב אחרי הטוסט (`success` / `partial`) ואחרי טאב "היסטוריית אצוות"

### דרך curl
```bash
# Login
curl -c /tmp/cj.txt -X POST http://127.0.0.1:8010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fnx.co.il","password":"198722"}'

# Upload all 7
for spec in "candidates:01" "jobs:02" "hires:03" "diversity:04" "headcount:05" "budget:06" "attrition:07"; do
  t=${spec%:*}; n=${spec#*:}
  curl -b /tmp/cj.txt -X POST "http://127.0.0.1:8010/api/ingest/$t" \
    -F "file=@test_data/${n}_${t}.csv"
done
```

## תוצאות צפויות (DB ריק)

| סוג | inserted | updated | skipped_duplicate |
|-----|----------|---------|-------------------|
| candidates | 12 | 0 | 3 (3 דנה iterations של אותו מפתח+תאריך) |
| jobs | 12 | 0 | 0 |
| hires | 8 | 0 | 0 |
| diversity | 16 | 0 | 0 |
| headcount | 12 | 0 | 0 |
| budget | 10 | 0 | 0 |
| attrition | 6 | 0 | 0 |

בריצה שנייה (DB מלא בנתוני הקבצים) — `updated` יקבל את כל השורות וה-`inserted` יהיה 0.

## אבחנות שכדאי לבדוק

- **`/candidates`** — נווט לראות 12 מועמדים בשלבים שונים, כולל מועמד אחד בלי פרטי קשר (`איתי כץ`)
- **`/jobs?status=all`** — 12 משרות, מהן 4 סגורות עם `closed_at` ו-`close_reason`
- **`/headcount`** — gap בין `current` ל-`standard` ב-R&D Backend (12 → 10)
- **`/budget`** — 2 שורות `ממתין למיפוי` (אביב ניקיון, יועץ משפטי)
- **`/diversity`** — 3 חודשים זמינים, breakdown gender ו-age_range ב-R&D
- **טאב היסטוריית אצוות ב-`/admin`** — 7 batches חדשים עם stats

## הערות יישום

- כל הקבצים בעברית מלאה. ה-aliases ב-`_apply_extra_aliases` ([backend/main.py](../backend/main.py)) ממפים את הכותרות העבריות לעמודות הקנוניות שה-DB מצפה להן.
- שדה `טלפון` בקבצי candidates נשמר כ-string בלי `.0`. ה-`_scalar()` ([backend/main.py:~880](../backend/main.py)) מטפל ב-pandas float→int לפני normalize_phone.
- שורות עם אימייל/טלפון ריקים נשמרות עם `NULL` ב-SQLite (לא עם המחרוזת `"nan"`). זה מבטיח ש-UNIQUE(email) לא תיתפס באוסף של שורות ללא פרטי קשר.
