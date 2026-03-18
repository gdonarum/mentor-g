-- Mentor G Feedback Database Schema
-- Run with: wrangler d1 execute mentor-g-feedback --file=schema.sql

CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    problem_description TEXT,
    dslog_filename TEXT,
    dslog_summary TEXT,
    dsevents_filename TEXT,
    dsevents_excerpt TEXT,
    java_filename TEXT,
    java_excerpt TEXT,
    response_summary TEXT,
    findings_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying by date
CREATE INDEX IF NOT EXISTS idx_analyses_timestamp ON analyses(timestamp);

-- Index for finding analyses with specific file types
CREATE INDEX IF NOT EXISTS idx_analyses_files ON analyses(dslog_filename, dsevents_filename, java_filename);
