import { describe, it, expect } from 'vitest'
import type { LedgerEntry } from '../../src/models/Ledger'
import {
  dailyRemaining,
  entriesInDateRange,
  entryDelta,
  ledgerTypeLabel,
  ledgerWalletLabel,
  manilaWeekWindow,
  manilaYmd,
  validateEntry,
  validateRemoval,
  walletRemaining,
  weekSummary
} from '../../src/modules/ledger/ledgerUtils'

function row(partial: Partial<LedgerEntry> & Pick<LedgerEntry, 'type' | 'wallet' | 'amount'>): LedgerEntry {
  return {
    id: partial.id ?? 'id',
    entry_date: partial.entry_date ?? '2026-09-21',
    type: partial.type,
    wallet: partial.wallet,
    amount: partial.amount,
    category: partial.category ?? null,
    note: partial.note ?? null,
    transfer_id: partial.transfer_id ?? null,
    total_sales: partial.total_sales ?? null,
    petty_cash_returned: partial.petty_cash_returned ?? null,
    created_by: partial.created_by ?? 'auditor',
    created_at: partial.created_at ?? '2026-09-21T00:00:00.000Z',
    updated_at: partial.updated_at ?? '2026-09-21T00:00:00.000Z'
  }
}

const empty = { auditor_cash: 0, expense: 0, gcash: 0 }

describe('entryDelta', () => {
  it('credits auditor cash for opening_cash and EOD petty cash remittance', () => {
    expect(entryDelta({ type: 'opening_cash', wallet: 'auditor_cash', amount: 5000 }))
      .toEqual({ ...empty, auditor_cash: 5000 })
    expect(entryDelta({ type: 'pos_remittance', wallet: 'auditor_cash', amount: 2000 }))
      .toEqual({ ...empty, auditor_cash: 2000 })
  })

  it('credits GCash for gcash_remittance', () => {
    expect(entryDelta({ type: 'gcash_remittance', wallet: 'gcash', amount: 750 }))
      .toEqual({ ...empty, gcash: 750 })
  })

  it('debits auditor cash for pos_float, owner_remittance, and auditor expense', () => {
    expect(entryDelta({ type: 'pos_float', wallet: 'auditor_cash', amount: 1000 }))
      .toEqual({ ...empty, auditor_cash: -1000 })
    expect(entryDelta({ type: 'owner_remittance', wallet: 'auditor_cash', amount: 3000 }))
      .toEqual({ ...empty, auditor_cash: -3000 })
    expect(entryDelta({ type: 'expense', wallet: 'auditor_cash', amount: 400 }))
      .toEqual({ ...empty, auditor_cash: -400 })
  })

  it('moves fund_expense on the matching wallet only', () => {
    expect(entryDelta({ type: 'fund_expense', wallet: 'auditor_cash', amount: 500 }))
      .toEqual({ ...empty, auditor_cash: -500 })
    expect(entryDelta({ type: 'fund_expense', wallet: 'expense', amount: 500 }))
      .toEqual({ ...empty, expense: 500 })
  })

  it('debits only the chosen wallet for an expense', () => {
    expect(entryDelta({ type: 'expense', wallet: 'expense', amount: 80 }))
      .toEqual({ ...empty, expense: -80 })
    expect(entryDelta({ type: 'expense', wallet: 'gcash', amount: 50 }))
      .toEqual({ ...empty, gcash: -50 })
  })
})

describe('walletRemaining and dailyRemaining', () => {
  const entries = [
    row({ id: '1', entry_date: '2026-09-21', type: 'opening_cash', wallet: 'auditor_cash', amount: 5000 }),
    row({ id: '2', entry_date: '2026-09-21', type: 'pos_float', wallet: 'auditor_cash', amount: 1000 }),
    row({ id: '3', entry_date: '2026-09-22', type: 'pos_remittance', wallet: 'auditor_cash', amount: 2500 }),
    row({ id: '4', entry_date: '2026-09-22', type: 'fund_expense', wallet: 'auditor_cash', amount: 500, transfer_id: 't1' }),
    row({ id: '5', entry_date: '2026-09-22', type: 'fund_expense', wallet: 'expense', amount: 500, transfer_id: 't1' }),
    row({ id: '6', entry_date: '2026-09-23', type: 'expense', wallet: 'expense', amount: 120, category: 'Supplies' }),
    row({ id: '7', entry_date: '2026-09-24', type: 'expense', wallet: 'auditor_cash', amount: 800, category: 'Labor' }),
    row({ id: '8', entry_date: '2026-09-25', type: 'owner_remittance', wallet: 'auditor_cash', amount: 4000 }),
    row({ id: '9', entry_date: '2026-09-22', type: 'gcash_remittance', wallet: 'gcash', amount: 900 }),
    row({ id: '10', entry_date: '2026-09-23', type: 'expense', wallet: 'gcash', amount: 100, category: 'Utilities' })
  ]

  it('sums all deltas per wallet including leftover after a partial owner remit', () => {
    expect(walletRemaining(entries, 'auditor_cash')).toBe(1200)
    expect(walletRemaining(entries, 'expense')).toBe(380)
    expect(walletRemaining(entries, 'gcash')).toBe(800)
  })

  it('daily remaining is the running balance through that date', () => {
    expect(dailyRemaining(entries, 'auditor_cash', '2026-09-21')).toBe(4000)
    expect(dailyRemaining(entries, 'auditor_cash', '2026-09-22')).toBe(6000)
    expect(dailyRemaining(entries, 'expense', '2026-09-22')).toBe(500)
    expect(dailyRemaining(entries, 'expense', '2026-09-23')).toBe(380)
  })

  it('expense on auditor cash does not change the expense wallet', () => {
    const before = walletRemaining(entries.slice(0, 6), 'expense')
    const afterLabor = [...entries.slice(0, 6), entries[6]]
    expect(walletRemaining(afterLabor, 'expense')).toBe(before)
  })
})

