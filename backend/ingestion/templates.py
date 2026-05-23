"""Per-file-type Excel template specs.

Each entry describes one of the seven ingestible file types:

* ``required`` — list of (Hebrew label, canonical name) pairs. The
  Hebrew labels are what the template downloader prints in the header
  row; canonical names are what the ingest pipeline expects after
  alias normalisation.
* ``recommended`` — same shape, columns useful but not enforced.
* ``validations`` — per-column ``"Hebrew label": [allowed values]``
  drop-down constraints.
* ``sample`` — one sample row keyed by Hebrew label, written to row 2
  of the downloaded template.
* ``title`` / ``instructions`` — printed into the workbook's "הוראות"
  (instructions) sheet.

Consumers: the smart-template downloader in
``routers/ingestion.py::download_smart_template`` and the per-type
template downloader still in main.py.
"""

TEMPLATE_SPECS: dict[str, dict] = {
    "candidates": {
        "required": [("שם מועמד", "name"), ("אימייל", "email"), ("טלפון", "phone")],
        "recommended": [("משרה", "job_title"), ("חטיבה", "department"), ("סטטוס", "status"),
                        ("מגייסת", "recruiter"), ("תאריך הגשה", "application_date"), ("מקור", "source")],
        "validations": {"סטטוס": ["חדש", "סינון", "ראיון", "הצעה", "התקבל", "נדחה"]},
        "sample": {"שם מועמד": "דנה כהן", "אימייל": "dana@example.com", "טלפון": "0541234567",
                   "משרה": "Backend Engineer", "חטיבה": "R&D", "סטטוס": "ראיון", "מגייסת": "מור",
                   "תאריך הגשה": "2026-05-11", "מקור": "LinkedIn"},
        "title": "תבנית מועמדים בתהליך — Dedup לפי טלפון/אימייל",
        "instructions": [
            "שורה אחת לכל איטרציית מועמד×משרה.",
            "מועמד יזוהה לפי טלפון (+972XXXXXXXXX) או אימייל. בלי אחד מהם — יוקלט כחדש בכל העלאה.",
            "סטטוס + מגייסת + תאריך הגשה זהים = איטרציה זהה (תידחה ככפילות). שינוי באחד מהם = איטרציה חדשה.",
        ],
    },
    "jobs": {
        "required": [("שם משרה", "job_title"), ("חטיבה", "department")],
        "recommended": [("מנהל מגייס", "hiring_manager"), ("תאריך פתיחה", "opened_at"),
                        ("תאריך סגירה", "closed_at"), ("סיבת סגירה", "close_reason"), ("תקן", "target_count")],
        "validations": {},
        "sample": {"שם משרה": "Senior Frontend Engineer", "חטיבה": "R&D",
                   "מנהל מגייס": "דוד לוי", "תאריך פתיחה": "2026-04-15", "תקן": 1},
        "title": "תבנית משרות פתוחות וסגורות",
        "instructions": [
            "שורה אחת לכל משרה. דדופ לפי (שם משרה + חטיבה), case-insensitive.",
            "תאריך סגירה ריק = משרה פתוחה. מילוי תאריך = משרה סגורה; אז חובה גם סיבת סגירה.",
        ],
    },
    "hires": {
        "required": [("שם מועמד", "candidate_name"), ("שם משרה", "job_title"), ("תאריך קליטה", "hire_date")],
        "recommended": [("שכר", "salary"), ("חטיבה", "department"), ("מנהל ישיר", "manager"),
                        ("ממליץ", "referral_name"), ("גיוון", "is_diversity")],
        "validations": {"גיוון": ["כן", "לא"]},
        "sample": {"שם מועמד": "נועה מזרחי", "שם משרה": "Customer Success",
                   "תאריך קליטה": "2026-05-12", "שכר": 22000, "חטיבה": "Service", "מנהל ישיר": "ליטל"},
        "title": "תבנית קליטות בפועל",
        "instructions": [
            "שורה אחת לכל קליטה שהתבצעה. המערכת תקשר אוטומטית למועמד קיים אם נמצא לפי שם/טלפון/אימייל.",
            "תאריך קליטה בפורמט YYYY-MM-DD. דדופ: שורה זהה (מועמד+משרה+תאריך) תידחה.",
        ],
    },
    "diversity": {
        "required": [("חודש", "snapshot_month"), ("חטיבה", "department"),
                     ("ממד", "dimension"), ("קבוצה", "bucket"), ("כמות", "count")],
        "recommended": [],
        "validations": {"ממד": ["gender", "age_range", "ethnicity", "tenure"]},
        "sample": {"חודש": "2026-05", "חטיבה": "R&D", "ממד": "gender", "קבוצה": "F", "כמות": 42},
        "title": "תבנית מדדי גיוון לפי חודש",
        "instructions": [
            "שורה אחת לכל (חודש × חטיבה × ממד × קבוצה).",
            "חודש בפורמט YYYY-MM (ללא יום).",
            "ערכי 'ממד' מותרים: gender (M/F/Other), age_range (e.g. 30-40), ethnicity, tenure.",
        ],
    },
    "headcount": {
        "required": [("חודש", "snapshot_month"), ("חטיבה", "department"), ("תפקיד", "role")],
        "recommended": [("תקן מצבה", "standard"), ("בפועל", "current"),
                        ("עזיבות מתחילת השנה", "attrition_ytd"), ("תכנית גיוס", "hire_plan")],
        "validations": {},
        "sample": {"חודש": "2026-05", "חטיבה": "R&D", "תפקיד": "Backend Engineer",
                   "תקן מצבה": 12, "בפועל": 11, "עזיבות מתחילת השנה": 2, "תכנית גיוס": 1},
        "title": "תבנית תקן מצבה (Standard vs Current)",
        "instructions": [
            "שורה אחת לכל (חודש × חטיבה × תפקיד).",
            "ה-attrition_ytd צריך להתאים לסכום אירועי העזיבה באותה תקופה — בקרת איכות תזהיר על פערים.",
        ],
    },
    "budget": {
        "required": [("מזהה חשבונית", "id"), ("ספק", "vendor"), ("תאריך", "date"),
                     ("סכום", "amount"), ("קטגוריה", "category")],
        "recommended": [("מועד פירעון", "due_date"), ("חודש תקציב", "budget_month"),
                        ("סטטוס", "status"), ("URL קובץ", "file_url")],
        "validations": {"סטטוס": ["ממתין למיפוי", "ממתין לתשלום", "שולם", "בוטל"]},
        "sample": {"מזהה חשבונית": "INV-2026-001", "ספק": "Workday", "תאריך": "2026-05-01",
                   "סכום": 12500, "קטגוריה": "תוכנה", "חודש תקציב": "2026-Q2"},
        "title": "תבנית חשבוניות FinOps",
        "instructions": [
            "מזהה חשבונית חייב להיות ייחודי — אם קיים, החשבונית תעודכן (upsert).",
            "תאריך + מועד פירעון בפורמט YYYY-MM-DD.",
        ],
    },
    "attrition": {
        "required": [("שם עובד", "employee_name"), ("תאריך עזיבה", "leave_date")],
        "recommended": [("חטיבה", "department"), ("מנהל", "manager"), ("תפקיד אחרון", "last_role"),
                        ("סיבה", "reason"), ("וולונטרי", "voluntary")],
        "validations": {"וולונטרי": ["כן", "לא"]},
        "sample": {"שם עובד": "אורית גרשון", "תאריך עזיבה": "2026-04-30", "חטיבה": "Sales",
                   "מנהל": "אבי כהן", "תפקיד אחרון": "Account Manager", "סיבה": "הזדמנות בחו\"ל", "וולונטרי": "כן"},
        "title": "תבנית אירועי עזיבה",
        "instructions": [
            "שורה אחת לכל אירוע עזיבה. דדופ לפי (שם עובד + תאריך עזיבה).",
            "המערכת תקשר אוטומטית לרשומת מועמד קיימת אם השם תואם.",
        ],
    },
}
