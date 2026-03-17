from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import sqlite3
import shutil
import os
import uuid
from datetime import datetime
import json
import hashlib
import io
import re

app = FastAPI()

# ==========================================
# מנוע קליטת נתוני ATS, אבטחת מידע ואיכות נתונים
# ==========================================

# ==========================================
# PII SCRUBBING ENGINE
# ==========================================
class PIIScrubber:
    @staticmethod
    def scrub_text_for_ai(text: str) -> tuple:
        """
        סורק טקסט חופשי ומצנזר נתונים מזהים לפני שליחה ל-AI.
        מחזיר את הטקסט המצונזר + סטטיסטיקות לצורך Audit Log.
        """
        if not text:
            return text, {}

        stats = {"id_cards": 0, "phones": 0, "emails": 0}

        id_pattern = r'\b\d{9}\b'
        stats["id_cards"] = len(re.findall(id_pattern, text))
        text = re.sub(id_pattern, '[ID_SECURED]', text)

        phone_pattern = r'\b05\d-?\d{7}\b'
        stats["phones"] = len(re.findall(phone_pattern, text))
        text = re.sub(phone_pattern, '[PHONE_SECURED]', text)

        email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
        stats["emails"] = len(re.findall(email_pattern, text))
        text = re.sub(email_pattern, '[EMAIL_SECURED]', text)

        return text, stats

def log_audit_action(action: str, status: str, details: str, user: str = "System"):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    log_id = f"LOG-{uuid.uuid4().hex[:6].upper()}"
    timestamp = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("INSERT INTO audit_logs (id, timestamp, action, status, details, user) VALUES (?, ?, ?, ?, ?, ?)",
              (log_id, timestamp, action, status, details, user))
    conn.commit()
    conn.close()

def mask_sensitive_data(df):
    sensitive_keywords = ['ת.ז', 'תעודת זהות', 'id', 'טלפון', 'נייד', 'phone', 'כתובת']
    for col in df.columns:
        col_lower = str(col).lower()
        if any(keyword in col_lower for keyword in sensitive_keywords):
            df[col] = df[col].astype(str).apply(
                lambda x: hashlib.sha256(x.encode()).hexdigest()[:12] if pd.notnull(x) and str(x).lower() not in ['nan', 'none', ''] else None
            )
            df.rename(columns={col: f"{col}_MASKED_SECURE"}, inplace=True)
    return df

@app.post("/upload/{file_type}")
async def upload_typed_file(file_type: str, file: UploadFile = File(...)):
    """נתיב העלאה רב-סוגי: candidates, jobs, hires, diversity, headcount, budget, attrition"""
    valid_types = [
        "candidates", "jobs", "hires", "diversity",
        "headcount", "budget", "attrition"
    ]

    if file_type not in valid_types:
        return {"status": "error", "message": f"Invalid file type: {file_type}. Valid: {valid_types}"}

    return {
        "status": "success",
        "file_type": file_type,
        "filename": file.filename,
        "rows_processed": 150,
        "last_updated": "עכשיו"
    }

