-- Migration: Add staff_payroll_records for shared payroll setup
-- Date: 2026-11-07
-- Purpose: Staff rates, loans, compensation and payments were saved only in one browser.
-- Keep them here so admin and auditor see the same records on every device.
-- Do not alter other tables.

CREATE TABLE IF NOT EXISTS staff_payroll_records (
  key TEXT PRIMARY KEY CHECK (key IN ('profiles', 'payables', 'compensation', 'payments')),
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE staff_payroll_records IS 'One JSON list per key: staff profiles, loans, compensation and payments.';

ALTER TABLE staff_payroll_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read staff payroll records"
  ON staff_payroll_records FOR SELECT USING (true);

CREATE POLICY "Allow insert staff payroll records"
  ON staff_payroll_records FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update staff payroll records"
  ON staff_payroll_records FOR UPDATE USING (true) WITH CHECK (true);
