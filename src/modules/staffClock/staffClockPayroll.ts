import type { ClockValidationResult, StaffClockShift, StaffName } from '../../models/StaffClock'
import { STANDARD_SHIFT_HOURS, manilaYmd, recordedOvertimeHours } from './staffClockUtils'

export type PayrollInput = {
  staffName: StaffName
  startDate: string
  endDate: string
  ratePerDay: number
  deduction: number
}

export type PayrollResult = {
  days: number
  otHours: number
  regularPay: number
  otPay: number
  deduction: number
  netPay: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

// Overtime uses the daily rate spread across 8 hours. Hours under the 2-hour minimum are already 0.
function overtimePay(otHours: number, ratePerDay: number): number {
  if (otHours <= 0 || ratePerDay <= 0) return 0
  return (otHours / STANDARD_SHIFT_HOURS) * ratePerDay
}

// Only shifts that admin/auditor approved on both ends count as a paid day.
export function isPayableShift(shift: StaffClockShift): boolean {
  if (!shift.clock_out_at) return false
  return shift.clock_in_status === 'approved' && shift.clock_out_status === 'approved'
}

// Pending OT still shows on Attendance, but is not paid until approved.
export function payableOvertimeHours(shift: StaffClockShift): number {
  if (shift.ot_status !== 'approved') return 0
  return recordedOvertimeHours(shift) ?? 0
}

export function validatePayrollInput(input: PayrollInput): ClockValidationResult {
  if (!input.startDate || !input.endDate) {
    return { ok: false, message: 'Start and end dates are required.' }
  }
  if (input.endDate < input.startDate) {
    return { ok: false, message: 'End date must be on or after the start date.' }
  }
  if (!Number.isFinite(input.ratePerDay) || input.ratePerDay < 0) {
    return { ok: false, message: 'Rate per day must be zero or more.' }
  }
  if (!Number.isFinite(input.deduction) || input.deduction < 0) {
    return { ok: false, message: 'Deduction must be zero or more.' }
  }
  return { ok: true }
}

export function calculatePayroll(shifts: StaffClockShift[], input: PayrollInput): PayrollResult {
  const payable = shifts.filter(
    (row) =>
      row.staff_name === input.staffName &&
      isPayableShift(row) &&
      manilaYmd(row.clock_in_at) >= input.startDate &&
      manilaYmd(row.clock_in_at) <= input.endDate
  )
  const days = payable.length
  const otHours = roundMoney(
    payable.reduce((sum, row) => sum + payableOvertimeHours(row), 0)
  )
  const regularPay = roundMoney(days * input.ratePerDay)
  const otPay = roundMoney(
    payable.reduce((sum, row) => sum + overtimePay(payableOvertimeHours(row), input.ratePerDay), 0)
  )
  const deduction = roundMoney(input.deduction)
  return {
    days,
    otHours,
    regularPay,
    otPay,
    deduction,
    netPay: roundMoney(regularPay + otPay - deduction)
  }
}

export function formatPayrollPeso(value: number): string {
  const abs = Math.abs(value).toFixed(2)
  return value < 0 ? `-₱${abs}` : `₱${abs}`
}
