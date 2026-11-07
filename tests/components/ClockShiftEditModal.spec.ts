/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest'
import { createApp, nextTick } from 'vue'
import ClockShiftEditModal from '../../src/components/ClockShiftEditModal.vue'
import type { StaffClockShift } from '../../src/models/StaffClock'

const shift: StaffClockShift = {
  id: 's1',
  staff_name: 'Den',
  clock_in_at: '2026-11-04T06:00:00.000Z',
  clock_out_at: null,
  clock_in_photo_path: null,
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
  updated_at: '2026-11-04T06:00:00.000Z'
}

function mountModal(props: Record<string, unknown>) {
  const el = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(el)
  let submitted: unknown = null
  const app = createApp(ClockShiftEditModal, {
    ...props,
    onSubmit: (value: unknown) => {
      submitted = value
    }
  })
  app.mount(el)
  return { app, getSubmitted: () => submitted }
}

describe('ClockShiftEditModal', () => {
  it('edits typed in/out times for an existing shift', async () => {
    const { app, getSubmitted } = mountModal({ isOpen: true, mode: 'edit', shift })
    await nextTick()
    const inDate = document.querySelector('[data-testid="clock-in-date"]') as HTMLInputElement
    const inTime = document.querySelector('[data-testid="clock-in-clock"]') as HTMLInputElement
    const outDate = document.querySelector('[data-testid="clock-out-date"]') as HTMLInputElement
    const outTime = document.querySelector('[data-testid="clock-out-clock"]') as HTMLInputElement
    expect(inDate.value).toBe('2026-11-04')
    expect(inTime.value).toBe('14:00')
    expect(document.querySelector('[data-testid="clock-ot-hours"]')).toBeNull()
    ;(document.querySelector('[data-testid="clock-in-date-open"]') as HTMLButtonElement).click()
    await nextTick()
    expect(document.querySelector('[data-testid="date-calendar"]')).not.toBeNull()
    ;(document.querySelector('[data-testid="date-calendar"] [data-date="2026-11-04"]') as HTMLButtonElement).click()
    await nextTick()
    outDate.value = '2026-11-04'
    outDate.dispatchEvent(new Event('input'))
    outTime.value = '22:00'
    outTime.dispatchEvent(new Event('input'))
    await nextTick()
    ;(document.querySelector('[data-testid="clock-edit-save"]') as HTMLButtonElement).click()
    await nextTick()
    expect(getSubmitted()).toEqual(
      expect.objectContaining({
        clock_in_at: '2026-11-04T06:00:00.000Z',
        clock_out_at: '2026-11-04T14:00:00.000Z'
      })
    )
    app.unmount()
  })

  it('add missed punch requires a staff name and both times', async () => {
    const { app, getSubmitted } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    expect(document.querySelector('[data-testid="clock-staff"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="clock-edit-modal"]')?.textContent).toMatch(
      /missed punch/i
    )
    expect((document.querySelector('[data-testid="clock-in-clock"]') as HTMLInputElement).value).toBe('14:00')
    expect((document.querySelector('[data-testid="clock-out-clock"]') as HTMLInputElement).value).toBe('22:00')
    const inDate = (document.querySelector('[data-testid="clock-in-date"]') as HTMLInputElement).value
    const outDate = (document.querySelector('[data-testid="clock-out-date"]') as HTMLInputElement).value
    expect(inDate).toBe(outDate)
    expect(inDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const ot = document.querySelector('[data-testid="clock-ot-hours"]') as HTMLInputElement
    expect(ot.value).toBe('0')
    ot.value = '2'
    ot.dispatchEvent(new Event('input'))
    await nextTick()
    ;(document.querySelector('[data-testid="clock-edit-save"]') as HTMLButtonElement).click()
    await nextTick()
    expect(getSubmitted()).toEqual(expect.objectContaining({ ot_hours: 2 }))
    app.unmount()
  })

  it('does not submit a missed punch with overtime below the paid minimum', async () => {
    const { app, getSubmitted } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    const ot = document.querySelector('[data-testid="clock-ot-hours"]') as HTMLInputElement
    ot.value = '1'
    ot.dispatchEvent(new Event('input'))
    await nextTick()
    ;(document.querySelector('[data-testid="clock-edit-save"]') as HTMLButtonElement).click()
    await nextTick()
    expect(getSubmitted()).toBeNull()
    expect(document.querySelector('[data-testid="clock-edit-modal"]')?.textContent).toMatch(/at least 2 hours/)
    app.unmount()
  })
})
