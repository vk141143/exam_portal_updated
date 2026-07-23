-- ============================================================
-- Device / Screen-Share Detection — Audit Logs Extension
-- ============================================================
-- No new table needed. All device events are stored in the
-- existing audit_logs table with severity = 'danger'.
-- This file adds an index + a helper view for the admin UI.
-- ============================================================

-- 1. Index to quickly filter device-related events
CREATE INDEX IF NOT EXISTS idx_audit_logs_device_events
  ON audit_logs (severity, created_at DESC)
  WHERE severity = 'danger';

-- 2. View: device_events — only hardware/screen-share violations
CREATE OR REPLACE VIEW device_events AS
SELECT
  id,
  created_at,
  actor          AS candidate_name,
  event          AS description,
  severity,
  client         AS user_agent,
  ip_address
FROM audit_logs
WHERE
  severity = 'danger'
  AND (
    event ILIKE '%USB device%'
    OR event ILIKE '%HID device%'
    OR event ILIKE '%external display%'
    OR event ILIKE '%dual monitor%'
    OR event ILIKE '%screen shar%'
    OR event ILIKE '%screen cast%'
    OR event ILIKE '%media device%'
    OR event ILIKE '%external input%'
    OR event ILIKE '%display/capture%'
  )
ORDER BY created_at DESC;

-- 3. (Optional) RLS — allow authenticated admins to read audit_logs
-- Already covered by your existing audit_logs RLS policy.
-- If you need to expose the view:
-- GRANT SELECT ON device_events TO authenticated;

-- ============================================================
-- What gets logged automatically (from exam.tsx):
-- ============================================================
-- • "External display / dual monitor detected — <exam>"
--     → screen.isExtended = true at exam start
-- • "Screen sharing / screen cast attempted — <exam>"
--     → navigator.mediaDevices.getDisplayMedia() called
-- • "USB device connected: <product name> — <exam>"
--     → navigator.usb 'connect' event
-- • "HID device connected: <product name> — <exam>"
--     → navigator.hid 'connect' event
-- • "New display/capture device detected via mediaDevices — <exam>"
--     → mediaDevices 'devicechange' event (display input)
-- • "Media device change detected (possible external device) — <exam>"
--     → mediaDevices 'devicechange' event (other)
-- ============================================================
-- All of the above also trigger addWarning() which:
--   • Shows the warning popup to the candidate
--   • Counts toward the 2-warning termination limit
--   • Updates exam_sessions.warnings
-- ============================================================
