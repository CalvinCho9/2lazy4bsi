import {header,match} from '../utils/normalize';
import {isPHI} from '../security/sanitize';
import {ALIASES} from '../rules/config';
import {mapAnatomy,REGIONS,VOCABULARY} from '../rules/anatomy';
import type {Dataset} from './intake';
export const IMAGE_LOCATIONS = ['Proximal/mid','Distal','Body','Antrum','2nd and 3rd part','Terminal Ileum','Ascending','Descending',...VOCABULARY];
export const IMAGE_CONTAINERS = ['Study Team','NIH provided','Other'];
export const IMAGE_DESTINATIONS = ['BG 10 Lab','NIH surg path','Other'];
export type ImageRow = {id:number; region:string; location:string; container:string; destination:string};
export type ImageReview = {rows:ImageRow[]; removedPHI:number};
export type Pixels = {width:number;height:number;data:Uint8ClampedArray};
const dark = (image:Pixels,x:number,y:number) => {
 if(x<0||y<0||x>=image.width||y>=image.height)return false;
 const i=(y*image.width+x)*4;return image.data[i+3]>128 && image.data[i]<110 && image.data[i+1]<110 && image.data[i+2]<110;
};
function centers(values:number[]) {
 const groups:number[][]=[];
 for(const n of values) {if(!groups.length || n-groups[groups.length-1].at(-1)!>2)groups.push([]);groups.at(-1)!.push(n);}
 return groups.map(g=>Math.round((g[0]+g.at(-1)!)/2));
}
export function detectGrid(image:Pixels) {
 const horizontal:number[]=[];
 for(let y=0;y<image.height;y++) {let n=0;for(let x=0;x<image.width;x++)if(dark(image,x,y))n++;if(n>image.width*.6)horizontal.push(y);}
 const ys=centers(horizontal);
 if(ys.length<3 || ys.length>150)throw new Error('Use a clear, straight PNG with the full bordered table and its column headers.');
 const vertical:number[]=[];
 for(let x=0;x<image.width;x++) {let n=0;for(let y=ys[0]+3;y<ys[1]-3;y++)if(dark(image,x,y))n++;if(n>(ys[1]-ys[0]-6)*.75)vertical.push(x);}
 const xs=centers(vertical);
 if(xs.length<4 || xs.length>20)throw new Error('Column borders could not be identified. Use a clear PNG of the full table.');
 return {xs,ys};
}
export function hasBorder(image:Pixels,x:number,top:number,bottom:number) {
 let n=0,total=0;for(let y=top+5;y<bottom-5;y++){total++;if([-1,0,1].some(dx=>dark(image,x+dx,y)))n++;}
 return total>0 && n/total>.6;
}
export function approvedColumns(headers:string[]) {
 const keys=['Anatomical Location','Container','Going where?'];
 const indexes=keys.map(key=>headers.flatMap((text,i)=>!isPHI(text)&&ALIASES[key].includes(header(text))?[i]:[]));
 if(indexes.some(x=>x.length!==1))throw new Error('Image headers must clearly identify Anatomic Location, Container and Going where?. Try a sharper image or use a spreadsheet.');
 return {location:indexes[0][0],container:indexes[1][0],destination:indexes[2][0],removedPHI:headers.filter(isPHI).length};
}
// Only controlled labels leave OCR intake. Unknown raw OCR text is never previewed or retained.
export function classifyImageRow(id:number,region:string,location:string,container:string,destination:string):ImageRow {
 const l=match(location).replace(/\s*\/\s*/g,'/');
 return {id,region:REGIONS.includes(region)?region:'',location:IMAGE_LOCATIONS.find(x=>match(x)===l)??'',
 container:match(container).includes('study team')?'Study Team':match(container).includes('nih provided')?'NIH provided':'',
 destination:match(destination)==='bg 10 lab'?'BG 10 Lab':match(destination).includes('nih surg path')?'NIH surg path':match(destination)==='building 4'?'Other':''};
}
export function imageReviewProblem(rows:ImageRow[]):string {
 if(!rows.length)return 'Add at least one table row.';
 for(const row of rows){
  if(!IMAGE_CONTAINERS.includes(row.container)||!IMAGE_DESTINATIONS.includes(row.destination))return `Image row ${row.id}: resolve Container and Going where? before confirming.`;
  if(row.container==='Study Team'&&row.destination==='BG 10 Lab'&&(!REGIONS.includes(row.region)||!IMAGE_LOCATIONS.includes(row.location)||!mapAnatomy(row.region,row.location)))return `Image row ${row.id}: resolve its anatomical region and location before confirming.`;
 }
 return '';
}
export function imageDataset(review:ImageReview):Dataset {
 const problem=imageReviewProblem(review.rows);if(problem)throw new Error(problem);
 // Carry explicit, normalized anatomy per image row; edits cannot change a neighbor's region.
 const rows=review.rows.map(row=>({line:row.id,values:{
  'Anatomical Location':mapAnatomy(row.region,row.location)??row.location,
  Container:row.container,'Going where?':row.destination,
 }}));
 return {rows,originalRows:review.rows.length,removedPHI:review.removedPHI,columns:['Anatomical Location','Container','Going where?'],skippedRows:0};
}
