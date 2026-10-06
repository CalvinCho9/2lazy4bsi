import {match, modifiers} from '../utils/normalize';
export const REGIONS = ['esophagus','stomach','duodenum','colonoscopy'];
export const VOCABULARY = ['2ND DUODENUM','3RD DUODENUM','ANTRUM','BODY STOMACH','DUODENUM','EGD','ESOPHAGUS','GASTRIC','ILEUM','DISTAL','ASC COLON','DSC COLON','TERMINAL','RNA LATER','PROXIMAL','MIDDLE'];
export const ANATOMY_RULES: Record<string,Record<string,string>> = {
 esophagus: {'proximal/mid':'ESOPHAGUS; PROXIMAL; MIDDLE',distal:'ESOPHAGUS; DISTAL'},
 stomach: {body:'GASTRIC; BODY STOMACH',antrum:'GASTRIC; ANTRUM'},
 duodenum: {'2nd and 3rd part':'DUODENUM; 2ND DUODENUM; 3RD DUODENUM'},
 colonoscopy: {'terminal ileum':'ILEUM; TERMINAL',ascending:'ASC COLON',descending:'DSC COLON'},
};
// Match complete approved phrases; unknown fragments still require review.
export function mapAnatomy(region: string, location: string): string | null {
 const key=match(location).replace(/duondenum/g,'duodenum').replace(/\s*\/\s*/g,'/');
 const exact=ANATOMY_RULES[region]?.[key];
 if(exact)return exact;
 const parts=key.split(/\s*(?:;|,|\/|&|\band\b|\+)\s*/);
 if(!region && parts.every(part=>VOCABULARY.includes(part.toUpperCase())))return modifiers(parts.map(part=>part.toUpperCase()).join(';'));
 const mapped:string[]=[];
 const duodenal=region==='duodenum'||/\bduoden(?:um|al)\b/.test(key);
 for(const part of parts){
  let value=ANATOMY_RULES[region]?.[part];
  if(!value && (!region||region==='colonoscopy'))value=ANATOMY_RULES.colonoscopy[part];
  if(!value && duodenal){
   const ordinal=/^(?:(?:part|portion)\s+)?(2nd|second|3rd|third)(?:\s+(?:(?:part|portion)(?:\s+of)?\s+)?(?:the\s+)?duoden(?:um|al))?(?:\s+(?:part|portion))?$/.exec(part);
   if(ordinal)value=/^(2nd|second)$/.test(ordinal[1])?'2ND DUODENUM':'3RD DUODENUM';
  }
  if(!value && region==='esophagus' && part==='mid')value='MIDDLE';
  if(!value && VOCABULARY.includes(part.toUpperCase()))value=part.toUpperCase();
  if(!value)return null;
  mapped.push(value);
 }
 const prefix=region==='stomach'?'GASTRIC':region==='colonoscopy'?'':REGIONS.includes(region)?region.toUpperCase():duodenal?'DUODENUM':'';
 return modifiers([prefix,...mapped].filter(Boolean).join(';'));
}
