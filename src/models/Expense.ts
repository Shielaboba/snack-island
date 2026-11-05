export type ExpenseCategory = 
  | 'Supplies' 
  | 'Gas' 
  | 'Misc' 
  | 'Maintenance' 
  | 'Equipment' 
  | 'Ingredients' 
  | 'Utilities' 
  | 'Other'
  | 'Labor'
  | 'Machinery'
  | 'Government Fees';

// This matches the actual database schema from Supabase
export interface Expense {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  supplier_id?: string;
  paid_by?: string;
  reimburse_status?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExpenseInput {
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  supplier_id?: string;
  paid_by?: string;
  reimburse_status?: number;
}

export interface UpdateExpenseInput {
  expense_date?: string;
  category?: ExpenseCategory;
  description?: string;
  amount?: number;
  supplier_id?: string;
  paid_by?: string;
  reimburse_status?: number;
}


// Ordered by how often they're used, so the most common picks come first in the form.
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Ingredients',
  'Supplies',
  'Gas',
  'Labor',
  'Utilities',
  'Maintenance',
  'Equipment',
  'Machinery',
  'Government Fees',
  'Misc',
  'Other',
];

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Ingredients: '#c2410c',
  Supplies: '#1d4ed8',
  Gas: '#b45309',
  Labor: '#4338ca',
  Utilities: '#0f766e',
  Maintenance: '#15803d',
  Equipment: '#be185d',
  Machinery: '#78350f',
  'Government Fees': '#b91c1c',
  Misc: '#7e22ce',
  Other: '#475569',
};

export const REIMBURSE_STATUS = {
  NONE: 0,
  NEEDED: 1,
  DONE: 2,
} as const;
