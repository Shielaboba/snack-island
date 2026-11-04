import { supabase } from '../supabase'
import {
  LEDGER_TABLE,
  type CreateLedgerEntryInput,
  type LedgerEntry
} from '../models/Ledger'
import { validateEntry, validateRemoval } from '../modules/ledger/ledgerUtils'

const SELECT_COLUMNS =
  'id, entry_date, type, wallet, amount, category, note, transfer_id, created_by, created_at, updated_at'

function assertOk(input: CreateLedgerEntryInput, existing: LedgerEntry[]) {
  const result = validateEntry(input, existing)
  if (!result.ok) {
    throw new Error(result.message)
  }
}

function toInsertRow(input: CreateLedgerEntryInput, transferId: string | null) {
  return {
    entry_date: input.entry_date,
    type: input.type,
    wallet: input.wallet,
    amount: input.amount,
    category: input.type === 'expense' ? input.category ?? null : null,
    note: input.note ?? null,
    transfer_id: transferId,
    created_by: input.created_by ?? null
  }
}

export const ledgerService = {
  async list(): Promise<LedgerEntry[]> {
    const { data, error } = await supabase
      .from(LEDGER_TABLE)
      .select(SELECT_COLUMNS)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as LedgerEntry[]
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
      created_by: current.created_by
    }
    const others = existing.filter((row) =>
      current.transfer_id
        ? row.transfer_id !== current.transfer_id
        : row.id !== current.id
    )
    assertOk(merged, others)

    const payload = {
      entry_date: merged.entry_date,
      amount: merged.amount,
      note: merged.note ?? null,
      category: merged.type === 'expense' ? merged.category ?? null : null,
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
