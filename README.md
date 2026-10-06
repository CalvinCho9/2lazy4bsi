# BSI Data Preparation

A static React + TypeScript + Vite utility for preparing Frederick shipping manifests and Endoscopy specimens for BSI. Supports CSV, XLSX and legacy XLS, plus bordered-table PNG images for Endoscopy. No account, backend, database or API is used.

## Privacy architecture

Files are read using the browser File API and parsed with locally bundled SheetJS. Immediately after decoding and locating the header, intake removes PHI columns and projects only the workflow's approved source fields. Raw workbooks, filenames, worksheet names, preambles, unused columns and identifying values never enter React state. Header inspection and file decoding necessarily happen before column removal; all transformation, row filtering, grouping, preview and export happen afterward.

Headers are normalized for case, punctuation and whitespace. `src/rules/config.ts` contains the configurable `PHI_DENYLIST`: name, mrn, medical record, date of birth, dob (including compact spellings). Only the count of removed columns is shown. No raw rows or parser errors are logged. Errors contain safe fixed messages and source row numbers.

Sanitized working data exists only in memory. Reset, file replacement, workflow switching and pagehide clear application state and invalidate pending reads. JavaScript garbage collection controls physical memory reclamation; secure memory erasure is not guaranteed. There is no localStorage, sessionStorage, IndexedDB, cookies, service worker, telemetry, remote scripts or data-bearing URL/history state. The production content security policy blocks external connections, forms, objects and external assets. `connect-src 'self'` permits loading the bundled OCR assets from this site's origin. OCR requests are fixed static GETs; no request contains image pixels, extracted text, specimen values or filenames. GitHub serves static assets and sees ordinary website requests, never uploaded spreadsheets. All runtime dependency assets are bundled locally. PNG OCR uses a dedicated worker and downloads its engine/model from the same site; model IndexedDB caching is disabled.

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

Open http://127.0.0.1:4173. Choose a workflow, upload a file, enter Subject ID and Date Drawn for Endoscopy (Frederick reads them per source row), inspect the review, generate the CSV and copy or download it. Frederick Excel workbooks automatically use only the worksheet titled Klion (case-insensitive, trimmed matching); a missing or ambiguous Klion tab blocks intake. CSV files use their single table. For Endoscopy, if several worksheets have complete recognized headers, choose the numbered worksheet. Only sanitized sheets are retained; worksheet names are deliberately not displayed. Preview pages contain 100 rows; exports contain all qualifying rows.

## Frederick rules

Requires Material Type, Subject ID and Date Drawn, matched by normalized semantic aliases rather than column position. Optional Material Modifier, Volume and Volume Unit are recognized; missing optional fields remain blank. PHI and unused columns are removed before blank/trailing rows and repeated headers are removed. Slide rows are deleted in full using normalized case-insensitive matching. Material types use stable first-seen grouping with original source order preserved within each group. Material Type text is trimmed, modifiers are trimmed and deduplicated by semicolon entity, and Volume Unit is trimmed.

`FREDERICK_VOLUME_MODE` defaults to `source`: Volume and Volume Unit are taken from each uploaded source row. The explicit `manual` option remains available for future templates that require a protected blank Volume. Source mode accepts finite nonnegative decimal/scientific numeric values; invalid volumes block export and absent volumes stay blank. No volume is invented.

Subject ID and Date Drawn come from each specimen row in Klion (or its CSV export), and stay associated with that row during grouping. Subject IDs retain leading zeroes when present in source text or Excel display formatting. Blank/unsafe IDs and invalid dates block export with source row numbers. Excel date cells respect the workbook date system and export as MM/DD/YYYY; text dates must use YYYY-MM-DD or MM/DD/YYYY with a four-digit year. Numeric Date Drawn values (Excel serial day counts, including General-formatted cells and numeric text) are converted to calendar dates before export. XLSX/XLS uses the workbook’s 1900/1904 date system; CSV lacks that metadata and uses the explicit `CSV_DATE_SYSTEM` setting, defaulting to 1900. Fractional serials use the calendar day only. Invalid serials, the fictitious 1900-02-29, and ambiguous two-digit years are rejected. CSV exports contain literal MM/DD/YYYY text; opening them in Excel may apply Excel’s own display formatting. Use **Download Excel (text dates)** for Excel viewing or copying: its XLSX cells explicitly store dates as MM/DD/YYYY text and preserve leading zeroes. Use the CSV download for direct BSI CSV import. Frederick no longer uses global UI overrides for these fields. Endoscopy still asks for both values in the UI. Protocol, label expression, label status, study, Tests, Thaws, Vial Status and Volume Estimate follow the prescribed constants in `src/rules/config.ts`. Source sample IDs, sequence, BSI IDs and locations are never copied.

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

