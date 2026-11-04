import type { LedgerEntry } from '../../models/Ledger'
import type { WeeklySummary } from './weeklySummary'

/**
 * Checks the weekly summary (POS + Expenses page) against the auditor's Ledger.
 * Differences are ledger minus POS, and any non-zero difference is a mismatch.
 */

export interface LedgerCheckDay {
  date: string
  /** Cash sales minus that day's Expenses-page expenses. */
  expectedRemit: number
  /** Sum of pos_remittance entries that day. */
  ledgerRemit: number
  remitDiff: number
  posExpenses: number
  /** Sum of expense entries that day, both wallets. */
  ledgerExpenses: number
  expenseDiff: number
  ok: boolean
}

export interface LedgerCheckRow {
  pos: number
  ledger: number
  diff: number
  ok: boolean
}

export interface LedgerCheckSalaryRow {
  date: string
  salaries: number
  ledgerLabor: number
  diff: number
  ok: boolean
}

export interface LedgerCheck {
  days: LedgerCheckDay[]
  totals: {
    expectedRemit: number
    ledgerRemit: number
    remitDiff: number
    posExpenses: number
    ledgerExpenses: number
    expenseDiff: number
  }
  categories: ({ category: string } & LedgerCheckRow)[]
  /** For information only: owner remits are partial on purpose. */
  owner: {
    /** Week cash sales minus ledger expenses. */
    expected: number
    remitted: number
    /** What stayed with the auditor and petty cash for next week. */
    kept: number
  }
  salaries: LedgerCheckSalaryRow[]
  salaryTotals: { salaries: number; ledgerLabor: number; diff: number }
  /** Mismatched days + categories + salary dates. */
  mismatchCount: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function sum(entries: LedgerEntry[]): number {
  return round2(entries.reduce((s, e) => s + (e.amount ?? 0), 0))
}

export function buildLedgerCheck(summary: WeeklySummary, ledger: LedgerEntry[]): LedgerCheck {
  const { start, end } = summary.week
  const inWeek = ledger.filter(e => e.entry_date >= start && e.entry_date <= end)
  const remits = inWeek.filter(e => e.type === 'pos_remittance')
  const expenses = inWeek.filter(e => e.type === 'expense')

  const days: LedgerCheckDay[] = summary.days.map(d => {
    const expectedRemit = round2(d.cash - d.expenses)
    const ledgerRemit = sum(remits.filter(e => e.entry_date === d.date))
    const ledgerExpenses = sum(expenses.filter(e => e.entry_date === d.date))
    const remitDiff = round2(ledgerRemit - expectedRemit)
    const expenseDiff = round2(ledgerExpenses - d.expenses)
    return {
      date: d.date,
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

  // By category, over the whole week
  const posByCat = new Map<string, number>()
  for (const e of summary.days.flatMap(d => d.expenseList)) {
    posByCat.set(e.category, (posByCat.get(e.category) ?? 0) + (e.amount ?? 0))
  }
  const ledgerByCat = new Map<string, number>()
  for (const e of expenses) {
    const cat = e.category ?? 'Other'
    ledgerByCat.set(cat, (ledgerByCat.get(cat) ?? 0) + e.amount)
  }
  const categories = [...new Set([...posByCat.keys(), ...ledgerByCat.keys()])]
    .map(category => {
      const pos = round2(posByCat.get(category) ?? 0)
      const ledgerAmt = round2(ledgerByCat.get(category) ?? 0)
      const diff = round2(ledgerAmt - pos)
      return { category, pos, ledger: ledgerAmt, diff, ok: diff === 0 }
    })
    .sort((a, b) => Number(a.ok) - Number(b.ok) || b.pos + b.ledger - (a.pos + a.ledger))

  // Owner remit
  const ownerExpected = round2(summary.totals.cash - ledgerExpenses)
  const remitted = sum(inWeek.filter(e => e.type === 'owner_remittance'))

  // Salaries vs ledger Labor, per date
  const salaryByDate = new Map<string, number>()
  for (const s of summary.salaries) {
    for (const p of s.paid) salaryByDate.set(p.date, (salaryByDate.get(p.date) ?? 0) + p.amount)
  }
  const laborByDate = new Map<string, number>()
  for (const e of expenses.filter(e => e.category === 'Labor')) {
    laborByDate.set(e.entry_date, (laborByDate.get(e.entry_date) ?? 0) + e.amount)
  }
  const salaries = [...new Set([...salaryByDate.keys(), ...laborByDate.keys()])]
    .sort()
    .map(date => {
      const sal = round2(salaryByDate.get(date) ?? 0)
      const labor = round2(laborByDate.get(date) ?? 0)
      const diff = round2(labor - sal)
      return { date, salaries: sal, ledgerLabor: labor, diff, ok: diff === 0 }
    })
  const salaryTotal = round2(salaries.reduce((s, r) => s + r.salaries, 0))
  const laborTotal = round2(salaries.reduce((s, r) => s + r.ledgerLabor, 0))

  return {
    days,
    totals: {
      expectedRemit,
      ledgerRemit,
      remitDiff: round2(ledgerRemit - expectedRemit),
      posExpenses,
      ledgerExpenses,
      expenseDiff: round2(ledgerExpenses - posExpenses),
    },
    categories,
    owner: { expected: ownerExpected, remitted, kept: round2(ownerExpected - remitted) },
    salaries,
    salaryTotals: { salaries: salaryTotal, ledgerLabor: laborTotal, diff: round2(laborTotal - salaryTotal) },
    mismatchCount:
      days.filter(d => !d.ok).length + categories.filter(c => !c.ok).length + salaries.filter(r => !r.ok).length,
  }
}
