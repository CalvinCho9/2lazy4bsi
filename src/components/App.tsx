import ImageReview from './ImageReview';
import {imageDataset,type ImageReview as ImageReviewData} from '../parsers/imageTable';
import {useEffect,useRef,useState} from 'react';
import {fieldKind,LIMITS,SCHEMAS,type Workflow} from '../rules/config';
import {VOCABULARY} from '../rules/anatomy';
import {parseBytes,type IntakeResult} from '../parsers/intake';
import {transform,type Result} from '../transformers/transform';
import {localISO} from '../utils/normalize';
import {toCSV,toExcel} from '../utils/csv';
const warning = 'IMPORTANT: If you have a vial that has less fragments and thus will be using less cryovials, make sure to delete the respective row manually in BSI.';
export default function App() {
 const [workflow,setWorkflow]=useState<Workflow|null>(null);
 const [intake,setIntake]=useState<IntakeResult|null>(null);
 const [imageReview,setImageReview]=useState<ImageReviewData|null>(null);
 const [imageConfirmed,setImageConfirmed]=useState(false);
 const imageAbort=useRef<AbortController|null>(null);
 const [sheet,setSheet]=useState(0);
 const [subject,setSubject]=useState(''); const [drawn,setDrawn]=useState('');
 const [resolutions,setResolutions]=useState<Record<number,string>>({});
 const [drafts,setDrafts]=useState<Record<number,string[]>>({});
 const [error,setError]=useState(''); const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false); const [generated,setGenerated]=useState(false);
 const [page,setPage]=useState(0); const token=useRef(0); const fileInput=useRef<HTMLInputElement>(null);
 function clear() {token.current++;imageAbort.current?.abort();imageAbort.current=null;setImageReview(null);setImageConfirmed(false);setIntake(null);setSheet(0);setSubject('');setDrawn('');setResolutions({});setDrafts({});setError('');setStatus('');setBusy(false);setGenerated(false);setPage(0);if(fileInput.current)fileInput.current.value='';}
 useEffect(()=>{const release=()=>clear();window.addEventListener('pagehide',release);return()=>window.removeEventListener('pagehide',release);},[]);
 const dataset=intake?.sheets[sheet];
 let result: Result|null=null; let validation='';
 if(dataset && workflow && (workflow === 'Frederick' || (subject && drawn))) {try {result=transform(dataset,workflow,{subject,drawn},resolutions);}catch{validation='Enter a valid Subject ID and Date Drawn. Formula prefixes, tabs and line breaks are not allowed in Subject ID.';}}
 const ready=(!imageReview || imageConfirmed) && !!result && result.rows.length>0 && result.issues.length===0;
 const csv=generated && ready && workflow ? toCSV(workflow,result!.rows):'';
 function changed() {setGenerated(false);setStatus('');setPage(0);}
 async function upload(file?:File) {
  clear();if(!file || !workflow)return;
  const current=token.current;
  const png=workflow==='Endoscopy' && /\.png$/i.test(file.name);
  if((!png && !/\.(csv|xlsx|xls)$/i.test(file.name)) || file.size>LIMITS.bytes){setError('Choose a supported file up to 20 MB. PNG images are supported for Endoscopy.');return;}
  setBusy(true);
  try {
   if(png){
    const controller=new AbortController();imageAbort.current=controller;
    const {parsePNG}=await import('../parsers/png');
    if(current!==token.current)return;
    const review=await parsePNG(file,controller.signal,message=>{if(current===token.current)setStatus(message);});
    if(current!==token.current)return;
    setImageReview(review);setStatus('Local image reading complete. Review and confirm every row.');return;
   }
   const data=await file.arrayBuffer();if(current!==token.current)return;const parsed=parseBytes(data,workflow,/\.csv$/i.test(file.name)?'csv':'excel');setIntake(parsed);setStatus('File read and sanitized locally.');}
  catch(e){if(current===token.current)setError(e instanceof Error ? e.message : 'Unable to read this file.');}
  finally {if(current===token.current)setBusy(false);}
 }
 async function copy() {try{await navigator.clipboard.writeText(csv);setStatus('Complete CSV copied to clipboard.');}catch{setStatus('Clipboard access is unavailable. Use Download CSV or select and copy the complete text below.');}}
 function downloadExcel(){
  if(!workflow || !result || !csv)return;
  const url=URL.createObjectURL(new Blob([toExcel(workflow,result.rows)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a');a.href=url;a.download=`${workflow.toUpperCase()}_BSI_IMPORT_${localISO()}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Excel download requested. Dates are stored as MM/DD/YYYY text.');
 }
 function download(){const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${workflow!.toUpperCase()}_BSI_IMPORT_${localISO()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('CSV download requested.');}
 return <main>
  <header><div className="eyebrow">RESEARCH OPERATIONS / SPECIMEN UTILITIES</div><h1>BSI Data Preparation</h1><p>Secure browser-based transformation for Frederick and Endoscopy specimen data.</p></header>
  <aside className="privacy"><strong>Local processing</strong><span>Your file is processed locally in your browser and is not uploaded to this application.</span><small>No accounts, analytics or specimen storage. Reset clears the current session.</small></aside>
  <nav aria-label="Choose workflow" className="choices">{(['Frederick','Endoscopy'] as Workflow[]).map(w=><button key={w} aria-pressed={workflow===w} onClick={()=>{clear();setWorkflow(w);}}><strong>{w}</strong><span>{w==='Frederick'?'Shipping manifests · material grouping':'Biopsy specimens · anatomical mapping'}</span></button>)}</nav>
  {!workflow?<p className="welcome">Choose a workflow to prepare your BSI import.</p>:<>
   <div className="toolbar"><h2>{workflow} preparation</h2><button onClick={clear}>Reset / Clear file</button></div>
   <section><h3><b>1</b> Upload</h3><label htmlFor="upload">{workflow==='Endoscopy'?'Source spreadsheet or PNG':'Source spreadsheet'}</label><input ref={fileInput} id="upload" type="file" accept={workflow==='Endoscopy'?'.csv,.xlsx,.xls,.png':'.csv,.xlsx,.xls'} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(file);}}/><p className="hint">{workflow==='Endoscopy'?'CSV, XLSX, XLS or PNG':'CSV, XLSX or XLS'} · up to 20 MB · one specimen per source row. File names are not retained.</p>{busy&&<p role="status">Reading and sanitizing…</p>}{intake && intake.sheets.length>1&&<label>Worksheet with recognized headers<select value={sheet} onChange={e=>{setSheet(Number(e.target.value));setResolutions({});changed();}}>{intake.sheets.map((_,i)=><option key={i} value={i}>Recognized worksheet {i+1}</option>)}</select></label>}{dataset&&<p className="success">{dataset.removedPHI} potentially identifying columns removed before processing.</p>}</section>
   {imageReview&&<ImageReview review={imageReview} confirmed={imageConfirmed} onChange={review=>{setImageReview(review);setImageConfirmed(false);setIntake(null);setResolutions({});setDrafts({});changed();}} onConfirm={()=>{setIntake({sheets:[imageDataset(imageReview)]});setImageConfirmed(true);changed();}}/>}
   <section><h3><b>2</b> {workflow==='Frederick'?'Source Fields':'Enter Required Fields'}</h3>{workflow==='Frederick'?<p>Excel workbooks use the Klion worksheet automatically. Subject ID and Date Drawn come from each specimen row. CSV files must contain these same columns.</p>:<div className="fields"><label>Subject ID<input autoComplete="off" value={subject} onChange={e=>{setSubject(e.target.value);changed();}} disabled={!dataset}/></label><label>Date Drawn<input type="date" value={drawn} onChange={e=>{setDrawn(e.target.value);changed();}} disabled={!dataset}/></label></div>}<p className="hint">Fields assigned by BSI are intentionally left blank. After pasting the complete block into BSI, use the normal BSI assignment functions for those fields.</p>{workflow==='Frederick'&&<p className="hint">Volume and Volume Unit come from each source row when present. Missing values stay blank; invalid volumes must be corrected in the source file.</p>}</section>
   <section><h3><b>3</b> Review Transformation</h3>{!result?<p>{workflow==='Frederick'?'Upload the Klion workbook or its CSV export to preview the result.':'Upload a file and enter the required fields to preview the result.'}</p>:<>
    <dl className="stats"><div><dt>Original rows</dt><dd>{dataset!.originalRows}</dd></div><div><dt>Usable specimen rows</dt><dd>{result.rows.length+result.issues.length}</dd></div><div><dt>PHI columns removed</dt><dd>{dataset!.removedPHI}</dd></div><div><dt>{workflow==='Frederick'?'Slide rows removed':'Section / unmatched rows'}</dt><dd>{workflow==='Frederick'?result.slides:result.excluded}</dd></div><div><dt>Final output rows</dt><dd>{result.rows.length}</dd></div></dl>
    {result.groups.length>0&&<p>Material groups: {result.groups.map(([name,count])=>`${name} (${count})`).join(' · ')}</p>}
    {result.issues.length>0&&<div className="errors" role="alert"><strong>Export blocked: resolve {result.issues.length} row(s).</strong>{result.issues.map(issue=><div key={issue.line}><p>Row {issue.line}: {issue.message}</p>{workflow==='Endoscopy'&&<div><label>Approved anatomy entities for row {issue.line}<select value="" onChange={e=>{if(e.target.value)setDrafts({...drafts,[issue.line]:[...new Set([...(drafts[issue.line]??[]),e.target.value])]});}}><option value="">Add an entity in output order…</option>{VOCABULARY.map(x=><option key={x}>{x}</option>)}</select></label><p>{(drafts[issue.line]??[]).join('; ') || 'No entities selected.'}</p><button onClick={()=>setDrafts({...drafts,[issue.line]:[]})}>Clear selection</button> <button disabled={!drafts[issue.line]?.length} onClick={()=>{setResolutions({...resolutions,[issue.line]:drafts[issue.line].join(';')});changed();}}>Apply anatomy for row {issue.line}</button></div>}</div>)}</div>}
    {workflow==='Endoscopy'&&Object.keys(resolutions).length>0&&<div><h4>Manual anatomy resolutions</h4>{Object.entries(resolutions).map(([line,value])=><p key={line}>Row {line}: {value} <button onClick={()=>{const next={...resolutions};delete next[Number(line)];setResolutions(next);changed();}}>Undo</button></p>)}</div>}
    <p className="legend">{['BSI assigns later','User provided','Generated','From source'].map(x=><span key={x}>{x}</span>)}</p>
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Final BSI dataset preview"><table><thead><tr>{SCHEMAS[workflow].map(h=><th key={h}>{h}<small>{fieldKind(workflow,h)}</small></th>)}</tr></thead><tbody>{result.rows.slice(page*100,(page+1)*100).map((row,i)=><tr key={i}>{SCHEMAS[workflow].map(h=><td key={h} className={fieldKind(workflow,h)==='BSI assigns later'?'assigned':''}>{row[h] || <span className="empty" aria-label="Empty field">—</span>}</td>)}</tr>)}</tbody></table></div>
    <div className="pagination"><button disabled={page===0} onClick={()=>setPage(page-1)}>Previous</button><span>Preview rows {result.rows.length? page*100+1:0}–{Math.min((page+1)*100,result.rows.length)} of {result.rows.length}</span><button disabled={(page+1)*100>=result.rows.length} onClick={()=>setPage(page+1)}>Next</button></div><p className="hint">Dashes indicate empty cells in this preview only. Export includes every row and preserves empty fields.</p>
   </>}</section>
   <section><h3><b>4</b> Generate BSI CSV</h3>{workflow==='Endoscopy'&&<p className="warning">{warning}</p>}<button className="primary" disabled={!ready} onClick={()=>{setGenerated(true);setStatus('Complete BSI CSV generated.');}}>Generate BSI CSV</button>{result&&!result.rows.length&&!result.issues.length&&<p>No qualifying specimen rows were found.</p>}</section>
   <section><h3><b>5</b> Copy / Download</h3><div className="actions"><button disabled={!csv} onClick={()=>void copy()}>Copy CSV to Clipboard</button><button className={workflow==='Frederick'?undefined:'primary'} disabled={!csv} onClick={download}>Download CSV</button><button className={workflow==='Frederick'?'primary':undefined} disabled={!csv} onClick={downloadExcel}>Download Excel (text dates)</button></div><p className="hint">Use CSV for direct BSI import. For opening in Excel or copying cells from Excel, use the Excel download to preserve MM/DD/YYYY dates and leading zeroes.</p>{csv&&<label>Complete CSV text<textarea readOnly value={csv} rows={7} spellCheck={false}/></label>}</section>
  </>}
  {(error||validation)&&<p className="errors" role="alert">{error||validation}</p>}<p role="status" aria-live="polite">{status}</p>
  <footer>BSI assigns the blank managed fields. Review the complete output before importing.<br/>Header-based sanitization cannot detect identifying information entered into specimen fields. Clipboard and downloaded files remain under your control.</footer>
 </main>;
}
