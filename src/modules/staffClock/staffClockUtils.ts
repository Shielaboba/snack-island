import {
  STAFF_NAMES,
  type ClockValidationResult,
  type PunchStatus,
  type StaffClockShift,
  type StaffName
} from '../../models/StaffClock'

export { STAFF_NAMES }
export const SELFIE_MAX_SIDE = 720
export const SELFIE_JPEG_QUALITY = 0.7

const HOUR_MS = 60 * 60 * 1000
export const STANDARD_SHIFT_HOURS = 8
export const MIN_OT_HOURS = 2
export const OT_REQUEST_HOUR_MANILA = 22
const HALF_PAY_OT_START_MINUTES = 23 * 60 + 30
export const SCHEDULED_START_HOUR_MANILA = 14

export function isOpenShift(shift: StaffClockShift): boolean {
  if (shift.clock_in_status === 'declined') return false
  if (!shift.clock_out_at) return true
  return shift.clock_out_status === 'declined'
}

export function openShiftFor(
  name: StaffName,
  shifts: StaffClockShift[]
): StaffClockShift | undefined {
  return shifts.find((row) => row.staff_name === name && isOpenShift(row))
}

export function latestShiftFor(
  name: StaffName,
  shifts: StaffClockShift[]
): StaffClockShift | null {
  const rows = shifts
    .filter((row) => row.staff_name === name)
    .sort((a, b) => {
      const byIn = Date.parse(b.clock_in_at) - Date.parse(a.clock_in_at)
      if (byIn !== 0) return byIn
      return Date.parse(b.created_at) - Date.parse(a.created_at)
    })
  return rows[0] ?? null
}

export function activeShiftFor(
  name: StaffName,
  shifts: StaffClockShift[]
): StaffClockShift | null {
  return openShiftFor(name, shifts) ?? latestShiftFor(name, shifts)
}

export function canClockIn(name: StaffName, shifts: StaffClockShift[]): boolean {
  return !openShiftFor(name, shifts)
}

export function canClockOut(name: StaffName, shifts: StaffClockShift[]): boolean {
  return Boolean(openShiftFor(name, shifts))
}

export function nextClockAction(
  name: StaffName,
  shifts: StaffClockShift[]
): 'clock_in' | 'clock_out' {
  return canClockOut(name, shifts) ? 'clock_out' : 'clock_in'
}

export function validateClockIn(
  name: StaffName,
  shifts: StaffClockShift[]
): ClockValidationResult {
  if (!canClockIn(name, shifts)) {
    return { ok: false, message: `${name} is already clocked in.` }
  }
  return { ok: true }
}

export function validateClockOut(
  name: StaffName,
  shifts: StaffClockShift[]
): ClockValidationResult {
  if (!canClockOut(name, shifts)) {
    return { ok: false, message: `${name} is not clocked in.` }
  }
  return { ok: true }
}

export function shiftHours(shift: Pick<StaffClockShift, 'clock_in_at' | 'clock_out_at'>): number | null {
  if (!shift.clock_out_at) return null
  const hours =
    (Date.parse(shift.clock_out_at) - Date.parse(shift.clock_in_at)) / HOUR_MS
  return Math.round(hours * 100) / 100
}

export function elapsedHours(
  shift: Pick<StaffClockShift, 'clock_in_at' | 'clock_out_at' | 'clock_out_status'>,
  now: Date = new Date()
): number {
  const end =
    shift.clock_out_at && shift.clock_out_status !== 'declined'
      ? Date.parse(shift.clock_out_at)
      : now.getTime()
  return Math.round(((end - Date.parse(shift.clock_in_at)) / HOUR_MS) * 100) / 100
}

export function rawOvertimeHours(
  shift: Pick<StaffClockShift, 'clock_in_at' | 'clock_out_at' | 'clock_out_status'>,
  now: Date = new Date()
): number {
  return Math.max(0, Math.round((elapsedHours(shift, now) - STANDARD_SHIFT_HOURS) * 100) / 100)
}

