import { supabase } from '../supabase'
import {
  LEDGER_TABLE,
  type CreateLedgerEntryInput,
  type LedgerEntry
} from '../models/Ledger'
import {
  cartRemittanceAmount,
  fundTransferProposedRows,
  validateEntry,
  validateRemoval
} from '../modules/ledger/ledgerUtils'

const SELECT_COLUMNS_BASE =
  'id, entry_date, type, wallet, amount, category, note, transfer_id, total_sales, petty_cash_returned, created_by, created_at, updated_at'
const SELECT_COLUMNS =
  'id, entry_date, type, wallet, amount, category, note, transfer_id, transfer_from, transfer_to, total_sales, petty_cash_returned, created_by, created_at, updated_at'

function isMissingTransferColumn(error: { message?: string } | null): boolean {
  const message = error?.message ?? ''
  return /transfer_from|transfer_to/i.test(message)
}

function assertOk(input: CreateLedgerEntryInput, existing: LedgerEntry[]) {
  const result = validateEntry(input, existing)
  if (!result.ok) {
    throw new Error(result.message)
  }
}

function toInsertRow(input: CreateLedgerEntryInput, transferId: string | null) {
  const isCart = input.type === 'pos_remittance'
  return {
    entry_date: input.entry_date,
    type: input.type,
    wallet: input.wallet,
    amount: isCart ? cartRemittanceAmount(input) : input.amount,
    category: input.type === 'expense' ? input.category ?? null : null,
    note: input.note ?? null,
    transfer_id: transferId,
    transfer_from: input.type === 'fund_transfer' ? input.transfer_from ?? null : null,
    transfer_to: input.type === 'fund_transfer' ? input.transfer_to ?? null : null,
    total_sales: isCart ? Number(input.total_sales) : null,
    petty_cash_returned: isCart ? Number(input.petty_cash_returned) : null,
    created_by: input.created_by ?? null
  }
}

export const ledgerService = {
  async list(): Promise<LedgerEntry[]> {
    const query = (columns: string) =>
      supabase
        .from(LEDGER_TABLE)
        .select(columns)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })

    const first = await query(SELECT_COLUMNS)
    const result =
      first.error && isMissingTransferColumn(first.error) ? await query(SELECT_COLUMNS_BASE) : first
    if (result.error) throw result.error
    return (result.data ?? []) as LedgerEntry[]
  },

  async create(input: CreateLedgerEntryInput, existing: LedgerEntry[]): Promise<LedgerEntry[]> {
    assertOk(input, existing)
    const rows =
      input.type === 'fund_expense'
        ? (() => {
            const transferId = crypto.randomUUID()
            return [
              toInsertRow({ ...input, wallet: 'auditor_cash' }, transferId),
              toInsertRow({ ...input, type: 'fund_expense', wallet: 'expense' }, transferId)
            ]
          })()
        : input.type === 'fund_transfer'
          ? (() => {
              const proposed = fundTransferProposedRows(input)
              const transferId = proposed.length === 2 ? crypto.randomUUID() : null
              return proposed.map((row) =>
                toInsertRow(
                  {
                    ...input,
                    wallet: row.wallet,
                    transfer_from: row.transfer_from,
                    transfer_to: row.transfer_to
                  },
                  transferId
                )
              )
            })()
          : [toInsertRow(input, null)]

    const { data, error } = await supabase.from(LEDGER_TABLE).insert(rows).select(SELECT_COLUMNS)
    if (error) throw error
    return (data ?? []) as LedgerEntry[]
  },

  async update(
    id: string,
    patch: Partial<CreateLedgerEntryInput>,
    existing: LedgerEntry[]
  ): Promise<LedgerEntry[]> {
    const current = existing.find((row) => row.id === id)
    if (!current) throw new Error('Ledger entry not found.')
    const merged: CreateLedgerEntryInput = {
      entry_date: patch.entry_date ?? current.entry_date,
      type: current.type,
      wallet: current.wallet,
      amount: patch.amount ?? current.amount,
      category: patch.category !== undefined ? patch.category : current.category,
      note: patch.note !== undefined ? patch.note : current.note,
      transfer_from: current.transfer_from ?? null,
      transfer_to: current.transfer_to ?? null,
      total_sales: patch.total_sales !== undefined ? patch.total_sales : current.total_sales,
      petty_cash_returned:
        patch.petty_cash_returned !== undefined ? patch.petty_cash_returned : current.petty_cash_returned,
      created_by: current.created_by
    }
    const others = existing.filter((row) =>
      current.transfer_id
        ? row.transfer_id !== current.transfer_id
        : row.id !== current.id
    )
    assertOk(merged, others)

    const isCart = merged.type === 'pos_remittance'
    const payload = {
      entry_date: merged.entry_date,
      amount: isCart ? cartRemittanceAmount(merged) : merged.amount,
      note: merged.note ?? null,
      category: merged.type === 'expense' ? merged.category ?? null : null,
      total_sales: isCart ? Number(merged.total_sales) : null,
      petty_cash_returned: isCart ? Number(merged.petty_cash_returned) : null,
      updated_at: new Date().toISOString()
    }

    const query = supabase.from(LEDGER_TABLE).update(payload)
    const { data, error } = current.transfer_id
      ? await query.eq('transfer_id', current.transfer_id).select(SELECT_COLUMNS)
      : await query.eq('id', id).select(SELECT_COLUMNS)
    if (error) throw error
    return (data ?? []) as LedgerEntry[]
  },

  async remove(id: string, existing: LedgerEntry[]): Promise<void> {
    const current = existing.find((row) => row.id === id)
    if (!current) throw new Error('Ledger entry not found.')
    const removedIds = existing
      .filter((row) =>
        current.transfer_id ? row.transfer_id === current.transfer_id : row.id === current.id
      )
      .map((row) => row.id)
    const check = validateRemoval(removedIds, existing)
    if (!check.ok) throw new Error(check.message)
    const query = supabase.from(LEDGER_TABLE).delete()
    const { error } = current.transfer_id
      ? await query.eq('transfer_id', current.transfer_id)
      : await query.eq('id', id)
    if (error) throw error
  }
}
