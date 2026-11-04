/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest'
import { createApp, nextTick } from 'vue'
import LedgerEntryModal from '../../src/components/LedgerEntryModal.vue'
import { manilaYmd } from '../../src/modules/ledger/ledgerUtils'

function mountModal(props: Record<string, unknown>) {
  const el = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(el)
  let submitted: unknown = null
  const app = createApp(LedgerEntryModal, {
    ...props,
    onSubmit: (value: unknown) => {
      submitted = value
    }
  })
  app.mount(el)
  return { el, app, getSubmitted: () => submitted }
}

describe('LedgerEntryModal', () => {
  it('locks remit-to-owner to owner_remittance and auditor cash', async () => {
    const { el, app } = mountModal({ isOpen: true, mode: 'remit-owner' })
    await nextTick()
    const type = document.querySelector('[data-testid="ledger-type"]') as HTMLSelectElement | HTMLInputElement | null
    const wallet = document.querySelector('[data-testid="ledger-wallet"]') as HTMLSelectElement | null
    expect(type?.value || type?.getAttribute('data-value')).toBe('owner_remittance')
    expect(wallet?.disabled || wallet?.value === 'auditor_cash').toBeTruthy()
    app.unmount()
  })

  it('defaults Total Expense to the expense wallet without locking it', async () => {
    const { app } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    const type = document.querySelector('[data-testid="ledger-type"]') as HTMLSelectElement
    const wallet = document.querySelector('[data-testid="ledger-wallet"]') as HTMLSelectElement
    expect(wallet.value).toBe('auditor_cash')
    type.value = 'expense'
    type.dispatchEvent(new Event('change'))
    await nextTick()
    expect(wallet.value).toBe('expense')
    expect(wallet.disabled).toBe(false)
    wallet.value = 'gcash'
    wallet.dispatchEvent(new Event('change'))
    await nextTick()
    expect(wallet.value).toBe('gcash')
    app.unmount()
  })

  it('keeps the saved wallet when editing a Total Expense', async () => {
    const { app } = mountModal({
      isOpen: true,
      mode: 'edit',
      entry: {
        id: 'e1',
        entry_date: '2026-11-04',
        type: 'expense',
        wallet: 'auditor_cash',
        amount: 80,
        category: 'Labor',
        note: null,
        transfer_id: null,
        created_by: 'ana',
        created_at: '2026-11-04T00:00:00.000Z',
        updated_at: '2026-11-04T00:00:00.000Z'
      }
    })
    await nextTick()
    const wallet = document.querySelector('[data-testid="ledger-wallet"]') as HTMLSelectElement
    expect(wallet.value).toBe('auditor_cash')
    app.unmount()
  })

  it('requires category only for expense', async () => {
    const { el, app } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    expect(document.querySelector('[data-testid="ledger-category"]')).toBeNull()
    const type = document.querySelector('[data-testid="ledger-type"]') as HTMLSelectElement
    const option = [...type.querySelectorAll('option')].find((o) => (o as HTMLOptionElement).value === 'expense') as HTMLOptionElement
    option.selected = true
    type.value = 'expense'
    type.dispatchEvent(new Event('change'))
    await nextTick()
    expect(document.querySelector('[data-testid="ledger-category"]')).not.toBeNull()
    app.unmount()
  })

  it('shows a placeholder instead of a fake category when switching to expense', async () => {
    const { app } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    const type = document.querySelector('[data-testid="ledger-type"]') as HTMLSelectElement
    type.value = 'expense'
    type.dispatchEvent(new Event('change'))
    await nextTick()
    const category = document.querySelector('[data-testid="ledger-category"]') as HTMLSelectElement
    expect(category.value).toBe('')
    expect(category.selectedOptions[0]?.textContent).toContain('Select a category')
    app.unmount()
  })

  it('disables Save and ignores clicks while saving', async () => {
    const { app, getSubmitted } = mountModal({ isOpen: true, mode: 'add', saving: true })
    await nextTick()
    const submit = document.querySelector('[data-testid="ledger-submit"]') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    submit.dispatchEvent(new MouseEvent('click'))
    await nextTick()
    expect(getSubmitted()).toBeNull()
    app.unmount()
  })

  it('keeps trailing decimal zeros while typing an amount', async () => {
    const { app, getSubmitted } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    const amount = document.querySelector('[data-testid="ledger-amount"]') as HTMLInputElement
    let typed = ''
    for (const ch of ['5', '0', '0', '.', '0', '0']) {
      typed += ch
      amount.value = typed
      amount.dispatchEvent(new Event('input'))
      await nextTick()
      expect(amount.value).toBe(typed)
    }
    ;(document.querySelector('[data-testid="ledger-submit"]') as HTMLButtonElement).click()
    await nextTick()
    expect(getSubmitted()).toEqual(expect.objectContaining({ amount: 500 }))
    app.unmount()
  })

  it('defaults the date to the Manila calendar day', async () => {
    const { app } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    const date = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(date.value).toBe(manilaYmd(new Date()))
    app.unmount()
  })

  it('labels expense as Total Expense in the type dropdown', async () => {
    const { app } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    const type = document.querySelector('[data-testid="ledger-type"]') as HTMLSelectElement
    const option = [...type.querySelectorAll('option')].find((o) => o.value === 'expense')
    expect(option?.textContent).toBe('Total Expense')
    app.unmount()
  })

  it('labels pos_float as Initial Petty Cash in the type dropdown', async () => {
    const { app } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    const type = document.querySelector('[data-testid="ledger-type"]') as HTMLSelectElement
    const option = [...type.querySelectorAll('option')].find((o) => o.value === 'pos_float')
    expect(option?.textContent).toBe('Initial Petty Cash')
    app.unmount()
  })

  it('labels pos_remittance as Cart Cash Remittance and shows the two cash-in fields', async () => {
    const { app, getSubmitted } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    const type = document.querySelector('[data-testid="ledger-type"]') as HTMLSelectElement
    const option = [...type.querySelectorAll('option')].find((o) => o.value === 'pos_remittance')
    expect(option?.textContent).toBe('Cart Cash Remittance')
    expect(document.querySelector('[data-testid="ledger-total-sales"]')).toBeNull()
    type.value = 'pos_remittance'
    type.dispatchEvent(new Event('change'))
    await nextTick()
    expect(document.querySelector('[data-testid="ledger-amount"]')).toBeNull()
    const sales = document.querySelector('[data-testid="ledger-total-sales"]') as HTMLInputElement
    const petty = document.querySelector('[data-testid="ledger-petty-returned"]') as HTMLInputElement
    expect(sales).not.toBeNull()
    expect(petty).not.toBeNull()
    expect(document.body.textContent).toContain('Total Sales')
    expect(document.body.textContent).toContain('Petty Cash Returned')
    sales.value = '1800'
    sales.dispatchEvent(new Event('input'))
    petty.value = '250.50'
    petty.dispatchEvent(new Event('input'))
    await nextTick()
    ;(document.querySelector('[data-testid="ledger-submit"]') as HTMLButtonElement).click()
    await nextTick()
    expect(getSubmitted()).toEqual(expect.objectContaining({
      type: 'pos_remittance',
      wallet: 'auditor_cash',
      total_sales: 1800,
      petty_cash_returned: 250.5,
      amount: 2050.5
    }))
    app.unmount()
  })

  it('offers expense and GCash wallets and locks GCash remittance', async () => {
    const { app } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    const wallet = document.querySelector('[data-testid="ledger-wallet"]') as HTMLSelectElement
    const walletValues = [...wallet.querySelectorAll('option')].map((o) => (o as HTMLOptionElement).value)
    expect(walletValues).toEqual(['auditor_cash', 'expense', 'gcash'])
    const type = document.querySelector('[data-testid="ledger-type"]') as HTMLSelectElement
    const typeValues = [...type.querySelectorAll('option')].map((o) => (o as HTMLOptionElement).value)
    expect(typeValues).toContain('fund_expense')
    expect(typeValues).toContain('gcash_remittance')
    expect(typeValues).not.toContain('petty_issue')
    type.value = 'gcash_remittance'
    type.dispatchEvent(new Event('change'))
    await nextTick()
    expect(wallet.value).toBe('gcash')
    expect(wallet.disabled).toBe(true)
    app.unmount()
  })
})
