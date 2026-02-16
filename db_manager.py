# db_manager.py
import sqlite3
import pandas as pd
from datetime import datetime
import config

class DatabaseManager:
    def __init__(self):
        self.conn = sqlite3.connect(config.DB_NAME, check_same_thread=False)
        self.init_schema()

    def init_schema(self):
        """Builds the database structure if it doesn't exist."""
        c = self.conn.cursor()
        
        # 1. Uploads History (Who uploaded what and when)
        c.execute('''CREATE TABLE IF NOT EXISTS uploads_log (
                        upload_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        filename TEXT,
                        upload_date TIMESTAMP,
                        total_records INTEGER,
                        status TEXT
                    )''')

        # 2. Main Candidates Table (With snapshot_id linking to upload)
        # This structure allows us to see the state of a candidate at ANY point in time (Time Machine)
        c.execute('''CREATE TABLE IF NOT EXISTS candidates_snapshot (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        upload_id INTEGER,
                        candidate_name TEXT,
                        job_title TEXT,
                        status TEXT,
                        recruiter TEXT,
                        division TEXT,
                        department TEXT,
                        start_date TIMESTAMP,
                        days_in_process INTEGER,
                        source_name TEXT,
                        app_hash TEXT,
                        FOREIGN KEY(upload_id) REFERENCES uploads_log(upload_id)
                    )''')
        
        self.conn.commit()

    def log_upload(self, filename, count):
        """Starts a new upload session"""
        c = self.conn.cursor()
        c.execute("INSERT INTO uploads_log (filename, upload_date, total_records, status) VALUES (?, ?, ?, ?)",
                  (filename, datetime.now(), count, 'SUCCESS'))
        self.conn.commit()
        return c.lastrowid

    def save_snapshot(self, df, filename):
        """Saves a full snapshot of the current report"""
        upload_id = self.log_upload(filename, len(df))
        
        # Add the upload_id to the dataframe so we know which batch this belongs to
        df_save = df.copy()
        df_save['upload_id'] = upload_id
        
        # Save to DB
        df_save.to_sql('candidates_snapshot', self.conn, if_exists='append', index=False)
        return upload_id

    def get_latest_snapshot(self):
        """Retrieves only the most recent data"""
        query = """
        SELECT * FROM candidates_snapshot 
        WHERE upload_id = (SELECT MAX(upload_id) FROM uploads_log)
        """
        try:
            return pd.read_sql(query, self.conn)
        except Exception:
            return pd.DataFrame()

    def get_upload_history(self):
        try:
            return pd.read_sql("SELECT * FROM uploads_log ORDER BY upload_date DESC", self.conn)
        except Exception:
            return pd.DataFrame()
