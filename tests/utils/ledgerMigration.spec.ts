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

  it('allows expense and GCash wallets instead of a standing petty-cash float', () => {
    expect(sql).toMatch(/'auditor_cash'/)
    expect(sql).toMatch(/'expense'/)
    expect(sql).toMatch(/'gcash'/)
    expect(sql).toMatch(/'fund_expense'/)
    expect(sql).toMatch(/'gcash_remittance'/)
    expect(sql).not.toMatch(/petty_cash/)
    expect(sql).not.toMatch(/petty_issue/)
  })
})

const walletSql = readFileSync(
  resolve(process.cwd(), 'migrations/migration_ledger_expense_gcash_wallets.sql'),
  'utf8'
)

const cartSql = readFileSync(
  resolve(process.cwd(), 'migrations/migration_ledger_cart_cash_remittance.sql'),
  'utf8'
)

describe('ledger cart cash remittance migration', () => {
  it('adds total_sales and petty_cash_returned without touching other tables', () => {
    expect(cartSql).toMatch(/total_sales/)
    expect(cartSql).toMatch(/petty_cash_returned/)
    expect(cartSql).toMatch(/ALTER TABLE ledger_entries/)
    expect(cartSql).not.toMatch(/ALTER TABLE\s+(orders|expenses|store_sessions|order_items|inventory)/i)
    expect(cartSql).not.toMatch(/DROP TABLE/i)
  })
})

describe('ledger wallet follow-up migration', () => {
  it('remaps petty cash to expense wallet without touching other tables', () => {
    expect(walletSql).toMatch(/fund_expense/)
    expect(walletSql).toMatch(/gcash/)
    expect(walletSql).toMatch(/UPDATE ledger_entries SET wallet = 'expense' WHERE wallet = 'petty_cash'/)
    expect(walletSql).not.toMatch(/ALTER TABLE\s+(orders|expenses|store_sessions|order_items|inventory)/i)
    expect(walletSql).not.toMatch(/DROP TABLE/i)
  })
})
