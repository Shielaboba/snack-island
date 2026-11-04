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
        <form class="modal-body" novalidate @submit.prevent="onSubmit">
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
                :disabled="typeLocked"
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

          <div v-if="isFundTransfer" class="form-grid">
            <div class="form-section">
              <label class="form-label">Source <span class="required">*</span></label>
              <select
                v-model="form.transfer_from"
                class="form-select"
                data-testid="ledger-transfer-from"
                :disabled="typeLocked"
              >
                <option v-for="party in LEDGER_TRANSFER_PARTIES" :key="party" :value="party">
                  {{ ledgerTransferPartyLabel(party) }}
                </option>
              </select>
            </div>
            <div class="form-section">
              <label class="form-label">Destination <span class="required">*</span></label>
              <select
                v-model="form.transfer_to"
                class="form-select"
                data-testid="ledger-transfer-to"
                :disabled="typeLocked"
              >
                <option v-for="party in LEDGER_TRANSFER_PARTIES" :key="party" :value="party">
                  {{ ledgerTransferPartyLabel(party) }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div v-if="!isFundTransfer" class="form-section">
              <label class="form-label">Wallet</label>
              <select
                v-model="form.wallet"
                class="form-select"
                data-testid="ledger-wallet"
                :disabled="walletLocked"
              >
                <option v-for="wallet in LEDGER_WALLETS" :key="wallet" :value="wallet">
                  {{ ledgerWalletLabel(wallet) }}
                </option>
              </select>
            </div>
            <div v-if="showCategory" class="form-section">
              <label class="form-label">Category <span class="required">*</span></label>
              <select
                :value="form.category ?? ''"
                class="form-select"
                data-testid="ledger-category"
                @change="onCategoryChange"
              >
                <option value="" disabled>Select a category</option>
                <option v-for="category in LEDGER_EXPENSE_CATEGORIES" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>
            </div>
            <div v-if="!isCartRemittance" class="form-section">
              <label class="form-label">Amount (₱) <span class="required">*</span></label>
              <input
                v-model="amountText"
                type="text"
                inputmode="decimal"
                class="form-input"
                data-testid="ledger-amount"
              />
            </div>
          </div>

          <div v-if="isCartRemittance" class="form-grid">
            <div class="form-section">
              <label class="form-label">Total Sales (₱) <span class="required">*</span></label>
              <input
                v-model="totalSalesText"
                type="text"
                inputmode="decimal"
                class="form-input"
                data-testid="ledger-total-sales"
              />
            </div>
            <div class="form-section">
              <label class="form-label">Petty Cash Returned (₱) <span class="required">*</span></label>
              <input
                v-model="pettyReturnedText"
                type="text"
                inputmode="decimal"
                class="form-input"
                data-testid="ledger-petty-returned"
              />
            </div>
          </div>

          <p v-if="error" class="modal-error" data-testid="ledger-modal-error">{{ error }}</p>

          <div class="form-section">
            <label class="form-label">Note</label>
            <input v-model="form.note" type="text" class="form-input" placeholder="Optional" />
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" type="button" @click="emit('close')">Cancel</button>
            <button
              class="btn btn-primary"
              type="submit"
              data-testid="ledger-submit"
              :disabled="saving"
              @click.prevent="onSubmit"
            >
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  LEDGER_ENTRY_TYPES,
  LEDGER_EXPENSE_CATEGORIES,
  LEDGER_TRANSFER_PARTIES,
  LEDGER_WALLETS,
  type CreateLedgerEntryInput,
  type LedgerEntry,
  type LedgerEntryType,
  type LedgerTransferParty,
  type LedgerWallet
} from '../models/Ledger'
import {
  isTrackedTransferParty,
  ledgerTransferPartyLabel,
  ledgerTypeLabel,
  ledgerWalletLabel,
  manilaYmd
} from '../modules/ledger/ledgerUtils'

const props = defineProps<{
  isOpen: boolean
  mode: 'add' | 'remit-owner' | 'edit'
  entry?: LedgerEntry | null
  error?: string
  saving?: boolean
}>()

const amountText = ref('')
const totalSalesText = ref('')
const pettyReturnedText = ref('')

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
  note: '',
  transfer_from: 'auditor_cash',
  transfer_to: 'gcash'
})

const auditorLockedTypes: LedgerEntryType[] = [
  'opening_cash',
  'pos_float',
  'pos_remittance',
  'owner_remittance',
  'fund_expense'
]

