# config.py

# --- Phoenix Brand Palette ---
COLORS = {
    "primary": "#002649",       # Deep Phoenix Blue
    "secondary": "#EF6B00",     # Phoenix Orange
    "background": "#F4F7F6",    # Clean Light Gray (SaaS style)
    "card_bg": "#FFFFFF",       # White
    "text_main": "#1A202C",     # Dark Gray (Better than black)
    "text_sub": "#718096",      # Soft Gray
    "success": "#38A169",       # Green
    "warning": "#ECC94B",       # Yellow
    "danger": "#E53E3E"         # Red
}

# --- Database Config ---
DB_NAME = "phoenix_talent_os.db"

# --- Column Mapping (Hebrew to System) ---
# מיפוי מדויק לפי הקובץ ששלחת
RAW_DATA_MAPPING = {
    'שם מועמד': 'candidate_name',
    'מצב שיוך למשרה': 'status',
    'מגייס': 'recruiter',
    'תחילת גיוס': 'start_date',
    'תאריך עדכון': 'last_update',
    'רמה 2': 'division',        # חטיבה
    'רמה 4': 'department',      # מחלקה
    'שם המשרה': 'job_title',
    'סוג ספק': 'source_type',
    'שם הספק': 'source_name'
}
