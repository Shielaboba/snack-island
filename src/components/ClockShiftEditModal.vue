<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay"
      data-testid="clock-edit-modal"
      @click.self="emit('close')"
    >
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <div>
            <h2>{{ mode === 'add' ? 'Add missed punch' : 'Edit times' }}</h2>
            <p class="modal-subtitle">Typed override. No selfie. Saved times are approved.</p>
          </div>
          <button class="close-btn" type="button" aria-label="Close modal" @click="emit('close')">×</button>
        </div>
        <form class="modal-body" @submit.prevent="submit">
          <p v-if="localError" class="modal-error">{{ localError }}</p>
          <label v-if="mode === 'add'" class="field-label" for="clock-edit-staff">Staff</label>
          <select
            v-if="mode === 'add'"
            id="clock-edit-staff"
            v-model="form.staff_name"
            class="field-input"
            data-testid="clock-staff"
          >
            <option v-for="name in STAFF_NAMES" :key="name" :value="name">{{ name }}</option>
          </select>
          <span class="field-label">Clock in</span>
          <div class="when">
            <DateField v-model="form.clock_in_date" test-id="clock-in-date" aria-label="Clock in date" />
            <input
              id="clock-in-clock"
              v-model="form.clock_in_clock"
              type="time"
              class="field-input"
              data-testid="clock-in-clock"
              aria-label="Clock in time"
              required
            />
          </div>
          <span class="field-label">Clock out</span>
          <div class="when">
            <DateField v-model="form.clock_out_date" test-id="clock-out-date" aria-label="Clock out date" />
            <input
              id="clock-out-clock"
              v-model="form.clock_out_clock"
              type="time"
              class="field-input"
              data-testid="clock-out-clock"
              aria-label="Clock out time"
              :required="mode === 'add'"
            />
          </div>
          <label v-if="mode === 'add'" class="field-label" for="clock-ot-hours">Overtime hours</label>
          <input
            v-if="mode === 'add'"
            id="clock-ot-hours"
            v-model.number="form.ot_hours"
            type="number"
            min="0"
            step="any"
            class="field-input"
            data-testid="clock-ot-hours"
          />
          <div class="modal-footer">
            <button class="btn btn-secondary" type="button" @click="emit('close')">Cancel</button>
            <button class="btn btn-primary" type="submit" data-testid="clock-edit-save">Save</button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { STAFF_NAMES, type StaffClockShift, type StaffName } from '../models/StaffClock'
import DateField from './DateField.vue'
import {
  fromManilaDateTimeLocal,
  manilaToday,
  missedPunchOtError,
  toManilaDateTimeLocal,
  validateShiftTimes
} from '../modules/staffClock/staffClockUtils'

const props = defineProps<{
  isOpen: boolean
  mode: 'add' | 'edit'
  shift?: StaffClockShift | null
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { staff_name: StaffName; clock_in_at: string; clock_out_at: string | null; ot_hours?: number }]
}>()

const form = reactive({
  staff_name: 'Shai' as StaffName,
  clock_in_date: '',
  clock_in_clock: '',
  clock_out_date: '',
  clock_out_clock: '',
  ot_hours: 0
})
const localError = ref('')

function splitLocal(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const [date, time] = toManilaDateTimeLocal(iso).split('T')
  return { date: date ?? '', time: time ?? '' }
}

function hydrate() {
  localError.value = ''
  if (props.mode === 'edit' && props.shift) {
    form.staff_name = props.shift.staff_name
    const clockIn = splitLocal(props.shift.clock_in_at)
    const clockOut = splitLocal(props.shift.clock_out_at)
    form.clock_in_date = clockIn.date
    form.clock_in_clock = clockIn.time
    form.clock_out_date = clockOut.date
    form.clock_out_clock = clockOut.time
    form.ot_hours = 0
    return
  }
  form.staff_name = 'Shai'
  const today = manilaToday()
  form.clock_in_date = today
  form.clock_in_clock = '14:00'
  form.clock_out_date = today
  form.clock_out_clock = '22:00'
  form.ot_hours = 0
}

watch(
  () => [props.isOpen, props.mode, props.shift?.id],
  () => {
    if (props.isOpen) hydrate()
  },
  { immediate: true }
)

function submit() {
  localError.value = ''
  try {
    const clockInAt = fromManilaDateTimeLocal(`${form.clock_in_date}T${form.clock_in_clock}`)
    const clockOutAt =
      form.clock_out_date || form.clock_out_clock
        ? fromManilaDateTimeLocal(`${form.clock_out_date}T${form.clock_out_clock}`)
        : null
    if (props.mode === 'add' && !clockOutAt) {
      localError.value = 'Clock-out time is required for a missed punch.'
      return
    }
    const check = validateShiftTimes(clockInAt, clockOutAt)
    if (!check.ok) {
      localError.value = check.message
      return
    }
    const otHours = Number(form.ot_hours) || 0
    const otError = props.mode === 'add' && clockOutAt ? missedPunchOtError(clockInAt, clockOutAt, otHours) : null
    if (otError) {
      localError.value = otError
      return
    }
    emit('submit', {
      staff_name: form.staff_name,
      clock_in_at: clockInAt,
      clock_out_at: clockOutAt,
      ...(props.mode === 'add' ? { ot_hours: otHours } : {})
    })
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Enter valid times.'
  }
}
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
  max-width: 420px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 28px;
  border-bottom: 1px solid #e9ecef;
}
.modal-header h2 { margin: 0 0 4px; color: #212529; font-size: 1.5rem; }
.modal-subtitle { margin: 0; color: #6c757d; font-size: 0.9rem; }
.close-btn { background: none; border: none; color: #6c757d; cursor: pointer; font-size: 1.5rem; }
.modal-body { padding: 24px 28px 8px; }
.field-label {
  display: block;
  font-size: 0.85rem;
  color: #495057;
  font-weight: 600;
  margin-bottom: 6px;
}
.when { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; }
.field-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  font-size: 0.95rem;
}
.when .field-input { width: auto; flex: 1; min-width: 0; margin-bottom: 0; }
.modal-error {
  color: #dc3545;
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 8px 0 24px;
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
</style>
