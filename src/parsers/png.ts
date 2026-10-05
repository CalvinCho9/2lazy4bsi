import {createWorker,OEM,PSM,type Worker} from 'tesseract.js';
import {approvedColumns,classifyImageRow,detectGrid,hasBorder,type ImageReview} from './imageTable';
import {match} from '../utils/normalize';
import {REGIONS} from '../rules/anatomy';
const FAILURE='Unable to read this PNG locally. Use a clear, straight image of the full bordered table, or upload a spreadsheet.';
export async function parsePNG(file:File,signal:AbortSignal,progress:(message:string)=>void):Promise<ImageReview> {
 let worker:Worker|undefined;
 let canvas:HTMLCanvasElement|undefined;
 let crop:HTMLCanvasElement|undefined;
 let bitmap:ImageBitmap|undefined;
 let pixels:ImageData|undefined;
 let stopped=false;
 let rejectAbort:(reason:Error)=>void=()=>{};
 const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
 const cancel=()=>{stopped=true;void worker?.terminate();rejectAbort(new Error('Image reading cancelled.'));};
 signal.addEventListener('abort',cancel,{once:true});
 const timeout=setTimeout(cancel,120000);
 const check=()=>{if(signal.aborted)throw new Error('Image reading cancelled.');};
 const race=<T,>(promise:Promise<T>)=>Promise.race([promise,aborted]);
 try {
  check();
  const bytes=new Uint8Array(await race(file.slice(0,24).arrayBuffer()));
  const signature=[137,80,78,71,13,10,26,10];
  if(bytes.length<24 || signature.some((n,i)=>bytes[i]!==n))throw new Error(FAILURE);
  const view=new DataView(bytes.buffer);const w=view.getUint32(16);const h=view.getUint32(20);
  if(w<300 || h<100 || w>6000 || h>6000 || w*h>16000000)throw new Error('Use a PNG between 300 × 100 and 6,000 × 6,000 pixels, up to 16 million pixels.');
  bitmap=await race(createImageBitmap(file).then(value=>{if(stopped){value.close();throw new Error('Image reading cancelled.');}return value;}));check();
  canvas=document.createElement('canvas');canvas.width=bitmap!.width;canvas.height=bitmap!.height;
  const context=canvas.getContext('2d',{willReadFrequently:true})!;
  context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap!,0,0);bitmap!.close();bitmap=undefined;
  pixels=context.getImageData(0,0,canvas.width,canvas.height);
  const {xs,ys}=detectGrid(pixels);
  progress('Loading local OCR engine…');
  const base=new URL('./ocr/',document.baseURI).href;
  worker=await race(createWorker('eng',OEM.LSTM_ONLY,{workerPath:base+'worker.min.js',corePath:base,langPath:base,workerBlobURL:false,cacheMethod:'none',logger:()=>{},errorHandler:()=>{}}).then(async value=>{if(stopped){await value.terminate();throw new Error('Image reading cancelled.');}return value;}));
  await race(worker!.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,user_defined_dpi:'300'}));
  crop=document.createElement('canvas');
  async function readCell(column:number,top:number,bottom:number):Promise<string> {
   check();
   const left=xs[column]+4;const right=xs[column+1]-4;
   if(right<=left || bottom-top<12)throw new Error(FAILURE);
   crop!.width=(right-left)*2+20;crop!.height=(bottom-top-8)*2+20;
   const c=crop!.getContext('2d',{willReadFrequently:true})!;c.fillStyle='white';c.fillRect(0,0,crop!.width,crop!.height);
   c.drawImage(canvas!,left,top+4,right-left,bottom-top-8,10,10,(right-left)*2,(bottom-top-8)*2);
   const p=c.getImageData(0,0,crop!.width,crop!.height);
   for(let i=0;i<p.data.length;i+=4){const value=(p.data[i]+p.data[i+1]+p.data[i+2])/3<140?0:255;p.data[i]=p.data[i+1]=p.data[i+2]=value;}
   c.putImageData(p,0,0);
   const result=await race(worker!.recognize(crop!,{}, {text:true}));
   return result.data.confidence>=45?result.data.text.trim():'';
  }
  const headers:string[]=[];
  for(let i=0;i<xs.length-1;i++)headers.push(await readCell(i,ys[0],ys[1]));
  const columns=approvedColumns(headers);headers.fill('');
  const rows:ImageReview['rows']=[];let region='';
  for(let i=1;i<ys.length-1;i++) {
   check();progress(`Reading table band ${i} of ${ys.length-2} locally…`);
   const top=ys[i],bottom=ys[i+1];
   if(!hasBorder(pixels!,xs[0],top,bottom))continue; // gap between tables
   const location=await readCell(columns.location,top,bottom);
   if(!hasBorder(pixels!,xs[columns.location+1],top,bottom)) {
    const section=match(location);region=REGIONS.includes(section)?section:'';continue;
   }
   rows.push(classifyImageRow(rows.length+1,region,location,await readCell(columns.container,top,bottom),await readCell(columns.destination,top,bottom)));
  }
  if(!rows.length)throw new Error(FAILURE);
  return {rows,removedPHI:columns.removedPHI};
 } catch(error) {
  // Never surface worker errors or OCR text: both may contain image contents.
  if(signal.aborted)throw new Error('Image reading cancelled.');
  const message=error instanceof Error?error.message:'';
  if(/^(Use a |Column borders|Image headers)/.test(message))throw new Error(message);
  throw new Error(FAILURE);
 } finally {
  stopped=true;pixels?.data.fill(0);
  clearTimeout(timeout);signal.removeEventListener('abort',cancel);
  await worker?.terminate();bitmap?.close();
  if(canvas){canvas.width=0;canvas.height=0;}if(crop){crop.width=0;crop.height=0;}
 }
}
