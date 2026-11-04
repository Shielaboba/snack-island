import { describe, it, expect } from 'vitest'
import {
  toPHDate,
  getCompletedWeek,
  getWeekDates,
  buildWeeklySummary,
} from '../../../src/modules/weekly/weeklySummary'
import type { Discount, Expense, MenuItem, Order, OrderItem, StoreSession } from '../../../src/models'
import { VOUCHER_MENU_ITEM_ID } from '../../../src/modules/vouchers/voucherUtils'

describe('toPHDate', () => {
  it('uses Manila time, not UTC', () => {
    // 2026-10-23 17:00 UTC = 2026-10-24 01:00 Manila
    expect(toPHDate('2026-10-23T17:00:00Z')).toBe('2026-10-24')
    expect(toPHDate('2026-10-23T07:00:00Z')).toBe('2026-10-23')
  })
})

describe('getCompletedWeek', () => {
  it('on a Wednesday shows the Fri–Thu week that ended last Thursday', () => {
    // Wed 2026-11-04, noon Manila
    const week = getCompletedWeek(new Date('2026-11-04T04:00:00Z'))
    expect(week).toEqual({ start: '2026-10-23', end: '2026-10-29' })
  })

  it('on a Friday the week that just ended (yesterday Thursday) is shown', () => {
    const week = getCompletedWeek(new Date('2026-10-30T04:00:00Z'))
    expect(week).toEqual({ start: '2026-10-23', end: '2026-10-29' })
  })

  it('on a Thursday the current week is not complete yet', () => {
    const week = getCompletedWeek(new Date('2026-10-29T04:00:00Z'))
    expect(week).toEqual({ start: '2026-10-16', end: '2026-10-22' })
  })

  it('uses Manila date near midnight', () => {
    // Thu 2026-10-29 16:30 UTC = Fri 00:30 Manila → week Oct 23–29 is complete
    const week = getCompletedWeek(new Date('2026-10-29T16:30:00Z'))
    expect(week).toEqual({ start: '2026-10-23', end: '2026-10-29' })
  })

  it('steps back by weeks', () => {
    const week = getCompletedWeek(new Date('2026-11-04T04:00:00Z'), 2)
    expect(week).toEqual({ start: '2026-10-09', end: '2026-10-15' })
  })

  it('crosses month and year boundaries', () => {
    // Mon 2026-01-05 → Fri 2025-12-26 to Thu 2026-01-01
    const week = getCompletedWeek(new Date('2026-01-05T04:00:00Z'))
    expect(week).toEqual({ start: '2025-12-26', end: '2026-01-01' })
  })
})

describe('getWeekDates', () => {
  it('lists the seven days Fri to Thu', () => {
    expect(getWeekDates({ start: '2026-10-23', end: '2026-10-29' })).toEqual([
      '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
    ])
  })
})

