# app.py
import streamlit as st
import pandas as pd
from db_manager import DatabaseManager
from etl_engine import ETLEngine
import config

# --- 1. System Config ---
st.set_page_config(page_title="Phoenix Talent OS", page_icon="🦁", layout="wide")
db = DatabaseManager()
etl = ETLEngine()

# --- 2. Premium CSS Injection (The "Rolls Royce" Look) ---
st.markdown(f"""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&display=swap');
    
    html, body, [class*="css"] {{
        font-family: 'Heebo', sans-serif;
        direction: rtl;
        text-align: right;
        background-color: {config.COLORS['background']};
    }}
    
    /* Header Styles */
    .top-nav {{
        background: {config.COLORS['card_bg']};
        padding: 1.5rem 2rem;
        border-bottom: 3px solid {config.COLORS['secondary']};
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }}
    
    .nav-logo {{
        font-size: 1.5rem;
        font-weight: 700;
        color: {config.COLORS['primary']};
    }}
    
    /* Cards Styles */
    .metric-card {{
        background: {config.COLORS['card_bg']};
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-right: 4px solid {config.COLORS['primary']};
        transition: transform 0.2s;
    }}
    .metric-card:hover {{
        transform: translateY(-2px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        border-right-color: {config.COLORS['secondary']};
    }}
    
    /* Streamlit Overrides */
    .stApp > header {{visibility: hidden;}}
    .block-container {{padding-top: 0; padding-bottom: 0;}}
    
    /* Buttons */
    .stButton button {{
        background-color: {config.COLORS['primary']};
        color: white;
        border-radius: 8px;
        border: none;
        padding: 10px 24px;
        font-weight: 500;
    }}
    .stButton button:hover {{
        background-color: {config.COLORS['secondary']};
        border: none;
        color: white;
    }}
</style>
""", unsafe_allow_html=True)

# --- 3. Header Component ---
st.markdown(f"""
<div class="top-nav">
    <div class="nav-logo">
        🦁 PHOENIX <span style="color:{config.COLORS['secondary']}; font-weight:300;">TALENT OS</span>
    </div>
    <div style="font-size: 0.9rem; color: #718096;">
        מערכת הפעלה לגיוס • גרסת Enterprise
    </div>
</div>
""", unsafe_allow_html=True)

# --- 4. Navigation (Session State) ---
if 'page' not in st.session_state:
    st.session_state.page = 'dashboard'

# --- 5. Main Application Logic ---

# Sidebar Navigation
with st.sidebar:
    st.markdown("### תפריט ניווט")
    if st.button("📊 דשבורד מנהלים"):
        st.session_state.page = 'dashboard'
    if st.button("⚙️ ניהול מערכת (Admin)"):
        st.session_state.page = 'admin'
    
    st.markdown("---")
    st.caption("גרסה: 1.0.0 (Foundation)")

# PAGE: ADMIN (Ingestion & History)
if st.session_state.page == 'admin':
    st.title("ניהול נתונים ותשתיות")
    
    tab1, tab2 = st.tabs(["📥 טעינת קבצים", "📜 היסטוריית טעינות"])
    
    with tab1:
        st.markdown("##### טעינת דוח שבועי חדש")
        st.info("אנא העלה את קובץ ה-Excel/CSV הגולמי. המערכת תבצע בדיקת תקינות, ניקוי וגיבוי אוטומטי.")
        
        uploaded_file = st.file_uploader("גרור קובץ לכאן", type=['csv', 'xlsx'])
        
        if uploaded_file:
            with st.spinner("מבצע ETL וניתוח נתונים..."):
                try:
                    # Run ETL
                    clean_df = etl.process_file(uploaded_file)
                    # Save to DB
                    upload_id = db.save_snapshot(clean_df, uploaded_file.name)
                    
                    st.success(f"✅ הטעינה הושלמה בהצלחה! (מזהה טעינה: {upload_id})")
                    st.markdown(f"**סיכום טעינה:** {len(clean_df)} רשומות נקלטו בבסיס הנתונים.")
                    
                except ValueError as e:
                    st.error(f"❌ שגיאת מבנה קובץ: {e}")
                except Exception as e:
                    st.error(f"❌ שגיאה קריטית: {e}")

    with tab2:
        st.markdown("##### לוג פעילות מערכת")
        history = db.get_upload_history()
        if not history.empty:
            st.dataframe(history, use_container_width=True)
        else:
            st.info("עדיין לא בוצעו טעינות.")

# PAGE: DASHBOARD (Phase 2 Preview)
elif st.session_state.page == 'dashboard':
    df = db.get_latest_snapshot()
    
    if df.empty:
        st.warning("⚠️ טרם נטענו נתונים למערכת. אנא גש למסך הניהול לביצוע טעינה ראשונית.")
        st.button("עבור למסך ניהול", on_click=lambda: st.session_state.update(page='admin'))
    else:
        st.markdown("### תמונת מצב שבועית")
        
        # Simple Phase 1 KPIs just to show data exists
        col1, col2, col3, col4 = st.columns(4)
        
        total = len(df)
        active = len(df[~df['status'].str.contains('גיוס|הסרה|דחייה', na=False, regex=True)])
        avg_days = int(df['days_in_process'].mean()) if 'days_in_process' in df.columns else 0
        
        with col1:
            st.markdown(f'<div class="metric-card"><div>סה"כ בטיפול</div><h2 style="color:{config.COLORS["primary"]}">{total}</h2></div>', unsafe_allow_html=True)
        with col2:
            st.markdown(f'<div class="metric-card"><div>פעילים בתהליך</div><h2 style="color:{config.COLORS["secondary"]}">{active}</h2></div>', unsafe_allow_html=True)
        with col3:
            st.markdown(f'<div class="metric-card"><div>זמן גיוס ממוצע</div><h2 style="color:{config.COLORS["primary"]}">{avg_days} ימים</h2></div>', unsafe_allow_html=True)
             
        st.markdown("###")
        st.markdown("📊 **הנתונים מוכנים לשלב 2: בניית הסימולטורים וה-AI.**")
        st.dataframe(df.head(10), use_container_width=True)
