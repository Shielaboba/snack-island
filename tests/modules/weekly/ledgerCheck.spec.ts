import { describe, it, expect } from 'vitest'
import { auditCountsByDay, buildLedgerCheck } from '../../../src/modules/weekly/ledgerCheck'
import type { DaySummary, WeeklySummary } from '../../../src/modules/weekly/weeklySummary'
import type { Expense, ExpenseCategory } from '../../../src/models'
import type { LedgerEntry, LedgerEntryType, LedgerExpenseCategory, LedgerWallet } from '../../../src/models/Ledger'

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

/** Audit counts with only the Cash row filled in. */
function cashCounts(map: Record<string, number>) {
  return Object.fromEntries(Object.entries(map).map(([d, cash]) => [d, { cash, expenses: 0 }]))
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
    salaries: [],
  }
}

describe('buildLedgerCheck — POS remittance', () => {
  it('expects cash sales plus the start-of-day count, and matches when the ledger agrees', () => {
    const s = summary({ '2026-10-23': 5000 }, [expense('2026-10-23', 800)])
    const check = buildLedgerCheck(
      s,
      [entry('2026-10-23', 'pos_remittance', 5500), entry('2026-10-23', 'expense', 800)],
      cashCounts({ '2026-10-23': 500 }),
    )
    const day = check.days[0]
    expect(day.cashSales).toBe(5000)
    expect(day.startCount).toBe(500)
    expect(day.expectedRemit).toBe(5500)
    expect(day.ledgerRemit).toBe(5500)
    expect(day.remitDiff).toBe(0)
    expect(day.ok).toBe(true)
    expect(check.mismatchCount).toBe(0)
  })

  it('does not subtract expenses from the expected remit', () => {
    const s = summary({ '2026-10-23': 1000 }, [expense('2026-10-23', 300)])
    const check = buildLedgerCheck(s, [], cashCounts({ '2026-10-23': 200 }))
    expect(check.days[0].expectedRemit).toBe(1200)
  })

  it('treats a missing start-of-day count as zero', () => {
    const s = summary({ '2026-10-24': 1000 }, [])
    const check = buildLedgerCheck(s, [entry('2026-10-24', 'pos_remittance', 1000)])
    const day = check.days.find(d => d.date === '2026-10-24')!
    expect(day.startCount).toBe(0)
    expect(day.ok).toBe(true)
  })

  it('flags any difference, even under a peso', () => {
    const s = summary({ '2026-10-24': 1000 }, [])
    const check = buildLedgerCheck(s, [entry('2026-10-24', 'pos_remittance', 999.5)])
    const day = check.days.find(d => d.date === '2026-10-24')!
    expect(day.remitDiff).toBe(-0.5)
    expect(day.ok).toBe(false)
    expect(check.mismatchCount).toBe(1)
  })

  it('flags a day with a start count but no remittance recorded', () => {
    const s = summary({}, [])
    const check = buildLedgerCheck(s, [], cashCounts({ '2026-10-25': 300 }))
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
    const s = summary({ '2026-10-23': 1000, '2026-10-24': 2000 }, [])
    const check = buildLedgerCheck(
      s,
      [entry('2026-10-23', 'pos_remittance', 1500), entry('2026-10-24', 'pos_remittance', 2400)],
      cashCounts({ '2026-10-23': 500, '2026-10-24': 500 }),
    )
    expect(check.totals.cashSales).toBe(3000)
    expect(check.totals.startCount).toBe(1000)
    expect(check.totals.expectedRemit).toBe(4000)
    expect(check.totals.ledgerRemit).toBe(3900)
    expect(check.totals.remitDiff).toBe(-100)
  })
})

describe('auditCountsByDay', () => {
  const sessions = [
    { id: 's1', opened_at: '2026-10-23T01:00:00Z' }, // Fri Oct 23 Manila
    { id: 's2', opened_at: '2026-10-23T08:00:00Z' }, // same day, second session
    { id: 's3', opened_at: '2026-10-24T17:00:00Z' }, // Sun Oct 25 01:00 Manila
    { id: 's4', opened_at: '2026-10-26T01:00:00Z' }, // Mon Oct 26, audit not saved
  ]

  it('sums Cash and Expenses start counts per Manila day the session opened', () => {
    const counts = auditCountsByDay(sessions, [
      { session_id: 's1', name: 'Cash', start_of_day: 500 },
      { session_id: 's1', name: 'Expenses', start_of_day: 1000 },
      { session_id: 's1', name: 'GCash', start_of_day: 900 },
      { session_id: 's2', name: 'Cash', start_of_day: 200 },
      { session_id: 's3', name: 'Cash', start_of_day: 300 },
    ])
    expect(counts).toEqual({
      '2026-10-23': { cash: 700, expenses: 1000 },
      '2026-10-25': { cash: 300, expenses: 0 },
      '2026-10-26': { cash: 0, expenses: 0 },
    })
  })

  it('ignores snapshots for sessions it was not given', () => {
    expect(auditCountsByDay([], [{ session_id: 'other', name: 'Cash', start_of_day: 100 }])).toEqual({})
  })
})

