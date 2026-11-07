/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest'
import { renderPayrollSummaryPng } from '../../src/modules/staff/payrollSummaryImage'

describe('payroll summary image', () => {
  it('places the week beside the name, the payable under the deduction, and the balance under what was paid', async () => {
    const drawn: string[] = []
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get(_target, prop) {
        if (prop === 'fillText') {
          return (text: string, x: number, y: number) => drawn.push(`${text}@${x},${y}`)
        }
        if (prop === 'measureText') return () => ({ width: 10 })
        return () => undefined
      },
      set() {
        return true
      }
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback?.(new Blob([Uint8Array.from([137])], { type: 'image/png' }))
    })
    class FakeImage {
      onerror: (() => void) | null = null
      set src(_value: string) {
        this.onerror?.()
      }
    }
    vi.stubGlobal('Image', FakeImage)

    const blob = await renderPayrollSummaryPng(
      {
        staffName: 'Shai',
        weekLabel: 'Oct 31 – Nov 6',
        days: 1,
        regularPay: '₱500.00',
        otHours: '0.00 h',
        otPay: '₱0.00',
        compensationLines: [],
        compensation: '₱0.00',
        loans: [{ label: 'Cash advance', amount: '₱1000.00' }],
        deduction: '₱1000.00',
        netPay: '-₱500.00',
        paymentLines: [{ label: 'Nov 7', amount: '₱200.00' }],
        paid: '₱200.00',
        balance: '-₱700.00'
      },
      'logo.png'
    )

    expect(blob.type).toBe('image/png')
    const placed = (label: string) => {
      const line = drawn.find((entry) => entry.startsWith(`${label}@`))
      const [x, y] = line?.split('@')[1].split(',').map(Number) ?? []
      return { x, y }
    }
    const name = placed('Shai')
    const week = placed('Oct 31 – Nov 6')
    expect(week.x).toBeGreaterThan(name.x)
    expect(Math.abs(week.y - name.y)).toBeLessThan(24)
    expect(drawn.some((entry) => entry.startsWith('Loans@'))).toBe(false)
    expect(placed('Cash advance').y).toBeGreaterThan(placed('Deduction').y)
    expect(placed('Cash advance').x).toBeGreaterThan(placed('Deduction').x)
    expect(placed('Paid').y).toBeGreaterThan(placed('Net pay').y)
    expect(placed('Nov 7').y).toBeGreaterThan(placed('Paid').y)
    expect(placed('Balance').y).toBeGreaterThan(placed('Nov 7').y)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
})
