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
    const inInput = document.querySelector('[data-testid="clock-in-time"]') as HTMLInputElement
    const outInput = document.querySelector('[data-testid="clock-out-time"]') as HTMLInputElement
    expect(inInput.value).toBe('2026-11-04T14:00')
    outInput.value = '2026-11-04T22:00'
    outInput.dispatchEvent(new Event('input'))
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
    const { app } = mountModal({ isOpen: true, mode: 'add' })
    await nextTick()
    expect(document.querySelector('[data-testid="clock-staff"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="clock-edit-modal"]')?.textContent).toMatch(
      /missed punch/i
    )
    app.unmount()
  })
})
