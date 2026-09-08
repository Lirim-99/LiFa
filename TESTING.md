# How to test LiFa (demo)

**App:** https://lifa-app.vercel.app  
**Password for all demo users:** `Sup3rSecret!`

> First request after idle can take 30–60s (Render free tier cold start).

---

## Demo users

| Role | Email | What they can do |
|------|--------|------------------|
| Owner | `owner@lifa.demo` | Everything |
| Admin | `lirim.hasani@lifa.demo` | Almost everything (company admin) |
| Accountant | `accountant@lifa.demo` | Accounting, sales, purchases, inventory, POS, payroll |
| Accountant | `faton.qerimi@lifa.demo` | Same as accountant |
| Viewer | `viewer@lifa.demo` | Read-only |

---

## After re-seeding, you should see

- Company: **Acme Trading SHPK**
- Contacts, invoices, bills, payments, journal entries
- Catalog: notebooks, pens, water, coffee + services
- Inventory: **Main warehouse** with opening stock
- POS: register **Arka 1** + yesterday’s closed session with 2 sample sales

---

## Suggested test path

### 1. Login
1. Open https://lifa-app.vercel.app/login  
2. Sign in as `owner@lifa.demo` / `Sup3rSecret!`  
3. Confirm dashboard loads (AR, recent invoices)

### 2. Sales
1. **Invoices** — open draft / issued / paid / void examples  
2. **Payments** — see partial + full payments  
3. **Credit notes** — create a sales return from an issued invoice (optional)

### 3. Purchases
1. **Bills** — open paid / overdue / draft vendor bills  
2. Record a payment on the open bill (optional)

### 4. Inventory
1. Open **Inventory**  
2. **Stock levels** — products should show on-hand qty  
3. **Warehouses** — “Main warehouse / Depo kryesore”  
4. **Movements** — opening receipts + POS demo issues

### 5. POS (main check)
1. Open **POS** (sidebar)  
2. Select register **Arka 1**  
3. Opening balance e.g. `50` → **Start Session**  
4. Search `water` or `coffee` or `NB-A5`  
5. Add items → **Charge** → pay with cash/card  
6. Confirm sale appears under recent sales  
7. Check **Inventory** stock dropped  
8. Check **Invoices** / **Fiscal coupons** for the auto POS invoice (if fiscalization is on)  
9. **End Session** → enter closing cash count

### 6. Quotes & orders
1. **Quotes** — list (empty until you create one)  
2. Create quote → Send → Accept → Convert to order (optional)

### 7. Payroll / Fixed assets / FX
1. **Payroll** — add employee or run a payroll period  
2. **Fixed assets** — add an asset, run depreciation  
3. **Exchange rates** — add USD/ALL rate

### 8. Reports
1. Trial balance, P&L, Balance sheet, AR aging, AP aging

### 9. Roles
1. Log out → sign in as `viewer@lifa.demo`  
2. Confirm write actions are blocked / limited

---

## Re-seed demo data (wipes Acme Trading only)

### Local
```bash
pnpm --filter backend db:seed:demo
```

### Production (Render)
1. Render dashboard → **lifa-backend** → **Shell**  
2. Run:
   ```bash
   pnpm --filter backend db:seed:demo
   ```

⚠️ This **deletes and recreates** the demo company + `@lifa.demo` users. Do not run on a DB with real customer data.
