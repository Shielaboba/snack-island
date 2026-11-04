import { describe, it, expect } from 'vitest'
import { buildLedgerCheck } from '../../../src/modules/weekly/ledgerCheck'
import type { DaySummary, WeeklySummary } from '../../../src/modules/weekly/weeklySummary'
import type { Expense, ExpenseCategory } from '../../../src/models'
import type { LedgerEntry, LedgerEntryType, LedgerExpenseCategory, LedgerWallet } from '../../../src/models/Ledger'
import { getWeekSalaryStatus } from '../../../src/modules/salary/salarySchedule'

const WEEK = { start: '2026-10-23', end: '2026-10-29' } // Fri–Thu
const DATES = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']

let n = 0
function expense(date: string, amount: number, category: ExpenseCategory = 'Supplies', description = 'x'): Expense {
  return { id: `e${n++}`, expense_date: date, amount, category, description }
}

function entry(
  date: string,
  type: LedgerEntryType,
  amount: number,
  opts: { wallet?: LedgerWallet; category?: LedgerExpenseCategory } = {},
): LedgerEntry {
  return {
    id: `l${n++}`,
    entry_date: date,
    type,
    wallet: opts.wallet ?? 'auditor_cash',
    amount,
    category: type === 'expense' ? opts.category ?? 'Supplies' : null,
    note: null,
    transfer_id: null,
    created_by: null,
    created_at: `${date}T10:00:00Z`,
    updated_at: `${date}T10:00:00Z`,
  }
}

/** A minimal summary: only the fields the ledger check reads. */
function summary(cashByDate: Record<string, number>, expenses: Expense[]): WeeklySummary {
  const days: DaySummary[] = DATES.map(date => {
    const list = expenses.filter(e => e.expense_date === date)
    return {
      date,
      hasSession: true,
      orders: 0,
      revenue: cashByDate[date] ?? 0,
      cash: cashByDate[date] ?? 0,
      nonCash: 0,
      expenses: list.reduce((s, e) => s + e.amount, 0),
      expenseList: list,
    }
  })
  const cash = days.reduce((s, d) => s + d.cash, 0)
  const exp = expenses.reduce((s, e) => s + e.amount, 0)
  return {
    week: WEEK,
    totals: { orderCount: 0, revenue: cash, cash, nonCash: 0, expenses: exp, expectedHandover: cash - exp, discountAmount: 0 },
    days,
    paymentMethods: [],
    items: [],
    discounts: [],
    vouchers: { orders: 0, burgers: 0 },
    expenseCategories: [],
    salaries: getWeekSalaryStatus(DATES, expenses),
  }
}

describe('buildLedgerCheck — POS remittance', () => {
  it('expects cash sales minus that day’s expenses, and matches when the ledger agrees', () => {
    const s = summary({ '2026-10-23': 5000 }, [expense('2026-10-23', 800)])
    const check = buildLedgerCheck(s, [
      entry('2026-10-23', 'pos_remittance', 4200),
      entry('2026-10-23', 'expense', 800),
    ])
    const day = check.days[0]
    expect(day.expectedRemit).toBe(4200)
    expect(day.ledgerRemit).toBe(4200)
    expect(day.remitDiff).toBe(0)
    expect(day.ok).toBe(true)
    expect(check.mismatchCount).toBe(0)
  })

  it('flags any difference, even under a peso', () => {
    const s = summary({ '2026-10-24': 1000 }, [])
    const check = buildLedgerCheck(s, [entry('2026-10-24', 'pos_remittance', 999.5)])
    const day = check.days.find(d => d.date === '2026-10-24')!
    expect(day.remitDiff).toBe(-0.5)
    expect(day.ok).toBe(false)
    expect(check.mismatchCount).toBe(1)
  })

  it('flags a day with sales but no remittance recorded', () => {
    const s = summary({ '2026-10-25': 300 }, [])
    const check = buildLedgerCheck(s, [])
    const day = check.days.find(d => d.date === '2026-10-25')!
    expect(day.ledgerRemit).toBe(0)
    expect(day.remitDiff).toBe(-300)
    expect(day.ok).toBe(false)
  })

  it('ignores ledger entries outside the week', () => {
    const s = summary({}, [])
    const check = buildLedgerCheck(s, [
      entry('2026-10-22', 'pos_remittance', 500),
      entry('2026-10-30', 'expense', 100),
    ])
    expect(check.totals.ledgerRemit).toBe(0)
    expect(check.totals.ledgerExpenses).toBe(0)
    expect(check.mismatchCount).toBe(0)
  })

  it('totals the week', () => {
    const s = summary({ '2026-10-23': 1000, '2026-10-24': 2000 }, [expense('2026-10-24', 500)])
    const check = buildLedgerCheck(s, [
      entry('2026-10-23', 'pos_remittance', 1000),
      entry('2026-10-24', 'pos_remittance', 1400),
      entry('2026-10-24', 'expense', 500),
    ])
    expect(check.totals.expectedRemit).toBe(2500)
    expect(check.totals.ledgerRemit).toBe(2400)
    expect(check.totals.remitDiff).toBe(-100)
  })
})

