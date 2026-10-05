import {SCHEMAS,type Workflow} from '../rules/config';
const escape = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g,'""')}"` : value;
export function toCSV(workflow: Workflow, rows: Record<string,string>[]) {
 const headers = SCHEMAS[workflow];
 return [headers,...rows.map(row=>headers.map(h=>row[h] ?? ''))].map(row=>row.map(escape).join(',')).join('\r\n')+'\r\n';
}
