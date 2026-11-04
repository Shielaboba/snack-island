<template>
  <div class="ledger-page">
    <div class="page-header">
      <div class="header-text">
        <h1>Ledger</h1>
        <p>Auditor cash, expense wallet, and GCash</p>
      </div>
      <div class="header-actions">
        <button data-testid="remit-owner-btn" class="btn-secondary" type="button" @click="openRemit">
          Remit to owner
        </button>
        <button data-testid="add-entry-btn" class="btn-primary" type="button" @click="openAdd">
          Add entry
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <button
        v-for="card in walletCards"
        :key="card.wallet"
        type="button"
        class="stat-card"
        :class="[card.tone, { active: walletFilter === card.wallet }]"
        :data-testid="card.cardTestId"
        @click="toggleWalletFilter(card.wallet)"
      >
        <div class="stat-icon" :class="card.tone" aria-hidden="true">
          <svg v-if="card.wallet === 'auditor_cash'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="6" width="20" height="12" rx="2"></rect>
            <circle cx="12" cy="12" r="2.5"></circle>
            <path d="M6 12h.01M18 12h.01"></path>
          </svg>
          <svg v-else-if="card.wallet === 'expense'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path>
            <path d="M12 12v.01"></path>
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="2" width="12" height="20" rx="2"></rect>
            <path d="M12 18h.01"></path>
          </svg>
        </div>
        <div class="stat-content">
          <span class="stat-label">{{ card.label }}</span>
          <span
            class="stat-value"
            :class="{ negative: card.amount < 0 }"
            :data-testid="card.amountTestId"
          >₱{{ formatCurrency(card.amount) }}</span>
          <span class="stat-hint">{{ card.hint }}</span>
        </div>
      </button>
    </div>

    <section class="week-strip" data-testid="week-strip">
      <div class="week-strip-header">
        <h2>This week</h2>
        <p>{{ weekRangeLabel }}</p>
      </div>
      <div class="week-metrics">
        <article
          v-for="metric in weekCards"
          :key="metric.id"
          class="week-metric"
          :class="metric.tone"
          :data-testid="metric.cardTestId"
        >
          <div class="week-metric-icon" :class="metric.tone" aria-hidden="true">
            <svg v-if="metric.id === 'pos'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3v12"></path>
              <path d="m8 11 4 4 4-4"></path>
              <path d="M5 19h14"></path>
            </svg>
            <svg v-else-if="metric.id === 'expense'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 21V9"></path>
              <path d="m16 13-4-4-4 4"></path>
              <path d="M5 5h14"></path>
            </svg>
            <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 11h-6"></path>
            </svg>
          </div>
          <div class="week-metric-content">
            <span class="week-metric-label">{{ metric.label }}</span>
            <span class="week-metric-value" :data-testid="metric.amountTestId">
              ₱{{ formatCurrency(metric.amount) }}
            </span>
            <span class="week-metric-hint">{{ metric.hint }}</span>
          </div>
        </article>
      </div>
    </section>

    <div class="filters-section">
      <div class="filter-group">
        <label class="filter-label">Start Date</label>
        <input type="date" v-model="startDate" class="filter-input" />
      </div>
      <div class="filter-group">
        <label class="filter-label">End Date</label>
        <input type="date" v-model="endDate" class="filter-input" />
      </div>
      <div class="filter-group">
        <label class="filter-label">Wallet</label>
        <select v-model="walletFilter" class="filter-select" data-testid="wallet-filter">
          <option value="">All wallets</option>
          <option v-for="wallet in LEDGER_WALLETS" :key="wallet" :value="wallet">
            {{ ledgerWalletLabel(wallet) }}
          </option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Type</label>
        <select v-model="typeFilter" class="filter-select">
          <option value="">All types</option>
          <option v-for="entryType in LEDGER_ENTRY_TYPES" :key="entryType" :value="entryType">
            {{ ledgerTypeLabel(entryType) }}
          </option>
        </select>
      </div>
    </div>

    <p v-if="error && !modalOpen && !deleteOpen" class="error-state">{{ error }}</p>
    <p v-if="isLoading" class="empty-state">Loading ledger…</p>
    <p v-else-if="visibleRows.length === 0" class="empty-state">
      No lines in this range. Add starting cash or record a remittance from the POS.
    </p>
    <table v-else class="ledger-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Category</th>
          <th>Wallet</th>
          <th>Amount</th>
          <th>Daily remaining</th>
          <th>Note</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in pagedRows"
          :key="row.id"
          class="table-row"
          :class="{ 'table-row-alt': index % 2 === 1 }"
        >
          <td>{{ row.entry_date }}</td>
          <td>{{ ledgerTypeLabel(row.type) }}</td>
          <td>{{ row.category || '—' }}</td>
          <td>{{ walletCell(row) }}</td>
          <td>
            <div>{{ signedAmount(row) }}</div>
            <div v-if="row.type === 'pos_remittance'" class="amount-split">
              Sales ₱{{ formatCurrency(row.total_sales ?? 0) }}
              · Petty ₱{{ formatCurrency(row.petty_cash_returned ?? row.amount) }}
            </div>
          </td>
          <td>₱{{ formatCurrency(dailyRemaining(entries, row.wallet, row.entry_date)) }}</td>
          <td>{{ row.note || '—' }}</td>
          <td>
            <div class="action-buttons">
              <button
                type="button"
                class="action-btn edit"
                data-testid="edit-entry-btn"
                aria-label="Edit"
                title="Edit"
                @click="openEdit(row)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                type="button"
                class="action-btn delete"
                data-testid="delete-entry-btn"
                aria-label="Delete"
                title="Delete"
                @click="openDelete(row)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <nav
      v-if="!isLoading && visibleRows.length > LEDGER_PAGE_SIZE"
      class="pagination"
      data-testid="ledger-pagination"
      aria-label="Ledger pages"
    >
      <button
        type="button"
        class="page-btn"
        data-testid="ledger-page-prev"
        :disabled="page === 1"
        @click="goToPage(page - 1)"
      >
        Prev
      </button>
      <button
        v-for="n in pageCount"
        :key="n"
        type="button"
        class="page-btn"
        :class="{ active: n === page }"
        :data-testid="`ledger-page-${n}`"
        @click="goToPage(n)"
      >
        {{ n }}
      </button>
      <button
        type="button"
        class="page-btn"
        data-testid="ledger-page-next"
        :disabled="page === pageCount"
        @click="goToPage(page + 1)"
      >
        Next
      </button>
    </nav>

    <LedgerEntryModal
      :is-open="modalOpen"
      :mode="modalMode"
      :entry="editing"
      :error="modalOpen ? error : ''"
      :saving="isSaving"
      @submit="onSubmit"
      @close="closeModal"
    />
    <LedgerDeleteModal
      :is-open="deleteOpen"
      :entry="pendingDelete"
      :deleting="isSaving"
      :error="deleteOpen ? error : ''"
      @confirm="confirmDelete"
      @close="closeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import LedgerEntryModal from './LedgerEntryModal.vue'
