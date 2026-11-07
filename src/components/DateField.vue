<template>
  <div ref="root" class="date-field">
    <button
      ref="trigger"
      type="button"
      class="date-trigger"
      :data-testid="testId ? `${testId}-open` : undefined"
      :aria-expanded="open"
      :aria-label="ariaLabel || 'Choose a date'"
      @click="toggle"
    >
      {{ label }}
    </button>
    <input
      class="native-date"
      type="date"
      :value="model"
      :data-testid="testId"
      tabindex="-1"
      aria-hidden="true"
      @input="onNative"
    />
    <Teleport to="body">
      <div
        v-if="open"
        ref="pop"
        class="date-calendar"
        role="dialog"
        aria-label="Calendar"
        data-testid="date-calendar"
        :style="{ top: `${top}px`, left: `${left}px` }"
      >
        <div class="cal-head">
          <button type="button" class="nav" data-testid="date-prev" aria-label="Previous month" @click="shift(-1)">‹</button>
          <strong>{{ monthLabel }}</strong>
          <button type="button" class="nav" data-testid="date-next" aria-label="Next month" @click="shift(1)">›</button>
        </div>
        <div class="cal-grid">
          <span v-for="name in WEEKDAYS" :key="name" class="dow">{{ name }}</span>
          <span v-for="n in pad" :key="`pad-${n}`"></span>
          <button
            v-for="day in days"
            :key="day.ymd"
            type="button"
            class="day"
            :class="{ selected: day.ymd === model, today: day.ymd === today }"
            :data-date="day.ymd"
            @click="pick(day.ymd)"
          >
            {{ day.day }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { manilaToday } from '../modules/staffClock/staffClockUtils'

const model = defineModel<string>({ required: true })
const props = defineProps<{ testId?: string; ariaLabel?: string }>()

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const pop = ref<HTMLElement | null>(null)
const open = ref(false)
const cursor = ref(new Date())
const top = ref(0)
const left = ref(0)
const today = manilaToday()

const testId = computed(() => props.testId)
const ariaLabel = computed(() => props.ariaLabel)

const label = computed(() => formatYmd(model.value))
const monthLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(cursor.value)
)
const pad = computed(() => new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1).getDay())
const days = computed(() => {
  const year = cursor.value.getFullYear()
  const month = cursor.value.getMonth()
  const count = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1
    return { day, ymd: toYmd(year, month, day) }
  })
})

function toYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatYmd(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) return 'Select a date'
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function syncCursor() {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(model.value)
  if (!match) {
    const todayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today)
    cursor.value = todayMatch
      ? new Date(Number(todayMatch[1]), Number(todayMatch[2]) - 1, 1)
      : new Date()
    return
  }
  cursor.value = new Date(Number(match[1]), Number(match[2]) - 1, 1)
}

function place() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const width = pop.value?.offsetWidth || 360
  const height = pop.value?.offsetHeight || 340
  const margin = 8
  const gap = 6
  let nextLeft = rect.left
  const max = window.innerWidth - width - margin
  if (max > margin && nextLeft > max) nextLeft = max
  if (nextLeft < margin) nextLeft = margin
  const below = rect.bottom + gap
  const above = rect.top - gap - height
  const fitsBelow = below + height <= window.innerHeight - margin
  top.value = fitsBelow ? below : Math.max(margin, above)
  left.value = nextLeft
}

function toggle() {
  open.value = !open.value
  if (!open.value) return
  syncCursor()
  nextTick(place)
}

function shift(delta: number) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
}

function pick(ymd: string) {
  model.value = ymd
  open.value = false
}

function onNative(event: Event) {
  model.value = (event.target as HTMLInputElement).value
}

function onPointer(event: Event) {
  const target = event.target as Node | null
  if (!target) return
  if (root.value?.contains(target) || pop.value?.contains(target)) return
  open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onPointer, true)
  else document.removeEventListener('pointerdown', onPointer, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointer, true)
})
</script>

<style scoped>
.date-field { position: relative; display: inline-block; max-width: 100%; }
.date-trigger {
  height: 36px;
  min-width: 168px;
  max-width: 100%;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #1f2937;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.native-date {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
.date-calendar {
  position: fixed;
  z-index: 2200;
  box-sizing: border-box;
  width: 360px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(17, 24, 39, 0.16);
  color: #1f2937;
}
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.cal-head strong { font-size: 15px; }
.nav {
  box-sizing: border-box;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #1f2937;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.dow { text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; padding: 4px 0; }
.day {
  box-sizing: border-box;
  width: 100%;
  aspect-ratio: 1;
  height: auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #1f2937;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.day:hover { background: #f3f4f6; }
.day.selected { background: #5a67d8; color: #fff; }
.day.today:not(.selected) { box-shadow: inset 0 0 0 1px #5a67d8; }
</style>
