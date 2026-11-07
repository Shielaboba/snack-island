<template>
  <div class="attendance-page">
    <div class="page-header">
      <div class="header-top">
        <h1>Attendance</h1>
        <div class="header-actions">
          <button class="btn-secondary" type="button" data-testid="payroll-btn" @click="payrollOpen = true">
            Payroll summary
          </button>
          <button class="btn-primary" type="button" data-testid="add-missed-btn" @click="openAdd">
            Add missed punch
          </button>
        </div>
      </div>
    </div>

    <p v-if="error && !editOpen && !deleteOpen && !payrollOpen" class="error-banner" role="alert">{{ error }}</p>

    <div class="date-row">
      <span class="filter-label">Date</span>
      <DateField v-model="selectedDay" test-id="attendance-date" aria-label="Date" />
      <button v-if="selectedDay !== today" class="btn-secondary" type="button" data-testid="back-to-today" @click="backToToday">
        Back to today
      </button>
      <span class="note">{{ selectedDay === today ? 'Showing today’s logs.' : `Showing ${selectedDayLabel}.` }}</span>
    </div>

    <div class="chip-row">
      <span class="filter-label">Staff</span>
      <button
        v-for="name in ['All', ...STAFF_NAMES]"
        :key="name"
        type="button"
        class="chip"
        :class="{ active: staffFilter === name }"
        :aria-pressed="staffFilter === name"
        :data-testid="`staff-${name}`"
        @click="chooseStaff(name as 'All' | StaffName)"
      >
        {{ name }}
      </button>
      <span class="filter-label show-label">Show</span>
      <button type="button" class="chip" :class="{ active: focus === 'decisions' }" :aria-pressed="focus === 'decisions'" data-testid="show-decisions" @click="focus = 'decisions'">
        Needs a decision
      </button>
      <button type="button" class="chip" :class="{ active: focus === 'all' }" :aria-pressed="focus === 'all'" data-testid="show-all" @click="focus = 'all'">
        All punches this day
      </button>
    </div>

    <p v-if="isLoading" class="empty-state">Loading attendance…</p>
    <div v-else class="table-wrap">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>In</th>
            <th>Out</th>
            <th class="num">Hours</th>
            <th>Overtime</th>
            <th>Photos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="visibleShifts.length === 0">
            <td colspan="7" class="empty-row">
              {{ focus === 'all' ? 'No punches on this day.' : 'Nothing in this filter for this day. Choose All punches this day.' }}
            </td>
          </tr>
          <tr v-for="{ row, punch } in visibleShifts" :key="row.id">
            <td class="name">{{ row.staff_name }}</td>
            <td>
              <div class="punch">
                <span>{{ punch.inLabel }}</span>
                <span v-if="punch.inCaptured" class="captured">Captured {{ punch.inCaptured }}</span>
                <div class="marks">
                  <span class="badge" :class="row.clock_in_status">{{ punchStatusLabel(row.clock_in_status) }}</span>
                  <button
                    v-if="row.clock_in_status === 'pending'"
                    class="mini approve"
                    type="button"
                    :data-testid="`approve-in-${row.id}`"
                    @click="setStatus(row.id, 'in', 'approved')"
                  >
                    Approve
                  </button>
                  <button
                    v-if="row.clock_in_status === 'pending'"
                    class="mini decline"
                    type="button"
                    :data-testid="`decline-in-${row.id}`"
                    @click="setStatus(row.id, 'in', 'declined')"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </td>
            <td>
              <div class="punch">
                <span>{{ punch.outLabel ?? '—' }}</span>
                <span v-if="punch.outCaptured" class="captured">Captured {{ punch.outCaptured }}</span>
                <span v-if="isOpenShift(row)" class="badge open">On the clock</span>
                <div v-if="row.clock_out_status" class="marks">
                  <span class="badge" :class="row.clock_out_status">{{ punchStatusLabel(row.clock_out_status) }}</span>
                  <button
                    v-if="row.clock_out_status === 'pending'"
                    class="mini approve"
                    type="button"
                    :data-testid="`approve-out-${row.id}`"
                    @click="setStatus(row.id, 'out', 'approved')"
                  >
                    Approve
                  </button>
                  <button
                    v-if="row.clock_out_status === 'pending'"
                    class="mini decline"
                    type="button"
                    :data-testid="`decline-out-${row.id}`"
                    @click="setStatus(row.id, 'out', 'declined')"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </td>
            <td class="num">{{ formatHours(punch.hours) }}</td>
            <td :data-testid="`ot-${row.id}`">
              <div class="punch">
                <span>{{ otActive(row) && recordedOvertimeHours(row) ? formatHours(recordedOvertimeHours(row)) : '—' }}</span>
                <div v-if="row.ot_status" class="marks">
                  <span class="badge" :class="row.ot_status">{{ punchStatusLabel(row.ot_status) }}</span>
                  <button
                    v-if="row.ot_status === 'pending'"
                    class="mini approve"
                    type="button"
                    :data-testid="`approve-ot-${row.id}`"
                    @click="setOt(row.id, 'approved')"
                  >
                    Approve
                  </button>
                  <button
                    v-if="row.ot_status === 'pending'"
                    class="mini decline"
                    type="button"
                    :data-testid="`decline-ot-${row.id}`"
                    @click="setOt(row.id, 'declined')"
                  >
                    Decline
                  </button>
                </div>
                <button
                  v-if="canRecordOt(row)"
                  class="mini secondary"
                  type="button"
                  :data-testid="`record-ot-${row.id}`"
                  @click="markOt(row)"
                >
                  Record OT
                </button>
              </div>
            </td>
            <td>
              <div class="photos">
                <button
                  v-if="row.clock_in_photo_path"
                  class="link-btn"
                  type="button"
                  :data-testid="`photo-in-${row.id}`"
                  @click="openPhoto(row, 'in')"
                >
                  In
                </button>
                <span v-else class="muted">No in photo</span>
                <button
                  v-if="row.clock_out_photo_path"
                  class="link-btn"
                  type="button"
                  :data-testid="`photo-out-${row.id}`"
                  @click="openPhoto(row, 'out')"
                >
                  Out
                </button>
              </div>
            </td>
            <td>
              <div class="row-actions">
                <button
                  class="mini ghost"
                  type="button"
                  :data-testid="`edit-${row.id}`"
                  aria-label="Edit times"
                  @click="openEdit(row)"
                >
                  Edit
                </button>
                <button
                  class="mini decline"
                  type="button"
                  :data-testid="`delete-${row.id}`"
                  aria-label="Delete punch"
                  @click="openDelete(row)"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="payments" aria-label="Payments">
      <div class="payments-head">
        <div>
          <h2>Payments</h2>
          <p>Cash already handed over for a payroll week. A payment the next day still counts toward that week.</p>
          <p v-if="paymentSyncError" class="sync-error" role="alert" data-testid="payment-sync-error">{{ paymentSyncError }}</p>
        </div>
        <button class="btn-primary" type="button" data-testid="add-payment" @click="openPayment">Add payment</button>
      </div>
      <div class="payments-wrap">
        <table class="payments-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Amount</th>
              <th>Paid on</th>
              <th>Payroll</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="payments.length === 0">
              <td colspan="5" class="empty-row">No payments yet.</td>
            </tr>
            <tr v-for="row in payments" :key="row.id">
              <td :data-testid="`payment-staff-${row.id}`">{{ row.staffName }}</td>
              <td :data-testid="`payment-amount-${row.id}`">{{ formatPayrollPeso(row.amount) }}</td>
              <td :data-testid="`payment-paid-on-${row.id}`">{{ row.paidOn }}</td>
              <td :data-testid="`payment-week-${row.id}`">{{ paymentWeekLabel(row) }}</td>
              <td>
                <button class="text-btn" type="button" :data-testid="`payment-remove-${row.id}`" @click="removePayment(row.id)">
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="paymentOpen" class="backdrop" data-testid="payment-modal" @click.self="paymentOpen = false">
        <div class="payable-dialog" role="dialog" aria-label="Add payment">
          <header class="payable-head">
            <div>
              <h3>Add payment</h3>
              <p>Counts toward that payroll week, even when the cash is handed over the next day.</p>
            </div>
            <button class="payable-x" type="button" aria-label="Close" @click="paymentOpen = false">×</button>
          </header>
          <div class="payable-form">
            <p v-if="paymentError" class="span-2 form-error" role="alert" data-testid="payment-form-error">{{ paymentError }}</p>
            <label>
              Staff
              <select v-model="paymentDraft.staffName" data-testid="payment-form-staff">
                <option v-for="name in STAFF_NAMES" :key="name" :value="name">{{ name }}</option>
              </select>
            </label>
            <label>
              Amount
              <span class="peso">
                <span aria-hidden="true">₱</span>
                <input v-model.number="paymentDraft.amount" type="number" min="0" step="0.01" data-testid="payment-form-amount" />
              </span>
            </label>
            <label class="span-2">
              Date paid
              <DateField v-model="paymentDraft.paidOn" test-id="payment-form-paid-on" aria-label="Date paid" />
            </label>
            <label>
              Payroll start
              <DateField v-model="paymentDraft.payrollStart" test-id="payment-form-start" aria-label="Payroll start" />
            </label>
            <label>
              Payroll end
              <DateField v-model="paymentDraft.payrollEnd" test-id="payment-form-end" aria-label="Payroll end" />
            </label>
          </div>
          <div class="payable-actions">
            <button class="payable-cancel" type="button" data-testid="payment-cancel" @click="paymentOpen = false">Cancel</button>
            <button class="btn-primary" type="button" data-testid="payment-save" @click="savePayment">Save</button>
          </div>
        </div>
      </div>
    </section>

    <ClockPhotoModal
      :is-open="photoOpen"
      :src="photoSrc"
      :title="photoTitle"
      @close="photoOpen = false"
    />
    <ClockShiftEditModal
      :is-open="editOpen"
      :mode="editMode"
      :shift="editing"
      @close="closeEdit"
      @submit="saveTimes"
    />
    <ClockShiftDeleteModal
      :is-open="deleteOpen"
      :shift="pendingDelete"
      :deleting="isSaving"
      :error="deleteError"
      @close="closeDelete"
      @confirm="confirmDelete"
    />
    <PayrollSummaryModal
      :is-open="payrollOpen"
      :shifts="shifts"
      @close="payrollOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { STAFF_NAMES, type PunchStatus, type StaffClockShift, type StaffName } from '../models/StaffClock'
