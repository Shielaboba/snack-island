import { STAFF_NAMES, type StaffName } from '../../models/StaffClock'
import { manilaToday } from '../staffClock/staffClockUtils'

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export type StaffProfile = {
  name: StaffName
  ratePerDay: number
  shiftStart: string
  shiftEnd: string
  daysOff: number[]
  payrollWeekday: number
}

export type StaffLoan = {
  id: string
  name: string
  staffName: StaffName
  deductionTotal: number
  payrollCount: number
  firstPayrollDate: string
  paid: boolean
  // Day the loan was marked paid. Paydays before it keep their deduction.
  paidOn: string
}

export type StaffCompensation = {
  id: string
  name: string
  staffName: StaffName
  amount: number
  // For a one-off this is the day it is paid. For forever it is the day it starts.
  date: string
  forever: boolean
}

export type StaffPayment = {
  id: string
  staffName: StaffName
  amount: number
  paidOn: string
  payrollStart: string
  payrollEnd: string
}

const PAYABLE_KEY = 'snack-island-staff-payables'
const COMPENSATION_KEY = 'snack-island-staff-compensation'
const PAYMENT_KEY = 'snack-island-staff-payments'
const PROFILE_KEY = 'snack-island-staff-profiles'

// Shared payroll records. The browser copy is a cache of the shared table.
export const PAYROLL_STORAGE_KEYS = {
  profiles: PROFILE_KEY,
  payables: PAYABLE_KEY,
  compensation: COMPENSATION_KEY,
  payments: PAYMENT_KEY
} as const
export type PayrollRecordKey = keyof typeof PAYROLL_STORAGE_KEYS
const VIEW_KEY = 'snack-island-payroll-view'

export type PayrollView = {
  staffName: StaffName
  startDate: string
  endDate: string
}

function isStaffName(value: unknown): value is StaffName {
  return STAFF_NAMES.includes(value as StaffName)
}

export function loadStaffPayables(storage: Storage = globalThis.localStorage): StaffLoan[] {
  try {
    const raw = storage.getItem(PAYABLE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const loan = row as Partial<StaffLoan>
      if (typeof loan.id !== 'string' || !isStaffName(loan.staffName)) return []
      if (typeof loan.firstPayrollDate !== 'string') return []
      return [
        {
          id: loan.id,
          name: typeof loan.name === 'string' ? loan.name : '',
          staffName: loan.staffName,
          deductionTotal: Number(loan.deductionTotal) || 0,
          payrollCount: Number(loan.payrollCount) || 0,
          firstPayrollDate: loan.firstPayrollDate,
          paid: loan.paid === true,
          paidOn: loan.paid === true && isIsoDate(loan.paidOn) ? loan.paidOn : ''
        }
      ]
    })
  } catch {
    return []
  }
}

export function saveStaffPayables(loans: StaffLoan[], storage: Storage = globalThis.localStorage) {
  storage.setItem(PAYABLE_KEY, JSON.stringify(loans))
}

export function loadStaffCompensation(storage: Storage = globalThis.localStorage): StaffCompensation[] {
  try {
    const raw = storage.getItem(COMPENSATION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const item = row as Partial<StaffCompensation>
      if (typeof item.id !== 'string' || !isStaffName(item.staffName)) return []
      const forever = item.forever === true
      if (!forever && (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date))) return []
      return [
        {
          id: item.id,
          name: typeof item.name === 'string' ? item.name : '',
          staffName: item.staffName,
          amount: Number(item.amount) || 0,
          date: isIsoDate(item.date) ? item.date : '',
          forever
        }
      ]
    })
  } catch {
    return []
  }
}

export function saveStaffCompensation(rows: StaffCompensation[], storage: Storage = globalThis.localStorage) {
  storage.setItem(COMPENSATION_KEY, JSON.stringify(rows))
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function loadStaffPayments(storage: Storage = globalThis.localStorage): StaffPayment[] {
  try {
    const raw = storage.getItem(PAYMENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const item = row as Partial<StaffPayment>
      if (typeof item.id !== 'string' || !isStaffName(item.staffName)) return []
      if (!isIsoDate(item.paidOn) || !isIsoDate(item.payrollStart) || !isIsoDate(item.payrollEnd)) return []
      return [
        {
          id: item.id,
          staffName: item.staffName,
          amount: Number(item.amount) || 0,
          paidOn: item.paidOn,
          payrollStart: item.payrollStart,
          payrollEnd: item.payrollEnd
        }
      ]
    })
  } catch {
    return []
  }
}

export function saveStaffPayments(rows: StaffPayment[], storage: Storage = globalThis.localStorage) {
  storage.setItem(PAYMENT_KEY, JSON.stringify(rows))
}

