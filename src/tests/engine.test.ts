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
  const output=toCSV('Frederick',f().rows);expect(output).toContain('Subject ID');expect(output).toContain(fields.subject);expect(output).not.toMatch(/SECRET|MRN|Last Name|First Name/);
 });
});
describe('Frederick',()=>{
 it('removes entire Slide rows and keeps stable first-seen groups',()=>{const r=f();expect(r.slides).toBe(1);expect(r.rows.map(x=>x['Material Type'])).toEqual(['Mononuclear Cells','Plasma','Plasma','Serum','Serum','RNA-Cell']);expect(r.rows.map(x=>x['Material Modifiers'])).toEqual(['modifier 0','modifier 1','modifier 3','modifier 2','modifier 5','modifier 4']);});
 it('has exact ordered schema',()=>expect(Object.keys(f().rows[0]).join('|')).toBe('Sample ID|Sequence|BSI ID|Subject ID|Date Drawn|Protocol|Material Type|Material Modifiers|Volume|Volume Unit|Volume Estimate|Current label|Label Status|Study ID|Tests|Thaws|Vial Status|Freezer|Rack|Box|Row|Col'));
 it('keeps assigned fields blank and exact constants',()=>{for(const row of f().rows){for(const h of BSI_FIELDS.filter(x=>x in row))expect(row[h]).toBe('');expect(row).toMatchObject(CONSTANTS);expect(row['Current label']).toBe(LABEL);expect(row.Volume).toBe('');}});
 it('configures source volume explicitly and blocks invalid values',()=>{const d=sanitizeMatrix(frederick,'Frederick');expect(transform(d,'Frederick',fields,{},new Date(),'source').rows[0].Volume).toBe('0.5');d.rows[0].values.Volume='bad';expect(transform(d,'Frederick',fields,{},new Date(),'source').issues).toHaveLength(1);});
 it('blocks missing material and unsafe source formulas',()=>{const d=sanitizeMatrix([['Material Type'],['=HYPERLINK("bad")']],'Frederick');expect(transform(d,'Frederick',fields).issues).toHaveLength(1);});
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
 it('validates missing and duplicate fields',()=>{expect(()=>sanitizeMatrix([['Container']],'Endoscopy')).toThrow('Anatomical Location');expect(()=>sanitizeMatrix([['Material Type','Material type']],'Frederick')).toThrow('Duplicate');});
 it('rejects PHI headers masquerading as aliases',()=>expect(()=>sanitizeMatrix([['Material Type name'],['Plasma']],'Frederick')).toThrow());
 it('escapes commas quotes and newlines and preserves blank cells',()=>{const row={...f().rows[0],'Material Modifiers':'one, "two"\nthree'};const csv=toCSV('Frederick',[row]);const parsed=XLSX.utils.sheet_to_json<string[]>(XLSX.read(csv,{type:'string',raw:true}).Sheets.Sheet1,{header:1,defval:''});expect(parsed[1]).toHaveLength(22);expect(parsed[1][7]).toBe(row['Material Modifiers']);expect(csv).toContain(',,,TEST-SUBJECT');});
 it.each(['Frederick','Endoscopy'] as const)('never invents null placeholders for %s',w=>{const csv=toCSV(w,w==='Frederick'?f().rows:e().rows);expect(csv).not.toMatch(/undefined|null|NaN/);expect(csv.split('\r\n')[0]).toBe(SCHEMAS[w].join(','));});
 it('normalizes modifiers without duplicate entities',()=>expect(modifiers('A;; B; A; ')).toBe('A; B'));
 it('validates calendar dates and uses local calendar day',()=>{expect(()=>dateDrawn('2026-02-30')).toThrow();expect(received(new Date(2026,0,2,23,59))).toBe('01/02/2026 00:00');});
 it('blocks unsafe subject formulas',()=>expect(()=>transform(sanitizeMatrix(frederick,'Frederick'),'Frederick',{...fields,subject:'=bad'})).toThrow());
});
