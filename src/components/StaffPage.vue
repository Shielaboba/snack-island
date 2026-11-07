<template>
  <div class="staff-page">
    <p v-if="syncError" class="sync-error" role="alert" data-testid="staff-sync-error">{{ syncError }}</p>
    <section class="panel" aria-label="Staff list">
      <div class="panel-head">
        <h2>Staff</h2>
        <div class="save-row">
          <span v-if="staffSaved" class="save-note" data-testid="save-staff-note" role="status">Staff details saved</span>
          <button class="btn" type="button" data-testid="save-staff" @click="saveStaff">Save</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="staff-table roster-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Payroll day</th>
              <th>Rate per day</th>
              <th class="shift-col">Shift</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in profiles" :key="row.name">
              <td>{{ row.name }}</td>
              <td>
                <select
                  v-model.number="row.payrollWeekday"
                  :data-testid="`staff-payday-${row.name}`"
                  :aria-label="`${row.name} payroll day`"
                >
                  <option v-for="(label, index) in WEEKDAYS" :key="label" :value="index">{{ label }}</option>
                </select>
              </td>
              <td>
                <input
                  v-model.number="row.ratePerDay"
                  type="number"
                  min="0"
                  step="0.01"
                  :data-testid="`staff-rate-${row.name}`"
                  :aria-label="`${row.name} rate per day`"
                />
              </td>
              <td class="shift-cell">
                <div class="shift shift-row">
                  <div class="shift-times">
                    <label class="shift-field">
                      <span>Start</span>
                      <input v-model="row.shiftStart" type="time" :aria-label="`${row.name} shift start`" />
                    </label>
                    <label class="shift-field">
                      <span>End</span>
                      <input v-model="row.shiftEnd" type="time" :aria-label="`${row.name} shift end`" />
                    </label>
                  </div>
                  <div class="days">
                    <button
                      v-for="(label, index) in WEEKDAYS"
                      :key="label"
                      type="button"
                      class="day"
                      :class="{ off: isDayOff(row, index) }"
                      :aria-pressed="!isDayOff(row, index)"
                      :aria-label="`${row.name} ${label}`"
                      @click="toggleDay(row, index)"
                    >
                      {{ isDayOff(row, index) ? `${label.slice(0, 3)} off` : label.slice(0, 3) }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel" aria-label="Payable">
      <div class="panel-head">
        <h2>Payable</h2>
        <button class="btn" type="button" data-testid="add-payable" @click="openPayable">Add payable</button>
      </div>
      <p class="panel-note">Each loan is split across weekly payrolls. A payroll deducts every loan that is due that day.</p>
      <div class="table-wrap">
        <table class="staff-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Staff</th>
              <th>Deduction</th>
              <th>Payrolls</th>
              <th>First payroll</th>
              <th>Per payroll</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loans.length === 0">
              <td colspan="7">No payables yet.</td>
            </tr>
            <tr v-for="loan in loans" :key="loan.id">
              <td :data-testid="`payable-name-${loan.id}`">{{ loan.name }}</td>
              <td :data-testid="`payable-staff-${loan.id}`">{{ loan.staffName }}</td>
              <td :data-testid="`payable-deduction-${loan.id}`">{{ formatPayrollPeso(loan.deductionTotal) }}</td>
              <td :data-testid="`payable-payrolls-${loan.id}`">{{ loan.payrollCount }}</td>
              <td :data-testid="`payable-first-${loan.id}`">{{ loan.firstPayrollDate }}</td>
              <td :data-testid="`payable-installment-${loan.id}`">{{ installmentLabel(loan) }}</td>
              <td class="row-actions">
                <button
                  class="text-btn paid-btn"
                  type="button"
                  :data-testid="`payable-paid-${loan.id}`"
                  :aria-pressed="loan.paid"
                  @click="markLoanPaid(loan.id)"
                >
                  Paid
                </button>
                <button class="text-btn" type="button" :data-testid="`payable-remove-${loan.id}`" @click="removeLoan(loan.id)">
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="payableOpen" class="backdrop" data-testid="payable-modal" @click.self="payableOpen = false">
        <div class="payable-dialog" role="dialog" aria-label="Add payable">
          <header class="payable-head">
            <div>
              <h3>Add payable</h3>
              <p>Split across that person’s paydays, starting on the first payroll date.</p>
            </div>
            <button class="payable-x" type="button" aria-label="Close" @click="payableOpen = false">×</button>
          </header>
          <div class="payable-form">
            <label class="span-2">
              Name
              <input v-model="draft.name" type="text" placeholder="Cash advance" data-testid="payable-form-name" />
            </label>
            <label>
              Staff
              <select v-model="draft.staffName" data-testid="payable-form-staff">
                <option v-for="name in STAFF_NAMES" :key="name" :value="name">{{ name }}</option>
              </select>
            </label>
            <label>
              Deduction
              <span class="peso">
                <span aria-hidden="true">₱</span>
                <input v-model.number="draft.deductionTotal" type="number" min="0" step="0.01" data-testid="payable-form-deduction" />
              </span>
            </label>
            <label>
              Payrolls
              <input v-model.number="draft.payrollCount" type="number" min="0" step="1" data-testid="payable-form-payrolls" />
            </label>
            <label>
              First payroll
              <DateField v-model="draft.firstPayrollDate" test-id="payable-form-first" aria-label="First payroll" />
            </label>
          </div>
          <div class="payable-actions">
            <button class="payable-cancel" type="button" data-testid="payable-cancel" @click="payableOpen = false">Cancel</button>
            <button class="btn" type="button" data-testid="payable-save" @click="savePayable">Save</button>
          </div>
        </div>
      </div>
    </section>

    <section class="panel" aria-label="Compensation">
      <div class="panel-head">
        <h2>Compensation</h2>
        <button class="btn" type="button" data-testid="add-compensation" @click="openCompensation">Add compensation</button>
      </div>
      <p class="panel-note">Gas, transpo, or a bonus for one person on a date, or on every payroll.</p>
      <div class="table-wrap">
        <table class="staff-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Staff</th>
              <th>Amount</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="compensations.length === 0">
              <td colspan="5">No compensation yet.</td>
            </tr>
            <tr v-for="item in compensations" :key="item.id">
              <td :data-testid="`compensation-name-${item.id}`">{{ item.name }}</td>
              <td :data-testid="`compensation-staff-${item.id}`">{{ item.staffName }}</td>
              <td :data-testid="`compensation-amount-${item.id}`">{{ formatPayrollPeso(item.amount) }}</td>
              <td :data-testid="`compensation-date-${item.id}`">{{ item.forever ? (item.date ? `Forever from ${item.date}` : 'Forever') : item.date }}</td>
              <td>
                <button class="text-btn" type="button" :data-testid="`compensation-remove-${item.id}`" @click="removeCompensation(item.id)">
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="compensationOpen" class="backdrop" data-testid="compensation-modal" @click.self="compensationOpen = false">
        <div class="payable-dialog" role="dialog" aria-label="Add compensation">
          <header class="payable-head">
            <div>
              <h3>Add compensation</h3>
              <p>One date, or forever on every payroll.</p>
            </div>
            <button class="payable-x" type="button" aria-label="Close" @click="compensationOpen = false">×</button>
          </header>
          <div class="payable-form">
            <label class="span-2">
              Name
              <input v-model="compensationDraft.name" type="text" data-testid="compensation-form-name" />
            </label>
            <label>
              Staff
              <select v-model="compensationDraft.staffName" data-testid="compensation-form-staff">
                <option v-for="name in STAFF_NAMES" :key="name" :value="name">{{ name }}</option>
              </select>
            </label>
            <label>
              Amount
              <span class="peso">
                <span aria-hidden="true">₱</span>
                <input v-model.number="compensationDraft.amount" type="number" min="0" step="0.01" data-testid="compensation-form-amount" />
              </span>
            </label>
            <label class="span-2">
              When
              <select v-model="compensationDraft.when" data-testid="compensation-form-when">
                <option value="date">One date</option>
                <option value="forever">Forever</option>
              </select>
            </label>
            <label class="span-2">
              {{ compensationDraft.when === 'forever' ? 'Starts on' : 'Date' }}
              <DateField v-model="compensationDraft.date" test-id="compensation-form-date" aria-label="Compensation date" />
            </label>
          </div>
          <div class="payable-actions">
            <button class="payable-cancel" type="button" data-testid="compensation-cancel" @click="compensationOpen = false">Cancel</button>
            <button class="btn" type="button" data-testid="compensation-save" @click="saveCompensation">Save</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { STAFF_NAMES, type StaffName } from '../models/StaffClock'
import {
  WEEKDAYS,
  addDays,
  firstPaydayOnOrAfter,
  isDayOff,
  loadStaffCompensation,
  loadStaffPayables,
  loadStaffProfiles,
  resolvePayrollView,
  savePayrollView,
  saveStaffCompensation,
  saveStaffPayables,
  saveStaffProfiles,
  perPayrollDeduction,
  type StaffCompensation,
  type StaffLoan,
  type StaffProfile
} from '../modules/staff/staffProfile'
import { formatPayrollPeso } from '../modules/staffClock/staffClockPayroll'
import { manilaToday } from '../modules/staffClock/staffClockUtils'
import { staffPayrollService } from '../services/staffPayrollService'
import type { PayrollRecordKey } from '../modules/staff/staffProfile'
import DateField from './DateField.vue'

const profiles = ref<StaffProfile[]>(loadStaffProfiles())
const loans = ref<StaffLoan[]>(loadStaffPayables())
const compensations = ref<StaffCompensation[]>(loadStaffCompensation())
const staffSaved = ref(false)
const syncError = ref('')
// True while records pulled from the shared table are copied in, so they are not pushed straight back.
let applyingShared = false
// Lists changed here before the shared records arrive keep the local edits.
const edited = { profiles: false, payables: false, compensation: false }

function share(key: PayrollRecordKey, rows: unknown[]) {
  staffPayrollService.push(key, rows).then(
    () => {
      syncError.value = ''
    },
    () => {
      syncError.value = 'Could not save to the shared records. Changes are only on this device for now.'
    }
  )
}

watch(loans, (rows) => {
  saveStaffPayables(rows)
  if (applyingShared) return
  edited.payables = true
  share('payables', rows)
}, { deep: true })
watch(compensations, (rows) => {
  saveStaffCompensation(rows)
  if (applyingShared) return
  edited.compensation = true
  share('compensation', rows)
}, { deep: true })
watch(profiles, () => {
  if (applyingShared) return
  edited.profiles = true
  staffSaved.value = false
}, { deep: true })
const payableOpen = ref(false)
const compensationOpen = ref(false)
const draft = ref(emptyPayable())
const compensationDraft = ref(emptyCompensation())

function highestSeq(ids: string[], prefix: string): number {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  return ids.reduce((max, id) => {
    const match = pattern.exec(id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
}

let loanSeq = highestSeq(loans.value.map((row) => row.id), 'loan')
let compensationSeq = highestSeq(compensations.value.map((row) => row.id), 'compensation')

onMounted(async () => {
  try {
    await staffPayrollService.pull()
  } catch {
    syncError.value = 'Could not load the shared records. Showing what this device saved last.'
    return
  }
  applyingShared = true
  if (!edited.profiles) profiles.value = loadStaffProfiles()
  if (!edited.payables) loans.value = loadStaffPayables()
  if (!edited.compensation) compensations.value = loadStaffCompensation()
  loanSeq = Math.max(loanSeq, highestSeq(loans.value.map((row) => row.id), 'loan'))
  compensationSeq = Math.max(compensationSeq, highestSeq(compensations.value.map((row) => row.id), 'compensation'))
  // Let the watchers see the pulled rows before pushes resume.
  await nextTick()
  applyingShared = false
})

function installmentLabel(loan: StaffLoan): string {
  if (loan.paid) return 'Paid'
  const amount = perPayrollDeduction(loan)
  if (amount <= 0) return 'None'
  return `${formatPayrollPeso(amount)} / payroll`
}

function saveStaff() {
  const rows = profiles.value.map((row) => ({
    ...row,
    daysOff: [...row.daysOff]
  }))
  saveStaffProfiles(rows)
  share('profiles', rows)
  staffSaved.value = true
}

function toggleDay(row: StaffProfile, weekday: number) {
  row.daysOff = isDayOff(row, weekday)
    ? row.daysOff.filter((day) => day !== weekday)
    : [...row.daysOff, weekday].sort()
}

function savedPayrollEnd(): string {
  return resolvePayrollView(loans.value).endDate
}

function emptyPayable() {
  return {
    name: '',
    staffName: 'Shai' as StaffName,
    deductionTotal: 0,
    payrollCount: 0,
    firstPayrollDate: savedPayrollEnd()
  }
}

function openPayable() {
  draft.value = emptyPayable()
  payableOpen.value = true
}

function paydayFor(staffName: StaffName, isoDate: string): string {
  const weekday = profiles.value.find((row) => row.name === staffName)?.payrollWeekday ?? 0
  return firstPaydayOnOrAfter(isoDate, weekday)
}

function focusPayroll(staffName: StaffName, isoDate: string) {
  const endDate = paydayFor(staffName, isoDate)
  savePayrollView({
    staffName,
    startDate: addDays(endDate, -6),
    endDate
  })
}

function savePayable() {
  loanSeq += 1
  const firstPayrollDate = paydayFor(draft.value.staffName, draft.value.firstPayrollDate)
  loans.value.push({
    id: `loan-${loanSeq}`,
    name: draft.value.name.trim(),
    staffName: draft.value.staffName,
    deductionTotal: Number(draft.value.deductionTotal) || 0,
    payrollCount: Number(draft.value.payrollCount) || 0,
    firstPayrollDate,
    paid: false,
    paidOn: ''
  })
  focusPayroll(draft.value.staffName, firstPayrollDate)
  payableOpen.value = false
}

function removeLoan(id: string) {
  loans.value = loans.value.filter((loan) => loan.id !== id)
}

function markLoanPaid(id: string) {
  const loan = loans.value.find((row) => row.id === id)
  if (!loan) return
  loan.paid = !loan.paid
  loan.paidOn = loan.paid ? manilaToday() : ''
}

function emptyCompensation() {
  return {
    name: '',
    staffName: 'Shai' as StaffName,
    amount: 0,
    when: 'date' as 'date' | 'forever',
    date: savedPayrollEnd()
  }
}

function openCompensation() {
  compensationDraft.value = emptyCompensation()
  compensationOpen.value = true
}

function saveCompensation() {
  compensationSeq += 1
  const forever = compensationDraft.value.when === 'forever'
  compensations.value.push({
    id: `compensation-${compensationSeq}`,
    name: compensationDraft.value.name.trim(),
    staffName: compensationDraft.value.staffName,
    amount: Number(compensationDraft.value.amount) || 0,
    date: compensationDraft.value.date,
    forever
  })
  compensationOpen.value = false
}

function removeCompensation(id: string) {
  compensations.value = compensations.value.filter((item) => item.id !== id)
}
</script>

<style scoped>
.staff-page { color: #212529; }
.panel { margin-top: 1.25rem; }
.panel:first-child { margin-top: 0; }
.panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
.save-row { display: flex; align-items: center; gap: 10px; }
.save-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 10px;
  border-radius: 999px;
  background: #e7f3ee;
  color: #0e3b2e;
  font-size: 13px;
  font-weight: 600;
}
.save-note::before {
  content: '✓';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #0e3b2e;
  color: #fff;
  font-size: 11px;
  line-height: 1;
}
.panel h2 { margin: 0; font-size: 1.1rem; }
.panel-note { margin: 0 0 12px; color: #6b7280; font-size: 0.9rem; }
.sync-error {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 14px;
}
.table-wrap { overflow-x: auto; }
.staff-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 0.9rem;
}
.staff-table th,
.staff-table td {
  padding: 0.75rem 0.9rem;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}
.staff-table th {
  color: #6b7280;
  font-size: 0.75rem;
  text-transform: uppercase;
  background: #fafafa;
}
input, select {
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0 8px;
  font: inherit;
  color: #1f2937;
  background: #fff;
  max-width: 140px;
}
.roster-table { width: 100%; table-layout: fixed; }
.roster-table th:nth-child(1),
.roster-table td:nth-child(1) { width: 12%; }
.roster-table th:nth-child(2),
.roster-table td:nth-child(2) { width: 20%; }
.roster-table th:nth-child(3),
.roster-table td:nth-child(3) { width: 16%; }
.roster-table th:nth-child(4),
.roster-table td:nth-child(4) { width: 52%; }
.roster-table input,
.roster-table select { max-width: 100%; min-width: 0; box-sizing: border-box; }
.shift { display: flex; flex-direction: column; align-items: stretch; gap: 8px; width: 100%; min-width: 0; }
.shift-times { display: flex; align-items: flex-end; gap: 8px; width: 100%; }
.shift-field {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
}
.shift-field input { width: 100%; max-width: none; min-width: 0; }
.days {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  width: 100%;
}
.day {
  height: 32px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #eef0ff;
  color: #5a67d8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.day.off { background: #fff; color: #6b7280; }
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
.row-actions { display: flex; justify-content: flex-end; gap: 4px; white-space: nowrap; }
.text-btn {
  height: 32px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: #b91c1c;
  font-weight: 600;
  cursor: pointer;
}
.paid-btn { color: #0e3b2e; }
.paid-btn[aria-pressed='true'] {
  background: #e7f3ee;
  border-radius: 999px;
}
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
.payable-dialog {
  width: min(520px, 100%);
  background: #fff;
  border-radius: 16px;
  color: #1f2937;
  box-shadow: 0 20px 50px rgba(17, 24, 39, 0.22);
  overflow: visible;
}
.payable-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 16px 16px 0 0;
  background: linear-gradient(180deg, #0e3b2e 0%, #114e43 100%);
  color: #fff;
}
.payable-head h3 { margin: 0; font-size: 20px; font-weight: 700; }
.payable-head p { margin: 4px 0 0; color: rgba(255, 255, 255, 0.82); font-size: 13px; font-weight: 500; line-height: 1.4; }
.payable-x {
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  background: transparent;
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.payable-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;
  padding: 20px;
}
.payable-form .span-2 { grid-column: 1 / -1; }
.payable-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.payable-form input,
.payable-form select {
  width: 100%;
  max-width: none;
  height: 40px;
  box-sizing: border-box;
}
.payable-form input:focus,
.payable-form input:focus-visible,
.payable-form select:focus,
.payable-form select:focus-visible,
.payable-form :deep(.date-trigger:focus),
.payable-form :deep(.date-trigger:focus-visible),
.payable-form :deep(.date-trigger:hover) {
  outline: none;
  border-color: #e5e7eb;
  box-shadow: none;
}
.payable-form :deep(.date-field) { display: block; width: 100%; }
.payable-form :deep(.date-trigger) { width: 100%; min-width: 0; box-sizing: border-box; }
.peso {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  box-sizing: border-box;
}
.peso input {
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: #1f2937;
}
.payable-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 20px;
}
.payable-cancel {
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  font-weight: 600;
  cursor: pointer;
}
@media (max-width: 560px) {
  .payable-form { grid-template-columns: 1fr; }
  .payable-form .span-2 { grid-column: auto; }
}
</style>
