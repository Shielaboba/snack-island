<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay"
      data-testid="clock-photo-modal"
      @click.self="emit('close')"
    >
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h2>{{ title }}</h2>
          <button
            class="close-btn"
            type="button"
            data-testid="clock-photo-close"
            aria-label="Close modal"
            @click="emit('close')"
          >
            ×
          </button>
        </div>
        <div class="modal-body">
          <img v-if="src" :src="src" :alt="title" class="selfie" />
          <p v-else>No photo for this punch.</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  isOpen: boolean
  src: string
  title: string
}>()

const emit = defineEmits<{
  close: []
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
  padding: 24px;
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
  align-items: center;
  padding: 20px 24px 0;
}
.modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #212529;
}
.close-btn {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 1.5rem;
}
.modal-body { padding: 16px 24px 24px; }
.selfie {
  width: 100%;
  border-radius: 12px;
  display: block;
  background: #dee2e6;
}
</style>
