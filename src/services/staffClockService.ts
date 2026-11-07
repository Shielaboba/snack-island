import { supabase } from '../supabase'
import {
  STAFF_CLOCK_BUCKET,
  STAFF_CLOCK_TABLE,
  type MissedPunchInput,
  type PunchStatus,
  type ShiftTimePatch,
  type StaffClockShift,
  type StaffName
} from '../models/StaffClock'
import { compressSelfie } from '../modules/staffClock/compressSelfie'
import {
  clockOutCoveringOvertime,
  findOverlappingShift,
  missedPunchOtError,
  openShiftFor,
  validateClockIn,
  validateClockOut,
  validateRecordOt,
  validateRequestOt,
  validateShiftTimes
} from '../modules/staffClock/staffClockUtils'

const SELECT_COLUMNS =
  'id, staff_name, clock_in_at, clock_out_at, clock_in_photo_path, clock_out_photo_path, clock_in_status, clock_out_status, clock_in_override, clock_out_override, created_by, updated_by, created_at, updated_at, ot_requested, ot_status, ot_requested_at'

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function asShift(row: StaffClockShift): StaffClockShift {
  return {
    ...row,
    ot_requested: Boolean(row.ot_requested),
    ot_status: row.ot_status ?? null,
    ot_requested_at: row.ot_requested_at ?? null
  }
}

async function uploadPhoto(path: string, blob: Blob) {
  const jpeg = await compressSelfie(blob)
  const { error } = await supabase.storage.from(STAFF_CLOCK_BUCKET).upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: true
  })
  throwIfError(error)
}

// Best effort: a leftover photo is not worth failing the punch over.
async function removePhotos(paths: string[]) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(STAFF_CLOCK_BUCKET).remove(paths)
  if (error) console.warn('Could not remove staff clock photos:', error.message)
}

function firstRow(data: unknown[] | null, message: string): StaffClockShift {
  const row = (data ?? [])[0] as StaffClockShift | undefined
  if (!row) throw new Error(message)
  return asShift(row)
}

function assertNoOverlap(
  staffName: StaffName,
  clockInAt: string,
  clockOutAt: string | null,
  existing: StaffClockShift[],
  ignoreId?: string
) {
  if (findOverlappingShift(staffName, clockInAt, clockOutAt, existing, ignoreId)) {
    throw new Error(`${staffName} already has a shift during that time.`)
  }
}

function photoPaths(shift: StaffClockShift): string[] {
  return [shift.clock_in_photo_path, shift.clock_out_photo_path].filter(
    (path): path is string => Boolean(path)
  )
}

