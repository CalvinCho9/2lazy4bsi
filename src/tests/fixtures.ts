export const frederick = [
 ['Synthetic shipping manifest'],
 ['Box','row','col','scan','match','Date Drawn','M#','Sample ID','Sequence','BSI ID','MRN','Subject ID','Last Name','First Name','Protocol ID','Sample From','Material Type','Material Modifier','Volume','Volume Unit','label mattype','Comments'],
 ...['Mononuclear Cells','Plasma','Serum','Plasma','RNA-Cell','Serum',' Slide '].map((material,i)=>['B1','1','1','','','2026-10-01','','old sample','old seq','old bsi','SECRET_MRN',`TEST-SUBJECT-${i}`,'SECRET_LAST','SECRET_FIRST','','',material,`modifier ${i}`,'0.5','ml','','SECRET_COMMENT']),
 [],
];
export const endoscopy = [
 ['Synthetic endoscopy worksheet'],
 ['Anatomical Location','No. Passes','Fragments','Container','Going where?','Protocol','MRN','First Name'],
 ['ESOPHAGUS'],
 ['Proximal/mid',1,2,'Study team §','BG 10 LAB','','SECRET_MRN','SECRET_FIRST'],
 ['Distal',1,2,'Study Team','BG 10 Lab'],
 ['Distal',1,2,'NIH provided*','NIH surg path*'],
 ['STOMACH'],['Body',1,2,'Study Team','BG 10 Lab'],['Antrum',1,2,'Study Team','BG 10 Lab'],
 ['DUODENUM'],['2nd and 3rd part',1,2,'Study Team','BG 10 Lab'],
 ['COLONOSCOPY'],['Terminal Ileum',1,2,'Study Team','BG 10 Lab'],['Ascending',1,2,'Study Team','BG 10 Lab'],['Descending',1,2,'Study Team','BG 10 Lab'],[],
];