function clockOutInHalfPayWindow(
  shift: Pick<StaffClockShift, 'clock_out_at' | 'clock_out_status'>
): boolean {
  if (!shift.clock_out_at || shift.clock_out_status === 'declined') return false
  const minutes = manilaMinutes(shift.clock_out_at)
  return minutes >= HALF_PAY_OT_START_MINUTES || minutes === 0
}

export function clockOutCoveringOvertime(clockInAt: string, clockOutAt: string, otHours: number): string {
  const extra = Number(otHours) || 0
  if (extra <= 0) return clockOutAt
  const covered = Date.parse(clockInAt) + (STANDARD_SHIFT_HOURS + extra) * HOUR_MS
  return new Date(Math.max(Date.parse(clockOutAt), covered)).toISOString()
}

function overtimeFromRaw(
  raw: number,
  shift: Pick<StaffClockShift, 'clock_out_at' | 'clock_out_status'>
): number {
  if (raw > 0 && raw < MIN_OT_HOURS && clockOutInHalfPayWindow(shift)) return MIN_OT_HOURS
  if (raw < MIN_OT_HOURS) return 0
  return raw
}

export function overtimeHours(shift: StaffClockShift, now: Date = new Date()): number {
  if (!shift.ot_requested || shift.ot_status === 'declined' || !shift.ot_status) return 0
  return overtimeFromRaw(rawOvertimeHours(shift, now), shift)
}

// Overtime added to a missed punch must reach the paid minimum, or it is recorded but paid as nothing.
export function missedPunchOtError(clockInAt: string, clockOutAt: string, otHours: number): string | null {
  const extra = Number(otHours) || 0
  if (extra < 0) return 'Overtime hours must be zero or more.'
  if (extra === 0) return null
  const shift = {
    clock_in_at: clockInAt,
    clock_out_at: clockOutCoveringOvertime(clockInAt, clockOutAt, extra),
    clock_out_status: 'approved' as const
  }
  if (overtimeFromRaw(rawOvertimeHours(shift), shift) > 0) return null
  return `Overtime must be at least ${MIN_OT_HOURS} hours, or run until 11:30 PM to midnight.`
}

export function recordedOvertimeHours(
  shift: StaffClockShift,
  now: Date = new Date()
): number | null {
  const hours = overtimeHours(shift, now)
  return hours > 0 ? hours : null
}

export function manilaYmd(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(iso))
}

export function manilaToday(now: Date = new Date()): string {
  return manilaYmd(now.toISOString())
}

export function otRequestOpensAt(clockInAt: string): Date {
  return new Date(`${manilaYmd(clockInAt)}T${String(OT_REQUEST_HOUR_MANILA).padStart(2, '0')}:00:00+08:00`)
}

export function isAfterTenPmManila(clockInAt: string, now: Date = new Date()): boolean {
  return now.getTime() >= otRequestOpensAt(clockInAt).getTime()
}

export function isEarlyClockIn(clockInAt: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date(clockInAt))
      .find((part) => part.type === 'hour')?.value ?? '99'
  )
  return hour < SCHEDULED_START_HOUR_MANILA
}

function otAlreadyFiled(shift: StaffClockShift): boolean {
  return shift.ot_status === 'pending' || shift.ot_status === 'approved'
}

export function canRequestOt(
  shift: StaffClockShift | null | undefined,
  now: Date = new Date()
): boolean {
  if (!shift || !isOpenShift(shift) || otAlreadyFiled(shift)) return false
  return isEarlyClockIn(shift.clock_in_at) || isAfterTenPmManila(shift.clock_in_at, now)
}

export function shouldPromptOtOnClockOut(
  shift: StaffClockShift | null | undefined,
  now: Date = new Date()
): boolean {
  if (!shift || !isOpenShift(shift) || otAlreadyFiled(shift)) return false
  return rawOvertimeHours(shift, now) >= MIN_OT_HOURS
}

