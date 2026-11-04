import type { Expense } from '../../models'

export type SalaryKey = 'den' | 'shai' | 'mj'

export const SALARY_KEYS: SalaryKey[] = ['den', 'shai', 'mj']

export const SALARY_LABELS: Record<SalaryKey, string> = {
  den: 'Den Salary',
  shai: 'Shai Salary',
  mj: 'MJ Salary',
}

/** Plain-language pay schedule, for messages. */
export const SALARY_SCHEDULE_TEXT: Record<SalaryKey, string> = {
  den: 'every Thursday',
  shai: 'every Monday',
  mj: 'on the 15th and 30th',
}

function parts(date: string) {
  const d = new Date(`${date}T00:00:00Z`)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  return { weekday: d.getUTCDay(), day: d.getUTCDate(), lastDay }
}

/** `date` is YYYY-MM-DD. In February, MJ's "30th" falls on the last day of the month. */
export function isSalaryDay(key: SalaryKey, date: string): boolean {
  const { weekday, day, lastDay } = parts(date)
  if (key === 'shai') return weekday === 1
  if (key === 'den') return weekday === 4
  return day === 15 || day === Math.min(30, lastDay)
}

export function salariesDueOn(date: string): SalaryKey[] {
  return SALARY_KEYS.filter(k => isSalaryDay(k, date))
}

/** People due on `date` whose amount box is empty. */
export function missingSalariesOn(date: string, amounts: Record<SalaryKey, number | null | undefined>): SalaryKey[] {
  return salariesDueOn(date).filter(k => !amounts[k])
}

export interface WeekSalaryStatus {
  key: SalaryKey
  label: string
  dueDates: string[]
  paid: { date: string; amount: number }[]
  total: number
  /** Pay days in the week with no salary recorded on that date. */
  missingDates: string[]
}

export function getWeekSalaryStatus(weekDates: string[], expenses: Expense[]): WeekSalaryStatus[] {
  return SALARY_KEYS.map(key => {
    const label = SALARY_LABELS[key]
    const paid = expenses
      .filter(e => weekDates.includes(e.expense_date) && e.description?.toLowerCase() === label.toLowerCase())
      .map(e => ({ date: e.expense_date, amount: e.amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const dueDates = weekDates.filter(d => isSalaryDay(key, d))
    const paidDates = new Set(paid.map(p => p.date))
    return {
      key,
      label,
      dueDates,
      paid,
      total: Math.round(paid.reduce((s, p) => s + p.amount, 0) * 100) / 100,
      missingDates: dueDates.filter(d => !paidDates.has(d)),
    }
  })
}
