import type { LedgerEntry } from '../../models/Ledger'
import { addDays, toPHDate, type WeeklySummary } from './weeklySummary'

/**
 * Checks the weekly summary (POS + Expenses page) against the auditor's Ledger.
 * Differences are ledger minus POS, and any non-zero difference is a mismatch.
 */

export interface LedgerCheckDay {
  date: string
  cashSales: number
  /** Audit page "Start of Day Count" for the Cash row. */
  startCount: number
  /** Cash sales plus the start-of-day count. */
  expectedRemit: number
  /** Sum of Cart Cash Remittance (pos_remittance) entries that day. */
  ledgerRemit: number
  remitDiff: number
  posExpenses: number
  /** Sum of expense entries that day, both wallets. */
  ledgerExpenses: number
  expenseDiff: number
  ok: boolean
}

export interface OwnerRemitDay {
  date: string
  /** Ledger Cart Cash Remittance that day (includes the petty cash returned). */
  remittance: number
  /** That day's Audit Cash "Start of Day Count", given to the cart in the morning. */
  pettyCashOut: number
  /** Expenses page total that day. */
  expenses: number
  /** Running cash on hand at the end of the day. */
  cashOnHand: number
}

/** Audit page start-of-day counts for one day. */
export interface AuditDayCounts {
  cash: number
  expenses: number
}

export interface LedgerCheck {
  days: LedgerCheckDay[]
  totals: {
    cashSales: number
    startCount: number
    expectedRemit: number
    ledgerRemit: number
    remitDiff: number
    posExpenses: number
    ledgerExpenses: number
    expenseDiff: number
  }
  /** For information only: owner remits are partial on purpose. */
  owner: {
    /** Kept last Thursday: this Friday's Audit Cash + Expenses start counts. */
    carriedIn: number
    days: OwnerRemitDay[]
    /** Next Friday's Audit Cash + Expenses start counts. Null while it has not opened. */
    setAside: { pettyCash: number; expenseWallet: number } | null
    /** Thursday's cash on hand minus what is set aside. Null while pending. */
    ownerRemit: number | null
    pending: boolean
    /** Ledger "Remit to owner" entries in the week. */
    remitted: number
  }
  /** Days where remittance or expenses do not match. */
  mismatchCount: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function sum(entries: LedgerEntry[]): number {
  return round2(entries.reduce((s, e) => s + (e.amount ?? 0), 0))
}

export interface CashSnapshotRow {
  session_id: string
  name: string
  start_of_day: number
}

/**
 * Audit page Cash and Expenses "Start of Day Count", summed per Manila day the session opened.
 * Every day with a session gets an entry, even if its audit was not saved (counts are then 0).
 */
export function auditCountsByDay(
  sessions: { id: string; opened_at: string }[],
  snapshots: CashSnapshotRow[],
): Record<string, AuditDayCounts> {
  const dayBySession = new Map(sessions.map(s => [s.id, toPHDate(s.opened_at)]))
  const counts: Record<string, AuditDayCounts> = {}
  for (const day of dayBySession.values()) counts[day] ??= { cash: 0, expenses: 0 }
  for (const row of snapshots) {
    const day = dayBySession.get(row.session_id)
    const entry = day ? counts[day] : undefined
    if (!entry) continue
    const value = Number(row.start_of_day ?? 0)
    if (row.name === 'Cash') entry.cash = round2(entry.cash + value)
    if (row.name === 'Expenses') entry.expenses = round2(entry.expenses + value)
  }
  return counts
}

/**
 * `audit` maps YYYY-MM-DD to the Audit page start counts for days that had a session,
 * including the Friday after the week. `today` (Manila, YYYY-MM-DD) decides whether a
 * missing next day is still to come (pending) or was a closed day (0).
 */
export function buildLedgerCheck(
  summary: WeeklySummary,
  ledger: LedgerEntry[],
  audit: Record<string, AuditDayCounts> = {},
  today?: string,
): LedgerCheck {
  const { start, end } = summary.week
  const inWeek = ledger.filter(e => e.entry_date >= start && e.entry_date <= end)
  const remits = inWeek.filter(e => e.type === 'pos_remittance')
  const expenses = inWeek.filter(e => e.type === 'expense')

  const days: LedgerCheckDay[] = summary.days.map(d => {
    const startCount = round2(audit[d.date]?.cash ?? 0)
    const expectedRemit = round2(d.cash + startCount)
    const ledgerRemit = sum(remits.filter(e => e.entry_date === d.date))
    const ledgerExpenses = sum(expenses.filter(e => e.entry_date === d.date))
    const remitDiff = round2(ledgerRemit - expectedRemit)
    const expenseDiff = round2(ledgerExpenses - d.expenses)
    return {
      date: d.date,
      cashSales: d.cash,
      startCount,
      expectedRemit,
      ledgerRemit,
      remitDiff,
      posExpenses: d.expenses,
      ledgerExpenses,
      expenseDiff,
      ok: remitDiff === 0 && expenseDiff === 0,
    }
  })

  const expectedRemit = round2(days.reduce((s, d) => s + d.expectedRemit, 0))
  const ledgerRemit = sum(remits)
  const posExpenses = round2(summary.days.reduce((s, d) => s + d.expenses, 0))
  const ledgerExpenses = sum(expenses)

  // Owner remit: money rolls day to day. Petty cash comes back inside the next remittance and
  // the expense wallet pays that day's expenses, so only actual spending reduces cash on hand.
  const firstDay = audit[start]
  const carriedIn = round2((firstDay?.cash ?? 0) + (firstDay?.expenses ?? 0))
  let cashOnHand = carriedIn
  const ownerDays: OwnerRemitDay[] = days.map(d => {
    const pettyCashOut = round2(audit[d.date]?.cash ?? 0)
    cashOnHand = round2(cashOnHand + d.ledgerRemit - pettyCashOut - d.posExpenses)
    return { date: d.date, remittance: d.ledgerRemit, pettyCashOut, expenses: d.posExpenses, cashOnHand }
  })
  const nextFriday = addDays(end, 1)
  const next = audit[nextFriday]
  const pending = !next && today !== undefined && nextFriday >= today
  const setAside = pending ? null : { pettyCash: next?.cash ?? 0, expenseWallet: next?.expenses ?? 0 }

  return {
    days,
    totals: {
      cashSales: round2(days.reduce((s, d) => s + d.cashSales, 0)),
      startCount: round2(days.reduce((s, d) => s + d.startCount, 0)),
      expectedRemit,
      ledgerRemit,
      remitDiff: round2(ledgerRemit - expectedRemit),
      posExpenses,
      ledgerExpenses,
      expenseDiff: round2(ledgerExpenses - posExpenses),
    },
    owner: {
      carriedIn,
      days: ownerDays,
      setAside,
      ownerRemit: setAside ? round2(cashOnHand - setAside.pettyCash - setAside.expenseWallet) : null,
      pending,
      remitted: sum(inWeek.filter(e => e.type === 'owner_remittance')),
    },
    mismatchCount: days.filter(d => !d.ok).length,
  }
}