## Endoscopy PNG workflow

Upload a clear PNG of the complete bordered table, including its header row. The supported layout is the supplied example: Anatomic Location, No. Passes, Fragments, Container, Going where?, Protocol, with full-width anatomical section rows and optional gaps between tables. Column widths and row positions are detected from borders rather than hard-coded screenshot coordinates. Headers must match recognized aliases; extra PHI/unknown columns are not read below their headers.

The browser decodes the image, detects borders and OCRs the header cells. It then reads only anatomy, Container and Going where? cells using Tesseract.js. This image-specific intake necessarily sees pixels and header text before identifying PHI columns. It does not OCR PHI-column values, footnotes, passes, fragments or protocol. No image or arbitrary raw OCR text is shown in the UI or retained in application state. Only controlled anatomy/routing labels enter the review; unknown or low-confidence OCR becomes **Needs review**. Column detection and OCR are not a guarantee of de-identification. Keep identifying text outside the specimen fields.

1. Compare every detected row against the original PNG open locally. The app does not display the original image because it may contain identifiers.
2. Correct region, location, Container and destination with the dropdowns. Add missed specimen rows or remove extra detected rows. Appended rows carry their own explicit region.
3. Resolve every unknown Container/destination, and region/location for every Study Team + BG 10 Lab row. **Other** explicitly excludes a row; recognized Building 4 maps to Other. Review excluded rows as carefully as included rows so an OCR routing error does not omit a specimen.
4. Click **I checked every image row — confirm extraction**, enter Subject ID/Date Drawn, inspect the final BSI table and generate CSV. Editing any extraction row invalidates confirmation and generated output.

Each retained image row yields exactly one specimen row. The provided reference has 19 specimen rows and 9 qualifying BG 10 Lab rows. Its Duodenum Study Team row routes to Building 4 and is excluded under the existing rule. Initial OCR on the reference required anatomy correction (including Terminal Ileum); it is deliberately not treated as authoritative. The supplied image is not committed to the repository; automated fixtures are generated synthetic images.

PNG limits: 20 MB; at least 300 × 100 pixels; neither dimension above 6,000; at most 16 million pixels; up to 149 detected horizontal bands. Rotated/skewed photographs, borderless tables, compressed or blurry images, arbitrary merged cells, multiple different column layouts and handwriting are unsupported. Unsupported layouts fail with a safe message; OCR can still miss rows, so the explicit human count/content review is mandatory. Text and colors are not used to infer fragment counts or cryovial counts. Existing spreadsheet upload remains available.

OCR is loaded only when PNG is selected. `scripts/prepare-ocr.mjs` copies the pinned dependencies into ignored `public/ocr/` during build; CI deploys these static assets with `dist`. No CDN paths are used at runtime. The English model is about 11 MB and the selected OCR core about 4 MB before transfer compression; the initial image read can take longer on slower devices/connections. Runtime assets may enter ordinary HTTP caches, but image/specimen data does not. Worker language caching is disabled (`cacheMethod: none`). Reset, workflow switching, replacement and pagehide abort pending image work; completed workers terminate, canvases are cleared, and only confirmed controlled values remain in memory. Image reading has a two-minute timeout.

Engine documentation: https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md . Engine/core use Apache-2.0; the English model package declares MIT. Build output includes engine/core license notices. See the pinned packages for complete dependency notices.

## BSI-managed fields and CSV

