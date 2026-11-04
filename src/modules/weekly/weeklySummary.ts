import type { Discount, Expense, ExpenseCategory, MenuItem, Order, OrderItem, PaymentMethod, StoreSession } from '../../models'
import { VOUCHER_MENU_ITEM_ID } from '../vouchers/voucherUtils'
import { getWeekSalaryStatus, type WeekSalaryStatus } from '../salary/salarySchedule'

/** Philippines is UTC+8 all year (no daylight saving). */
const PH_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
/** getUTCDay() value for Friday. Weeks run Friday to Thursday. */
const FRIDAY = 5

export interface WeekRange {
  /** Friday, YYYY-MM-DD */
  start: string
  /** Thursday, YYYY-MM-DD */
  end: string
}

export interface DaySummary {
  date: string
  hasSession: boolean
  orders: number
  revenue: number
  cash: number
  nonCash: number
  expenses: number
  expenseList: Expense[]
}

export interface WeeklySummary {
  week: WeekRange
  totals: {
    orderCount: number
    revenue: number
    cash: number
    nonCash: number
    expenses: number
    /** Cash sales minus all expenses: what should be handed over on Friday. */
    expectedHandover: number
    discountAmount: number
  }
  days: DaySummary[]
  paymentMethods: { method: PaymentMethod | 'unknown'; orders: number; amount: number }[]
  items: { menuId: string; name: string; quantity: number; revenue: number }[]
  discounts: { name: string; orders: number; amount: number }[]
  vouchers: { orders: number; burgers: number }
  expenseCategories: { category: ExpenseCategory; amount: number }[]
  /** Each person's pay days this week and what was recorded. */
  salaries: WeekSalaryStatus[]
}

/** YYYY-MM-DD in Manila time. */
export function toPHDate(value: string | Date): string {
  const ms = new Date(value).getTime() + PH_OFFSET_MS
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const ms = new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * The latest Fri–Thu week that has fully ended (in Manila time).
 * `weeksBack` = 1 gives the week before that, and so on.
 */
export function getCompletedWeek(now: Date = new Date(), weeksBack = 0): WeekRange {
  const today = toPHDate(now)
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
  const daysSinceFriday = (dow - FRIDAY + 7) % 7
  const currentWeekStart = addDays(today, -daysSinceFriday)
  const start = addDays(currentWeekStart, -7 * (weeksBack + 1))
  return { start, end: addDays(start, 6) }
}

export function getWeekDates(week: WeekRange): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week.start, i))
}

