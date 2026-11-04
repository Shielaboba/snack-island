-- Migration: Cart Cash Remittance split (total sales + petty cash returned)
-- Date: 2026-11-04
-- Purpose: Store the two cash-in parts of a POS cart remittance.
-- Do not alter orders, expenses, or store_sessions.

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS total_sales NUMERIC,
  ADD COLUMN IF NOT EXISTS petty_cash_returned NUMERIC;

UPDATE ledger_entries
SET
  total_sales = 0,
  petty_cash_returned = amount
WHERE type = 'pos_remittance'
  AND (total_sales IS NULL OR petty_cash_returned IS NULL);

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_cart_cash_chk;

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_cart_cash_chk CHECK (
  (
    type = 'pos_remittance'
    AND total_sales IS NOT NULL
    AND petty_cash_returned IS NOT NULL
    AND total_sales >= 0
    AND petty_cash_returned >= 0
    AND amount = total_sales + petty_cash_returned
  )
  OR (
    type <> 'pos_remittance'
    AND total_sales IS NULL
    AND petty_cash_returned IS NULL
  )
);
