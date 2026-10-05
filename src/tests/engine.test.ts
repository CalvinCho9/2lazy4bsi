import {describe,it,expect} from 'vitest';
import * as XLSX from 'xlsx';
import {sanitizeMatrix,parseBytes} from '../parsers/intake';
import {transform} from '../transformers/transform';
import {SCHEMAS,BSI_FIELDS,CONSTANTS,LABEL} from '../rules/config';
import {isPHI} from '../security/sanitize';
import {dateDrawn,received,modifiers} from '../utils/normalize';
import {mapAnatomy} from '../rules/anatomy';
import {toCSV} from '../utils/csv';
import {frederick,endoscopy} from './fixtures';
const fields={subject:'TEST-SUBJECT',drawn:'2026-10-05'};
const f=()=>transform(sanitizeMatrix(frederick,'Frederick'),'Frederick',fields);
const e=()=>transform(sanitizeMatrix(endoscopy,'Endoscopy'),'Endoscopy',fields,{},new Date(2026,9,5,15,42));
describe('privacy boundary',()=>{
 it.each(['MRN','Last Name','First_Name','Medical Record Number','Date of Birth','DOB','patientDOB'])('removes %s',h=>expect(isPHI(h)).toBe(true));
 it('preserves Subject ID as user field, removes identifying data and unused columns before transformation',()=>{
  const safe=sanitizeMatrix(frederick,'Frederick');expect(safe.removedPHI).toBe(3);
  expect(JSON.stringify(safe)).not.toMatch(/SECRET|MRN|Last Name|First Name|Comments/);
  const output=toCSV('Frederick',f().rows);expect(output).toContain('Subject ID');expect(output).toContain('TEST-SUBJECT-0');expect(output).not.toMatch(/SECRET|MRN|Last Name|First Name/);
 });
});
describe('Frederick',()=>{
 it('removes entire Slide rows and keeps stable first-seen groups',()=>{const r=f();expect(r.slides).toBe(1);expect(r.rows.map(x=>x['Material Type'])).toEqual(['Mononuclear Cells','Plasma','Plasma','Serum','Serum','RNA-Cell']);expect(r.rows.map(x=>x['Material Modifiers'])).toEqual(['modifier 0','modifier 1','modifier 3','modifier 2','modifier 5','modifier 4']);});
 it('has exact ordered schema',()=>expect(Object.keys(f().rows[0]).join('|')).toBe('Sample ID|Sequence|BSI ID|Subject ID|Date Drawn|Protocol|Material Type|Material Modifiers|Volume|Volume Unit|Volume Estimate|Current label|Label Status|Study ID|Tests|Thaws|Vial Status|Freezer|Rack|Box|Row|Col'));
 it('keeps assigned fields blank and exact constants',()=>{for(const row of f().rows){for(const h of BSI_FIELDS.filter(x=>x in row))expect(row[h]).toBe('');expect(row).toMatchObject(CONSTANTS);expect(row['Current label']).toBe(LABEL);expect(row.Volume).toBe('0.5');}});
 it('configures source volume explicitly and blocks invalid values',()=>{const d=sanitizeMatrix(frederick,'Frederick');expect(transform(d,'Frederick',fields,{},new Date(),'source').rows[0].Volume).toBe('0.5');d.rows[0].values.Volume='bad';expect(transform(d,'Frederick',fields,{},new Date(),'source').issues).toHaveLength(1);});
 it('blocks missing material and unsafe source formulas',()=>{const d=sanitizeMatrix([['Material Type','Subject ID','Date Drawn'],['=HYPERLINK("bad")','TEST','2026-10-05']],'Frederick');expect(transform(d,'Frederick',fields).issues).toHaveLength(1);});
});
describe('Endoscopy',()=>{
 it('filters NIH rows, inherits sections and maps all required examples',()=>{expect(e().issues).toEqual([]);expect(e().rows.map(x=>x['Material Modifiers'])).toEqual(['ESOPHAGUS; PROXIMAL; MIDDLE','ESOPHAGUS; DISTAL','GASTRIC; BODY STOMACH','GASTRIC; ANTRUM','DUODENUM; 2ND DUODENUM; 3RD DUODENUM','ILEUM; TERMINAL','ASC COLON','DSC COLON']);});
 it('has exact ordered schema',()=>expect(Object.keys(e().rows[0]).join('|')).toBe('BSI ID|Sample ID|Sequence|Subject ID|Date Drawn|Freezer|Rack|Box|Row|Col|Current Label|Date Received|Label Status|Material Modifiers|Material Type|Sample Modifiers|Study ID|Tests|Thaws|Vial Location ID|Vial Modifiers|Vial Status|Vial Type|Vial Warnings|Volume|Volume Estimate|Volume Unit|Protocol'));
 it('keeps BSI fields blank, exact constants and local midnight date',()=>{for(const row of e().rows){for(const h of BSI_FIELDS)expect(row[h]).toBe('');expect(row).toMatchObject({...CONSTANTS,'Current Label':LABEL,'Date Received':'10/05/2026 00:00','Material Type':'Biopsy','Volume':'0.500','Volume Unit':'ml (cc)','Vial Type':'2ml Nunc Tube'});}});
 it('blocks unknown anatomy and allows controlled ordered resolution',()=>{const d=sanitizeMatrix([endoscopy[1],['UNKNOWN',1,2,'Study Team','BG 10 Lab']],'Endoscopy');expect(transform(d,'Endoscopy',fields).issues[0].line).toBe(2);expect(transform(d,'Endoscopy',fields,{2:'ILEUM; TERMINAL'}).rows[0]['Material Modifiers']).toBe('ILEUM; TERMINAL');expect(transform(d,'Endoscopy',fields,{2:'invented'}).issues).toHaveLength(1);});
 it('does not treat anatomical specimen rows as pure sections',()=>{const d=sanitizeMatrix([endoscopy[1],['ESOPHAGUS',1,2,'Study Team','BG 10 Lab']],'Endoscopy');expect(transform(d,'Endoscopy',fields).rows).toHaveLength(1);});
 it('rejects an unknown sublocation even with known region',()=>expect(mapAnatomy('stomach','unknown')).toBeNull());
});
describe('intake and export',()=>{
 it.each(['csv','xlsx','biff8'] as const)('parses %s locally including sections and blanks',bookType=>{const book=XLSX.utils.book_new();const sheet=XLSX.utils.aoa_to_sheet(endoscopy);sheet['!merges']=[{s:{r:2,c:0},e:{r:2,c:5}}];XLSX.utils.book_append_sheet(book,sheet,'Synthetic');const bytes=XLSX.write(book,{type:'array',bookType});const d=parseBytes(bytes,'Endoscopy');expect(transform(d.sheets[0],'Endoscopy',fields).rows).toHaveLength(8);expect(JSON.stringify(d)).not.toContain('SECRET');});
 it('validates missing and duplicate fields',()=>{expect(()=>sanitizeMatrix([['Container']],'Endoscopy')).toThrow('Anatomical Location');expect(()=>sanitizeMatrix([['Material Type','Material type','Subject ID','Date Drawn']],'Frederick')).toThrow('Duplicate');});
 it('rejects PHI headers masquerading as aliases',()=>expect(()=>sanitizeMatrix([['Material Type name'],['Plasma']],'Frederick')).toThrow());
 it('escapes commas quotes and newlines and preserves blank cells',()=>{const row={...f().rows[0],'Material Modifiers':'one, "two"\nthree'};const csv=toCSV('Frederick',[row]);const parsed=XLSX.utils.sheet_to_json<string[]>(XLSX.read(csv,{type:'string',raw:true}).Sheets.Sheet1,{header:1,defval:''});expect(parsed[1]).toHaveLength(22);expect(parsed[1][7]).toBe(row['Material Modifiers']);expect(csv).toContain(',,,TEST-SUBJECT-0');});
 it.each(['Frederick','Endoscopy'] as const)('never invents null placeholders for %s',w=>{const csv=toCSV(w,w==='Frederick'?f().rows:e().rows);expect(csv).not.toMatch(/undefined|null|NaN/);expect(csv.split('\r\n')[0]).toBe(SCHEMAS[w].join(','));});
 it('normalizes modifiers without duplicate entities',()=>expect(modifiers('A;; B; A; ')).toBe('A; B'));
 it('validates calendar dates and uses local calendar day',()=>{expect(()=>dateDrawn('2026-02-30')).toThrow();expect(received(new Date(2026,0,2,23,59))).toBe('01/02/2026 00:00');});
 it('blocks unsafe Endoscopy subject formulas',()=>expect(()=>transform(sanitizeMatrix(endoscopy,'Endoscopy'),'Endoscopy',{...fields,subject:'=bad'})).toThrow());
});

