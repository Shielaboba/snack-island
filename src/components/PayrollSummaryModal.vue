<template>
  <Teleport to="body">
    <div v-if="isOpen" class="backdrop" data-testid="payroll-summary-modal" @click.self="emit('close')">
      <div class="modal" role="dialog" aria-label="Payroll summary" @click.stop>
        <div class="payroll-fields">
          <label>
            Staff
            <select v-model="payrollStaff" data-testid="payroll-summary-staff">
              <option v-for="name in STAFF_NAMES" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <label>
            Start
            <DateField v-model="payrollStart" test-id="payroll-summary-start" aria-label="Start" />
          </label>
          <label>
            End
            <DateField v-model="payrollEnd" test-id="payroll-summary-end" aria-label="End" />
          </label>
        </div>
        <article class="slip">
          <header class="slip-brand">
            <img :src="logoUrl" alt="Snack Island logo" />
            <div>
              <strong>Snack Island</strong>
              <span>Payroll</span>
            </div>
          </header>
          <div class="slip-body">
            <div class="slip-who" data-testid="slip-who">
              <h3>{{ summaryInput.staffName }}</h3>
              <p class="slip-week">{{ summaryInput.weekLabel }}</p>
            </div>
            <div class="slip-row"><span>Working Days</span><strong>{{ summaryInput.days }}</strong></div>
            <div class="slip-row"><span>Regular</span><strong>{{ summaryInput.regularPay }}</strong></div>
            <div class="slip-row"><span>OT hours</span><strong>{{ summaryInput.otHours }}</strong></div>
            <div class="slip-row"><span>OT pay</span><strong>{{ summaryInput.otPay }}</strong></div>
            <div class="slip-deduction">
              <div class="slip-row">
                <span>Compensation</span><strong>{{ summaryInput.compensation }}</strong>
              </div>
              <div v-for="item in summaryInput.compensationLines" :key="item.label" class="slip-sub">
                <span>{{ item.label }}</span><strong>{{ item.amount }}</strong>
              </div>
            </div>
            <div class="slip-deduction" data-testid="slip-deduction">
              <div class="slip-row">
                <span>Deduction</span><strong>{{ summaryInput.deduction }}</strong>
              </div>
              <div v-for="loan in summaryInput.loans" :key="loan.label" class="slip-sub" data-testid="slip-loan">
                <span>{{ loan.label }}</span><strong>{{ loan.amount }}</strong>
              </div>
            </div>
            <div class="slip-net">
              <span>Net pay</span>
              <strong>{{ summaryInput.netPay }}</strong>
            </div>
            <div class="slip-deduction" data-testid="slip-paid">
              <div class="slip-row">
                <span>Paid</span><strong>{{ summaryInput.paid }}</strong>
              </div>
              <div v-for="item in summaryInput.paymentLines" :key="item.id" class="slip-sub" data-testid="slip-payment">
                <span>{{ item.label }}</span><strong>{{ item.amount }}</strong>
              </div>
            </div>
            <div class="slip-row" data-testid="slip-balance">
              <span>Balance</span><strong>{{ summaryInput.balance }}</strong>
            </div>
          </div>
        </article>
        <div class="modal-actions center">
          <button class="btn" type="button" data-testid="payroll-copy" @click="copySummary">{{ copyLabel }}</button>
          <button class="text-btn" type="button" data-testid="payroll-summary-close" @click="emit('close')">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { STAFF_NAMES, type StaffClockShift, type StaffName } from '../models/StaffClock'
import {
  compensationApplies,
  compensationForPayrollRange,
  deductionForPayrollRange,
  formatShortDate,
  loadStaffCompensation,
  loadStaffPayables,
  loadStaffPayments,
  loadStaffProfiles,
  paymentTotal,
  paymentsForPayroll,
  resolvePayrollView,
  savePayrollView,
  weekdayIndex,
  type StaffCompensation,
  type StaffLoan,
  type StaffPayment,
  type StaffProfile
} from '../modules/staff/staffProfile'
import { calculatePayroll, formatPayrollPeso } from '../modules/staffClock/staffClockPayroll'
import { renderPayrollSummaryPng } from '../modules/staff/payrollSummaryImage'
import logoUrl from '../assets/logo.png'
import DateField from './DateField.vue'

