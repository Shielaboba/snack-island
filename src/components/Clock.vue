<template>
  <div class="clock-page">
    <div class="page-header">
      <div class="header-text">
        <h1>Clock</h1>
        <p>Pick your name, then clock in or out with a selfie</p>
      </div>
    </div>

    <label class="filter-label" for="clock-staff">Who</label>
    <select
      id="clock-staff"
      v-model="staffName"
      class="staff-select"
      data-testid="clock-staff"
    >
      <option v-for="name in STAFF_NAMES" :key="name" :value="name">{{ name }}</option>
    </select>

    <p v-if="error" class="error-state">{{ error }}</p>

    <div
      class="stage"
      :class="{ 'capture-layout': capturing }"
      data-testid="clock-capture-layout"
    >
      <div class="time-panel">
        <div class="live-date">{{ liveDate }}</div>
        <div class="live-time" data-testid="clock-live-time">{{ liveTime }}</div>
        <div class="elapsed">{{ elapsedCopy }}</div>
        <div class="status-note" data-testid="clock-status">{{ statusCopy }}</div>
        <div v-if="otCopy" class="status-note" data-testid="clock-ot-status">{{ otCopy }}</div>
      </div>

      <div v-if="capturing" class="camera-panel">
        <div class="camera-title">{{ captureMode === 'out' ? 'Clock out selfie' : 'Clock in selfie' }}</div>
        <video
          ref="videoEl"
          class="camera-video"
          data-testid="clock-camera"
          autoplay
          playsinline
          muted
        />
        <button
          class="btn-primary"
          type="button"
          data-testid="clock-capture-btn"
          :disabled="saving"
          @click="capture"
        >
          {{ captureMode === 'out' ? 'Capture clock out' : 'Capture clock in' }}
        </button>
        <button class="btn-secondary" type="button" :disabled="saving" @click="cancelCapture">
          Cancel
        </button>
      </div>
    </div>

    <button
      v-if="!capturing && action === 'clock_in'"
      class="btn-primary action-btn"
      type="button"
      data-testid="clock-in-btn"
      :disabled="saving"
      @click="startCapture('in')"
    >
      Clock in
    </button>
    <button
      v-if="!capturing && showRequestOt"
      class="btn-secondary action-btn"
      type="button"
      data-testid="request-ot-btn"
      :disabled="saving"
      @click="requestOt"
    >
      Request OT
    </button>
    <button
      v-if="!capturing && action === 'clock_out'"
      class="btn-primary action-btn"
      type="button"
      data-testid="clock-out-btn"
      :disabled="saving"
      @click="startCapture('out')"
    >
      Clock out
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { STAFF_NAMES, type StaffName } from '../models/StaffClock'
import type { StaffClockShift } from '../models/StaffClock'
import { authService } from '../services/authService'
import { staffClockService } from '../services/staffClockService'
import { captureVideoFrame } from '../modules/staffClock/compressSelfie'
import {
  canRequestOt,
  clockStatusCopy,
  errorMessage,
  formatManilaLive,
  isOpenShift,
  latestShiftFor,
  nextClockAction,
  otStatusCopy
} from '../modules/staffClock/staffClockUtils'

const staffName = ref<StaffName>('Shai')
const shifts = ref<StaffClockShift[]>([])
const capturing = ref(false)
const captureMode = ref<'in' | 'out'>('in')
const saving = ref(false)
const error = ref('')
const liveTime = ref(formatManilaLive())
const liveDate = ref('')
const videoEl = ref<HTMLVideoElement | null>(null)
let stream: MediaStream | null = null
let tick: ReturnType<typeof setInterval> | null = null

const actor = () => authService.getCurrentUser()?.username ?? 'staff'