describe('Frederick Klion source fields',()=>{
 it('preserves row-specific subjects and dates through grouping without UI overrides',()=>{
  const d=sanitizeMatrix([['Material Type','Subject ID','Date Drawn'],['Plasma','001','2026-10-01'],['Serum','002','10/2/2026'],['Plasma','003','2026-10-03']],'Frederick');
  expect(transform(d,'Frederick',{subject:'override',drawn:'invalid'}).rows.map(r=>[r['Subject ID'],r['Date Drawn']])).toEqual([['001','10/01/2026'],['003','10/03/2026'],['002','10/02/2026']]);
 });
 it.each(['xlsx','biff8'] as const)('selects only Klion from %s and normalizes real Excel dates',bookType=>{
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(frederick),'Wrong sheet');
  const sheet=XLSX.utils.aoa_to_sheet([['Material Type','Subject ID','Date Drawn','MRN','Volume','Volume Unit'],['Plasma','0007',new Date(2026,9,5),'SECRET',1000.25,' ml ']]);
  sheet.E2.z='#,##0.00';
  sheet.C2.z='dd-mmm-yyyy'; delete sheet.C2.w;
  XLSX.utils.book_append_sheet(book,sheet,'Klion');
  const parsed=parseBytes(XLSX.write(book,{type:'array',bookType}),'Frederick');
  expect(parsed.sheets).toHaveLength(1);
  expect(transform(parsed.sheets[0],'Frederick',{subject:'',drawn:''}).rows[0]).toMatchObject({'Subject ID':'0007','Date Drawn':'10/05/2026',Volume:'1000.25','Volume Unit':'ml'});
  expect(JSON.stringify(parsed)).not.toContain('SECRET');
 });
 it('rejects a workbook missing Klion even when another sheet has matching columns',()=>{
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(frederick),'Other');
  expect(()=>parseBytes(XLSX.write(book,{type:'array',bookType:'xlsx'}),'Frederick')).toThrow('worksheet titled Klion');
 });
 it('blocks missing row fields and invalid dates without exposing values',()=>{
  const d=sanitizeMatrix([['Material Type','Subject ID','Date Drawn'],['Plasma','','2026-10-01'],['Plasma','TEST','02/30/2026'],['Slide','','']],'Frederick');
  const result=transform(d,'Frederick',{subject:'',drawn:''});expect(result.issues).toHaveLength(2);expect(result.rows).toHaveLength(0);expect(result.slides).toBe(1);
 });
});


