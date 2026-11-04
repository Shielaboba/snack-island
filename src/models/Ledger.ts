export type LedgerWallet = 'auditor_cash' | 'petty_cash'

export type LedgerEntryType =
  | 'opening_cash'
  | 'pos_float'
  | 'pos_remittance'
  | 'owner_remittance'
  | 'petty_issue'
  | 'expense'

export type LedgerExpenseCategory =
  | 'Labor'
  | 'Utilities'
  | 'Supplies'
  | 'Gas'
  | 'Ingredients'
  | 'Maintenance'
  | 'Equipment'
  | 'Misc'
  | 'Other'

export const LEDGER_TABLE = 'ledger_entries'

export const LEDGER_ENTRY_TYPES: LedgerEntryType[] = [
  'opening_cash',
  'pos_float',
  'pos_remittance',
  'owner_remittance',
  'petty_issue',
  'expense'
]

export const LEDGER_EXPENSE_CATEGORIES: LedgerExpenseCategory[] = [
  'Labor',
  'Utilities',
  'Supplies',
  'Gas',
  'Ingredients',
  'Maintenance',
  'Equipment',
  'Misc',
  'Other'
]

export interface LedgerEntry {
  id: string
  entry_date: string
  type: LedgerEntryType
  wallet: LedgerWallet
  amount: number
  category: LedgerExpenseCategory | null
  note: string | null
  transfer_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateLedgerEntryInput {
  entry_date: string
  type: LedgerEntryType
  wallet: LedgerWallet
  amount: number
  category?: LedgerExpenseCategory | null
  note?: string | null
  created_by?: string | null
}

export type LedgerValidationResult =
  | { ok: true }
  | { ok: false; message: string }
