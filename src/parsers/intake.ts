import * as XLSX from 'xlsx';
import {ALIASES, LIMITS, REQUIRED, type Workflow} from '../rules/config';
import {isPHI, safeColumnIndexes} from '../security/sanitize';
import {blankRow, header} from '../utils/normalize';
export type SafeRow = { line: number; values: Record<string,string> };
export type Dataset = { rows: SafeRow[]; originalRows: number; removedPHI: number; columns: string[]; skippedRows: number };
export type IntakeResult = { sheets: Dataset[] };
export function sanitizeMatrix(matrix: unknown[][], workflow: Workflow): Dataset {
 const allowedKeys = workflow === 'Frederick' ? ['Material Type','Material Modifier','Volume','Volume Unit'] : REQUIRED.Endoscopy;
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
export function parseBytes(data: ArrayBuffer, workflow: Workflow): IntakeResult {
 try {
  if (data.byteLength > LIMITS.bytes) throw new Error('limit');
  const book = XLSX.read(data,{type:'array',raw:true,cellFormula:false,cellHTML:false,cellStyles:false,cellText:true});
  const sheets: Dataset[] = [];
  for (const name of book.SheetNames) {
   const sheet = book.Sheets[name];
   if (!sheet['!ref']) continue;
   const range = XLSX.utils.decode_range(sheet['!ref']);
   if (range.e.r >= LIMITS.rows || range.e.c >= LIMITS.columns) throw new Error('limit');
   const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',raw:false,blankrows:true});
   // Sanitize each sheet synchronously. Raw workbook and matrix never enter UI state.
   try { sheets.push(sanitizeMatrix(matrix,workflow)); } catch(error) {
    if (error instanceof Error && error.message.startsWith('Duplicate')) throw error;
   }
  }
  if (!sheets.length) throw new Error(`No complete header row found. Required fields: ${REQUIRED[workflow].join(', ')}.`);
  return {sheets};
 } catch(error) {
  if (error instanceof Error && /^(No complete|Duplicate)/.test(error.message)) throw error;
  throw new Error('Unable to read file. Use a valid CSV, XLSX, or XLS file under 20 MB, 50,000 rows and 256 columns.');
 }
}