describe('validateEntry', () => {
  const seeded: LedgerEntry[] = [
    row({ id: 'o', type: 'opening_cash', wallet: 'auditor_cash', amount: 1000 })
  ]

  it('blocks cash to POS when it would make auditor cash negative', () => {
    const result = validateEntry(
      { entry_date: '2026-09-21', type: 'pos_float', wallet: 'auditor_cash', amount: 1000.01 },
      []
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Auditor cash remaining is ₱0.00')
      expect(result.message).toContain('would go negative')
    }
  })

  it('allows cash to POS after starting cash covers it', () => {
    expect(validateEntry(
      { entry_date: '2026-09-21', type: 'pos_float', wallet: 'auditor_cash', amount: 1000 },
      seeded
    )).toEqual({ ok: true })
  })

  it('allows owner remit less than remaining and rejects more than remaining', () => {
    expect(validateEntry(
      { entry_date: '2026-09-25', type: 'owner_remittance', wallet: 'auditor_cash', amount: 400 },
      seeded
    )).toEqual({ ok: true })
    const over = validateEntry(
      { entry_date: '2026-09-25', type: 'owner_remittance', wallet: 'auditor_cash', amount: 1000.01 },
      seeded
    )
    expect(over.ok).toBe(false)
  })

  it('rejects amount <= 0 and expense without category', () => {
    expect(validateEntry(
      { entry_date: '2026-09-21', type: 'opening_cash', wallet: 'auditor_cash', amount: 0 },
      []
    ).ok).toBe(false)
    expect(validateEntry(
      { entry_date: '2026-09-21', type: 'expense', wallet: 'auditor_cash', amount: 10 },
      seeded
    ).ok).toBe(false)
  })

  it('validates fund_expense against auditor cash covering the transfer', () => {
    const ok = validateEntry(
      { entry_date: '2026-09-21', type: 'fund_expense', wallet: 'auditor_cash', amount: 300 },
      seeded
    )
    expect(ok).toEqual({ ok: true })
    const tooMuch = validateEntry(
      { entry_date: '2026-09-21', type: 'fund_expense', wallet: 'auditor_cash', amount: 1001 },
      seeded
    )
    expect(tooMuch.ok).toBe(false)
  })

  it('requires gcash_remittance on the GCash wallet', () => {
    expect(validateEntry(
      { entry_date: '2026-09-21', type: 'gcash_remittance', wallet: 'auditor_cash', amount: 10 },
      []
    ).ok).toBe(false)
    expect(validateEntry(
      { entry_date: '2026-09-21', type: 'gcash_remittance', wallet: 'gcash', amount: 10 },
      []
    )).toEqual({ ok: true })
  })

  it('credits auditor cash with Total Sales plus Petty Cash Returned', () => {
    expect(validateEntry(
      {
        entry_date: '2026-09-21',
        type: 'pos_remittance',
        wallet: 'auditor_cash',
        amount: 0,
        total_sales: 1800,
        petty_cash_returned: 200
      },
      []
    )).toEqual({ ok: true })
  })

  it('rejects cart cash remittance when both parts are missing or the total is 0', () => {
    expect(validateEntry(
      { entry_date: '2026-09-21', type: 'pos_remittance', wallet: 'auditor_cash', amount: 500 },
      []
    ).ok).toBe(false)
    expect(validateEntry(
      {
        entry_date: '2026-09-21',
        type: 'pos_remittance',
        wallet: 'auditor_cash',
        amount: 0,
        total_sales: 0,
        petty_cash_returned: 0
      },
      []
    ).ok).toBe(false)
  })
})

describe('manila week window', () => {
  it('returns Monday through Sunday for a Friday in Manila', () => {
    const week = manilaWeekWindow(new Date('2026-09-25T00:00:00.000Z'))
    expect(week).toEqual({ start: '2026-09-21', end: '2026-09-27' })
  })

  it('starts a new week on Manila Monday', () => {
    const sunday = manilaWeekWindow(new Date('2026-09-27T15:59:00.000Z'))
    expect(sunday.start).toBe('2026-09-21')
    const monday = manilaWeekWindow(new Date('2026-09-27T16:00:00.000Z'))
    expect(monday.start).toBe('2026-09-28')
  })

  it('manilaYmd uses Asia/Manila not the host timezone', () => {
    expect(manilaYmd(new Date('2026-09-27T16:05:00.000Z'))).toBe('2026-09-28')
  })
})

