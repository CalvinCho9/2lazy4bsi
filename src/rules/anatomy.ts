import {match, modifiers} from '../utils/normalize';
export const REGIONS = ['esophagus','stomach','duodenum','colonoscopy'];
export const VOCABULARY = ['2ND DUODENUM','3RD DUODENUM','ANTRUM','BODY STOMACH','DUODENUM','EGD','ESOPHAGUS','GASTRIC','ILEUM','DISTAL','ASC COLON','DSC COLON','TERMINAL','RNA LATER','PROXIMAL','MIDDLE'];
export const ANATOMY_RULES: Record<string,Record<string,string>> = {
 esophagus: {'proximal/mid':'ESOPHAGUS; PROXIMAL; MIDDLE',distal:'ESOPHAGUS; DISTAL'},
 stomach: {body:'GASTRIC; BODY STOMACH',antrum:'GASTRIC; ANTRUM'},
 duodenum: {'2nd and 3rd part':'DUODENUM; 2ND DUODENUM; 3RD DUODENUM'},
 colonoscopy: {'terminal ileum':'ILEUM; TERMINAL',ascending:'ASC COLON',descending:'DSC COLON'},
};
export function mapAnatomy(region: string, location: string): string | null {
 const key = match(location).replace(/\s*\/\s*/g,'/');
 const exact = ANATOMY_RULES[region]?.[key];
 if (exact) return exact;
 const colon = ANATOMY_RULES.colonoscopy[key];
 if (colon && (!region || region === 'colonoscopy')) return colon;
 const parts = location.split(';').map(x => match(x).toUpperCase());
 if (!parts.length || parts.some(x=>!VOCABULARY.includes(x))) return null;
 const prefix = region === 'stomach' ? 'GASTRIC' : region === 'colonoscopy' ? '' : region.toUpperCase();
 return modifiers([prefix,...parts].filter(Boolean).join(';'));
}
