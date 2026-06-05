# Sungrow Daybook MIS

**Live app:** https://dhruvdua88.github.io/sungrow-developers-daybook-review-2026/
**Source:** https://github.com/dhruvdua88/sungrow-developers-daybook-review-2026

A browser-based React app that turns the monthly **Sungrow / SDIPL** SAP daybook
into a management view (MIS). Upload one Excel daybook and the app builds — entirely
in your browser, **nothing leaves your machine** — a P&L, an expense-head → party
breakdown, and a party (AP) bird's-eye view, then lets you download an Excel workbook.

---

## What it produces

1. **Overview** — KPI strip: Revenue, Gross margin, Profit/Loss before tax, Operating
   expense, Expense-thru-AP, TDS deducted (effective %), RCM.
2. **P&L (from the daybook)** — built straight from the ledger codes:
   - GL **6xxx** → revenue / cost of sales / finance
   - GL **7xxx** → operating expense
   Shown as a statement with margin bars and the top expense heads. No financials
   file needed — it comes out of the daybook itself.
3. **Expense Head → Party** — one row per expense ledger with **Total Amount, TDS,
   effective TDS %, RCM, # parties**. Click any head to expand the **party-wise split**
   (party, amount, TDS, %, RCM). Effective-% instantly flags a short / non-deduction
   (rent 10% ✓, a contractor head at 0% ⚠).
4. **Party / AP — bird's-eye** — every accounts-payable party: **Total Amount, TDS,
   RCM, AP invoiced, AP paid, Outstanding**. Click a party to expand **where the money
   is going** (the expense heads it hit).
5. **Transactions** — every normalized line with `G/L Account`, `G/L Account Text
   (Ledger)`, `Accounting pro. (Party)`, `Reference`, line type and section — sortable,
   text-filterable, line-type chips.
6. **Download** — an Excel workbook (Summary, P&L, Expense×Party, Party×Head,
   Transactions) and a normalized CSV.

### How the numbers are built (SAP daybook)

| Field | SAP column |
|---|---|
| Ledger code | `G/L Account` |
| Ledger name | `G/L Account Text` |
| Party | `Accounting pro.` |
| Reference | `reference` |
| Amounts | `DR` / `CR` |

- **TDS** = credit on the SAP TDS ledgers (`TDS - 194C/194J/194I/194Q/192B`), attributed
  across each voucher's expense lines pro-rata to amount.
- **RCM** = credit on the reverse-charge GST ledgers (`… REVE CH`, GL `2221013010/30/40`).
- **AP** = the accounts-payable lines (`2202* / 2241*`); invoiced (CR) vs paid (DR).

The TDS / RCM / P&L logic is generic — it works on any daybook that exposes a ledger
code/name, a party column and DR/CR. SAP column names are auto-detected by keyword.

---

## Run it locally

Requires Node 18+.

```bash
npm install      # install dependencies
npm run dev      # dev server → http://localhost:5173/sungrow-developers-daybook-review-2026/
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build
```

### Monthly use

1. Open the app (local or the GitHub Pages URL).
2. Set the **Month** in the header.
3. **Upload the daybook** (.xlsx).
4. Read the **Overview / P&L**, drill the **Expense → Party** and **Party / AP** views,
   and **Download** the workbook.

---

## GitHub Pages deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes to
Pages on every push to `main`.

- **Settings → Pages → Source = GitHub Actions** (one-time).
- `VITE_BASE` must equal `/<repo-name>/` — set in `vite.config.ts` and the workflow env
  (`/sungrow-developers-daybook-review-2026/`).
- The lockfile is intentionally **not** committed and CI uses `npm install` (the SheetJS
  fork `@e965/xlsx` + npm's cross-version optional-dep handling break `npm ci`).

---

## Architecture

```
src/
  App.tsx                  upload → MIS sections → download
  types.ts                 shared types
  utils/
    excelParser.ts         File → sheets (@e965/xlsx, robust to odd headers)
    structureDetector.ts   keyword column detection (GL code / text / party / ref / DR / CR)
    normalizer.ts          rows → Txn[], line-type + TDS-section classification
    mis.ts                 P&L + expense→party + party→heads engine (TDS / RCM / AP)
    review.ts              wires parsing + MIS into one result
    reportExcel.ts         MIS Excel workbook + CSV
  components/
    MisKpis, PnlHero, ExpenseMis (Expense→Party + Party/AP),
    GroupTable (expandable), SortableTable, TransactionsExplorer,
    FileUpload, DownloadPanel, ui, icons
```

Robust by design: skips blank rows, guesses the header row, tolerates merged cells,
handles a missing amount column (`debit − credit`), and warns instead of crashing on a
corrupt / truncated file.

Tech: React 18 · Vite 5 · TypeScript · Tailwind CSS · `@e965/xlsx` · file-saver.
