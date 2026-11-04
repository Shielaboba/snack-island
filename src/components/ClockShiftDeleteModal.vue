<template>
  <Teleport to="body">
    <div
      v-if="isOpen && shift"
      class="modal-overlay"
      data-testid="clock-delete-modal"
      @click.self="emit('close')"
    >
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <div>
            <h2>Delete punch</h2>
            <p class="modal-subtitle">This removes {{ shift.staff_name }}'s session</p>
          </div>
          <button class="close-btn" type="button" aria-label="Close modal" @click="emit('close')">×</button>
        </div>
        <div class="modal-body">
          <p v-if="error" class="modal-error">{{ error }}</p>
          <p>
            Delete this session for <strong>{{ shift.staff_name }}</strong>? Photos are removed too.
          </p>
          <p class="warning-text">This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" type="button" :disabled="deleting" @click="emit('close')">
            Cancel
          </button>
          <button
            class="btn btn-danger"
            type="button"
            data-testid="clock-delete-confirm"
            :disabled="deleting"
            @click="emit('confirm')"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { StaffClockShift } from '../models/StaffClock'

defineProps<{
  isOpen: boolean
  shift: StaffClockShift | null
  deleting: boolean
  error: string
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()
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
.modal-body { padding: 28px; }
.modal-body p { margin: 0 0 12px; color: #495057; line-height: 1.5; }
.modal-error {
  color: #dc3545;
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
}
.warning-text { color: #dc3545; font-size: 0.9rem; margin-bottom: 0; }
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
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #e9ecef; color: #495057; }
.btn-danger { background: #dc3545; color: white; }
</style>
