import {dateDrawn} from '../utils/normalize';
export type UserFields = {subject: string; drawn: string};
export function validateFields(fields: UserFields) {
 if (!fields.subject.trim()) throw new Error('Enter Subject ID.');
 if (/^[=+@\-\t\r\n]/.test(fields.subject) || /[\r\n\t]/.test(fields.subject)) throw new Error('Subject ID cannot contain spreadsheet formula prefixes, tabs or line breaks.');
 dateDrawn(fields.drawn);
}
export const safeSource = (value: string) => !/^[\s]*[=+@\-]/.test(value) && !/[\t\r]/.test(value);