The exact ordered schemas are centralized in `src/rules/config.ts` and asserted independently in tests. BSI itself assigns blank Sample ID, Sequence, BSI ID, Freezer, Rack, Box, Row and Col; Endoscopy additionally leaves Vial Location ID blank. Other prescribed blank fields remain present. Frederick Volume is source-populated by default; missing source values stay blank. Empty preview cells are shown as dashes, but CSV cells are truly empty. No placeholder or BSI assignment command is generated.

Frederick Vial Status is the exact two-character literal `In` (uppercase I, lowercase n; ASCII 73, 110). Endoscopy retains its existing `ln` value. Preview, clipboard and downloaded CSV use the same workflow-specific status.

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

Unit tests cover PHI removal, exact schemas, constants, protected fields, stable grouping, Slide removal, Endoscopy filters and anatomy, local dates, validation, CSV round trips, and CSV/XLSX/XLS intake including merged headers. Browser tests use the production build to exercise both workflows, unknown-anatomy resolution, preview, clipboard, download, workflow switching, reset, zero post-load network requests for spreadsheet processing and empty browser storage/cookies. The PNG browser test exercises real OCR with a synthetic image containing PHI sentinels, mandatory review, corrections, exclusion rules, invalidation after editing, same-origin static GET-only requests and no IndexedDB persistence.

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

## Troubleshooting a blank GitHub Pages site

Pages must use **Settings → Pages → Build and deployment → Source: GitHub Actions**. Do not select **Deploy from a branch / main / root**: that publishes the source `index.html`, which references `/src/main.tsx`. Browsers cannot run this TypeScript entry point. The workflow publishes the compiled `dist` directory, whose HTML references bundled JavaScript under `assets/`.

If a deployment reports `Failed to create deployment (status: 404)`, enable Pages with the GitHub Actions source, then rerun **Test and deploy GitHub Pages** from the Actions tab. A successful **pages build and deployment** branch-publishing run is not the application's build workflow. After the correct deployment succeeds, reload the page; allow a short delay for GitHub's CDN to update. The workflow now checks Pages configuration before publishing.

If a publish job fails with “The job was not acquired by Runner of type hosted” or a GitHub internal server error before any steps run, the new app has not been published; the previous site stays live. Rerun the failed jobs from Actions. The workflow pins Ubuntu 24.04 instead of the moving `ubuntu-latest` label. Successful build/tests alone do not mean the deployment succeeded.

## Maintenance and limitations

- Change schemas, field categories, aliases, limits, constants and PHI denylist in `src/rules/config.ts`; anatomy vocabulary/rules in `src/rules/anatomy.ts`. Update exact-order/mapping tests when intentionally changing business rules.
- Parser supports one recognized header layout per worksheet. Multiple differently structured tables, vertically merged specimen cells and ambiguous duplicate fields require cleanup. It does not propagate arbitrary merged cell values into specimen records or evaluate formulas.
- Original row count means rows beneath the detected header inside the worksheet's used range, including blank/section rows; PHI-only and unsupported-only rows are discarded. Blank columns and repeated complete header rows are ignored. Extra formatted trailing ranges may contribute to original counts.
- Files are capped at 20 MB, 50,000 worksheet rows and 256 columns. Parsing is synchronous and very large or malicious compressed workbooks may still strain browser memory before range limits can be checked. Use trusted manifests; encrypted/password-protected files are unsupported.
- Only Klion is used for Frederick Excel files; only complete recognized worksheets are selectable for Endoscopy. Missing required headers block intake if no complete sheet exists. Optional Frederick modifiers and units are not guessed.
- Matching uses normalized case/spacing, but preserved Frederick material values keep their original semantic spelling. Matching groups capitalization variants together.
- Bundled Excel support adds approximately 200 KB gzip to the application. SheetJS 0.20.3 is vendored from its official distribution following https://docs.sheetjs.com/docs/getting-started/installation/nodejs/; its license is included in the tarball. Do not replace it with the older npm-registry release.
- Modern Chromium is covered by browser automation. Other browsers should support standard File/Blob APIs; clipboard requires a secure context and browser permission. No BSI instance is available for a live import test.