export function canRecordOt(
  shift: StaffClockShift | null | undefined,
  now: Date = new Date()
): boolean {
  if (!shift || shift.clock_in_status === 'declined' || otAlreadyFiled(shift)) return false
  if (isEarlyClockIn(shift.clock_in_at)) return true
  if (isOpenShift(shift) && isAfterTenPmManila(shift.clock_in_at, now)) return true
  return rawOvertimeHours(shift, now) >= MIN_OT_HOURS
}

export function validateRequestOt(
  name: StaffName,
  shifts: StaffClockShift[],
  now: Date = new Date()
): ClockValidationResult {
  const open = openShiftFor(name, shifts)
  if (!open) return { ok: false, message: `${name} is not clocked in.` }
  if (otAlreadyFiled(open)) {
    return { ok: false, message: `${name} already requested OT.` }
  }
  if (!isEarlyClockIn(open.clock_in_at) && !isAfterTenPmManila(open.clock_in_at, now)) {
    return { ok: false, message: 'Request OT if you came in before 2:00 PM or after 10:00 PM.' }
  }
  return { ok: true }
}

export function validateRecordOt(
  shift: StaffClockShift,
  now: Date = new Date()
): ClockValidationResult {
  if (canRecordOt(shift, now)) return { ok: true }
  return {
    ok: false,
    message: 'OT can only be recorded for extra time (before 2:00 PM or after 10:00 PM, minimum 2 hours).'
  }
}

export function otStatusCopy(shift: StaffClockShift | null): string | null {
  if (!shift) return null
  if (shift.ot_status === 'pending') return 'OT requested · waiting for approval'
  if (shift.ot_status === 'approved') return 'OT approved · time still running'
  if (shift.ot_status === 'declined') return 'OT declined · you can request again'
  return null
}

export function formatHours(hours: number | null): string {
  if (hours == null) return '—'
  return `${hours.toFixed(2)}h`
}

export function clockStatusCopy(shift: StaffClockShift | null): string {
  if (!shift) return 'Not clocked in'
  if (isOpenShift(shift)) {
    if (shift.clock_out_status === 'declined') {
      return 'Clock-out declined · still on the clock'
    }
    if (shift.clock_in_status === 'pending') return 'Clocked in · waiting for approval'
    if (shift.clock_in_status === 'approved') return 'Clocked in · approved'
    return 'Clocked in'
  }
  if (shift.clock_in_status === 'declined') {
    return 'Clock-in declined · you can clock in again'
  }
  if (shift.clock_out_status === 'pending') return 'Clocked out · waiting for approval'
  if (shift.clock_out_status === 'approved') return 'Clocked out · approved'
  if (shift.clock_out_status === 'declined') return 'Clock-out declined · still on the clock'
  return 'Not clocked in'
}

export function punchStatusLabel(status: PunchStatus | null): string {
  if (!status) return '—'
  if (status === 'pending') return 'Waiting'
  if (status === 'approved') return 'Approved'
  return 'Declined'
}

export function validateShiftTimes(
  clockInAt: string,
  clockOutAt: string | null
): ClockValidationResult {
  if (!clockInAt) return { ok: false, message: 'Clock-in time is required.' }
  if (clockOutAt && Date.parse(clockOutAt) <= Date.parse(clockInAt)) {
    return { ok: false, message: 'Clock-out must be after clock-in.' }
  }
  return { ok: true }
}

// A shift with no (or a declined) clock-out is still running, so it has no end.
function shiftEndMs(shift: StaffClockShift): number {
  if (!shift.clock_out_at || shift.clock_out_status === 'declined') return Infinity
  return Date.parse(shift.clock_out_at)
}

