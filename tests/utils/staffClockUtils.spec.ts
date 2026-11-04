import { describe, it, expect } from 'vitest'
import type { StaffClockShift } from '../../src/models/StaffClock'
import {
  STAFF_NAMES,
  SELFIE_MAX_SIDE,
  canClockIn,
  errorMessage,
  canClockOut,
  clockStatusCopy,
  formatHours,
  formatManilaClock,
  fromManilaDateTimeLocal,
  isOpenShift,
  nextClockAction,
  openShiftFor,
  MIN_OT_HOURS,
  canRequestOt,
  overtimeHours,
  recordedOvertimeHours,
  selfieTargetSize,
  shiftHours,
  toManilaDateTimeLocal,
  validateClockIn,
  validateClockOut,
  validateShiftTimes
} from '../../src/modules/staffClock/staffClockUtils'

function shift(partial: Partial<StaffClockShift>): StaffClockShift {
  return {
    id: 's1',
    staff_name: 'Shai',
    clock_in_at: '2026-11-04T06:00:00.000Z',
    clock_out_at: null,
    clock_in_photo_path: 'Shai/s1-in.jpg',
    clock_out_photo_path: null,
    clock_in_status: 'pending',
    clock_out_status: null,
    clock_in_override: false,
    clock_out_override: false,
    ot_requested: false,
    ot_status: null,
    ot_requested_at: null,
    created_by: 'staff',
    updated_by: null,
    created_at: '2026-11-04T06:00:00.000Z',
    updated_at: '2026-11-04T06:00:00.000Z',
    ...partial
  }
}

describe('staff names', () => {
  it('is only Shai and Den', () => {
    expect(STAFF_NAMES).toEqual(['Shai', 'Den'])
  })
})

describe('open shift', () => {
  it('treats an in-punch without out as open', () => {
    expect(isOpenShift(shift({}))).toBe(true)
  })

  it('treats declined clock-in as not open', () => {
    expect(isOpenShift(shift({ clock_in_status: 'declined' }))).toBe(false)
  })

  it('treats declined clock-out as still open', () => {
    expect(
      isOpenShift(
        shift({
          clock_out_at: '2026-11-04T14:00:00.000Z',
          clock_out_status: 'declined',
          clock_in_status: 'approved'
        })
      )
    ).toBe(true)
  })

  it('treats an approved out as closed', () => {
    expect(
      isOpenShift(
        shift({
          clock_out_at: '2026-11-04T14:00:00.000Z',
          clock_out_status: 'approved',
          clock_in_status: 'approved'
        })
      )
    ).toBe(false)
  })

  it('lets both people be open at once', () => {
    const shifts = [
      shift({ id: 'shai', staff_name: 'Shai' }),
      shift({ id: 'den', staff_name: 'Den', clock_in_at: '2026-11-04T06:05:00.000Z' })
    ]
    expect(openShiftFor('Shai', shifts)?.id).toBe('shai')
    expect(openShiftFor('Den', shifts)?.id).toBe('den')
  })
})

describe('next clock action', () => {
  it('is clock in when the person is not open', () => {
    expect(nextClockAction('Shai', [])).toBe('clock_in')
    expect(canClockIn('Shai', [])).toBe(true)
    expect(canClockOut('Shai', [])).toBe(false)
  })

  it('is clock out when the person is open', () => {
    const shifts = [shift({})]
    expect(nextClockAction('Shai', shifts)).toBe('clock_out')
    expect(canClockIn('Shai', shifts)).toBe(false)
    expect(canClockOut('Shai', shifts)).toBe(true)
  })

  it('allows a new clock-in after declined in', () => {
    const shifts = [shift({ clock_in_status: 'declined' })]
    expect(nextClockAction('Shai', shifts)).toBe('clock_in')
    expect(validateClockIn('Shai', shifts).ok).toBe(true)
  })

  it('blocks a second open shift', () => {
    const result = validateClockIn('Shai', [shift({})])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/already clocked in/i)
  })

  it('blocks clock-out when not on the clock', () => {
    const result = validateClockOut('Shai', [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/not clocked in/i)
  })
})