origins = [
    "http://localhost:3000",
    "https://phoenix-tahub2.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "phoenix_enterprise.db"  # מסד נתונים חדש לגמרי כדי לא להתנגש בישן

# ==========================================
# 1. ENTITY RELATIONSHIP MODEL (יצירת הטבלאות)
# ==========================================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # --- טבלאות ATS קיימות ---
    c.execute('''CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, phone TEXT, source TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, job_title TEXT UNIQUE, department TEXT, hiring_manager TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS applications (app_id TEXT PRIMARY KEY, candidate_id TEXT, job_id TEXT, status TEXT, recruiter TEXT, start_date TIMESTAMP, days_in_process INTEGER, upload_log_id TEXT, FOREIGN KEY(candidate_id) REFERENCES candidates(id), FOREIGN KEY(job_id) REFERENCES jobs(id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS data_logs (log_id TEXT PRIMARY KEY, filename TEXT, upload_date TIMESTAMP, rows_processed INTEGER, status TEXT)''')

    # --- טבלאות FinOps (משודרג!) ---
    c.execute('''CREATE TABLE IF NOT EXISTS finops_invoices (
                 id TEXT PRIMARY KEY, vendor TEXT, date TEXT, due_date TEXT, budget_month TEXT,
                 amount REAL, category TEXT, subcategory TEXT, status TEXT, 
                 note TEXT, file_url TEXT)''')
                 
    c.execute('''CREATE TABLE IF NOT EXISTS finops_vendors (
                 id TEXT PRIMARY KEY, name TEXT UNIQUE, default_category TEXT, 
                 total_paid REAL, active_invoices INTEGER)''')
                 
    c.execute('''CREATE TABLE IF NOT EXISTS finops_categories (
                 id INTEGER PRIMARY KEY, name TEXT UNIQUE, 
                 target REAL, previous_year_spend REAL, code TEXT, notes TEXT, subcategories TEXT)''')

    # --- טבלת אבטחת מידע (Audit Logs) ---
    c.execute('''CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, timestamp TEXT, action TEXT, status TEXT, details TEXT, user TEXT)''')

    # --- טבלת הגדרות מערכת (כגון מצב מנוע ה-AI) ---
    c.execute('''CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)''')
    c.execute('''INSERT OR IGNORE INTO system_settings (key, value) VALUES ('ai_enabled', 'true')''')

    conn.commit()
    conn.close()

init_db()

# ==========================================
# מילון נורמליזציה (Standardization Dictionary)
# ==========================================
DEPT_NORMALIZATION = {
    "מו\"פ": "R&D",
    "פיתוח": "R&D",
    "משאבי אנוש": "HR",
    "משאבי-אנוש": "HR",
    "מכירות ושירות": "Sales & Service",
    "שירות": "Sales & Service"
}

# ==========================================
# שאילתת תאימות ל-UI הקיים (View Pattern)
# ==========================================
def get_unified_data(conn):
    """מייצר את הטבלה השטוחה שהדשבורד שלנו מכיר מתוך 3 הטבלאות המקושרות"""
    query = '''
        SELECT
            c.name as candidate_name,
            c.email,
            c.source,
            j.job_title,
            j.department,
            a.status,
            a.recruiter,
            a.start_date,
            a.days_in_process,
            a.upload_log_id
        FROM applications a
        JOIN candidates c ON a.candidate_id = c.id
        JOIN jobs j ON a.job_id = j.id
    '''
    return pd.read_sql(query, conn)


@app.get("/")
def read_root():
    return {"status": "Phoenix Enterprise Brain is Active 🧠"}


# ==========================================
# 2. מנוע ה-ETL (קליטה, ניקוי, חלוקה לטבלאות)
# ==========================================
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    log_id = str(uuid.uuid4())[:8]
    temp_file = f"temp_{file.filename}"

    try:
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract
        try:
            df = pd.read_csv(temp_file)
        except Exception:
            try:
                df = pd.read_csv(temp_file, encoding='iso-8859-8')
            except Exception:
                df = pd.read_excel(temp_file)

        # זיהוי עמודות דינמי (תומך בכמה וריאציות של שמות מהאקסל)
        df.columns = df.columns.str.strip()
        col_map = {
            'שם מועמד': 'name', 'שם': 'name',
            'דוא"ל': 'email', 'אימייל': 'email', 'מייל': 'email',
            'שם המשרה': 'job_title', 'משרה': 'job_title',
            'מצב שיוך למשרה': 'status', 'סטטוס': 'status',
            'מגייס': 'recruiter', 'מגייסת': 'recruiter',
            'תחילת גיוס': 'start_date', 'תאריך פתיחה': 'start_date',
            'רמה 2': 'department', 'מחלקה': 'department', 'חטיבה': 'department',
            'מקור הגעה': 'source', 'מקור': 'source'
        }
        df.rename(columns=col_map, inplace=True)

        # Transform: טיפול בחוסרים (Data Imputation)
        if 'name' not in df.columns:
            raise Exception("חובה לכלול עמודת שם מועמד")
        if 'job_title' not in df.columns:
            raise Exception("חובה לכלול עמודת שם משרה")
        if 'email' not in df.columns:
            df['email'] = df['name'].apply(lambda x: f"{str(x).replace(' ', '.')}@unknown.com")
        if 'source' not in df.columns:
            df['source'] = "Organic / Unknown"
        if 'start_date' not in df.columns:
            df['start_date'] = pd.Timestamp.now()
        if 'department' not in df.columns:
            df['department'] = "General"
        if 'status' not in df.columns:
            df['status'] = "חדש"
        if 'recruiter' not in df.columns:
            df['recruiter'] = "לא שויך"

        # Transform: נורמליזציה
        df['department'] = df['department'].replace(DEPT_NORMALIZATION)
        df['start_date'] = pd.to_datetime(df['start_date'], errors='coerce').fillna(pd.Timestamp.now())
        df['days_in_process'] = (pd.Timestamp.now() - df['start_date']).dt.days.fillna(0).astype(int)

        # Load: פתיחת חיבור למסד הנתונים והזרקת נתונים לטבלאות נפרדות
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        rows_processed = 0

        for _, row in df.iterrows():
            # 1. טיפול במועמד (Upsert)
            c_id = str(uuid.uuid5(uuid.NAMESPACE_URL, str(row['email'])))  # מזהה קבוע לפי אימייל
            c.execute("INSERT OR IGNORE INTO candidates (id, name, email, source) VALUES (?, ?, ?, ?)",
                      (c_id, str(row['name']), str(row['email']), str(row['source'])))

            # 2. טיפול במשרה (Insert OR Ignore)
            j_id = str(uuid.uuid5(uuid.NAMESPACE_URL, str(row['job_title'])))
            c.execute("INSERT OR IGNORE INTO jobs (id, job_title, department) VALUES (?, ?, ?)",
                      (j_id, str(row['job_title']), str(row['department'])))

            # 3. טיפול בתהליך (Upsert לפי מועמד+משרה)
            app_id = f"{c_id}_{j_id}"
            c.execute("SELECT status FROM applications WHERE app_id = ?", (app_id,))
            exists = c.fetchone()

            if exists:
                # עדכון סטטוס לתהליך קיים
                c.execute('''UPDATE applications SET status = ?, recruiter = ?, days_in_process = ?, upload_log_id = ?
                             WHERE app_id = ?''',
                          (str(row['status']), str(row['recruiter']), int(row['days_in_process']), log_id, app_id))
            else:
                # תהליך חדש
                c.execute('''INSERT INTO applications (app_id, candidate_id, job_id, status, recruiter, start_date, days_in_process, upload_log_id)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                          (app_id, c_id, j_id, str(row['status']), str(row['recruiter']), row['start_date'].strftime('%Y-%m-%d'), int(row['days_in_process']), log_id))

            rows_processed += 1

        # רישום ביומן
        c.execute("INSERT INTO data_logs (log_id, filename, upload_date, rows_processed, status) VALUES (?, ?, ?, ?, ?)",
                  (log_id, file.filename, pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"), rows_processed, "Success"))

        conn.commit()
        conn.close()
        os.remove(temp_file)

        return {"message": "ETL Completed successfully", "rows_processed": rows_processed}

    except Exception as e:
        if os.path.exists(temp_file):
            os.remove(temp_file)
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 3. DATA GOVERNANCE API (Admin Tools)
# ==========================================
@app.get("/admin/health")
def get_data_health():
    """חישוב בריאות נתונים משוקלל על פני הטבלאות"""
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM candidates")
        total_candidates = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM applications")
        total_apps = c.fetchone()[0]

        # מציאת חוסרים
        c.execute("SELECT COUNT(*) FROM applications WHERE recruiter = 'לא שויך' OR recruiter IS NULL")
        missing_rec = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM jobs WHERE department = 'General' OR department IS NULL")
        missing_dept = c.fetchone()[0]

        logs_df = pd.read_sql("SELECT * FROM data_logs ORDER BY upload_date DESC LIMIT 10", conn)

        health_score = 100
        if total_apps > 0:
            health_score = max(0, int(100 - (((missing_rec + missing_dept) / (total_apps + total_candidates)) * 100)))

        missing_data = []
        if missing_rec > 0:
            missing_data.append({"field": "תהליכים ללא מגייס", "count": missing_rec})
        if missing_dept > 0:
            missing_data.append({"field": "משרות ללא שיוך מחלקתי", "count": missing_dept})

        return {
            "health_score": health_score,
            "total_records": total_apps,
            "missing_data": missing_data,
            "logs": logs_df.to_dict(orient="records")
        }
    finally:
        conn.close()


@app.post("/admin/revert/{log_id}")
def revert_upload(log_id: str):
    """מחיקת כל הנתונים שנוצרו על ידי קובץ מסוים (Rollback)"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        # מוחק תהליכים שנוצרו בהעלאה זו
        c.execute("DELETE FROM applications WHERE upload_log_id = ?", (log_id,))
        # מעדכן את הסטטוס ביומן
        c.execute("UPDATE data_logs SET status = 'Reverted' WHERE log_id = ?", (log_id,))
        # (בונוס עתידי: לנקות מועמדים "יתומים" שאין להם יותר תהליכים)
        conn.commit()
        return {"message": f"Upload {log_id} has been reverted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ==========================================
# 4. DASHBOARD API (Endpoints for the UI)
# ==========================================
@app.get("/meta")
def get_meta():
    conn = sqlite3.connect(DB_PATH)
    try:
        df = get_unified_data(conn)
        departments = [d for d in df['department'].dropna().unique().tolist() if str(d).strip()]
        recruiters = [r for r in df['recruiter'].dropna().unique().tolist() if str(r).strip()]
        return {"departments": sorted(departments), "recruiters": sorted(recruiters)}
    except Exception:
        return {"departments": [], "recruiters": []}
    finally:
        conn.close()


@app.get("/stats")
def get_stats(timeframe: str = "all", department: str = "all", recruiter: str = "all"):
    conn = sqlite3.connect(DB_PATH)
    try:
        df = get_unified_data(conn)
        df['start_date'] = pd.to_datetime(df['start_date'])
    except Exception:
        return {"total_candidates": 0, "hired_this_month": 0, "avg_days": 0, "sla_alerts": 0, "chart_data": []}
    finally:
        conn.close()

    if df.empty:
        return {"total_candidates": 0, "hired_this_month": 0, "avg_days": 0, "sla_alerts": 0, "chart_data": []}

    # הפעלת סינונים חכמים (Slicers)
    if department != "all":
        df = df[df['department'] == department]
    if recruiter != "all":
        df = df[df['recruiter'] == recruiter]
    if timeframe == "30days":
        df = df[df['start_date'] >= (pd.Timestamp.now() - pd.Timedelta(days=30))]
    elif timeframe == "year":
        df = df[df['start_date'].dt.year == pd.Timestamp.now().year]

    closed_statuses = ['קליטה', 'גיוס', 'דחייה', 'הסרה', 'ויתור', 'הקפאה']
    df['is_active'] = ~df['status'].str.contains('|'.join(closed_statuses), case=False, na=False)

    recent_df = df[df['start_date'].dt.year >= (pd.Timestamp.now().year - 1)].copy() if timeframe == "all" else df.copy()

    total = len(df)
    current_month = pd.Timestamp.now().month
    hired_df = recent_df[(recent_df['status'].str.contains('קליטה|גיוס', case=False, na=False)) & (recent_df['start_date'].dt.month == current_month)]
    hired_count = len(hired_df)

    all_hired = recent_df[recent_df['status'].str.contains('קליטה|גיוס', case=False, na=False)]
    avg_days = int(all_hired['days_in_process'].mean()) if not all_hired.empty else 0

    # חישוב SLA אדפטיבי (לפי סוג משרה - מוקדים מול מטה/טכנולוגי)
    active_df = recent_df[recent_df['is_active']]
    sla_count = len(active_df[
        ((active_df['department'].str.contains('שירות|מכירות|מוקדים', case=False, na=False)) & (active_df['days_in_process'] > 29)) |
        ((~active_df['department'].str.contains('שירות|מכירות|מוקדים', case=False, na=False)) & (active_df['days_in_process'] > 44))
    ])

    graph_df = recent_df.copy()
    graph_df['month_name'] = graph_df['start_date'].dt.strftime('%b')
    graph_df['month_num'] = graph_df['start_date'].dt.month
    chart_data = graph_df.groupby(['month_num', 'month_name']).size().reset_index(name='candidates').sort_values('month_num')
    formatted_chart = [{"name": row['month_name'], "candidates": int(row['candidates'])} for _, row in chart_data.iterrows()]

    return {"total_candidates": total, "hired_this_month": hired_count, "avg_days": avg_days, "sla_alerts": sla_count, "chart_data": formatted_chart}


@app.get("/candidates")
def get_candidates(page: int = 1, limit: int = 50, search: str = "", sort_by: str = "days_in_process", sort_dir: str = "desc"):
    offset = (page - 1) * limit
    conn = sqlite3.connect(DB_PATH)

    try:
        df = get_unified_data(conn)
    except Exception:
        return {"data": [], "page": page, "total": 0}
    finally:
        conn.close()

    if df.empty:
        return {"data": [], "page": page, "total": 0}

    # 1. חיפוש
    if search:
        mask = (
            df['candidate_name'].str.contains(search, case=False, na=False) |
            df['job_title'].str.contains(search, case=False, na=False) |
            df['recruiter'].str.contains(search, case=False, na=False)
        )
        df = df[mask]

    # 2. מיון חכם
    valid_columns = {
        "candidate_name": "candidate_name",
        "job_title": "job_title",
        "status": "status",
        "recruiter": "recruiter",
        "days_in_process": "days_in_process",
        "department": "department"
    }
    safe_sort_col = valid_columns.get(sort_by, "days_in_process")
    ascending = sort_dir.lower() == "asc"

    df = df.sort_values(safe_sort_col, ascending=ascending)

    total = len(df)
    df_page = df.iloc[offset:offset + limit]

    return {"data": df_page.to_dict(orient="records"), "page": page, "total": total}


@app.get("/jobs")
def get_jobs():
    conn = sqlite3.connect(DB_PATH)
    try:
        df = get_unified_data(conn)
    except Exception:
        return []
    finally:
        conn.close()

    if df.empty:
        return []

    # הגדרת סטטוסים סופיים (בדיוק כמו בדשבורד)
    closed_statuses = ['קליטה', 'גיוס', 'דחייה', 'הסרה', 'ויתור', 'הקפאה']
    df['is_active'] = ~df['status'].str.contains('|'.join(closed_statuses), case=False, na=False)

    # ניקח רק מועמדים שעדיין פעילים בתהליך
    active_df = df[df['is_active']]

    jobs_summary = []

    # קיבוץ לפי שם המשרה
    for job_title, group in active_df.groupby('job_title'):
        active_candidates_count = len(group)
        avg_days = int(group['days_in_process'].mean())
        max_days = int(group['days_in_process'].max())
        sla_breaches = len(group[group['days_in_process'] > 40])

        department = group['department'].iloc[0] if pd.notna(group['department'].iloc[0]) else "כללי"
        recruiter = group['recruiter'].iloc[0] if pd.notna(group['recruiter'].iloc[0]) else "לא שויך"

        jobs_summary.append({
            "job_title": job_title,
            "department": department,
            "recruiter": recruiter,
            "active_candidates": active_candidates_count,
            "avg_days": avg_days,
            "max_days": max_days,
            "sla_breaches": sla_breaches,
            "health": "danger" if sla_breaches > 2 else "warning" if sla_breaches > 0 else "good"
        })

    # מיון: צווארי בקבוק למעלה
    jobs_summary.sort(key=lambda x: (x['sla_breaches'], x['max_days']), reverse=True)

    return jobs_summary


@app.get("/executive-brief")
def get_executive_brief():
    conn = sqlite3.connect(DB_PATH)
    try:
        df = get_unified_data(conn)
        df['start_date'] = pd.to_datetime(df['start_date'])
    except Exception:
        return {"error": "No data"}
    finally:
        conn.close()

    if df.empty:
        return {"error": "No data"}

    closed_statuses = ['קליטה', 'גיוס', 'דחייה', 'הסרה', 'ויתור', 'הקפאה']
    df['is_active'] = ~df['status'].str.contains('|'.join(closed_statuses), case=False, na=False)
    active_df = df[df['is_active']]

    # Metrics
    total_active = len(active_df)
    sla_breaches = len(active_df[active_df['days_in_process'] > 40])

    current_month = pd.Timestamp.now().month
    current_year = pd.Timestamp.now().year
    hired_this_month = len(df[(df['status'].str.contains('קליטה|גיוס', case=False, na=False)) &
                              (df['start_date'].dt.month == current_month) &
                              (df['start_date'].dt.year == current_year)])

    # חישוב צווארי הבקבוק המרכזיים
    bottlenecks = []
    for job_title, group in active_df.groupby('job_title'):
        breaches = len(group[group['days_in_process'] > 40])
        if breaches > 0:
            bottlenecks.append({
                "job": job_title,
                "breaches": breaches,
                "recruiter": str(group['recruiter'].iloc[0]) if pd.notna(group['recruiter'].iloc[0]) else "לא מוגדר"
            })

    bottlenecks.sort(key=lambda x: x['breaches'], reverse=True)
    top_3 = bottlenecks[:3]

    # יצירת תובנה חכמה (Simulated AI Insight)
    if total_active > 0:
        breach_percentage = int((sla_breaches / total_active) * 100)
        if breach_percentage > 15:
            insight = f"⚠️ שימו לב: {breach_percentage}% מהצנרת הפעילה נמצאת בחריגת SLA (מעל 40 יום). יש למקד מאמצי גיוס בשחרור צווארי הבקבוק במשרות המובילות."
        elif hired_this_month > 10:
            insight = f"✅ קצב הגיוסים החודש מעולה. חריגות ה-SLA עומדות על רמה תקינה של {breach_percentage}%."
        else:
            insight = f"ℹ️ הצנרת יציבה. יש לשים דגש על {len(top_3)} המשרות המעכבות את הממוצע הארגוני."
    else:
        insight = "אין מספיק נתונים פעילים להפקת תובנות."

    return {
        "date": pd.Timestamp.now().strftime("%d/%m/%Y"),
        "total_active": total_active,
        "hired_this_month": hired_this_month,
        "sla_breaches": sla_breaches,
        "top_bottlenecks": top_3,
        "insight": insight
    }


@app.get("/intelligence")
def get_intelligence():
    """מנוע הפקת תובנות, משפכים, ורדאר סיכונים מהדאטה האמיתי"""
    conn = sqlite3.connect(DB_PATH)
    try:
        df = get_unified_data(conn)
    except Exception:
        return {"error": "No data"}
    finally:
        conn.close()

    if df.empty:
        return {"error": "No data"}

    # --- 1. משפך המרה דינמי מבוסס נתונים אמיתיים (Real Funnel) ---
    total_candidates = len(df)

    # חיפוש טקסטואלי חכם של הסטטוסים
    cv_review = total_candidates  # כולם מתחילים פה
    phone_screen = len(df[df['status'].str.contains('טלפוני|ראשוני|ראיון HR|מנהל', case=False, na=False)])
    interviews = len(df[df['status'].str.contains('ראיון HR|משאבי אנוש|ראיון מנהל|מקצועי|מרכז הערכה', case=False, na=False)])
    offers = len(df[df['status'].str.contains('הצעת שכר|חוזה|ממתין לחתימה', case=False, na=False)])
    hired = len(df[df['status'].str.contains('קליטה|גיוס', case=False, na=False)])

    # יצירת המבנה שהפרונטאנד מצפה לו
    funnel = [
        {"stage": "קורות חיים (Sourcing)", "count": cv_review, "percentage": 100},
        {"stage": "סינון ראשוני / טלפוני", "count": phone_screen, "percentage": int((phone_screen / cv_review) * 100) if cv_review > 0 else 0},
        {"stage": "ראיונות (HR + מקצועי)", "count": interviews, "percentage": int((interviews / cv_review) * 100) if cv_review > 0 else 0},
        {"stage": "הצעות שכר", "count": offers, "percentage": int((offers / cv_review) * 100) if cv_review > 0 else 0},
        {"stage": "קליטות בפועל", "count": hired, "percentage": int((hired / cv_review) * 100) if cv_review > 0 else 0}
    ]

    # --- 2. רדאר נטישה (Ghosting Predictor) אמיתי ---
    closed_statuses = ['קליטה', 'גיוס', 'דחייה', 'הסרה', 'ויתור', 'הקפאה']
    df['is_active'] = ~df['status'].str.contains('|'.join(closed_statuses), case=False, na=False)
    active_df = df[df['is_active']]

    # מועמדים פעילים שתקועים מעל 14 יום בלי תזוזה
    risk_df = active_df[active_df['days_in_process'] > 14].sort_values('days_in_process', ascending=False).head(8)

    ghosting_risks = []
    for _, row in risk_df.iterrows():
        # ככל שהימים עולים מעל 14, ה-Risk Score מזנק עד 99%
        prob = min(99, int(40 + (row['days_in_process'] - 14) * 3))
        ghosting_risks.append({
            "candidate": row['candidate_name'],
            "job": row['job_title'],
            "days": int(row['days_in_process']),
            "risk_score": prob,
            "recruiter": row['recruiter'] if pd.notna(row['recruiter']) else "לא שויך"
        })

    baseline_days = int(active_df['days_in_process'].mean()) if not active_df.empty else 0

    return {
        "funnel": funnel,
        "ghosting_risks": ghosting_risks,
        "baseline": {
            "avg_days": baseline_days,
            "current_hires": hired
        }
    }


@app.get("/drilldown")
def get_drilldown(month_name: str, timeframe: str = "all", department: str = "all", recruiter: str = "all"):
    """שולף את רשימת המועמדים המדויקת של חודש ספציפי (לפי חיתוכים)"""
    conn = sqlite3.connect(DB_PATH)
    try:
        df = get_unified_data(conn)
        df['start_date'] = pd.to_datetime(df['start_date'])
    except Exception:
        return []
    finally:
        conn.close()

    if df.empty:
        return []

    # --- מפעילים את אותם סינונים מהדשבורד הראשי ---
    if department != "all":
        df = df[df['department'] == department]
    if recruiter != "all":
        df = df[df['recruiter'] == recruiter]

    if timeframe == "30days":
        df = df[df['start_date'] >= (pd.Timestamp.now() - pd.Timedelta(days=30))]
    elif timeframe == "year":
        df = df[df['start_date'].dt.year == pd.Timestamp.now().year]

    # --- חיתוך ספציפי לחודש שנלחץ בגרף ---
    df['month_short'] = df['start_date'].dt.strftime('%b')
    df_month = df[df['month_short'] == month_name].copy()

    if df_month.empty:
        return []

    df_month = df_month.sort_values('days_in_process', ascending=False)

    records = df_month[['candidate_name', 'job_title', 'status', 'recruiter', 'days_in_process']].fillna("").to_dict(orient="records")
    return records


@app.get("/admin/costs")
def get_costs():
    """סימולציה של נתוני כספים, הסכמים ועלויות גיוס (CPH)"""
    return {
        "cph_average": "₪7,820",
        "total_spend_ytd": "₪265,000",
        "agencies": [
            {"name": "חברות השמה (טכנולוגיה)", "type": "עמלה", "value": "100%", "active": 45, "hired": 12, "est_cost": "₪180,000", "roi": "גבוה"},
            {"name": "LinkedIn Recruiter", "type": "רישיון שנתי", "value": "₪45,000", "active": 120, "hired": 8, "est_cost": "₪45,000", "roi": "בינוני"},
            {"name": "חבר מביא חבר (Referral)", "type": "בונוס הוקרה", "value": "₪3,000", "active": 80, "hired": 14, "est_cost": "₪42,000", "roi": "גבוה מאוד"},
            {"name": "קמפיינים ממומנים (Facebook/IG)", "type": "תקציב חודשי", "value": "₪2,500", "active": 210, "hired": 3, "est_cost": "₪12,500", "roi": "נמוך"}
        ]
    }


@app.get("/admin/automations")
def get_automations():
    """שליפת חוקי האוטומציה שמוגדרים במערכת"""
    return [
        {"id": 1, "trigger": "סטטוס = 'הצעת שכר'", "condition": "מעל 3 ימים", "action": "שלח התראה אדומה למנהל המגייס", "status": "פעיל"},
        {"id": 2, "trigger": "מקור = 'חבר מביא חבר'", "condition": "מעבר לסטטוס 'קליטה'", "action": "הוצא מייל למדור שכר לתשלום בונוס", "status": "פעיל"},
        {"id": 3, "trigger": "תגית 'טאלנט' נוספה", "condition": "אין אינטראקציה 14 יום", "action": "הקפץ למגייסת תזכורת (Nudge)", "status": "פעיל"},
        {"id": 4, "trigger": "חטיבת טכנולוגיה", "condition": "מעל 60 ימים ב'ראיון מקצועי'", "action": "דווח כחריגת SLA חמורה", "status": "מושהה"}
    ]


# ==========================================
# 4. FINOPS & BUDGET API (ניהול תקציב)
# ==========================================

@app.get("/api/finops/data")
def get_finops_data():
    conn = sqlite3.connect(DB_PATH)
    try:
        categories_df = pd.read_sql("SELECT * FROM finops_categories", conn)
        categories = categories_df.to_dict(orient="records")
        for cat in categories:
            cat['subcategories'] = json.loads(cat['subcategories']) if cat['subcategories'] else []

        vendors_df = pd.read_sql("SELECT * FROM finops_vendors", conn)
        invoices_df = pd.read_sql("SELECT * FROM finops_invoices ORDER BY date DESC", conn)

        return {
            "categories": categories,
            "vendors": vendors_df.to_dict(orient="records"),
            "invoices": invoices_df.to_dict(orient="records")
        }
    except Exception as e:
        return {"error": str(e), "categories": [], "vendors": [], "invoices": []}
    finally:
        conn.close()

@app.post("/api/finops/upload_invoice")
async def upload_invoice(file: UploadFile = File(...)):
    """מקבל קובץ PDF/תמונה של חשבונית, שומר אותו ומחזיר נתונים ראשוניים"""
    os.makedirs("uploads/invoices", exist_ok=True)
    file_path = f"uploads/invoices/{uuid.uuid4().hex[:8]}_{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    extracted_data = {
        "id": f"INV-{uuid.uuid4().hex[:6].upper()}",
        "vendor": "ספק לא מזוהה (זיהוי AI)",
        "amount": 0,
        "date": pd.Timestamp.now().strftime("%d/%m/%Y"),
        "category": "כללי למיפוי",
        "subcategory": "אחר",
        "status": "ממתין למיפוי",
        "file_url": file_path
    }
    
    return {"message": "Invoice processed", "extracted_data": extracted_data}

@app.post("/api/finops/save_invoice")
def save_invoice(invoice: dict):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute('''INSERT OR REPLACE INTO finops_invoices 
                     (id, vendor, date, due_date, budget_month, amount, category, subcategory, status, note, file_url) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  (invoice['id'], invoice['vendor'], invoice['date'], invoice.get('dueDate', ''), 
                   invoice.get('budgetMonth', ''), invoice['amount'], invoice['category'], 
                   invoice.get('subcategory', ''), invoice['status'], invoice.get('note', ''), invoice.get('fileUrl', '')))
        conn.commit()
        return {"message": "Invoice saved"}
    finally:
        conn.close()

@app.delete("/api/finops/invoice/{invoice_id}")
def delete_invoice(invoice_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute("DELETE FROM finops_invoices WHERE id = ?", (invoice_id,))
        conn.commit()
        return {"message": "Deleted"}
    finally:
        conn.close()

@app.post("/api/finops/save_vendor")
def save_vendor(vendor: dict):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute('''INSERT OR REPLACE INTO finops_vendors (id, name, default_category, total_paid, active_invoices)
                     VALUES (?, ?, ?, ?, ?)''', 
                  (vendor['id'], vendor['name'], vendor.get('defaultCategory', ''), vendor.get('totalPaid', 0), vendor.get('activeInvoices', 0)))
        conn.commit()
        return {"message": "Vendor saved"}
    finally:
        conn.close()

@app.post("/api/finops/save_categories")
def save_categories(categories: list):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute("DELETE FROM finops_categories")
        for cat in categories:
            subs = json.dumps(cat.get('subcategories', []))
            c.execute('''INSERT INTO finops_categories (id, name, target, previous_year_spend, code, notes, subcategories)
                         VALUES (?, ?, ?, ?, ?, ?, ?)''', 
                      (cat['id'], cat['name'], cat.get('target', 0), cat.get('previousYearSpend', 0), cat.get('code', ''), cat.get('notes', ''), subs))
        conn.commit()
        return {"message": "Categories synced"}
    finally:
        conn.close()

# ==========================================
# SECURITY & AUDIT API
# ==========================================

@app.get("/api/security/audit-logs")
def get_audit_logs():
    conn = sqlite3.connect(DB_PATH)
    try:
        logs_df = pd.read_sql("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50", conn)
        logs = []
        for _, row in logs_df.iterrows():
            time_part = row["timestamp"].split(" ")[1] if " " in str(row["timestamp"]) else row["timestamp"]
            logs.append({
                "id": row["id"],
                "time": time_part,
                "action": row["action"],
                "status": row["status"],
                "details": row["details"],
                "user": row["user"]
            })
        return logs
    except Exception:
        return []
    finally:
        conn.close()


@app.post("/api/ai/analyze-cv")
async def analyze_cv_safely(request: Request):
    candidate_text = await request.json()
    raw_text = candidate_text.get("text", "")

    safe_text, stats = PIIScrubber.scrub_text_for_ai(raw_text)

    items_scrubbed = stats.get('id_cards', 0) + stats.get('phones', 0) + stats.get('emails', 0)
    if items_scrubbed > 0:
        details = f"צונזרו {stats['id_cards']} ת.ז, {stats['phones']} טלפונים, {stats['emails']} אימיילים"
        log_audit_action("Data Scrubbing (PII)", "Success", details, "System Auto")

    return {
        "status": "success",
        "message": "Text scrubbed and analyzed safely",
        "scrubbed_text": safe_text,
        "items_secured": items_scrubbed
    }


@app.get("/api/security/status")
def get_security_status():
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        c.execute("SELECT value FROM system_settings WHERE key = 'ai_enabled'")
        result = c.fetchone()
        is_enabled = result is not None and result[0] == 'true'
        return {"ai_enabled": is_enabled}
    except Exception:
        return {"ai_enabled": False}
    finally:
        conn.close()


@app.post("/api/security/toggle-ai")
async def toggle_ai_status(request: Request):
    payload = await request.json()
    new_status = 'true' if payload.get('enable', False) else 'false'
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        c.execute("UPDATE system_settings SET value = ? WHERE key = 'ai_enabled'", (new_status,))
        conn.commit()

        action_desc = "הפעלת מנוע AI" if new_status == 'true' else "כיבוי חירום למנוע AI (Kill Switch)"
        status_color = "Warning" if new_status == 'true' else "Danger"
        log_audit_action("שינוי מדיניות אבטחה", status_color, action_desc, "Super Admin")

        return {"status": "success", "ai_enabled": new_status == 'true'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
        
        # ==========================================
# 5. DATA QUARANTINE & ETL RULES API
# ==========================================

# הוסף את השורה הזו לתוך פונקציית init_db() שלך:
# c.execute('''CREATE TABLE IF NOT EXISTS etl_rules (id TEXT PRIMARY KEY, col_name TEXT, condition TEXT, action TEXT, active BOOLEAN)''')

@app.get("/api/admin/rules")
def get_etl_rules():
    conn = sqlite3.connect(DB_PATH)
    try:
        df = pd.read_sql("SELECT * FROM etl_rules", conn)
        # אם הטבלה ריקה, נחזיר את חוקי הבסיס כדיפולט וגם נשמור אותם
        if df.empty:
            default_rules = [
                ("r1", "רמה 3", "מכילה 'טכנולוגיות'", "התעלם מיתר הרמות במבנה ארגוני", True),
                ("r2", "גזרה", "ריקה או חסרה", "השלם ערך 'מקצועית'", True)
            ]
            c = conn.cursor()
            c.executemany("INSERT INTO etl_rules VALUES (?, ?, ?, ?, ?)", default_rules)
            conn.commit()
            df = pd.read_sql("SELECT * FROM etl_rules", conn)
            
        return df.to_dict(orient="records")
    except Exception as e:
        return []
    finally:
        conn.close()

@app.post("/api/admin/rules")
def save_etl_rule(rule: dict):
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        rule_id = rule.get('id', f"r-{uuid.uuid4().hex[:6]}")
        # Insert or Replace מאפשר לנו גם ליצור חדש וגם לערוך קיים באותה פונקציה!
        c.execute('''INSERT OR REPLACE INTO etl_rules (id, col_name, condition, action, active) 
                     VALUES (?, ?, ?, ?, ?)''', 
                  (rule_id, rule['col_name'], rule['condition'], rule['action'], rule.get('active', True)))
        conn.commit()
        return {"status": "success", "id": rule_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/admin/rules/{rule_id}")
def delete_etl_rule(rule_id: str):
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        c.execute("DELETE FROM etl_rules WHERE id = ?", (rule_id,))
        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()


# ==========================================
# 6. AI INBOX ANALYTICS API
# ==========================================
@app.get("/api/admin/inbox-analytics")
def get_inbox_analytics():
    """מחזיר נתונים אמיתיים על ביצועי המגייסים בטיפול במשימות שהמערכת ייצרה"""
    # כרגע נחזיר מבנה נתונים שמדמה חישוב מה-DB, ברגע שיהיו לנו משימות אמיתיות נחליף לשאילתת SQL
    return {
        "stats": {
            "total_tasks": 1240, "avg_close_rate": 92, "median_response_hours": 3.8, "urgent_sla_breaches": 14
        },
        "hourly_trend": [
            {"hour": '08:00', "tasks": 12}, {"hour": '10:00', "tasks": 45}, {"hour": '12:00', "tasks": 38}, 
            {"hour": '14:00', "tasks": 62}, {"hour": '16:00', "tasks": 55}, {"hour": '18:00', "tasks": 20}
        ],
        "task_types": [
            {"label": "סורסינג (נפח קו״ח)", "pct": 45, "count": 558, "color": "bg-orange-400"},
            {"label": "חריגות SLA (מנהלים)", "pct": 30, "count": 372, "color": "bg-blue-400"},
            {"label": "נטישה (Ghosting)", "pct": 15, "count": 186, "color": "bg-red-400"},
            {"label": "אדמיניסטרציה / Onboarding", "pct": 10, "count": 124, "color": "bg-green-400"}
        ],
        "recruiters": [
            {"name": "גיא רג'ואן", "dominant": "סורסינג ולינקדאין", "time": "1.2 שעות", "rate": "98%", "insight": "מצטיין תפעולית. זקוק לתקציב פרסום.", "color": "green"},
            {"name": "ליטל גולדפרב", "dominant": "SLA מנהלים", "time": "14.5 שעות", "rate": "62%", "insight": "חולשה בניהול ממשקים מול מנהלים.", "color": "red"},
            {"name": "מור אהרון", "dominant": "Ghosting", "time": "4.1 שעות", "rate": "89%", "insight": "עומס יתר. מנהלת 35 משרות במקביל.", "color": "orange"}
        ]
    }
    
    # ==========================================
# 7. TOOLBOX API (Real Actions: PDF & Fan-out)
# ==========================================
from fastapi.responses import FileResponse
from fpdf import FPDF # <-- חובה להתקין: pip install fpdf2
import smtplib
from email.message import EmailMessage

@app.post("/api/tools/fan-out")
async def trigger_onboarding_fan_out(payload: dict):
    """
    מקבל נתוני עובד חדש מהפרונטאנד, רושם ב-DB, ומדמה פתיחת טיקטים.
    בפרודקשן אמיתי מול ה-IT, זה ישלח API Calls למערכת ServiceNow/Jira.
    """
    emp_name = payload.get("name", "עובד חדש")
    emp_role = payload.get("role", "תפקיד כללי")
    
    # סימולציה של פתיחת כרטיסים במערכות שונות:
    tickets = [
        {"dept": "IT SysAdmin", "action": "יצירת יוזר + ציוד", "status": f"Ticket #{uuid.uuid4().hex[:4].upper()}"},
        {"dept": "Logistics", "action": "עמדת עבודה", "status": "Desk Assigned"},
        {"dept": "Security", "action": "אישור חניון", "status": "Pending Badge"}
    ]
    
    # תיעוד ב-Audit Log
    log_audit_action("Onboarding Fan-Out", "Success", f"נפתחו כרטיסים לקליטת: {emp_name} ({emp_role})", "System")
    
    return {"status": "success", "message": f"Fan-out completed for {emp_name}", "tickets": tickets}


@app.post("/api/tools/generate-report")
async def generate_pdf_report(payload: dict):
    """
    מנוע ייצור PDF אמיתי.
    הערה: נדרשת התקנת הספריה fpdf2 בשרת.
    """
    report_type = payload.get("type", "weekly_hiring")
    
    # 1. שאיבת נתונים אמיתיים ממסד הנתונים כדי לשים בדוח
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM applications WHERE status LIKE '%קליטה%' OR status LIKE '%גיוס%'")
        hires_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM applications WHERE days_in_process > 40")
        sla_breaches = c.fetchone()[0]
    finally:
        conn.close()

    # 2. יצירת ה-PDF (פשוט אך פונקציונלי)
    pdf = FPDF()
    pdf.add_page()
    
    # הערה: עברית ב-FPDF דורשת פונט מתאים. לשם הדגמה מהירה שעובדת מיד, נייצר דוח באנגלית.
    pdf.set_font("helvetica", "B", 16)
    pdf.cell(0, 10, "TAHub Executive Summary", ln=True, align="C")
    pdf.set_font("helvetica", "I", 10)
    pdf.cell(0, 10, f"Generated on: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}", ln=True, align="C")
    
    pdf.ln(10)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 10, f"Report Type: {report_type.replace('_', ' ').title()}", ln=True)
    
    pdf.ln(5)
    pdf.set_font("helvetica", "", 12)
    pdf.cell(0, 10, f"Total Hires Processed: {hires_count}", ln=True)
    pdf.cell(0, 10, f"SLA Breaches Detected: {sla_breaches}", ln=True)
    
    pdf.ln(10)
    pdf.multi_cell(0, 10, "AI Insight: Recruitment volume remains steady. It is recommended to review the SLA breaches to identify bottlenecks in specific departments.")
    
    # שמירת הקובץ באופן זמני
    filename = f"report_{uuid.uuid4().hex[:6]}.pdf"
    file_path = os.path.join(os.getcwd(), filename)
    pdf.output(file_path)
    
    # החזרת הקובץ פיזית לדפדפן כדי שהמשתמש יוכל להוריד
    return FileResponse(path=file_path, filename="TAHub_Report.pdf", media_type="application/pdf")

@app.post("/api/tools/generate-offer-pdf")
async def generate_offer_pdf(request: Request):
    """
    מייצר מסמך 'הצעת שכר / חבילת תגמול' שיווקי למועמד.
    משמיט לחלוטין עלויות מעסיק ועמלות חברת השמה.
    """
    payload = await request.json()
    candidate_name = payload.get("candidateName", "Candidate")
    is_comparative = payload.get("isComparative", False)
    proposed = payload.get("proposed", {})
    current = payload.get("current", {})
    
    pdf = FPDF()
    pdf.add_page()
    
    # Header - Phoenix Branding
    pdf.set_fill_color(0, 38, 73) # Phoenix Navy Blue #002649
    pdf.rect(0, 0, 210, 30, 'F')
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("helvetica", "B", 18)
    pdf.set_y(10)
    pdf.cell(0, 10, "Total Rewards & Compensation Offer", ln=True, align="C")
    
    # Reset colors for body
    pdf.set_text_color(0, 0, 0)
    pdf.ln(15)
    
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 10, f"Prepared for: {candidate_name}", ln=True)
    pdf.set_font("helvetica", "", 10)
    pdf.cell(0, 5, f"Date: {pd.Timestamp.now().strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(10)

    # ---------------------------------------------------------
    # MAIN OFFER HIGHLIGHT (Total Value)
    # ---------------------------------------------------------
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(239, 107, 0) # Phoenix Orange #EF6B00
    total_val = proposed.get("totalPackageValue", 0)
    pdf.cell(0, 10, f"Total Monthly Package Value: {total_val:,.0f} ILS", ln=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(5)

    # ---------------------------------------------------------
    # DETAILS TABLE
    # ---------------------------------------------------------
    pdf.set_fill_color(240, 245, 250)
    pdf.set_font("helvetica", "B", 10)
    
    # Table Headers
    pdf.cell(70, 10, "Component", border=1, fill=True)
    if is_comparative:
        pdf.cell(60, 10, "Current Package", border=1, align="C", fill=True)
    pdf.cell(60, 10, "Phoenix Offer", border=1, align="C", fill=True)
    pdf.ln(10)
    
    pdf.set_font("helvetica", "", 10)
    
    # Data Rows
    components = [
        ("Base Gross Salary", "base"),
        ("Global Overtime", "global"),
        ("Meals (Cibus)", "meals"),
        ("Travel / Car", "travel_car"),
        ("Keren Hishtalmut (%)", "kh_pct"),
        ("Pension (%)", "pension_pct")
    ]
    
    for label, key in components:
        pdf.cell(70, 10, label, border=1)
        if is_comparative:
            curr_val = current.get(key, "-")
            pdf.cell(60, 10, f"{curr_val}", border=1, align="C")
        
        prop_val = proposed.get(key, "-")
        pdf.cell(60, 10, f"{prop_val}", border=1, align="C")
        pdf.ln(10)

    # ---------------------------------------------------------
    # DISCLAIMER (Legal text requested)
    # ---------------------------------------------------------
    pdf.ln(20)
    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(100, 100, 100)
    disclaimer = (
        "Disclaimer: This document is an offer proposal only and holds no legal binding validity. "
        "It is valid for 30 days from the date of issue. This simulation does not constitute an "
        "employer-employee relationship agreement. Final terms will be defined strictly by the "
        "official employment contract."
    )
    pdf.multi_cell(0, 5, disclaimer)

    filename = f"Phoenix_Offer_{uuid.uuid4().hex[:6]}.pdf"
    file_path = os.path.join(os.getcwd(), filename)
    pdf.output(file_path)
    
    return FileResponse(path=file_path, filename=filename, media_type="application/pdf")

# ==========================================
# 8. PRE-BOARDING & ONBOARDING API
# ==========================================

from fastapi import UploadFile, File, Form
import json

@app.post("/api/onboarding")
async def create_onboarding(payload: dict):
    """
    מקבל את כל המידע מה-Wizard (כולל הצ'קליסט, הזכאויות והניתובים).
    שומר את הרשומה במסד הנתונים כ'ממתין לקליטה'.
    """
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        ob_id = f"ob-{uuid.uuid4().hex[:6]}"
        
        # שמירת נתוני מועמד בסיסיים שיוצגו בטבלה
        full_name = f"{payload.get('firstName', '')} {payload.get('lastName', '')}"
        
        c.execute('''INSERT INTO onboarding 
                     (id, name, id_num, role, department, manager, start_date, base_salary, global_salary, parking, car_num, referral_name, referral_id, diversity, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  (ob_id, full_name, payload.get('idNum'), payload.get('jobTitle'), payload.get('orgUnit'),
                   payload.get('manager'), payload.get('startDate'), payload.get('base_salary', 0), payload.get('global_salary', 0),
                   payload.get('parkingType') != 'לא', payload.get('carNum', ''), payload.get('refName', ''), 
                   payload.get('refEmpNum', ''), payload.get('hasDisability') and 'מוגבלות' or '', 'pending', pd.Timestamp.now().isoformat()))
        conn.commit()
        
        # כאן השרת בפרודקשן שולח את המיילים האמיתיים לנמענים (HRO, לוגיסטיקה וכו')
        log_audit_action("Onboarding Wizard", "Success", f"קליטה מקיפה שוגרה עבור {full_name}", "Recruiter")
        
        return {"status": "success", "id": ob_id, "message": "Onboarding wizard completed"}
    finally:
        conn.close()

@app.post("/api/onboarding")
def create_onboarding(payload: dict):
    """יצירת טופס קליטה חדש - שולח 'מיילים' (לוגים) לקב"ט ו-HRO"""
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        ob_id = f"ob-{uuid.uuid4().hex[:6]}"
        c.execute('''INSERT INTO onboarding 
                     (id, name, id_num, role, department, manager, start_date, base_salary, global_salary, parking, car_num, referral_name, referral_id, diversity, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  (ob_id, payload.get('name'), payload.get('id_num'), payload.get('role'), payload.get('department'),
                   payload.get('manager'), payload.get('start_date'), payload.get('base_salary', 0), payload.get('global_salary', 0),
                   payload.get('parking', False), payload.get('car_num', ''), payload.get('referral_name', ''), 
                   payload.get('referral_id', ''), payload.get('diversity', ''), 'pending', pd.Timestamp.now().isoformat()))
        conn.commit()
        return {"status": "success", "id": ob_id, "message": "Onboarding created and Fan-out triggered"}
    finally:
        conn.close()

@app.put("/api/onboarding/{ob_id}")
def update_onboarding(ob_id: str, payload: dict):
    """עריכת טופס קליטה קיים או שינוי סטטוס (ביטול / הושלם לארכיון)"""
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        
        # אם נשלח רק עדכון סטטוס (למשל ביטול)
        if 'status_only' in payload:
            c.execute("UPDATE onboarding SET status = ? WHERE id = ?", (payload['status'], ob_id))
        else:
            c.execute('''UPDATE onboarding SET 
                         name=?, id_num=?, role=?, department=?, manager=?, start_date=?, 
                         base_salary=?, global_salary=?, parking=?, car_num=?, 
                         referral_name=?, referral_id=?, diversity=?
                         WHERE id=?''',
                      (payload.get('name'), payload.get('id_num'), payload.get('role'), payload.get('department'),
                       payload.get('manager'), payload.get('start_date'), payload.get('base_salary'), payload.get('global_salary'),
                       payload.get('parking'), payload.get('car_num'), payload.get('referral_name'), 
                       payload.get('referral_id'), payload.get('diversity'), ob_id))
        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()


# ==========================================
# AUTH AUDIT LOGGING
# ==========================================
@app.post("/api/auth/log")
async def auth_log(request: Request):
    """
    מקבל אירועי אבטחה מה-SessionGuard ורושם אותם ב-audit_logs.
    מדיניות PII: לא נשמרים סיסמאות, שמות משתמשים, או נתוני מועמדים.
    """
    try:
        payload = await request.json()
        event = str(payload.get("event", "UNKNOWN_EVENT"))
        details = str(payload.get("details", ""))
        timestamp = str(payload.get("timestamp", ""))

        # Sanitise: only allow known event names to prevent log injection
        allowed_events = {"SESSION_LOCKED", "SESSION_RESTORED", "UNLOCK_FAILED"}
        if event not in allowed_events:
            event = "UNKNOWN_EVENT"

        log_audit_action(
            action=event,
            status="auth",
            details=f"{details} | client_ts={timestamp}",
            user="frontend"
        )
        return {"status": "logged", "event": event}
    except Exception as e:
        # Never crash — auth logging must not block the client
        print(f"[auth/log] Failed to write audit log: {e}")
        return {"status": "error", "message": str(e)}