const props = defineProps<{
  isOpen: boolean
  shifts: StaffClockShift[]
}>()

const emit = defineEmits<{
  close: []
}>()

const profiles = ref<StaffProfile[]>([])
const loans = ref<StaffLoan[]>([])
const compensations = ref<StaffCompensation[]>([])
const payments = ref<StaffPayment[]>([])
const payrollStaff = ref<StaffName>('Shai')
const payrollStart = ref('2026-10-31')
const payrollEnd = ref('2026-11-06')
const copyLabel = ref('Copy image')
const applying = ref(false)

function readOr<T>(read: () => T, fallback: T): T {
  try {
    return read()
  } catch {
    return fallback
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return
    applying.value = true
    loans.value = readOr(loadStaffPayables, [])
    compensations.value = readOr(loadStaffCompensation, [])
    payments.value = readOr(loadStaffPayments, [])
    profiles.value = readOr(loadStaffProfiles, [])
    const selection = readOr(() => resolvePayrollView(loans.value), {
      staffName: 'Shai' as StaffName,
      startDate: '2026-10-31',
      endDate: '2026-11-06'
    })
    payrollStaff.value = selection.staffName
    payrollStart.value = selection.startDate
    payrollEnd.value = selection.endDate
    copyLabel.value = 'Copy image'
    applying.value = false
  },
  { immediate: true }
)

watch([payrollStaff, payrollStart, payrollEnd], () => {
  if (!props.isOpen || applying.value) return
  try {
    savePayrollView({
      staffName: payrollStaff.value,
      startDate: payrollStart.value,
      endDate: payrollEnd.value
    })
  } catch {
    // This browser has no saved payroll view yet.
  }
})

const selectedProfile = computed(
  () => profiles.value.find((row) => row.name === payrollStaff.value) ?? profiles.value[0]
)

const payrollWeekLabel = computed(() => {
  if (
    weekdayIndex(payrollStart.value) == null ||
    weekdayIndex(payrollEnd.value) == null ||
    payrollEnd.value < payrollStart.value
  ) {
    return '—'
  }
  return `${formatShortDate(payrollStart.value)} – ${formatShortDate(payrollEnd.value)}`
})

const dueLoans = computed(() =>
  loans.value
    .filter((loan) => loan.staffName === selectedProfile.value.name)
    .map((loan, index) => ({
      label: loan.name.trim() || `Loan ${index + 1}`,
      amount: deductionForPayrollRange(
        [loan],
        loan.staffName,
        selectedProfile.value.payrollWeekday,
        payrollStart.value,
        payrollEnd.value
      )
    }))
    .filter((loan) => loan.amount > 0)
)

const dueCompensation = computed(() => {
  const profile = selectedProfile.value
  if (!profile || payrollEnd.value < payrollStart.value) return []
  return compensations.value
    .filter((item) => compensationApplies(item, profile.name, payrollStart.value, payrollEnd.value))
    .map((item) => ({
      label: item.name.trim() || 'Compensation',
      amount: item.amount
    }))
})

const duePayments = computed(() => {
  const profile = selectedProfile.value
  if (!profile || payrollEnd.value < payrollStart.value) return []
  return paymentsForPayroll(payments.value, profile.name, payrollStart.value, payrollEnd.value).map((row) => ({
    id: row.id,
    label: formatShortDate(row.paidOn),
    amount: row.amount
  }))
})

const paidTotal = computed(() => {
  const profile = selectedProfile.value
  if (!profile) return 0
  return paymentTotal(payments.value, profile.name, payrollStart.value, payrollEnd.value)
})

