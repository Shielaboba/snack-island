import { describe, it, expect } from 'vitest'
import type { StaffClockShift } from '../../src/models/StaffClock'
import {
  calculatePayroll,
  validatePayrollInput
} from '../../src/modules/staffClock/staffClockPayroll'

function shift(partial: Partial<StaffClockShift>): StaffClockShift {
  return {
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
    updated_at: '2026-11-04T14:00:00.000Z',
    ...partial
  }
}

const range = {
  staffName: 'Shai' as const,
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  ratePerDay: 500,
  deduction: 0
}

describe('payroll calculator', () => {
  it('pays one closed session as one day at the daily rate', () => {
    const result = calculatePayroll([shift({})], range)
    expect(result.days).toBe(1)
    expect(result.regularPay).toBe(500)
    expect(result.otHours).toBe(0)
    expect(result.otPay).toBe(0)
    expect(result.netPay).toBe(500)
  })

  it('treats 2 hours of recorded OT as half of the daily rate', () => {
    const row = shift({
      clock_out_at: '2026-11-04T16:00:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    const result = calculatePayroll([row], range)
    expect(result.otHours).toBe(2)
    expect(result.otPay).toBe(250)
    expect(result.regularPay).toBe(500)
    expect(result.netPay).toBe(750)
  })

  it('pays 4 hours OT as a full extra day', () => {
    const row = shift({
      clock_in_at: '2026-11-04T04:00:00.000Z',
      clock_out_at: '2026-11-04T16:00:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    const result = calculatePayroll([row], { ...range, ratePerDay: 400 })
    expect(result.otHours).toBe(4)
    expect(result.otPay).toBe(400)
    expect(result.netPay).toBe(800)
  })

  it('subtracts deduction from net pay', () => {
    const result = calculatePayroll([shift({})], { ...range, deduction: 50 })
    expect(result.deduction).toBe(50)
    expect(result.netPay).toBe(450)
  })

  it('ignores declined, open, other staff, and dates outside the range', () => {
    const result = calculatePayroll(
      [
        shift({ id: 'declined', clock_in_status: 'declined' }),
        shift({ id: 'open', clock_out_at: null, clock_out_status: null }),
        shift({ id: 'den', staff_name: 'Den' }),
        shift({
          id: 'october',
          clock_in_at: '2026-10-31T06:00:00.000Z',
          clock_out_at: '2026-10-31T14:00:00.000Z'
        }),
        shift({ id: 'paid' })
      ],
      range
    )
    expect(result.days).toBe(1)
    expect(result.regularPay).toBe(500)
  })

  it('does not pay OT that was never recorded', () => {
    const row = shift({
      clock_out_at: '2026-11-04T16:00:00.000Z'
    })
    expect(calculatePayroll([row], range).otPay).toBe(0)
  })

  it('rejects a missing range or a negative rate', () => {
    expect(validatePayrollInput({ ...range, startDate: '' }).ok).toBe(false)
    expect(validatePayrollInput({ ...range, endDate: '2026-10-01' }).ok).toBe(false)
    expect(validatePayrollInput({ ...range, ratePerDay: -1 }).ok).toBe(false)
    expect(validatePayrollInput({ ...range, deduction: -5 }).ok).toBe(false)
    expect(validatePayrollInput(range).ok).toBe(true)
  })
})
