/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest'
import { createApp, nextTick, reactive } from 'vue'
import DateField from '../../src/components/DateField.vue'

function mountField(day = '2026-11-06') {
  const state = reactive({ day })
  const el = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(el)
  const app = createApp({
    components: { DateField },
    setup() {
      return { state }
    },
    template: `<DateField v-model="state.day" test-id="sample-date" aria-label="Start" />`
  })
  app.mount(el)
  return { el, app, state }
}

describe('DateField', () => {
  it('opens a month calendar and selects a day', async () => {
    const { app, state } = mountField()
    await nextTick()
    ;(document.querySelector('[data-testid="sample-date-open"]') as HTMLButtonElement).click()
    await nextTick()
    const calendar = document.querySelector('[data-testid="date-calendar"]')
    expect(calendar).not.toBeNull()
    expect(calendar?.textContent).toContain('November 2026')
    expect(calendar?.querySelectorAll('[data-date]').length).toBe(30)
    ;(calendar?.querySelector('[data-date="2026-11-13"]') as HTMLButtonElement).click()
    await nextTick()
    expect(state.day).toBe('2026-11-13')
    expect(document.querySelector('[data-testid="date-calendar"]')).toBeNull()
    expect(document.querySelector('[data-testid="sample-date-open"]')?.textContent).toMatch(/Nov 13, 2026/)
    app.unmount()
  })

  it('moves to the next month before choosing a day', async () => {
    const { app, state } = mountField()
    await nextTick()
    ;(document.querySelector('[data-testid="sample-date-open"]') as HTMLButtonElement).click()
    await nextTick()
    ;(document.querySelector('[data-testid="date-next"]') as HTMLButtonElement).click()
    await nextTick()
    const calendar = document.querySelector('[data-testid="date-calendar"]')
    expect(calendar?.textContent).toContain('December 2026')
    ;(calendar?.querySelector('[data-date="2026-12-01"]') as HTMLButtonElement).click()
    await nextTick()
    expect(state.day).toBe('2026-12-01')
    app.unmount()
  })

  it('still accepts a date set on the input', async () => {
    const { app, state } = mountField()
    await nextTick()
    const input = document.querySelector('[data-testid="sample-date"]') as HTMLInputElement
    input.value = '2026-12-01'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(state.day).toBe('2026-12-01')
    expect(document.querySelector('[data-testid="sample-date-open"]')?.textContent).toMatch(/Dec 1, 2026/)
    app.unmount()
  })
})
