import { describe, it, expect } from 'vitest'
import {
  isSalaryDay,
  salariesDueOn,
  missingSalariesOn,
  getWeekSalaryStatus,
} from '../../../src/modules/salary/salarySchedule'
import type { Expense } from '../../../src/models'

describe('isSalaryDay', () => {
  it('Shai is paid on Mondays', () => {
    expect(isSalaryDay('shai', '2026-10-26')).toBe(true) // Monday
    expect(isSalaryDay('shai', '2026-10-27')).toBe(false)
  })

  it('Den is paid on Thursdays', () => {
    expect(isSalaryDay('den', '2026-10-29')).toBe(true) // Thursday
    expect(isSalaryDay('den', '2026-10-30')).toBe(false)
  })

  it('MJ is paid on the 15th and 30th', () => {
    expect(isSalaryDay('mj', '2026-10-15')).toBe(true)
    expect(isSalaryDay('mj', '2026-10-30')).toBe(true)
    expect(isSalaryDay('mj', '2026-10-31')).toBe(false)
    expect(isSalaryDay('mj', '2026-10-16')).toBe(false)
  })

  it('MJ is paid on the last day of February', () => {
    expect(isSalaryDay('mj', '2026-02-28')).toBe(true)
    expect(isSalaryDay('mj', '2028-02-29')).toBe(true) // leap year
    expect(isSalaryDay('mj', '2028-02-28')).toBe(false)
  })
})

describe('salariesDueOn / missingSalariesOn', () => {
  it('lists who is due on a date', () => {
    // Thu 2026-10-15: Den (Thursday) and MJ (15th)
    expect(salariesDueOn('2026-10-15')).toEqual(['den', 'mj'])
    expect(salariesDueOn('2026-10-27')).toEqual([])
  })

  it('lists who is due but has no amount entered', () => {
    expect(missingSalariesOn('2026-10-15', { den: 500, shai: null, mj: null })).toEqual(['mj'])
    expect(missingSalariesOn('2026-10-15', { den: 500, shai: null, mj: 0 })).toEqual(['mj'])
    expect(missingSalariesOn('2026-10-15', { den: 500, shai: null, mj: 300 })).toEqual([])
  })
})

describe('getWeekSalaryStatus', () => {
  const week = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']
  const exp = (id: string, date: string, description: string, amount: number): Expense => ({
    id, expense_date: date, description, amount, category: 'Labor',
  })

  it('shows each person, their pay days in the week, and what was recorded', () => {
    const status = getWeekSalaryStatus(week, [
      exp('a', '2026-10-26', 'Shai Salary', 400),
      exp('b', '2026-10-24', 'MJ Salary', 1000), // paid on a non-schedule day
      exp('c', '2026-10-25', 'Rent', 999),
    ])
    expect(status).toEqual([
      { key: 'den', label: 'Den Salary', dueDates: ['2026-10-29'], paid: [], total: 0, missingDates: ['2026-10-29'] },
      { key: 'shai', label: 'Shai Salary', dueDates: ['2026-10-26'], paid: [{ date: '2026-10-26', amount: 400 }], total: 400, missingDates: [] },
      { key: 'mj', label: 'MJ Salary', dueDates: [], paid: [{ date: '2026-10-24', amount: 1000 }], total: 1000, missingDates: [] },
    ])
  })

  it('matches salary names regardless of case', () => {
    const status = getWeekSalaryStatus(week, [exp('a', '2026-10-29', 'den salary', 500)])
    expect(status[0]).toMatchObject({ total: 500, missingDates: [] })
  })
})
