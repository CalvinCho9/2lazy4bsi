import {match} from '../utils/normalize';
export const isSurgicalPath = (value:string) => /\bnih\s+(?:surg(?:ical)?\s+)?path(?:ology)?\b/.test(match(value));
export const isStudyTeam = (value:string) => /\bstudy\s+team\b/.test(match(value));
export const retainEndoscopy = (container:string,destination:string) => isStudyTeam(container) && !isSurgicalPath(container) && !isSurgicalPath(destination);
