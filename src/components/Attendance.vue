<template>
  <div class="attendance-page">
    <div class="page-header">
      <div class="header-top">
        <h1>Attendance</h1>
        <div class="header-actions">
          <button class="btn-secondary" type="button" data-testid="payroll-btn" @click="payrollOpen = true">
            Payroll Calculator
          </button>
          <button class="btn-primary" type="button" data-testid="add-missed-btn" @click="openAdd">
            Add missed punch
          </button>
        </div>
      </div>
      <p>Approve or decline without changing punch time. OT is recorded if staff request it, or if you record it for them (minimum 2 hours).</p>
    </div>

    <p v-if="error && !editOpen && !deleteOpen && !payrollOpen" class="error-state">{{ error }}</p>
    <p v-else-if="isLoading" class="empty-state">Loading attendance…</p>
    <p v-else-if="shifts.length === 0" class="empty-state">No punches yet.</p>
    <div v-else class="table-wrap">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>In</th>
            <th>Out</th>
            <th>Hours</th>
            <th>OT</th>
            <th>Photos</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in shifts" :key="row.id">
            <td>{{ row.staff_name }}</td>
            <td>{{ formatManilaDateTime(row.clock_in_at) }}</td>
            <td>{{ row.clock_out_at ? formatManilaDateTime(row.clock_out_at) : '—' }}</td>
            <td>{{ formatHours(shiftHours(row)) }}</td>
            <td :data-testid="`ot-${row.id}`">
              {{ formatHours(recordedOvertimeHours(row)) }}
              <div v-if="row.ot_status" class="muted">OT {{ punchStatusLabel(row.ot_status) }}</div>
            </td>
            <td>
              <button
                v-if="row.clock_in_photo_path"
                class="link-btn"
                type="button"
                :data-testid="`photo-in-${row.id}`"
                @click="openPhoto(row, 'in')"
              >
                In photo
              </button>
              <span v-else class="muted">No in photo</span>
              <button
                v-if="row.clock_out_photo_path"
                class="link-btn"
                type="button"
                :data-testid="`photo-out-${row.id}`"
                @click="openPhoto(row, 'out')"
              >
                Out photo
              </button>
            </td>
            <td>
              <div class="status-cell">
                <span>In {{ punchStatusLabel(row.clock_in_status) }}</span>
                <span>Out {{ punchStatusLabel(row.clock_out_status) }}</span>
                <div class="status-actions">
                  <button
                    v-if="row.clock_in_status === 'pending'"
                    class="mini approve"
                    type="button"
                    :data-testid="`approve-in-${row.id}`"
                    @click="setStatus(row.id, 'in', 'approved')"
                  >
                    Approve in
                  </button>
                  <button
                    v-if="row.clock_in_status === 'pending'"
                    class="mini decline"
                    type="button"
                    :data-testid="`decline-in-${row.id}`"
                    @click="setStatus(row.id, 'in', 'declined')"
                  >
                    Decline in
                  </button>
                  <button
                    v-if="row.clock_out_status === 'pending'"
                    class="mini approve"
                    type="button"
                    :data-testid="`approve-out-${row.id}`"
                    @click="setStatus(row.id, 'out', 'approved')"
                  >
                    Approve out
                  </button>
                  <button
                    v-if="row.clock_out_status === 'pending'"
                    class="mini decline"
                    type="button"
                    :data-testid="`decline-out-${row.id}`"
                    @click="setStatus(row.id, 'out', 'declined')"
                  >
                    Decline out
                  </button>
                  <button
                    v-if="row.ot_status === 'pending'"
                    class="mini approve"
                    type="button"
                    :data-testid="`approve-ot-${row.id}`"
                    @click="setOt(row.id, 'approved')"
                  >
                    Approve OT
                  </button>
                  <button
                    v-if="row.ot_status === 'pending'"
                    class="mini decline"
                    type="button"
                    :data-testid="`decline-ot-${row.id}`"
                    @click="setOt(row.id, 'declined')"
                  >
                    Decline OT
                  </button>
                  <button
                    v-if="canRecordOt(row)"
                    class="mini approve"
                    type="button"
                    :data-testid="`record-ot-${row.id}`"
                    @click="markOt(row)"
                  >
                    Record OT
                  </button>
                </div>
              </div>
            </td>
            <td>
              <div class="row-actions">
                <button
                  class="icon-btn"
                  type="button"
                  :data-testid="`edit-${row.id}`"
                  aria-label="Edit times"
                  @click="openEdit(row)"
                >
                  ✎
                </button>
                <button
                  class="icon-btn"
                  type="button"
                  :data-testid="`delete-${row.id}`"
                  aria-label="Delete punch"
                  @click="openDelete(row)"
                >
                  🗑
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

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
    <PayrollCalculatorModal
      :is-open="payrollOpen"
      :shifts="shifts"
      @close="payrollOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { PunchStatus, StaffClockShift } from '../models/StaffClock'
import { authService } from '../services/authService'
import { staffClockService } from '../services/staffClockService'
import {
  canRecordOt,
  errorMessage,
  formatHours,
  formatManilaDateTime,
  punchStatusLabel,
  recordedOvertimeHours,
  shiftHours
} from '../modules/staffClock/staffClockUtils'
import ClockPhotoModal from './ClockPhotoModal.vue'
import ClockShiftEditModal from './ClockShiftEditModal.vue'
import ClockShiftDeleteModal from './ClockShiftDeleteModal.vue'
import PayrollCalculatorModal from './PayrollCalculatorModal.vue'

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

const actor = () => authService.getCurrentUser()?.username ?? 'admin'

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
}) {
  error.value = ''
  try {
    if (editMode.value === 'add') {
      if (!payload.clock_out_at) throw new Error('Clock-out time is required.')
      await staffClockService.createMissedPunch(
        {
          staff_name: payload.staff_name,
          clock_in_at: payload.clock_in_at,
          clock_out_at: payload.clock_out_at
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

onMounted(load)
</script>

<style scoped>
.attendance-page { padding: 0; color: #212529; }
.page-header { margin-bottom: 1.5rem; }
.header-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px 12px;
}
.header-top h1 {
  margin: 0;
  font-size: 2rem;
  color: #212529;
  font-weight: 700;
  flex: 0 0 auto;
}
.page-header > p { margin: 0.25rem 0 0; color: #6c757d; font-size: 0.95rem; }
.header-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}
.btn-secondary {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  background: #e9ecef;
  color: #495057;
  border: none;
  white-space: nowrap;
}
.btn-primary {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  white-space: nowrap;
}
.table-wrap { overflow-x: auto; }
.attendance-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  font-size: 0.9rem;
}
.attendance-table th,
.attendance-table td {
  padding: 0.9rem 1rem;
  text-align: left;
  border-bottom: 1px solid #f1f3f5;
  vertical-align: top;
}
.attendance-table th { color: #6c757d; font-size: 0.8rem; text-transform: uppercase; }
.link-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-weight: 600;
  margin-right: 8px;
  padding: 0;
}
.muted { color: #868e96; font-size: 0.85rem; }
.status-cell { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
.status-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.mini {
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}
.mini.approve { background: #d3f9d8; color: #2b8a3e; }
.mini.decline { background: #ffe3e3; color: #c92a2a; }
.row-actions { display: flex; gap: 14px; }
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 4px;
}
.error-state,
.empty-state { color: #6c757d; text-align: center; padding: 2rem; }
.error-state { color: #c92a2a; }
</style>
