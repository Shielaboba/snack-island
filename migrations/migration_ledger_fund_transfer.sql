-- Migration: Fund Transfer Wallet (source → destination)
-- Date: 2026-11-04
-- Purpose: Move cash among Auditor, GCash, and Owner. Expense wallet is not a party.
-- Additive only. Do not alter orders, expenses, or store_sessions.

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS transfer_from text,
  ADD COLUMN IF NOT EXISTS transfer_to text;

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_type_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_type_check
  CHECK (type IN (
    'opening_cash',
    'pos_float',
    'pos_remittance',
    'gcash_remittance',
    'owner_remittance',
    'fund_expense',
    'fund_transfer',
    'expense'
  ));

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_transfer_chk;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_transfer_chk
  CHECK (
    (type = 'fund_expense' AND transfer_id IS NOT NULL)
    OR (
      type = 'fund_transfer'
      AND transfer_from IN ('auditor_cash', 'gcash', 'owner')
      AND transfer_to IN ('auditor_cash', 'gcash', 'owner')
      AND transfer_from <> transfer_to
      AND (
        (
          transfer_from IN ('auditor_cash', 'gcash')
          AND transfer_to IN ('auditor_cash', 'gcash')
          AND transfer_id IS NOT NULL
        )
        OR (
          (transfer_from = 'owner' OR transfer_to = 'owner')
          AND transfer_id IS NULL
        )
      )
    )
    OR (type NOT IN ('fund_expense', 'fund_transfer') AND transfer_id IS NULL)
  );

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_fund_transfer_parties_chk;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_fund_transfer_parties_chk
  CHECK (
    (
      type = 'fund_transfer'
      AND transfer_from IN ('auditor_cash', 'gcash', 'owner')
      AND transfer_to IN ('auditor_cash', 'gcash', 'owner')
    )
    OR (
      type <> 'fund_transfer'
      AND transfer_from IS NULL
      AND transfer_to IS NULL
    )
  );

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_fund_transfer_wallet_chk;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_fund_transfer_wallet_chk
  CHECK (
    type <> 'fund_transfer'
    OR (
      wallet IN ('auditor_cash', 'gcash')
      AND (wallet = transfer_from OR wallet = transfer_to)
    )
  );
