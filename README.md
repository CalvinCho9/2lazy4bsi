# BSI Data Preparation

A static React + TypeScript + Vite utility for preparing Frederick shipping manifests and Endoscopy specimens for BSI. Supports CSV, XLSX and legacy XLS. No account, backend, database or API is used.

## Privacy architecture

Files are read using the browser File API and parsed with locally bundled SheetJS. Immediately after decoding and locating the header, intake removes PHI columns and projects only the workflow's approved source fields. Raw workbooks, filenames, worksheet names, preambles, unused columns and identifying values never enter React state. Header inspection and file decoding necessarily happen before column removal; all transformation, row filtering, grouping, preview and export happen afterward.

Headers are normalized for case, punctuation and whitespace. `src/rules/config.ts` contains the configurable `PHI_DENYLIST`: name, mrn, medical record, date of birth, dob (including compact spellings). Only the count of removed columns is shown. No raw rows or parser errors are logged. Errors contain safe fixed messages and source row numbers.

Sanitized working data exists only in memory. Reset, file replacement, workflow switching and pagehide clear application state and invalidate pending reads. JavaScript garbage collection controls physical memory reclamation; secure memory erasure is not guaranteed. There is no localStorage, sessionStorage, IndexedDB, cookies, service worker, telemetry, remote scripts or data-bearing URL/history state. The production content security policy blocks connections (`connect-src 'none'`), forms, objects and external assets. GitHub serves static assets and sees ordinary website requests, never uploaded spreadsheets. All dependency assets are bundled locally.

Header-based removal cannot detect identifiers incorrectly placed in retained specimen fields or user-entered Subject ID. This is not a certification of de-identification or regulatory compliance. Keep real PHI out of source control and tests. Clipboard and downloaded CSV files are explicitly user-created copies and are not erased by Reset. Browser extensions and operating-system clipboard/history facilities are outside this app's control.

## Local use

Use Node.js 22.12+ (Node 22 LTS recommended).

```sh
npm ci
npm run dev
```

The local server defaults to http://127.0.0.1:5173. This command builds and serves the production app so the strict CSP remains active. Restart after source edits; hot reload is intentionally disabled. You can also build and preview separately:

```sh
npm run build
npm run preview
```

Open http://127.0.0.1:4173. Choose a workflow, upload a file, enter Subject ID and Date Drawn, inspect the review, generate the CSV and copy or download it. If several worksheets have complete recognized headers, choose the numbered worksheet. Only sanitized sheets are retained; worksheet names are deliberately not displayed. Preview pages contain 100 rows; exports contain all qualifying rows.

## Frederick rules

Requires Material Type, matched by normalized semantic aliases rather than column position. Optional Material Modifier, Volume and Volume Unit are recognized; missing optional fields remain blank. PHI and unused columns are removed before blank/trailing rows and repeated headers are removed. Slide rows are deleted in full using normalized case-insensitive matching. Material types use stable first-seen grouping with original source order preserved within each group. Material Type text is trimmed, modifiers are trimmed and deduplicated by semicolon entity, and Volume Unit is trimmed.

`FREDERICK_VOLUME_MODE` defaults to `manual`: Volume stays blank as a protected BSI/user-managed field. Change the explicit constant to `source` only after confirming the template permits it. Source mode accepts finite nonnegative decimal/scientific numeric values; invalid volumes block export and absent volumes stay blank. No volume is invented.

Subject ID and Date Drawn come only from the UI. Protocol, label expression, label status, study, Tests, Thaws, Vial Status and Volume Estimate follow the prescribed constants in `src/rules/config.ts`. Source sample IDs, sequence, BSI IDs and locations are never copied.

## Endoscopy rules

Requires Anatomical Location (or Anatomic Location), Container and Going where?. Reads top to bottom; pure ESOPHAGUS, STOMACH, DUODENUM and COLONOSCOPY section rows set the active region. Merged horizontal headers work through their top-left cell. Retains only rows whose normalized Container contains Study Team AND destination contains BG 10 Lab. Footnotes `*`, `§`, `†`, `‡` are ignored for matching. NIH/nonmatching rows and pure section headers are excluded. Fragment/pass counts never multiply or delete specimen rows.

Mappings in `src/rules/anatomy.ts`:

| Region / location | Material Modifiers |
| --- | --- |
| ESOPHAGUS / Proximal/mid | ESOPHAGUS; PROXIMAL; MIDDLE |
| ESOPHAGUS / Distal | ESOPHAGUS; DISTAL |
| STOMACH / Body | GASTRIC; BODY STOMACH |
| STOMACH / Antrum | GASTRIC; ANTRUM |
| DUODENUM / 2nd and 3rd part | DUODENUM; 2ND DUODENUM; 3RD DUODENUM |
| COLONOSCOPY / Terminal Ileum | ILEUM; TERMINAL |
| COLONOSCOPY / Ascending | ASC COLON |
| COLONOSCOPY / Descending | DSC COLON |

