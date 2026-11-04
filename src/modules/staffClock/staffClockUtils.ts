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

export function overtimeHours(shift: StaffClockShift, now: Date = new Date()): number {
  if (!shift.ot_requested || shift.ot_status === 'declined' || !shift.ot_status) return 0
  const raw = rawOvertimeHours(shift, now)
  if (raw < MIN_OT_HOURS) return 0
  return raw
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
