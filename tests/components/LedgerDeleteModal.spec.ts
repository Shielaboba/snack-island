/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest'
import { createApp, nextTick } from 'vue'
import LedgerDeleteModal from '../../src/components/LedgerDeleteModal.vue'
import type { LedgerEntry } from '../../src/models/Ledger'

const entry: LedgerEntry = {
  id: '1',
  entry_date: '2026-09-22',
  type: 'opening_cash',
  wallet: 'auditor_cash',
  amount: 2000,
  category: null,
  note: null,
  transfer_id: null,
  created_by: 'ana',
  created_at: '2026-09-22T00:00:00.000Z',
  updated_at: '2026-09-22T00:00:00.000Z'
}

function mountModal(props: Record<string, unknown>) {
  const el = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(el)
  let closed = false
  let confirmed = false
  const app = createApp(LedgerDeleteModal, {
    ...props,
    onClose: () => {
      closed = true
    },
    onConfirm: () => {
      confirmed = true
    }
  })
  app.mount(el)
  return { app, wasClosed: () => closed, wasConfirmed: () => confirmed }
}

describe('LedgerDeleteModal', () => {
  it('is hidden when closed', async () => {
    const { app } = mountModal({ isOpen: false, entry, deleting: false, error: '' })
    await nextTick()
    expect(document.querySelector('[data-testid="ledger-delete-modal"]')).toBeNull()
    app.unmount()
  })

  it('asks to delete the entry by type and amount', async () => {
    const { app } = mountModal({ isOpen: true, entry, deleting: false, error: '' })
    await nextTick()
    const modal = document.querySelector('[data-testid="ledger-delete-modal"]')
    expect(modal?.textContent).toContain('Starting cash')
    expect(modal?.textContent).toContain('2,000.00')
    expect(modal?.textContent).toContain('cannot be undone')
    app.unmount()
  })

  it('explains that a two-wallet fund transfer delete removes both rows', async () => {
    const { app } = mountModal({
      isOpen: true,
      entry: {
        ...entry,
        type: 'fund_transfer',
        transfer_id: 't2',
        amount: 200,
        transfer_from: 'auditor_cash',
        transfer_to: 'gcash'
      },
      deleting: false,
      error: ''
    })
    await nextTick()
    expect(document.querySelector('[data-testid="ledger-delete-modal"]')?.textContent)
      .toContain('matching transfer')
    app.unmount()
  })

  it('explains that a fund expense delete removes both wallet rows', async () => {
    const { app } = mountModal({
      isOpen: true,
      entry: { ...entry, type: 'fund_expense', transfer_id: 't1', amount: 500 },
      deleting: false,
      error: ''
    })
    await nextTick()
    expect(document.querySelector('[data-testid="ledger-delete-modal"]')?.textContent)
      .toContain('matching transfer')
    app.unmount()
  })

  it('Cancel closes without confirming', async () => {
    const { app, wasClosed, wasConfirmed } = mountModal({
      isOpen: true,
      entry,
      deleting: false,
      error: ''
    })
    await nextTick()
    ;(document.querySelector('[data-testid="ledger-delete-cancel"]') as HTMLButtonElement).click()
    expect(wasClosed()).toBe(true)
    expect(wasConfirmed()).toBe(false)
    app.unmount()
  })

  it('Delete confirms once and stays disabled while deleting', async () => {
    const { app, wasConfirmed } = mountModal({
      isOpen: true,
      entry,
      deleting: true,
      error: ''
    })
    await nextTick()
    const confirm = document.querySelector('[data-testid="ledger-delete-confirm"]') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    confirm.click()
    expect(wasConfirmed()).toBe(false)
    app.unmount()
  })

  it('shows a delete error inside the modal', async () => {
    const { app } = mountModal({
      isOpen: true,
      entry,
      deleting: false,
      error: "Can't delete. Auditor cash remaining is ₱0.00."
    })
    await nextTick()
    expect(document.querySelector('[data-testid="ledger-delete-error"]')?.textContent)
      .toContain("Can't delete")
    app.unmount()
  })
})
