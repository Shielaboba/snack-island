/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import Ledger from '../../src/components/Ledger.vue'
import type { LedgerEntry } from '../../src/models/Ledger'

const entries: LedgerEntry[] = [
  {
    id: '1',
    entry_date: '2026-09-14',
    type: 'opening_cash',
    wallet: 'auditor_cash',
    amount: 2000,
    category: null,
    note: 'last week leftover',
    transfer_id: null,
    created_by: 'ana',
    created_at: '2026-09-14T00:00:00.000Z',
    updated_at: '2026-09-14T00:00:00.000Z'
  },
  {
    id: '2',
    entry_date: '2026-09-22',
    type: 'pos_remittance',
    wallet: 'auditor_cash',
    amount: 1000,
    category: null,
    note: null,
    transfer_id: null,
    created_by: 'ana',
    created_at: '2026-09-22T00:00:00.000Z',
    updated_at: '2026-09-22T00:00:00.000Z'
  }
]

const list = vi.fn(async () => entries)
const create = vi.fn(async () => entries)

vi.mock('../../src/services/ledgerService', () => ({
  ledgerService: {
    list: (...args: unknown[]) => list(...args),
    create: (...args: unknown[]) => create(...args),
    update: vi.fn(),
    remove: vi.fn()
  }
}))

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: () => ({ id: '2', username: 'ana', roleId: 2 })
  }
}))

function mountPage() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp(Ledger)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/ledger', component: Ledger }]
  })
  app.use(router)
  app.mount(el)
  return { el, app }
}

describe('Ledger.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    list.mockClear()
    create.mockClear()
  })

  it('shows remaining cards from all entries, not only the filtered week', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const auditor = el.querySelector('[data-testid="auditor-remaining"]')?.textContent ?? ''
    expect(auditor).toContain('3,000.00')
    expect(el.querySelector('[data-testid="petty-remaining"]')?.textContent).toContain('0.00')
    app.unmount()
  })

  it('opens remit-to-owner without requiring the full remaining', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const btn = el.querySelector('[data-testid="remit-owner-btn"]') as HTMLButtonElement
    expect(btn).not.toBeNull()
    btn.click()
    await nextTick()
    const amount = document.querySelector('[data-testid="ledger-amount"]') as HTMLInputElement
    amount.value = '500'
    amount.dispatchEvent(new Event('input'))
    ;(document.querySelector('[data-testid="ledger-submit"]') as HTMLButtonElement).click()
    await nextTick()
    await nextTick()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'owner_remittance',
        wallet: 'auditor_cash',
        amount: 500
      }),
      expect.any(Array)
    )
    app.unmount()
  })

  it('creates a Labor expense on auditor cash only', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="add-entry-btn"]') as HTMLButtonElement).click()
    await nextTick()
    const type = document.querySelector('[data-testid="ledger-type"]') as HTMLSelectElement
    type.value = 'expense'
    type.dispatchEvent(new Event('change'))
    await nextTick()
    const category = document.querySelector('[data-testid="ledger-category"]') as HTMLSelectElement
    category.value = 'Labor'
    category.dispatchEvent(new Event('change'))
    const amount = document.querySelector('[data-testid="ledger-amount"]') as HTMLInputElement
    amount.value = '800'
    amount.dispatchEvent(new Event('input'))
    ;(document.querySelector('[data-testid="ledger-submit"]') as HTMLButtonElement).click()
    await nextTick()
    await nextTick()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        wallet: 'auditor_cash',
        category: 'Labor',
        amount: 800
      }),
      expect.any(Array)
    )
    app.unmount()
  })

  it('shows save errors inside the modal and keeps remaining cards', async () => {
    create.mockRejectedValueOnce(
      new Error('Auditor cash remaining is ₱0.00. This would go negative.')
    )
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="add-entry-btn"]') as HTMLButtonElement).click()
    await nextTick()
    const amount = document.querySelector('[data-testid="ledger-amount"]') as HTMLInputElement
    amount.value = '1'
    amount.dispatchEvent(new Event('input'))
    ;(document.querySelector('[data-testid="ledger-submit"]') as HTMLButtonElement).click()
    await nextTick()
    await nextTick()
    expect(document.querySelector('[data-testid="ledger-modal-error"]')?.textContent)
      .toContain('would go negative')
    expect(el.querySelector('[data-testid="auditor-remaining"]')?.textContent).toContain('3,000.00')
    app.unmount()
  })
})
