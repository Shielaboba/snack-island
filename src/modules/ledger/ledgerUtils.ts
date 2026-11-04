import {
  LEDGER_WALLETS,
  type CreateLedgerEntryInput,
  type LedgerEntry,
  type LedgerEntryType,
  type LedgerValidationResult,
  type LedgerWallet
} from '../../models/Ledger'

const emptyDeltas = () => ({ auditor_cash: 0, expense: 0, gcash: 0 })

export function entryDelta(entry: Pick<LedgerEntry, 'type' | 'wallet' | 'amount'>): {
  auditor_cash: number
  expense: number
  gcash: number
} {
  const amount = entry.amount
  const zero = emptyDeltas()
  if (entry.type === 'opening_cash' || entry.type === 'pos_remittance') {
    return { ...zero, auditor_cash: amount }
  }
  if (entry.type === 'gcash_remittance') {
    return { ...zero, gcash: amount }
  }
  if (
    entry.type === 'pos_float' ||
    entry.type === 'owner_remittance' ||
    (entry.type === 'expense' && entry.wallet === 'auditor_cash') ||
    (entry.type === 'fund_expense' && entry.wallet === 'auditor_cash')
  ) {
    return { ...zero, auditor_cash: -amount }
  }
  if (entry.type === 'fund_expense' && entry.wallet === 'expense') {
    return { ...zero, expense: amount }
  }
  if (entry.type === 'expense' && entry.wallet === 'expense') {
    return { ...zero, expense: -amount }
  }
  if (entry.type === 'expense' && entry.wallet === 'gcash') {
    return { ...zero, gcash: -amount }
  }
  return zero
}

export function walletRemaining(entries: LedgerEntry[], wallet: LedgerWallet): number {
  return entries.reduce((sum, entry) => sum + entryDelta(entry)[wallet], 0)
}

export function dailyRemaining(
  entries: LedgerEntry[],
  wallet: LedgerWallet,
  date: string
): number {
  return walletRemaining(entries.filter((entry) => entry.entry_date <= date), wallet)
}

export type NegativeDay = { wallet: LedgerWallet; date: string; balance: number }

/** First date where a wallet's end-of-day running balance drops below zero. */
export function firstNegativeDay(entries: LedgerEntry[]): NegativeDay | null {
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const balance = emptyDeltas()
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!
    const delta = entryDelta(entry)
    for (const wallet of LEDGER_WALLETS) {
      balance[wallet] += delta[wallet]
    }
    const endOfDay = sorted[i + 1]?.entry_date !== entry.entry_date
    if (!endOfDay) continue
    for (const wallet of LEDGER_WALLETS) {
      // Round to centavos so float noise (0.1 + 0.2 - 0.3) is not read as negative.
      if (Math.round(balance[wallet] * 100) < 0) {
        return { wallet, date: entry.entry_date, balance: balance[wallet] }
      }
    }
  }
  return null
}

function negativeDayMessage(day: NegativeDay): string {
  return `${ledgerWalletLabel(day.wallet)} would go negative on ${day.date} (-${formatPeso(Math.abs(day.balance))}).`
}

export function validateRemoval(
  removedIds: string[],
  existing: LedgerEntry[]
): LedgerValidationResult {
  const after = existing.filter((entry) => !removedIds.includes(entry.id))
  const negative = firstNegativeDay(after)
  // Only block when the delete causes the problem, so older bad data can still be cleaned up.
  if (negative && !firstNegativeDay(existing)) {
    return { ok: false, message: `Can't delete. ${negativeDayMessage(negative)}` }
  }
  return { ok: true }
}

export function manilaYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

function addDaysToYmd(ymd: string, days: number): string {
  const [year = 0, month = 1, day = 1] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  return utc.toISOString().slice(0, 10)
}

export function manilaWeekWindow(now: Date = new Date()): { start: string; end: string } {
  const ymd = manilaYmd(now)
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short'
  }).format(now)
  const dayOffset: Record<string, number> = {
    Sun: 6,
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5
  }
  const start = addDaysToYmd(ymd, -(dayOffset[weekday] ?? 0))
  return { start, end: addDaysToYmd(start, 6) }
}

export function entriesInDateRange(
  entries: LedgerEntry[],
  start: string,
  end: string
): LedgerEntry[] {
  return entries.filter((entry) => entry.entry_date >= start && entry.entry_date <= end)
}