describe('buildLedgerCheck — expenses', () => {
  it('counts ledger expenses from both wallets', () => {
    const s = summary({ '2026-10-26': 1000 }, [expense('2026-10-26', 300)])
    const check = buildLedgerCheck(s, [
      entry('2026-10-26', 'pos_remittance', 700),
      entry('2026-10-26', 'expense', 100, { wallet: 'petty_cash' }),
      entry('2026-10-26', 'expense', 200, { wallet: 'auditor_cash' }),
    ])
    const day = check.days.find(d => d.date === '2026-10-26')!
    expect(day.ledgerExpenses).toBe(300)
    expect(day.expenseDiff).toBe(0)
    expect(day.ok).toBe(true)
  })

  it('does not count petty cash issues or owner remits as expenses', () => {
    const s = summary({}, [])
    const check = buildLedgerCheck(s, [
      entry('2026-10-26', 'petty_issue', 500),
      entry('2026-10-26', 'owner_remittance', 2000),
      entry('2026-10-26', 'pos_float', 1000),
    ])
    expect(check.totals.ledgerExpenses).toBe(0)
  })

  it('compares by category for the week', () => {
    const s = summary({}, [
      expense('2026-10-23', 100, 'Gas'),
      expense('2026-10-24', 50, 'Gas'),
      expense('2026-10-24', 300, 'Government Fees'),
    ])
    const check = buildLedgerCheck(s, [
      entry('2026-10-23', 'expense', 150, { category: 'Gas' }),
      entry('2026-10-25', 'expense', 40, { category: 'Misc' }),
    ])
    const byCat = Object.fromEntries(check.categories.map(c => [c.category, c]))
    expect(byCat.Gas).toMatchObject({ pos: 150, ledger: 150, diff: 0, ok: true })
    expect(byCat['Government Fees']).toMatchObject({ pos: 300, ledger: 0, diff: -300, ok: false })
    expect(byCat.Misc).toMatchObject({ pos: 0, ledger: 40, diff: 40, ok: false })
  })

  it('flags a day whose expense totals differ', () => {
    const s = summary({}, [expense('2026-10-27', 100)])
    const check = buildLedgerCheck(s, [entry('2026-10-27', 'expense', 120)])
    const day = check.days.find(d => d.date === '2026-10-27')!
    expect(day.expenseDiff).toBe(20)
    expect(day.ok).toBe(false)
  })
})

describe('buildLedgerCheck — owner remit (info only)', () => {
  it('expected is week cash sales minus ledger expenses; the rest is kept as float', () => {
    const s = summary({ '2026-10-23': 10000 }, [expense('2026-10-23', 1000)])
    const check = buildLedgerCheck(s, [
      entry('2026-10-23', 'pos_remittance', 9000),
      entry('2026-10-23', 'expense', 1000),
      entry('2026-10-29', 'owner_remittance', 6000),
    ])
    expect(check.owner.expected).toBe(9000)
    expect(check.owner.remitted).toBe(6000)
    expect(check.owner.kept).toBe(3000)
    expect(check.mismatchCount).toBe(0)
  })
})

describe('buildLedgerCheck — salaries vs Labor', () => {
  it('compares salaries paid on each date with ledger Labor on that date', () => {
    // Thu 2026-10-29 is Den's pay day; Mon 2026-10-26 is Shai's
    const s = summary({}, [
      expense('2026-10-29', 700, 'Labor', 'Den Salary'),
      expense('2026-10-26', 600, 'Labor', 'Shai Salary'),
    ])
    const check = buildLedgerCheck(s, [
      entry('2026-10-29', 'expense', 700, { category: 'Labor' }),
      entry('2026-10-26', 'expense', 500, { category: 'Labor' }),
    ])
    const byDate = Object.fromEntries(check.salaries.map(r => [r.date, r]))
    expect(byDate['2026-10-29']).toMatchObject({ salaries: 700, ledgerLabor: 700, diff: 0, ok: true })
    expect(byDate['2026-10-26']).toMatchObject({ salaries: 600, ledgerLabor: 500, diff: -100, ok: false })
    expect(check.salaryTotals).toMatchObject({ salaries: 1300, ledgerLabor: 1200, diff: -100 })
  })

  it('includes ledger Labor on a date with no salary recorded', () => {
    const s = summary({}, [])
    const check = buildLedgerCheck(s, [entry('2026-10-24', 'expense', 400, { category: 'Labor' })])
    expect(check.salaries).toEqual([{ date: '2026-10-24', salaries: 0, ledgerLabor: 400, diff: 400, ok: false }])
  })
})

describe('buildLedgerCheck — mismatch count', () => {
  it('counts each mismatched day, category and salary date once', () => {
    const s = summary({ '2026-10-23': 1000 }, [expense('2026-10-23', 100, 'Gas')])
    // Remit is wrong and expenses are missing on the same day → 1 day
    // Gas category missing → 1 category
    const check = buildLedgerCheck(s, [entry('2026-10-23', 'pos_remittance', 800)])
    expect(check.mismatchCount).toBe(2)
  })
})
