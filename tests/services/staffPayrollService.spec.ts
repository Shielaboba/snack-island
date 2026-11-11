import { describe, it, expect, vi, beforeEach } from 'vitest'
import { staffPayrollService, STAFF_PAYROLL_TABLE } from '../../src/services/staffPayrollService'
import { supabase } from '../../src/supabase'
import { PAYROLL_STORAGE_KEYS } from '../../src/modules/staff/staffProfile'

vi.mock('../../src/supabase', () => ({
  supabase: { from: vi.fn() }
}))

vi.mock('../../src/services/authService', () => ({
  authService: { getCurrentUser: vi.fn(() => ({ username: 'ana' })) }
}))

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    }
  }
}

function mockTable(rows: { key: string; data: unknown }[]) {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const select = vi.fn().mockResolvedValue({ data: rows, error: null })
  vi.mocked(supabase.from).mockReturnValue({ select, upsert } as never)
  return { select, upsert }
}

const payables = [{ id: 'loan-1', name: 'Cash advance', staffName: 'Shai' }]
const compensation = [{ id: 'compensation-1', name: 'Gas', staffName: 'Den', amount: 100 }]
const profiles = [{ name: 'Shai', ratePerDay: 500 }]
const payments = [{ id: 'payment-1', staffName: 'Den', amount: 500 }]

describe('staffPayrollService.pull', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('replaces this browser with the database lists and does not write those lists back', async () => {
    const sharedPayables = [{ id: 'loan-9', name: 'Shared advance', staffName: 'Den' }]
    const storage = memoryStorage({
      [PAYROLL_STORAGE_KEYS.payables]: JSON.stringify(payables),
      [PAYROLL_STORAGE_KEYS.compensation]: JSON.stringify(compensation),
      [PAYROLL_STORAGE_KEYS.profiles]: JSON.stringify(profiles),
      [PAYROLL_STORAGE_KEYS.payments]: JSON.stringify(payments)
    })
    const { select, upsert } = mockTable([
      { key: 'payables', data: sharedPayables },
      { key: 'compensation', data: [] },
      { key: 'payments', data: payments }
    ])

    await staffPayrollService.pull(storage)

    expect(supabase.from).toHaveBeenCalledWith(STAFF_PAYROLL_TABLE)
    expect(select).toHaveBeenCalledWith('key, data')
    expect(upsert).not.toHaveBeenCalled()
    expect(JSON.parse(storage.getItem(PAYROLL_STORAGE_KEYS.payables) ?? 'null')).toEqual(sharedPayables)
    expect(JSON.parse(storage.getItem(PAYROLL_STORAGE_KEYS.compensation) ?? 'null')).toEqual([])
    expect(JSON.parse(storage.getItem(PAYROLL_STORAGE_KEYS.payments) ?? 'null')).toEqual(payments)
    expect(JSON.parse(storage.getItem(PAYROLL_STORAGE_KEYS.profiles) ?? 'null')).toEqual([])
  })

  it('clears a list that was saved only in this browser when the database row is empty', async () => {
    const storage = memoryStorage({
      [PAYROLL_STORAGE_KEYS.payables]: JSON.stringify(payables)
    })
    const { upsert } = mockTable([{ key: 'payables', data: [] }])

    await staffPayrollService.pull(storage)

    expect(upsert).not.toHaveBeenCalled()
    expect(JSON.parse(storage.getItem(PAYROLL_STORAGE_KEYS.payables) ?? 'null')).toEqual([])
  })

  it('copies a shared list into a browser that has none', async () => {
    const storage = memoryStorage()
    const { upsert } = mockTable([{ key: 'payables', data: payables }])

    await staffPayrollService.pull(storage)

    expect(upsert).not.toHaveBeenCalled()
    expect(JSON.parse(storage.getItem(PAYROLL_STORAGE_KEYS.payables) ?? 'null')).toEqual(payables)
  })
})
