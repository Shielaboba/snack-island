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

  it('pays the 2-hour overtime minimum as half a day', () => {
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

  it('pays half a day when a requested clock-out is from 11:30 PM through midnight', () => {
    const elevenThirty = shift({
      clock_out_at: '2026-11-04T15:30:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    const midnight = shift({
      id: 'midnight',
      clock_in_at: '2026-11-04T06:20:00.000Z',
      clock_out_at: '2026-11-04T16:00:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    expect(calculatePayroll([elevenThirty], range)).toMatchObject({ otHours: 2, otPay: 250, netPay: 750 })
    expect(calculatePayroll([midnight], range)).toMatchObject({ otHours: 2, otPay: 250 })
    const elevenTwentyNine = shift({
      clock_out_at: '2026-11-04T15:29:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    expect(calculatePayroll([elevenTwentyNine], range).otPay).toBe(0)
  })

  it('pays overtime hours typed on a missed punch', () => {
    const row = shift({
      clock_out_at: '2026-11-04T16:00:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    expect(calculatePayroll([row], range)).toMatchObject({ otHours: 2, otPay: 250, netPay: 750 })
  })

  it('pays 8 overtime hours at the daily rate', () => {
    const row = shift({
      staff_name: 'Den',
      clock_out_at: '2026-11-04T22:00:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    const result = calculatePayroll([row], { ...range, staffName: 'Den' })
    expect(result.otHours).toBe(8)
    expect(result.regularPay).toBe(500)
    expect(result.otPay).toBe(500)
    expect(result.netPay).toBe(1000)
  })

  it('pays each 2-hour overtime minimum as its own half day', () => {
    const first = shift({
      id: 'nov-1',
      clock_in_at: '2026-11-01T06:00:00.000Z',
      clock_out_at: '2026-11-01T16:00:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    const second = shift({
      id: 'nov-2',
      clock_in_at: '2026-11-02T06:00:00.000Z',
      clock_out_at: '2026-11-02T16:00:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    expect(calculatePayroll([first, second], range)).toMatchObject({ otHours: 4, otPay: 500, regularPay: 1000 })
  })

  it('pays 4 hours OT at the same hourly rate as the day', () => {
    const row = shift({
      clock_in_at: '2026-11-04T04:00:00.000Z',
      clock_out_at: '2026-11-04T16:00:00.000Z',
      ot_requested: true,
      ot_status: 'approved'
    })
    const result = calculatePayroll([row], { ...range, ratePerDay: 400 })
    expect(result.otHours).toBe(4)
    expect(result.otPay).toBe(200)
    expect(result.netPay).toBe(600)
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

  it('does not pay pending OT or unapproved punches', () => {
    const result = calculatePayroll(
      [
        shift({
          id: 'pending-ot',
          clock_out_at: '2026-11-04T16:00:00.000Z',
          ot_requested: true,
          ot_status: 'pending'
        }),
        shift({ id: 'pending-in', clock_in_status: 'pending' }),
        shift({ id: 'pending-out', clock_out_status: 'pending' })
      ],
      range
    )
    expect(result.days).toBe(1)
    expect(result.otHours).toBe(0)
    expect(result.otPay).toBe(0)
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
