/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest'
import { createApp, nextTick } from 'vue'
import ClockPhotoModal from '../../src/components/ClockPhotoModal.vue'

function mountModal(props: Record<string, unknown>) {
  const el = document.createElement('div')
  document.body.innerHTML = ''
  document.body.appendChild(el)
  let closed = false
  const app = createApp(ClockPhotoModal, {
    ...props,
    onClose: () => {
      closed = true
    }
  })
  app.mount(el)
  return { app, wasClosed: () => closed }
}

describe('ClockPhotoModal', () => {
  it('is hidden when closed', async () => {
    const { app } = mountModal({ isOpen: false, src: '', title: 'In photo' })
    await nextTick()
    expect(document.querySelector('[data-testid="clock-photo-modal"]')).toBeNull()
    app.unmount()
  })

  it('shows a centered image when open', async () => {
    const { app, wasClosed } = mountModal({
      isOpen: true,
      src: 'https://cdn.example/in.jpg',
      title: 'Shai clock in'
    })
    await nextTick()
    const modal = document.querySelector('[data-testid="clock-photo-modal"]') as HTMLElement
    expect(modal.className).toMatch(/modal-overlay/)
    expect(modal.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/in.jpg')
    expect(modal.textContent).toContain('Shai clock in')
    ;(document.querySelector('[data-testid="clock-photo-close"]') as HTMLButtonElement).click()
    expect(wasClosed()).toBe(true)
    app.unmount()
  })
})
