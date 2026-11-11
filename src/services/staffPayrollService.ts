import { supabase } from '../supabase'
import { authService } from './authService'
import { PAYROLL_STORAGE_KEYS, type PayrollRecordKey } from '../modules/staff/staffProfile'

export const STAFF_PAYROLL_TABLE = 'staff_payroll_records'

// Payroll setup lives in one shared table. This browser only keeps a copy of that table.
export const staffPayrollService = {
  // Replaces this browser's lists with the database. A list that is not in the table is empty.
  async pull(storage: Storage = globalThis.localStorage): Promise<void> {
    const { data, error } = await supabase.from(STAFF_PAYROLL_TABLE).select('key, data')
    if (error) throw error
    const rows = (data ?? []) as { key: string; data: unknown }[]
    const byKey = new Map(rows.map((row) => [row.key, row.data]))
    for (const key of Object.keys(PAYROLL_STORAGE_KEYS) as PayrollRecordKey[]) {
      const remote = byKey.get(key)
      storage.setItem(PAYROLL_STORAGE_KEYS[key], JSON.stringify(Array.isArray(remote) ? remote : []))
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