describe('buildWeeklySummary', () => {
  const week = { start: '2026-10-23', end: '2026-10-29' }
  const now = new Date('2026-11-04T04:00:00Z')

  const session = (id: string, openedUtc: string, closedUtc: string | null): StoreSession => ({
    id, opened_at: openedUtc, closed_at: closedUtc,
  })

  const order = (id: string, createdUtc: string, total: number, extra: Partial<Order> = {}): Order => ({
    id,
    total_amount: total,
    payment_method: 'cash',
    status: 'completed',
    created_at: createdUtc,
    updated_at: null,
    created_by: null,
    updated_by: null,
    discount_id: null,
    ...extra,
  })

  const item = (orderId: string, menuId: string, qty: number, subtotal: number): OrderItem => ({
    id: `${orderId}-${menuId}`, order_id: orderId, menu_id: menuId, quantity: qty, subtotal,
    created_at: null, created_by: null,
  })

  const expense = (id: string, date: string, amount: number, category: Expense['category'] = 'Ingredients', description = 'stuff'): Expense => ({
    id, expense_date: date, amount, category, description,
  })

  const menuItems: MenuItem[] = [
    { id: 'burger', name: 'Burger', price: 100, category: 'Snack' },
    { id: 'fries', name: 'Fries', price: 50, category: 'Side' },
  ]

  const discounts: Discount[] = [
    { id: 'senior', name: 'Senior', amount: 20, discount_type: 'percentage', is_active: true },
    { id: 'promo', name: 'Promo', amount: 10, discount_type: 'flat', is_active: true },
  ]

  // Fri Oct 23: opens 3pm Manila (07:00Z), closes Sat 1am Manila (17:00Z)
  const friSession = session('s-fri', '2026-10-23T07:00:00Z', '2026-10-23T17:00:00Z')
  // Sat Oct 24
  const satSession = session('s-sat', '2026-10-24T07:00:00Z', '2026-10-24T15:00:00Z')
  // Thu Oct 22 (previous week) and Fri Oct 30 (next week) must be ignored
  const prevSession = session('s-prev', '2026-10-22T07:00:00Z', '2026-10-22T15:00:00Z')
  const nextSession = session('s-next', '2026-10-30T07:00:00Z', '2026-10-30T15:00:00Z')

  const orders: Order[] = [
    order('o1', '2026-10-23T08:00:00Z', 200),                                        // Fri cash
    order('o2', '2026-10-23T16:30:00Z', 150, { payment_method: 'gcash' }),          // Fri after midnight, still Fri session
    order('o3', '2026-10-24T09:00:00Z', 80, { discount_id: 'senior' }),            // Sat cash, 20% off 100
    order('o4', '2026-10-24T10:00:00Z', 90, { discount_id: 'promo' }),             // Sat cash, ₱10 off 100
    order('o5', '2026-10-24T11:00:00Z', 0),                                          // Sat voucher order
    order('o6', '2026-10-24T12:00:00Z', 500, { status: 'cancelled' }),             // cancelled, ignored
    order('o7', '2026-10-24T20:00:00Z', 300),                                        // outside any session, ignored
    order('o8', '2026-10-22T08:00:00Z', 999),                                        // previous week session
  ]

  const items: OrderItem[] = [
    item('o1', 'burger', 2, 200),
    item('o2', 'fries', 3, 150),
    item('o3', 'burger', 1, 100),
    item('o4', 'burger', 1, 100),
    item('o5', VOUCHER_MENU_ITEM_ID, 1, 0),
    item('o5', VOUCHER_MENU_ITEM_ID, 1, 0),
    item('o6', 'burger', 5, 500),
  ]

  const expenses: Expense[] = [
    expense('e1', '2026-10-23', 100, 'Ingredients', "Today's expense"),
    expense('e2', '2026-10-24', 50, 'Labor', 'Den Salary'),
    expense('e3', '2026-10-27', 30, 'Gas'),           // Tuesday, no session, still counts
    expense('e4', '2026-10-22', 999),                 // previous week
    expense('e5', '2026-10-30', 999),                 // next week
  ]

  const summary = buildWeeklySummary({
    week,
    sessions: [nextSession, satSession, friSession, prevSession],
    orders,
    items,
    expenses,
    menuItems,
    discounts,
    now,
  })

  it('totals completed orders in the week sessions', () => {
    expect(summary.totals.orderCount).toBe(5)
    expect(summary.totals.revenue).toBe(520)
    expect(summary.totals.cash).toBe(370)
    expect(summary.totals.nonCash).toBe(150)
  })

  it('totals all expenses dated Fri to Thu', () => {
    expect(summary.totals.expenses).toBe(180)
  })

  it('expected handover is cash sales minus all expenses', () => {
    expect(summary.totals.expectedHandover).toBe(190)
  })

  it('breaks down payment methods', () => {
    expect(summary.paymentMethods).toEqual([
      { method: 'cash', orders: 4, amount: 370 },
      { method: 'gcash', orders: 1, amount: 150 },
    ])
  })

  it('gives one row per day Fri to Thu', () => {
    expect(summary.days.map(d => d.date)).toEqual(getWeekDates(week))
    const [fri, sat, , , tue] = summary.days
    expect(fri).toMatchObject({ hasSession: true, orders: 2, revenue: 350, cash: 200, nonCash: 150, expenses: 100 })
    expect(sat).toMatchObject({ hasSession: true, orders: 3, revenue: 170, cash: 170, nonCash: 0, expenses: 50 })
    expect(tue).toMatchObject({ hasSession: false, orders: 0, revenue: 0, expenses: 30 })
    expect(sat!.expenseList.map(e => e.id)).toEqual(['e2'])
  })

  it('lists items sold, most sold first, without voucher burgers', () => {
    expect(summary.items).toEqual([
      { menuId: 'burger', name: 'Burger', quantity: 4, revenue: 400 },
      { menuId: 'fries', name: 'Fries', quantity: 3, revenue: 150 },
    ])
  })

  it('summarizes discounts by name with the amount taken off', () => {
    expect(summary.discounts).toEqual([
      { name: 'Senior', orders: 1, amount: 20 },
      { name: 'Promo', orders: 1, amount: 10 },
    ])
    expect(summary.totals.discountAmount).toBe(30)
  })

  it('counts redeemed vouchers', () => {
    expect(summary.vouchers).toEqual({ orders: 1, burgers: 2 })
  })

  it('totals expenses by category, biggest first', () => {
    expect(summary.expenseCategories).toEqual([
      { category: 'Ingredients', amount: 100 },
      { category: 'Labor', amount: 50 },
      { category: 'Gas', amount: 30 },
    ])
  })

  it('notes salaries: recorded pay and missed pay days', () => {
    const [den, shai, mj] = summary.salaries
    expect(den).toMatchObject({ key: 'den', total: 50, dueDates: ['2026-10-29'], missingDates: ['2026-10-29'] })
    expect(shai).toMatchObject({ key: 'shai', total: 0, dueDates: ['2026-10-26'], missingDates: ['2026-10-26'] })
    expect(mj).toMatchObject({ key: 'mj', total: 0, dueDates: [], missingDates: [] })
  })

  it('counts an open session up to now', () => {
    const open = session('s-open', '2026-10-29T07:00:00Z', null)
    const s = buildWeeklySummary({
      week, sessions: [open], orders: [order('x', '2026-10-29T08:00:00Z', 40)],
      items: [], expenses: [], menuItems, discounts, now,
    })
    expect(s.totals.revenue).toBe(40)
    expect(s.days[6]!.hasSession).toBe(true)
  })

  it('handles an empty week', () => {
    const s = buildWeeklySummary({ week, sessions: [], orders: [], items: [], expenses: [], menuItems, discounts, now })
    expect(s.totals).toMatchObject({ revenue: 0, orderCount: 0, expenses: 0, expectedHandover: 0 })
    expect(s.days).toHaveLength(7)
  })
})