import LedgerDeleteModal from './LedgerDeleteModal.vue'
import { authService } from '../services/authService'
import { ledgerService } from '../services/ledgerService'
import { LEDGER_ENTRY_TYPES, LEDGER_WALLETS, type CreateLedgerEntryInput, type LedgerEntry, type LedgerWallet } from '../models/Ledger'
import {
  LEDGER_PAGE_SIZE,
  dailyRemaining,
  entriesInDateRange,
  entryDelta,
  ledgerPageCount,
  ledgerTransferRoute,
  ledgerTypeLabel,
  ledgerWalletLabel,
  manilaWeekWindow,
  paginateRows,
  walletRemaining,
  weekSummary
} from '../modules/ledger/ledgerUtils'

const entries = ref<LedgerEntry[]>([])
const error = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const modalOpen = ref(false)
const deleteOpen = ref(false)
const modalMode = ref<'add' | 'remit-owner' | 'edit'>('add')
const editing = ref<LedgerEntry | null>(null)
const pendingDelete = ref<LedgerEntry | null>(null)
const week = manilaWeekWindow()
const startDate = ref(week.start)
const endDate = ref(week.end)
const walletFilter = ref('')
const typeFilter = ref('')
const page = ref(1)

const auditorRemaining = computed(() => walletRemaining(entries.value, 'auditor_cash'))
const expenseRemaining = computed(() => walletRemaining(entries.value, 'expense'))
const gcashRemaining = computed(() => walletRemaining(entries.value, 'gcash'))
const walletCards = computed(() => [
  {
    wallet: 'auditor_cash' as LedgerWallet,
    tone: 'auditor',
    label: 'Auditor cash',
    hint: 'Held by auditor',
    amount: auditorRemaining.value,
    cardTestId: 'auditor-card',
    amountTestId: 'auditor-remaining'
  },
  {
    wallet: 'expense' as LedgerWallet,
    tone: 'expense',
    label: 'Expense wallet',
    hint: 'Operating spends',
    amount: expenseRemaining.value,
    cardTestId: 'expense-card',
    amountTestId: 'expense-remaining'
  },
  {
    wallet: 'gcash' as LedgerWallet,
    tone: 'gcash',
    label: 'GCash',
    hint: 'Digital wallet',
    amount: gcashRemaining.value,
    cardTestId: 'gcash-card',
    amountTestId: 'gcash-remaining'
  }
])
const summary = computed(() => weekSummary(entries.value, week))
const weekRangeLabel = computed(() => formatWeekRange(week.start, week.end))
const weekCards = computed(() => [
  {
    id: 'pos',
    tone: 'in',
    label: 'In from POS',
    hint: 'Cart cash remittance',
    amount: summary.value.posRemittanceIn,
    cardTestId: 'week-pos-card',
    amountTestId: 'week-pos-in'
  },
  {
    id: 'expense',
    tone: 'out',
    label: 'Expenses out',
    hint: 'Total Expense this week',
    amount: summary.value.expensesOut,
    cardTestId: 'week-expense-card',
    amountTestId: 'week-expenses'
  },
  {
    id: 'owner',
    tone: 'remit',
    label: 'Remitted to owner',
    hint: 'Chosen weekly remit',
    amount: summary.value.ownerRemittance,
    cardTestId: 'week-owner-card',
    amountTestId: 'week-owner'
  }
])
const visibleRows = computed(() => {
  let rows = entriesInDateRange(
    entries.value,
    startDate.value || '0000-01-01',
    endDate.value || '9999-12-31'
  )
  if (walletFilter.value) rows = rows.filter((row) => row.wallet === walletFilter.value)
  if (typeFilter.value) rows = rows.filter((row) => row.type === typeFilter.value)
  return rows.filter((row, index, list) => {
    if (!row.transfer_id) return true
    if (row.type === 'fund_transfer') {
      const pair = list.filter((other) => other.transfer_id === row.transfer_id)
      const source = pair.find((other) => other.wallet === other.transfer_from) ?? pair[0]
      return row.id === source?.id
    }
    if (row.type !== 'fund_expense') return true
    return list.findIndex((other) => other.transfer_id === row.transfer_id) === index
  })
})
const pageCount = computed(() => ledgerPageCount(visibleRows.value.length))
const pagedRows = computed(() => paginateRows(visibleRows.value, page.value))

