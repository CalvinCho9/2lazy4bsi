export type Workflow = 'Frederick' | 'Endoscopy';
export const PHI_DENYLIST = ['name', 'mrn', 'medical record', 'date of birth', 'dob'];
export const FREDERICK_VOLUME_MODE: 'manual' | 'source' = 'manual';
export const SCHEMAS: Record<Workflow, readonly string[]> = {
 Frederick: ['Sample ID','Sequence','BSI ID','Subject ID','Date Drawn','Protocol','Material Type','Material Modifiers','Volume','Volume Unit','Volume Estimate','Current label','Label Status','Study ID','Tests','Thaws','Vial Status','Freezer','Rack','Box','Row','Col'],
 Endoscopy: ['BSI ID','Sample ID','Sequence','Subject ID','Date Drawn','Freezer','Rack','Box','Row','Col','Current Label','Date Received','Label Status','Material Modifiers','Material Type','Sample Modifiers','Study ID','Tests','Thaws','Vial Location ID','Vial Modifiers','Vial Status','Vial Type','Vial Warnings','Volume','Volume Estimate','Volume Unit','Protocol'],
};
export const BSI_FIELDS = ['Sample ID','Sequence','BSI ID','Freezer','Rack','Box','Row','Col','Vial Location ID'];
export const CONSTANTS = {'Protocol':'94-I-0079','Volume Estimate':'Estimated','Label Status':'Printed','Study ID':'EPU specimen storage','Tests':'0','Thaws':'0','Vial Status':'ln'};
export const LABEL = '@copy("vial.bsi_id")';
export const ALIASES: Record<string, string[]> = {
 'Material Type':['material type','mattype'], 'Material Modifier':['material modifier','material modifiers'],
 'Volume':['volume'], 'Volume Unit':['volume unit','volume units'],
 'Anatomical Location':['anatomical location','anatomic location'], 'Container':['container'], 'Going where?':['going where','destination'],
};
export const REQUIRED: Record<Workflow,string[]> = {Frederick:['Material Type'],Endoscopy:['Anatomical Location','Container','Going where?']};
export const LIMITS = { bytes: 20 * 1024 * 1024, rows: 50000, columns: 256 };
export function fieldKind(workflow: Workflow, field: string) {
 if (BSI_FIELDS.includes(field) || (workflow === 'Frederick' && field === 'Volume' && FREDERICK_VOLUME_MODE === 'manual')) return 'BSI assigns later';
 if (['Subject ID','Date Drawn'].includes(field)) return 'User provided';
 if (workflow === 'Frederick' && ['Material Type','Material Modifiers','Volume','Volume Unit'].includes(field)) return 'From source';
 return 'Generated';
}