export function paymentsForPayroll(
  rows: StaffPayment[],
  staffName: StaffName,
  startDate: string,
  endDate: string
): StaffPayment[] {
  if (!startDate || !endDate || endDate < startDate) return []
  return rows.filter(
    (row) =>
      row.staffName === staffName &&
      row.payrollStart === startDate &&
      row.payrollEnd === endDate &&
      (Number(row.amount) || 0) > 0
  )
}

export function paymentTotal(
  rows: StaffPayment[],
  staffName: StaffName,
  startDate: string,
  endDate: string
): number {
  return roundMoney(paymentsForPayroll(rows, staffName, startDate, endDate).reduce((sum, row) => sum + row.amount, 0))
}

export function compensationApplies(
  row: StaffCompensation,
  staffName: StaffName,
  startDate: string,
  endDate: string
): boolean {
  if (row.staffName !== staffName || endDate < startDate || (Number(row.amount) || 0) <= 0) return false
  // Forever starts on its date. Older rows saved without a date apply to every week.
  if (row.forever) return !row.date || row.date <= endDate
  return row.date >= startDate && row.date <= endDate
}

export function compensationForPayrollRange(
  rows: StaffCompensation[],
  staffName: StaffName,
  startDate: string,
  endDate: string
): number {
  return roundMoney(
    rows.reduce((sum, row) => {
      if (!compensationApplies(row, staffName, startDate, endDate)) return sum
      return sum + (Number(row.amount) || 0)
    }, 0)
  )
}

function defaultProfiles(): StaffProfile[] {
  return DEFAULT_STAFF.map((row) => ({ ...row, daysOff: [...row.daysOff] }))
}

