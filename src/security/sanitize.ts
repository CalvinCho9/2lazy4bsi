import {PHI_DENYLIST} from '../rules/config';
import {header} from '../utils/normalize';
export const isPHI = (value: unknown) => PHI_DENYLIST.some(term => header(value).includes(term) || header(value).replace(/ /g,'').includes(term.replace(/ /g,'')));
// Only approved fields cross the intake boundary; unknown columns and preambles are discarded.
export function safeColumnIndexes(headers: unknown[], allowed: string[]) {
 return headers.flatMap((value,index) => !isPHI(value) && allowed.includes(header(value)) ? [index] : []);
}
