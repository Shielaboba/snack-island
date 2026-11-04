/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import Ledger from '../../src/components/Ledger.vue'
import type { LedgerEntry } from '../../src/models/Ledger'
import { manilaYmd } from '../../src/modules/ledger/ledgerUtils'

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
const remove = vi.fn(async () => undefined)

vi.mock('../../src/services/ledgerService', () => ({
  ledgerService: {
    list: (...args: unknown[]) => list(...args),
    create: (...args: unknown[]) => create(...args),
    update: vi.fn(),
    remove: (...args: unknown[]) => remove(...args)
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
    remove.mockClear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('shows remaining cards from all entries, not only the filtered week', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const auditor = el.querySelector('[data-testid="auditor-remaining"]')?.textContent ?? ''
    expect(auditor).toContain('3,000.00')
    expect(el.querySelector('[data-testid="expense-remaining"]')?.textContent).toContain('0.00')
    expect(el.querySelector('[data-testid="gcash-remaining"]')?.textContent).toContain('0.00')
    expect(el.querySelector('[data-testid="auditor-card"]')?.textContent).toContain('Held by auditor')
    expect(el.querySelector('[data-testid="expense-card"]')?.textContent).toContain('Operating spends')
    expect(el.querySelector('[data-testid="gcash-card"]')?.textContent).toContain('Digital wallet')
    app.unmount()
  })

  it('shows this-week movement as labeled metric cards', async () => {
    const today = manilaYmd(new Date())
    list.mockResolvedValueOnce([
      { ...entries[1], id: 'w-pos', entry_date: today, amount: 7636 },
      {
        ...entries[0],
        id: 'w-exp',
        entry_date: today,
        type: 'expense',
        amount: 7951,
        category: 'Labor'
      }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const strip = el.querySelector('[data-testid="week-strip"]')
    expect(strip?.textContent).toContain('This week')
    expect(el.querySelector('[data-testid="week-pos-card"]')?.textContent).toContain('In from POS')
    expect(el.querySelector('[data-testid="week-expense-card"]')?.textContent).toContain('Expenses out')
    expect(el.querySelector('[data-testid="week-owner-card"]')?.textContent).toContain('Remitted to owner')
    expect(el.querySelector('[data-testid="week-pos-in"]')?.textContent).toContain('7,636.00')
    expect(el.querySelector('[data-testid="week-expenses"]')?.textContent).toContain('7,951.00')
    expect(el.querySelector('[data-testid="week-owner"]')?.textContent).toContain('0.00')
    app.unmount()
  })

  it('clicking a wallet card filters the table to that wallet', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const card = el.querySelector('[data-testid="gcash-card"]') as HTMLButtonElement
    card.click()
    await nextTick()
    const filter = el.querySelector('[data-testid="wallet-filter"]') as HTMLSelectElement
    expect(filter.value).toBe('gcash')
    expect(card.classList.contains('active')).toBe(true)
    card.click()
    await nextTick()
    expect(filter.value).toBe('')
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
    const wallet = document.querySelector('[data-testid="ledger-wallet"]') as HTMLSelectElement
    wallet.value = 'auditor_cash'
    wallet.dispatchEvent(new Event('change'))
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

  it('sends only one create when Save is clicked twice quickly', async () => {
    let resolveCreate: () => void = () => {}
    create.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveCreate = resolve }))
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="add-entry-btn"]') as HTMLButtonElement).click()
    await nextTick()
    const amount = document.querySelector('[data-testid="ledger-amount"]') as HTMLInputElement
    amount.value = '100'
    amount.dispatchEvent(new Event('input'))
    const submit = document.querySelector('[data-testid="ledger-submit"]') as HTMLButtonElement
    submit.click()
    submit.click()
    await nextTick()
    expect(create).toHaveBeenCalledTimes(1)
    resolveCreate()
    await nextTick()
    app.unmount()
  })

  it('collapses a Fund Transfer Wallet pair into Auditor → GCash', async () => {
    const today = manilaYmd(new Date())
    list.mockResolvedValueOnce([
      {
        ...entries[0],
        id: 'ft-a',
        entry_date: today,
        type: 'fund_transfer',
        wallet: 'auditor_cash',
        amount: 200,
        transfer_id: 'ft-1',
        transfer_from: 'auditor_cash',
        transfer_to: 'gcash'
      },
      {
        ...entries[0],
        id: 'ft-g',
        entry_date: today,
        type: 'fund_transfer',
        wallet: 'gcash',
        amount: 200,
        transfer_id: 'ft-1',
        transfer_from: 'auditor_cash',
        transfer_to: 'gcash'
      }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const rows = [...el.querySelectorAll('.table-row')]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.textContent).toContain('Fund Transfer Wallet')
    expect(rows[0]?.textContent).toContain('Auditor → GCash')
    app.unmount()
  })

  it('paginates the table 10 rows per page with zebra rows', async () => {
    const today = manilaYmd(new Date())
    list.mockResolvedValueOnce(
      Array.from({ length: 12 }, (_, i) => ({
        ...entries[0],
        id: `page-${i + 1}`,
        entry_date: today,
        note: `row ${i + 1}`
      }))
    )
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const rows = () => [...el.querySelectorAll('.table-row')]
    expect(rows()).toHaveLength(10)
    expect(rows()[0]?.textContent).toContain('row 1')
    expect(rows()[9]?.textContent).toContain('row 10')
    expect(rows()[0]?.classList.contains('table-row-alt')).toBe(false)
    expect(rows()[1]?.classList.contains('table-row-alt')).toBe(true)
    expect(el.querySelector('[data-testid="ledger-pagination"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="ledger-page-1"]')?.classList.contains('active')).toBe(true)
    ;(el.querySelector('[data-testid="ledger-page-2"]') as HTMLButtonElement).click()
    await nextTick()
    expect(rows()).toHaveLength(2)
    expect(rows()[0]?.textContent).toContain('row 11')
    expect(rows()[1]?.textContent).toContain('row 12')
    expect(rows()[0]?.classList.contains('table-row-alt')).toBe(false)
    expect(rows()[1]?.classList.contains('table-row-alt')).toBe(true)
    ;(el.querySelector('[data-testid="ledger-page-prev"]') as HTMLButtonElement).click()
    await nextTick()
    expect(rows()).toHaveLength(10)
    expect(rows()[0]?.textContent).toContain('row 1')
    app.unmount()
  })

  it('hides pagination when there are 10 or fewer visible rows', async () => {
    list.mockResolvedValueOnce([
      { ...entries[0], id: 'only', entry_date: manilaYmd(new Date()) }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelectorAll('.table-row')).toHaveLength(1)
    expect(el.querySelector('[data-testid="ledger-pagination"]')).toBeNull()
    app.unmount()
  })

  it('uses icon buttons for edit and delete', async () => {
    list.mockResolvedValueOnce([
      { ...entries[0], id: 'icon-1', entry_date: manilaYmd(new Date()) }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const edit = el.querySelector('[data-testid="edit-entry-btn"]') as HTMLButtonElement
    const del = el.querySelector('[data-testid="delete-entry-btn"]') as HTMLButtonElement
    expect(edit.getAttribute('aria-label')).toBe('Edit')
    expect(del.getAttribute('aria-label')).toBe('Delete')
    expect(edit.querySelector('svg')).not.toBeNull()
    expect(del.querySelector('svg')).not.toBeNull()
    expect(edit.textContent?.replace(/\s+/g, '')).toBe('')
    expect(del.textContent?.replace(/\s+/g, '')).toBe('')
    app.unmount()
  })

  it('opens a delete confirmation modal instead of window.confirm', async () => {
    list.mockResolvedValueOnce([
      { ...entries[0], id: 'del-1', entry_date: manilaYmd(new Date()) }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="delete-entry-btn"]') as HTMLButtonElement).click()
    await nextTick()
    expect(document.querySelector('[data-testid="ledger-delete-modal"]')).not.toBeNull()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    app.unmount()
  })

  it('does not delete when Cancel is clicked', async () => {
    list.mockResolvedValueOnce([
      { ...entries[0], id: 'del-1', entry_date: manilaYmd(new Date()) }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="delete-entry-btn"]') as HTMLButtonElement).click()
    await nextTick()
    ;(document.querySelector('[data-testid="ledger-delete-cancel"]') as HTMLButtonElement).click()
    await nextTick()
    expect(remove).not.toHaveBeenCalled()
    expect(document.querySelector('[data-testid="ledger-delete-modal"]')).toBeNull()
    app.unmount()
  })

  it('deletes after the confirmation modal is confirmed', async () => {
    list.mockResolvedValue([
      { ...entries[0], id: 'del-1', entry_date: manilaYmd(new Date()) }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="delete-entry-btn"]') as HTMLButtonElement).click()
    await nextTick()
    ;(document.querySelector('[data-testid="ledger-delete-confirm"]') as HTMLButtonElement).click()
    await nextTick()
    await nextTick()
    expect(remove).toHaveBeenCalledWith('del-1', expect.any(Array))
    expect(remove).toHaveBeenCalledTimes(1)
    app.unmount()
  })
})
