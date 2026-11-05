<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @mousedown.self="handleClose">
        <div
          class="modal-container"
          role="dialog"
          aria-modal="true"
          :aria-label="isEditMode ? 'Edit expense' : 'New expense'"
          @keydown="onKeydown"
        >
          <header class="modal-header">
            <h2>{{ isEditMode ? 'Edit expense' : 'New expense' }}</h2>
            <span v-if="savedCount > 0" class="saved-pill">{{ savedCount }} saved</span>
            <button type="button" class="icon-btn" @click="handleClose" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </header>

          <form ref="formEl" class="modal-body" novalidate @submit.prevent="submit(false)">
            <!-- Amount: the one thing every expense needs, so it gets focus and size -->
            <div class="field">
              <label class="label" for="exp-amount">Amount</label>
              <div class="amount-input" :class="{ invalid: errors.amount }">
                <span class="currency">₱</span>
                <input
                  id="exp-amount"
                  ref="amountEl"
                  v-model.number="form.amount"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  autocomplete="off"
                />
              </div>
              <p v-if="errors.amount" class="error-text">{{ errors.amount }}</p>
            </div>

            <div class="field">
              <label class="label" for="exp-desc">What was it for?</label>
              <input
                id="exp-desc"
                v-model="form.description"
                class="input"
                :class="{ invalid: errors.description }"
                type="text"
                list="exp-desc-options"
                placeholder="e.g. Paper cups, LPG refill"
                autocomplete="off"
                @change="applyRememberedDetails"
              />
              <datalist id="exp-desc-options">
                <option v-for="d in recentDescriptions" :key="d" :value="d" />
              </datalist>
              <p v-if="errors.description" class="error-text">{{ errors.description }}</p>
              <p v-else-if="autofilled" class="hint-text">Filled in category and details from last time.</p>
            </div>

            <div class="field">
              <span class="label">Category</span>
              <div class="chip-group" role="radiogroup" aria-label="Category">
                <button
                  v-for="cat in EXPENSE_CATEGORIES"
                  :key="cat"
                  type="button"
                  role="radio"
                  class="chip"
                  :class="{ selected: form.category === cat }"
                  :aria-checked="form.category === cat"
                  :style="{ '--chip-color': EXPENSE_CATEGORY_COLORS[cat] }"
                  @click="pickCategory(cat)"
                >
                  {{ cat }}
                </button>
              </div>
            </div>

            <div class="field">
              <label class="label" for="exp-date">Date</label>
              <div class="date-row">
                <div class="segmented">
                  <button
                    type="button"
                    :class="{ active: form.expense_date === today }"
                    @click="form.expense_date = today"
                  >Today</button>
                  <button
                    type="button"
                    :class="{ active: form.expense_date === yesterday }"
                    @click="form.expense_date = yesterday"
                  >Yesterday</button>
                </div>
                <input id="exp-date" v-model="form.expense_date" class="input date-input" type="date" required />
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label class="label" for="exp-paid-by">Paid by <span class="optional">optional</span></label>
                <input
                  id="exp-paid-by"
                  v-model="form.paid_by"
                  class="input"
                  type="text"
                  list="exp-payer-options"
                  placeholder="Who paid?"
                  autocomplete="off"
                />
                <datalist id="exp-payer-options">
                  <option v-for="p in recentPayers" :key="p" :value="p" />
                </datalist>
              </div>
              <div class="field">
                <label class="label" for="exp-supplier">Supplier <span class="optional">optional</span></label>
                <input
                  id="exp-supplier"
                  v-model="form.supplier_id"
                  class="input"
                  type="text"
                  list="exp-supplier-options"
                  placeholder="e.g. SUP-001"
                  autocomplete="off"
                />
                <datalist id="exp-supplier-options">
                  <option v-for="s in recentSuppliers" :key="s" :value="s" />
                </datalist>
              </div>
            </div>

            <div class="field">
              <span class="label">Reimbursement</span>
              <div class="segmented full" role="radiogroup" aria-label="Reimbursement">
                <button
                  v-for="opt in reimburseOptions"
                  :key="opt.value"
                  type="button"
                  role="radio"
                  :aria-checked="form.reimburse_status === opt.value"
                  :class="{ active: form.reimburse_status === opt.value }"
                  @click="form.reimburse_status = opt.value"
                >{{ opt.label }}</button>
              </div>
            </div>

            <p v-if="saveError" class="save-error" role="alert">{{ saveError }}</p>

            <footer class="modal-footer">
              <button
                v-if="isEditMode && remove"
                type="button"
                class="btn btn-danger-ghost"
                :disabled="busy"
                @click="handleDelete"
              >Delete</button>
              <span class="kbd-hint"><kbd>Enter</kbd> to save</span>
              <button
                v-if="!isEditMode"
                type="button"
                class="btn btn-secondary"
                :disabled="busy"
                :title="`Shortcut: ${modKey}+Enter`"
                @click="submit(true)"
              >
                Save &amp; add another
              </button>
              <button type="submit" class="btn btn-primary" :disabled="busy">
                <span v-if="busy" class="btn-spinner" aria-hidden="true"></span>
                {{ isEditMode ? 'Save changes' : 'Save' }}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_COLORS,
  REIMBURSE_STATUS,
  type Expense,
  type ExpenseCategory,
} from '../models/Expense'

