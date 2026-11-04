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
      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">Auditor cash remaining</span>
          <span class="stat-value" data-testid="auditor-remaining">₱{{ formatCurrency(auditorRemaining) }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">Expense wallet remaining</span>
          <span class="stat-value" data-testid="expense-remaining">₱{{ formatCurrency(expenseRemaining) }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-content">
          <span class="stat-label">GCash remaining</span>
          <span class="stat-value" data-testid="gcash-remaining">₱{{ formatCurrency(gcashRemaining) }}</span>
        </div>
      </div>
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
        <select v-model="walletFilter" class="filter-select">
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

    <p v-if="error && !modalOpen" class="error-state">{{ error }}</p>
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
          <td>{{ signedAmount(row) }}</td>
          <td>₱{{ formatCurrency(dailyRemaining(entries, row.wallet, row.entry_date)) }}</td>
          <td>{{ row.note || '—' }}</td>
          <td>
            <button type="button" class="link-btn" @click="openEdit(row)">Edit</button>
            <button type="button" class="link-btn" @click="onDelete(row)">Delete</button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LedgerEntryModal from './LedgerEntryModal.vue'
import { authService } from '../services/authService'
import { ledgerService } from '../services/ledgerService'
import { LEDGER_ENTRY_TYPES, LEDGER_WALLETS, type CreateLedgerEntryInput, type LedgerEntry } from '../models/Ledger'
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
const modalMode = ref<'add' | 'remit-owner' | 'edit'>('add')
const editing = ref<LedgerEntry | null>(null)
const week = manilaWeekWindow()
const startDate = ref(week.start)
const endDate = ref(week.end)
const walletFilter = ref('')
const typeFilter = ref('')

const auditorRemaining = computed(() => walletRemaining(entries.value, 'auditor_cash'))
const expenseRemaining = computed(() => walletRemaining(entries.value, 'expense'))
const gcashRemaining = computed(() => walletRemaining(entries.value, 'gcash'))
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

async function onDelete(row: LedgerEntry) {
  const label = ledgerTypeLabel(row.type)
  if (isSaving.value) return
  if (!confirm(`Delete ${label} of ₱${formatCurrency(row.amount)}?`)) return
  isSaving.value = true
  try {
    await ledgerService.remove(row.id, entries.value)
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
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}
.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}
.stat-label { font-size: 0.85rem; color: #6c757d; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: #212529; }
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
  .week-strip { grid-template-columns: 1fr; }
}
</style>
