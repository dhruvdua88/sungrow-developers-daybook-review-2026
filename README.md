# Sungrow Monthly Review Engine

A browser-based React app for the monthly **Sungrow / SDIPL** accounting review.
Upload the monthly **Daybook** and **Financials** Excel files, and the app runs
TDS, GST/RCM, audit-exception and financial-performance reviews entirely in your
browser — **no backend, no upload, nothing leaves your machine** — then lets you
download a formatted Excel workbook, a single-page HTML summary and a normalized CSV.

> ⚠️ The output is **rule-based and indicative**. TDS sections, rates, thresholds
> and GST/RCM positions must be independently verified against the Income-tax Act,
> GST law and the underlying vouchers before any filing or payment.

---

## What it does

1. **Upload** a Daybook (transaction-level entries) and optionally a Financials pack.
2. **Parse** both Excel files in-browser using [SheetJS](https://sheetjs.com).
3. **Auto-detect** sheets, header rows and useful columns (fuzzy keyword matching — no fixed column names).
4. **Normalize** transactions (`amount = debit − credit` when no amount column).
5. **Review**:
   - **TDS** — classify each entry to a section (194J/C/I/H/A/192/194Q), compute expected TDS, flag unmapped ledgers and high-value entries.
   - **GST / RCM** — possible reverse charge (legal/professional/freight/import), expenses without GSTIN, GST ledger summary.
   - **Audit** — high-value, round-figure, manual journals, duplicate invoices, related-party, missing PAN/GSTIN.
   - **Financials** — detect the P&L sheet, extract revenue / cost / margins, show variance notes.
6. **Dashboard** — KPI cards + drill-down tables.
7. **Download** — Excel workbook (13 sheets), HTML summary, normalized CSV.

---

## Setup

Requires Node 18+.

```bash
npm install      # install dependencies (SheetJS comes from the SheetJS CDN tarball)
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build locally
```

### Using the app each month

1. Open the app (`npm run dev`, or the deployed GitHub Pages URL).
2. Set the **Month** (e.g. `May-26`) in the header.
3. **Upload Daybook** — the transaction file (required).
4. **Upload Financials** — the monthly reporting pack (optional).
5. Review the **Structure**, **TDS**, **GST/RCM**, **Audit** and **Financials** sections.
6. Refine rules in the **Rule Configuration** panel if needed (re-runs instantly).
7. **Download** the Excel workbook and/or HTML summary from the Download panel.

### Updating the rules

- Edit keywords, section, rate, exclusions and thresholds directly in the **Rule Configuration** table.
- **Export rules JSON** to save your tuned config; **Import rules JSON** to reload it next month.
- A starter config lives at [`public/sample-rules.json`](public/sample-rules.json).
- The hard-coded defaults are in [`src/utils/tdsRules.ts`](src/utils/tdsRules.ts) (`DEFAULT_RULES`).

---

## GitHub Pages deployment

The repo includes a GitHub Actions workflow at
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that builds and
publishes to Pages on every push to `main`.

**One-time setup:**

1. Push this folder to a GitHub repo (e.g. `sungrow-review-engine`).
2. In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Make sure `VITE_BASE` matches your repo name. It is set in two places:
   - `vite.config.ts` (default `'/sungrow-developers-daybook-review-2026/'`)
   - the workflow's `VITE_BASE` env (`/sungrow-developers-daybook-review-2026/`)
   If your repo has a different name, update both.
4. Push to `main` — the site deploys to `https://<user>.github.io/<repo>/`.

**Manual deploy (alternative)** using the `gh-pages` branch:

```bash
npm run deploy   # builds and pushes dist/ to the gh-pages branch
```
(then set **Settings → Pages → Source = gh-pages branch**).

---

## Architecture

```
src/
  App.tsx                  orchestrates upload → review → dashboard → download
  main.tsx                 React entry
  types.ts                 shared types
  utils/
    excelParser.ts         File → WorkbookStructure (SheetJS, robust to odd headers)
    structureDetector.ts   fuzzy column detection + daybook sheet pick
    normalizer.ts          raw rows → normalized Txn[]
    tdsRules.ts            DEFAULT_RULES + TDS classification engine
    gstRules.ts            GST / RCM heuristic flags
    auditRules.ts          audit exception + duplicate detection
    financialsParser.ts    P&L sheet detection + metric extraction
    review.ts              wires parsers + analyses into one ReviewResult
    reportExcel.ts         13-sheet Excel workbook + CSV (SheetJS)
    reportHtml.ts          single-page, email-friendly HTML report
  components/
    FileUpload, DashboardCards, StructurePreview, TdsReview, GstReview,
    AuditReview, FinancialPerformance, RulesEditor, DownloadPanel, ui
```

### Robustness

The parser is built to **not crash** on real-world files: it skips blank rows,
guesses the header row when it isn't row 1, synthesises names for blank header
cells, tolerates merged cells, handles a missing amount column (`debit − credit`),
handles a missing financials file, and surfaces **warnings** instead of throwing.

If an uploaded `.xlsx` is **corrupt or truncated** (e.g. a partial download), the
app shows a warning rather than failing silently — re-download the file and retry.

---

## Tech

React 18 · Vite 5 · TypeScript · Tailwind CSS · SheetJS (xlsx) · file-saver.
First iteration — favours a complete, usable monthly workflow over perfection.
The key is repeatability: upload → review → refine rules → repeat next month.
