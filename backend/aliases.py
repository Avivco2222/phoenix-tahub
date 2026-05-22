"""Hebrew → canonical column-name aliases for the FastAPI ingestion pipeline.

Two distinct alias tables live here because the backend has two ingest
paths that historically use **different** canonical names for the same
Hebrew field:

1. ``LEGACY_CANDIDATE_ALIASES`` — applied by ``_normalize_upload_frame``
   on the legacy candidates upload path. Canonical names are short
   (``name``, ``email``, ``job_title``, ``recruiter``…).

2. ``TYPED_INGEST_ALIASES`` — applied by ``_apply_extra_aliases`` on
   the typed ingestion endpoints (``/api/ingest/{file_type}`` for
   jobs / hires / diversity / headcount / budget / attrition).
   Canonical names tend to be longer / domain-specific
   (``candidate_name``, ``application_date``, ``hire_date``…).

Both maps end up running over the same DataFrame during a candidates
upload:

* ``_normalize_upload_frame`` runs first → renames ``שם מועמד → name``.
* ``_apply_extra_aliases`` runs second → would rename
  ``שם מועמד → candidate_name``, but the column is already ``name``,
  so the typed map is a no-op on that field for candidates uploads.
* The compatibility shim at the end of ``_apply_extra_aliases`` then
  mirrors ``name`` ↔ ``candidate_name`` so both downstream consumers
  see the data.

Conflicts (kept on purpose — flipping would break downstream code):

* ``"שם מועמד"`` → ``name`` (legacy) vs ``candidate_name`` (typed).
* ``"תאריך הגשה"`` → ``start_date`` (legacy) vs ``application_date``
  (typed).

If you need to *add* a new Hebrew header, add it to the table whose
canonical name matches your downstream consumer. Don't introduce a
third table. There is also ``config.RAW_DATA_MAPPING`` at the
project root, but that one is consumed only by the standalone
Streamlit dashboard (``app.py``) and is intentionally not used here.
"""

# Legacy candidates upload (V1 path — _normalize_upload_frame).
LEGACY_CANDIDATE_ALIASES: dict[str, str] = {
    "שם מועמד": "name", "שם": "name", "full_name": "name",
    "דוא\"ל": "email", "אימייל": "email", "מייל": "email", "mail": "email",
    "שם המשרה": "job_title", "משרה": "job_title", "job": "job_title",
    "מצב שיוך למשרה": "status", "סטטוס": "status",
    "מגייס": "recruiter", "מגייסת": "recruiter",
    "תחילת גיוס": "start_date", "תאריך פתיחה": "start_date",
    "תאריך הגשה": "start_date", "תאריך מועמדות": "start_date",
    "רמה 2": "department", "מחלקה": "department", "חטיבה": "department",
    "מקור הגעה": "source", "מקור": "source",
}


# Typed ingestion path (V2 path — _apply_extra_aliases).
TYPED_INGEST_ALIASES: dict[str, str] = {
    # candidates / general
    "טלפון": "phone", "נייד": "phone", "מספר טלפון": "phone",
    "linkedin": "linkedin", "לינקדאין": "linkedin",
    "קורות חיים": "cv_url", "cv": "cv_url",
    "הערות": "notes",
    "תאריך הגשה": "application_date", "תאריך מועמדות": "application_date",
    # jobs
    "מנהל מגייס": "hiring_manager",
    "תאריך פתיחה": "opened_at", "פתיחה": "opened_at",
    "תאריך סגירה": "closed_at", "סגירה": "closed_at",
    "סיבת סגירה": "close_reason",
    "תקן": "target_count",
    # hires
    "שם מועמד": "candidate_name", "שם": "candidate_name",
    "שם משרה": "job_title", "שם המשרה": "job_title",
    "תאריך קליטה": "hire_date", "תאריך תחילה": "hire_date",
    "שכר": "salary", "שכר בסיס": "salary",
    "מנהל ישיר": "manager",
    "ממליץ": "referral_name", "חמ\"ח": "referral_name",
    # diversity
    "חודש": "snapshot_month", "חודש דיווח": "snapshot_month",
    "מחלקה": "department", "חטיבה": "department",
    "ממד": "dimension", "מאפיין": "dimension",
    "קבוצה": "bucket", "פלח": "bucket",
    "מספר": "count", "כמות": "count", "סה\"כ": "count",
    # headcount
    "תפקיד": "role",
    "תקן מצבה": "standard",
    "בפועל": "current", "מצב נוכחי": "current",
    "עזיבות": "attrition_ytd",
    "תכנית גיוס": "hire_plan",
    # budget (most aliases already exist in finops payloads)
    "מזהה חשבונית": "id", "מזהה": "id",
    "ספק": "vendor", "סכום": "amount", "קטגוריה": "category",
    "תאריך": "date", "מועד פירעון": "due_date", "חודש תקציב": "budget_month",
    "URL קובץ": "file_url",
    # status appears in BOTH candidates ('ראיון', 'הצעה', ...) and budget
    # ('שולם', 'ממתין לתשלום', ...). The candidates ingester applies its own
    # normaliser before this alias map, so it's safe to land here too.
    "סטטוס": "status",
    "תת קטגוריה": "subcategory", "תת-קטגוריה": "subcategory",
    # attrition
    "שם עובד": "employee_name",
    "תאריך עזיבה": "leave_date",
    "סיבה": "reason",
    "וולונטרי": "voluntary",
    "מנהל": "manager", "מנהל/ת": "manager",
    "תפקיד אחרון": "last_role",
    # Note: "תפקיד" (alone) stays mapped to "role" for headcount — don't override.
    # The attrition ingester reads both `last_role` and falls back to `role`.
}
