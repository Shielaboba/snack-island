export type LedgerWallet = 'auditor_cash' | 'expense' | 'gcash'

export type LedgerEntryType =
  | 'opening_cash'
  | 'pos_float'
  | 'pos_remittance'
  | 'gcash_remittance'
  | 'owner_remittance'
  | 'fund_expense'
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

export const LEDGER_WALLETS: LedgerWallet[] = ['auditor_cash', 'expense', 'gcash']

export const LEDGER_ENTRY_TYPES: LedgerEntryType[] = [
  'opening_cash',
  'pos_float',
  'pos_remittance',
  'gcash_remittance',
  'owner_remittance',
  'fund_expense',
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
  total_sales?: number | null
  petty_cash_returned?: number | null
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
  total_sales?: number | null
  petty_cash_returned?: number | null
  created_by?: string | null
}

export type LedgerValidationResult =
  | { ok: true }
  | { ok: false; message: string }