watch([startDate, endDate, walletFilter, typeFilter], () => {
  page.value = 1
})

watch(visibleRows, (rows) => {
  const maxPage = ledgerPageCount(rows.length)
  if (page.value > maxPage) page.value = maxPage
})

function goToPage(next: number) {
  page.value = Math.min(Math.max(1, next), pageCount.value)
}

async function load() {
  isLoading.value = true
  error.value = ''
  try {
    entries.value = await ledgerService.list()
  } catch {
    error.value = 'Could not load ledger. Refresh to try again.'
    entries.value = []
  } finally {
    isLoading.value = false
  }
}

function formatCurrency(value: number): string {
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatWeekRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  const startLabel = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  })
  const endLabel = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
  return `${startLabel} – ${endLabel}`
}

function signedAmount(row: LedgerEntry): string {
  if (row.type === 'fund_transfer') {
    return `₱${formatCurrency(row.amount)}`
  }
  const value = entryDelta(row)[row.wallet]
  const abs = formatCurrency(Math.abs(value))
  return value < 0 ? `-₱${abs}` : `₱${abs}`
}

function walletCell(row: LedgerEntry): string {
  if (row.type === 'fund_transfer') {
    return ledgerTransferRoute(row) ?? ledgerWalletLabel(row.wallet)
  }
  return ledgerWalletLabel(row.wallet)
}

function toggleWalletFilter(wallet: LedgerWallet) {
  walletFilter.value = walletFilter.value === wallet ? '' : wallet
}

function openAdd() {
  error.value = ''
  modalMode.value = 'add'
  editing.value = null
  modalOpen.value = true
}

function openRemit() {
  error.value = ''
  modalMode.value = 'remit-owner'
  editing.value = null
  modalOpen.value = true
}

