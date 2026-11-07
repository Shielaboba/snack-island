/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import Attendance from '../../src/components/Attendance.vue'
import type { StaffClockShift } from '../../src/models/StaffClock'
import { DEFAULT_STAFF, savePayrollView, saveStaffPayables, saveStaffPayments, saveStaffProfiles } from '../../src/modules/staff/staffProfile'
import { manilaToday } from '../../src/modules/staffClock/staffClockUtils'

const closed: StaffClockShift = {
  id: 's1',
  staff_name: 'Shai',
  clock_in_at: '2026-11-04T06:00:00.000Z',
  clock_out_at: '2026-11-04T16:00:00.000Z',
  clock_in_photo_path: 'Shai/s1-in.jpg',
  clock_out_photo_path: 'Shai/s1-out.jpg',
  clock_in_status: 'pending',
  clock_out_status: 'pending',
  clock_in_override: false,
  clock_out_override: false,
  ot_requested: true,
  ot_status: 'pending',
  ot_requested_at: '2026-11-04T16:00:00.000Z',
  created_by: 'staff',
  updated_by: null,
  created_at: '2026-11-04T06:00:00.000Z',
  updated_at: '2026-11-04T15:00:00.000Z'
}

const list = vi.fn(async () => [closed])
const setPunchStatus = vi.fn()
const setOtStatus = vi.fn()
const recordOt = vi.fn()
const photoUrl = vi.fn((path: string) => `https://cdn.example/${path}`)

