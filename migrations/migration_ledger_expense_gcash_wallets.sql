-- Migration: Ledger expense wallet + GCash (replace standing petty-cash float)
-- Date: 2026-11-04
-- Purpose: If ledger_entries already exists from v1 (petty_cash / petty_issue),
-- remap it. Fresh installs use migration_add_ledger_entries.sql only.
-- Do not alter orders, expenses, or store_sessions.

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_type_check;
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_wallet_check;
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_petty_transfer_chk;
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_transfer_chk;
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_auditor_wallet_chk;
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_gcash_wallet_chk;
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_fund_expense_wallet_chk;

UPDATE ledger_entries SET type = 'fund_expense' WHERE type = 'petty_issue';
UPDATE ledger_entries SET wallet = 'expense' WHERE wallet = 'petty_cash';

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_type_check
  CHECK (type IN (
    'opening_cash',
    'pos_float',
    'pos_remittance',
    'gcash_remittance',
    'owner_remittance',
    'fund_expense',
    'expense'
  ));

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_wallet_check
  CHECK (wallet IN ('auditor_cash', 'expense', 'gcash'));

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_transfer_chk
  CHECK (
    (type = 'fund_expense' AND transfer_id IS NOT NULL)
    OR (type <> 'fund_expense' AND transfer_id IS NULL)
  );

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_auditor_wallet_chk
  CHECK (
    type NOT IN ('opening_cash', 'pos_float', 'pos_remittance', 'owner_remittance')
    OR wallet = 'auditor_cash'
  );

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_gcash_wallet_chk
  CHECK (
    type <> 'gcash_remittance' OR wallet = 'gcash'
  );

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_fund_expense_wallet_chk
  CHECK (
    type <> 'fund_expense' OR wallet IN ('auditor_cash', 'expense')
  );
