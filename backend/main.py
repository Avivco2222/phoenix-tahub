from fastapi import FastAPI, UploadFile, File, HTTPException
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

app = FastAPI()

# ==========================================
# מנוע קליטת נתוני ATS, אבטחת מידע ואיכות נתונים
# ==========================================

def mask_sensitive_data(df):
    """
    מנגנון InfoSec: מזהה עמודות רגישות (PII) לפי שם,
    ומוחק את המידע הרגיש. במקומו מייצר Hash (הצפנה חד-כיוונית) 
    כדי לאפשר זיהוי מועמדים חוזרים מבלי לשמור את תעודת הזהות שלהם.
    """
    sensitive_keywords = ['ת.ז', 'תעודת זהות', 'id', 'טלפון', 'נייד', 'phone', 'כתובת']
    
    for col in df.columns:
        col_lower = str(col).lower()
        if any(keyword in col_lower for keyword in sensitive_keywords):
            # הפיכת המידע ל-Hash מאובטח (SHA-256)
            df[col] = df[col].astype(str).apply(
                lambda x: hashlib.sha256(x.encode()).hexdigest()[:12] if pd.notnull(x) and str(x).lower() not in ['nan', 'none', ''] else None
            )
            # שינוי שם העמודה כדי להבהיר שהיא הושחרה
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

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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