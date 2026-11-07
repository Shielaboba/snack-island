/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import StaffPage from '../../src/components/StaffPage.vue'
import type { StaffClockShift } from '../../src/models/StaffClock'

const shift: StaffClockShift = {
  id: 's1',
  staff_name: 'Shai',
  clock_in_at: '2026-11-04T06:00:00.000Z',
  clock_out_at: '2026-11-04T14:00:00.000Z',
  clock_in_photo_path: null,
  clock_out_photo_path: null,
  clock_in_status: 'approved',
  clock_out_status: 'approved',
  clock_in_override: false,
  clock_out_override: false,
  ot_requested: false,
  ot_status: null,
  ot_requested_at: null,
  created_by: 'staff',
  updated_by: null,
  created_at: '2026-11-04T06:00:00.000Z',
  updated_at: '2026-11-04T14:00:00.000Z'
}

const list = vi.fn(async () => [shift])

vi.mock('../../src/assets/logo.png', () => ({ default: 'logo.png' }))

const payrollPull = vi.fn(async () => {})
const payrollPush = vi.fn(async () => {})
vi.mock('../../src/services/staffPayrollService', () => ({
  staffPayrollService: {
    pull: (...args: unknown[]) => payrollPull(...args),
    push: (...args: unknown[]) => payrollPush(...args)
  }
}))

vi.mock('../../src/services/staffClockService', () => ({
  staffClockService: {
    list: (...args: unknown[]) => list(...args)
  }
}))

const payableStore = new Map<string, string>()
const payableStorage: Storage = {
  get length() {
    return payableStore.size
  },
  clear() {
    payableStore.clear()
  },
  getItem(key) {
    return payableStore.get(key) ?? null
  },
  key(index) {
    return [...payableStore.keys()][index] ?? null
  },
  removeItem(key) {
    payableStore.delete(key)
  },
  setItem(key, value) {
    payableStore.set(key, value)
  }
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: payableStorage })

// Lets the page finish loading the shared records before the test types.
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function mountPage() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp(StaffPage)
  app.mount(el)
  return { el, app }
}

async function setValue(el: HTMLElement, testId: string, value: string) {
  const input = el.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await nextTick()
}

async function savePayable(
  el: HTMLElement,
  fields: { name: string; staff?: string; deduction: string; payrolls: string; first: string }
) {
  ;(el.querySelector('[data-testid="add-payable"]') as HTMLButtonElement).click()
  await nextTick()
  const modal = el.querySelector('[data-testid="payable-modal"]') as HTMLElement
  expect(modal).not.toBeNull()
  await setValue(modal, 'payable-form-name', fields.name)
  if (fields.staff) {
    const staff = modal.querySelector('[data-testid="payable-form-staff"]') as HTMLSelectElement
    staff.value = fields.staff
    staff.dispatchEvent(new Event('change'))
    await nextTick()
  }
  await setValue(modal, 'payable-form-deduction', fields.deduction)
  await setValue(modal, 'payable-form-payrolls', fields.payrolls)
  await setValue(modal, 'payable-form-first', fields.first)
  ;(modal.querySelector('[data-testid="payable-save"]') as HTMLButtonElement).click()
  await nextTick()
  expect(el.querySelector('[data-testid="payable-modal"]')).toBeNull()
}

async function saveCompensation(
  el: HTMLElement,
  fields: { name: string; staff?: string; amount: string; date?: string; forever?: boolean }
) {
  ;(el.querySelector('[data-testid="add-compensation"]') as HTMLButtonElement).click()
  await nextTick()
  const modal = el.querySelector('[data-testid="compensation-modal"]') as HTMLElement
  expect(modal).not.toBeNull()
  await setValue(modal, 'compensation-form-name', fields.name)
  if (fields.staff) {
    const staff = modal.querySelector('[data-testid="compensation-form-staff"]') as HTMLSelectElement
    staff.value = fields.staff
    staff.dispatchEvent(new Event('change'))
    await nextTick()
  }
  await setValue(modal, 'compensation-form-amount', fields.amount)
  if (fields.forever) {
    const when = modal.querySelector('[data-testid="compensation-form-when"]') as HTMLSelectElement
    when.value = 'forever'
    when.dispatchEvent(new Event('change'))
    await nextTick()
    expect(modal.querySelector('[data-testid="compensation-form-date"]')).not.toBeNull()
    if (fields.date) await setValue(modal, 'compensation-form-date', fields.date)
  } else if (fields.date) {
    await setValue(modal, 'compensation-form-date', fields.date)
  }
  ;(modal.querySelector('[data-testid="compensation-save"]') as HTMLButtonElement).click()
  await nextTick()
  expect(el.querySelector('[data-testid="compensation-modal"]')).toBeNull()
}