describe('weekSummary and filters', () => {
  const entries = [
    row({ id: '1', entry_date: '2026-09-21', type: 'opening_cash', wallet: 'auditor_cash', amount: 5000 }),
    row({ id: '2', entry_date: '2026-09-22', type: 'pos_remittance', wallet: 'auditor_cash', amount: 2000 }),
    row({ id: '3', entry_date: '2026-09-23', type: 'expense', wallet: 'auditor_cash', amount: 300, category: 'Utilities' }),
    row({ id: '4', entry_date: '2026-09-25', type: 'owner_remittance', wallet: 'auditor_cash', amount: 1500 }),
    row({ id: '5', entry_date: '2026-09-14', type: 'opening_cash', wallet: 'auditor_cash', amount: 50 }),
    row({ id: '6', entry_date: '2026-09-22', type: 'gcash_remittance', wallet: 'gcash', amount: 400 })
  ]

  it('week totals use only lines in the week; remaining uses all entries', () => {
    const summary = weekSummary(entries, { start: '2026-09-21', end: '2026-09-27' })
    expect(summary.posRemittanceIn).toBe(2000)
    expect(summary.expensesOut).toBe(300)
    expect(summary.ownerRemittance).toBe(1500)
    expect(summary.auditorCashRemaining).toBe(5250)
    expect(summary.gcashRemaining).toBe(400)
  })

  it('entriesInDateRange is inclusive', () => {
    expect(entriesInDateRange(entries, '2026-09-21', '2026-09-27').map((e) => e.id))
      .toEqual(['1', '2', '3', '4', '6'])
  })
})

describe('ledgerTypeLabel and ledgerWalletLabel', () => {
  it('returns the human labels', () => {
    expect(ledgerTypeLabel('opening_cash')).toBe('Starting cash')
    expect(ledgerTypeLabel('pos_float')).toBe('Initial Petty Cash')
    expect(ledgerTypeLabel('pos_remittance')).toBe('Cart Cash Remittance')
    expect(ledgerTypeLabel('gcash_remittance')).toBe('GCash remittance')
    expect(ledgerTypeLabel('owner_remittance')).toBe('Remit to owner')
    expect(ledgerTypeLabel('fund_expense')).toBe('Fund expense wallet')
    expect(ledgerTypeLabel('expense')).toBe('Total Expense')
    expect(ledgerWalletLabel('auditor_cash')).toBe('Auditor cash')
    expect(ledgerWalletLabel('expense')).toBe('Expense wallet')
    expect(ledgerWalletLabel('gcash')).toBe('GCash')
  })
})

describe('per-day balance checks', () => {
  const opening = row({ id: 'o', type: 'opening_cash', wallet: 'auditor_cash', amount: 1000, entry_date: '2026-09-24' })

  it('rejects a backdated expense dated before the cash came in', () => {
    const result = validateEntry(
      { entry_date: '2026-09-21', type: 'expense', wallet: 'auditor_cash', amount: 500, category: 'Supplies' },
      [opening]
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('would go negative on 2026-09-21')
  })

  it('allows spending on the same day the cash came in', () => {
    expect(validateEntry(
      { entry_date: '2026-09-24', type: 'expense', wallet: 'auditor_cash', amount: 1000, category: 'Supplies' },
      [opening]
    )).toEqual({ ok: true })
  })

  it('ignores float noise when spending the exact balance', () => {
    const entries = [
      row({ id: 'a', type: 'opening_cash', wallet: 'auditor_cash', amount: 0.1 }),
      row({ id: 'b', type: 'pos_remittance', wallet: 'auditor_cash', amount: 0.2 })
    ]
    expect(validateRemoval([], entries)).toEqual({ ok: true })
    expect(validateEntry(
      { entry_date: '2026-09-21', type: 'owner_remittance', wallet: 'auditor_cash', amount: 0.3 },
      entries
    )).toEqual({ ok: true })
  })

  it('blocks deleting cash that later spending depends on', () => {
    const expense = row({ id: 'e', type: 'expense', wallet: 'auditor_cash', amount: 800, category: 'Labor', entry_date: '2026-09-25' })
    const result = validateRemoval(['o'], [opening, expense])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain("Can't delete")
    expect(validateRemoval(['e'], [opening, expense])).toEqual({ ok: true })
  })

  it('still allows deletes when the ledger was already negative', () => {
    const badExpense = row({ id: 'e', type: 'expense', wallet: 'auditor_cash', amount: 800, category: 'Labor', entry_date: '2026-09-20' })
    const remit = row({ id: 'r', type: 'pos_remittance', wallet: 'auditor_cash', amount: 50, entry_date: '2026-09-26' })
    expect(validateRemoval(['e'], [opening, badExpense, remit])).toEqual({ ok: true })
  })
})