describe('source volume and exact vial status export',()=>{
 it('uses source volume by default and preserves the explicit manual override',()=>{
  const d=sanitizeMatrix(frederick,'Frederick');
  expect(transform(d,'Frederick',fields).rows[0]).toMatchObject({Volume:'0.5','Volume Unit':'ml','Date Drawn':'10/01/2026'});
  expect(transform(d,'Frederick',fields,{},new Date(),'manual').rows[0].Volume).toBe('');
 });
 it('keeps missing volumes blank and blocks invalid volumes by default',()=>{
  const d=sanitizeMatrix(frederick,'Frederick');d.rows[0].values.Volume='';
  expect(transform(d,'Frederick',fields).rows[0].Volume).toBe('');
  d.rows[0].values.Volume='not numeric';expect(transform(d,'Frederick',fields).issues).toHaveLength(1);
 });
 it.each(['Frederick','Endoscopy'] as const)('exports literal lowercase ln in the correct %s column',workflow=>{
  const rows=workflow==='Frederick'?f().rows:e().rows;
  const csv=toCSV(workflow,rows);
  const sheet=XLSX.read(csv,{type:'string',raw:true}).Sheets.Sheet1;
  const table=XLSX.utils.sheet_to_json<string[]>(sheet,{header:1,defval:''});
  const index=table[0].indexOf('Vial Status');
  for(const row of table.slice(1)){expect(row).toHaveLength(SCHEMAS[workflow].length);expect(row[index]).toBe('ln');expect([...row[index]].map(c=>c.charCodeAt(0))).toEqual([108,110]);}
 });
});

describe('Excel serial Date Drawn export',()=>{
 it.each([['xlsx',false,46300],['xlsx',true,44838],['biff8',false,46300],['xlsx',false,'46300'],['csv',false,'46300.75']] as const)('converts %s serial dates (1904=%s, value=%s) to CSV date text', (bookType,date1904,value)=>{
  const book=XLSX.utils.book_new();book.Workbook={WBProps:{date1904}};
  const sheet=XLSX.utils.aoa_to_sheet([['Material Type','Subject ID','Date Drawn'],['Plasma','TEST',value]]);
  XLSX.utils.book_append_sheet(book,sheet,'Klion');
  const d=parseBytes(XLSX.write(book,{type:'array',bookType}),'Frederick',bookType==='csv'?'csv':'excel').sheets[0];
  const result=transform(d,'Frederick',{subject:'',drawn:''});expect(result.issues).toEqual([]);
  expect(result.rows[0]['Date Drawn']).toBe('10/05/2026');
  const csv=toCSV('Frederick',result.rows);expect(csv).toContain(',10/05/2026,');expect(csv).not.toContain(String(value));
 });
 it.each([0,60,99999999])('blocks invalid serial %s without inventing a date',value=>{
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Material Type','Subject ID','Date Drawn'],['Plasma','TEST',value]]),'Klion');
  const d=parseBytes(XLSX.write(book,{type:'array',bookType:'xlsx'}),'Frederick').sheets[0];
  expect(transform(d,'Frederick',{subject:'',drawn:''}).issues).toHaveLength(1);
 });
});
