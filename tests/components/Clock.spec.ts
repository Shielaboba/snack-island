/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import Clock from '../../src/components/Clock.vue'
import type { StaffClockShift } from '../../src/models/StaffClock'

const list = vi.fn(async (): Promise<StaffClockShift[]> => [])
const clockIn = vi.fn()
const clockOut = vi.fn()
const requestOt = vi.fn()

vi.mock('../../src/services/staffClockService', () => ({
  staffClockService: {
    list: (...args: unknown[]) => list(...args),
    clockIn: (...args: unknown[]) => clockIn(...args),
    clockOut: (...args: unknown[]) => clockOut(...args),
    requestOt: (...args: unknown[]) => requestOt(...args)
  }
}))

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: () => ({ id: '3', username: 'staff', roleId: 1 })
  }
}))

function openShift(partial: Partial<StaffClockShift> = {}): StaffClockShift {
  return {
    id: 's1',
    staff_name: 'Shai',
    clock_in_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    clock_out_at: null,
    clock_in_photo_path: 'p',
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial
  }
}

function mountPage() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp(Clock)
  app.mount(el)
  return { el, app }
}

describe('Clock.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    list.mockReset()
    clockIn.mockReset()
    clockOut.mockReset()
    requestOt.mockReset()
    list.mockResolvedValue([])
    requestOt.mockResolvedValue(openShift({ ot_requested: true, ot_status: 'pending' }))
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lets staff pick Shai or Den and shows Clock in when not on the clock', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const select = el.querySelector('[data-testid="clock-staff"]') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['Shai', 'Den'])
    expect(el.querySelector('[data-testid="clock-in-btn"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="clock-out-btn"]')).toBeNull()
    expect(el.textContent).not.toMatch(/overtime/i)
    app.unmount()
  })

  it('shows only Clock out when that person is open', async () => {
    list.mockResolvedValue([openShift()])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="clock-out-btn"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="clock-in-btn"]')).toBeNull()
    expect(el.querySelector('[data-testid="request-ot-btn"]')).toBeNull()
    expect(el.textContent).toMatch(/waiting for approval/i)
    app.unmount()
  })

  it('opens camera capture after Clock in, with capture on the right', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="clock-in-btn"]') as HTMLButtonElement).click()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="clock-capture-btn"]')?.textContent).toMatch(
      /Capture clock in/i
    )
    expect(el.querySelector('[data-testid="clock-camera"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="clock-in-btn"]')).toBeNull()
    const layout = el.querySelector('[data-testid="clock-capture-layout"]') as HTMLElement
    expect(layout.className).toMatch(/capture-layout/)
    app.unmount()
  })

  it('keeps Clock out and approved status after a declined punch then a new approved in', async () => {
    list.mockResolvedValue([
      openShift({
        id: 'declined',
        clock_in_at: '2026-11-04T08:00:00.000Z',
        clock_in_status: 'declined'
      }),
      openShift({
        id: 'open',
        clock_in_at: '2026-11-04T07:05:00.000Z',
        clock_in_status: 'approved'
      })
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="clock-out-btn"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="clock-in-btn"]')).toBeNull()
    expect(el.querySelector('[data-testid="clock-status"]')?.textContent).toBe(
      'Clocked in · approved'
    )
    expect(el.textContent).not.toMatch(/Clock-in declined/i)
    app.unmount()
  })

  it('lets them clock in again after a declined in', async () => {
    list.mockResolvedValue([openShift({ clock_in_status: 'declined' })])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="clock-in-btn"]')).not.toBeNull()
    expect(el.textContent).toMatch(/you can clock in again/i)
    app.unmount()
  })

  it('hides Request OT before 10:00 PM when they started at 2:00 PM', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-04T13:59:00.000Z'))
    list.mockResolvedValue([openShift({ clock_in_at: '2026-11-04T06:00:00.000Z' })])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="request-ot-btn"]')).toBeNull()
    expect(el.querySelector('[data-testid="clock-out-btn"]')).not.toBeNull()
    app.unmount()
    vi.useRealTimers()
  })

  it('shows Request OT when they clocked in before 2:00 PM', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-04T05:00:00.000Z'))
    list.mockResolvedValue([openShift({ clock_in_at: '2026-11-04T04:00:00.000Z' })])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="request-ot-btn"]')).not.toBeNull()
    app.unmount()
    vi.useRealTimers()
  })

  it('shows Request OT after 10:00 PM Manila and keeps Clock out', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-04T14:00:00.000Z'))
    list.mockResolvedValue([openShift({ clock_in_at: '2026-11-04T06:00:00.000Z' })])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="request-ot-btn"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="clock-out-btn"]')).not.toBeNull()
    app.unmount()
    vi.useRealTimers()
  })

  it('keeps time running after requesting OT while waiting for approval', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-04T14:05:00.000Z'))
    const clockInAt = '2026-11-04T06:00:00.000Z'
    list.mockResolvedValue([openShift({ clock_in_at: clockInAt })])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    list.mockResolvedValue([
      openShift({
        clock_in_at: clockInAt,
        ot_requested: true,
        ot_status: 'pending'
      })
    ])
    ;(el.querySelector('[data-testid="request-ot-btn"]') as HTMLButtonElement).click()
    await Promise.resolve()
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(requestOt).toHaveBeenCalled()
    expect(el.querySelector('[data-testid="request-ot-btn"]')).toBeNull()
    expect(el.querySelector('[data-testid="clock-out-btn"]')).not.toBeNull()
    expect(el.textContent).toMatch(/OT requested · waiting for approval/i)
    expect(el.textContent).toMatch(/on the clock/i)
    app.unmount()
    vi.useRealTimers()
  })

  it('asks about OT at clock-out when they already have 2 extra hours', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-04T14:00:00.000Z'))
    list.mockResolvedValue([openShift({ clock_in_at: '2026-11-04T04:00:00.000Z' })])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="clock-out-btn"]') as HTMLButtonElement).click()
    await nextTick()
    expect(el.querySelector('[data-testid="clock-ot-prompt"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="clock-camera"]')).toBeNull()
    app.unmount()
    vi.useRealTimers()
  })

  it('requests OT then opens the camera from the clock-out prompt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T14:00:00.000Z'))
    list.mockResolvedValue([openShift({ clock_in_at: '2026-11-04T04:00:00.000Z' })])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="clock-out-btn"]') as HTMLButtonElement).click()
    await nextTick()
    list.mockResolvedValue([
      openShift({
        clock_in_at: '2026-11-04T04:00:00.000Z',
        ot_requested: true,
        ot_status: 'pending'
      })
    ])
    ;(el.querySelector('[data-testid="clock-ot-prompt-yes"]') as HTMLButtonElement).click()
    await vi.waitFor(() => {
      expect(requestOt).toHaveBeenCalled()
      expect(el.querySelector('[data-testid="clock-ot-prompt"]')).toBeNull()
      expect(el.querySelector('[data-testid="clock-camera"]')).not.toBeNull()
    })
    app.unmount()
    vi.useRealTimers()
  })
  it('keeps the on-the-clock time ticking', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-04T07:00:00.000Z'))
    list.mockResolvedValue([openShift({ clock_in_at: '2026-11-04T06:00:00.000Z' })])
    const { el, app } = mountPage()
    await vi.waitFor(() => expect(el.textContent).toMatch(/1h 0m on the clock/))
    vi.advanceTimersByTime(5 * 60 * 1000)
    await nextTick()
    expect(el.textContent).toMatch(/1h 5m on the clock/)
    app.unmount()
  })

  it('stops a camera that opens after staff switched names', async () => {
    const stop = vi.fn()
    let resolveCamera: (value: unknown) => void = () => {}
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveCamera = resolve
      })
    )
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="clock-in-btn"]') as HTMLButtonElement).click()
    await nextTick()
    const select = el.querySelector('[data-testid="clock-staff"]') as HTMLSelectElement
    select.value = 'Den'
    select.dispatchEvent(new Event('change'))
    await nextTick()
    resolveCamera({ getTracks: () => [{ stop }] })
    await vi.waitFor(() => expect(stop).toHaveBeenCalled())
    app.unmount()
  })
})
