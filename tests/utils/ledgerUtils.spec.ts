import { describe, it, expect } from 'vitest'
import type { LedgerEntry } from '../../src/models/Ledger'
import {
  dailyRemaining,
  entriesInDateRange,
  entryDelta,
  ledgerTypeLabel,
  manilaWeekWindow,
  manilaYmd,
  validateEntry,
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
    created_by: partial.created_by ?? 'auditor',
    created_at: partial.created_at ?? '2026-09-21T00:00:00.000Z',
    updated_at: partial.updated_at ?? '2026-09-21T00:00:00.000Z'
  }
}

describe('entryDelta', () => {
  it('credits auditor cash for opening_cash and pos_remittance', () => {
    expect(entryDelta({ type: 'opening_cash', wallet: 'auditor_cash', amount: 5000 }))
      .toEqual({ auditor_cash: 5000, petty_cash: 0 })
    expect(entryDelta({ type: 'pos_remittance', wallet: 'auditor_cash', amount: 2000 }))
      .toEqual({ auditor_cash: 2000, petty_cash: 0 })
  })

  it('debits auditor cash for pos_float, owner_remittance, and auditor expense', () => {
    expect(entryDelta({ type: 'pos_float', wallet: 'auditor_cash', amount: 1000 }))
      .toEqual({ auditor_cash: -1000, petty_cash: 0 })
    expect(entryDelta({ type: 'owner_remittance', wallet: 'auditor_cash', amount: 3000 }))
      .toEqual({ auditor_cash: -3000, petty_cash: 0 })
    expect(entryDelta({ type: 'expense', wallet: 'auditor_cash', amount: 400 }))
      .toEqual({ auditor_cash: -400, petty_cash: 0 })
  })

  it('moves petty issue on the matching wallet only', () => {
    expect(entryDelta({ type: 'petty_issue', wallet: 'auditor_cash', amount: 500 }))
      .toEqual({ auditor_cash: -500, petty_cash: 0 })
    expect(entryDelta({ type: 'petty_issue', wallet: 'petty_cash', amount: 500 }))
      .toEqual({ auditor_cash: 0, petty_cash: 500 })
  })

  it('debits only petty cash for a petty-cash expense', () => {
    expect(entryDelta({ type: 'expense', wallet: 'petty_cash', amount: 80 }))
      .toEqual({ auditor_cash: 0, petty_cash: -80 })
  })
})

describe('walletRemaining and dailyRemaining', () => {
  const entries = [
    row({ id: '1', entry_date: '2026-09-21', type: 'opening_cash', wallet: 'auditor_cash', amount: 5000 }),
    row({ id: '2', entry_date: '2026-09-21', type: 'pos_float', wallet: 'auditor_cash', amount: 1000 }),
    row({ id: '3', entry_date: '2026-09-22', type: 'pos_remittance', wallet: 'auditor_cash', amount: 2500 }),
    row({ id: '4', entry_date: '2026-09-22', type: 'petty_issue', wallet: 'auditor_cash', amount: 500, transfer_id: 't1' }),
    row({ id: '5', entry_date: '2026-09-22', type: 'petty_issue', wallet: 'petty_cash', amount: 500, transfer_id: 't1' }),
    row({ id: '6', entry_date: '2026-09-23', type: 'expense', wallet: 'petty_cash', amount: 120, category: 'Supplies' }),
    row({ id: '7', entry_date: '2026-09-24', type: 'expense', wallet: 'auditor_cash', amount: 800, category: 'Labor' }),
    row({ id: '8', entry_date: '2026-09-25', type: 'owner_remittance', wallet: 'auditor_cash', amount: 4000 })
  ]

  it('sums all deltas per wallet including leftover after a partial owner remit', () => {
    // 5000 - 1000 + 2500 - 500 - 800 - 4000 = 1200 auditor
    expect(walletRemaining(entries, 'auditor_cash')).toBe(1200)
    // 500 - 120 = 380 petty
    expect(walletRemaining(entries, 'petty_cash')).toBe(380)
  })

  it('daily remaining is the running balance through that date', () => {
    expect(dailyRemaining(entries, 'auditor_cash', '2026-09-21')).toBe(4000)
    expect(dailyRemaining(entries, 'auditor_cash', '2026-09-22')).toBe(6000)
    expect(dailyRemaining(entries, 'petty_cash', '2026-09-22')).toBe(500)
    expect(dailyRemaining(entries, 'petty_cash', '2026-09-23')).toBe(380)
  })

  it('expense on auditor cash does not change petty cash', () => {
    const before = walletRemaining(entries.slice(0, 6), 'petty_cash')
    const afterLabor = [...entries.slice(0, 6), entries[6]]
    expect(walletRemaining(afterLabor, 'petty_cash')).toBe(before)
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

  it('validates petty_issue against both wallets (auditor must cover the issue)', () => {
    const ok = validateEntry(
      { entry_date: '2026-09-21', type: 'petty_issue', wallet: 'auditor_cash', amount: 300 },
      seeded
    )
    expect(ok).toEqual({ ok: true })
    const tooMuch = validateEntry(
      { entry_date: '2026-09-21', type: 'petty_issue', wallet: 'auditor_cash', amount: 1001 },
      seeded
    )
    expect(tooMuch.ok).toBe(false)
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
    row({ id: '5', entry_date: '2026-09-14', type: 'opening_cash', wallet: 'auditor_cash', amount: 50 })
  ]

  it('week totals use only lines in the week; remaining uses all entries', () => {
    const summary = weekSummary(entries, { start: '2026-09-21', end: '2026-09-27' })
    expect(summary.posRemittanceIn).toBe(2000)
    expect(summary.expensesOut).toBe(300)
    expect(summary.ownerRemittance).toBe(1500)
    expect(summary.auditorCashRemaining).toBe(5250)
  })

  it('entriesInDateRange is inclusive', () => {
    expect(entriesInDateRange(entries, '2026-09-21', '2026-09-27').map((e) => e.id))
      .toEqual(['1', '2', '3', '4'])
  })
})

describe('ledgerTypeLabel', () => {
  it('returns the spec human labels', () => {
    expect(ledgerTypeLabel('opening_cash')).toBe('Starting cash')
    expect(ledgerTypeLabel('pos_float')).toBe('Cash to POS')
    expect(ledgerTypeLabel('pos_remittance')).toBe('Remittance from POS')
    expect(ledgerTypeLabel('owner_remittance')).toBe('Remit to owner')
    expect(ledgerTypeLabel('petty_issue')).toBe('Petty cash issued')
    expect(ledgerTypeLabel('expense')).toBe('Expense')
  })
})
