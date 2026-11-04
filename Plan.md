# 🏝️ Snack Island POS — Project Plan

A lightweight Point of Sale (POS) system built for **Snack Island**, our food truck business.  
It manages **orders, sales, expenses, and inventory**, including hard-to-measure liquids like oil and iced tea concentrate.  
The system is powered by **Vue** (frontend) and **Supabase** (backend + database).

---

## 🍔 1. Project Overview

**Goal:**  
Create a POS that works locally (on tablet or laptop), tracks daily sales and inventory, and generates **CSV sales reports** with a visual **dashboard** — all using Supabase for data management.

**Main Features:**
- Order and Combo Management  
- Real-time Sales Tracking  
- Inventory System (solid & liquid)  
- Expense Logging  
- CSV Export for Daily Reports  
- Interactive Dashboard

---

## ⚙️ 2. Tech Stack

| Component | Tool |
|------------|------|
| **Frontend** | Vue 3 + Pinia + TailwindCSS |
| **Database & Auth** | Supabase (PostgreSQL + Row Level Security) |
| **Charts** | Chart.js or ApexCharts |
| **Data Export** | CSV (via JavaScript Blob API) |
| **Deployment** | Vercel or Local Web App (works offline via cache) |

---

## 🧩 3. System Modules

| Module | Purpose |
|--------|----------|
| **Orders** | Handles customer orders and payments |
| **Sales** | Tracks daily/weekly revenue and profit |
| **Inventory** | Manages solid and liquid ingredients |
| **Expenses** | Records operational costs |
| **Ledger** | Auditor cash book: POS float, EOD petty cash remittance, expense wallet, GCash, weekly owner remit |
| **Reports** | Exports daily CSV summaries |
| **Dashboard** | Visual insights and real-time analytics |

---

## 🧠 4. How the System Works (Layman’s Logic)

### 🧾 A. Orders
1. Staff selects items or combos (like *Fries + Iced Tea*).  
2. POS records the order, calculates total, and saves it to Supabase.  
3. When order is marked as “Completed,” the system automatically updates inventory based on each item’s recipe.

**Example:**
> Cheese Fries → deduct 1 potato (solid), 0.05L oil (liquid), 0.03L cheese sauce (liquid).

---

### 📦 B. Inventory
Tracks **everything used in production**, both solid and liquid.

#### 🔹 For Solid Items (e.g., cups, potatoes)
- Each order deducts a fixed amount per sale (based on recipe).
- System triggers a “Low Stock” alert when below the reorder level.

#### 🔹 For Liquids (e.g., oil, sauces, tea concentrate)
Liquids are tricky to measure, so we use **estimated usage** or **batch logic**.

1. **Estimated Usage per Order**
   - Every menu item has an average consumption (like 0.05L oil per fries).
   - The system auto-deducts this estimated value per sale.

2. **Batch Tracking**
   - You define how much liquid is used for a “batch.”  
   - Example: 5L of fryer oil = 100 fries.  
   - Each fries order adds +1 serving to that batch count.  
   - When batch reaches 100 servings → system alerts: *“Replace oil batch.”*

3. **Manual Adjustments**
   - At closing, staff checks actual oil left and updates the count.
   - System adjusts automatically to match the real measurement.

---

### 💰 C. Sales
- Every completed order automatically adds to daily sales in Supabase.  
- Dashboard totals up all orders by date.  
- At the end of the day, a CSV file is generated with:
  - Total sales
  - Number of orders
  - Total expenses
  - Net profit
  - Top-selling item

---

### 🧾 D. Expenses
- Logged manually by staff (e.g., ₱200 for oil, ₱150 for gas).
- Stored in Supabase under `expenses`.
- Automatically included in daily profit calculations.

---

### 📊 E. Reports
At day’s end, the system exports a **CSV file** like this:

| Date | Orders | Gross Sales | Expenses | Net Profit | Top Item |
|------|---------|--------------|-----------|-------------|-----------|
| 2025-10-08 | 52 | ₱4,850 | ₱1,100 | ₱3,750 | Cheese Fries |

The CSV is created using Vue’s front-end export function and can be downloaded or sent via email.