export function weekSummary(
  entries: LedgerEntry[],
  week: { start: string; end: string } = manilaWeekWindow()
) {
  const inWeek = entriesInDateRange(entries, week.start, week.end)
  return {
    posRemittanceIn: inWeek
      .filter((entry) => entry.type === 'pos_remittance')
      .reduce((sum, entry) => sum + entry.amount, 0),
    expensesOut: inWeek
      .filter((entry) => entry.type === 'expense')
      .reduce((sum, entry) => sum + entry.amount, 0),
    ownerRemittance: inWeek
      .filter((entry) => entry.type === 'owner_remittance')
      .reduce((sum, entry) => sum + entry.amount, 0),
    auditorCashRemaining: walletRemaining(entries, 'auditor_cash'),
    expenseRemaining: walletRemaining(entries, 'expense'),
    gcashRemaining: walletRemaining(entries, 'gcash')
  }
}

function formatPeso(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export function cartRemittanceAmount(input: Pick<CreateLedgerEntryInput, 'total_sales' | 'petty_cash_returned'>): number {
  return Number(input.total_sales ?? 0) + Number(input.petty_cash_returned ?? 0)
}

function proposedRows(input: CreateLedgerEntryInput): Array<Pick<LedgerEntry, 'type' | 'wallet' | 'amount'>> {
  const amount = input.type === 'pos_remittance' ? cartRemittanceAmount(input) : input.amount
  if (input.type === 'fund_expense') {
    return [
      { type: 'fund_expense', wallet: 'auditor_cash', amount: input.amount },
      { type: 'fund_expense', wallet: 'expense', amount: input.amount }
    ]
  }
  return [{ type: input.type, wallet: input.wallet, amount }]
}

export function validateEntry(
  input: CreateLedgerEntryInput,
  existing: LedgerEntry[]
): LedgerValidationResult {
  if (input.type === 'pos_remittance') {
    const sales = input.total_sales
    const petty = input.petty_cash_returned
    if (sales == null || petty == null || Number.isNaN(Number(sales)) || Number.isNaN(Number(petty))) {
      return { ok: false, message: 'Total Sales and Petty Cash Returned are required.' }
    }
    if (Number(sales) < 0 || Number(petty) < 0) {
      return { ok: false, message: 'Total Sales and Petty Cash Returned cannot be negative.' }
    }
    if (!(cartRemittanceAmount(input) > 0)) {
      return { ok: false, message: 'Cart cash remittance must be greater than 0.' }
    }
  } else if (!(input.amount > 0)) {
    return { ok: false, message: 'Amount must be greater than 0.' }
  }
  if (input.type === 'expense' && !input.category) {
    return { ok: false, message: 'Category is required for expenses.' }
  }
  const auditorOnly = ['opening_cash', 'pos_float', 'pos_remittance', 'owner_remittance']
  if (auditorOnly.includes(input.type) && input.wallet !== 'auditor_cash') {
    return { ok: false, message: 'This entry must use auditor cash.' }
  }
  if (input.type === 'gcash_remittance' && input.wallet !== 'gcash') {
    return { ok: false, message: 'This entry must use GCash.' }
  }
  const next = [...existing]
  for (const row of proposedRows(input)) {
    const remaining = walletRemaining(next, row.wallet)
    const delta = entryDelta(row)
    const wallet = row.wallet
    if (remaining + delta[wallet] < 0) {
      return {
        ok: false,
        message: `${ledgerWalletLabel(wallet)} remaining is ${formatPeso(remaining)}. This would go negative.`
      }
    }
    next.push({
      id: 'proposed',
      entry_date: input.entry_date,
      type: row.type,
      wallet: row.wallet,
      amount: row.amount,
      category: input.category ?? null,
      note: null,
      transfer_id: null,
      total_sales: input.total_sales ?? null,
      petty_cash_returned: input.petty_cash_returned ?? null,
      created_by: null,
      created_at: '',
      updated_at: ''
    })
  }
  const negative = firstNegativeDay(next)
  if (negative) {
    return { ok: false, message: negativeDayMessage(negative) }
  }
  return { ok: true }
}

export function ledgerTypeLabel(type: LedgerEntryType): string {
  const labels: Record<LedgerEntryType, string> = {
    opening_cash: 'Starting cash',
    pos_float: 'Cash to POS',
    pos_remittance: 'Cart Cash Remittance',
    gcash_remittance: 'GCash remittance',
    owner_remittance: 'Remit to owner',
    fund_expense: 'Fund expense wallet',
    expense: 'Expense'
  }
  return labels[type]
}

export function ledgerWalletLabel(wallet: LedgerWallet): string {
  const labels: Record<LedgerWallet, string> = {
    auditor_cash: 'Auditor cash',
    expense: 'Expense wallet',
    gcash: 'GCash'
  }
  return labels[wallet]
}
