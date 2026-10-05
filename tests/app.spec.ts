import {test,expect} from '@playwright/test';
import * as XLSX from 'xlsx';
import {endoscopy} from '../src/tests/fixtures';
test('Frederick upload, review, clipboard, download, reset and no network or storage',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto('/');
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.getByRole('button',{name:/Frederick/}).click();
 await page.getByLabel(/Source spreadsheet/).setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('Material Type,Material Modifier,MRN,First Name,Subject ID,Date Drawn\nPlasma,Frozen,SECRET,SECRET,TEST-001,2026-10-05\nSlide,,SECRET,SECRET,,\nSerum,,SECRET,SECRET,TEST-002,10/04/2026\nPlasma,,SECRET,SECRET,TEST-003,2026-10-03')});
 await expect(page.getByText('2 potentially identifying columns removed before processing.')).toBeVisible();
 await expect(page.getByLabel('Subject ID',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('cell',{name:'Plasma',exact:true})).toHaveCount(2);
 await expect(page.locator('body')).not.toContainText('SECRET');
 await page.getByRole('button',{name:'Generate BSI CSV',exact:true}).click();
 await page.getByRole('button',{name:'Copy CSV to Clipboard'}).click();
 const csv=await page.getByLabel('Complete CSV text').inputValue();expect((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n')).toBe(csv);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV'}).click();expect((await download).suggestedFilename()).toMatch(/^FREDERICK_BSI_IMPORT_/);
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length,cookies:document.cookie}))).toEqual({local:0,session:0,cookies:''});
 expect(requests).toEqual([]);
 await page.getByRole('button',{name:'Reset / Clear file'}).click();await expect(page.getByLabel('Subject ID',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Complete CSV text')).toHaveCount(0);
});
test('Endoscopy XLSX and controlled anatomy resolution',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Endoscopy/}).click();
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([...endoscopy,['Unknown region',1,2,'Study Team','BG 10 Lab']]),'Test');
 await page.getByLabel(/Source spreadsheet/).setInputFiles({name:'test.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(book,{type:'buffer',bookType:'xlsx'})});
 await page.getByLabel('Subject ID',{exact:true}).fill('TEST-002');await page.getByLabel('Date Drawn',{exact:true}).fill('2026-10-05');
 await expect(page.getByRole('button',{name:'Generate BSI CSV',exact:true})).toBeDisabled();
 const selector=page.getByLabel(/Approved anatomy entities/);await selector.selectOption('ILEUM');await selector.selectOption('TERMINAL');
 await page.getByRole('button',{name:/Apply anatomy for row/}).click();
 await expect(page.getByRole('button',{name:'Generate BSI CSV',exact:true})).toBeEnabled();
 await expect(page.getByText(/IMPORTANT: If you have a vial/)).toBeVisible();
 await page.getByRole('button',{name:'Generate BSI CSV',exact:true}).click();expect(await page.getByLabel('Complete CSV text').inputValue()).toContain('ILEUM; TERMINAL');
 await page.getByRole('button',{name:/Frederick/}).click();await expect(page.getByLabel('Subject ID',{exact:true})).toHaveCount(0);
});
test('Frederick uses Klion and previews each source subject and date without manual inputs',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Frederick/}).click();
 const book=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Material Type','Subject ID','Date Drawn'],['Plasma','WRONG-SHEET','2026-01-01']]),'Other');
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Material Type','Subject ID','Date Drawn'],['Serum','001',46300],['Plasma','002','10/04/2026']]),'Klion');
 await page.getByLabel(/Source spreadsheet/).setInputFiles({name:'multi.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(book,{type:'buffer',bookType:'xlsx'})});
 await expect(page.getByRole('cell',{name:'001',exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:'10/05/2026',exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:'10/04/2026',exact:true})).toBeVisible();
 await expect(page.getByLabel('Subject ID',{exact:true})).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('WRONG-SHEET');
 await expect(page.getByRole('button',{name:'Generate BSI CSV',exact:true})).toBeEnabled();
});
test('PNG OCR stays local, strips unknown values and requires review before output',async({page,context})=>{
 test.setTimeout(120000);
 await page.goto('/');
 // Synthetic fixture drawn in the browser: no reference image or patient data in the repository.
 const encoded=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=520;const c=canvas.getContext('2d')!;
  c.fillStyle='white';c.fillRect(0,0,1800,520);c.font='bold 25px Arial';
  const xs=[20,370,570,1020,1340,1780],ys=[20,80,140,200,260,320,380,440];
  const cells=[['Anatomic Location','Fragments','Container','Going where?','MRN'],['Esophagus'],['Proximal/mid','2','Study Team','BG 10 Lab','SECRET_IDENTIFIER'],['Distal','2','NIH provided','NIH surg path','SECRET_IDENTIFIER'],['Duodenum'],['2nd and 3rd part','2','Study Team','Building 4','SECRET_IDENTIFIER'],['UNKNOWN_PRIVATE','2','Study Team','BG 10 Lab','SECRET_IDENTIFIER']];
  c.strokeStyle='black';c.lineWidth=2;c.fillStyle='black';
  for(let i=0;i<cells.length;i++){
   c.strokeRect(xs[0],ys[i],xs.at(-1)!-xs[0],60);
   if(cells[i].length>1)for(const x of xs.slice(1,-1)){c.beginPath();c.moveTo(x,ys[i]);c.lineTo(x,ys[i+1]);c.stroke();}
   cells[i].forEach((text,j)=>c.fillText(text,xs[j]+12,ys[i]+39));
  }
  return canvas.toDataURL('image/png').split(',')[1];
 });
 const requests:{url:string;method:string;body:boolean}[]=[];
 context.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()!==null}));
 await page.getByRole('button',{name:/Endoscopy/}).click();
 await page.getByLabel(/Source spreadsheet/).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(encoded,'base64')});
 await expect(page.getByRole('region',{name:'PNG extraction review'})).toBeVisible({timeout:90000});
 await expect(page.locator('[aria-label="PNG extraction review"] tbody tr')).toHaveCount(4);
 await expect(page.locator('body')).not.toContainText('SECRET_IDENTIFIER');
 await expect(page.locator('body')).not.toContainText('UNKNOWN_PRIVATE');
 await expect(page.getByRole('button',{name:'Generate BSI CSV',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:/I checked every image row/})).toBeDisabled();
 await page.getByLabel('Location for image row 4',{exact:true}).selectOption('2nd and 3rd part');
 await page.getByRole('button',{name:/I checked every image row/}).click();
 await page.getByLabel('Subject ID',{exact:true}).fill('TEST-PNG');await page.getByLabel('Date Drawn',{exact:true}).fill('2026-10-05');
 await page.getByRole('button',{name:'Generate BSI CSV',exact:true}).click();
 const csv=await page.getByLabel('Complete CSV text').inputValue();expect(csv.trim().split('\n')).toHaveLength(3);expect(csv).toContain('DUODENUM; 2ND DUODENUM; 3RD DUODENUM');expect(csv).not.toContain('SECRET');
 expect(requests.length).toBeGreaterThan(0);
 for(const r of requests){expect(r.method).toBe('GET');expect(r.body).toBe(false);const url=new URL(r.url);expect(url.origin).toBe('http://127.0.0.1:4173');expect(url.search).toBe('');expect(url.pathname).toMatch(/^\/(assets|ocr)\//);}
 expect(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,db:(await indexedDB.databases()).length}))).toEqual({local:0,session:0,db:0});
 // Editing invalidates confirmation and previously generated CSV.
 await page.getByLabel('Destination for image row 1',{exact:true}).selectOption('Other');
 await expect(page.getByLabel('Complete CSV text')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Generate BSI CSV',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Reset / Clear file'}).click();await expect(page.getByRole('region',{name:'PNG extraction review'})).toHaveCount(0);
 // Hold OCR initialization to verify reset invalidates in-flight image reads.
 let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/ocr/worker.min.js',async route=>{await held;await route.continue();});
 const initializing=page.waitForRequest('**/ocr/worker.min.js');
 await page.getByLabel(/Source spreadsheet/).setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(encoded,'base64')});
 await initializing;
 await page.getByRole('button',{name:'Reset / Clear file'}).click();
 release();
 await expect(page.getByRole('region',{name:'PNG extraction review'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Generate BSI CSV',exact:true})).toBeDisabled();
 await expect(page.locator('[role=status]')).toHaveText('');
});