Already controlled entities are accepted, deduplicated and combined with the region (STOMACH becomes GASTRIC; COLONOSCOPY is not emitted). Unknown anatomy blocks export. The review identifies the source row without echoing arbitrary source text, which could contain identifiers. Consult that row in your local source, select approved entities in the intended order, then apply the resolution. Resolutions can be undone.

Material Type is Biopsy; Volume is 0.500; Unit is ml (cc); Vial Type is 2ml Nunc Tube. Date Received uses the browser's local calendar date with exactly `00:00`, formatted MM/DD/YYYY HH:mm. Date Drawn is exported as MM/DD/YYYY. All other constants and blank fields match the centralized schema. The required cryovial/fragment warning is displayed before generation.

## BSI-managed fields and CSV

The exact ordered schemas are centralized in `src/rules/config.ts` and asserted independently in tests. BSI itself assigns blank Sample ID, Sequence, BSI ID, Freezer, Rack, Box, Row and Col; Endoscopy additionally leaves Vial Location ID blank. Other prescribed blank fields remain present. Frederick manual Volume is blank. Empty preview cells are shown as dashes, but CSV cells are truly empty. No placeholder or BSI assignment command is generated.

Current label / Current Label contains the exact literal `@copy("vial.bsi_id")`. Tests and Thaws contain the explicitly required constant 0. CSV is UTF-8 with CRLF record delimiters, complete headers, proper quote/comma/newline escaping and preserved empty positions. Predictable filenames use the local export date. Clipboard copies the entire CSV. Clipboard failure falls back to downloadable or selectable complete text.

Source values with spreadsheet formula prefixes block export rather than being silently rewritten. The specified generated label expression is intentionally preserved. Import CSV directly into BSI; spreadsheet applications may interpret the required label expression as a formula.

## Tests and build

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Unit tests cover PHI removal, exact schemas, constants, protected fields, stable grouping, Slide removal, Endoscopy filters and anatomy, local dates, validation, CSV round trips, and CSV/XLSX/XLS intake including merged headers. Browser tests use the production build to exercise both workflows, unknown-anatomy resolution, preview, clipboard, download, workflow switching, reset, zero post-load network requests and empty browser storage/cookies.

No Frederick sample was present in the initially empty repository or supplied attachments. `src/tests/fixtures.ts` therefore contains explicitly synthetic Frederick and Endoscopy regression data with PHI sentinel strings. No real patient data is included. A real-sample regression remains unavailable until an appropriately sanitized sample is provided.

## GitHub Pages deployment

`.github/workflows/pages.yml` runs tests, type checks, production build and Chromium tests, then deploys `dist` on a push to `main`. Pull requests validate without deploying. Relative Vite asset paths support a project site under `/2lazy4bsi/`.

1. In GitHub repository **Settings → Pages → Build and deployment**, select **GitHub Actions**.
2. Push to `main` (or manually run the workflow after enabling Pages).
3. Check the **Test and deploy GitHub Pages** Actions run and its deployment URL.

```sh
git push -u origin main
```

Expected URL after successful deployment: https://calvincho9.github.io/2lazy4bsi/ . Merely pushing does not prove Pages is enabled or deployed. Repository administrators may need to enable Pages, Actions permissions or environment approval. No secrets are needed by the application. Do not add analytics or remote script tags.

## Maintenance and limitations

- Change schemas, field categories, aliases, limits, constants and PHI denylist in `src/rules/config.ts`; anatomy vocabulary/rules in `src/rules/anatomy.ts`. Update exact-order/mapping tests when intentionally changing business rules.
- Parser supports one recognized header layout per worksheet. Multiple differently structured tables, vertically merged specimen cells and ambiguous duplicate fields require cleanup. It does not propagate arbitrary merged cell values into specimen records or evaluate formulas.
- Original row count means rows beneath the detected header inside the worksheet's used range, including blank/section rows; PHI-only and unsupported-only rows are discarded. Blank columns and repeated complete header rows are ignored. Extra formatted trailing ranges may contribute to original counts.
- Files are capped at 20 MB, 50,000 worksheet rows and 256 columns. Parsing is synchronous and very large or malicious compressed workbooks may still strain browser memory before range limits can be checked. Use trusted manifests; encrypted/password-protected files are unsupported.
- Only complete recognized worksheets are selectable. Missing required headers block intake if no complete sheet exists. Optional Frederick modifiers and units are not guessed.
- Matching uses normalized case/spacing, but preserved Frederick material values keep their original semantic spelling. Matching groups capitalization variants together.
- Bundled Excel support adds approximately 200 KB gzip to the application. SheetJS 0.20.3 is vendored from its official distribution following https://docs.sheetjs.com/docs/getting-started/installation/nodejs/; its license is included in the tarball. Do not replace it with the older npm-registry release.
- Modern Chromium is covered by browser automation. Other browsers should support standard File/Blob APIs; clipboard requires a secure context and browser permission. No BSI instance is available for a live import test.
