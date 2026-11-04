-- Migration: Add staff_clock_shifts for selfie clock in/out
-- Date: 2026-11-04
-- Purpose: Independent Shai/Den attendance. Do not alter existing tables.

CREATE TABLE IF NOT EXISTS staff_clock_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name TEXT NOT NULL CHECK (staff_name IN ('Shai', 'Den')),
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ,
  clock_in_photo_path TEXT,
  clock_out_photo_path TEXT,
  clock_in_status TEXT NOT NULL DEFAULT 'pending' CHECK (clock_in_status IN ('pending', 'approved', 'declined')),
  clock_out_status TEXT CHECK (clock_out_status IN ('pending', 'approved', 'declined')),
  clock_in_override BOOLEAN NOT NULL DEFAULT false,
  clock_out_override BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_clock_shifts_out_after_in_chk CHECK (
    clock_out_at IS NULL OR clock_out_at > clock_in_at
  )
);

CREATE INDEX IF NOT EXISTS idx_staff_clock_shifts_in_at
  ON staff_clock_shifts (clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_clock_shifts_staff_name
  ON staff_clock_shifts (staff_name, clock_in_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS staff_clock_shifts_one_open
  ON staff_clock_shifts (staff_name)
  WHERE clock_out_at IS NULL AND clock_in_status <> 'declined';

COMMENT ON TABLE staff_clock_shifts IS 'Shai/Den clock in and out. Independent of POS store sessions.';

ALTER TABLE staff_clock_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read staff clock shifts"
  ON staff_clock_shifts FOR SELECT USING (true);

CREATE POLICY "Allow insert staff clock shifts"
  ON staff_clock_shifts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update staff clock shifts"
  ON staff_clock_shifts FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete staff clock shifts"
  ON staff_clock_shifts FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-clock-photos', 'staff-clock-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "staff clock photos public read" ON storage.objects;
CREATE POLICY "staff clock photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'staff-clock-photos');

DROP POLICY IF EXISTS "staff clock photos upload" ON storage.objects;
CREATE POLICY "staff clock photos upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'staff-clock-photos');

DROP POLICY IF EXISTS "staff clock photos update" ON storage.objects;
CREATE POLICY "staff clock photos update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'staff-clock-photos')
  WITH CHECK (bucket_id = 'staff-clock-photos');

DROP POLICY IF EXISTS "staff clock photos delete" ON storage.objects;
CREATE POLICY "staff clock photos delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'staff-clock-photos');
