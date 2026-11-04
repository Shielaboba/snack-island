<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay"
      data-testid="payroll-modal"
      @click.self="emit('close')"
    >
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <div>
            <h2>Payroll Calculator</h2>
            <p class="modal-subtitle">
              One closed session is 1 day. 2 hours OT is half of the daily rate.
            </p>
          </div>
          <button class="close-btn" type="button" aria-label="Close modal" @click="emit('close')">
            ×
          </button>
        </div>
        <div class="modal-body">
          <p v-if="error" class="modal-error">{{ error }}</p>
          <label class="field-label" for="payroll-staff">Staff</label>
          <select
            id="payroll-staff"
            v-model="form.staffName"
            class="field-input"
            data-testid="payroll-staff"
          >
            <option v-for="name in STAFF_NAMES" :key="name" :value="name">{{ name }}</option>
          </select>
          <label class="field-label" for="payroll-start">Start date</label>
          <input
            id="payroll-start"
            v-model="form.startDate"
            type="date"
            class="field-input"
            data-testid="payroll-start"
          />
          <label class="field-label" for="payroll-end">End date</label>
          <input
            id="payroll-end"
            v-model="form.endDate"
            type="date"
            class="field-input"
            data-testid="payroll-end"
          />
          <label class="field-label" for="payroll-rate">Rate per day (₱)</label>
          <input
            id="payroll-rate"
            v-model.number="form.ratePerDay"
            type="number"
            min="0"
            step="0.01"
            class="field-input"
            data-testid="payroll-rate"
          />
          <label class="field-label" for="payroll-deduction">Deduction (₱)</label>
          <input
            id="payroll-deduction"
            v-model.number="form.deduction"
            type="number"
            min="0"
            step="0.01"
            class="field-input"
            data-testid="payroll-deduction"
          />
          <div v-if="!error" class="summary" data-testid="payroll-summary">
            <div><span>Days</span><strong>{{ result.days }} {{ result.days === 1 ? 'day' : 'days' }}</strong></div>
            <div><span>Regular</span><strong>{{ formatPayrollPeso(result.regularPay) }}</strong></div>
            <div><span>OT hours</span><strong>{{ result.otHours.toFixed(2) }}h</strong></div>
            <div><span>OT pay</span><strong>{{ formatPayrollPeso(result.otPay) }}</strong></div>
            <div><span>Deduction</span><strong>{{ formatPayrollPeso(result.deduction) }}</strong></div>
            <div class="net"><span>Net pay</span><strong>{{ formatPayrollPeso(result.netPay) }}</strong></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" type="button" @click="emit('close')">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { STAFF_NAMES, type StaffClockShift, type StaffName } from '../models/StaffClock'
import {
  calculatePayroll,
  formatPayrollPeso,
  validatePayrollInput
} from '../modules/staffClock/staffClockPayroll'
import { manilaYmd } from '../modules/staffClock/staffClockUtils'

const props = defineProps<{
  isOpen: boolean
  shifts: StaffClockShift[]
}>()

const emit = defineEmits<{
  close: []
}>()

const form = reactive({
  staffName: 'Shai' as StaffName,
  startDate: '',
  endDate: '',
  ratePerDay: 0,
  deduction: 0
})

const check = computed(() =>
  validatePayrollInput({
    staffName: form.staffName,
    startDate: form.startDate,
    endDate: form.endDate,
    ratePerDay: Number(form.ratePerDay) || 0,
    deduction: Number(form.deduction) || 0
  })
)
const error = computed(() => (check.value.ok ? '' : check.value.message))
const result = computed(() =>
  calculatePayroll(props.shifts, {
    staffName: form.staffName,
    startDate: form.startDate,
    endDate: form.endDate,
    ratePerDay: Number(form.ratePerDay) || 0,
    deduction: Number(form.deduction) || 0
  })
)

function hydrate() {
  const today = manilaYmd(new Date().toISOString())
  form.staffName = 'Shai'
  form.startDate = today
  form.endDate = today
  form.ratePerDay = 0
  form.deduction = 0
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) hydrate()
  },
  { immediate: true }
)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}
.modal-container {
  background: white;
  border-radius: 16px;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-height: 90vh;
  overflow: auto;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e9ecef;
}
.modal-header h2 { margin: 0 0 4px; color: #212529; font-size: 1.5rem; }
.modal-subtitle { margin: 0; color: #6c757d; font-size: 0.9rem; }
.close-btn { background: none; border: none; color: #6c757d; cursor: pointer; font-size: 1.5rem; }
.modal-body { padding: 16px 24px 8px; }
.field-label {
  display: block;
  font-size: 0.85rem;
  color: #495057;
  font-weight: 600;
  margin-bottom: 6px;
}
.field-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  font-size: 0.95rem;
  color: #212529;
  color-scheme: light;
  background: #fff;
}
.modal-error {
  color: #dc3545;
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
}
.summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 14px 16px;
  margin: 4px 0 8px;
}
.summary div {
  display: flex;
  justify-content: space-between;
  color: #495057;
  font-size: 0.9rem;
}
.summary .net {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid #e9ecef;
  color: #212529;
  font-size: 1rem;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 28px 24px;
}
.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-secondary { background: #e9ecef; color: #495057; }
</style>
