<template>
  <div class="expenses-page">
    <!-- Header -->
    <header class="page-header">
      <div>
        <h1>Expenses</h1>
        <p class="subtitle">Track what the business spends and who needs paying back.</p>
      </div>
      <button class="btn-primary" @click="openAddModal" title="Shortcut: N">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add expense
      </button>
    </header>

    <!-- Summary -->
    <section class="stats-grid" aria-label="Summary">
      <div class="stat-card">
        <span class="stat-label">{{ hasActiveFilters ? 'Total (filtered)' : 'Total spent' }}</span>
        <span class="stat-value">₱{{ formatCurrency(totalExpenses) }}</span>
        <span class="stat-hint">{{ filteredExpenses.length }} {{ filteredExpenses.length === 1 ? 'expense' : 'expenses' }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">This month</span>
        <span class="stat-value">₱{{ formatCurrency(thisMonthTotal) }}</span>
        <span class="stat-hint">{{ currentMonthLabel }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Average expense</span>
        <span class="stat-value">₱{{ formatCurrency(averageExpense) }}</span>
        <span class="stat-hint">{{ totalCategories }} {{ totalCategories === 1 ? 'category' : 'categories' }}</span>
      </div>
      <button
        type="button"
        class="stat-card stat-card--action"
        :class="{ active: selectedReimburseStatus === '1', attention: pendingReimburse.count > 0 }"
        @click="toggleReimburseFilter"
      >
        <span class="stat-label">Awaiting reimbursement</span>
        <span class="stat-value">₱{{ formatCurrency(pendingReimburse.total) }}</span>
        <span class="stat-hint">
          {{ pendingReimburse.count }} unpaid ·
          {{ selectedReimburseStatus === '1' ? 'showing only these' : 'click to view' }}
        </span>
      </button>
    </section>

    <p v-if="actionError" class="banner-error" role="alert">
      {{ actionError }}
      <button class="banner-dismiss" @click="actionError = ''" aria-label="Dismiss">×</button>
    </p>

    <div class="content-grid">
      <!-- Table card -->
      <section class="card table-card">
        <div class="toolbar">
          <div class="search-container">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="search"
              class="search-input"
              placeholder="Search description, category, payer…"
              v-model="searchQuery"
            />
          </div>

          <select v-model="selectedCategory" class="control" aria-label="Category" :class="{ 'is-set': selectedCategory }">
            <option value="">All categories</option>
            <option v-for="cat in EXPENSE_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
          </select>

          <select
            v-model="selectedReimburseStatus"
            class="control"
            data-testid="reimburse-select"
            aria-label="Reimbursement status"
            :class="{ 'is-set': selectedReimburseStatus !== '' }"
          >
            <option value="">Any status</option>
            <option value="1">Needs reimbursement</option>
            <option value="2">Reimbursed</option>
            <option value="0">No reimbursement</option>
          </select>

          <div class="date-range" :class="{ 'is-set': startDate || endDate }">
            <input type="date" v-model="startDate" aria-label="From date" />
            <span class="date-sep">to</span>
            <input type="date" v-model="endDate" aria-label="To date" />
          </div>

          <button v-if="hasActiveFilters" class="clear-filters-btn" @click="clearFilters">
            Clear filters
          </button>
        </div>

        <div v-if="isLoading" class="state">
          <div class="spinner"></div>
          <p>Loading expenses…</p>
        </div>

        <div v-else-if="error" class="state state--error">
          <p>{{ error }}</p>
          <button class="btn-secondary" @click="loadExpenses()">Try again</button>
        </div>

        <div v-else-if="filteredExpenses.length === 0" class="state">
          <template v-if="expenses.length === 0">
            <h3>No expenses yet</h3>
            <p>Log your first one. It takes a few seconds.</p>
            <button class="btn-primary" @click="openAddModal">Add expense</button>
          </template>
          <template v-else>
            <h3>No matching expenses</h3>
            <p>Nothing fits these filters.</p>
            <button class="btn-secondary" @click="clearFilters">Clear filters</button>
          </template>
        </div>

        <div v-else class="table-scroll">
          <table class="expenses-table">
            <thead>
              <tr>
                <th class="col-date">Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Paid by</th>
                <th>Status</th>
                <th class="col-amount">Amount</th>
                <th class="col-actions"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="expense in filteredExpenses"
                :key="expense.id"
                class="table-row"
                tabindex="0"
                @click="openEditModal(expense)"
                @keydown.enter.self="openEditModal(expense)"
              >
                <td class="col-date">{{ formatDate(expense.expense_date) }}</td>
                <td class="description-cell">
                  <span class="description-text" :title="expense.description">{{ expense.description }}</span>
                  <span v-if="expense.supplier_id" class="supplier-text">{{ expense.supplier_id }}</span>
                </td>
                <td>
                  <span class="category-tag" :style="{ '--cat': categoryColor(expense.category) }">
                    {{ expense.category }}
                  </span>
                </td>
                <td class="muted-cell">{{ expense.paid_by || '—' }}</td>
                <td>
                  <span v-if="expense.reimburse_status === 1" class="status status--due">Needs reimbursement</span>
                  <span v-else-if="expense.reimburse_status === 2" class="status status--done">Reimbursed</span>
                  <span v-else class="status status--none">—</span>
                </td>
                <td class="col-amount amount-cell">₱{{ formatCurrency(expense.amount) }}</td>
                <td class="col-actions" @click.stop>
                  <div class="action-buttons">
                    <button
                      v-if="expense.reimburse_status === 1"
                      class="mark-paid-btn"
                      :disabled="markingId === expense.id"
                      @click="markReimbursed(expense)"
                      title="Mark as reimbursed"
                    >
                      Mark paid
                    </button>
                    <button class="action-btn" @click="openEditModal(expense)" aria-label="Edit expense" title="Edit">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>
                    <button class="action-btn action-btn--danger" @click="deleteExpense(expense)" aria-label="Delete expense" title="Delete">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Category breakdown -->
      <aside v-if="categoryRows.length > 0" class="card breakdown-card">
        <h2>By category</h2>
        <ul class="category-list">
          <li v-for="row in categoryRows" :key="row.category">
            <button
              type="button"
              class="category-row"
              :class="{ active: selectedCategory === row.category }"
              @click="selectedCategory = selectedCategory === row.category ? '' : row.category"
            >
              <span class="category-row-top">
                <span class="dot" :style="{ background: categoryColor(row.category) }"></span>
                <span class="category-name">{{ row.category }}</span>
                <span class="category-amount">₱{{ formatCurrency(row.amount) }}</span>
              </span>
              <span class="category-progress">
                <span
                  class="category-progress-bar"
                  :style="{ width: row.percent + '%', background: categoryColor(row.category) }"
                ></span>
              </span>
              <span class="category-percentage">{{ row.percent.toFixed(1) }}%</span>
            </button>
          </li>
        </ul>
      </aside>
    </div>

    <ExpenseModal
      :is-open="isModalOpen"
      :is-edit-mode="isEditMode"
      :initial-data="editingExpense"
      :history="expenses"
      :save="saveExpense"
      :remove="editingExpense ? removeEditingExpense : null"
      @close="closeModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ExpenseModal, { type ExpenseFormData } from './ExpenseModal.vue'
import { expenseService } from '../services/expenseService'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_COLORS,
  type Expense,
  type ExpenseCategory,
} from '../models/Expense'
import {
  calculateTotalExpenses,
  calculateExpensesByCategory,
  calculateAverageExpense,
} from '../modules/expenses/expenseUtils'

type EditingExpense = ExpenseFormData & { id: string }

const expenses = ref<Expense[]>([])
const isLoading = ref(true)
const error = ref('')
const actionError = ref('')
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedReimburseStatus = ref('')
const startDate = ref('')
const endDate = ref('')
const isModalOpen = ref(false)
const isEditMode = ref(false)
const editingExpense = ref<EditingExpense | null>(null)
const markingId = ref<string | null>(null)

// `silent` refreshes without swapping the table for a spinner.
const loadExpenses = async (silent = false) => {
  try {
    if (!silent) isLoading.value = true
    error.value = ''
    expenses.value = await expenseService.getAll()
  } catch (err) {
    console.error('Error loading expenses:', err)
    if (silent) actionError.value = 'Saved, but the list could not refresh. Reload the page to see it.'
    else error.value = 'Failed to load expenses.'
  } finally {
    isLoading.value = false
  }
}

const dateOnly = (d: string) => (d || '').slice(0, 10)

const filteredExpenses = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const status = selectedReimburseStatus.value === '' ? null : Number(selectedReimburseStatus.value)

  return expenses.value
    .filter(e => {
      if (query) {
        const hit =
          e.description?.toLowerCase().includes(query) ||
          e.category?.toLowerCase().includes(query) ||
          e.paid_by?.toLowerCase().includes(query) ||
          e.supplier_id?.toLowerCase().includes(query)
        if (!hit) return false
      }
      if (selectedCategory.value && e.category !== selectedCategory.value) return false
      const d = dateOnly(e.expense_date)
      if (startDate.value && d < startDate.value) return false
      if (endDate.value && d > endDate.value) return false
      if (status !== null && Number(e.reimburse_status ?? 0) !== status) return false
      return true
    })
    .sort((a, b) => dateOnly(b.expense_date).localeCompare(dateOnly(a.expense_date)))
})

