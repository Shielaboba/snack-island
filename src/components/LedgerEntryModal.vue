<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <div>
            <h2>{{ title }}</h2>
            <p class="modal-subtitle">Typed by hand — not pulled from the POS</p>
          </div>
          <button class="close-btn" type="button" aria-label="Close modal" @click="emit('close')">×</button>
        </div>
        <form class="modal-body" @submit.prevent="onSubmit">
          <div class="form-grid">
            <div class="form-section">
              <label class="form-label">Date <span class="required">*</span></label>
              <input v-model="form.entry_date" type="date" class="form-input" required />
            </div>
            <div class="form-section">
              <label class="form-label">Type <span class="required">*</span></label>
              <select
                v-if="props.mode !== 'remit-owner'"
                v-model="form.type"
                class="form-select"
                data-testid="ledger-type"
                :disabled="props.mode === 'edit'"
                @change="onTypeChange"
              >
                <option v-for="entryType in LEDGER_ENTRY_TYPES" :key="entryType" :value="entryType">
                  {{ ledgerTypeLabel(entryType) }}
                </option>
              </select>
              <input
                v-else
                type="hidden"
                data-testid="ledger-type"
                :value="form.type"
                data-value="owner_remittance"
              />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-section">
              <label class="form-label">Wallet</label>
              <select
                v-model="form.wallet"
                class="form-select"
                data-testid="ledger-wallet"
                :disabled="walletLocked"
              >
                <option value="auditor_cash">Auditor cash</option>
                <option value="petty_cash">Petty cash</option>
              </select>
            </div>
            <div v-if="showCategory" class="form-section">
              <label class="form-label">Category <span class="required">*</span></label>
              <select v-model="form.category" class="form-select" data-testid="ledger-category" required>
                <option v-for="category in LEDGER_EXPENSE_CATEGORIES" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>
            </div>
            <div class="form-section">
              <label class="form-label">Amount (₱) <span class="required">*</span></label>
              <input
                v-model.number="form.amount"
                type="number"
                min="0"
                step="0.01"
                class="form-input"
                data-testid="ledger-amount"
                required
              />
            </div>
          </div>

          <div class="form-section">
            <label class="form-label">Note</label>
            <input v-model="form.note" type="text" class="form-input" placeholder="Optional" />
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" type="button" @click="emit('close')">Cancel</button>
            <button class="btn btn-primary" type="submit" data-testid="ledger-submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import {
  LEDGER_ENTRY_TYPES,
  LEDGER_EXPENSE_CATEGORIES,
  type CreateLedgerEntryInput,
  type LedgerEntry,
  type LedgerEntryType,
  type LedgerWallet
} from '../models/Ledger'
import { ledgerTypeLabel } from '../modules/ledger/ledgerUtils'

const props = defineProps<{
  isOpen: boolean
  mode: 'add' | 'remit-owner' | 'edit'
  entry?: LedgerEntry | null
}>()

const emit = defineEmits<{
  submit: [value: CreateLedgerEntryInput]
  close: []
}>()

const form = reactive<CreateLedgerEntryInput>({
  entry_date: '',
  type: 'opening_cash',
  wallet: 'auditor_cash',
  amount: 0,
  category: null,
  note: ''
})

const auditorLockedTypes: LedgerEntryType[] = [
  'opening_cash',
  'pos_float',
  'pos_remittance',
  'owner_remittance'
]

watch(
  () => [props.isOpen, props.mode, props.entry] as const,
  () => {
    if (!props.isOpen) return
    if (props.mode === 'remit-owner') {
      form.entry_date = new Date().toISOString().slice(0, 10)
      form.type = 'owner_remittance'
      form.wallet = 'auditor_cash'
      form.amount = 0
      form.category = null
      form.note = ''
      return
    }
    if (props.mode === 'edit' && props.entry) {
      form.entry_date = props.entry.entry_date
      form.type = props.entry.type
      form.wallet = props.entry.wallet
      form.amount = props.entry.amount
      form.category = props.entry.category
      form.note = props.entry.note ?? ''
      return
    }
    form.entry_date = new Date().toISOString().slice(0, 10)
    form.type = 'opening_cash'
    form.wallet = 'auditor_cash'
    form.amount = 0
    form.category = null
    form.note = ''
  },
  { immediate: true }
)

watch(
  () => form.type,
  (type) => {
    if (auditorLockedTypes.includes(type)) form.wallet = 'auditor_cash'
    if (type !== 'expense') form.category = null
  }
)

const showCategory = computed(() => form.type === 'expense')
const walletLocked = computed(
  () => auditorLockedTypes.includes(form.type) || props.mode === 'remit-owner'
)
const typeLocked = computed(() => props.mode === 'remit-owner' || props.mode === 'edit')
const title = computed(() => {
  if (props.mode === 'remit-owner') return 'Remit to owner'
  if (props.mode === 'edit') return 'Edit entry'
  return 'Add entry'
})

function onTypeChange(event: Event) {
  form.type = (event.target as HTMLSelectElement).value as LedgerEntryType
}

function onSubmit() {
  emit('submit', {
    entry_date: form.entry_date,
    type: form.type,
    wallet: form.wallet as LedgerWallet,
    amount: Number(form.amount),
    category: form.type === 'expense' ? form.category : null,
    note: form.note || null
  })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}
.modal-container {
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 28px;
  border-bottom: 1px solid #e9ecef;
}
.modal-header h2 {
  margin: 0 0 4px;
  color: #212529;
  font-size: 1.5rem;
}
.modal-subtitle {
  margin: 0;
  color: #6c757d;
  font-size: 0.9rem;
}
.close-btn {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 1.5rem;
}
.modal-body { padding: 28px; }
.form-section { margin-bottom: 20px; }
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
.form-label {
  display: block;
  margin-bottom: 8px;
  color: #495057;
  font-weight: 600;
  font-size: 0.9rem;
}
.required { color: #dc3545; }
.form-input,
.form-select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 0.95rem;
  box-sizing: border-box;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid #e9ecef;
}
.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-secondary { background: #e9ecef; color: #495057; }
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
@media (max-width: 480px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
