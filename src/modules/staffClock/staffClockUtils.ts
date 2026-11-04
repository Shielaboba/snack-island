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
const STANDARD_HOURS = 8

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
    .sort((a, b) => Date.parse(b.clock_in_at) - Date.parse(a.clock_in_at))
  return rows[0] ?? null
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

export function overtimeHours(
  shift: Pick<StaffClockShift, 'clock_in_at' | 'clock_out_at'>
): number {
  const hours = shiftHours(shift)
  if (hours == null) return 0
  return Math.max(0, Math.round((hours - STANDARD_HOURS) * 100) / 100)
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