vi.mock('../../src/services/staffClockService', () => ({
  staffClockService: {
    list: (...args: unknown[]) => list(...args),
    setPunchStatus: (...args: unknown[]) => setPunchStatus(...args),
    setOtStatus: (...args: unknown[]) => setOtStatus(...args),
    recordOt: (...args: unknown[]) => recordOt(...args),
    updateTimes: vi.fn(),
    createMissedPunch: vi.fn(),
    remove: vi.fn(),
    photoUrl: (...args: unknown[]) => photoUrl(...(args as [string]))
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
  const app = createApp(Attendance)
  app.mount(el)
  return { el, app }
}

async function showDay(el: HTMLElement, day: string) {
  const date = el.querySelector('[data-testid="attendance-date"]') as HTMLInputElement
  date.value = day
  date.dispatchEvent(new Event('input'))
  await nextTick()
}

describe('Attendance.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    list.mockClear()
    setPunchStatus.mockClear()
    setOtStatus.mockClear()
    recordOt.mockClear()
    setPunchStatus.mockResolvedValue(closed)
    setOtStatus.mockResolvedValue(closed)
    recordOt.mockResolvedValue({ ...closed, ot_requested: true, ot_status: 'approved' })
    list.mockResolvedValue([closed])
  })

  it('lists punches with OT and photo links, not the staff clock buttons', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await showDay(el, '2026-11-04')
    expect(el.textContent).toContain('Shai')
    expect(el.querySelector('[data-testid="ot-s1"]')?.textContent).toMatch(/2\.00/)
    expect(el.querySelector('[data-testid="photo-in-s1"]')?.textContent?.trim()).toBe('In')
    expect(el.querySelector('[data-testid="photo-out-s1"]')?.textContent?.trim()).toBe('Out')
    expect(el.querySelector('[data-testid="photo-in-s1"]')?.classList.contains('link-btn')).toBe(true)
    expect(el.querySelector('[data-testid="clock-in-btn"]')).toBeNull()
    expect(el.querySelector('[data-testid="stat-in"]')).toBeNull()
    expect(el.querySelector('[data-testid="stat-out"]')).toBeNull()
    expect(el.querySelector('[data-testid="stat-ot"]')).toBeNull()
    expect(el.querySelector('[data-testid="stat-open"]')).toBeNull()
    expect(el.textContent).not.toMatch(/Waiting clock-ins|Waiting clock-outs|Waiting overtime/)
    expect(el.textContent).not.toMatch(/The table opens on today/)
    app.unmount()
  })

  it('opens on today and shows an older day only after that date is chosen', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const date = el.querySelector('[data-testid="attendance-date"]') as HTMLInputElement
    expect(date.value).toBe(manilaToday())
    expect(el.textContent).toMatch(/Showing today/)
    ;(el.querySelector('[data-testid="attendance-date-open"]') as HTMLButtonElement).click()
    await nextTick()
    expect(document.querySelector('[data-testid="date-calendar"]')).not.toBeNull()
    if (manilaToday() !== '2026-11-04') {
      expect(el.querySelector('[data-testid="approve-in-s1"]')).toBeNull()
      expect(el.textContent).toContain('No punches on this day.')
    }
    await showDay(el, '2026-11-04')
    expect(el.querySelector('[data-testid="approve-in-s1"]')).not.toBeNull()
    expect(el.textContent).toMatch(/Waiting/)
    app.unmount()
  })

  it('reflects an early clock-in and a late clock-out onto the 2:00 PM–10:00 PM shift', async () => {
    list.mockResolvedValue([
      {
        ...closed,
        clock_in_at: '2026-11-04T04:00:00.000Z',
        clock_out_at: '2026-11-04T14:40:00.000Z',
        clock_in_status: 'approved',
        clock_out_status: 'approved',
        ot_requested: false,
        ot_status: null,
        ot_requested_at: null
      }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await showDay(el, '2026-11-04')
    expect(el.textContent).toMatch(/2:00\s?PM/)
    expect(el.textContent).toMatch(/10:00\s?PM/)
    expect(el.textContent).toMatch(/Captured/)
    expect(el.textContent).toMatch(/12:00\s?PM/)
    expect(el.textContent).toMatch(/8\.00/)
    app.unmount()
  })

  it('filters the selected day by staff and by punches that need a decision', async () => {
    const den: StaffClockShift = {
      ...closed,
      id: 's2',
      staff_name: 'Den',
      clock_in_status: 'approved',
      clock_out_status: 'approved',
      ot_requested: false,
      ot_status: null,
      ot_requested_at: null
    }
    list.mockResolvedValue([closed, den])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await showDay(el, '2026-11-04')
    const table = () => el.querySelector('table')?.textContent ?? ''
    expect(table()).toContain('Shai')
    expect(table()).toContain('Den')
    ;(el.querySelector('[data-testid="staff-Den"]') as HTMLButtonElement).click()
    await nextTick()
    expect(table()).toContain('Den')
    expect(table()).not.toContain('Shai')
    ;(el.querySelector('[data-testid="staff-All"]') as HTMLButtonElement).click()
    ;(el.querySelector('[data-testid="show-decisions"]') as HTMLButtonElement).click()
    await nextTick()
    expect(table()).toContain('Shai')
    expect(table()).not.toContain('Den')
    app.unmount()
  })

  it('opens a centered photo modal from the link', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await showDay(el, '2026-11-04')
    ;(el.querySelector('[data-testid="photo-in-s1"]') as HTMLButtonElement).click()
    await nextTick()
    const modal = document.querySelector('[data-testid="clock-photo-modal"]')
    expect(modal).not.toBeNull()
    expect(modal?.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example/Shai/s1-in.jpg'
    )
    app.unmount()
  })

  it('approves and declines punches', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await showDay(el, '2026-11-04')
    ;(el.querySelector('[data-testid="approve-in-s1"]') as HTMLButtonElement).click()
    ;(el.querySelector('[data-testid="decline-out-s1"]') as HTMLButtonElement).click()
    ;(el.querySelector('[data-testid="approve-ot-s1"]') as HTMLButtonElement).click()
    await nextTick()
    expect(setPunchStatus).toHaveBeenCalledWith('s1', 'in', 'approved', 'ana')
    expect(setPunchStatus).toHaveBeenCalledWith('s1', 'out', 'declined', 'ana')
    expect(setOtStatus).toHaveBeenCalledWith('s1', 'approved', 'ana')
    app.unmount()
  })

  it('opens edit, delete, and add missed punch', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await showDay(el, '2026-11-04')
    expect(el.querySelector('[data-testid="edit-s1"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="delete-s1"]')).not.toBeNull()
    ;(el.querySelector('[data-testid="add-missed-btn"]') as HTMLButtonElement).click()
    await nextTick()
    expect(document.querySelector('[data-testid="clock-edit-modal"]')).not.toBeNull()
    app.unmount()
  })

  it('shows the same payroll setup saved on the staff page', async () => {
    const store = new Map<string, string>()
    const storage: Storage = {
      get length() {
        return store.size
      },
      clear() {
        store.clear()
      },
      getItem(key) {
        return store.get(key) ?? null
      },
      key(index) {
        return [...store.keys()][index] ?? null
      },
      removeItem(key) {
        store.delete(key)
      },
      setItem(key, value) {
        store.set(key, value)
      }
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    saveStaffProfiles([
      { ...DEFAULT_STAFF[0], ratePerDay: 800, daysOff: [1] },
      { ...DEFAULT_STAFF[1], daysOff: [...DEFAULT_STAFF[1].daysOff] }
    ])
    saveStaffPayables([
      {
        id: 'loan-1',
        name: 'Cash advance',
        staffName: 'Shai',
        deductionTotal: 3000,
        payrollCount: 3,
        firstPayrollDate: '2026-11-06'
      }
    ])
    savePayrollView({ staffName: 'Shai', startDate: '2026-10-31', endDate: '2026-11-06' })
    saveStaffPayments([
      {
        id: 'payment-1',
        staffName: 'Shai',
        amount: 50,
        paidOn: '2026-11-07',
        payrollStart: '2026-10-31',
        payrollEnd: '2026-11-06'
      },
      {
        id: 'payment-2',
        staffName: 'Shai',
        amount: 999,
        paidOn: '2026-11-07',
        payrollStart: '2026-11-07',
        payrollEnd: '2026-11-13'
      }
    ])
    list.mockResolvedValue([
      {
        ...closed,
        clock_in_status: 'approved',
        clock_out_status: 'approved',
        ot_requested: false,
        ot_status: null,
        ot_requested_at: null
      }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="payroll-btn"]') as HTMLButtonElement).click()
    await nextTick()
    const modal = document.querySelector('[data-testid="payroll-summary-modal"]')
    expect((modal?.querySelector('[data-testid="payroll-summary-staff"]') as HTMLSelectElement).value).toBe('Shai')
    expect((modal?.querySelector('[data-testid="payroll-summary-start"]') as HTMLInputElement).value).toBe('2026-10-31')
    expect((modal?.querySelector('[data-testid="payroll-summary-end"]') as HTMLInputElement).value).toBe('2026-11-06')
    ;(modal?.querySelector('[data-testid="payroll-summary-start-open"]') as HTMLButtonElement).click()
    await nextTick()
    expect(document.querySelector('[data-testid="date-calendar"]')).not.toBeNull()
    expect(modal?.textContent).toContain('Working Days')
    expect(modal?.textContent).not.toContain('Days off')
    expect(modal?.textContent).not.toContain('is paid every')
    expect(modal?.textContent).not.toContain('deducts one installment')
    expect(modal?.textContent).toContain('₱800.00')
    expect(modal?.textContent).toContain('Cash advance')
    expect(modal?.textContent).toContain('₱1000.00')
    expect(modal?.textContent).toContain('-₱200.00')
    expect(modal?.querySelector('[data-testid="slip-paid"]')?.textContent).toContain('₱50.00')
    expect(modal?.querySelector('[data-testid="slip-paid"]')?.textContent).toContain('Nov 7')
    expect(modal?.textContent).not.toContain('₱999.00')
    expect(modal?.querySelector('[data-testid="slip-balance"]')?.textContent).toContain('-₱250.00')
    app.unmount()
  })

  it('opens the payroll summary beside add missed punch', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await showDay(el, '2026-11-04')
    const payrollBtn = el.querySelector('[data-testid="payroll-btn"]') as HTMLButtonElement
    expect(payrollBtn).not.toBeNull()
    expect(payrollBtn.textContent).toMatch(/Payroll summary/i)
    expect(el.textContent).not.toMatch(/Payroll Calculator/i)
    payrollBtn.click()
    await nextTick()
    const modal = document.querySelector('[data-testid="payroll-summary-modal"]')
    expect(modal).not.toBeNull()
    expect(modal?.querySelector('.modal-actions')?.classList.contains('center')).toBe(true)
    expect(modal?.textContent).toContain('Snack Island')
    expect(modal?.textContent).toContain('Copy image')
    expect(modal?.querySelector('[data-testid="payroll-rate"]')).toBeNull()
    expect(document.querySelector('[data-testid="payroll-modal"]')).toBeNull()
    app.unmount()
  })

  it('lets the auditor record a payment for a payroll week', async () => {
    const store = new Map<string, string>()
    const storage: Storage = {
      get length() {
        return store.size
      },
      clear() {
        store.clear()
      },
      getItem(key) {
        return store.get(key) ?? null
      },
      key(index) {
        return [...store.keys()][index] ?? null
      },
      removeItem(key) {
        store.delete(key)
      },
      setItem(key, value) {
        store.set(key, value)
      }
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    savePayrollView({ staffName: 'Shai', startDate: '2026-10-31', endDate: '2026-11-06' })
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const section = el.querySelector('[aria-label="Payments"]') as HTMLElement
    expect(section.textContent).toContain('No payments yet.')
    ;(section.querySelector('[data-testid="add-payment"]') as HTMLButtonElement).click()
    await nextTick()
    const opened = el.querySelector('[data-testid="payment-modal"]') as HTMLElement
    expect(opened?.textContent).toContain('Counts toward that payroll week')
    opened.click()
    await nextTick()
    expect(section.querySelector('[data-testid="payment-amount-payment-1"]')).toBeNull()
    ;(section.querySelector('[data-testid="add-payment"]') as HTMLButtonElement).click()
    await nextTick()
    ;(el.querySelector('[data-testid="payment-cancel"]') as HTMLButtonElement).click()
    await nextTick()
    expect(section.querySelector('[data-testid="payment-amount-payment-1"]')).toBeNull()

    const viewBefore = storage.getItem('snack-island-payroll-view')
    ;(el.querySelector('[data-testid="add-payment"]') as HTMLButtonElement).click()
    await nextTick()
    const modal = el.querySelector('[data-testid="payment-modal"]') as HTMLElement
    const amount = modal.querySelector('[data-testid="payment-form-amount"]') as HTMLInputElement
    amount.value = '500'
    amount.dispatchEvent(new Event('input'))
    const paidOn = modal.querySelector('[data-testid="payment-form-paid-on"]') as HTMLInputElement
    paidOn.value = '2026-11-07'
    paidOn.dispatchEvent(new Event('input'))
    const start = modal.querySelector('[data-testid="payment-form-start"]') as HTMLInputElement
    start.value = '2026-10-31'
    start.dispatchEvent(new Event('input'))
    const end = modal.querySelector('[data-testid="payment-form-end"]') as HTMLInputElement
    end.value = '2026-11-06'
    end.dispatchEvent(new Event('input'))
    await nextTick()
    ;(modal.querySelector('[data-testid="payment-save"]') as HTMLButtonElement).click()
    await nextTick()
    expect(section.querySelector('[data-testid="payment-staff-payment-1"]')?.textContent).toContain('Shai')
    expect(section.querySelector('[data-testid="payment-amount-payment-1"]')?.textContent).toContain('₱500.00')
    expect(section.querySelector('[data-testid="payment-paid-on-payment-1"]')?.textContent).toContain('2026-11-07')
    expect(section.querySelector('[data-testid="payment-week-payment-1"]')?.textContent).toContain('Oct 31')
    expect(section.querySelector('[data-testid="payment-week-payment-1"]')?.textContent).toContain('Nov 6')
    expect(storage.getItem('snack-island-payroll-view')).toBe(viewBefore)
    ;(el.querySelector('[data-testid="payroll-btn"]') as HTMLButtonElement).click()
    await nextTick()
    const summary = document.querySelector('[data-testid="payroll-summary-modal"]')
    expect(summary?.querySelector('[data-testid="slip-paid"]')?.textContent).toContain('₱500.00')
    expect(summary?.querySelector('[data-testid="slip-paid"]')?.textContent).toContain('Nov 7')
    app.unmount()

    const second = mountPage()
    await nextTick()
    expect(second.el.querySelector('[data-testid="payment-amount-payment-1"]')?.textContent).toContain('₱500.00')
    ;(second.el.querySelector('[data-testid="payment-remove-payment-1"]') as HTMLButtonElement).click()
    await nextTick()
    expect(second.el.querySelector('[aria-label="Payments"]')?.textContent).toContain('No payments yet.')
    second.app.unmount()
  })

  it('lets admin or auditor record OT when staff did not request it', async () => {
    const forgot: StaffClockShift = {
      ...closed,
      ot_requested: false,
      ot_status: null,
      ot_requested_at: null,
      clock_in_at: '2026-11-04T04:00:00.000Z',
      clock_out_at: '2026-11-04T14:00:00.000Z'
    }
    list.mockResolvedValue([forgot])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    await showDay(el, '2026-11-04')
    expect(el.querySelector('[data-testid="record-ot-s1"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="approve-ot-s1"]')).toBeNull()
    ;(el.querySelector('[data-testid="record-ot-s1"]') as HTMLButtonElement).click()
    await nextTick()
    expect(recordOt).toHaveBeenCalledWith(forgot, 'ana')
    app.unmount()
  })
})
