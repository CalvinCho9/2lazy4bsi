import {describe,it,expect} from 'vitest';
import {approvedColumns,classifyImageRow,detectGrid,imageDataset,imageReviewProblem,type ImageRow} from '../parsers/imageTable';
import {transform} from '../transformers/transform';
const row:ImageRow={id:1,region:'esophagus',location:'Proximal/mid',container:'Study Team',destination:'BG 10 Lab'};
describe('PNG privacy and review',()=>{
 it('requires exact allowed header matches and detects PHI columns',()=>{
  expect(approvedColumns(['Anatomic Location','MRN','Container','First Name','Going where?'])).toEqual({location:0,container:2,destination:4,removedPHI:2});
  expect(()=>approvedColumns(['Patient name','Container','Going where?'])).toThrow();
  expect(()=>approvedColumns(['Anatomic Location','Container','Container','Going where?'])).toThrow();
 });
 it('discards all unrecognized OCR strings instead of exposing them',()=>{
  const result=classifyImageRow(1,'SECRET_REGION','SECRET_PATIENT','SECRET_CONTAINER','SECRET_DESTINATION');
  expect(JSON.stringify(result)).not.toContain('SECRET');expect(result).toEqual({id:1,region:'',location:'',container:'',destination:''});
 });
 it('retains only normalized controlled labels from recognized source cells',()=>{
  expect(classifyImageRow(1,'esophagus','Proximal / mid','Study team § media (4 OCT)','BG 10 LAB')).toEqual(row);
 });
 it('requires explicit decisions for unknown routing and retained anatomy',()=>{
  expect(imageReviewProblem([{...row,container:''}])).toContain('Container');
  expect(imageReviewProblem([{...row,location:''}])).toContain('anatomical');
  expect(imageReviewProblem([{...row,destination:''}])).toBe('');
 });
 it('keeps Study Team specimens across destinations and excludes NIH without multiplying fragments',()=>{
  const review={removedPHI:0,rows:[row,{...row,id:2},classifyImageRow(3,'duodenum','2nd and 3rd part','Study Team RNAlater','Building 4'),{...row,id:4,container:'NIH provided',destination:'NIH surg path'},{...row,id:5,region:'colonoscopy',location:'Terminal Ileum'}]};
  const dataset=imageDataset(review);expect(dataset.rows).toHaveLength(5);
  const result=transform(dataset,'Endoscopy',{subject:'TEST',drawn:'2026-10-05'});
  expect(result.rows.map(r=>r['Material Modifiers'])).toEqual(['ESOPHAGUS; PROXIMAL; MIDDLE','ESOPHAGUS; PROXIMAL; MIDDLE','DUODENUM; 2ND DUODENUM; 3RD DUODENUM','ILEUM; TERMINAL']);expect(result.excluded).toBe(1);
 });
 it('rejects images without a clear bordered table',()=>expect(()=>detectGrid({width:500,height:200,data:new Uint8ClampedArray(500*200*4)})).toThrow('bordered table'));
});

it('automatically recognizes combined OCR anatomy and accepts multiple explicit corrections',()=>{
 const recognized=classifyImageRow(1,'duodenum','2nd & 3rd part','Study Team','BG 10 Lab');
 expect(recognized.location).toBe('DUODENUM; 2ND DUODENUM; 3RD DUODENUM');
 const review={removedPHI:0,rows:[{...recognized,modifiers:['2ND DUODENUM','3RD DUODENUM']}]};
 expect(imageReviewProblem(review.rows)).toBe('');
 expect(transform(imageDataset(review),'Endoscopy',{subject:'TEST',drawn:'2026-10-05'}).rows[0]['Material Modifiers']).toBe('2ND DUODENUM; 3RD DUODENUM');
 expect(imageReviewProblem([{...recognized,modifiers:[]}])).toContain('anatomical');
});
