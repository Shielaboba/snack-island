import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ledgerService } from '../../src/services/ledgerService'
import { supabase } from '../../src/supabase'
import { LEDGER_TABLE } from '../../src/models/Ledger'
import type { CreateLedgerEntryInput, LedgerEntry } from '../../src/models/Ledger'

vi.mock('../../src/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

const opening: LedgerEntry = {
  id: 'open-1',
  entry_date: '2026-09-21',
  type: 'opening_cash',
  wallet: 'auditor_cash',
  amount: 5000,
  category: null,
  note: null,
  transfer_id: null,
  created_by: 'ana',
  created_at: '2026-09-21T00:00:00.000Z',
  updated_at: '2026-09-21T00:00:00.000Z'
}

function mockSelectList(data: LedgerEntry[]) {
  const mockOrder2 = vi.fn().mockResolvedValue({ data, error: null })
  const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 })
  const mockSelect = vi.fn().mockReturnValue({ order: mockOrder1 })
  vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)
}

describe('ledgerService independence', () => {
  it('source file does not mention other business tables', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/services/ledgerService.ts'), 'utf8')
    expect(src).not.toMatch(/orders|expenses|store_sessions|sales_summary/)
  })
})

describe('ledgerService.list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('selects only ledger_entries', async () => {
    mockSelectList([opening])
    const rows = await ledgerService.list()
    expect(rows).toEqual([opening])
    expect(supabase.from).toHaveBeenCalledWith(LEDGER_TABLE)
    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(supabase.from).not.toHaveBeenCalledWith('orders')
    expect(supabase.from).not.toHaveBeenCalledWith('expenses')
  })
})

describe('ledgerService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a single opening_cash row after validation', async () => {
    const inserted = { ...opening, id: 'new-1' }
    const mockSelect = vi.fn().mockResolvedValue({ data: [inserted], error: null })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    const input: CreateLedgerEntryInput = {
      entry_date: '2026-09-21',
      type: 'opening_cash',
      wallet: 'auditor_cash',
      amount: 5000,
      created_by: 'ana'
    }
    const result = await ledgerService.create(input, [])
    expect(result).toEqual([inserted])
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'opening_cash',
        wallet: 'auditor_cash',
        amount: 5000,
        category: null,
        transfer_id: null
      })
    ])
    expect(supabase.from).toHaveBeenCalledWith('ledger_entries')
  })

  it('inserts two fund_expense rows with the same transfer_id', async () => {
    const pair = [
      { ...opening, id: 'a', type: 'fund_expense' as const, amount: 500, transfer_id: 'tid', wallet: 'auditor_cash' as const },
      { ...opening, id: 'b', type: 'fund_expense' as const, amount: 500, transfer_id: 'tid', wallet: 'expense' as const, category: null }
    ]
    const mockSelect = vi.fn().mockResolvedValue({ data: pair, error: null })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    await ledgerService.create(
      { entry_date: '2026-09-21', type: 'fund_expense', wallet: 'auditor_cash', amount: 500 },
      [opening]
    )
    const payload = mockInsert.mock.calls[0][0] as Array<{ transfer_id: string; wallet: string; type: string }>
    expect(payload).toHaveLength(2)
    expect(payload[0].transfer_id).toBe(payload[1].transfer_id)
    expect(payload.map((row) => row.wallet).sort()).toEqual(['auditor_cash', 'expense'])
    expect(payload.every((row) => row.type === 'fund_expense')).toBe(true)
  })

  it('inserts a single gcash_remittance row on the GCash wallet', async () => {
    const inserted = {
      ...opening,
      id: 'g1',
      type: 'gcash_remittance' as const,
      wallet: 'gcash' as const,
      amount: 750
    }
    const mockSelect = vi.fn().mockResolvedValue({ data: [inserted], error: null })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    await ledgerService.create(
      { entry_date: '2026-09-21', type: 'gcash_remittance', wallet: 'gcash', amount: 750 },
      []
    )
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'gcash_remittance',
        wallet: 'gcash',
        amount: 750,
        transfer_id: null
      })
    ])
  })

  it('throws when owner remit exceeds remaining', async () => {
    await expect(
      ledgerService.create(
        { entry_date: '2026-09-25', type: 'owner_remittance', wallet: 'auditor_cash', amount: 9000 },
        [opening]
      )
    ).rejects.toThrow(/would go negative/)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('ledgerService.update and remove', () => {
  const transferId = 'xfer-1'
  const pair: LedgerEntry[] = [
    { ...opening, id: 'p1', type: 'fund_expense', amount: 500, transfer_id: transferId, wallet: 'auditor_cash' },
    { ...opening, id: 'p2', type: 'fund_expense', amount: 500, transfer_id: transferId, wallet: 'expense' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('update of one fund_expense row updates both by transfer_id', async () => {
    const mockIn = vi.fn().mockResolvedValue({ data: pair, error: null })
    const mockSelect = vi.fn().mockReturnValue({ in: mockIn })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await ledgerService.update('p1', { amount: 400, entry_date: '2026-09-22' }, [opening, ...pair])
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ amount: 400, entry_date: '2026-09-22' }))
    expect(mockEq).toHaveBeenCalledWith('transfer_id', transferId)
  })

  it('remove of one fund_expense row deletes both by transfer_id', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ delete: mockDelete } as any)

    await ledgerService.remove('p2', [opening, ...pair])
    expect(mockEq).toHaveBeenCalledWith('transfer_id', transferId)
  })

  it('ignores patch.wallet and validates the stored wallet', async () => {
    const expenseSpend: LedgerEntry = {
      ...opening,
      id: 'e1',
      type: 'expense',
      wallet: 'expense',
      amount: 10,
      category: 'Supplies'
    }
    const existing: LedgerEntry[] = [
      opening,
      { ...opening, id: 'p1', type: 'fund_expense', amount: 80, transfer_id: 't', wallet: 'auditor_cash' },
      { ...opening, id: 'p2', type: 'fund_expense', amount: 80, transfer_id: 't', wallet: 'expense' },
      expenseSpend
    ]
    await expect(
      ledgerService.update('e1', { amount: 100, wallet: 'auditor_cash' }, existing)
    ).rejects.toThrow(/Expense wallet remaining/)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('remove of a normal row deletes by id', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ delete: mockDelete } as any)

    await ledgerService.remove('open-1', [opening])
    expect(mockEq).toHaveBeenCalledWith('id', 'open-1')
  })

  it('refuses to delete starting cash that an expense depends on', async () => {
    const expense: LedgerEntry = { ...opening, id: 'e1', type: 'expense', amount: 800, category: 'Labor' }
    await expect(ledgerService.remove('open-1', [opening, expense])).rejects.toThrow(/Can't delete/)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