---

### 📈 F. Dashboard
Built using **Chart.js or ApexCharts**, showing:

- Total Sales (Today, Week, Month)
- Top 5 Best-Selling Items
- Expense Breakdown
- Profit Trends
- Stock Levels (color-coded)
- Liquid Efficiency (Expected vs. Actual Use)

---

### 📒 G. Ledger

A **manual cash book** for Admin and Auditor (not staff). It is **independent data**: the auditor types every amount. It does not read or write `orders`, `expenses`, or `store_sessions`. The Expenses page stays as it is.

Three wallets:

1. **Auditor cash** — cash the auditor is holding.
2. **Expense wallet** — cash set aside for operating spends (funded from auditor cash).
3. **GCash** — digital wallet balance from GCash remittances.

Typical flow:

1. Auditor records starting cash on hand (auditor cash up), then gives cash to the POS (auditor cash down).
2. Every EOD the auditor records **Cart Cash Remittance** (`pos_remittance`): Total Sales and Petty Cash Returned. Auditor cash goes up by the sum. There is no standing petty-cash float.
3. Auditor funds the expense wallet from auditor cash when needed (auditor cash down, expense wallet up).
4. GCash remittances go into the GCash wallet. Expenses can be paid from **auditor cash**, **expense wallet**, or **GCash**.
5. Weekly, the auditor remits a **chosen amount** to the owner — not the full remaining — so leftover auditor cash, expense wallet, and GCash can run the next week.

Remaining balances are calculated from the lines entered. See `docs/superpowers/specs/2026-09-25-ledger-design.md`.

**Weekly Summary ledger check.** The Weekly Summary (Fri–Thu) reads the ledger to check it. The ledger itself still reads nothing else. Any difference, even ₱1, is flagged:

- Per day: POS remittance vs expected (cash sales − that day's Expenses-page expenses), and ledger expenses (both wallets) vs Expenses-page expenses.
- Per category for the week: Expenses page vs ledger.
- Per pay date: salaries recorded vs ledger `Labor` expenses.
- Owner remit is info only: expected (week cash sales − ledger expenses), remitted, and what was kept for next week.

---

## 💾 5. Database Design (Supabase)

### **Tables**

#### `inventory`
| Column | Type | Description |
|---------|------|-------------|
| id | uuid | Primary key |
| item_name | text | Name (e.g. “Cooking Oil”) |
| unit | text | “pcs”, “kg”, “L” |
| current_stock | float | Current stock level |
| cost_per_unit | float | For cost tracking |
| reorder_level | float | Alert threshold |
| type | text | “solid” or “liquid” |

---

#### `menu_items`
| Column | Type | Description |
|---------|------|-------------|
| id | uuid | Menu ID |
| name | text | “Cheese Fries”, “Combo A”, etc. |
| price | float | Selling price |
| category | text | “Snack”, “Drink”, “Combo” |

---

#### `recipe_map`
Links menu items to ingredients.

| Column | Type | Description |
|---------|------|-------------|
| id | uuid | Primary key |
| menu_item_id | uuid | References `menu_items.id` |
| ingredient_id | uuid | References `inventory.id` |
| usage_per_order | float | Estimated consumption |
| usage_type | text | “per_order” or “per_batch” |

---

#### `liquid_batches`
For large liquid containers (like oil batches).

| Column | Type | Description |
|---------|------|-------------|
| id | uuid | Batch ID |
| ingredient_id | uuid | References `inventory.id` |
| batch_volume | float | Total volume (e.g., 5L) |
| expected_servings | int | Estimated output (e.g., 100 orders) |
| servings_used | int | Count of how many orders used |
| start_date | date | Batch start |
| status | text | “active” or “replaced” |

---

#### `orders`
| Column | Type | Description |
|---------|------|-------------|
| id | uuid | Order ID |
| datetime | timestamptz | Order time |
| total_amount | float | Total price |
| payment_method | text | “Cash”, “GCash”, etc. |
| status | text | “Pending”, “Completed”, “Cancelled” |

---

#### `order_items`
| Column | Type | Description |
|---------|------|-------------|
| order_id | uuid | References `orders.id` |
| item_id | uuid | References `menu_items.id` |
| quantity | int | Quantity ordered |
| subtotal | float | Item total price |

---

#### `expenses`
| Column | Type | Description |
|---------|------|-------------|
| id | uuid | Expense ID |
| date | date | Expense date |
| category | text | “Supplies”, “Gas”, “Misc” |
| description | text | Details |
| amount | float | Cost |

---

#### `sales_summary`
| Column | Type | Description |
|---------|------|-------------|
| date | date | Day of record |
| total_sales | float | Daily gross |
| total_orders | int | Number of orders |
| total_expenses | float | Total expenses |
| total_profit | float | Gross - Expenses |

---

#### `ledger_entries`
Manual cash-control lines for the Ledger page. Not tied to `orders` or `expenses`.

| Column | Type | Description |
|---------|------|-------------|
| id | uuid | Primary key |
| entry_date | date | Calendar date of the event (Asia/Manila) |
| type | text | `opening_cash`, `pos_float`, `pos_remittance`, `gcash_remittance`, `owner_remittance`, `fund_expense`, `expense` |
| wallet | text | `auditor_cash`, `expense`, or `gcash` |
| amount | numeric | Always positive; sign comes from type + wallet. For cart remittance this is Total Sales + Petty Cash Returned |
| total_sales | numeric | Required for `pos_remittance`; NULL otherwise |
| petty_cash_returned | numeric | Required for `pos_remittance`; NULL otherwise |
| category | text | Required for expenses (Labor, Utilities, …); NULL otherwise |
| note | text | Optional |
| transfer_id | uuid | Links the two rows of a fund-expense transfer |
| created_by | text | Who entered the line |
| created_at | timestamptz | Created |
| updated_at | timestamptz | Updated |

---

#### `store_sessions`
Manual Start Day / End of Day for the POS. Only one session is open at a time. Orders and sales use the active session window instead of calendar date (prevents midnight resets when the store stays open past 12am).

| Column | Type | Description |
|---------|------|-------------|
| id | uuid | Primary key |
| opened_at | timestamptz | When the session started (Start Day) |
| closed_at | timestamptz | When the session ended (End of Day). NULL = still open |
| opened_by | text | Optional: who started the session |
| closed_by | text | Optional: who closed the session |

---

## 🔄 6. Logic Flow Summary (Plain English)

### When an Order is Placed:
1. Staff selects menu items → POS saves order to Supabase.  
2. For each item:
   - System looks up its recipe in `recipe_map`.  
   - For solids → deduct fixed quantity from stock.  
   - For liquids → either:
     - Deduct estimated usage directly, or  
     - Add 1 serving to active batch count (if using batch logic).  
3. When batch limit is reached → system alerts to replace liquid.

---

### At Closing Time:
1. Staff checks actual stock (especially liquids).  
2. Enter adjustments into POS (e.g., “8.5L oil left”).  
3. POS corrects inventory accordingly.  
4. Log all expenses for the day.  
5. Click “Export CSV” → downloads daily report automatically.  
6. Dashboard updates all charts using Supabase data.

---

## 📊 7. Dashboard Metrics

- **Total Sales:** Line chart showing growth by day.  
- **Profit vs. Expense:** Pie chart.  
- **Top Items:** Bar chart by sales volume.  
- **Stock Levels:** Low-stock items highlighted in red.  
- **Liquid Efficiency:** Expected vs. actual usage per batch.

---

## 🚀 8. Future Add-ons

- Multi-truck Sync (multi-branch Supabase project)
- QR Code Ordering
- Supplier Purchase Tracking
- Customer Loyalty Points
- AI Sales Prediction (“Fries sell 20% more during weekends”)

---

## ✅ 9. Summary

Snack Island POS is designed to be:
- **Simple** — for daily use by food truck staff.  
- **Accurate** — auto-tracks both solids and liquids.  
- **Insightful** — provides real-time data via dashboard.  
- **Cloud-Ready** — powered entirely by Supabase and Vue.  

It keeps the business organized, tracks every peso and potato, and ensures we never run out of oil again.

---