const hasActiveFilters = computed(() =>
  Boolean(searchQuery.value || selectedCategory.value || selectedReimburseStatus.value !== '' || startDate.value || endDate.value)
)

const totalExpenses = computed(() => calculateTotalExpenses(filteredExpenses.value))
const averageExpense = computed(() => calculateAverageExpense(filteredExpenses.value))
const expensesByCategory = computed(() => calculateExpensesByCategory(filteredExpenses.value))
const totalCategories = computed(() => Object.keys(expensesByCategory.value).length)

const categoryRows = computed(() => {
  const total = totalExpenses.value
  return Object.entries(expensesByCategory.value)
    .map(([category, amount]) => ({ category, amount, percent: total ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
})

const now = new Date()
const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

const thisMonthTotal = computed(() =>
  calculateTotalExpenses(expenses.value.filter(e => dateOnly(e.expense_date).startsWith(monthPrefix)))
)

const pendingReimburse = computed(() => {
  const due = expenses.value.filter(e => Number(e.reimburse_status) === 1)
  return { count: due.length, total: calculateTotalExpenses(due) }
})

const toggleReimburseFilter = () => {
  selectedReimburseStatus.value = selectedReimburseStatus.value === '1' ? '' : '1'
}

const openAddModal = () => {
  isEditMode.value = false
  editingExpense.value = null
  isModalOpen.value = true
}

const openEditModal = (expense: Expense) => {
  isEditMode.value = true
  editingExpense.value = {
    id: expense.id,
    expense_date: dateOnly(expense.expense_date),
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    supplier_id: expense.supplier_id || '',
    paid_by: expense.paid_by || '',
    reimburse_status: expense.reimburse_status || 0,
  }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  isEditMode.value = false
  editingExpense.value = null
}

const toServicePayload = (data: ExpenseFormData) => ({
  date: data.expense_date,
  category: data.category,
  description: data.description,
  amount: data.amount,
  supplier_id: data.supplier_id,
  paid_by: data.paid_by,
  reimburse_status: data.reimburse_status,
})

// The modal awaits this, shows its own saving/error state, and decides whether to close.
const saveExpense = async (data: ExpenseFormData) => {
  if (isEditMode.value && editingExpense.value) {
    await expenseService.updateExpense({ id: editingExpense.value.id, ...toServicePayload(data) })
  } else {
    await expenseService.addExpense(toServicePayload(data))
  }
  await loadExpenses(true)
}

const removeEditingExpense = async () => {
  if (!editingExpense.value) return
  await expenseService.deleteExpense(editingExpense.value.id)
  await loadExpenses(true)
}

const deleteExpense = async (expense: Expense) => {
  if (!confirm(`Delete "${expense.description}"? This can't be undone.`)) return
  try {
    await expenseService.deleteExpense(expense.id)
    expenses.value = expenses.value.filter(e => e.id !== expense.id)
  } catch (err) {
    console.error('Error deleting expense:', err)
    actionError.value = 'Could not delete that expense. Try again.'
  }
}

// One-click status change for the most common edit.
const markReimbursed = async (expense: Expense) => {
  markingId.value = expense.id
  try {
    await expenseService.updateExpense({
      id: expense.id,
      date: dateOnly(expense.expense_date),
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      supplier_id: expense.supplier_id,
      paid_by: expense.paid_by,
      reimburse_status: 2,
    })
    expense.reimburse_status = 2
  } catch (err) {
    console.error('Error updating expense:', err)
    actionError.value = 'Could not mark that expense as reimbursed. Try again.'
  } finally {
    markingId.value = null
  }
}

const formatCurrency = (value: number): string =>
  (value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDate = (dateString: string): string => {
  const [y, m, d] = dateOnly(dateString).split('-').map(Number)
  if (!y || !m || !d) return dateString
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(y !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

const categoryColor = (category: string) =>
  EXPENSE_CATEGORY_COLORS[category as ExpenseCategory] ?? '#64748b'

const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedReimburseStatus.value = ''
  startDate.value = ''
  endDate.value = ''
}

// "N" opens the add form, unless the user is typing somewhere.
const onGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'n' && e.key !== 'N') return
  if (e.metaKey || e.ctrlKey || e.altKey || isModalOpen.value) return
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
  e.preventDefault()
  openAddModal()
}

onMounted(() => {
  loadExpenses()
  window.addEventListener('keydown', onGlobalKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))
</script>

<style scoped>
.expenses-page {
  --primary: #5a67d8;
  --primary-hover: #4c51bf;
  --primary-soft: #eef0ff;
  --text: #1f2937;
  --muted: #6b7280;
  --subtle: #9ca3af;
  --border: #e5e7eb;
  --surface: #ffffff;
  --row-hover: #f9fafb;

  color: var(--text);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 20px;
}
.page-header h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 0.9rem; }

/* Buttons */
.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.btn-primary { background: var(--primary); color: #fff; border: 1px solid var(--primary); }
.btn-primary:hover { background: var(--primary-hover); }
.btn-secondary { background: #fff; color: #374151; border: 1px solid var(--border); }
.btn-secondary:hover { background: var(--row-hover); }

/* Summary */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  text-align: left;
  font: inherit;
  color: inherit;
  min-width: 0;
}
.stat-card--action { cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.stat-card--action:hover { border-color: #c7cbe0; }
.stat-card--action.attention .stat-value { color: #b45309; }
.stat-card--action.active { border-color: var(--primary); background: var(--primary-soft); }
.stat-label { font-size: 0.78rem; font-weight: 600; color: var(--muted); }
.stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-hint { font-size: 0.75rem; color: var(--subtle); }

.banner-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.88rem;
}
.banner-dismiss {
  border: none;
  background: none;
  color: inherit;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
}

/* Layout */
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  align-items: start;
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.table-card { overflow: hidden; }
.content-grid > .table-card:only-child { grid-column: 1 / -1; }

/* Toolbar */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--border);
}
.search-container { position: relative; flex: 1 1 220px; min-width: 180px; }
.search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--subtle);
  pointer-events: none;
}
.search-input,
.control,
.date-range {
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 0.85rem;
  color: var(--text);
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.search-input { width: 100%; padding: 0 10px 0 32px; }
.control { padding: 0 8px; cursor: pointer; }
.search-input:focus,
.control:focus,
.date-range:focus-within {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.15);
}
.control.is-set,
.date-range.is-set { border-color: var(--primary); background: var(--primary-soft); }

.date-range { display: inline-flex; align-items: center; padding: 0 6px; gap: 2px; }
.date-range input {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 0.85rem;
  color: var(--text);
  outline: none;
  width: 122px;
}
.date-sep { color: var(--subtle); font-size: 0.8rem; }

.clear-filters-btn {
  height: 36px;
  padding: 0 10px;
  border: none;
  background: none;
  color: var(--primary);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
}
.clear-filters-btn:hover { background: var(--primary-soft); }

/* States */
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 56px 24px;
  text-align: center;
  color: var(--muted);
}
.state h3 { margin: 0; color: var(--text); font-size: 1rem; }
.state p { margin: 0 0 8px; font-size: 0.88rem; }
.state--error { color: #b91c1c; }
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #eef0f4;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 8px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Table */
.table-scroll { overflow-x: auto; }
.expenses-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.expenses-table th {
  position: sticky;
  top: 0;
  background: #fafafa;
  padding: 10px 14px;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.expenses-table td {
  padding: 11px 14px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}
.table-row { cursor: pointer; transition: background 0.1s; }
.table-row:hover,
.table-row:focus-visible { background: var(--row-hover); outline: none; }
.table-row:last-child td { border-bottom: none; }

.col-date { white-space: nowrap; color: var(--muted); width: 1%; }
.col-amount { text-align: right !important; white-space: nowrap; }
.col-actions { width: 1%; white-space: nowrap; }

.description-cell { max-width: 320px; }
.description-text {
  display: block;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.supplier-text { display: block; font-size: 0.75rem; color: var(--subtle); }
.muted-cell { color: var(--muted); white-space: nowrap; }

.amount-cell { font-weight: 600; font-variant-numeric: tabular-nums; }

.category-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}
.category-tag::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cat);
  flex-shrink: 0;
}

.status { font-size: 0.78rem; font-weight: 600; white-space: nowrap; }
.status--due {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
}
.status--done {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
}
.status--none { color: #d1d5db; font-weight: 400; }

.action-buttons { display: flex; align-items: center; justify-content: flex-end; gap: 2px; }
.action-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--subtle);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s, color 0.1s;
}
.table-row:hover .action-btn,
.table-row:focus-within .action-btn { opacity: 1; }
.action-btn:hover { background: #f3f4f6; color: var(--text); }
.action-btn--danger:hover { background: #fef2f2; color: #dc2626; }

.mark-paid-btn {
  height: 28px;
  padding: 0 10px;
  margin-right: 4px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  color: #166534;
  cursor: pointer;
  white-space: nowrap;
}
.mark-paid-btn:hover:not(:disabled) { border-color: #86efac; background: #f0fdf4; }
.mark-paid-btn:disabled { opacity: 0.5; cursor: wait; }

/* Breakdown */
.breakdown-card { padding: 16px; position: sticky; top: 16px; }
.breakdown-card h2 {
  margin: 0 0 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}
.category-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.category-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 4px 8px;
  width: 100%;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.category-row:hover { background: var(--row-hover); }
.category-row.active { background: var(--primary-soft); border-color: #c7cdf5; }
.category-row-top { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.category-name { flex: 1; font-size: 0.85rem; font-weight: 500; }
.category-amount { font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.category-progress { height: 4px; background: #f3f4f6; border-radius: 2px; overflow: hidden; }
.category-progress-bar { display: block; height: 100%; border-radius: 2px; transition: width 0.3s ease; }
.category-percentage { font-size: 0.72rem; color: var(--subtle); font-variant-numeric: tabular-nums; min-width: 38px; text-align: right; }

/* Responsive */
@media (max-width: 1100px) {
  .content-grid { grid-template-columns: 1fr; }
  .breakdown-card { position: static; }
  .category-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px 12px; }
}

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 600px) {
  .page-header { flex-direction: column; align-items: stretch; }
  .page-header h1 { font-size: 1.35rem; }
  .stat-value { font-size: 1.15rem; }
  .stat-card { padding: 12px 14px; }
  .toolbar > * { flex: 1 1 100%; }
  .date-range input { width: auto; flex: 1; min-width: 0; }
  .action-btn { opacity: 1; }
  .expenses-table { min-width: 720px; }
}

@media (hover: none) {
  .action-btn { opacity: 1; }
}
</style>
