# etl_engine.py
import pandas as pd
import numpy as np
import hashlib
from datetime import datetime
import config

class ETLEngine:
    def process_file(self, uploaded_file):
        """The Master Function: Turns raw file into clean Dataframe"""
        
        # 1. Smart Load (Handling Encoding)
        try:
            df = pd.read_csv(uploaded_file)
        except UnicodeDecodeError:
            uploaded_file.seek(0)
            df = pd.read_csv(uploaded_file, encoding='iso-8859-8')
        except Exception:
            uploaded_file.seek(0)
            df = pd.read_excel(uploaded_file)

        # 2. Validation
        missing_cols = [col for col in config.RAW_DATA_MAPPING.keys() if col not in df.columns]
        if missing_cols:
            raise ValueError(f"חסרות העמודות הבאות בקובץ: {', '.join(missing_cols)}")

        # 3. Rename & Filter
        df = df.rename(columns=config.RAW_DATA_MAPPING)
        clean_df = df[list(config.RAW_DATA_MAPPING.values())].copy()

        # 4. Data Type Conversion
        clean_df['start_date'] = pd.to_datetime(clean_df['start_date'], errors='coerce')
        # If no start date, assume today (to avoid errors)
        clean_df['start_date'] = clean_df['start_date'].fillna(pd.Timestamp.now())

        # 5. Feature Engineering (Calculating Metrics)
        now = pd.Timestamp.now()
        clean_df['days_in_process'] = (now - clean_df['start_date']).dt.days
        clean_df['days_in_process'] = clean_df['days_in_process'].fillna(0).astype(int)

        # 6. Generate Unique Hash (Candidate + Job)
        # This helps us identify the same application across different weekly files
        clean_df['app_hash'] = clean_df.apply(
            lambda x: hashlib.md5(f"{x['candidate_name']}{x['job_title']}".encode()).hexdigest(), axis=1
        )

        return clean_df