const relevantShift = computed(() => latestShiftFor(staffName.value, shifts.value))
const action = computed(() => nextClockAction(staffName.value, shifts.value))
const statusCopy = computed(() => clockStatusCopy(relevantShift.value))
const otCopy = computed(() => otStatusCopy(relevantShift.value))
const showRequestOt = computed(
  () => action.value === 'clock_out' && canRequestOt(relevantShift.value)
)
const elapsedCopy = computed(() => {
  const shift = relevantShift.value
  if (!shift || !isOpenShift(shift)) return 'Not on the clock'
  const ms = Date.now() - Date.parse(shift.clock_in_at)
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m on the clock`
})

function refreshClock() {
  const now = new Date()
  liveTime.value = formatManilaLive(now)
  liveDate.value = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(now)
}

async function load() {
  try {
    shifts.value = await staffClockService.list()
  } catch (err) {
    error.value = errorMessage(err, 'Could not load clock.')
  }
}

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  if (videoEl.value) videoEl.value.srcObject = null
}

async function startCapture(mode: 'in' | 'out') {
  error.value = ''
  captureMode.value = mode
  capturing.value = true
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    })
    if (videoEl.value) videoEl.value.srcObject = stream
  } catch (err) {
    capturing.value = false
    error.value = errorMessage(err, 'Camera is not available.')
  }
}

function cancelCapture() {
  capturing.value = false
  stopCamera()
}

async function requestOt() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    const updated = await staffClockService.requestOt(staffName.value, shifts.value, actor())
    shifts.value = shifts.value.map((row) => (row.id === updated.id ? updated : row))
    if (!shifts.value.some((row) => row.id === updated.id)) shifts.value = [updated, ...shifts.value]
    await load()
  } catch (err) {
    error.value = errorMessage(err, 'Could not request OT.')
  } finally {
    saving.value = false
  }
}

async function capture() {
  if (!videoEl.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const frame = await captureVideoFrame(videoEl.value)
    if (captureMode.value === 'out') {
      await staffClockService.clockOut(staffName.value, frame, shifts.value, actor())
    } else {
      await staffClockService.clockIn(staffName.value, frame, shifts.value, actor())
    }
    stopCamera()
    capturing.value = false
    await load()
  } catch (err) {
    error.value = errorMessage(err, 'Could not save punch.')
  } finally {
    saving.value = false
  }
}

watch(staffName, () => {
  cancelCapture()
})

onMounted(() => {
  refreshClock()
  tick = setInterval(refreshClock, 1000)
  load()
})

onUnmounted(() => {
  if (tick) clearInterval(tick)
  stopCamera()
})
</script>

<style scoped>
.clock-page { padding: 0; max-width: 820px; color: #212529; }
.page-header { margin-bottom: 1.25rem; }
.header-text h1 { margin: 0 0 0.25rem; font-size: 2rem; color: #212529; font-weight: 700; }
.header-text p { margin: 0; color: #6c757d; font-size: 0.95rem; }
.filter-label { font-size: 0.85rem; color: #495057; font-weight: 600; display: block; }
.staff-select {
  width: 220px;
  max-width: 100%;
  margin: 6px 0 16px;
  padding: 12px 14px;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  font-size: 0.95rem;
  background: #fff;
  color: #212529 !important;
  color-scheme: light;
}
.stage {
  display: flex;
  align-items: stretch;
  gap: 12px;
  min-height: 240px;
  margin-bottom: 16px;
}
.time-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
}
.live-date {
  font-size: 0.75rem;
  color: #868e96;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
}
.live-time {
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #212529;
  line-height: 1.1;
  margin: 6px 0;
}
.elapsed { font-size: 0.95rem; color: #495057; margin-bottom: 8px; }
.status-note {
  font-size: 0.9rem;
  font-weight: 600;
  color: #868e96;
  max-width: 280px;
  line-height: 1.4;
}
.camera-panel {
  flex: 1;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.camera-title { font-size: 0.85rem; font-weight: 600; color: #495057; }
.camera-video {
  background: #111;
  border-radius: 12px;
  width: 100%;
  min-height: 180px;
  object-fit: cover;
}
.action-btn { width: 100%; margin-top: 8px; }
.btn-primary,
.btn-secondary {
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
.btn-secondary { background: #e9ecef; color: #495057; }
.btn-primary:disabled,
.btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
.error-state { color: #c92a2a; margin: 0 0 12px; }
@media (max-width: 700px) {
  .stage { flex-direction: column; }
  .live-time { font-size: 2.4rem; }
}
</style>
