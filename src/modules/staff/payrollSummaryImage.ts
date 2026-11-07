import type { PayrollSummaryInput } from './staffProfile'

const WIDTH = 880
const FONT = 'system-ui, sans-serif'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timer = setTimeout(() => reject(new Error('logo')), 400)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('logo'))
    }
    img.src = src
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

type SummaryLine = { label: string; value: string; sub?: boolean }

function summaryRows(input: PayrollSummaryInput): SummaryLine[] {
  return [
    { label: 'Working Days', value: String(input.days) },
    { label: 'Regular', value: input.regularPay },
    { label: 'OT hours', value: input.otHours },
    { label: 'OT pay', value: input.otPay },
    { label: 'Compensation', value: input.compensation },
    ...input.compensationLines.map((row) => ({ label: row.label, value: row.amount, sub: true })),
    { label: 'Deduction', value: input.deduction },
    ...input.loans.map((loan) => ({ label: loan.label, value: loan.amount, sub: true }))
  ]
}

export async function renderPayrollSummaryPng(
  input: PayrollSummaryInput,
  logoSrc: string
): Promise<Blob> {
  const rows = summaryRows(input)
  const headerH = 150
  const rowH = 56
  const tail = [
    { label: 'Paid', value: input.paid, sub: false },
    ...input.paymentLines.map((row) => ({ label: row.label, value: row.amount, sub: true })),
    { label: 'Balance', value: input.balance, sub: false }
  ]
  const height = 250 + rows.length * rowH + 130 + tail.length * rowH
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported on this device')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, height)
  ctx.fillStyle = '#0e3b2e'
  ctx.fillRect(0, 0, WIDTH, headerH)

  try {
    const logo = await loadImage(logoSrc)
    ctx.drawImage(logo, 36, 36, 78, 78)
  } catch {
    // The slip still downloads if the logo cannot be read.
  }

  ctx.textBaseline = 'top'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 36px ${FONT}`
  ctx.fillText('Snack Island', 132, 44)
  ctx.fillStyle = '#ffb800'
  ctx.font = `700 18px ${FONT}`
  ctx.fillText('PAYROLL', 132, 90)

  const nameY = headerH + 48
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#0e3b2e'
  ctx.font = `700 40px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText(input.staffName, 36, nameY)
  ctx.fillStyle = '#6b7280'
  ctx.font = `400 22px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(input.weekLabel, WIDTH - 36, nameY)

  ctx.textBaseline = 'top'
  rows.forEach((row, index) => {
    const y = 250 + index * rowH
    const labelX = row.sub ? 64 : 36
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(labelX, y + 40, WIDTH - 36 - labelX, 1)
    ctx.font = row.sub ? `500 20px ${FONT}` : `500 24px ${FONT}`
    ctx.fillStyle = row.sub ? '#6b7280' : '#374151'
    ctx.textAlign = 'left'
    ctx.fillText(row.label, labelX, y)
    ctx.font = row.sub ? `600 20px ${FONT}` : `700 24px ${FONT}`
    ctx.fillStyle = row.sub ? '#374151' : '#1f2937'
    ctx.textAlign = 'right'
    ctx.fillText(row.value, WIDTH - 36, y)
  })

  const netY = 250 + rows.length * rowH + 20
  ctx.fillStyle = '#e7f3ee'
  roundRect(ctx, 36, netY, WIDTH - 72, 72, 16)
  ctx.fill()
  ctx.textBaseline = 'middle'
  ctx.font = `500 24px ${FONT}`
  ctx.fillStyle = '#374151'
  ctx.textAlign = 'left'
  ctx.fillText('Net pay', 56, netY + 36)
  ctx.font = `700 32px ${FONT}`
  ctx.fillStyle = '#0e3b2e'
  ctx.textAlign = 'right'
  ctx.fillText(input.netPay, WIDTH - 56, netY + 36)

  ctx.textBaseline = 'top'
  tail.forEach((row, index) => {
    const y = netY + 100 + index * rowH
    const labelX = row.sub ? 64 : 36
    ctx.font = row.sub ? `500 20px ${FONT}` : `500 24px ${FONT}`
    ctx.fillStyle = row.sub ? '#6b7280' : '#374151'
    ctx.textAlign = 'left'
    ctx.fillText(row.label, labelX, y)
    ctx.font = row.sub ? `600 20px ${FONT}` : `700 24px ${FONT}`
    ctx.fillStyle = row.sub ? '#374151' : '#1f2937'
    ctx.textAlign = 'right'
    ctx.fillText(row.value, WIDTH - 36, y)
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not create the payroll image'))),
      'image/png'
    )
  })
}
