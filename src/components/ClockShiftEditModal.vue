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
          <label class="field-label" for="clock-in-time">Clock in</label>
          <input
            id="clock-in-time"
            v-model="form.clock_in_at"
            type="datetime-local"
            class="field-input"
            data-testid="clock-in-time"
            required
          />
          <label class="field-label" for="clock-out-time">Clock out</label>
          <input
            id="clock-out-time"
            v-model="form.clock_out_at"
            type="datetime-local"
            class="field-input"
            data-testid="clock-out-time"
            :required="mode === 'add'"
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
import {
  fromManilaDateTimeLocal,
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
  submit: [payload: { staff_name: StaffName; clock_in_at: string; clock_out_at: string | null }]
}>()

const form = reactive({
  staff_name: 'Shai' as StaffName,
  clock_in_at: '',
  clock_out_at: ''
})
const localError = ref('')

function hydrate() {
  localError.value = ''
  if (props.mode === 'edit' && props.shift) {
    form.staff_name = props.shift.staff_name
    form.clock_in_at = toManilaDateTimeLocal(props.shift.clock_in_at)
    form.clock_out_at = props.shift.clock_out_at
      ? toManilaDateTimeLocal(props.shift.clock_out_at)
      : ''
    return
  }
  form.staff_name = 'Shai'
  const now = new Date()
  form.clock_in_at = toManilaDateTimeLocal(now.toISOString())
  form.clock_out_at = toManilaDateTimeLocal(new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString())
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
    const clockInAt = fromManilaDateTimeLocal(form.clock_in_at)
    const clockOutAt = form.clock_out_at ? fromManilaDateTimeLocal(form.clock_out_at) : null
    if (props.mode === 'add' && !clockOutAt) {
      localError.value = 'Clock-out time is required for a missed punch.'
      return
    }
    const check = validateShiftTimes(clockInAt, clockOutAt)
    if (!check.ok) {
      localError.value = check.message
      return
    }
    emit('submit', {
      staff_name: form.staff_name,
      clock_in_at: clockInAt,
      clock_out_at: clockOutAt
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
.field-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  font-size: 0.95rem;
}
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
