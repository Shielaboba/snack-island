<template>
  <Teleport to="body">
    <div
      v-if="isOpen && entry"
      class="modal-overlay"
      data-testid="ledger-delete-modal"
      @click.self="emit('close')"
    >
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <div>
            <h2>Delete entry</h2>
            <p class="modal-subtitle">This removes the line from the cash book</p>
          </div>
          <button class="close-btn" type="button" aria-label="Close modal" @click="emit('close')">×</button>
        </div>
        <div class="modal-body">
          <p v-if="error" class="modal-error" data-testid="ledger-delete-error">{{ error }}</p>
          <p>
            Are you sure you want to delete
            <strong>{{ ledgerTypeLabel(entry.type) }}</strong>
            of ₱{{ formatCurrency(entry.amount) }}?
          </p>
          <p v-if="entry.type === 'fund_expense'" class="transfer-note">
            This also deletes the matching transfer on the other wallet.
          </p>
          <p class="warning-text">This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-testid="ledger-delete-cancel"
            :disabled="deleting"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger"
            data-testid="ledger-delete-confirm"
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
import type { LedgerEntry } from '../models/Ledger'
import { ledgerTypeLabel } from '../modules/ledger/ledgerUtils'

defineProps<{
  isOpen: boolean
  entry: LedgerEntry | null
  deleting: boolean
  error: string
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

function formatCurrency(value: number): string {
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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
  max-width: 480px;
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
.modal-body p {
  margin: 0 0 12px;
  color: #495057;
  line-height: 1.5;
}
.modal-error {
  color: #dc3545;
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
}
.transfer-note { color: #495057; font-weight: 600; }
.warning-text {
  color: #dc3545;
  font-size: 0.9rem;
  margin-bottom: 0;
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
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-secondary { background: #e9ecef; color: #495057; }
.btn-danger {
  background: #dc3545;
  color: white;
}
</style>
