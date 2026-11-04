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

    <div class="week-strip">
      <div>In from POS <span data-testid="week-pos-in">₱{{ formatCurrency(summary.posRemittanceIn) }}</span></div>
      <div>Expenses out <span data-testid="week-expenses">₱{{ formatCurrency(summary.expensesOut) }}</span></div>
      <div>Remitted to owner <span data-testid="week-owner">₱{{ formatCurrency(summary.ownerRemittance) }}</span></div>
    </div>

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
        <tr v-for="row in visibleRows" :key="row.id" class="table-row">
          <td>{{ row.entry_date }}</td>
          <td>{{ ledgerTypeLabel(row.type) }}</td>
          <td>{{ row.category || '—' }}</td>
          <td>{{ ledgerWalletLabel(row.wallet) }}</td>
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
            <button type="button" class="link-btn" @click="openEdit(row)">Edit</button>
            <button type="button" class="link-btn" data-testid="delete-entry-btn" @click="openDelete(row)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

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
import { computed, onMounted, ref } from 'vue'
import LedgerEntryModal from './LedgerEntryModal.vue'
import LedgerDeleteModal from './LedgerDeleteModal.vue'
import { authService } from '../services/authService'
import { ledgerService } from '../services/ledgerService'
import { LEDGER_ENTRY_TYPES, LEDGER_WALLETS, type CreateLedgerEntryInput, type LedgerEntry, type LedgerWallet } from '../models/Ledger'
import {
  dailyRemaining,
  entriesInDateRange,
  entryDelta,
  ledgerTypeLabel,
  ledgerWalletLabel,
  manilaWeekWindow,
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
const visibleRows = computed(() => {
  let rows = entriesInDateRange(
    entries.value,
    startDate.value || '0000-01-01',
    endDate.value || '9999-12-31'
  )
  if (walletFilter.value) rows = rows.filter((row) => row.wallet === walletFilter.value)
  if (typeFilter.value) rows = rows.filter((row) => row.type === typeFilter.value)
  return rows.filter((row, index, list) => {
    if (row.type !== 'fund_expense' || !row.transfer_id) return true
    return list.findIndex((other) => other.transfer_id === row.transfer_id) === index
  })
})

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

function signedAmount(row: LedgerEntry): string {
  const value = entryDelta(row)[row.wallet]
  const abs = formatCurrency(Math.abs(value))
  return value < 0 ? `-₱${abs}` : `₱${abs}`
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
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
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
.ledger-table th { color: #6c757d; font-size: 0.8rem; text-transform: uppercase; }
.amount-split {
  font-size: 0.75rem;
  color: #868e96;
  font-weight: 500;
  margin-top: 0.2rem;
}
.link-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-weight: 600;
  margin-right: 8px;
}
@media (max-width: 768px) {
  .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .stats-grid,
  .week-strip { grid-template-columns: 1fr; }
}
</style>
