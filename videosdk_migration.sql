-- Run this in Supabase SQL editor
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS meeting_id text;
