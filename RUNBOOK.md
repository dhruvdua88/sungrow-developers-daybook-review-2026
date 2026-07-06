# Monthly review runbook — SDIPL

Repeatable process for the monthly Sungrow Developers (SDIPL) daybook review.
Everything runs in the browser; **no data leaves the machine**.

## Inputs (from Lohith's monthly mail "Financial report and daybook")

| File | Example | What it is |
|---|---|---|
| Daybook | `Daybook 2140 Jun-26 SDIPL.XLSX` | SAP GL line dump — `Sheet1`, one row per posting line (~130k rows). Columns: Posting Date, Document Type, DocumentNo, Item, Text, **G/L Account**, **G/L Account Text**, **Accounting pro.** (party), Amount LC, **DR**, **CR**, reference. |
| Financials | `Financials SDIPL June-26.xlsx` | 28-sheet CN/EN reporting pack. The app reads sheet **`2.利润表Profit & Loss`** — a 12-month (Jan…Dec) layout plus audited/RMB summary columns. |

> The daybook `Amount LC` column carries the currency code (`INR`), not a number —
> the app ignores it and derives amounts from **DR − CR**. `ΣDR = ΣCR` must hold.

## Step 1 — validate headless (before trusting the browser)

```bash
npm install
npm run validate -- "path/to/Daybook … .XLSX" "path/to/Financials … .xlsx"
```

This runs the exact browser pipeline (parse → detect → normalize → runReview →
runFinancials) and asserts: transactions normalized, `ΣDR = ΣCR`, DR/CR detected,
P&L sheet found, and the default financials period is a **single month** (not a
YTD/audited total). A pass here means the browser will not crash.

## Step 2 — run in the browser

```bash
npm run dev        # or open the live GitHub Pages app
```

1. Drop the **daybook** on the left uploader, the **financials pack** on the right.
2. **Overview** KPIs, **P&L**, **Sales·GST**, **Expense→Party**, **Party/AP**,
   **Txn Matrix**, **Transactions** all build from the daybook.
3. **Financials** tab shows the reporting-pack P&L. The **Period** picker defaults
   to the review month (latest populated month column); `∑`-marked entries are the
   audited / cumulative columns. Switching period recomputes instantly.
4. **Download**: Excel review workbook, HTML summary, or normalized CSV.

## June-26 validated baseline (regression reference)

| Check | Value |
|---|---|
| Daybook rows | 131,627 |
| Vouchers (DocumentNo) | 6,736 |
| ΣDR = ΣCR | ₹32,83,67,96,679 (balanced) |
| TDS credit booked | ₹38.07 L |
| RCM credit | ₹36.75 L |
| Financials P&L sheet | `2.利润表Profit & Loss` |
| Default period | June |
| Revenue (June) | ₹1,17,16,60,774 |
| Cost of sales (June) | ₹1,18,58,95,472 |
| Net profit (June) | ₹2,81,68,973 |

## Chart-of-accounts assumptions (SAP)

The analyzers key off these GL prefixes / ledger names. If a future client uses a
different chart, update `mis.ts`, `sales.ts`, `txnMatrix.ts`, `normalizer.ts`:

- Revenue `6001*`/`6051*` · COGS `64*` · Finance `66*` · Opex `7*`
- AP `2202*`/`2241*` · AR `1122*` · Bank `1002*`
- RCM GST `2221013010/30/40` (or ledger `… REVE CH`)
- Output GST `2221013110` (SGST) / `2221013120` (CGST)
- TDS = credit on `TDS - 194x` ledgers, attributed pro-rata across a voucher's expense lines
