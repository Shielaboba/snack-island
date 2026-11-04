import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'migrations/migration_add_ledger_entries.sql'),
  'utf8'
)

describe('ledger_entries migration is additive', () => {
  it('creates ledger_entries and does not alter existing business tables', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS ledger_entries/i)
    expect(sql).toMatch(/entry_date/)
    expect(sql).toMatch(/transfer_id/)
    expect(sql).not.toMatch(/ALTER TABLE\s+(orders|expenses|store_sessions|order_items|inventory)/i)
    expect(sql).not.toMatch(/DROP TABLE/i)
    expect(sql).not.toMatch(/REFERENCES\s+(orders|expenses|store_sessions)/i)
  })
})
