<template>
  <div class="audit-page">
    <div class="page-header">
      <h1 class="page-title">Audit</h1>
    </div>

    <!-- Ingredient Mapping Config (admin only) -->
    <div v-if="isAdmin" class="section mapping-section">
      <div class="section-header" @click="mappingOpen = !mappingOpen">
        <h2 class="section-title">Ingredient Mapping</h2>
        <svg class="chevron" :class="{ rotated: mappingOpen }" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      <div v-if="mappingOpen" class="mapping-content">
        <p class="mapping-hint">Define how many units of each ingredient each menu item uses.</p>

        <div v-if="loadingMenuItems" class="loading-text">Loading menu items...</div>

        <div v-else class="menu-items-list">
          <div v-for="item in menuItems" :key="item.id" class="menu-item-row">
            <div class="menu-item-name">{{ item.name }}</div>
            <div class="mappings-for-item">
              <div v-for="mapping in mappingsForItem(item.id)" :key="mapping.id" class="mapping-chip">
                <span class="chip-label">{{ mapping.ingredient }} × {{ mapping.quantity }}</span>
                <button class="chip-remove" @click="removeMapping(mapping.id)" title="Remove">×</button>
              </div>
              <div class="add-mapping-form">
                <select v-model="newMappingIngredient[item.id]" class="ingredient-select">
                  <option value="">+ Add ingredient</option>
                  <option v-for="ing in availableIngredients(item.id)" :key="ing" :value="ing">{{ ing }}</option>
                </select>
                <input
                  v-if="newMappingIngredient[item.id]"
                  v-model.number="newMappingQty[item.id]"
                  type="number"
                  min="1"
                  class="qty-input"
                  placeholder="Qty"
                />
                <button
                  v-if="newMappingIngredient[item.id]"
                  class="btn-add"
                  @click="addMapping(item.id)"
                >Add</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Session Audit -->
    <div class="section audit-section">
      <h2 class="section-title">Session Audit</h2>

      <div v-if="loadingSessions" class="loading-text">Loading sessions...</div>
      <div v-else class="session-select-row">
        <label class="field-label">Session</label>
        <select v-model="selectedSessionId" class="session-select" @change="onSessionChange">
          <option value="">— Select a session —</option>
          <option v-for="s in sessions" :key="s.id" :value="s.id">{{ sessionLabel(s) }}</option>
        </select>
      </div>

      <div v-if="loadingAudit" class="loading-text">Loading orders...</div>

      <div v-else-if="selectedSessionId && auditRows.length === 0 && !loadingAudit" class="empty-text">
        No ingredient mappings found for the orders in this session.
      </div>

      <div v-if="cashAuditRows.length > 0" class="table-wrapper cash-table-wrapper">
        <table class="audit-table cash-audit-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Amount</th>
              <th>Start of Day Count</th>
              <th>End of Day Count</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cashAuditRows" :key="row.name" :class="{ flagged: cashDifference(row) !== 0 }">
              <td>{{ row.name }}</td>
              <td v-if="row.name !== 'Expenses'">
                {{ row.amount !== null ? '₱' + row.amount.toFixed(2) : '—' }}
              </td>
              <td v-else>
                <input v-model.number="row.amount" type="number" min="0" class="count-input" />
              </td>
              <td><input v-model.number="row.startOfDay" type="number" min="0" class="count-input" /></td>
              <td><input v-model.number="row.endOfDay" type="number" min="0" class="count-input" /></td>
              <td class="diff-cell">{{ cashDifferenceLabel(cashDifference(row)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="auditRows.length > 0" class="table-wrapper">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Today Add-ons</th>
              <th>Yesterday's EOD Count</th>
              <th>Today's EOD Count</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in auditRows" :key="row.ingredient" :class="{ flagged: difference(row) !== 0 }">
              <td>{{ row.ingredient }}</td>
              <td>{{ row.quantity }}</td>
              <td><input v-model.number="row.addOns" type="number" min="0" class="count-input" /></td>
              <td><input v-model.number="row.yesterdayEod" type="number" min="0" class="count-input" /></td>
              <td><input v-model.number="row.todayEod" type="number" min="0" class="count-input" /></td>
              <td class="diff-cell">{{ differenceLabel(difference(row)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Salary Tracking -->
      <div v-if="cashAuditRows.length > 0" class="salary-section">
        <h3 class="salary-title">Salary</h3>
        <p class="salary-note">Type how much each person was paid this session. Hit <strong>Save Audit</strong> and it will be recorded automatically. Leave a box empty if someone wasn't paid.</p>
        <div v-for="key in (['den', 'shai', 'mj'] as const)" :key="key" class="salary-row">
          <span class="salary-label">{{ SALARY_LABELS[key] }}</span>
          <input v-model.number="salaries[key].amount" type="number" min="0" class="count-input" />
          <span v-if="salaries[key].hasMultiple" class="salary-warning" :title="`This person has ${salaries[key].ids.length} pay records for today. Showing the most recent one.`">{{ salaries[key].ids.length }} entries ⚠︎</span>
        </div>
        <p class="salary-hint">Already saved a salary today? It'll show up here automatically. If you clear a box and save, that person's pay record for this session will be removed.</p>
      </div>

      <div v-if="selectedSessionId && (auditRows.length > 0 || cashAuditRows.length > 0)" class="save-row">
        <button class="btn-save" :disabled="saving" @click="onSaveClick">
          {{ saving ? 'Saving…' : 'Save Audit' }}
        </button>
        <span v-if="saveMessage" class="save-message">{{ saveMessage }}</span>
      </div>
    </div>

    <!-- Salary reminder -->
    <div v-if="missingSalaryKeys.length > 0" class="reminder-backdrop" @click.self="closeSalaryReminder">
      <div class="reminder-modal" role="dialog" aria-modal="true" aria-labelledby="salary-reminder-title">
        <h3 id="salary-reminder-title" class="reminder-title">Salary not entered</h3>
        <p class="reminder-text">{{ formatSalaryDate(missingSalaryDate) }} is a pay day for:</p>
        <ul class="reminder-list">
          <li v-for="key in missingSalaryKeys" :key="key">
            <strong>{{ SALARY_LABELS[key] }}</strong> <span class="reminder-schedule">(paid {{ SALARY_SCHEDULE_TEXT[key] }})</span>
          </li>
        </ul>
        <p class="reminder-text">Their salary box is empty. Go back and enter it, or save anyway if they weren't paid this session.</p>
        <div class="reminder-actions">
          <button class="reminder-btn secondary" @click="saveWithoutSalary">Save anyway</button>
          <button class="reminder-btn primary" @click="closeSalaryReminder">Go back</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { authService } from '../services/authService'
import { StoreSessionService } from '../services/storeSessionService'
import { OrderService } from '../services/orderService'
import { menuItemService } from '../services/menuItemService'
import { AuditService, AUDIT_INGREDIENTS } from '../services/auditService'
import { expenseService } from '../services/expenseService'
import type { StoreSession, MenuItem, AuditIngredientMapping } from '../models'
import { SALARY_LABELS, SALARY_SCHEDULE_TEXT, missingSalariesOn, type SalaryKey } from '../modules/salary/salarySchedule'

interface AuditRow {
  ingredient: string
  quantity: number
  addOns: number
  yesterdayEod: number
  todayEod: number
}

interface CashAuditRow {
  name: string
  amount: number
  startOfDay: number
  endOfDay: number
}

const isAdmin = computed(() => authService.isAdmin())

// Mapping section
const mappingOpen = ref(false)
const loadingMenuItems = ref(false)
const menuItems = ref<MenuItem[]>([])
const allMappings = ref<AuditIngredientMapping[]>([])
const newMappingIngredient = reactive<Record<string, string>>({})
const newMappingQty = reactive<Record<string, number>>({})

// Session audit section
const loadingSessions = ref(false)
const sessions = ref<StoreSession[]>([])
const selectedSessionId = ref('')
const loadingAudit = ref(false)
const auditRows = ref<AuditRow[]>([])
const cashAuditRows = ref<CashAuditRow[]>([])
const saving = ref(false)
const saveMessage = ref('')
interface SalaryEntry {
  amount: number | null
  ids: string[]
  hasMultiple: boolean
}
const salaries = ref<Record<'den' | 'shai' | 'mj', SalaryEntry>>({
  den: { amount: null, ids: [], hasMultiple: false },
  shai: { amount: null, ids: [], hasMultiple: false },
  mj: { amount: null, ids: [], hasMultiple: false },
})
// Salary reminder: shown on save when it's someone's pay day but their box is empty
const missingSalaryKeys = ref<SalaryKey[]>([])
const missingSalaryDate = ref('')

function sessionDateFor(id: string): string {
  const session = sessions.value.find(s => s.id === id)
  return session ? session.opened_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
}

function formatSalaryDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-PH', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' })
}

function onSaveClick() {
  if (!selectedSessionId.value) return
  const date = sessionDateFor(selectedSessionId.value)
  const amounts = { den: salaries.value.den.amount, shai: salaries.value.shai.amount, mj: salaries.value.mj.amount }
  const missing = missingSalariesOn(date, amounts)
  if (missing.length > 0) {
    missingSalaryDate.value = date
    missingSalaryKeys.value = missing
    return
  }
  saveAudit()
}

function closeSalaryReminder() {
  missingSalaryKeys.value = []
}

function saveWithoutSalary() {
  missingSalaryKeys.value = []
  saveAudit()
}

function sessionLabel(s: StoreSession): string {
  const start = formatDateTime(s.opened_at)
  if (!s.closed_at) return `${start} — Current Session`
  return `${start} — ${formatDateTime(s.closed_at)}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function mappingsForItem(menuItemId: string): AuditIngredientMapping[] {
  return allMappings.value.filter(m => m.menu_item_id === menuItemId)
}

function availableIngredients(menuItemId: string): string[] {
  const used = new Set(mappingsForItem(menuItemId).map(m => m.ingredient))
  return AUDIT_INGREDIENTS.filter(ing => !used.has(ing))
}

async function addMapping(menuItemId: string) {
  const ingredient = newMappingIngredient[menuItemId]
  const qty = newMappingQty[menuItemId] || 1
  if (!ingredient) return
  await AuditService.upsertMapping(menuItemId, ingredient, qty)
  newMappingIngredient[menuItemId] = ''
  newMappingQty[menuItemId] = 1
  allMappings.value = await AuditService.getMappings()
}

async function removeMapping(id: string) {
  await AuditService.deleteMapping(id)
  allMappings.value = allMappings.value.filter(m => m.id !== id)
}

async function onSessionChange() {
  if (!selectedSessionId.value) {
    auditRows.value = []
    return
  }
  const session = sessions.value.find(s => s.id === selectedSessionId.value)
  if (!session) return

  loadingAudit.value = true
  try {
    const { start, end } = StoreSessionService.getSessionRange(session)
    const orders = await OrderService.getOrders({ status: 'completed', startDate: start, endDate: end })

    if (orders.length === 0) {
      auditRows.value = []
      cashAuditRows.value = []
      return
    }


    const cashTotal = orders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const gcashTotal = orders.filter(o => o.payment_method === 'gcash').reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const prev = cashAuditRows.value
    const prevByName = Object.fromEntries(prev.map(r => [r.name, r]))
    cashAuditRows.value = [
      { name: 'Cash', amount: cashTotal, startOfDay: prevByName['Cash']?.startOfDay ?? 0, endOfDay: prevByName['Cash']?.endOfDay ?? 0 },
      { name: 'GCash', amount: gcashTotal, startOfDay: prevByName['GCash']?.startOfDay ?? 0, endOfDay: prevByName['GCash']?.endOfDay ?? 0 },
      { name: 'Expenses', amount: 0, startOfDay: prevByName['Expenses']?.startOfDay ?? 0, endOfDay: prevByName['Expenses']?.endOfDay ?? 0 },
    ]

    const orderIds = orders.map(o => o.id)
    const [items, mappings] = await Promise.all([
      OrderService.getOrderItemsBulk(orderIds),
      AuditService.getMappings()
    ])
    allMappings.value = mappings

    // Aggregate: for each ingredient, sum qty used
    const ingredientQty: Record<string, number> = {}
    for (const item of items) {
      if (!item.menu_id) continue
      const itemMappings = mappings.filter(m => m.menu_item_id === item.menu_id)
      for (const m of itemMappings) {
        ingredientQty[m.ingredient] = (ingredientQty[m.ingredient] || 0) + item.quantity * m.quantity
      }
    }

    const baseIngredientRows = Object.entries(ingredientQty)
      .sort(([a], [b]) => AUDIT_INGREDIENTS.indexOf(a as any) - AUDIT_INGREDIENTS.indexOf(b as any))
      .map(([ingredient, quantity]) => ({
        ingredient,
        quantity,
        addOns: 0,
        yesterdayEod: 0,
        todayEod: 0
      }))

    const [cashSnap, ingSnap] = await Promise.all([
      AuditService.getCashSnapshot(selectedSessionId.value),
      AuditService.getIngredientSnapshot(selectedSessionId.value)
    ])

    const cashSnapMap = Object.fromEntries(cashSnap.map(r => [r.name, r]))
    cashAuditRows.value = cashAuditRows.value.map(row => {
      const snap = cashSnapMap[row.name]
      if (!snap) return row
      return {
        ...row,
        startOfDay: snap.start_of_day,
        endOfDay: snap.end_of_day,
        amount: row.name === 'Expenses' && snap.expense_amount !== null ? snap.expense_amount : row.amount
      }
    })

    const ingSnapMap = Object.fromEntries(ingSnap.map(r => [r.ingredient, r]))
    auditRows.value = baseIngredientRows.map(row => {
      const snap = ingSnapMap[row.ingredient]
      if (!snap) return row
      return { ...row, addOns: snap.add_ons, yesterdayEod: snap.yesterday_eod, todayEod: snap.today_eod }
    })

    // Load salary expenses for this session's date
    const sessionDate = session.opened_at.slice(0, 10)
    const salaryLabels = Object.values(SALARY_LABELS)
    const salaryExpenses = await expenseService.getByDateAndDescriptions(sessionDate, salaryLabels)
    for (const key of (['den', 'shai', 'mj'] as const)) {
      const label = SALARY_LABELS[key]
      const matching = salaryExpenses.filter(e => e.description?.toLowerCase() === label.toLowerCase())
      if (matching.length === 0) {
        salaries.value[key] = { amount: null, ids: [], hasMultiple: false }
      } else {
        salaries.value[key] = {
          amount: matching[0]?.amount ?? null,
          ids: matching.map(e => e.id),
          hasMultiple: matching.length > 1,
        }
      }
    }
  } finally {
    loadingAudit.value = false
  }
}

async function saveAudit() {
  if (!selectedSessionId.value) return
  saving.value = true
  saveMessage.value = ''
  try {
    await Promise.all([
      AuditService.saveCashSnapshot(selectedSessionId.value, cashAuditRows.value),
      AuditService.saveIngredientSnapshot(selectedSessionId.value, auditRows.value)
    ])

    const auditDate = sessionDateFor(selectedSessionId.value)

    const expensesRow = cashAuditRows.value.find(r => r.name === 'Expenses')
    const existingExpenses = await expenseService.getByDateAndDescriptions(auditDate, ["Today's expense"], 'Ingredients')
    for (const e of existingExpenses) {
      await expenseService.deleteExpense(e.id)
    }
    if (expensesRow && expensesRow.amount > 0) {
      await expenseService.addExpense({
        date: auditDate,
        category: 'Ingredients',
        description: "Today's expense",
        amount: expensesRow.amount,
        reimburse_status: 0
      })
    }
    // Replace salary rows on every save so re-saving never creates duplicates
    const existingSalaries = await expenseService.getByDateAndDescriptions(auditDate, Object.values(SALARY_LABELS))
    for (const key of (['den', 'shai', 'mj'] as const)) {
      const entry = salaries.value[key]
      const label = SALARY_LABELS[key]
      const existing = existingSalaries.filter(e => e.description?.toLowerCase() === label.toLowerCase())
      for (const e of existing) {
        await expenseService.deleteExpense(e.id)
      }
      if (entry.amount) {
        await expenseService.addExpense({
          date: auditDate,
          category: 'Labor',
          description: label,
          amount: entry.amount,
          reimburse_status: 0,
        })
      }
    }
    const savedSalaries = await expenseService.getByDateAndDescriptions(auditDate, Object.values(SALARY_LABELS))
    for (const key of (['den', 'shai', 'mj'] as const)) {
      const label = SALARY_LABELS[key]
      const matching = savedSalaries.filter(e => e.description?.toLowerCase() === label.toLowerCase())
      salaries.value[key].ids = matching.map(e => e.id)
      salaries.value[key].hasMultiple = matching.length > 1
    }

    saveMessage.value = 'Saved!'
    setTimeout(() => { saveMessage.value = '' }, 3000)
  } catch (e) {
    saveMessage.value = 'Save failed. Please try again.'
  } finally {
    saving.value = false
  }
}

function cashDifference(row: CashAuditRow): number {
  if (row.name !== 'Expenses') return row.endOfDay - (row.startOfDay + row.amount);
  return row.startOfDay - row.amount - row.endOfDay
}

function cashDifferenceLabel(diff: number): string {
  if (diff < 0) return 'Short ₱' + Math.abs(diff).toFixed(2)
  if (diff === 0) return 'Balanced'
  return 'Over ₱' + diff.toFixed(2)
}

function difference(row: AuditRow): number {
  return row.yesterdayEod - row.quantity + row.addOns - row.todayEod
}

function differenceLabel(diff: number): string {
  if (diff < 0) {
    return "Sobra " + Math.abs(diff);
  } else if (diff == 0) {
    return "Balanced";
  } else {
    return "Missing " + diff;
  } 
}

onMounted(async () => {
  loadingSessions.value = true
  try {
    sessions.value = await StoreSessionService.getAllSessions()
  } finally {
    loadingSessions.value = false
  }

  if (isAdmin.value) {
    loadingMenuItems.value = true
    try {
      const [items, mappings] = await Promise.all([
        menuItemService.getMenuItems(),
        AuditService.getMappings()
      ])
      menuItems.value = items.filter(i => i.is_active)
      allMappings.value = mappings
    } finally {
      loadingMenuItems.value = false
    }
  }
})
</script>

<style scoped>
.audit-page {
  padding: 32px;
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 28px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 24px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  cursor: pointer;
  user-select: none;
}

.section-header:hover {
  background: #f9fafb;
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.audit-section .section-title {
  padding: 18px 24px 0;
}

.chevron {
  transition: transform 0.2s;
  color: #6b7280;
}

.chevron.rotated {
  transform: rotate(180deg);
}

.mapping-content {
  padding: 0 24px 24px;
  border-top: 1px solid #f3f4f6;
}

.mapping-hint {
  font-size: 13px;
  color: #6b7280;
  margin: 12px 0 16px;
}

.menu-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.menu-item-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.menu-item-name {
  font-weight: 600;
  font-size: 14px;
  color: #374151;
  min-width: 160px;
  padding-top: 6px;
}

.mappings-for-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.mapping-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #e0f2fe;
  border-radius: 20px;
  padding: 4px 10px 4px 12px;
  font-size: 13px;
  color: #0369a1;
}

.chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #0369a1;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.7;
}

.chip-remove:hover {
  opacity: 1;
}

.add-mapping-form {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ingredient-select {
  font-size: 13px;
  padding: 5px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  cursor: pointer;
}

.qty-input {
  width: 64px;
  font-size: 13px;
  padding: 5px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  text-align: center;
}

.btn-add {
  font-size: 13px;
  padding: 5px 12px;
  background: #0e3b2e;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-add:hover {
  background: #114e43;
}

.session-select-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px 20px;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.session-select {
  font-size: 14px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  min-width: 320px;
  cursor: pointer;
}

.loading-text {
  padding: 16px 24px;
  color: #6b7280;
  font-size: 14px;
}

.empty-text {
  padding: 16px 24px 24px;
  color: #6b7280;
  font-size: 14px;
}

.table-wrapper {
  padding: 0 24px 24px;
  overflow-x: auto;
}

.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.audit-table th {
  text-align: left;
  padding: 10px 14px;
  background: #f3f4f6;
  color: #374151;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.audit-table td {
  padding: 10px 14px;
  border-bottom: 1px solid #f3f4f6;
  color: #111827;
  vertical-align: middle;
}

.audit-table tr.flagged td {
  background: #fee2e2;
}

.count-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
  background: #fff;
}

.audit-table tr.flagged .count-input {
  background: #fff;
}

.diff-cell {
  font-weight: 600;
  text-align: center;
}

.salary-section {
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
}

.salary-title {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px;
}

.salary-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.salary-note {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 14px;
  line-height: 1.5;
}

.salary-hint {
  font-size: 12px;
  color: #9ca3af;
  margin: 10px 0 0;
  line-height: 1.5;
}

.salary-label {
  font-size: 14px;
  color: #374151;
  min-width: 100px;
}

.salary-warning {
  font-size: 12px;
  color: #d97706;
  font-weight: 500;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px 24px;
}

.btn-save {
  padding: 9px 22px;
  background: #0e3b2e;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: #114e43;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-message {
  font-size: 14px;
  color: #059669;
  font-weight: 500;
}
.reminder-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
}

.reminder-modal {
  background: #fff;
  border-radius: 14px;
  padding: 24px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
  color: #111827;
}

.reminder-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
}

.reminder-text {
  margin: 8px 0;
  font-size: 14px;
  color: #374151;
}

.reminder-list {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 14px;
}

.reminder-schedule {
  color: #6b7280;
}

.reminder-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.reminder-btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}

.reminder-btn.primary {
  background: #0e3b2e;
  color: #fff;
  border: none;
}

.reminder-btn.secondary {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
}
</style>
