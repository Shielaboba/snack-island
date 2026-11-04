/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest'
import { createApp, nextTick } from 'vue'
import LedgerEntryModal from '../../src/components/LedgerEntryModal.vue'

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
})
