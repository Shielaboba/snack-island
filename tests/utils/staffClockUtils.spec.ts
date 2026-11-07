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
  activeShiftFor,
  isOpenShift,
  nextClockAction,
  openShiftFor,
  MIN_OT_HOURS,
  canRecordOt,
  canRequestOt,
  isEarlyClockIn,
  overtimeHours,
  clockOutCoveringOvertime,
  missedPunchOtError,
  recordedOvertimeHours,
  shouldPromptOtOnClockOut,
  validateRecordOt,
  validateRequestOt,
  selfieTargetSize,
  shiftHours,
  toManilaDateTimeLocal,
  validateClockIn,
  validateClockOut,
  validateShiftTimes,
  findOverlappingShift,
  reflectedPunch
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

  it('uses the open shift for status even if a declined punch is newer', () => {
    const declined = shift({
      id: 'declined',
      clock_in_at: '2026-11-04T08:00:00.000Z',
      clock_in_status: 'declined'
    })
    const open = shift({
      id: 'open',
      clock_in_at: '2026-11-04T07:00:00.000Z',
      clock_in_status: 'approved'
    })
    expect(activeShiftFor('Shai', [declined, open])?.id).toBe('open')
    expect(clockStatusCopy(activeShiftFor('Shai', [declined, open]))).toBe(
      'Clocked in · approved'
    )
    expect(nextClockAction('Shai', [declined, open])).toBe('clock_out')
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

  it('extends a missed punch clock-out so the typed overtime hours are on the shift', () => {
    expect(
      clockOutCoveringOvertime('2026-11-04T06:00:00.000Z', '2026-11-04T14:00:00.000Z', 2)
    ).toBe('2026-11-04T16:00:00.000Z')
    expect(
      clockOutCoveringOvertime('2026-11-04T06:00:00.000Z', '2026-11-04T18:00:00.000Z', 2)
    ).toBe('2026-11-04T18:00:00.000Z')
    expect(
      clockOutCoveringOvertime('2026-11-04T06:00:00.000Z', '2026-11-04T14:00:00.000Z', 0)
    ).toBe('2026-11-04T14:00:00.000Z')
  })

  it('counts a requested clock-out from 11:30 PM through midnight as the 2-hour half-pay block', () => {
    const half = shift({
      clock_in_at: '2026-11-04T06:00:00.000Z',
      clock_out_at: '2026-11-04T15:30:00.000Z',
      clock_out_status: 'approved',
      ot_requested: true,
      ot_status: 'pending'
    })
    expect(shiftHours(half)).toBe(9.5)
    expect(recordedOvertimeHours(half)).toBe(2)
    const lateStart = shift({
      clock_in_at: '2026-11-04T06:20:00.000Z',
      clock_out_at: '2026-11-04T16:00:00.000Z',
      clock_out_status: 'approved',
      ot_requested: true,
      ot_status: 'approved'
    })
    expect(recordedOvertimeHours(lateStart)).toBe(2)
    const beforeWindow = shift({
      clock_in_at: '2026-11-04T06:00:00.000Z',
      clock_out_at: '2026-11-04T15:29:00.000Z',
      clock_out_status: 'approved',
      ot_requested: true,
      ot_status: 'pending'
    })
    expect(recordedOvertimeHours(beforeWindow)).toBeNull()
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

  it('lets staff request OT after 10:00 PM or if they clocked in before 2:00 PM', () => {
    const onSchedule = shift({ clock_in_at: '2026-11-04T06:00:00.000Z' })
    expect(isEarlyClockIn(onSchedule.clock_in_at)).toBe(false)
    expect(canRequestOt(onSchedule, new Date('2026-11-04T13:59:00.000Z'))).toBe(false)
    expect(canRequestOt(onSchedule, new Date('2026-11-04T14:00:00.000Z'))).toBe(true)
    expect(canRequestOt(onSchedule, new Date('2026-11-04T17:00:00.000Z'))).toBe(true)
    const early = shift({ clock_in_at: '2026-11-04T04:00:00.000Z' })
    expect(isEarlyClockIn(early.clock_in_at)).toBe(true)
    expect(canRequestOt(early, new Date('2026-11-04T05:00:00.000Z'))).toBe(true)
    expect(validateRequestOt('Shai', [early], new Date('2026-11-04T05:00:00.000Z')).ok).toBe(true)
    expect(
      canRequestOt(
        shift({
          clock_in_at: '2026-11-04T06:00:00.000Z',
          ot_requested: true,
          ot_status: 'pending'
        }),
        new Date('2026-11-04T14:00:00.000Z')
      )
    ).toBe(false)
    expect(
      canRequestOt(
        shift({
          clock_in_at: '2026-11-04T06:00:00.000Z',
          ot_requested: true,
          ot_status: 'declined'
        }),
        new Date('2026-11-04T14:00:00.000Z')
      )
    ).toBe(true)
  })

  it('prompts at clock-out when extra time is already 2 hours and OT was not requested', () => {
    const extra = shift({
      clock_in_at: '2026-11-04T04:00:00.000Z'
    })
    expect(shouldPromptOtOnClockOut(extra, new Date('2026-11-04T14:00:00.000Z'))).toBe(true)
    expect(shouldPromptOtOnClockOut(extra, new Date('2026-11-04T10:00:00.000Z'))).toBe(false)
    expect(
      shouldPromptOtOnClockOut(
        shift({
          clock_in_at: '2026-11-04T04:00:00.000Z',
          ot_requested: true,
          ot_status: 'pending'
        }),
        new Date('2026-11-04T14:00:00.000Z')
      )
    ).toBe(false)
  })

  it('lets admin or auditor record OT when staff did not request it', () => {
    const earlyClosed = shift({
      clock_in_at: '2026-11-04T04:00:00.000Z',
      clock_out_at: '2026-11-04T14:00:00.000Z',
      clock_out_status: 'approved'
    })
    expect(canRecordOt(earlyClosed, new Date('2026-11-05T01:00:00.000Z'))).toBe(true)
    const regular = shift({
      clock_in_at: '2026-11-04T06:00:00.000Z',
      clock_out_at: '2026-11-04T14:00:00.000Z',
      clock_out_status: 'approved'
    })
    expect(canRecordOt(regular, new Date('2026-11-05T01:00:00.000Z'))).toBe(false)
    const lateClosed = shift({
      clock_in_at: '2026-11-04T06:00:00.000Z',
      clock_out_at: '2026-11-04T16:00:00.000Z',
      clock_out_status: 'approved'
    })
    expect(canRecordOt(lateClosed)).toBe(true)
    expect(
      canRecordOt(
        shift({
          clock_in_at: '2026-11-04T04:00:00.000Z',
          ot_requested: true,
          ot_status: 'approved'
        })
      )
    ).toBe(false)
    expect(validateRecordOt(earlyClosed).ok).toBe(true)
    expect(validateRecordOt(regular, new Date('2026-11-05T01:00:00.000Z')).ok).toBe(false)
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

describe('reflected punch display', () => {
  const earlyIn = '2026-11-04T04:00:00.000Z'
  const lateOut = '2026-11-04T14:40:00.000Z'
  const earlyOut = '2026-11-04T09:55:00.000Z'

  it('shows 2:00 PM and 10:00 PM when there is no active OT and the punch is outside the shift', () => {
    const view = reflectedPunch(
      shift({
        clock_in_at: earlyIn,
        clock_out_at: lateOut,
        clock_out_status: 'approved'
      })
    )
    expect(view.inLabel).toMatch(/2:00\s?PM/i)
    expect(view.outLabel).toMatch(/10:00\s?PM/i)
    expect(view.inCaptured).toMatch(/12:00\s?PM/i)
    expect(view.outCaptured).toMatch(/10:40\s?PM/i)
    expect(view.hours).toBe(8)

    const beforeTen = reflectedPunch(
      shift({
        clock_in_at: earlyIn,
        clock_out_at: earlyOut,
        clock_out_status: 'approved'
      })
    )
    expect(beforeTen.inLabel).toMatch(/2:00\s?PM/i)
    expect(beforeTen.outLabel).toMatch(/5:55\s?PM/i)
    expect(beforeTen.outCaptured).toBeNull()
    expect(beforeTen.hours).toBe(3.92)
  })

  it('keeps captured times while OT is waiting or approved, and reflects again when OT is declined', () => {
    const waiting = reflectedPunch(
      shift({
        clock_in_at: earlyIn,
        clock_out_at: lateOut,
        clock_out_status: 'approved',
        ot_requested: true,
        ot_status: 'pending'
      })
    )
    expect(waiting.inLabel).toMatch(/12:00\s?PM/i)
    expect(waiting.outLabel).toMatch(/10:40\s?PM/i)
    expect(waiting.inCaptured).toBeNull()
    expect(waiting.hours).toBe(10.67)

    const declined = reflectedPunch(
      shift({
        clock_in_at: earlyIn,
        clock_out_at: lateOut,
        clock_out_status: 'approved',
        ot_requested: true,
        ot_status: 'declined'
      })
    )
    expect(declined.inLabel).toMatch(/2:00\s?PM/i)
    expect(declined.outLabel).toMatch(/10:00\s?PM/i)
    expect(declined.hours).toBe(8)
  })

  it('leaves an on-time clock-in unchanged', () => {
    const view = reflectedPunch(
      shift({
        clock_in_at: '2026-11-04T06:00:00.000Z',
        clock_out_at: '2026-11-04T14:00:00.000Z',
        clock_out_status: 'approved'
      })
    )
    expect(view.inLabel).toMatch(/2:00\s?PM/i)
    expect(view.outLabel).toMatch(/10:00\s?PM/i)
    expect(view.inCaptured).toBeNull()
    expect(view.outCaptured).toBeNull()
    expect(view.hours).toBe(8)
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

describe('findOverlappingShift', () => {
  const closed = shift({ clock_out_at: '2026-11-04T14:00:00.000Z', clock_out_status: 'approved' })

  it('finds a shift that overlaps the typed range', () => {
    expect(
      findOverlappingShift('Shai', '2026-11-04T10:00:00.000Z', '2026-11-04T18:00:00.000Z', [closed])
    ).toBe(closed)
  })

  it('ignores back-to-back shifts, other staff, declined rows, and the row being edited', () => {
    const range = ['2026-11-04T14:00:00.000Z', '2026-11-04T20:00:00.000Z'] as const
    expect(findOverlappingShift('Shai', ...range, [closed])).toBeUndefined()
    expect(findOverlappingShift('Den', '2026-11-04T10:00:00.000Z', null, [closed])).toBeUndefined()
    const declined = shift({ id: 'd', clock_in_status: 'declined' })
    expect(findOverlappingShift('Shai', '2026-11-04T10:00:00.000Z', null, [declined])).toBeUndefined()
    expect(
      findOverlappingShift('Shai', '2026-11-04T07:00:00.000Z', null, [closed], closed.id)
    ).toBeUndefined()
  })

  it('treats an open shift as still running', () => {
    const open = shift({})
    expect(
      findOverlappingShift('Shai', '2026-11-05T06:00:00.000Z', '2026-11-05T14:00:00.000Z', [open])
    ).toBe(open)
  })

  it('rejects missed-punch overtime that would not be paid', () => {
    const inAt = '2026-11-04T06:00:00.000Z' // 2:00 PM Manila
    const outAt = '2026-11-04T14:00:00.000Z' // 10:00 PM Manila
    expect(missedPunchOtError(inAt, outAt, 0)).toBeNull()
    expect(missedPunchOtError(inAt, outAt, 2)).toBeNull()
    expect(missedPunchOtError(inAt, outAt, 1)).toMatch(/at least 2 hours/)
    // 1.5 hours runs to 11:30 PM, which pays the 2-hour minimum.
    expect(missedPunchOtError(inAt, outAt, 1.5)).toBeNull()
    expect(missedPunchOtError(inAt, outAt, -1)).toMatch(/zero or more/)
  })
})
