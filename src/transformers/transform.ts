import {BSI_FIELDS, CONSTANTS, FREDERICK_VOLUME_MODE, LABEL, SCHEMAS, type Workflow} from '../rules/config';
import {mapAnatomy, REGIONS, VOCABULARY} from '../rules/anatomy';
import type {Dataset} from '../parsers/intake';
import {dateDrawn, sourceDate, match, modifiers, received, whitespace} from '../utils/normalize';
import {safeSource, validateFields, type UserFields} from '../validators/fields';
export type Issue = {line:number; message:string};
export type Result = {rows: Record<string,string>[]; issues: Issue[]; slides:number; excluded:number; groups: [string,number][]};
export function transform(dataset: Dataset, workflow: Workflow, fields: UserFields, resolutions: Record<number,string> = {}, now = new Date(), volumeMode: 'manual'|'source' = FREDERICK_VOLUME_MODE): Result {
 if (workflow === 'Endoscopy') validateFields(fields);
 const result: Result = {rows:[],issues:[],slides:0,excluded:0,groups:[]};
 const grouped = new Map<string, Record<string,string>[]>();
 let region = '';
 for (const source of dataset.rows) {
  const v = source.values;
  const row: Record<string,string> = Object.fromEntries(SCHEMAS[workflow].map(h=>[h,'']));
  Object.assign(row,CONSTANTS);
  if (workflow === 'Endoscopy') Object.assign(row,{'Subject ID':fields.subject.trim(),'Date Drawn':dateDrawn(fields.drawn)});
  if (workflow === 'Frederick') {
   const material = v['Material Type']?.trim() ?? '';
   if (match(material) === 'slide') {result.slides++;continue;}
   if (!material) {result.issues.push({line:source.line,message:'Material Type is missing.'});continue;}
   const subject = (v['Subject ID'] ?? '').trim();
   if (!subject || !safeSource(subject) || /[\r\n\t]/.test(subject)) {result.issues.push({line:source.line,message:'Subject ID is missing or invalid. Correct this row in the source file.'});continue;}
   try {row['Date Drawn'] = sourceDate(v['Date Drawn'] ?? '');} catch {result.issues.push({line:source.line,message:'Date Drawn is missing or invalid. Use an Excel date, YYYY-MM-DD or MM/DD/YYYY in the source file.'});continue;}
   row['Subject ID'] = subject;
   const modifier = modifiers(v['Material Modifier'] ?? '');
   const unit = (v['Volume Unit'] ?? '').trim();
   if (![material,modifier,unit].every(safeSource)) {result.issues.push({line:source.line,message:'A source field has an unsafe spreadsheet formula prefix. Correct the source file.'});continue;}
   Object.assign(row,{'Material Type':material,'Material Modifiers':modifier,'Volume Unit':unit,'Current label':LABEL});
   if (volumeMode === 'source' && whitespace(v.Volume)) {
    const volume = v.Volume.trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(volume) || !Number.isFinite(Number(volume))) {result.issues.push({line:source.line,message:'Volume must be a nonnegative numeric value.'});continue;}
    row.Volume = String(Number(volume));
   }
   const key = match(material);
   if (!grouped.has(key)) grouped.set(key,[]);
   grouped.get(key)!.push(row);
  } else {
   const location = v['Anatomical Location'] ?? '';
   const key = match(location);
   const pureSection = REGIONS.includes(key) && !whitespace(v.Container) && !whitespace(v['Going where?']);
   if (pureSection) {region=key;result.excluded++;continue;}
   if (!match(v.Container).includes('study team') || !match(v['Going where?']).includes('bg 10 lab')) {result.excluded++;continue;}
   const override = resolutions[source.line];
   const anatomy = override && override.split(';').every(x=>VOCABULARY.includes(x.trim())) ? modifiers(override) : mapAnatomy(region,location);
   if (!anatomy) {result.issues.push({line:source.line,message:'Anatomical Location is not recognized. Select the approved entities for this row.'});continue;}
   Object.assign(row,{'Current Label':LABEL,'Date Received':received(now),'Material Modifiers':anatomy,'Material Type':'Biopsy','Vial Type':'2ml Nunc Tube','Volume':'0.500','Volume Unit':'ml (cc)'});
   result.rows.push(row);
  }
  for (const field of BSI_FIELDS) if (field in row) row[field]='';
 }
 if (workflow === 'Frederick') {
  result.rows = [...grouped.values()].flat();
  result.groups = [...grouped.values()].map(rows=>[rows[0]['Material Type'],rows.length]);
 }
 return result;
}
