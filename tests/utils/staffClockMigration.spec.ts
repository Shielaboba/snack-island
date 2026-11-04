import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'migrations/migration_add_staff_clock_shifts.sql'),
  'utf8'
)

describe('staff_clock_shifts migration is additive', () => {
  it('creates staff_clock_shifts and does not alter existing business tables', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS staff_clock_shifts/i)
    expect(sql).toMatch(/staff_name/)
    expect(sql).toMatch(/clock_in_at/)
    expect(sql).toMatch(/clock_out_at/)
    expect(sql).toMatch(/clock_in_photo_path/)
    expect(sql).toMatch(/clock_out_photo_path/)
    expect(sql).toMatch(/clock_in_status/)
    expect(sql).toMatch(/clock_out_status/)
    expect(sql).not.toMatch(/ALTER TABLE\s+(orders|expenses|store_sessions|order_items|inventory|ledger_entries)/i)
    expect(sql).not.toMatch(/DROP TABLE/i)
    expect(sql).not.toMatch(/REFERENCES\s+(orders|expenses|store_sessions)/i)
  })

  it('limits names to Shai and Den and statuses to pending approved declined', () => {
    expect(sql).toMatch(/'Shai'/)
    expect(sql).toMatch(/'Den'/)
    expect(sql).toMatch(/'pending'/)
    expect(sql).toMatch(/'approved'/)
    expect(sql).toMatch(/'declined'/)
  })

  it('allows only one open shift per person', () => {
    expect(sql).toMatch(/UNIQUE INDEX/i)
    expect(sql).toMatch(/clock_out_at IS NULL/i)
    expect(sql).toMatch(/clock_in_status <> 'declined'/i)
  })

  it('adds a staff-clock-photos storage bucket', () => {
    expect(sql).toMatch(/staff-clock-photos/)
    expect(sql).toMatch(/storage\.buckets/i)
  })
})