import { authService } from '../services/authService'
import { staffClockService } from '../services/staffClockService'
import { formatPayrollPeso } from '../modules/staffClock/staffClockPayroll'
import {
  canRecordOt,
  errorMessage,
  formatHours,
  isOpenShift,
  manilaToday,
  manilaYmd,
  punchStatusLabel,
  recordedOvertimeHours,
  reflectedPunch
} from '../modules/staffClock/staffClockUtils'
import {
  formatShortDate,
  loadStaffPayables,
  loadStaffPayments,
  resolvePayrollView,
  saveStaffPayments,
  type StaffPayment
} from '../modules/staff/staffProfile'
import ClockPhotoModal from './ClockPhotoModal.vue'
import ClockShiftEditModal from './ClockShiftEditModal.vue'
import ClockShiftDeleteModal from './ClockShiftDeleteModal.vue'
import PayrollSummaryModal from './PayrollSummaryModal.vue'
import { staffPayrollService } from '../services/staffPayrollService'
import DateField from './DateField.vue'

const shifts = ref<StaffClockShift[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const error = ref('')
const photoOpen = ref(false)
const photoSrc = ref('')
const photoTitle = ref('')
const editOpen = ref(false)
const editMode = ref<'add' | 'edit'>('add')
const editing = ref<StaffClockShift | null>(null)
const payrollOpen = ref(false)
const deleteOpen = ref(false)
const pendingDelete = ref<StaffClockShift | null>(null)
const deleteError = ref('')
const payments = ref<StaffPayment[]>(loadStaffPayments())
const paymentOpen = ref(false)
const paymentDraft = ref(emptyPayment())
const paymentError = ref('')
const paymentSyncError = ref('')
// True while payments pulled from the shared table are copied in, so they are not pushed straight back.
let applyingShared = false
// Payments added here before the shared records arrive keep the local list.
let paymentsEdited = false

function highestPaymentSeq(rows: StaffPayment[]): number {
  return rows.reduce((max, row) => {
    const match = /^payment-(\d+)$/.exec(row.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
}

let paymentSeq = highestPaymentSeq(payments.value)
watch(payments, (rows) => {
  saveStaffPayments(rows)
  if (applyingShared) return
  paymentsEdited = true
  staffPayrollService.push('payments', rows).then(
    () => {
      paymentSyncError.value = ''
    },
    () => {
      paymentSyncError.value = 'Could not save payments to the shared records. They are only on this device for now.'
    }
  )
}, { deep: true })

async function pullPayments() {
  try {
    await staffPayrollService.pull()
  } catch {
    paymentSyncError.value = 'Could not load the shared payments. Showing what this device saved last.'
    return
  }
  if (paymentsEdited) return
  applyingShared = true
  payments.value = loadStaffPayments()
  paymentSeq = Math.max(paymentSeq, highestPaymentSeq(payments.value))
  await nextTick()
  applyingShared = false
}

const today = ref(manilaToday())
const selectedDay = ref(today.value)

// Keep "today" right when the page stays open past midnight.
function refreshToday() {
  const next = manilaToday()
  if (next === today.value) return
  if (selectedDay.value === today.value) selectedDay.value = next
  today.value = next
}
const todayTimer = setInterval(refreshToday, 60_000)
document.addEventListener('visibilitychange', refreshToday)
onUnmounted(() => {
  clearInterval(todayTimer)
  document.removeEventListener('visibilitychange', refreshToday)
})
const staffFilter = ref<'All' | StaffName>('All')
type Focus = 'all' | 'decisions'
const focus = ref<Focus>('all')

const selectedDayLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date(`${selectedDay.value}T12:00:00+08:00`))
)

const dayRows = computed(() =>
  shifts.value.filter((row) => {
    if (manilaYmd(row.clock_in_at) !== selectedDay.value) return false
    return staffFilter.value === 'All' || row.staff_name === staffFilter.value
  })
)

function needsDecision(row: StaffClockShift): boolean {
  return (
    row.clock_in_status === 'pending' ||
    row.clock_out_status === 'pending' ||
    row.ot_status === 'pending' ||
    isOpenShift(row)
  )
}

const visibleShifts = computed(() =>
  dayRows.value
    .filter((row) => focus.value === 'all' || needsDecision(row))
    .sort(
      (a, b) =>
        Date.parse(a.clock_in_at) - Date.parse(b.clock_in_at) ||
        a.staff_name.localeCompare(b.staff_name)
    )
    .map((row) => ({ row, punch: reflectedPunch(row) }))
)

function backToToday() {
  refreshToday()
  selectedDay.value = today.value
}

function otActive(row: StaffClockShift): boolean {
  return row.ot_status === 'pending' || row.ot_status === 'approved'
}

function chooseStaff(name: 'All' | StaffName) {
  staffFilter.value = name
}

const actor = () => authService.getCurrentUser()?.username ?? 'admin'

watch(selectedDay, () => {
  photoOpen.value = false
})

async function load() {
  isLoading.value = true
  error.value = ''
  try {
    shifts.value = await staffClockService.list()
  } catch (err) {
    error.value = errorMessage(err, 'Could not load attendance.')
  } finally {
    isLoading.value = false
  }
}

function openPhoto(row: StaffClockShift, side: 'in' | 'out') {
  const path = side === 'in' ? row.clock_in_photo_path : row.clock_out_photo_path
  photoSrc.value = staffClockService.photoUrl(path)
  photoTitle.value = `${row.staff_name} clock ${side}`
  photoOpen.value = true
}

function openAdd() {
  editMode.value = 'add'
  editing.value = null
  editOpen.value = true
}

function openEdit(row: StaffClockShift) {
  editMode.value = 'edit'
  editing.value = row
  editOpen.value = true
}

function closeEdit() {
  editOpen.value = false
  editing.value = null
}

function openDelete(row: StaffClockShift) {
  pendingDelete.value = row
  deleteError.value = ''
  deleteOpen.value = true
}

function closeDelete() {
  deleteOpen.value = false
  pendingDelete.value = null
  deleteError.value = ''
}

async function setStatus(id: string, side: 'in' | 'out', status: PunchStatus) {
  error.value = ''
  try {
    await staffClockService.setPunchStatus(id, side, status, actor())
    await load()
  } catch (err) {
    error.value = errorMessage(err, 'Could not update status.')
  }
}

async function setOt(id: string, status: PunchStatus) {
  error.value = ''
  try {
    await staffClockService.setOtStatus(id, status, actor())
    await load()
  } catch (err) {
    error.value = errorMessage(err, 'Could not update OT.')
  }
}

async function markOt(row: StaffClockShift) {
  error.value = ''
  try {
    await staffClockService.recordOt(row, actor())
    await load()
  } catch (err) {
    error.value = errorMessage(err, 'Could not record OT.')
  }
}

async function saveTimes(payload: {
  staff_name: StaffClockShift['staff_name']
  clock_in_at: string
  clock_out_at: string | null
  ot_hours?: number
}) {
  error.value = ''
  try {
    if (editMode.value === 'add') {
      if (!payload.clock_out_at) throw new Error('Clock-out time is required.')
      await staffClockService.createMissedPunch(
        {
          staff_name: payload.staff_name,
          clock_in_at: payload.clock_in_at,
          clock_out_at: payload.clock_out_at,
          ot_hours: payload.ot_hours ?? 0
        },
        shifts.value,
        actor()
      )
    } else if (editing.value) {
      await staffClockService.updateTimes(
        editing.value,
        {
          staff_name: payload.staff_name,
          clock_in_at: payload.clock_in_at,
          clock_out_at: payload.clock_out_at
        },
        shifts.value,
        actor()
      )
    }
    closeEdit()
    await load()
  } catch (err) {
    error.value = errorMessage(err, 'Could not save times.')
  }
}

async function confirmDelete() {
  const row = pendingDelete.value
  if (!row || isSaving.value) return
  isSaving.value = true
  deleteError.value = ''
  try {
    await staffClockService.remove(row)
    closeDelete()
    await load()
  } catch (err) {
    deleteError.value = errorMessage(err, 'Could not delete punch.')
  } finally {
    isSaving.value = false
  }
}

function emptyPayment() {
  const view = resolvePayrollView(loadStaffPayables())
  return {
    staffName: view.staffName,
    amount: 0,
    paidOn: manilaToday(),
    payrollStart: view.startDate,
    payrollEnd: view.endDate
  }
}

function openPayment() {
  paymentDraft.value = emptyPayment()
  paymentError.value = ''
  paymentOpen.value = true
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function paymentDraftError(): string {
  const draft = paymentDraft.value
  if (!(Number(draft.amount) > 0)) return 'Enter an amount above zero.'
  if (!ISO_DATE.test(draft.paidOn)) return 'Choose the date paid.'
  if (!ISO_DATE.test(draft.payrollStart) || !ISO_DATE.test(draft.payrollEnd)) {
    return 'Choose the payroll start and end dates.'
  }
  if (draft.payrollEnd < draft.payrollStart) return 'Payroll end must be on or after the start.'
  return ''
}

function savePayment() {
  paymentError.value = paymentDraftError()
  if (paymentError.value) return
  paymentSeq += 1
  payments.value.push({
    id: `payment-${paymentSeq}`,
    staffName: paymentDraft.value.staffName,
    amount: Number(paymentDraft.value.amount) || 0,
    paidOn: paymentDraft.value.paidOn,
    payrollStart: paymentDraft.value.payrollStart,
    payrollEnd: paymentDraft.value.payrollEnd
  })
  paymentOpen.value = false
}

function removePayment(id: string) {
  payments.value = payments.value.filter((row) => row.id !== id)
}

function paymentWeekLabel(row: StaffPayment): string {
  return `${formatShortDate(row.payrollStart)} – ${formatShortDate(row.payrollEnd)}`
}

onMounted(() => {
  load()
  pullPayments()
})
</script>

<style scoped>
.attendance-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  color: #1f2937;
}
.page-header { margin: 0; }
.header-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.header-top h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 30px;
  color: #1f2937;
}
.header-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.btn-secondary,
.btn-primary {
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-secondary { background: #fff; color: #374151; border: 1px solid #e5e7eb; }
.btn-primary { background: #5a67d8; color: #fff; border: 1px solid #5a67d8; }
.date-row, .chip-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.filter-label { font-size: 13px; font-weight: 600; color: #6b7280; }
.show-label { margin-left: 8px; }
.note { color: #6b7280; font-size: 14px; }
.chip {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.chip.active { border-color: #5a67d8; background: #eef0ff; color: #5a67d8; }
.table-wrap {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow-x: auto;
}
.attendance-table { width: 100%; min-width: 860px; border-collapse: collapse; font-size: 14px; }
.attendance-table th,
.attendance-table td {
  padding: 11px 14px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
}
.attendance-table th {
  background: #fafafa;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.num { text-align: right; font-variant-numeric: tabular-nums; }
.name { font-weight: 600; }
.punch { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.captured { color: #9ca3af; font-size: 12px; }
.marks, .photos, .row-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.row-actions { justify-content: flex-end; }
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
}
.badge.pending { background: #fef3c7; color: #92400e; }
.badge.approved { background: #dcfce7; color: #166534; }
.badge.declined { background: #fee2e2; color: #b91c1c; }
.badge.open { background: #eef0ff; color: #5a67d8; }
.link-btn {
  background: none;
  border: none;
  color: #5a67d8;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  padding: 0;
  text-decoration: underline;
}
.mini {
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.mini.approve { color: #166534; }
.mini.decline { color: #b91c1c; }
.mini.ghost { color: #6b7280; border-color: transparent; background: transparent; }
.mini.secondary { color: #374151; }
.muted { color: #9ca3af; font-size: 13px; }
.empty-row { color: #6b7280; text-align: center; padding: 40px 16px; }
.empty-state { color: #6b7280; text-align: center; padding: 2rem; }
.error-banner {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 14px;
}
.payments-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.payments-head h2 { margin: 0; font-size: 18px; }
.payments-head p { margin: 4px 0 0; color: #6b7280; font-size: 14px; }
.payments-head .sync-error { color: #b91c1c; }
.form-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 13px;
}
.payments-wrap {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow-x: auto;
}
.payments-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.payments-table th,
.payments-table td {
  padding: 11px 14px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}
.payments-table th {
  background: #fafafa;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.text-btn {
  height: 32px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: #b91c1c;
  font-weight: 600;
  cursor: pointer;
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
  .payments-head { align-items: flex-start; flex-direction: column; }
}
</style>
