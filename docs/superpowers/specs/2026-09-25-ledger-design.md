# Ledger — Cash Control Book

Date: 2026-09-25  
Status: Draft for review  
App: Snack Island POS

## 1. Intent

The auditor (and admin) need a **manual cash book** in the sidebar. It answers:

- How much cash is the auditor holding right now?
- How much petty cash is staff holding?
- What was remitted from the POS, given to the POS, spent, and remitted to the owner?
- After the weekly owner remit, how much float is left to run next week?

This is **not** a general chart of accounts, **not** auto-posted from Orders, and **not** the existing Expenses page.

### What the user said

- Auditor records cash given to POS (float out) and cash remitted from POS (cash in).
- Remaining cash on hand is visible daily.
- Auditor issues petty cash to staff; staff petty-cash spends are line items on Ledger.
- Expenses also include labor/salary, utilities, and other costs — **not only** petty-cash spends.
- Auditor remits a **chosen amount** to the owner weekly. She does not remit everything, because they need float/petty cash to run the next week.
- Admin and Auditor can both view and edit.
- Ledger is **independent data**. The auditor types every amount herself. It must not read, join, or sync from other tables.

### Assumptions (locked)

- Remaining balances are **calculated** from entered lines. v1 has no separate physical-count or variance field.
- Issuing petty cash is a **transfer**: auditor cash down, petty cash up.
- Leftover **auditor cash + petty cash** after a partial owner remit is next week’s float.
- We do **not** track the owner’s wallet — only the outflow from auditor cash.
- The existing **Expenses** page and `expenses` table stay as they are. Ledger is a separate cash book.
- Currency is PHP. Calendar is **Asia/Manila**. A “week” is **Monday 00:00 through Sunday 23:59** Manila time.

### Data independence (locked)

`ledger_entries` is the only table Ledger uses.

- **No foreign keys** to `orders`, `order_items`, `expenses`, `store_sessions`, `sales_summary`, inventory, users, or any other existing table.
- **No reads** from those tables to prefill remittance, expenses, or cash on hand. POS totals are not copied in.
- **No writes** to those tables when a Ledger line is saved.
- **No RPCs** that join Ledger to other business tables.
- `created_by` is a plain text label of who typed the line (current username), not a foreign key.
- Migration is **add-only**: `CREATE TABLE ledger_entries` plus indexes, checks, and RLS on that table. No `ALTER` or `DROP` on existing tables. Existing rows stay untouched.

The auditor (or admin) enters starting cash, POS float, POS remittance, petty cash, expenses, and owner remit by hand. If the POS sold ₱4,850, she still types the remittance amount herself.

## 2. Out of scope (v1)

- Reading, joining, or syncing Ledger from orders, sales, store sessions, or the Expenses page
- Auto-posting from orders, sales, store sessions, or the Expenses page
- Chart of accounts, trial balance, P&L, balance sheet
- Owner wallet / owner balance
- Physical cash count vs calculated variance
- Staff access
- CSV export
- Multi-truck / multi-branch books

## 3. Access

| Role | `roleId` | Sidebar | `/ledger` |
|---|---|---|---|
| Admin | 0 | Sees Ledger | View and edit |
| Auditor | 2 | Sees Ledger | View and edit |
| Staff | 1 | Hidden | Redirect like other admin/auditor routes |

Route: `/ledger`  
`meta.requiresAuth: true`, `allowedRoles: [0, 2]`

## 4. Domain

### Wallets

1. **Auditor cash** — cash the auditor is holding.
2. **Petty cash** — cash staff is holding for small spends.

### Entry types

| `type` | Typical wallet | Effect |
|---|---|---|
| `opening_cash` | `auditor_cash` | Auditor cash **up** (starting cash on hand, or extra cash that is not a POS remit) |
| `pos_float` | `auditor_cash` | Auditor cash **down** (gave starting cash to POS) |
| `pos_remittance` | `auditor_cash` | Auditor cash **up** (POS remitted to auditor) |
| `owner_remittance` | `auditor_cash` | Auditor cash **down** by the amount she chooses (partial is valid) |
| `petty_issue` | both | Auditor cash **down**, petty cash **up** (same amount, shared `transfer_id`) |
| `expense` | `auditor_cash` **or** `petty_cash` | Chosen wallet **down**. Requires `category`. |

