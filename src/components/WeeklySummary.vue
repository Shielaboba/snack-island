<template>
  <div class="weekly-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Weekly Summary</h1>
        <p class="page-subtitle">Friday to Thursday. Money is handed over the next Friday.</p>
      </div>
      <div class="week-nav">
        <button class="nav-btn" :disabled="loading" title="Previous week" @click="weeksBack++">‹</button>
        <div class="week-label">
          <div class="week-range">{{ formatDay(week.start) }} – {{ formatDay(week.end) }}</div>
          <div class="week-tag">{{ weeksBack === 0 ? 'Latest completed week' : `${weeksBack} week${weeksBack > 1 ? 's' : ''} earlier` }}</div>
        </div>
        <button class="nav-btn" :disabled="loading || weeksBack === 0" title="Next week" @click="weeksBack--">›</button>
      </div>
    </div>

    <div v-if="loading" class="state-text">Loading week…</div>
    <div v-else-if="error" class="state-text error">{{ error }}</div>

    <template v-else-if="summary">
      <!-- Handover -->
      <div class="handover-card">
        <div class="handover-label">Expected cash to hand over</div>
        <div class="handover-amount" :class="{ negative: summary.totals.expectedHandover < 0 }">{{ peso(summary.totals.expectedHandover) }}</div>
        <div class="handover-math">
          Cash sales {{ peso(summary.totals.cash) }} − Expenses {{ peso(summary.totals.expenses) }}
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-label">Total revenue</div>
          <div class="stat-value">{{ peso(summary.totals.revenue) }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Orders</div>
          <div class="stat-value">{{ summary.totals.orderCount }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Cash sales</div>
          <div class="stat-value">{{ peso(summary.totals.cash) }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">GCash / other</div>
          <div class="stat-value">{{ peso(summary.totals.nonCash) }}</div>
          <div class="stat-note">Not in the cash handover</div>
        </div>
        <div class="stat">
          <div class="stat-label">Expenses</div>
          <div class="stat-value">{{ peso(summary.totals.expenses) }}</div>
        </div>
      </div>

      <!-- Salaries -->
      <div class="section">
        <h2 class="section-title">Salaries</h2>
        <div v-if="missingSalaryCount > 0" class="salary-alert">
          {{ missingSalaryCount }} pay day{{ missingSalaryCount === 1 ? '' : 's' }} this week with no salary recorded. Check her notes.
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Person</th><th>Pay day this week</th><th>Recorded</th><th class="num">Total</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in summary.salaries" :key="s.key">
                <td>
                  {{ s.label }}
                  <div class="sub">Paid {{ SALARY_SCHEDULE_TEXT[s.key] }}</div>
                </td>
                <td>
                  <span v-if="s.dueDates.length === 0" class="muted">None</span>
                  <span v-for="d in s.dueDates" :key="d" class="pill" :class="s.missingDates.includes(d) ? 'pill-missing' : 'pill-ok'">
                    {{ formatDay(d) }} {{ s.missingDates.includes(d) ? '· missing' : '✓' }}
                  </span>
                </td>
                <td>
                  <span v-if="s.paid.length === 0" class="muted">—</span>
                  <div v-for="p in s.paid" :key="p.date">{{ formatDay(p.date) }} · {{ peso(p.amount) }}</div>
                </td>
                <td class="num strong">{{ peso(s.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="hint">Salaries are already part of the week's expenses.</p>
      </div>

      <!-- Per day -->
      <div class="section">
        <h2 class="section-title">Per day</h2>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Day</th>
                <th class="num">Orders</th>
                <th class="num">Cash</th>
                <th class="num">GCash / other</th>
                <th class="num">Revenue</th>
                <th class="num">Expenses</th>
                <th class="num">Cash − expenses</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in summary.days" :key="d.date" :class="{ closed: !d.hasSession }">
                <td>
                  {{ formatDay(d.date) }}
                  <span v-if="!d.hasSession" class="closed-tag">No session</span>
                </td>
                <td class="num">{{ d.orders }}</td>
                <td class="num">{{ peso(d.cash) }}</td>
                <td class="num">{{ peso(d.nonCash) }}</td>
                <td class="num">{{ peso(d.revenue) }}</td>
                <td class="num">{{ peso(d.expenses) }}</td>
                <td class="num strong" :class="{ negative: d.cash - d.expenses < 0 }">{{ peso(d.cash - d.expenses) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td class="num">{{ summary.totals.orderCount }}</td>
                <td class="num">{{ peso(summary.totals.cash) }}</td>
                <td class="num">{{ peso(summary.totals.nonCash) }}</td>
                <td class="num">{{ peso(summary.totals.revenue) }}</td>
                <td class="num">{{ peso(summary.totals.expenses) }}</td>
                <td class="num strong">{{ peso(summary.totals.expectedHandover) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="two-col">
        <!-- Items sold -->
        <div class="section">
          <h2 class="section-title">Items sold</h2>
          <div v-if="summary.items.length === 0" class="empty">No items sold this week.</div>
          <div v-else class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Item</th><th class="num">Qty</th><th class="num">Revenue</th></tr>
              </thead>
              <tbody>
                <tr v-for="i in summary.items" :key="i.menuId">
                  <td>{{ i.name }}</td>
                  <td class="num">{{ i.quantity }}</td>
                  <td class="num">{{ peso(i.revenue) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="hint">Revenue here is before discounts.</p>
        </div>

        <div class="side-col">
          <!-- Discounts & vouchers -->
          <div class="section">
            <h2 class="section-title">Discounts &amp; vouchers</h2>
            <div v-if="summary.discounts.length === 0" class="empty">No discounts used.</div>
            <div v-else class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th>Discount</th><th class="num">Orders</th><th class="num">Taken off</th></tr>
                </thead>
                <tbody>
                  <tr v-for="d in summary.discounts" :key="d.name">
                    <td>{{ d.name }}</td>
                    <td class="num">{{ d.orders }}</td>
                    <td class="num">{{ peso(d.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="voucher-row">
              <span>Vouchers redeemed</span>
              <strong>{{ summary.vouchers.burgers }} burger{{ summary.vouchers.burgers === 1 ? '' : 's' }} · {{ summary.vouchers.orders }} order{{ summary.vouchers.orders === 1 ? '' : 's' }}</strong>
            </div>
          </div>

          <!-- Payment methods -->
          <div class="section">
            <h2 class="section-title">Payment methods</h2>
            <div v-if="summary.paymentMethods.length === 0" class="empty">No orders.</div>
            <div v-else class="table-wrap">
              <table class="table">
                <tbody>
                  <tr v-for="p in summary.paymentMethods" :key="p.method">
                    <td>{{ methodLabel(p.method) }}</td>
                    <td class="num">{{ p.orders }} orders</td>
                    <td class="num">{{ peso(p.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Expenses -->
      <div class="section">
        <h2 class="section-title">Expenses</h2>
        <div v-if="allExpenses.length === 0" class="empty">No expenses this week.</div>
        <template v-else>
          <div class="chips">
            <span v-for="c in summary.expenseCategories" :key="c.category" class="chip">
              {{ c.category }} <strong>{{ peso(c.amount) }}</strong>
            </span>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Date</th><th>Category</th><th>Description</th><th class="num">Amount</th></tr>
              </thead>
              <tbody>
                <tr v-for="e in allExpenses" :key="e.id">
                  <td>{{ formatDay(e.expense_date) }}</td>
                  <td>{{ e.category }}</td>
                  <td>{{ e.description }}</td>
                  <td class="num">{{ peso(e.amount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { StoreSessionService } from '../services/storeSessionService'
import { OrderService } from '../services/orderService'
import { expenseService } from '../services/expenseService'
import { menuItemService } from '../services/menuItemService'
import { discountService } from '../services/discountService'
import { buildWeeklySummary, getCompletedWeek, sessionsInWeek, type WeeklySummary } from '../modules/weekly/weeklySummary'
import type { PaymentMethod } from '../models'
import { SALARY_SCHEDULE_TEXT } from '../modules/salary/salarySchedule'

const weeksBack = ref(0)
const week = computed(() => getCompletedWeek(new Date(), weeksBack.value))
const loading = ref(false)
const error = ref('')
const summary = ref<WeeklySummary | null>(null)

const allExpenses = computed(() => summary.value?.days.flatMap(d => d.expenseList) ?? [])
const missingSalaryCount = computed(() => summary.value?.salaries.reduce((n, s) => n + s.missingDates.length, 0) ?? 0)

const pesoFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
function peso(n: number): string {
  return pesoFormat.format(n)
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-PH', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
  })
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', gcash: 'GCash', maya: 'Maya', gotyme: 'GoTyme', bpi: 'BPI', other: 'Other', unknown: 'Not set',
}
function methodLabel(m: PaymentMethod | 'unknown'): string {
  return METHOD_LABELS[m] ?? m
}

let loadId = 0
async function load() {
  const id = ++loadId
  loading.value = true
  error.value = ''
  try {
    const now = new Date()
    const range = week.value
    const [sessions, expenses, menuItems, discounts] = await Promise.all([
      StoreSessionService.getAllSessions(),
      expenseService.getAll(),
      menuItemService.getMenuItems(),
      discountService.getAll(),
    ])

    const weekSessions = sessionsInWeek(sessions, range)
    let orders: Awaited<ReturnType<typeof OrderService.getOrders>> = []
    let items: Awaited<ReturnType<typeof OrderService.getOrderItemsBulk>> = []
    if (weekSessions.length > 0) {
      const ranges = weekSessions.map(s => StoreSessionService.getSessionRange(s))
      const startDate = new Date(Math.min(...ranges.map(r => r.start.getTime())))
      const endDate = new Date(Math.max(...ranges.map(r => r.end.getTime())))
      orders = await OrderService.getOrders({ status: 'completed', startDate, endDate })
      items = await OrderService.getOrderItemsBulk(orders.map(o => o.id))
    }

    if (id !== loadId) return
    summary.value = buildWeeklySummary({ week: range, sessions: weekSessions, orders, items, expenses, menuItems, discounts, now })
  } catch (e) {
    console.error('Error loading weekly summary:', e)
    if (id === loadId) error.value = 'Could not load this week. Please try again.'
  } finally {
    if (id === loadId) loading.value = false
  }
}

watch(weeksBack, load)
onMounted(load)
</script>

<style scoped>
.weekly-page {
  padding: 32px;
  max-width: 1100px;
  margin: 0 auto;
  color: #111827;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: #6b7280;
}

.week-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
  background: #fff;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.week-label {
  text-align: center;
  min-width: 180px;
}

.week-range {
  font-weight: 600;
  font-size: 15px;
}

.week-tag {
  font-size: 12px;
  color: #6b7280;
}

.state-text {
  padding: 40px;
  text-align: center;
  color: #6b7280;
}

.state-text.error {
  color: #b91c1c;
}

.handover-card {
  background: #0e3b2e;
  color: #fff;
  border-radius: 14px;
  padding: 24px;
  margin-bottom: 16px;
}

.handover-label {
  font-size: 14px;
  opacity: 0.85;
}

.handover-amount {
  font-size: 40px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin: 4px 0;
}

.handover-amount.negative {
  color: #fecaca;
}

.handover-math {
  font-size: 14px;
  opacity: 0.85;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.stat {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stat-note {
  font-size: 12px;
  color: #9ca3af;
}

.section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 12px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.side-col {
  display: flex;
  flex-direction: column;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table th {
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.table td {
  padding: 9px 10px;
  border-bottom: 1px solid #f3f4f6;
  white-space: nowrap;
}

.table tfoot td {
  font-weight: 700;
  border-top: 2px solid #e5e7eb;
  border-bottom: none;
}

.num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.strong {
  font-weight: 600;
}

.negative {
  color: #b91c1c;
}

tr.closed td {
  color: #9ca3af;
}

.closed-tag {
  margin-left: 6px;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 6px;
  background: #f3f4f6;
  color: #6b7280;
}

.empty {
  color: #9ca3af;
  font-size: 14px;
  padding: 8px 0;
}

.hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.voucher-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
  font-size: 14px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.chip {
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
}

.salary-alert {
  background: #fef3c7;
  color: #92400e;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  margin-bottom: 12px;
}

.sub {
  font-size: 12px;
  color: #9ca3af;
}

.muted {
  color: #9ca3af;
}

.pill {
  display: inline-block;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  margin-right: 4px;
}

.pill-ok {
  background: #d1e7dd;
  color: #0e3b2e;
}

.pill-missing {
  background: #fee2e2;
  color: #b91c1c;
}

@media (max-width: 800px) {
  .weekly-page {
    padding: 16px;
  }

  .two-col {
    grid-template-columns: 1fr;
  }

  .handover-amount {
    font-size: 32px;
  }
}
</style>