function openEdit(row: LedgerEntry) {
  error.value = ''
  modalMode.value = 'edit'
  editing.value = row
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

async function onSubmit(input: CreateLedgerEntryInput) {
  if (isSaving.value) return
  isSaving.value = true
  error.value = ''
  const payload = {
    ...input,
    created_by: authService.getCurrentUser()?.username ?? null
  }
  try {
    if (modalMode.value === 'edit' && editing.value) {
      await ledgerService.update(editing.value.id, payload, entries.value)
    } else {
      await ledgerService.create(payload, entries.value)
    }
    modalOpen.value = false
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save ledger entry.'
  } finally {
    isSaving.value = false
  }
}

function openDelete(row: LedgerEntry) {
  error.value = ''
  pendingDelete.value = row
  deleteOpen.value = true
}

function closeDelete() {
  if (isSaving.value) return
  deleteOpen.value = false
  pendingDelete.value = null
}

async function confirmDelete() {
  const row = pendingDelete.value
  if (!row || isSaving.value) return
  isSaving.value = true
  error.value = ''
  try {
    await ledgerService.remove(row.id, entries.value)
    deleteOpen.value = false
    pendingDelete.value = null
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete ledger entry.'
  } finally {
    isSaving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.ledger-page { padding: 0; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}
.header-text h1 {
  margin: 0 0 0.25rem;
  font-size: 2rem;
  color: #212529;
  font-weight: 700;
}
.header-text p { margin: 0; color: #6c757d; font-size: 0.95rem; }
.header-actions { display: flex; gap: 12px; }
.btn-primary,
.btn-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}
.btn-secondary {
  background: white;
  color: #495057;
  border: 2px solid #e9ecef;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}
.stat-card {
  background: white;
  padding: 1.35rem 1.5rem;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: left;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}
.stat-card.active {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}
.stat-card.auditor.active { border-color: #667eea; }
.stat-card.expense.active { border-color: #f6a54c; }
.stat-card.gcash.active { border-color: #007dff; }
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
}
.stat-icon.auditor {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.stat-icon.expense {
  background: linear-gradient(135deg, #f6a54c 0%, #ee7b3a 100%);
}
.stat-icon.gcash {
  background: linear-gradient(135deg, #007dff 0%, #00c2ff 100%);
}
.stat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.stat-label {
  font-size: 0.85rem;
  color: #6c757d;
  font-weight: 600;
}
.stat-value {
  font-size: 1.55rem;
  font-weight: 700;
  color: #212529;
  letter-spacing: -0.02em;
}
.stat-value.negative { color: #dc3545; }
.stat-hint {
  font-size: 0.78rem;
  color: #868e96;
  margin-top: 0.1rem;
}
.week-strip {
  margin-bottom: 1.5rem;
}
.week-strip-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0.75rem;
}
.week-strip-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #212529;
}
.week-strip-header p {
  margin: 0;
  font-size: 0.85rem;
  color: #868e96;
  font-weight: 600;
}
.week-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.week-metric {
  background: white;
  padding: 1.2rem 1.35rem;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #f1f3f5;
}
.week-metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
}
.week-metric-icon.in {
  background: linear-gradient(135deg, #2bb673 0%, #1f9d5c 100%);
}
.week-metric-icon.out {
  background: linear-gradient(135deg, #f6a54c 0%, #ee7b3a 100%);
}
.week-metric-icon.remit {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.week-metric-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.week-metric-label {
  font-size: 0.82rem;
  color: #6c757d;
  font-weight: 600;
}
.week-metric-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: #212529;
  letter-spacing: -0.02em;
}
.week-metric-hint {
  font-size: 0.75rem;
  color: #868e96;
  margin-top: 0.1rem;
}
.filters-section {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: end;
}
.filter-group { display: flex; flex-direction: column; gap: 0.5rem; min-width: 150px; }
.filter-label { font-size: 0.85rem; color: #495057; font-weight: 600; }
.filter-select,
.filter-input {
  padding: 12px 14px;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  font-size: 0.9rem;
  background: white;
}
.error-state,
.empty-state { color: #6c757d; text-align: center; padding: 2rem; }
.ledger-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}
.ledger-table th,
.ledger-table td {
  padding: 0.9rem 1rem;
  text-align: left;
  border-bottom: 1px solid #f1f3f5;
}
.ledger-table th { color: #6c757d; font-size: 0.8rem; text-transform: uppercase; background: #fff; }
.table-row { background: #fff; }
.table-row-alt { background: #f4f6fb; }
.table-row:hover { background: #eef1f8; }
.ledger-table th:last-child,
.ledger-table td:last-child {
  position: sticky;
  right: 0;
  z-index: 1;
  box-shadow: -8px 0 8px -8px rgba(0, 0, 0, 0.12);
}
.ledger-table td:last-child { background: #fff; }
.table-row-alt td:last-child { background: #f4f6fb; }
.table-row:hover td:last-child { background: #eef1f8; }
.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 1rem;
  flex-wrap: wrap;
}
.page-btn {
  min-width: 40px;
  padding: 8px 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  background: white;
  color: #495057;
  font-weight: 600;
  cursor: pointer;
}
.page-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
}
.page-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.amount-split {
  font-size: 0.75rem;
  color: #868e96;
  font-weight: 500;
  margin-top: 0.2rem;
}
.action-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.action-btn {
  padding: 8px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.action-btn.edit { color: #667eea; }
.action-btn.edit:hover { background: #f0f3ff; }
.action-btn.delete { color: #dc3545; }
.action-btn.delete:hover { background: #ffebee; }
@media (max-width: 768px) {
  .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .stats-grid,
  .week-metrics { grid-template-columns: 1fr; }
  .week-strip-header { flex-direction: column; align-items: flex-start; }
}
</style>