export interface ExpenseFormData {
  expense_date: string
  category: ExpenseCategory
  description: string
  amount: number
  supplier_id: string
  paid_by: string
  reimburse_status: number
}

interface Props {
  isOpen: boolean
  isEditMode: boolean
  initialData?: ExpenseFormData | null
  /** Past expenses, used for suggestions and remembering details. */
  history?: Expense[]
  save: (data: ExpenseFormData) => Promise<void>
  remove?: (() => Promise<void>) | null
}

const props = withDefaults(defineProps<Props>(), {
  initialData: null,
  history: () => [],
  remove: null,
})

const emit = defineEmits<{ close: [] }>()

const toLocalDate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const today = computed(() => toLocalDate(new Date()))
const yesterday = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toLocalDate(d)
})

const modKey = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

const reimburseOptions = [
  { value: REIMBURSE_STATUS.NONE, label: 'Not needed' },
  { value: REIMBURSE_STATUS.NEEDED, label: 'Needs reimbursement' },
  { value: REIMBURSE_STATUS.DONE, label: 'Reimbursed' },
]

type FormState = Omit<ExpenseFormData, 'amount'> & { amount: number | '' }

const blankForm = (): FormState => ({
  expense_date: today.value,
  category: 'Ingredients',
  description: '',
  amount: '',
  supplier_id: '',
  paid_by: '',
  reimburse_status: REIMBURSE_STATUS.NONE,
})

const form = reactive<FormState>(blankForm())
const errors = reactive<{ amount: string; description: string }>({ amount: '', description: '' })
const busy = ref(false)
const saveError = ref('')
const savedCount = ref(0)
const categoryTouched = ref(false)
const autofilled = ref(false)
const amountEl = ref<HTMLInputElement | null>(null)

const uniqueRecent = (pick: (e: Expense) => string | undefined, limit = 30) => {
  const seen = new Set<string>()
  const out: string[] = []
  const sorted = [...props.history].sort((a, b) => b.expense_date.localeCompare(a.expense_date))
  for (const e of sorted) {
    const v = pick(e)?.trim()
    if (!v || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
    if (out.length >= limit) break
  }
  return out
}
const recentDescriptions = computed(() => uniqueRecent(e => e.description, 50))
const recentPayers = computed(() => uniqueRecent(e => e.paid_by))
const recentSuppliers = computed(() => uniqueRecent(e => e.supplier_id))

const resetErrors = () => {
  errors.amount = ''
  errors.description = ''
  saveError.value = ''
}

const focusAmount = () => nextTick(() => amountEl.value?.focus())

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return
    resetErrors()
    savedCount.value = 0
    autofilled.value = false
    categoryTouched.value = props.isEditMode
    Object.assign(
      form,
      props.isEditMode && props.initialData
        ? {
            ...props.initialData,
            supplier_id: props.initialData.supplier_id || '',
            paid_by: props.initialData.paid_by || '',
            reimburse_status: props.initialData.reimburse_status || 0,
          }
        : blankForm()
    )
    focusAmount()
  },
  { immediate: true }
)

const pickCategory = (cat: ExpenseCategory) => {
  form.category = cat
  categoryTouched.value = true
}

// When a description matches one used before, reuse its category and details
// so repeat purchases are just amount + description + Enter.
const applyRememberedDetails = () => {
  if (props.isEditMode) return
  const key = form.description.trim().toLowerCase()
  if (!key) return
  const match = [...props.history]
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
    .find(e => e.description?.trim().toLowerCase() === key)
  if (!match) return
  let changed = false
  if (!categoryTouched.value && match.category !== form.category) {
    form.category = match.category
    changed = true
  }
  if (!form.paid_by && match.paid_by) {
    form.paid_by = match.paid_by
    changed = true
  }
  if (!form.supplier_id && match.supplier_id) {
    form.supplier_id = match.supplier_id
    changed = true
  }
  autofilled.value = changed
}

const validate = () => {
  resetErrors()
  const amount = Number(form.amount)
  if (form.amount === '' || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than 0.'
  }
  if (!form.description.trim()) {
    errors.description = 'Add a short description.'
  }
  return !errors.amount && !errors.description
}

const submit = async (addAnother: boolean) => {
  if (busy.value) return
  if (!validate()) {
    if (errors.amount) amountEl.value?.focus()
    else document.getElementById('exp-desc')?.focus()
    return
  }
  busy.value = true
  try {
    await props.save({
      ...form,
      description: form.description.trim(),
      paid_by: form.paid_by.trim(),
      supplier_id: form.supplier_id.trim(),
      amount: Number(form.amount),
    })
    if (addAnother) {
      // Keep date, category, payer and status; clear only what changes per receipt.
      savedCount.value++
      form.amount = ''
      form.description = ''
      autofilled.value = false
      categoryTouched.value = false
      focusAmount()
    } else {
      emit('close')
    }
  } catch (err) {
    console.error('Error saving expense:', err)
    saveError.value = 'Could not save this expense. Check your connection and try again.'
  } finally {
    busy.value = false
  }
}

