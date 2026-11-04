-- Migration: Add ledger_entries for the independent auditor cash book
-- Date: 2026-09-25
-- Purpose: Manual Ledger lines only. Do not alter existing tables.

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'opening_cash',
    'pos_float',
    'pos_remittance',
    'owner_remittance',
    'petty_issue',
    'expense'
  )),
  wallet TEXT NOT NULL CHECK (wallet IN ('auditor_cash', 'petty_cash')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  category TEXT,
  note TEXT,
  transfer_id UUID,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ledger_entries_expense_category_chk CHECK (
    (type = 'expense' AND category IS NOT NULL)
    OR (type <> 'expense' AND category IS NULL)
  ),
  CONSTRAINT ledger_entries_petty_transfer_chk CHECK (
    (type = 'petty_issue' AND transfer_id IS NOT NULL)
    OR (type <> 'petty_issue' AND transfer_id IS NULL)
  ),
  CONSTRAINT ledger_entries_auditor_wallet_chk CHECK (
    type NOT IN ('opening_cash', 'pos_float', 'pos_remittance', 'owner_remittance')
    OR wallet = 'auditor_cash'
  )
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_entry_date
  ON ledger_entries (entry_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_transfer_id
  ON ledger_entries (transfer_id)
  WHERE transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_entries_wallet
  ON ledger_entries (wallet);

COMMENT ON TABLE ledger_entries IS 'Manual auditor cash book. Independent of orders and expenses.';

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read ledger entries"
  ON ledger_entries FOR SELECT USING (true);

CREATE POLICY "Allow insert ledger entries"
  ON ledger_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update ledger entries"
  ON ledger_entries FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete ledger entries"
  ON ledger_entries FOR DELETE USING (true);
