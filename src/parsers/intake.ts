import * as XLSX from 'xlsx';
import {ALIASES, LIMITS, REQUIRED, type Workflow} from '../rules/config';
import {isPHI, safeColumnIndexes} from '../security/sanitize';
import {blankRow, header} from '../utils/normalize';
export type SafeRow = { line: number; values: Record<string,string> };
export type Dataset = { rows: SafeRow[]; originalRows: number; removedPHI: number; columns: string[]; skippedRows: number };
export type IntakeResult = { sheets: Dataset[] };
export function sanitizeMatrix(matrix: unknown[][], workflow: Workflow): Dataset {
 const allowedKeys = workflow === 'Frederick' ? ['Material Type','Material Modifier','Volume','Volume Unit','Subject ID','Date Drawn'] : REQUIRED.Endoscopy;
 const allowed = allowedKeys.flatMap(k => ALIASES[k]);
 const headerIndex = matrix.findIndex(row => REQUIRED[workflow].every(key => row.some(cell => !isPHI(cell) && ALIASES[key].includes(header(cell)))));
 if (headerIndex < 0) throw new Error(`No complete header row found. Required fields: ${REQUIRED[workflow].join(', ')}.`);
 const headers = matrix[headerIndex];
 const indexes = safeColumnIndexes(headers, allowed);
 const keys = indexes.map(i => allowedKeys.find(k => ALIASES[k].includes(header(headers[i])))!);
 if (new Set(keys).size !== keys.length) throw new Error('Duplicate source fields found. Use one column per field.');
 const removedPHI = headers.filter(isPHI).length;
 const rows: SafeRow[] = [];
 let skippedRows = 0;
 for (let i=headerIndex+1; i<matrix.length; i++) {
   // Drop PHI/unknown values before checking or processing specimen rows.
   const cells = indexes.map(index => String(matrix[i]?.[index] ?? ''));
   if (blankRow(cells)) { skippedRows++; continue; }
   if (cells.every((cell,j) => !cell.trim() || ALIASES[keys[j]].includes(header(cell)))) {skippedRows++; continue;}
   rows.push({line:i+1, values:Object.fromEntries(keys.map((key,j)=>[key,cells[j]]))});
 }
 return {rows, originalRows:matrix.length-headerIndex-1, removedPHI, columns:keys, skippedRows};
}
export function parseBytes(data: ArrayBuffer, workflow: Workflow, format: 'csv' | 'excel' = 'excel'): IntakeResult {
 try {
  if (data.byteLength > LIMITS.bytes) throw new Error('limit');
  const book = XLSX.read(data,{type:'array',raw:true,cellFormula:false,cellHTML:false,cellStyles:false,cellNF:true,cellText:true,dateNF:'yyyy-mm-dd'});
  const sheets: Dataset[] = [];
  const selected = workflow === 'Frederick' && format === 'excel' ? book.SheetNames.filter(name => name.trim().toLowerCase() === 'klion') : book.SheetNames;
  if (workflow === 'Frederick' && format === 'excel' && selected.length !== 1) throw new Error('Frederick requires exactly one worksheet titled Klion.');
  for (const name of selected) {
   const sheet = book.Sheets[name];
   if (!sheet['!ref']) continue;
   const range = XLSX.utils.decode_range(sheet['!ref']);
   if (range.e.r >= LIMITS.rows || range.e.c >= LIMITS.columns) throw new Error('limit');
   const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',raw:false,blankrows:true,range:{s:{r:0,c:0},e:range.e}});
   // Sanitize each sheet synchronously. Raw workbook and matrix never enter UI state.
   try {
    const sanitized = sanitizeMatrix(matrix,workflow);
    if (workflow === 'Frederick') {
     const headerRow = matrix.find(row => REQUIRED.Frederick.every(key => row.some(cell => !isPHI(cell) && ALIASES[key].includes(header(cell)))))!;
     const dateColumn = headerRow.findIndex(cell => ALIASES['Date Drawn'].includes(header(cell)));
     const volumeColumn = headerRow.findIndex(cell => ALIASES.Volume.includes(header(cell)));
     for (const row of sanitized.rows) {
      // Read the approved numeric cell value, not Excel's display formatting (e.g. 1,000.00).
      const volumeCell = volumeColumn >= 0 ? sheet[XLSX.utils.encode_cell({r:row.line-1,c:volumeColumn})] : undefined;
      if (volumeCell?.t === 'n' && Number.isFinite(volumeCell.v)) row.values.Volume = String(volumeCell.v);
      const cell = sheet[XLSX.utils.encode_cell({r:row.line-1,c:dateColumn})];
      if (cell?.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) {
       const date = XLSX.SSF.parse_date_code(cell.v,{date1904:!!book.Workbook?.WBProps?.date1904});
       row.values['Date Drawn'] = date ? `${String(date.y).padStart(4,'0')}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}` : '';
      }
     }
    }
    sheets.push(sanitized);
   } catch(error) {
    if (error instanceof Error && error.message.startsWith('Duplicate')) throw error;
   }
  }
  if (!sheets.length) throw new Error(`No complete header row found. Required fields: ${REQUIRED[workflow].join(', ')}.`);
  return {sheets};
 } catch(error) {
  if (error instanceof Error && /^(No complete|Duplicate|Frederick requires)/.test(error.message)) throw error;
  throw new Error('Unable to read file. Use a valid CSV, XLSX, or XLS file under 20 MB, 50,000 rows and 256 columns.');
 }
}
