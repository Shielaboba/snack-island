-- Migration: Staff OT is request-only (minimum 2 hours)
-- Date: 2026-11-04
-- Purpose: Additive columns on staff_clock_shifts. Do not alter other tables.

ALTER TABLE staff_clock_shifts
  ADD COLUMN IF NOT EXISTS ot_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ot_status TEXT CHECK (ot_status IN ('pending', 'approved', 'declined')),
  ADD COLUMN IF NOT EXISTS ot_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN staff_clock_shifts.ot_requested IS 'Staff tapped Request OT on Clock. OT is not recorded without this.';
COMMENT ON COLUMN staff_clock_shifts.ot_status IS 'pending/approved/declined. Time keeps running while pending.';
