import type {
  CreateLedgerEntryInput,
  LedgerEntry,
  LedgerEntryType,
  LedgerValidationResult,
  LedgerWallet
} from '../../models/Ledger'

export function entryDelta(entry: Pick<LedgerEntry, 'type' | 'wallet' | 'amount'>): {
  auditor_cash: number
  petty_cash: number
} {
  const amount = entry.amount
  const zero = { auditor_cash: 0, petty_cash: 0 }
  if (entry.type === 'opening_cash' || entry.type === 'pos_remittance') {
    return { ...zero, auditor_cash: amount }
  }
  if (
    entry.type === 'pos_float' ||
    entry.type === 'owner_remittance' ||
    (entry.type === 'expense' && entry.wallet === 'auditor_cash') ||
    (entry.type === 'petty_issue' && entry.wallet === 'auditor_cash')
  ) {
    return { ...zero, auditor_cash: -amount }
  }
  if (entry.type === 'petty_issue' && entry.wallet === 'petty_cash') {
    return { ...zero, petty_cash: amount }
  }
  if (entry.type === 'expense' && entry.wallet === 'petty_cash') {
    return { ...zero, petty_cash: -amount }
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
  const wallets: LedgerWallet[] = ['auditor_cash', 'petty_cash']
  const balance = { auditor_cash: 0, petty_cash: 0 }
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!
    const delta = entryDelta(entry)
    balance.auditor_cash += delta.auditor_cash
    balance.petty_cash += delta.petty_cash
    const endOfDay = sorted[i + 1]?.entry_date !== entry.entry_date
    if (!endOfDay) continue
    for (const wallet of wallets) {
      // Round to centavos so float noise (0.1 + 0.2 - 0.3) is not read as negative.
      if (Math.round(balance[wallet] * 100) < 0) {
        return { wallet, date: entry.entry_date, balance: balance[wallet] }
      }
    }
  }
  return null
}

function walletLabel(wallet: LedgerWallet): string {
  return wallet === 'auditor_cash' ? 'Auditor cash' : 'Petty cash'
}

function negativeDayMessage(day: NegativeDay): string {
  return `${walletLabel(day.wallet)} would go negative on ${day.date} (-${formatPeso(Math.abs(day.balance))}).`
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
    pettyCashRemaining: walletRemaining(entries, 'petty_cash')
  }
}

function formatPeso(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function proposedRows(input: CreateLedgerEntryInput): Array<Pick<LedgerEntry, 'type' | 'wallet' | 'amount'>> {
  if (input.type === 'petty_issue') {
    return [
      { type: 'petty_issue', wallet: 'auditor_cash', amount: input.amount },
      { type: 'petty_issue', wallet: 'petty_cash', amount: input.amount }
    ]
  }
  return [{ type: input.type, wallet: input.wallet, amount: input.amount }]
}

export function validateEntry(
  input: CreateLedgerEntryInput,
  existing: LedgerEntry[]
): LedgerValidationResult {
  if (!(input.amount > 0)) {
    return { ok: false, message: 'Amount must be greater than 0.' }
  }
  if (input.type === 'expense' && !input.category) {
    return { ok: false, message: 'Category is required for expenses.' }
  }
  const auditorOnly = ['opening_cash', 'pos_float', 'pos_remittance', 'owner_remittance']
  if (auditorOnly.includes(input.type) && input.wallet !== 'auditor_cash') {
    return { ok: false, message: 'This entry must use auditor cash.' }
  }
  const next = [...existing]
  for (const row of proposedRows(input)) {
    const remaining = walletRemaining(next, row.wallet)
    const delta = entryDelta(row)
    const wallet = row.wallet
    if (remaining + delta[wallet] < 0) {
      return {
        ok: false,
        message: `${walletLabel(wallet)} remaining is ${formatPeso(remaining)}. This would go negative.`
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
    pos_remittance: 'Remittance from POS',
    owner_remittance: 'Remit to owner',
    petty_issue: 'Petty cash issued',
    expense: 'Expense'
  }
  return labels[type]
}