export function findOverlappingShift(
  name: StaffName,
  clockInAt: string,
  clockOutAt: string | null,
  shifts: StaffClockShift[],
  ignoreId?: string
): StaffClockShift | undefined {
  const start = Date.parse(clockInAt)
  const end = clockOutAt ? Date.parse(clockOutAt) : Infinity
  return shifts.find(
    (row) =>
      row.id !== ignoreId &&
      row.staff_name === name &&
      row.clock_in_status !== 'declined' &&
      Date.parse(row.clock_in_at) < end &&
      start < shiftEndMs(row)
  )
}

function manilaPart(iso: string, type: Intl.DateTimeFormatPartTypes): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso))
  return parts.find((part) => part.type === type)?.value ?? ''
}

export function toManilaDateTimeLocal(iso: string): string {
  return `${manilaPart(iso, 'year')}-${manilaPart(iso, 'month')}-${manilaPart(iso, 'day')}T${manilaPart(iso, 'hour')}:${manilaPart(iso, 'minute')}`
}

export function fromManilaDateTimeLocal(local: string): string {
  const [date, time] = local.split('T')
  if (!date || !time) throw new Error('Enter a valid date and time.')
  const withSeconds = time.length === 5 ? `${time}:00` : time
  return new Date(`${date}T${withSeconds}+08:00`).toISOString()
}

export function formatManilaClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(iso))
}

export type ReflectedPunch = {
  inLabel: string
  outLabel: string | null
  inCaptured: string | null
  outCaptured: string | null
  hours: number | null
}

function manilaMinutes(iso: string): number {
  return Number(manilaPart(iso, 'hour')) * 60 + Number(manilaPart(iso, 'minute'))
}

function otKeepsCapturedTime(status: PunchStatus | null): boolean {
  return status === 'pending' || status === 'approved'
}

function outAtOrAfterTen(clockInAt: string, clockOutAt: string): boolean {
  if (manilaYmd(clockOutAt) > manilaYmd(clockInAt)) return true
  return manilaMinutes(clockOutAt) >= OT_REQUEST_HOUR_MANILA * 60
}

export function reflectedPunch(
  shift: Pick<StaffClockShift, 'clock_in_at' | 'clock_out_at' | 'ot_status'>
): ReflectedPunch {
  const capturedIn = formatManilaClock(shift.clock_in_at)
  const capturedOut = shift.clock_out_at ? formatManilaClock(shift.clock_out_at) : null
  const reflect = !otKeepsCapturedTime(shift.ot_status) && isEarlyClockIn(shift.clock_in_at)
  const inLabel = reflect
    ? formatManilaClock(`${manilaYmd(shift.clock_in_at)}T${String(SCHEDULED_START_HOUR_MANILA).padStart(2, '0')}:00:00+08:00`)
    : capturedIn
  const capOut =
    reflect && shift.clock_out_at && outAtOrAfterTen(shift.clock_in_at, shift.clock_out_at)
  const outLabel = capOut
    ? formatManilaClock(`${manilaYmd(shift.clock_in_at)}T${String(OT_REQUEST_HOUR_MANILA).padStart(2, '0')}:00:00+08:00`)
    : capturedOut

  let hours: number | null = null
  if (shift.clock_out_at) {
    if (!reflect) {
      hours = shiftHours(shift)
    } else if (capOut) {
      hours = STANDARD_SHIFT_HOURS
    } else {
      const minutes = manilaMinutes(shift.clock_out_at) - SCHEDULED_START_HOUR_MANILA * 60
      hours = minutes < 0 ? null : Math.round((minutes / 60) * 100) / 100
    }
  }

  return {
    inLabel,
    outLabel,
    inCaptured: inLabel === capturedIn ? null : capturedIn,
    outCaptured: !outLabel || outLabel === capturedOut ? null : capturedOut,
    hours
  }
}

export function formatManilaDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(iso))
}

export function formatManilaLive(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(now)
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err && 'message' in err) {
    const message = (err as { message: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}

export function selfieTargetSize(
  width: number,
  height: number,
  maxSide = SELFIE_MAX_SIDE
): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= maxSide) return { width, height }
  const scale = maxSide / long
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