Without `opening_cash`, the first “cash to POS” would make auditor cash negative and be blocked. After week 1, leftover remaining is next week’s float — no new opening is required unless more cash is added from outside the POS.

Expense categories (v1): `Labor`, `Utilities`, `Supplies`, `Gas`, `Ingredients`, `Maintenance`, `Equipment`, `Misc`, `Other`.

Labor, utilities, and similar operating costs are normally paid from **auditor cash**. Small staff spends are paid from **petty cash**. The user picks the wallet; the app does not force a mapping.

### Signed effect

Amounts are stored as **positive numbers**. Sign comes from `type` + `wallet`:

```
auditor_cash delta:
  opening_cash       +amount
  pos_remittance     +amount
  pos_float          -amount
  owner_remittance   -amount
  petty_issue        -amount   (the auditor_cash row)
  expense            -amount   (if wallet is auditor_cash)

petty_cash delta:
  petty_issue        +amount   (the petty_cash row)
  expense            -amount   (if wallet is petty_cash)
```

### Balances

- **Wallet remaining** = sum of that wallet’s deltas over **all** entries (no starting-balance row in v1; first entry is the first movement).
- **Daily remaining** for wallet W on date D = sum of W’s deltas where `entry_date <= D`.
- **This week** (Manila Mon–Sun):
  - In from POS = sum of `pos_remittance` in the week
  - Expenses out = sum of `expense` in the week (both wallets)
  - Remitted to owner = sum of `owner_remittance` in the week
  - Remaining = current wallet remainings (auditor cash and petty cash shown separately)

Owner remit is **never** forced to equal remaining. Remitting ₱0 is not an entry; remitting less than remaining is the normal weekly case.

## 5. Data model

New table `ledger_entries` in Supabase. No change to `orders`, `expenses`, or `store_sessions`. No foreign keys. `ledgerService` queries only `ledger_entries`.

| Column | Type | Rules |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `entry_date` | date NOT NULL | Calendar date of the event (Manila) |
| `type` | text NOT NULL | One of the five types above |
| `wallet` | text NOT NULL | `auditor_cash` \| `petty_cash` |
| `amount` | numeric NOT NULL | `> 0` |
| `category` | text | Required when `type = expense`; NULL otherwise |
| `note` | text | Optional |
| `transfer_id` | uuid | Required for both rows of a `petty_issue`; NULL otherwise |
| `created_by` | text | Username or user id of the actor |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()` |

Constraints:

- `type` check: the six allowed values
- `wallet` check: the two allowed values
- `amount > 0`
- `expense` ⇒ `category` is not null
- non-expense ⇒ `category` is null
- `petty_issue` ⇒ `transfer_id` is not null
- `opening_cash`, `pos_float`, `pos_remittance`, `owner_remittance` ⇒ `wallet = auditor_cash`
- Index on `(entry_date DESC, created_at DESC)`
- Index on `transfer_id` where not null
- Index on `wallet`

RLS: enable RLS with open select/insert/update/delete policies, matching `store_sessions` in this project (app-level role gating is on the Vue route).

### Petty-issue write rule

Creating a petty-cash issue inserts **two rows** with the same `transfer_id`, `entry_date`, `amount`, `note`, and `type = petty_issue`:

1. `wallet = auditor_cash`
2. `wallet = petty_cash`

Editing amount/date/note of one side updates **both** rows. Deleting one side deletes **both**.

### Insufficient funds

Before insert (and before edit that increases an outflow or decreases an inflow):

- Compute the wallet remaining **after** the proposed change.
- If that remaining would be **< 0**, reject with a clear message (e.g. “Auditor cash remaining is ₱1,200. This would go negative.”).
- Owner remittance may be any amount **up to** current auditor cash remaining.

## 6. Application units

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/models/Ledger.ts` | Types: entry, wallets, types, categories, create/update inputs | — |
| `src/modules/ledger/ledgerUtils.ts` | Pure balance, daily remaining, week window, validation | models only |
| `src/services/ledgerService.ts` | CRUD against `ledger_entries`; create/update/delete transfer pairs | supabase + models |
| `src/components/Ledger.vue` | Page: balances, week strip, list, add/edit, remit-to-owner | service + utils |
| `src/components/LedgerEntryModal.vue` | Add/edit form (type, wallet, amount, category, date, note) | models |
| Router + `Sidebar.vue` | `/ledger` route and nav item | existing auth/roles |
| `migrations/migration_add_ledger_entries.sql` | Table, checks, indexes, RLS | — |

