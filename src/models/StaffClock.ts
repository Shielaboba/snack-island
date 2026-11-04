export const STAFF_CLOCK_TABLE = 'staff_clock_shifts'
export const STAFF_CLOCK_BUCKET = 'staff-clock-photos'

export const STAFF_NAMES = ['Shai', 'Den'] as const
export type StaffName = (typeof STAFF_NAMES)[number]

export const PUNCH_STATUSES = ['pending', 'approved', 'declined'] as const
export type PunchStatus = (typeof PUNCH_STATUSES)[number]

export interface StaffClockShift {
  id: string
  staff_name: StaffName
  clock_in_at: string
  clock_out_at: string | null
  clock_in_photo_path: string | null
  clock_out_photo_path: string | null
  clock_in_status: PunchStatus
  clock_out_status: PunchStatus | null
  clock_in_override: boolean
  clock_out_override: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface MissedPunchInput {
  staff_name: StaffName
  clock_in_at: string
  clock_out_at: string
}

export interface ShiftTimePatch {
  clock_in_at: string
  clock_out_at: string | null
}

export type ClockValidationResult = { ok: true } | { ok: false; message: string }