watch(
  () => [props.isOpen, props.mode, props.entry] as const,
  () => {
    if (!props.isOpen) return
    if (props.mode === 'remit-owner') {
      form.entry_date = manilaYmd(new Date())
      form.type = 'owner_remittance'
      form.wallet = 'auditor_cash'
      form.amount = 0
      form.category = null
      form.note = ''
      form.transfer_from = 'auditor_cash'
      form.transfer_to = 'gcash'
      amountText.value = ''
      totalSalesText.value = ''
      pettyReturnedText.value = ''
      return
    }
    if (props.mode === 'edit' && props.entry) {
      form.entry_date = props.entry.entry_date
      form.type = props.entry.type
      form.wallet = props.entry.wallet
      form.amount = props.entry.amount
      form.category = props.entry.category
      form.note = props.entry.note ?? ''
      form.transfer_from = props.entry.transfer_from ?? 'auditor_cash'
      form.transfer_to = props.entry.transfer_to ?? 'gcash'
      amountText.value = String(props.entry.amount)
      if (props.entry.type === 'pos_remittance') {
        totalSalesText.value =
          props.entry.total_sales != null ? String(props.entry.total_sales) : ''
        pettyReturnedText.value =
          props.entry.petty_cash_returned != null
            ? String(props.entry.petty_cash_returned)
            : String(props.entry.amount)
      } else {
        totalSalesText.value = ''
        pettyReturnedText.value = ''
      }
      return
    }
    form.entry_date = manilaYmd(new Date())
    form.type = 'opening_cash'
    form.wallet = 'auditor_cash'
    form.amount = 0
    form.category = null
    form.note = ''
    form.transfer_from = 'auditor_cash'
    form.transfer_to = 'gcash'
    amountText.value = ''
    totalSalesText.value = ''
    pettyReturnedText.value = ''
  },
  { immediate: true }
)

watch(
  () => form.type,
  (type) => {
    if (auditorLockedTypes.includes(type)) form.wallet = 'auditor_cash'
    if (type === 'gcash_remittance') form.wallet = 'gcash'
    if (type === 'expense' && props.mode === 'add') form.wallet = 'expense'
    if (type === 'fund_transfer') {
      form.transfer_from = form.transfer_from || 'auditor_cash'
      form.transfer_to = form.transfer_to && form.transfer_to !== form.transfer_from ? form.transfer_to : 'gcash'
    }
    if (type !== 'expense') form.category = null
  }
)

const showCategory = computed(() => form.type === 'expense')
const isCartRemittance = computed(() => form.type === 'pos_remittance')
const isFundTransfer = computed(() => form.type === 'fund_transfer')
const walletLocked = computed(
  () =>
    auditorLockedTypes.includes(form.type) ||
    form.type === 'gcash_remittance' ||
    props.mode === 'remit-owner' ||
    props.mode === 'edit'
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

function onCategoryChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  form.category = (value || null) as CreateLedgerEntryInput['category']
}

function transferWallet(): LedgerWallet {
  if (isTrackedTransferParty(form.transfer_from)) return form.transfer_from
  if (isTrackedTransferParty(form.transfer_to)) return form.transfer_to
  return 'auditor_cash'
}

function onSubmit() {
  if (props.saving) return
  const totalSales = isCartRemittance.value ? Number(totalSalesText.value) : null
  const pettyReturned = isCartRemittance.value ? Number(pettyReturnedText.value) : null
  const isTransfer = form.type === 'fund_transfer'
  emit('submit', {
    entry_date: form.entry_date,
    type: form.type,
    wallet: isTransfer ? transferWallet() : (form.wallet as LedgerWallet),
    amount: isCartRemittance.value
      ? Number(totalSales) + Number(pettyReturned)
      : Number(amountText.value),
    category: form.type === 'expense' ? form.category : null,
    note: form.note || null,
    transfer_from: isTransfer ? (form.transfer_from as LedgerTransferParty) : null,
    transfer_to: isTransfer ? (form.transfer_to as LedgerTransferParty) : null,
    total_sales: totalSales,
    petty_cash_returned: pettyReturned
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
.modal-error {
  color: #dc3545;
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
}
.form-input,
.form-select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 0.95rem;
  box-sizing: border-box;
  color: #212529;
  color-scheme: light;
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