describe('StaffPage.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    payableStorage.clear()
    list.mockClear()
    list.mockResolvedValue([shift])
  })

  it('lists each staff member with rate and shift', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const roster = el.querySelector('[aria-label="Staff list"]')
    expect(el.textContent).not.toContain('Each person has their own weekly payroll day')
    expect(el.querySelector('h1')).toBeNull()
    expect(roster?.textContent).toContain('Shai')
    expect(roster?.textContent).toContain('Den')
    expect((roster?.querySelector('[aria-label="Shai shift start"]') as HTMLInputElement).value).toBe('14:00')
    expect((roster?.querySelector('[aria-label="Shai shift end"]') as HTMLInputElement).value).toBe('22:00')
    const shift = roster?.querySelector('[aria-label="Shai shift start"]')?.closest('.shift') as HTMLElement
    const days = shift?.querySelector('.days') as HTMLElement
    expect(shift.classList.contains('shift-row')).toBe(true)
    expect(days).toBe(shift?.lastElementChild)
    const monday = roster?.querySelector('[aria-label="Shai Monday"]') as HTMLButtonElement
    expect(monday.getAttribute('aria-pressed')).toBe('true')
    monday.click()
    await nextTick()
    expect((roster?.querySelector('[aria-label="Shai Monday"]') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false')
    expect((roster?.querySelector('[data-testid="staff-rate-Shai"]') as HTMLInputElement).value).toBe('500')
    expect(roster?.querySelector('[data-testid="payable-deduction-loan-1"]')).toBeNull()
    app.unmount()
  })

  it('keeps a list of loans in the payable section', async () => {
    const { el, app } = mountPage()
    await nextTick()
    const payable = el.querySelector('[aria-label="Payable"]') as HTMLElement
    expect(payable.querySelector('table')).not.toBeNull()
    expect(payable.textContent).toContain('Name')
    expect(payable.textContent).toContain('No payables yet.')
    ;(payable.querySelector('[data-testid="add-payable"]') as HTMLButtonElement).click()
    await nextTick()
    const opened = el.querySelector('[data-testid="payable-modal"]')
    expect(opened?.querySelector('.payable-dialog')).not.toBeNull()
    expect(opened?.textContent).toContain('Split across that person’s paydays')
    expect(payable.querySelector('[data-testid="payable-name-loan-1"]')).toBeNull()
    ;(el.querySelector('[data-testid="payable-cancel"]') as HTMLButtonElement).click()
    await nextTick()
    expect(payable.querySelector('[data-testid="payable-modal"]')).toBeNull()
    await savePayable(el, { name: 'Cash advance', deduction: '3000', payrolls: '3', first: '2026-11-06' })
    await savePayable(el, { name: 'Uniform', staff: 'Den', deduction: '500', payrolls: '1', first: '2026-11-05' })
    expect(payable.querySelector('[data-testid="payable-name-loan-1"]')?.textContent).toContain('Cash advance')
    expect(payable.querySelector('[data-testid="payable-staff-loan-2"]')?.textContent).toContain('Den')
    ;(payable.querySelector('[data-testid="payable-remove-loan-2"]') as HTMLButtonElement).click()
    await nextTick()
    expect(payable?.querySelector('[data-testid="payable-deduction-loan-2"]')).toBeNull()
    expect(payable?.querySelector('[data-testid="staff-rate-Shai"]')).toBeNull()
    app.unmount()
  })

  it('stores the payroll week when a payable is saved', async () => {
    const { el, app } = mountPage()
    await nextTick()
    expect(el.querySelector('[aria-label="Payroll"]')).toBeNull()
    expect(el.querySelector('[aria-label="Payments"]')).toBeNull()
    await savePayable(el, { name: 'Cash advance', deduction: '3000', payrolls: '3', first: '2026-11-06' })
    expect(el.querySelector('[data-testid="payable-installment-loan-1"]')?.textContent).toContain('₱1000.00')
    expect(JSON.parse(payableStorage.getItem('snack-island-payroll-view') ?? '{}')).toEqual({
      staffName: 'Shai',
      startDate: '2026-10-31',
      endDate: '2026-11-06'
    })
    app.unmount()
  })

  it('marks a payable paid so payroll no longer deducts it', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await savePayable(el, { name: 'Cash advance', deduction: '3000', payrolls: '3', first: '2026-11-06' })
    const paid = el.querySelector('[data-testid="payable-paid-loan-1"]') as HTMLButtonElement
    expect(paid.textContent?.trim()).toBe('Paid')
    expect(paid.getAttribute('aria-pressed')).toBe('false')
    paid.click()
    await nextTick()
    expect(paid.getAttribute('aria-pressed')).toBe('true')
    expect(el.querySelector('[data-testid="payable-installment-loan-1"]')?.textContent).toContain('Paid')
    app.unmount()

    const second = mountPage()
    await nextTick()
    expect(second.el.querySelector('[data-testid="payable-paid-loan-1"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(second.el.querySelector('[data-testid="payable-installment-loan-1"]')?.textContent).toContain('Paid')
    second.app.unmount()
  })

  it('points payroll at the payable and deducts it on that person’s payday', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await savePayable(el, { name: 'Uniform', staff: 'Den', deduction: '500', payrolls: '1', first: '2026-11-06' })
    expect(JSON.parse(payableStorage.getItem('snack-island-payroll-view') ?? '{}')).toEqual({
      staffName: 'Den',
      startDate: '2026-11-06',
      endDate: '2026-11-12'
    })
    expect(el.querySelector('[data-testid="payable-first-loan-1"]')?.textContent).toContain('2026-11-12')
    app.unmount()
  })

  it('keeps the rate and day off after save', async () => {
    const unsaved = mountPage()
    await settle()
    await setValue(unsaved.el, 'staff-rate-Shai', '800')
    ;(unsaved.el.querySelector('[aria-label="Shai Monday"]') as HTMLButtonElement).click()
    await nextTick()
    unsaved.app.unmount()

    const reverted = mountPage()
    await settle()
    expect((reverted.el.querySelector('[data-testid="staff-rate-Shai"]') as HTMLInputElement).value).toBe('500')
    expect((reverted.el.querySelector('[aria-label="Shai Monday"]') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    reverted.app.unmount()

    const first = mountPage()
    await settle()
    await setValue(first.el, 'staff-rate-Shai', '800')
    ;(first.el.querySelector('[aria-label="Shai Monday"]') as HTMLButtonElement).click()
    await nextTick()
    ;(first.el.querySelector('[data-testid="save-staff"]') as HTMLButtonElement).click()
    await nextTick()
    const saveButton = first.el.querySelector('[data-testid="save-staff"]') as HTMLButtonElement
    expect(saveButton.textContent?.trim()).toBe('Save')
    const note = first.el.querySelector('[data-testid="save-staff-note"]')
    expect(note?.textContent).toMatch(/Staff details saved/)
    expect(note?.nextElementSibling).toBe(saveButton)
    first.app.unmount()

    const second = mountPage()
    await settle()
    expect((second.el.querySelector('[data-testid="staff-rate-Shai"]') as HTMLInputElement).value).toBe('800')
    expect((second.el.querySelector('[aria-label="Shai Monday"]') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false')
    second.app.unmount()
  })

  it('adds compensation for a staff member on a date and includes it in that payroll', async () => {
    const { el, app } = mountPage()
    await nextTick()
    const section = el.querySelector('[aria-label="Compensation"]') as HTMLElement
    expect(section.querySelector('table')).not.toBeNull()
    expect(section.textContent).toContain('No compensation yet.')
    ;(section.querySelector('[data-testid="add-compensation"]') as HTMLButtonElement).click()
    await nextTick()
    expect(el.querySelector('[data-testid="compensation-modal"]')).not.toBeNull()
    ;(el.querySelector('[data-testid="compensation-cancel"]') as HTMLButtonElement).click()
    await nextTick()
    expect(section.querySelector('[data-testid="compensation-name-compensation-1"]')).toBeNull()

    await saveCompensation(el, { name: 'Gas', amount: '150', date: '2026-11-04' })
    await saveCompensation(el, { name: 'Transpo', staff: 'Den', amount: '80', date: '2026-11-04' })
    expect(section.querySelector('[data-testid="compensation-name-compensation-1"]')?.textContent).toContain('Gas')
    expect(section.querySelector('[data-testid="compensation-staff-compensation-2"]')?.textContent).toContain('Den')
    expect(section.querySelector('[data-testid="compensation-date-compensation-1"]')?.textContent).toContain('2026-11-04')
    expect(section.querySelector('[data-testid="compensation-amount-compensation-1"]')?.textContent).toContain('₱150.00')
    ;(section.querySelector('[data-testid="compensation-remove-compensation-2"]') as HTMLButtonElement).click()
    await nextTick()
    expect(section.querySelector('[data-testid="compensation-name-compensation-2"]')).toBeNull()
    app.unmount()

    const second = mountPage()
    await nextTick()
    expect(second.el.querySelector('[data-testid="compensation-name-compensation-1"]')?.textContent).toContain('Gas')
    expect(second.el.querySelector('[data-testid="compensation-amount-compensation-1"]')?.textContent).toContain('₱150.00')
    second.app.unmount()
  })

  it('saves compensation that applies on every payroll', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await saveCompensation(el, { name: 'Transpo', amount: '100', forever: true })
    const when = el.querySelector('[data-testid="compensation-date-compensation-1"]')
    expect(when?.textContent).toContain('Forever')
    app.unmount()

    const second = mountPage()
    await nextTick()
    expect(second.el.querySelector('[data-testid="compensation-date-compensation-1"]')?.textContent).toContain('Forever')
    second.app.unmount()
  })

  it('saves a payable and shows it again after leaving the page', async () => {
    const first = mountPage()
    await nextTick()
    await savePayable(first.el, { name: 'Cash advance', deduction: '3000', payrolls: '3', first: '2026-11-06' })
    first.app.unmount()

    const second = mountPage()
    await nextTick()
    expect(second.el.querySelector('[data-testid="payable-name-loan-1"]')?.textContent).toContain('Cash advance')
    expect(second.el.querySelector('[data-testid="payable-deduction-loan-1"]')?.textContent).toContain('₱3000.00')
    expect(second.el.querySelector('[data-testid="payable-payrolls-loan-1"]')?.textContent).toContain('3')
    expect(second.el.querySelector('[data-testid="payable-first-loan-1"]')?.textContent).toContain('2026-11-06')
    ;(second.el.querySelector('[data-testid="payable-remove-loan-1"]') as HTMLButtonElement).click()
    await nextTick()
    second.app.unmount()

    const third = mountPage()
    await nextTick()
    expect(third.el.querySelector('[data-testid="payable-name-loan-1"]')).toBeNull()
    expect(third.el.textContent).toContain('No payables yet.')
    third.app.unmount()
  })

  it('shows records pulled from the shared table and shares staff changes', async () => {
    payrollPull.mockImplementationOnce(async () => {
      payableStorage.setItem(
        'snack-island-staff-payables',
        JSON.stringify([
          {
            id: 'loan-7',
            name: 'Shared advance',
            staffName: 'Den',
            deductionTotal: 900,
            payrollCount: 3,
            firstPayrollDate: '2026-11-05',
            paid: false
          }
        ])
      )
    })
    payrollPush.mockClear()
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="payable-name-loan-7"]')?.textContent).toContain('Shared advance')
    expect(payrollPush).not.toHaveBeenCalled()
    ;(el.querySelector('[data-testid="save-staff"]') as HTMLButtonElement).click()
    await nextTick()
    expect(payrollPush).toHaveBeenCalledWith('profiles', expect.any(Array))
    app.unmount()
  })
})