const handleDelete = async () => {
  if (!props.remove) return
  if (!confirm(`Delete "${form.description}"? This can't be undone.`)) return
  busy.value = true
  try {
    await props.remove()
    emit('close')
  } catch (err) {
    console.error('Error deleting expense:', err)
    saveError.value = 'Could not delete this expense. Try again.'
  } finally {
    busy.value = false
  }
}

const handleClose = () => {
  if (!busy.value) emit('close')
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    handleClose()
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    submit(!props.isEditMode)
  }
}
</script>

<style scoped>
.modal-overlay {
  --primary: #5a67d8;
  --primary-hover: #4c51bf;
  --primary-soft: #eef0ff;
  --text: #1f2937;
  --muted: #6b7280;
  --border: #e5e7eb;
  --danger: #dc2626;

  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 2000;
  padding: 6vh 20px 20px;
  overflow-y: auto;
}

.modal-container {
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 540px;
  box-shadow: 0 24px 48px rgba(17, 24, 39, 0.18);
  color: var(--text);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px 0 24px;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  flex: 1;
}

.saved-pill {
  font-size: 0.75rem;
  font-weight: 600;
  color: #15803d;
  background: #dcfce7;
  padding: 3px 10px;
  border-radius: 999px;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.icon-btn:hover { background: #f3f4f6; color: var(--text); }

.modal-body {
  padding: 16px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
}
.optional { font-weight: 400; color: #9ca3af; }

.input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-size: 0.9rem;
  color: var(--text);
  background: #fff;
  box-sizing: border-box;
  width: 100%;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus,
.amount-input:focus-within {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.15);
}
.input.invalid,
.amount-input.invalid { border-color: var(--danger); }

.amount-input {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 14px;
  height: 56px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.currency { font-size: 1.4rem; font-weight: 600; color: var(--muted); margin-right: 6px; }
.amount-input input {
  border: none;
  outline: none;
  font: inherit;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text);
  width: 100%;
  background: transparent;
  font-variant-numeric: tabular-nums;
}
.amount-input input::-webkit-outer-spin-button,
.amount-input input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.amount-input input { -moz-appearance: textfield; appearance: textfield; }

.error-text { margin: 0; font-size: 0.78rem; color: var(--danger); }
.hint-text { margin: 0; font-size: 0.78rem; color: #15803d; }

.chip-group { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  --chip-color: var(--primary);
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: #fff;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.chip:hover { border-color: var(--chip-color); color: var(--chip-color); }
.chip.selected {
  background: var(--chip-color);
  border-color: var(--chip-color);
  color: #fff;
  font-weight: 600;
}

.date-row { display: flex; gap: 8px; }
.date-input { flex: 1; }

.segmented {
  display: inline-flex;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
  flex-shrink: 0;
}
.segmented.full { display: flex; }
.segmented.full button { flex: 1; }
.segmented button {
  height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
}
.segmented button:hover { color: var(--text); }
.segmented button.active {
  background: #fff;
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.save-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.85rem;
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
  margin-top: 4px;
  border-top: 1px solid #f3f4f6;
}

.kbd-hint {
  flex: 1;
  font-size: 0.72rem;
  color: #9ca3af;
}
kbd {
  font-family: inherit;
  font-size: 0.7rem;
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: #f9fafb;
  color: var(--muted);
}

.btn {
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
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: #fff; min-width: 96px; }
.btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
.btn-secondary { background: #fff; color: #374151; border-color: var(--border); }
.btn-secondary:hover:not(:disabled) { background: #f9fafb; }
.btn-danger-ghost { background: transparent; color: var(--danger); padding: 0 10px; }
.btn-danger-ghost:hover:not(:disabled) { background: #fef2f2; }

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity 0.15s; }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container { transition: transform 0.15s; }
.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container { transform: translateY(8px); }

@media (max-width: 560px) {
  .modal-overlay { padding: 0; align-items: flex-end; }
  .modal-container { border-radius: 16px 16px 0 0; max-height: 94vh; overflow-y: auto; }
  .modal-body { padding: 16px; }
  .modal-header { padding: 16px 12px 0 16px; }
  .field-row { grid-template-columns: 1fr; }
  .date-row { flex-direction: column; }
  .date-input { flex: none; }
  .segmented.full button {
    white-space: normal;
    height: auto;
    min-height: 40px;
    padding: 6px 8px;
    line-height: 1.2;
  }
  .kbd-hint { display: none; }
  .modal-footer { flex-wrap: wrap; }
  .modal-footer .btn-primary,
  .modal-footer .btn-secondary { flex: 1; }
}
</style>