const compensationTotal = computed(() => {
  const profile = selectedProfile.value
  if (!profile) return 0
  return compensationForPayrollRange(
    compensations.value,
    profile.name,
    payrollStart.value,
    payrollEnd.value
  )
})

const payroll = computed(() => {
  const profile = selectedProfile.value
  return calculatePayroll(props.shifts, {
    staffName: profile.name,
    startDate: weekdayIndex(payrollStart.value) == null ? '' : payrollStart.value,
    endDate: weekdayIndex(payrollEnd.value) == null ? '' : payrollEnd.value,
    ratePerDay: Number(profile.ratePerDay) || 0,
    deduction: deductionForPayrollRange(
      loans.value,
      profile.name,
      profile.payrollWeekday,
      payrollStart.value,
      payrollEnd.value
    )
  })
})

const summaryInput = computed(() => ({
  staffName: selectedProfile.value.name,
  weekLabel: payrollWeekLabel.value,
  days: payroll.value.days,
  regularPay: formatPayrollPeso(payroll.value.regularPay),
  otHours: `${payroll.value.otHours.toFixed(2)} h`,
  otPay: formatPayrollPeso(payroll.value.otPay),
  compensationLines: dueCompensation.value.map((item) => ({
    label: item.label,
    amount: formatPayrollPeso(item.amount)
  })),
  compensation: formatPayrollPeso(compensationTotal.value),
  loans: dueLoans.value.map((loan) => ({
    label: loan.label,
    amount: formatPayrollPeso(loan.amount)
  })),
  deduction: formatPayrollPeso(payroll.value.deduction),
  netPay: formatPayrollPeso(Math.round((payroll.value.netPay + compensationTotal.value) * 100) / 100),
  paymentLines: duePayments.value.map((row) => ({
    id: row.id,
    label: row.label,
    amount: formatPayrollPeso(row.amount)
  })),
  paid: formatPayrollPeso(paidTotal.value),
  balance: formatPayrollPeso(
    Math.round((payroll.value.netPay + compensationTotal.value - paidTotal.value) * 100) / 100
  )
}))

async function copySummary() {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': renderPayrollSummaryPng(summaryInput.value, logoUrl)
      })
    ])
    copyLabel.value = 'Copied'
  } catch {
    copyLabel.value = 'Could not copy'
  }
}
</script>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1200;
}
.modal {
  width: min(440px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #f8f9fa;
  border-radius: 16px;
  padding: 12px;
  color: #1f2937;
}
.payroll-fields { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px; }
.payroll-fields label { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; font-weight: 600; }
.payroll-fields input,
.payroll-fields select {
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0 8px;
  font: inherit;
  color: #1f2937;
  background: #fff;
}
.slip { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; }
.slip-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  background: linear-gradient(180deg, #0e3b2e 0%, #114e43 100%);
  color: #fff;
}
.slip-brand img {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  object-fit: cover;
  background: #0e3b2e;
}
.slip-brand strong { display: block; font-size: 18px; }
.slip-brand span {
  color: #ffb800;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.slip-body { padding: 20px; }
.slip-who {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.slip-body h3 { margin: 0; color: #0e3b2e; font-size: 28px; }
.slip-week { margin: 0; color: #6b7280; text-align: right; }
.slip-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}
.slip-deduction .slip-row { border-bottom: none; padding-bottom: 2px; }
.slip-sub {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-left: 16px;
  padding: 4px 0;
  border-bottom: 1px solid #f3f4f6;
  color: #6b7280;
  font-size: 0.92rem;
}
.slip-sub strong { color: #374151; font-weight: 600; }
.slip-net {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #e7f3ee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.slip-net strong { color: #0e3b2e; font-size: 22px; }
.modal-actions { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
.btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid #5a67d8;
  background: #5a67d8;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.text-btn {
  height: 36px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: #374151;
  font-weight: 600;
  cursor: pointer;
}
</style>
