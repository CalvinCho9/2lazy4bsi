import * as XLSX from 'xlsx';
import {SCHEMAS,type Workflow} from '../rules/config';
const escape = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g,'""')}"` : value;
export function toCSV(workflow: Workflow, rows: Record<string,string>[]) {
 const headers = SCHEMAS[workflow];
 return [headers,...rows.map(row=>headers.map(h=>row[h] ?? ''))].map(row=>row.map(escape).join(',')).join('\r\n')+'\r\n';
}

// Explicit text cells prevent Excel from reinterpreting dates, IDs or label expressions.
export function toExcel(workflow: Workflow, rows: Record<string,string>[]): ArrayBuffer {
 const headers=SCHEMAS[workflow];
 const sheet=XLSX.utils.aoa_to_sheet([Array.from(headers),...rows.map(row=>headers.map(h=>row[h] ?? ''))]);
 for(const address of Object.keys(sheet)) if(!address.startsWith('!')) sheet[address].z='@';
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'BSI Import');
 return XLSX.write(book,{type:'array',bookType:'xlsx'});
}
