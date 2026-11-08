/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest'
import { createApp, nextTick } from 'vue'
import PayrollCalculatorModal from '../../src/components/PayrollCalculatorModal.vue'
import type { StaffClockShift } from '../../src/models/StaffClock'

const closed: StaffClockShift = {
  id: 's1',
  staff_name: 'Shai',
  clock_in_at: '2026-11-04T06:00:00.000Z',
  clock_out_at: '2026-11-04T16:00:00.000Z',
  clock_in_photo_path: null,
  clock_out_photo_path: null,
  clock_in_status: 'approved',
  clock_out_status: 'approved',
  clock_in_override: false,
  clock_out_override: false,
  ot_requested: true,
  ot_status: 'approved',
  ot_requested_at: '2026-11-04T16:00:00.000Z',
  created_by: 'staff',
  updated_by: null,
  created_at: '2026-11-04T06:00:00.000Z',
  updated_at: '2026-11-04T16:00:00.000Z'
}

function mountModal() {
  const el = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(el)
  const app = createApp(PayrollCalculatorModal, {
    isOpen: true,
    shifts: [closed]
  })
  app.mount(el)
  return { app }
}

describe('PayrollCalculatorModal', () => {
  it('has staff, dates, rate per day, and deduction, and pays 2h OT at the hourly rate', async () => {
    const { app } = mountModal()
    await nextTick()
    const modal = document.querySelector('[data-testid="payroll-modal"]')
    expect(modal).not.toBeNull()
    expect(document.querySelector('[data-testid="payroll-staff"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="payroll-start"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="payroll-end"]')).not.toBeNull()
    const rate = document.querySelector('[data-testid="payroll-rate"]') as HTMLInputElement
    const deduction = document.querySelector('[data-testid="payroll-deduction"]') as HTMLInputElement
    const start = document.querySelector('[data-testid="payroll-start"]') as HTMLInputElement
    const end = document.querySelector('[data-testid="payroll-end"]') as HTMLInputElement
    start.value = '2026-11-01'
    start.dispatchEvent(new Event('input'))
    end.value = '2026-11-30'
    end.dispatchEvent(new Event('input'))
    rate.value = '500'
    rate.dispatchEvent(new Event('input'))
    deduction.value = '50'
    deduction.dispatchEvent(new Event('input'))
    await nextTick()
    const summary = document.querySelector('[data-testid="payroll-summary"]')?.textContent ?? ''
    expect(summary).toMatch(/1 day/)
    expect(summary).toMatch(/2\.00h/)
    expect(summary).toMatch(/₱500\.00/)
    expect(summary).toMatch(/₱125\.00/)
    expect(summary).toMatch(/₱50\.00/)
    expect(summary).toMatch(/₱575\.00/)
    app.unmount()
  })
})
