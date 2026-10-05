export const whitespace = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ');
export const header = (value: unknown): string => whitespace(value).toLowerCase().replace(/[_\W]+/g, ' ').trim();
export const match = (value: unknown): string => whitespace(value).replace(/[*§†‡]/g, '').trim().toLowerCase();
export const blankRow = (row: unknown[]) => row.every(value => whitespace(value) === '');
export const modifiers = (value: string): string => [...new Set(value.split(';').map(x => x.trim()).filter(Boolean))].join('; ');
export function localISO(date = new Date()): string {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function dateDrawn(value: string): string {
 const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 if (!m) throw new Error('Enter a valid Date Drawn.');
 const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
 if (localISO(d) !== value) throw new Error('Enter a valid Date Drawn.');
 return `${m[2]}/${m[3]}/${m[1]}`;
}
export function received(date = new Date()): string {return `${dateDrawn(localISO(date))} 00:00`;}
