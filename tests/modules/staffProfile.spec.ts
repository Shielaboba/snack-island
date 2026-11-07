import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STAFF,
  deductionForLoan,
  deductionForPayroll,
  compensationForPayrollRange,
  paymentTotal,
  deductionForPayrollRange,
  loadPayrollView,
  firstPaydayOnOrAfter,
  formatShift,
  isDayOff,
  payrollSummaryHtml,
  payrollSummaryText,
  payrollWeekRange,
  perPayrollDeduction,
  compensationApplies,
  resolvePayrollView
} from '../../src/modules/staff/staffProfile'

describe('staff profiles', () => {
  it('lists Shai and Den on the 2:00 PM to 10:00 PM shift', () => {
    expect(DEFAULT_STAFF.map((row) => row.name)).toEqual(['Shai', 'Den'])
    expect(formatShift(DEFAULT_STAFF[0])).toBe('2:00 PM – 10:00 PM')
    expect(DEFAULT_STAFF[0].payrollWeekday).not.toBe(DEFAULT_STAFF[1].payrollWeekday)
    expect(DEFAULT_STAFF[0].daysOff).toEqual([])
    expect(isDayOff(DEFAULT_STAFF[0], 1)).toBe(false)
  })

  it('splits a loan across weekly payrolls from the first payroll date', () => {
    const loan = {
      id: 'loan-1',
      name: '',
      staffName: 'Shai' as const,
      deductionTotal: 3000,
      payrollCount: 3,
      firstPayrollDate: '2026-11-06'
    }
    expect(perPayrollDeduction(loan)).toBe(1000)
    expect(deductionForLoan(loan, 5, '2026-11-06')).toBe(1000)
    expect(deductionForLoan(loan, 5, '2026-11-13')).toBe(1000)
    expect(deductionForLoan(loan, 5, '2026-11-20')).toBe(1000)
    expect(deductionForLoan(loan, 5, '2026-11-27')).toBe(0)
    expect(deductionForLoan(loan, 5, '2026-11-05')).toBe(0)
  })

  it('starts the deduction on that person’s payday when the chosen date is another weekday', () => {
    const loan = {
      id: 'loan-1',
      name: 'Uniform',
      staffName: 'Den' as const,
      deductionTotal: 500,
      payrollCount: 1,
      firstPayrollDate: '2026-11-06'
    }
    expect(firstPaydayOnOrAfter('2026-11-06', 4)).toBe('2026-11-12')
    expect(firstPaydayOnOrAfter('2026-11-06', 5)).toBe('2026-11-06')
    expect(deductionForLoan(loan, 4, '2026-11-06')).toBe(0)
    expect(deductionForLoan(loan, 4, '2026-11-12')).toBe(500)
  })

  it('puts the remainder on the last payroll', () => {
    const loan = {
      id: 'loan-1',
      name: '',
      staffName: 'Shai' as const,
      deductionTotal: 1000,
      payrollCount: 3,
      firstPayrollDate: '2026-11-06'
    }
    expect(deductionForLoan(loan, 5, '2026-11-06')).toBe(333.33)
    expect(deductionForLoan(loan, 5, '2026-11-13')).toBe(333.33)
    expect(deductionForLoan(loan, 5, '2026-11-20')).toBe(333.34)
  })

  it('adds every loan that is due for that person on that payroll', () => {
    const first = {
      id: 'loan-1',
      name: 'Cash advance',
      staffName: 'Shai' as const,
      deductionTotal: 1000,
      payrollCount: 1,
      firstPayrollDate: '2026-11-06'
    }
    const second = {
      id: 'loan-2',
      name: '',
      staffName: 'Shai' as const,
      deductionTotal: 500,
      payrollCount: 1,
      firstPayrollDate: '2026-11-06'
    }
    const other = { ...second, id: 'loan-3', staffName: 'Den' as const }
    expect(deductionForPayroll([first, second, other], 'Shai', 5, '2026-11-06')).toBe(1500)
    expect(deductionForPayroll([first, second], 'Shai', 5, '2026-11-13')).toBe(0)
  })

  it('writes a payroll summary that can be sent to staff', () => {
    const text = payrollSummaryText({
      staffName: 'Shai',
      weekLabel: 'Oct 31 – Nov 6',
      days: 1,
      regularPay: '₱500.00',
      otHours: '0.00 h',
      otPay: '₱0.00',
      compensationLines: [{ label: 'Gas', amount: '₱150.00' }],
      compensation: '₱150.00',
      loans: [{ label: 'Loan 1', amount: '₱1000.00' }],
      paymentLines: [{ label: 'Nov 7', amount: '₱500.00' }],
      paid: '₱500.00',
      balance: '-₱1000.00',
      deduction: '₱1000.00',
      netPay: '-₱500.00'
    })
    expect(text).toContain('Shai')
    expect(text).toContain('Oct 31 – Nov 6')
    expect(text).toContain('Working Days: 1')
    expect(text).not.toContain('Days off')
    expect(text).toContain('0.00 h')
    expect(text).toContain('-₱500.00')
    expect(text).toContain('Paid: ₱500.00')
    expect(text.indexOf('Balance')).toBeGreaterThan(text.indexOf('Net pay'))
    expect(text.indexOf('Loan 1')).toBeGreaterThan(text.indexOf('Deduction'))
    expect(text).not.toContain('Loans')
    const html = payrollSummaryHtml(
      {
        staffName: 'Shai',
        weekLabel: 'Oct 31 – Nov 6',
        days: 1,
        regularPay: '₱500.00',
        otHours: '0.00 h',
        otPay: '₱0.00',
        compensationLines: [{ label: 'Gas', amount: '₱150.00' }],
        compensation: '₱150.00',
        loans: [{ label: 'Loan 1', amount: '₱1000.00' }],
        paymentLines: [{ label: 'Nov 7', amount: '₱500.00' }],
        paid: '₱500.00',
        balance: '-₱1000.00',
        deduction: '₱1000.00',
        netPay: '-₱500.00'
      },
      'logo.png'
    )
    expect(html).toContain('Snack Island')
    expect(html).toContain('#0e3b2e')
    expect(html).toContain('logo.png')
    expect(html).toContain('Working Days')
    expect(html).not.toContain('Days off')
    expect(html).toContain('-₱500.00')
    expect(html).toContain('class="who"')
    expect(html.indexOf('Loan 1')).toBeGreaterThan(html.indexOf('Deduction'))
    expect(html.indexOf('Balance')).toBeGreaterThan(html.indexOf('Net pay'))
    expect(html).toContain('₱500.00')
    expect(html).not.toContain('>Loans<')
  })

  it('adds compensation on a date that falls inside the payroll range', () => {
    const gas = {
      id: 'compensation-1',
      name: 'Gas',
      staffName: 'Shai' as const,
      amount: 150,
      date: '2026-11-04',
      forever: false
    }
    const later = { ...gas, id: 'compensation-2', name: 'Bonus', amount: 200, date: '2026-11-20' }
    const den = { ...gas, id: 'compensation-3', name: 'Transpo', staffName: 'Den' as const, amount: 80 }
    const always = { ...gas, id: 'compensation-4', name: 'Transpo', amount: 100, date: '', forever: true }
    expect(compensationForPayrollRange([gas, later, den], 'Shai', '2026-10-31', '2026-11-06')).toBe(150)
    expect(compensationForPayrollRange([gas, later], 'Shai', '2026-11-14', '2026-11-20')).toBe(200)
    expect(compensationForPayrollRange([gas], 'Shai', '2026-11-07', '2026-11-06')).toBe(0)
    expect(compensationForPayrollRange([always, gas], 'Shai', '2026-10-31', '2026-11-06')).toBe(250)
    expect(compensationForPayrollRange([always], 'Shai', '2026-12-01', '2026-12-07')).toBe(100)
    expect(compensationForPayrollRange([always], 'Den', '2026-10-31', '2026-11-06')).toBe(0)
  })

  it('counts a payment toward the payroll week it was tagged to', () => {
    const friday = {
      id: 'payment-1',
      staffName: 'Shai' as const,
      amount: 500,
      paidOn: '2026-11-06',
      payrollStart: '2026-10-31',
      payrollEnd: '2026-11-06'
    }
    const saturday = { ...friday, id: 'payment-2', amount: 1000, paidOn: '2026-11-07' }
    const otherWeek = { ...friday, id: 'payment-3', amount: 200, payrollStart: '2026-11-07', payrollEnd: '2026-11-13' }
    const den = { ...friday, id: 'payment-4', staffName: 'Den' as const, amount: 80 }
    expect(paymentTotal([friday, saturday, otherWeek, den], 'Shai', '2026-10-31', '2026-11-06')).toBe(1500)
    expect(paymentTotal([otherWeek], 'Shai', '2026-10-31', '2026-11-06')).toBe(0)
  })

  it('deducts every installment due in the range', () => {
    const loan = {
      id: 'loan-1',
      name: 'Cash advance',
      staffName: 'Shai' as const,
      deductionTotal: 3000,
      payrollCount: 3,
      firstPayrollDate: '2026-11-06'
    }
    expect(deductionForPayrollRange([loan], 'Shai', 5, '2026-10-31', '2026-11-06')).toBe(1000)
    expect(deductionForPayrollRange([loan], 'Shai', 5, '2026-10-31', '2026-11-13')).toBe(2000)
    expect(deductionForPayrollRange([loan], 'Shai', 5, '2026-11-07', '2026-11-12')).toBe(0)
    expect(deductionForPayrollRange([{ ...loan, paid: true }], 'Shai', 5, '2026-10-31', '2026-11-06')).toBe(0)
    expect(deductionForPayroll([{ ...loan, paid: true }], 'Shai', 5, '2026-11-06')).toBe(0)
  })

  it('keeps deductions on paydays before a loan was marked paid', () => {
    const loan = {
      id: 'loan-1',
      name: 'Cash advance',
      staffName: 'Shai' as const,
      deductionTotal: 3000,
      payrollCount: 3,
      firstPayrollDate: '2026-11-06',
      paid: true,
      paidOn: '2026-11-10'
    }
    expect(deductionForPayroll([loan], 'Shai', 5, '2026-11-06')).toBe(1000)
    expect(deductionForPayroll([loan], 'Shai', 5, '2026-11-13')).toBe(0)
  })

  it('applies forever compensation only from its start date', () => {
    const row = {
      id: 'compensation-1',
      name: 'Transpo',
      staffName: 'Shai' as const,
      amount: 100,
      date: '2026-11-07',
      forever: true
    }
    expect(compensationApplies(row, 'Shai', '2026-10-24', '2026-10-30')).toBe(false)
    expect(compensationApplies(row, 'Shai', '2026-11-07', '2026-11-13')).toBe(true)
    expect(compensationApplies(row, 'Shai', '2026-12-05', '2026-12-11')).toBe(true)
    expect(compensationApplies({ ...row, date: '' }, 'Shai', '2026-10-24', '2026-10-30')).toBe(true)
  })

  it('opens the current payroll week when nothing is saved', () => {
    const storage = { getItem: () => null, setItem() {} } as unknown as Storage
    expect(resolvePayrollView([], storage, '2026-12-01')).toEqual({
      staffName: 'Shai',
      startDate: '2026-11-28',
      endDate: '2026-12-04'
    })
  })

  it('reads an older payroll date as the week ending that day', () => {
    const storage = {
      getItem: () => '{"staffName":"Shai","payrollDate":"2026-11-06"}',
      setItem() {}
    } as unknown as Storage
    expect(loadPayrollView(storage)).toEqual({
      staffName: 'Shai',
      startDate: '2026-10-31',
      endDate: '2026-11-06'
    })
  })

  it('counts the seven days ending on the payroll date', () => {
    expect(payrollWeekRange('2026-11-06')).toEqual({
      startDate: '2026-10-31',
      endDate: '2026-11-06'
    })
  })
})