Balance math lives only in `ledgerUtils`. The page does not re-implement signs.

## 7. Data flow

1. User opens Ledger → `ledgerService.list()` → utils compute card balances, week strip, and daily remaining for the filtered list.
2. **Add entry** → modal validates locally (utils) → service insert → reload list.
3. **Remit to owner** → dedicated action pre-fills `type = owner_remittance`, `wallet = auditor_cash` → user enters amount (may be less than remaining) and optional note (e.g. week of 21 Sep) → same insert path.
4. **Issue petty cash** → service inserts the pair → both cards update.
5. Errors from validation or Supabase stay on the page; existing rows do not change.

## 8. UI

Follow the Expenses page patterns (header, filters, table, primary button, modal).

- **Header:** “Ledger” + short subtitle (“Auditor cash and petty cash”).
- **Cards:** Auditor cash remaining, Petty cash remaining.
- **Week strip:** In from POS, Expenses out, Remitted to owner, Remaining (both wallets).
- **Filters:** start date, end date, wallet, type. Default range: current Manila week.
- **Table:** date, type (human label), category, wallet, signed amount (in vs out), note, actions (edit/delete).
- **Actions:** Add entry, Remit to owner.
- Empty state when there are no lines: explain the first useful action (issue float to POS or record a remittance).

Human labels:

- `opening_cash` → “Starting cash”
- `pos_float` → “Cash to POS”
- `pos_remittance` → “Remittance from POS”
- `owner_remittance` → “Remit to owner”
- `petty_issue` → “Petty cash issued”
- `expense` → “Expense”

## 9. Error handling

| Case | Behavior |
|---|---|
| Amount missing, zero, or negative | Block submit; field error |
| Expense missing category | Block submit |
| Wrong wallet for POS/owner types | Do not offer those wallets in the form |
| Would make a wallet negative | Block submit; show remaining vs requested |
| Load failure | Error banner; empty list; retry by reload |
| Save/delete failure | Keep modal/list as-is; show error |
| Delete petty issue | Confirm once; delete both rows |

No silent fallback that drops a transfer pair to a single row.

## 10. Testing (TDD)

Tests are written **before** production code for each unit.

`tests/utils/ledgerUtils.spec.ts`

- Each type’s delta on the correct wallet
- Petty issue moves both wallets by the same amount
- Expense on auditor cash does not change petty cash
- Expense on petty cash does not change auditor cash
- Owner remit of less than remaining leaves leftover float
- Owner remit of more than remaining fails validation
- Daily remaining is the running balance through that date
- Week window is Manila Monday–Sunday

`tests/services/ledgerService.spec.ts`

- Insert/list/update/delete
- Petty issue writes two rows with one `transfer_id`
- Update/delete of a transfer touches both rows

`tests/components/Sidebar.spec.ts` (extend)

- Ledger link present for Admin and Auditor
- Ledger link absent for Staff

`tests/components/Ledger.spec.ts`

- Renders both remaining cards
- Remit-to-owner does not require remitting the full remaining
- Add expense with Labor + auditor cash updates auditor remaining only

## 11. Plan.md alignment

`Plan.md` now includes Ledger in the module list, a layman section (G), and the `ledger_entries` table. Ledger does **not** replace the Expenses module.

## 12. Success criteria

v1 is done when an Admin or Auditor can:

1. Open **Ledger** from the sidebar.
2. Record starting cash, cash to POS, remittance from POS, petty cash issued, and expenses (labor, utilities, and others) paid from either wallet.
3. Remit a **partial** amount to the owner and still see leftover auditor cash and petty cash for next week.
4. See calculated remaining per wallet and per day, plus this week’s in / expenses / owner remit.
