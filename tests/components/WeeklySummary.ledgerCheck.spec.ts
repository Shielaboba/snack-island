/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import WeeklySummary from '../../src/components/WeeklySummary.vue'
import type { LedgerEntry } from '../../src/models/Ledger'

const ledgerList = vi.fn<() => Promise<LedgerEntry[]>>()

vi.mock('../../src/services/ledgerService', () => ({
  ledgerService: { list: () => ledgerList() },
}))

vi.mock('../../src/services/storeSessionService', () => ({
  StoreSessionService: {
    getAllSessions: async () => [
      { id: 's1', opened_at: '2026-10-23T01:00:00Z', closed_at: '2026-10-23T12:00:00Z' },
    ],
    getSessionRange: (s: { opened_at: string; closed_at: string }) => ({
      start: new Date(s.opened_at),
      end: new Date(s.closed_at),
    }),
  },
}))

vi.mock('../../src/services/orderService', () => ({
  OrderService: {
    getOrders: async () => [
      { id: 'o1', status: 'completed', created_at: '2026-10-23T05:00:00Z', payment_method: 'cash', total_amount: 1000 },
    ],
    getOrderItemsBulk: async () => [],
  },
}))

vi.mock('../../src/services/expenseService', () => ({
  expenseService: {
    getAll: async () => [
      { id: 'e1', expense_date: '2026-10-23', category: 'Supplies', description: 'cups', amount: 200 },
    ],
  },
}))

const startCounts = vi.fn(async () => [{ session_id: 's1', name: 'Cash', start_of_day: 500 }])
vi.mock('../../src/services/auditService', () => ({
  AuditService: { getStartCounts: (ids: string[]) => startCounts(ids) },
}))

vi.mock('../../src/services/menuItemService', () => ({ menuItemService: { getMenuItems: async () => [] } }))
vi.mock('../../src/services/discountService', () => ({ discountService: { getAll: async () => [] } }))

function ledgerRow(type: LedgerEntry['type'], amount: number, category: LedgerEntry['category'] = null): LedgerEntry {
  return {
    id: `${type}-${amount}`,
    entry_date: '2026-10-23',
    type,
    wallet: 'auditor_cash',
    amount,
    category,
    note: null,
    transfer_id: null,
    created_by: null,
    created_at: '2026-10-23T10:00:00Z',
    updated_at: '2026-10-23T10:00:00Z',
  }
}

async function mountPage() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp(WeeklySummary)
  app.mount(el)
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
    await nextTick()
  }
  return { el, unmount: () => app.unmount() }
}

describe('WeeklySummary ledger check', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T04:00:00Z')) // week shown: Oct 23–29
    ledgerList.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows everything matches when the ledger agrees', async () => {
    ledgerList.mockResolvedValue([ledgerRow('pos_remittance', 1500), ledgerRow('expense', 200, 'Supplies')])
    const { el, unmount } = await mountPage()
    expect(el.textContent).toContain('Ledger check')
    expect(el.textContent).toContain('Everything matches')
    unmount()
  })

  it('counts mismatches when the ledger remit is short', async () => {
    ledgerList.mockResolvedValue([ledgerRow('pos_remittance', 1400), ledgerRow('expense', 200, 'Supplies')])
    const { el, unmount } = await mountPage()
    expect(el.textContent).toContain('1 mismatch')
    expect(el.querySelectorAll('tr.row-bad').length).toBe(1)
    unmount()
  })

  it('shows the start-of-day count from the Audit page', async () => {
    ledgerList.mockResolvedValue([ledgerRow('pos_remittance', 1500), ledgerRow('expense', 200, 'Supplies')])
    const { el, unmount } = await mountPage()
    expect(startCounts).toHaveBeenCalledWith(['s1'])
    expect(el.textContent).toContain('Start count')
    expect(el.textContent).toContain('₱500.00')
    unmount()
  })

  it('shows the owner remit table', async () => {
    ledgerList.mockResolvedValue([ledgerRow('pos_remittance', 1500), ledgerRow('expense', 200, 'Supplies')])
    const { el, unmount } = await mountPage()
    expect(el.textContent).toContain('Owner remit')
    // Carried in 500, Fri: + 1500 − 500 petty cash − 200 expenses = 1300; next Friday closed → remit 1300
    expect(el.textContent).toContain('Carried from last week')
    expect(el.textContent).toContain('Cash on hand')
    expect(el.textContent).toContain('₱1,300.00')
    unmount()
  })

  it('the hand-over card shows the rolling owner remit', async () => {
    ledgerList.mockResolvedValue([
      ledgerRow('pos_remittance', 1500),
      ledgerRow('expense', 200, 'Supplies'),
      { ...ledgerRow('owner_remittance', 1000), entry_date: '2026-10-29' },
    ])
    const { el, unmount } = await mountPage()
    const card = el.querySelector('.handover-card')!.textContent!
    expect(card).toContain('₱1,300.00')
    expect(card).toContain('Thursday cash on hand')
    expect(card).toContain('Remitted to owner in the ledger: ₱1,000.00')
    expect(card).not.toContain('Cash sales')
    unmount()
  })

  it('the hand-over card waits for the ledger remittances', async () => {
    ledgerList.mockResolvedValue([])
    const { el, unmount } = await mountPage()
    expect(el.querySelector('.handover-card')!.textContent).toContain('No Cart Cash Remittance entered')
    unmount()
  })

  it('still shows the summary when the ledger fails to load', async () => {
    ledgerList.mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { el, unmount } = await mountPage()
    expect(el.textContent).toContain('Could not load the ledger')
    expect(el.textContent).toContain('Expected cash to hand over')
    unmount()
  })
})