export function loadStaffProfiles(storage: Storage = globalThis.localStorage): StaffProfile[] {
  const defaults = defaultProfiles()
  try {
    const raw = storage.getItem(PROFILE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return defaults
    return defaults.map((fallback) => {
      const saved = parsed.find(
        (row) => row && typeof row === 'object' && (row as Partial<StaffProfile>).name === fallback.name
      ) as Partial<StaffProfile> | undefined
      if (!saved) return fallback
      const weekday = Number(saved.payrollWeekday)
      const daysOff = Array.isArray(saved.daysOff)
        ? saved.daysOff.filter((day) => typeof day === 'number' && day >= 0 && day <= 6)
        : fallback.daysOff
      return {
        name: fallback.name,
        ratePerDay: Number.isFinite(Number(saved.ratePerDay)) ? Number(saved.ratePerDay) : fallback.ratePerDay,
        shiftStart: typeof saved.shiftStart === 'string' ? saved.shiftStart : fallback.shiftStart,
        shiftEnd: typeof saved.shiftEnd === 'string' ? saved.shiftEnd : fallback.shiftEnd,
        daysOff,
        payrollWeekday: weekday >= 0 && weekday <= 6 ? weekday : fallback.payrollWeekday
      }
    })
  } catch {
    return defaults
  }
}

export function saveStaffProfiles(profiles: StaffProfile[], storage: Storage = globalThis.localStorage) {
  storage.setItem(PROFILE_KEY, JSON.stringify(profiles))
}

export function loadPayrollView(storage: Storage = globalThis.localStorage): PayrollView | null {
  try {
    const raw = storage.getItem(VIEW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PayrollView> & { payrollDate?: string }
    if (!isStaffName(parsed.staffName)) return null
    if (typeof parsed.startDate === 'string' && typeof parsed.endDate === 'string') {
      return { staffName: parsed.staffName, startDate: parsed.startDate, endDate: parsed.endDate }
    }
    if (typeof parsed.payrollDate === 'string' && weekdayIndex(parsed.payrollDate) != null) {
      return {
        staffName: parsed.staffName,
        startDate: addDays(parsed.payrollDate, -6),
        endDate: parsed.payrollDate
      }
    }
    return null
  } catch {
    return null
  }
}

export function savePayrollView(view: PayrollView, storage: Storage = globalThis.localStorage) {
  storage.setItem(VIEW_KEY, JSON.stringify(view))
}

export function resolvePayrollView(
  loans: StaffLoan[],
  storage: Storage = globalThis.localStorage,
  today: string = manilaToday()
): PayrollView {
  const saved = loadPayrollView(storage)
  if (saved) return saved
  const latest = loans[loans.length - 1]
  const staffName: StaffName = latest?.staffName ?? 'Shai'
  const weekday = loadStaffProfiles(storage).find((row) => row.name === staffName)?.payrollWeekday ?? 0
  // With no loan to point at, open the current payroll week.
  const endDate = firstPaydayOnOrAfter(latest?.firstPayrollDate ?? today, weekday)
  return {
    staffName,
    startDate: addDays(endDate, -6),
    endDate
  }
}

export const DEFAULT_STAFF: StaffProfile[] = [
  {
    name: 'Shai',
    ratePerDay: 500,
    shiftStart: '14:00',
    shiftEnd: '22:00',
    daysOff: [],
    payrollWeekday: 5
  },
  {
    name: 'Den',
    ratePerDay: 500,
    shiftStart: '14:00',
    shiftEnd: '22:00',
    daysOff: [],
    payrollWeekday: 4
  }
]

export function formatShiftTime(value: string): string {
  const [hourText, minuteText] = value.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
}

export function formatShift(profile: Pick<StaffProfile, 'shiftStart' | 'shiftEnd'>): string {
  return `${formatShiftTime(profile.shiftStart)} – ${formatShiftTime(profile.shiftEnd)}`
}

export function formatWeekday(weekday: number): string {
  return WEEKDAYS[weekday] ?? ''
}

export function isDayOff(profile: Pick<StaffProfile, 'daysOff'>, weekday: number): boolean {
  return profile.daysOff.includes(weekday)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function weekdayIndex(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const date = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return date.getUTCDay()
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function payrollWeekRange(payrollDate: string): { startDate: string; endDate: string } {
  if (weekdayIndex(payrollDate) == null) return { startDate: '', endDate: '' }
  return { startDate: addDays(payrollDate, -6), endDate: payrollDate }
}

export function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

export function perPayrollDeduction(loan: Pick<StaffLoan, 'deductionTotal' | 'payrollCount'>): number {
  if (loan.payrollCount <= 0 || loan.deductionTotal <= 0) return 0
  return roundMoney(loan.deductionTotal / loan.payrollCount)
}

export function firstPaydayOnOrAfter(isoDate: string, weekday: number): string {
  const current = weekdayIndex(isoDate)
  if (current == null || weekday < 0 || weekday > 6) return isoDate
  return addDays(isoDate, (weekday - current + 7) % 7)
}

export function deductionForLoan(
  loan: Pick<StaffLoan, 'deductionTotal' | 'payrollCount' | 'firstPayrollDate'>,
  payrollWeekday: number,
  payrollDate: string
): number {
  if (loan.payrollCount <= 0 || loan.deductionTotal <= 0) return 0
  if (weekdayIndex(payrollDate) !== payrollWeekday) return 0
  const start = Date.parse(`${firstPaydayOnOrAfter(loan.firstPayrollDate, payrollWeekday)}T12:00:00Z`)
  const current = Date.parse(`${payrollDate}T12:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(current)) return 0
  const days = Math.round((current - start) / 86_400_000)
  if (days < 0 || days % 7 !== 0) return 0
  const index = days / 7
  if (index >= loan.payrollCount) return 0
  if (index === loan.payrollCount - 1) {
    const earlier = roundMoney(perPayrollDeduction(loan) * (loan.payrollCount - 1))
    return roundMoney(loan.deductionTotal - earlier)
  }
  return perPayrollDeduction(loan)
}

// A loan marked paid stops deducting from that day on. Earlier paydays keep their deduction.
// Loans marked paid before paidOn was recorded never deduct.
function loanDeductsOn(loan: Pick<StaffLoan, 'paid' | 'paidOn'>, payrollDate: string): boolean {
  if (!loan.paid) return true
  return loan.paidOn !== '' && payrollDate < loan.paidOn
}

export function deductionForPayroll(
  loans: StaffLoan[],
  staffName: StaffName,
  payrollWeekday: number,
  payrollDate: string
): number {
  return roundMoney(
    loans
      .filter((loan) => loan.staffName === staffName && loanDeductsOn(loan, payrollDate))
      .reduce((sum, loan) => sum + deductionForLoan(loan, payrollWeekday, payrollDate), 0)
  )
}

export function paydaysInRange(startDate: string, endDate: string, weekday: number): string[] {
  if (weekdayIndex(startDate) == null || weekdayIndex(endDate) == null || endDate < startDate) return []
  const dates: string[] = []
  let cursor = firstPaydayOnOrAfter(startDate, weekday)
  while (cursor <= endDate && dates.length < 104) {
    dates.push(cursor)
    const next = addDays(cursor, 7)
    if (next <= cursor) break
    cursor = next
  }
  return dates
}

export function deductionForPayrollRange(
  loans: StaffLoan[],
  staffName: StaffName,
  payrollWeekday: number,
  startDate: string,
  endDate: string
): number {
  const dates = paydaysInRange(startDate, endDate, payrollWeekday)
  return roundMoney(
    dates.reduce((sum, date) => sum + deductionForPayroll(loans, staffName, payrollWeekday, date), 0)
  )
}

export type PayrollSummaryInput = {
  staffName: string
  weekLabel: string
  days: number
  regularPay: string
  otHours: string
  otPay: string
  compensationLines: { label: string; amount: string }[]
  compensation: string
  loans: { label: string; amount: string }[]
  deduction: string
  netPay: string
  paymentLines: { label: string; amount: string }[]
  paid: string
  balance: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function payrollSummaryText(input: PayrollSummaryInput): string {
  const compensation = input.compensationLines.map((row) => `  ${row.label}: ${row.amount}`)
  const loans = input.loans.map((loan) => `  ${loan.label}: ${loan.amount}`)
  const payments = input.paymentLines.map((row) => `  ${row.label}: ${row.amount}`)
  return [
    input.staffName,
    `Week: ${input.weekLabel}`,
    `Working Days: ${input.days}`,
    `Regular: ${input.regularPay}`,
    `OT hours: ${input.otHours}`,
    `OT pay: ${input.otPay}`,
    `Compensation: ${input.compensation}`,
    ...compensation,
    `Deduction: ${input.deduction}`,
    ...loans,
    `Net pay: ${input.netPay}`,
    `Paid: ${input.paid}`,
    ...payments,
    `Balance: ${input.balance}`
  ].join('\n')
}

export function payrollSummaryHtml(input: PayrollSummaryInput, logoSrc: string): string {
  const compensationRows = input.compensationLines
    .map(
      (row) =>
        `<div class="sub"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.amount)}</strong></div>`
    )
    .join('')
  const loanRows = input.loans
    .map(
      (loan) =>
        `<div class="sub"><span>${escapeHtml(loan.label)}</span><strong>${escapeHtml(loan.amount)}</strong></div>`
    )
    .join('')
  const paymentRows = input.paymentLines
    .map(
      (row) =>
        `<div class="sub"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.amount)}</strong></div>`
    )
    .join('')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.staffName)} payroll</title>
<style>
  body { margin: 0; background: #f8f9fa; color: #1f2937; font-family: system-ui, sans-serif; }
  .slip { max-width: 440px; margin: 24px auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; }
  .brand { display: flex; align-items: center; gap: 12px; padding: 18px 20px; background: linear-gradient(180deg, #0e3b2e 0%, #114e43 100%); color: #fff; }
  .brand img { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; background: #0e3b2e; }
  .brand strong { display: block; font-size: 18px; }
  .brand span { color: #ffb800; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .body { padding: 20px; }
  .who { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  h1 { margin: 0; color: #0e3b2e; font-size: 28px; }
  .week { margin: 0; color: #6b7280; text-align: right; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  .sub { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0 6px 18px; color: #6b7280; font-size: 14px; }
  .net { margin-top: 16px; padding: 14px 16px; border-radius: 12px; background: #e7f3ee; display: flex; justify-content: space-between; align-items: center; }
  .net strong { color: #0e3b2e; font-size: 22px; }
</style>
</head>
<body>
<article class="slip">
  <header class="brand">
    <img src="${escapeHtml(logoSrc)}" alt="Snack Island logo">
    <div><strong>Snack Island</strong><span>Payroll</span></div>
  </header>
  <div class="body">
    <div class="who">
      <h1>${escapeHtml(input.staffName)}</h1>
      <p class="week">${escapeHtml(input.weekLabel)}</p>
    </div>
    <div class="row"><span>Working Days</span><strong>${input.days}</strong></div>
    <div class="row"><span>Regular</span><strong>${escapeHtml(input.regularPay)}</strong></div>
    <div class="row"><span>OT hours</span><strong>${escapeHtml(input.otHours)}</strong></div>
    <div class="row"><span>OT pay</span><strong>${escapeHtml(input.otPay)}</strong></div>
    <div class="row"><span>Compensation</span><strong>${escapeHtml(input.compensation)}</strong></div>
    ${compensationRows}
    <div class="row"><span>Deduction</span><strong>${escapeHtml(input.deduction)}</strong></div>
    ${loanRows}
    <div class="net"><span>Net pay</span><strong>${escapeHtml(input.netPay)}</strong></div>
    <div class="row"><span>Paid</span><strong>${escapeHtml(input.paid)}</strong></div>
    ${paymentRows}
    <div class="row"><span>Balance</span><strong>${escapeHtml(input.balance)}</strong></div>
  </div>
</article>
</body>
</html>`
}
