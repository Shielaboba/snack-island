import { supabase } from '../supabase'
import type { AuditIngredientMapping } from '../models'

export const AUDIT_INGREDIENTS = [
  'mini patties',
  'mini buns',
  'big patties',
  'big buns',
  'cheese slice',
  'mango slice',
  'avocado slice',
  'royal',
  'coke',
  'sprite',
  'bottled water'
] as const

export type AuditIngredient = typeof AUDIT_INGREDIENTS[number]

export class AuditService {
  static async getMappings(): Promise<AuditIngredientMapping[]> {
    const { data, error } = await supabase
      .from('audit_ingredient_mappings')
      .select('*')

    if (error) {
      console.error('Error fetching audit mappings:', error)
      throw error
    }

    return (data || []) as AuditIngredientMapping[]
  }

  static async upsertMapping(menuItemId: string, ingredient: string, quantity: number): Promise<void> {
    const { error } = await supabase
      .from('audit_ingredient_mappings')
      .upsert(
        { menu_item_id: menuItemId, ingredient, quantity, updated_at: new Date().toISOString() },
        { onConflict: 'menu_item_id,ingredient' }
      )

    if (error) {
      console.error('Error upserting audit mapping:', error)
      throw error
    }
  }

  static async deleteMapping(id: string): Promise<void> {
    const { error } = await supabase
      .from('audit_ingredient_mappings')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting audit mapping:', error)
      throw error
    }
  }

  static async saveCashSnapshot(sessionId: string, rows: { name: string; startOfDay: number; endOfDay: number; amount: number | null }[]): Promise<void> {
    const records = rows.map(r => ({
      session_id: sessionId,
      name: r.name,
      start_of_day: r.startOfDay,
      end_of_day: r.endOfDay,
      expense_amount: r.name === 'Expenses' ? r.amount : null,
      saved_at: new Date().toISOString()
    }))
    const { error } = await supabase
      .from('audit_cash_snapshots')
      .upsert(records, { onConflict: 'session_id,name' })
    if (error) throw error
  }

  static async getCashSnapshot(sessionId: string): Promise<{ name: string; start_of_day: number; end_of_day: number; expense_amount: number | null }[]> {
    const { data, error } = await supabase
      .from('audit_cash_snapshots')
      .select('name, start_of_day, end_of_day, expense_amount')
      .eq('session_id', sessionId)
    if (error) throw error
    return data || []
  }

  static async saveIngredientSnapshot(sessionId: string, rows: { ingredient: string; addOns: number; yesterdayEod: number; todayEod: number }[]): Promise<void> {
    const records = rows.map(r => ({
      session_id: sessionId,
      ingredient: r.ingredient,
      add_ons: r.addOns,
      yesterday_eod: r.yesterdayEod,
      today_eod: r.todayEod,
      saved_at: new Date().toISOString()
    }))
    const { error } = await supabase
      .from('audit_ingredient_snapshots')
      .upsert(records, { onConflict: 'session_id,ingredient' })
    if (error) throw error
  }

  /** Cash and Expenses start-of-day counts for several sessions at once. */
  static async getStartCounts(sessionIds: string[]): Promise<{ session_id: string; name: string; start_of_day: number }[]> {
    if (sessionIds.length === 0) return []
    const { data, error } = await supabase
      .from('audit_cash_snapshots')
      .select('session_id, name, start_of_day')
      .in('session_id', sessionIds)
      .in('name', ['Cash', 'Expenses'])
    if (error) throw error
    return data || []
  }

  static async getIngredientSnapshot(sessionId: string): Promise<{ ingredient: string; add_ons: number; yesterday_eod: number; today_eod: number }[]> {
    const { data, error } = await supabase
      .from('audit_ingredient_snapshots')
      .select('ingredient, add_ons, yesterday_eod, today_eod')
      .eq('session_id', sessionId)
    if (error) throw error
    return data || []
  }
}
