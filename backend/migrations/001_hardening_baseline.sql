CREATE TABLE IF NOT EXISTS etl_rules (
  id TEXT PRIMARY KEY,
  col_name TEXT,
  condition TEXT,
  action TEXT,
  active BOOLEAN
);

CREATE TABLE IF NOT EXISTS onboarding (
  id TEXT PRIMARY KEY,
  name TEXT,
  id_num TEXT,
  role TEXT,
  department TEXT,
  manager TEXT,
  start_date TEXT,
  base_salary REAL,
  global_salary REAL,
  parking BOOLEAN,
  car_num TEXT,
  referral_name TEXT,
  referral_id TEXT,
  diversity TEXT,
  status TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT UNIQUE NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_schema_versions (
  schema_version TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL,
  deprecated INTEGER NOT NULL DEFAULT 0,
  sunset_date TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_rule_versions (
  rule_version TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_batches (
  batch_id TEXT PRIMARY KEY,
  log_id TEXT,
  filename TEXT,
  payload_hash TEXT,
  idempotency_key TEXT,
  schema_version TEXT,
  actor TEXT,
  request_id TEXT,
  status TEXT,
  rows_received INTEGER DEFAULT 0,
  rows_loaded INTEGER DEFAULT 0,
  rows_rejected INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  quality_score REAL DEFAULT 0,
  quality_report TEXT,
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  UNIQUE(idempotency_key, payload_hash)
);

CREATE TABLE IF NOT EXISTS rejected_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT,
  row_index INTEGER,
  reason_code TEXT,
  reason_detail TEXT,
  raw_row TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS batch_entity_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  change_type TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS batch_snapshots_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT,
  snapshot_name TEXT,
  payload_json TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS stg_applications (
  batch_id TEXT,
  row_idx INTEGER,
  name TEXT,
  email TEXT,
  job_title TEXT,
  status TEXT,
  recruiter TEXT,
  start_date TEXT,
  department TEXT,
  source TEXT,
  stage_code TEXT,
  days_in_process INTEGER
);