describe('buildLedgerCheck — expenses', () => {
  it('counts ledger expenses from both wallets', () => {
    const s = summary({ '2026-10-26': 1000 }, [expense('2026-10-26', 300)])
    const check = buildLedgerCheck(s, [
      entry('2026-10-26', 'pos_remittance', 1000),
      entry('2026-10-26', 'expense', 100, { wallet: 'expense' }),
      entry('2026-10-26', 'expense', 200, { wallet: 'auditor_cash' }),
    ])
    const day = check.days.find(d => d.date === '2026-10-26')!
    expect(day.ledgerExpenses).toBe(300)
    expect(day.expenseDiff).toBe(0)
    expect(day.ok).toBe(true)
  })

  it('does not count wallet funding, float or owner remits as expenses', () => {
    const s = summary({}, [])
    const check = buildLedgerCheck(s, [
      entry('2026-10-26', 'fund_expense', 500),
      entry('2026-10-26', 'owner_remittance', 2000),
      entry('2026-10-26', 'pos_float', 1000),
    ])
    expect(check.totals.ledgerExpenses).toBe(0)
  })

  it('flags a day whose expense totals differ', () => {
    const s = summary({}, [expense('2026-10-27', 100)])
    const check = buildLedgerCheck(s, [entry('2026-10-27', 'expense', 120)])
    const day = check.days.find(d => d.date === '2026-10-27')!
    expect(day.expenseDiff).toBe(20)
    expect(day.ok).toBe(false)
  })
})

describe('buildLedgerCheck — owner remit (rolling, info only)', () => {
  it('rolls cash on hand through the week and sets aside next Friday at the end', () => {
    const s = summary({}, [expense('2026-10-23', 300), expense('2026-10-24', 100)])
    const check = buildLedgerCheck(
      s,
      [
        entry('2026-10-23', 'pos_remittance', 2000),
        entry('2026-10-24', 'pos_remittance', 1500),
      ],
      {
        '2026-10-23': { cash: 500, expenses: 1000 }, // carried in from last week
        '2026-10-24': { cash: 400, expenses: 800 },
        '2026-10-30': { cash: 600, expenses: 900 }, // next Friday
      },
      '2026-11-04',
    )
    const o = check.owner
    expect(o.carriedIn).toBe(1500)
    // Fri: 1500 + 2000 − 500 − 300 = 2700
    expect(o.days[0]).toMatchObject({ date: '2026-10-23', remittance: 2000, pettyCashOut: 500, expenses: 300, cashOnHand: 2700 })
    // Sat: 2700 + 1500 − 400 − 100 = 3700, then flat to Thursday
    expect(o.days[1].cashOnHand).toBe(3700)
    expect(o.days[6].cashOnHand).toBe(3700)
    expect(o.setAside).toEqual({ pettyCash: 600, expenseWallet: 900 })
    expect(o.ownerRemit).toBe(2200)
    expect(o.pending).toBe(false)
  })

  it('does not subtract the expense wallet day by day', () => {
    const s = summary({}, [])
    const check = buildLedgerCheck(
      s,
      [entry('2026-10-24', 'pos_remittance', 1000)],
      { '2026-10-24': { cash: 0, expenses: 5000 } },
      '2026-11-04',
    )
    expect(check.owner.days[6].cashOnHand).toBe(1000)
  })

  it('carries in 0 when the store was closed on Friday', () => {
    const s = summary({}, [])
    const check = buildLedgerCheck(s, [entry('2026-10-24', 'pos_remittance', 1000)], {}, '2026-11-04')
    expect(check.owner.carriedIn).toBe(0)
    expect(check.owner.setAside).toEqual({ pettyCash: 0, expenseWallet: 0 })
    expect(check.owner.ownerRemit).toBe(1000)
  })

  it('is pending while next Friday has not opened yet', () => {
    const s = summary({}, [])
    const check = buildLedgerCheck(s, [entry('2026-10-24', 'pos_remittance', 1000)], {}, '2026-10-30')
    expect(check.owner.pending).toBe(true)
    expect(check.owner.ownerRemit).toBeNull()
    expect(check.owner.setAside).toBeNull()
  })

  it('shows the ledger remit to owner and never counts as a mismatch', () => {
    const s = summary({}, [])
    const check = buildLedgerCheck(
      s,
      [entry('2026-10-29', 'owner_remittance', 1200)],
      {},
      '2026-11-04',
    )
    expect(check.owner.remitted).toBe(1200)
    expect(check.mismatchCount).toBe(0)
  })
})

describe('buildLedgerCheck — mismatch count', () => {
  it('counts each mismatched day once', () => {
    const s = summary({ '2026-10-23': 1000, '2026-10-24': 500 }, [expense('2026-10-23', 100, 'Gas')])
    // Oct 23: remit and expenses both wrong → 1 day. Oct 24: no remit → 1 day.
    const check = buildLedgerCheck(s, [entry('2026-10-23', 'pos_remittance', 800)])
    expect(check.mismatchCount).toBe(2)
  })
})