describe('hours and overtime', () => {
  it('counts one session across midnight', () => {
    const row = shift({
      clock_in_at: '2026-11-04T14:00:00.000Z',
      clock_out_at: '2026-11-04T18:00:00.000Z',
      clock_out_status: 'pending'
    })
    expect(shiftHours(row)).toBe(4)
    expect(overtimeHours(row)).toBe(0)
  })

  it('does not record OT unless staff requested it', () => {
    const row = shift({
      clock_in_at: '2026-11-04T06:00:00.000Z',
      clock_out_at: '2026-11-04T16:00:00.000Z',
      clock_out_status: 'approved'
    })
    expect(shiftHours(row)).toBe(10)
    expect(overtimeHours(row)).toBe(0)
    expect(recordedOvertimeHours(row)).toBeNull()
  })

  it('records OT past 8 once requested, even while still pending', () => {
    const row = shift({
      clock_in_at: '2026-11-04T06:00:00.000Z',
      clock_out_at: '2026-11-04T16:00:00.000Z',
      clock_out_status: 'approved',
      ot_requested: true,
      ot_status: 'pending'
    })
    expect(overtimeHours(row)).toBe(2)
    expect(recordedOvertimeHours(row)).toBe(2)
  })

  it('does not record OT under the 2-hour minimum or when declined', () => {
    expect(MIN_OT_HOURS).toBe(2)
    const short = shift({
      clock_in_at: '2026-11-04T06:00:00.000Z',
      clock_out_at: '2026-11-04T15:00:00.000Z',
      clock_out_status: 'approved',
      ot_requested: true,
      ot_status: 'pending'
    })
    expect(shiftHours(short)).toBe(9)
    expect(recordedOvertimeHours(short)).toBeNull()
    const declined = shift({
      clock_in_at: '2026-11-04T06:00:00.000Z',
      clock_out_at: '2026-11-04T16:00:00.000Z',
      ot_requested: true,
      ot_status: 'declined'
    })
    expect(recordedOvertimeHours(declined)).toBeNull()
  })

  it('OT is 0 for an 8-hour shift and while still open without a request', () => {
    const eight = shift({
      clock_in_at: '2026-11-04T06:00:00.000Z',
      clock_out_at: '2026-11-04T14:00:00.000Z',
      clock_out_status: 'pending'
    })
    expect(overtimeHours(eight)).toBe(0)
    expect(overtimeHours(shift({}))).toBe(0)
    expect(shiftHours(shift({}))).toBeNull()
  })

  it('lets staff request OT only after 2 hours past 8, and time still counts as open', () => {
    const now = new Date('2026-11-04T16:00:00.000Z')
    const open = shift({ clock_in_at: '2026-11-04T06:00:00.000Z' })
    expect(canRequestOt(open, now)).toBe(true)
    expect(isOpenShift(open)).toBe(true)
    expect(canRequestOt(open, new Date('2026-11-04T14:30:00.000Z'))).toBe(false)
    expect(
      canRequestOt(
        shift({
          clock_in_at: '2026-11-04T06:00:00.000Z',
          ot_requested: true,
          ot_status: 'pending'
        }),
        now
      )
    ).toBe(false)
    expect(
      canRequestOt(
        shift({
          clock_in_at: '2026-11-04T06:00:00.000Z',
          ot_requested: true,
          ot_status: 'declined'
        }),
        now
      )
    ).toBe(true)
  })

  it('formats hours for the attendance table', () => {
    expect(formatHours(9)).toBe('9.00h')
    expect(formatHours(1.25)).toBe('1.25h')
    expect(formatHours(null)).toBe('—')
  })
})

describe('status copy', () => {
  it('tells staff when they are waiting, approved, or declined', () => {
    expect(clockStatusCopy(null)).toBe('Not clocked in')
    expect(clockStatusCopy(shift({ clock_in_status: 'pending' }))).toBe(
      'Clocked in · waiting for approval'
    )
    expect(clockStatusCopy(shift({ clock_in_status: 'approved' }))).toBe('Clocked in · approved')
    expect(clockStatusCopy(shift({ clock_in_status: 'declined' }))).toBe(
      'Clock-in declined · you can clock in again'
    )
    expect(
      clockStatusCopy(
        shift({
          clock_in_status: 'approved',
          clock_out_at: '2026-11-04T14:00:00.000Z',
          clock_out_status: 'pending'
        })
      )
    ).toBe('Clocked out · waiting for approval')
    expect(
      clockStatusCopy(
        shift({
          clock_in_status: 'approved',
          clock_out_at: '2026-11-04T14:00:00.000Z',
          clock_out_status: 'declined'
        })
      )
    ).toBe('Clock-out declined · still on the clock')
  })
})

describe('typed times', () => {
  it('requires out after in', () => {
    const ok = validateShiftTimes(
      '2026-11-04T06:00:00.000Z',
      '2026-11-04T14:00:00.000Z'
    )
    expect(ok.ok).toBe(true)
    const bad = validateShiftTimes(
      '2026-11-04T14:00:00.000Z',
      '2026-11-04T06:00:00.000Z'
    )
    expect(bad.ok).toBe(false)
  })

  it('round-trips Manila datetime-local (UTC+8)', () => {
    const iso = '2026-11-04T06:00:00.000Z'
    expect(toManilaDateTimeLocal(iso)).toBe('2026-11-04T14:00')
    expect(fromManilaDateTimeLocal('2026-11-04T14:00')).toBe(iso)
    expect(formatManilaClock(iso)).toMatch(/2:00\s?PM/i)
  })
})

describe('errorMessage', () => {
  it('reads message from Error and from supabase-style objects', () => {
    expect(errorMessage(new Error('table missing'), 'fallback')).toBe('table missing')
    expect(errorMessage({ message: 'relation does not exist' }, 'fallback')).toBe(
      'relation does not exist'
    )
    expect(errorMessage(null, 'fallback')).toBe('fallback')
  })
})

describe('selfie size', () => {
  it('caps the long side at 720 and leaves small photos alone', () => {
    expect(SELFIE_MAX_SIDE).toBe(720)
    expect(selfieTargetSize(1920, 1080)).toEqual({ width: 720, height: 405 })
    expect(selfieTargetSize(400, 400)).toEqual({ width: 400, height: 400 })
    expect(selfieTargetSize(720, 2000)).toEqual({ width: 259, height: 720 })
  })
})
