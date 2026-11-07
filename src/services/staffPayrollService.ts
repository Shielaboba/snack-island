import { supabase } from '../supabase'
import { authService } from './authService'
import { PAYROLL_STORAGE_KEYS, type PayrollRecordKey } from '../modules/staff/staffProfile'

export const STAFF_PAYROLL_TABLE = 'staff_payroll_records'

// Payroll setup lives in one shared table. Each browser keeps a copy in localStorage,
// so pages read through the same loaders they already use.
export const staffPayrollService = {
  // Copies the shared records into this browser. Keys with no shared row keep the local copy.
  async pull(storage: Storage = globalThis.localStorage): Promise<void> {
    const { data, error } = await supabase.from(STAFF_PAYROLL_TABLE).select('key, data')
    if (error) throw error
    for (const row of (data ?? []) as { key: string; data: unknown }[]) {
      const storageKey = PAYROLL_STORAGE_KEYS[row.key as PayrollRecordKey]
      if (storageKey) storage.setItem(storageKey, JSON.stringify(row.data ?? []))
    }
  },

  async push(key: PayrollRecordKey, rows: unknown[]): Promise<void> {
    const { error } = await supabase.from(STAFF_PAYROLL_TABLE).upsert({
      key,
      data: rows,
      updated_by: authService.getCurrentUser()?.username ?? null,
      updated_at: new Date().toISOString()
    })
    if (error) throw error
  }
}