/** Sessions belong to the week of the day they opened. */
export function sessionsInWeek(sessions: StoreSession[], week: WeekRange): StoreSession[] {
  return sessions.filter(s => {
    const d = toPHDate(s.opened_at)
    return d >= week.start && d <= week.end
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** How much a discount took off, worked out from the order's final total. */
function discountTakenOff(order: Order, discount: Discount | undefined, itemsSubtotal: number): number {
  const total = order.total_amount ?? 0
  if (discount) {
    if (discount.discount_type === 'flat') return discount.amount
    if (discount.amount > 0 && discount.amount < 100) {
      return round2(total / (1 - discount.amount / 100) - total)
    }
  }
  return Math.max(0, round2(itemsSubtotal - total))
}

export function buildWeeklySummary(input: {
  week: WeekRange
  sessions: StoreSession[]
  orders: Order[]
  items: OrderItem[]
  expenses: Expense[]
  menuItems: MenuItem[]
  discounts: Discount[]
  now?: Date
}): WeeklySummary {
  const { week, menuItems, discounts } = input
  const now = input.now ?? new Date()
  const dates = getWeekDates(week)

  const weekSessions = sessionsInWeek(input.sessions, week).map(s => ({
    day: toPHDate(s.opened_at),
    start: new Date(s.opened_at).getTime(),
    end: s.closed_at ? new Date(s.closed_at).getTime() : now.getTime(),
  }))

  // Completed orders that fall inside one of the week's sessions, tagged with that session's day
  const orderDay = new Map<string, string>()
  const weekOrders: Order[] = []
  for (const o of input.orders) {
    if (o.status !== 'completed' || !o.created_at) continue
    const t = new Date(o.created_at).getTime()
    const s = weekSessions.find(ws => t >= ws.start && t <= ws.end)
    if (!s) continue
    orderDay.set(o.id, s.day)
    weekOrders.push(o)
  }
  const orderIds = new Set(weekOrders.map(o => o.id))
  const weekItems = input.items.filter(i => i.order_id && orderIds.has(i.order_id))

  const weekExpenses = input.expenses.filter(e => e.expense_date >= week.start && e.expense_date <= week.end)

  const days: DaySummary[] = dates.map(date => {
    const dayOrders = weekOrders.filter(o => orderDay.get(o.id) === date)
    const cash = dayOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const revenue = dayOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const expenseList = weekExpenses.filter(e => e.expense_date === date)
    return {
      date,
      hasSession: weekSessions.some(s => s.day === date),
      orders: dayOrders.length,
      revenue: round2(revenue),
      cash: round2(cash),
      nonCash: round2(revenue - cash),
      expenses: round2(expenseList.reduce((s, e) => s + (e.amount ?? 0), 0)),
      expenseList,
    }
  })

  // Payment methods
  const byMethod = new Map<PaymentMethod | 'unknown', { orders: number; amount: number }>()
  for (const o of weekOrders) {
    const key = o.payment_method ?? 'unknown'
    const row = byMethod.get(key) ?? { orders: 0, amount: 0 }
    row.orders++
    row.amount += o.total_amount ?? 0
    byMethod.set(key, row)
  }
  const paymentMethods = [...byMethod.entries()]
    .map(([method, r]) => ({ method, orders: r.orders, amount: round2(r.amount) }))
    .sort((a, b) => b.amount - a.amount)

  // Items sold (voucher burgers are counted under vouchers instead)
  const menuName = new Map(menuItems.map(m => [m.id, m.name]))
  const byItem = new Map<string, { quantity: number; revenue: number }>()
  const voucherOrders = new Set<string>()
  let voucherBurgers = 0
  for (const i of weekItems) {
    if (!i.menu_id) continue
    if (i.menu_id === VOUCHER_MENU_ITEM_ID && (i.subtotal ?? 0) === 0) {
      voucherBurgers += i.quantity
      if (i.order_id) voucherOrders.add(i.order_id)
      continue
    }
    const row = byItem.get(i.menu_id) ?? { quantity: 0, revenue: 0 }
    row.quantity += i.quantity
    row.revenue += i.subtotal ?? 0
    byItem.set(i.menu_id, row)
  }
  const items = [...byItem.entries()]
    .map(([menuId, r]) => ({ menuId, name: menuName.get(menuId) ?? 'Unknown item', quantity: r.quantity, revenue: round2(r.revenue) }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)

  // Discounts
  const discountById = new Map(discounts.map(d => [d.id, d]))
  const subtotalByOrder = new Map<string, number>()
  for (const i of weekItems) {
    if (i.order_id) subtotalByOrder.set(i.order_id, (subtotalByOrder.get(i.order_id) ?? 0) + (i.subtotal ?? 0))
  }
  const byDiscount = new Map<string, { orders: number; amount: number }>()
  for (const o of weekOrders) {
    if (!o.discount_id) continue
    const d = discountById.get(o.discount_id)
    const name = d?.name ?? 'Unknown discount'
    const row = byDiscount.get(name) ?? { orders: 0, amount: 0 }
    row.orders++
    row.amount += discountTakenOff(o, d, subtotalByOrder.get(o.id) ?? 0)
    byDiscount.set(name, row)
  }
  const discountRows = [...byDiscount.entries()]
    .map(([name, r]) => ({ name, orders: r.orders, amount: round2(r.amount) }))
    .sort((a, b) => b.amount - a.amount)

  // Expenses by category
  const byCategory = new Map<ExpenseCategory, number>()
  for (const e of weekExpenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (e.amount ?? 0))
  const expenseCategories = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)

  const revenue = round2(days.reduce((s, d) => s + d.revenue, 0))
  const cash = round2(days.reduce((s, d) => s + d.cash, 0))
  const expenses = round2(weekExpenses.reduce((s, e) => s + (e.amount ?? 0), 0))

  return {
    week,
    totals: {
      orderCount: weekOrders.length,
      revenue,
      cash,
      nonCash: round2(revenue - cash),
      expenses,
      expectedHandover: round2(cash - expenses),
      discountAmount: round2(discountRows.reduce((s, d) => s + d.amount, 0)),
    },
    days,
    paymentMethods,
    items,
    discounts: discountRows,
    vouchers: { orders: voucherOrders.size, burgers: voucherBurgers },
    expenseCategories,
    salaries: getWeekSalaryStatus(dates, weekExpenses),
  }
}