export const staffClockService = {
  async list(): Promise<StaffClockShift[]> {
    const { data, error } = await supabase
      .from(STAFF_CLOCK_TABLE)
      .select(SELECT_COLUMNS)
      .order('clock_in_at', { ascending: false })
      .order('created_at', { ascending: false })
    throwIfError(error)
    return ((data ?? []) as StaffClockShift[]).map(asShift)
  },

  photoUrl(path: string | null): string {
    if (!path) return ''
    const { data } = supabase.storage.from(STAFF_CLOCK_BUCKET).getPublicUrl(path)
    return data.publicUrl
  },

  async clockIn(
    staffName: StaffName,
    photo: Blob,
    existing: StaffClockShift[],
    actor: string
  ): Promise<StaffClockShift> {
    const check = validateClockIn(staffName, existing)
    if (!check.ok) throw new Error(check.message)
    const id = crypto.randomUUID()
    const path = `${staffName}/${id}-in.jpg`
    const now = new Date().toISOString()
    await uploadPhoto(path, photo)
    const { data, error } = await supabase
      .from(STAFF_CLOCK_TABLE)
      .insert({
        id,
        staff_name: staffName,
        clock_in_at: now,
        clock_out_at: null,
        clock_in_photo_path: path,
        clock_out_photo_path: null,
        clock_in_status: 'pending',
        clock_out_status: null,
        clock_in_override: false,
        clock_out_override: false,
        created_by: actor,
        updated_by: actor
      })
      .select(SELECT_COLUMNS)
    try {
      throwIfError(error)
      return firstRow(data, 'Clock-in did not save.')
    } catch (err) {
      await removePhotos([path])
      throw err
    }
  },

  async clockOut(
    staffName: StaffName,
    photo: Blob,
    existing: StaffClockShift[],
    actor: string
  ): Promise<StaffClockShift> {
    const check = validateClockOut(staffName, existing)
    if (!check.ok) throw new Error(check.message)
    const open = openShiftFor(staffName, existing)
    if (!open) throw new Error(`${staffName} is not clocked in.`)
    const path = `${staffName}/${open.id}-out.jpg`
    const now = new Date().toISOString()
    await uploadPhoto(path, photo)
    const { data, error } = await supabase
      .from(STAFF_CLOCK_TABLE)
      .update({
        clock_out_at: now,
        clock_out_photo_path: path,
        clock_out_status: 'pending',
        clock_out_override: false,
        updated_by: actor,
        updated_at: now
      })
      .eq('id', open.id)
      .select(SELECT_COLUMNS)
    try {
      throwIfError(error)
      return firstRow(data, 'Clock-out did not save.')
    } catch (err) {
      // A retry after a declined clock-out reuses the same path; keep that photo.
      if (!open.clock_out_photo_path) await removePhotos([path])
      throw err
    }
  },

  async requestOt(
    staffName: StaffName,
    existing: StaffClockShift[],
    actor: string,
    now: Date = new Date()
  ): Promise<StaffClockShift> {
    const check = validateRequestOt(staffName, existing, now)
    if (!check.ok) throw new Error(check.message)
    const open = openShiftFor(staffName, existing)
    if (!open) throw new Error(`${staffName} is not clocked in.`)
    const at = now.toISOString()
    const { data, error } = await supabase
      .from(STAFF_CLOCK_TABLE)
      .update({
        ot_requested: true,
        ot_status: 'pending',
        ot_requested_at: at,
        updated_by: actor,
        updated_at: at
      })
      .eq('id', open.id)
      .select(SELECT_COLUMNS)
    throwIfError(error)
    return firstRow(data, 'OT request did not save.')
  },

  async recordOt(
    shift: StaffClockShift,
    actor: string,
    now: Date = new Date()
  ): Promise<StaffClockShift> {
    const check = validateRecordOt(shift, now)
    if (!check.ok) throw new Error(check.message)
    const at = now.toISOString()
    const { data, error } = await supabase
      .from(STAFF_CLOCK_TABLE)
      .update({
        ot_requested: true,
        ot_status: 'approved',
        ot_requested_at: at,
        updated_by: actor,
        updated_at: at
      })
      .eq('id', shift.id)
      .select(SELECT_COLUMNS)
    throwIfError(error)
    return firstRow(data, 'Could not record OT.')
  },

  async setOtStatus(id: string, status: PunchStatus, actor: string): Promise<StaffClockShift> {
    const { data, error } = await supabase
      .from(STAFF_CLOCK_TABLE)
      .update({
        ot_status: status,
        updated_by: actor,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(SELECT_COLUMNS)
    throwIfError(error)
    return firstRow(data, 'Could not update OT status.')
  },

  async setPunchStatus(
    id: string,
    side: 'in' | 'out',
    status: PunchStatus,
    actor: string
  ): Promise<StaffClockShift> {
    const patch =
      side === 'in'
        ? { clock_in_status: status, updated_by: actor, updated_at: new Date().toISOString() }
        : { clock_out_status: status, updated_by: actor, updated_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from(STAFF_CLOCK_TABLE)
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLUMNS)
    throwIfError(error)
    return firstRow(data, 'Could not update punch status.')
  },

  async updateTimes(
    shift: StaffClockShift,
    patch: ShiftTimePatch,
    existing: StaffClockShift[],
    actor: string
  ): Promise<StaffClockShift> {
    const check = validateShiftTimes(patch.clock_in_at, patch.clock_out_at)
    if (!check.ok) throw new Error(check.message)
    // A declined clock-in stays declined; fixing its time must not reopen it.
    const declined = shift.clock_in_status === 'declined'
    if (!declined) {
      assertNoOverlap(patch.staff_name, patch.clock_in_at, patch.clock_out_at, existing, shift.id)
    }
    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      staff_name: patch.staff_name,
      clock_in_at: patch.clock_in_at,
      clock_in_override: true,
      clock_in_status: declined ? 'declined' : 'approved',
      updated_by: actor,
      updated_at: now
    }
    const clearedOutPhoto = !patch.clock_out_at ? shift.clock_out_photo_path : null
    if (patch.clock_out_at) {
      payload.clock_out_at = patch.clock_out_at
      payload.clock_out_override = true
      payload.clock_out_status = 'approved'
    } else if (shift.clock_out_at) {
      payload.clock_out_at = null
      payload.clock_out_photo_path = null
      payload.clock_out_override = false
      payload.clock_out_status = null
    }
    const { data, error } = await supabase
      .from(STAFF_CLOCK_TABLE)
      .update(payload)
      .eq('id', shift.id)
      .select(SELECT_COLUMNS)
    throwIfError(error)
    const row = firstRow(data, 'Could not update times.')
    if (clearedOutPhoto) await removePhotos([clearedOutPhoto])
    return row
  },

  async createMissedPunch(
    input: MissedPunchInput,
    existing: StaffClockShift[],
    actor: string
  ): Promise<StaffClockShift> {
    const check = validateShiftTimes(input.clock_in_at, input.clock_out_at)
    if (!check.ok) throw new Error(check.message)
    const now = new Date().toISOString()
    const otHours = Number(input.ot_hours) || 0
    const otError = missedPunchOtError(input.clock_in_at, input.clock_out_at, otHours)
    if (otError) throw new Error(otError)
    const hasOt = otHours > 0
    const clockOutAt = clockOutCoveringOvertime(input.clock_in_at, input.clock_out_at, otHours)
    assertNoOverlap(input.staff_name, input.clock_in_at, clockOutAt, existing)
    const { data, error } = await supabase
      .from(STAFF_CLOCK_TABLE)
      .insert({
        staff_name: input.staff_name,
        clock_in_at: input.clock_in_at,
        clock_out_at: clockOutAt,
        clock_in_photo_path: null,
        clock_out_photo_path: null,
        clock_in_status: 'approved',
        clock_out_status: 'approved',
        clock_in_override: true,
        clock_out_override: true,
        ot_requested: hasOt,
        ot_status: hasOt ? 'approved' : null,
        ot_requested_at: hasOt ? now : null,
        created_by: actor,
        updated_by: actor,
        created_at: now,
        updated_at: now
      })
      .select(SELECT_COLUMNS)
    throwIfError(error)
    return firstRow(data, 'Missed punch did not save.')
  },

  async remove(shift: StaffClockShift): Promise<void> {
    const { error } = await supabase.from(STAFF_CLOCK_TABLE).delete().eq('id', shift.id)
    throwIfError(error)
    await removePhotos(photoPaths(shift))
  }
}
