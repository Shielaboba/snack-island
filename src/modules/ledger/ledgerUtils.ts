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

export function manilaYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
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
      const label = wallet === 'auditor_cash' ? 'Auditor cash' : 'Petty cash'
      return {
        ok: false,
        message: `${label} remaining is ${formatPeso(remaining)}. This would go negative.`
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
