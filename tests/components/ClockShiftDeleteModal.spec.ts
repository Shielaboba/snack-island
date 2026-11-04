/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest'
import { createApp, nextTick } from 'vue'
import ClockShiftDeleteModal from '../../src/components/ClockShiftDeleteModal.vue'
import type { StaffClockShift } from '../../src/models/StaffClock'

const shift: StaffClockShift = {
  id: 's1',
  staff_name: 'Shai',
  clock_in_at: '2026-11-04T06:00:00.000Z',
  clock_out_at: '2026-11-04T14:00:00.000Z',
  clock_in_photo_path: 'p',
  clock_out_photo_path: 'p2',
  clock_in_status: 'approved',
  clock_out_status: 'approved',
  clock_in_override: false,
  clock_out_override: false,
  created_by: 'staff',
  updated_by: null,
  created_at: '2026-11-04T06:00:00.000Z',
  updated_at: '2026-11-04T14:00:00.000Z'
}

function mountModal(props: Record<string, unknown>) {
  const el = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(el)
  let confirmed = false
  const app = createApp(ClockShiftDeleteModal, {
    ...props,
    onConfirm: () => {
      confirmed = true
    }
  })
  app.mount(el)
  return { app, wasConfirmed: () => confirmed }
}

describe('ClockShiftDeleteModal', () => {
  it('names the person and warns that photos are removed', async () => {
    const { app, wasConfirmed } = mountModal({
      isOpen: true,
      shift,
      deleting: false,
      error: ''
    })
    await nextTick()
    const modal = document.querySelector('[data-testid="clock-delete-modal"]')
    expect(modal?.textContent).toContain('Shai')
    expect(modal?.textContent).toMatch(/cannot be undone/i)
    ;(document.querySelector('[data-testid="clock-delete-confirm"]') as HTMLButtonElement).click()
    expect(wasConfirmed()).toBe(true)
    app.unmount()
  })
})
