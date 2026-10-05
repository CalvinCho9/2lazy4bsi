import {mkdir,copyFile,readdir} from 'node:fs/promises';
const target='public/ocr';
await mkdir(target,{recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js',`${target}/worker.min.js`);
await copyFile('node_modules/tesseract.js/LICENSE.md',`${target}/tesseract-LICENSE.md`);
await copyFile('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt',`${target}/worker.LICENSE.txt`);
for(const file of await readdir('node_modules/tesseract.js-core')) {
 if(file.endsWith('.wasm.js') || file.endsWith('.wasm') || file==='LICENSE') await copyFile(`node_modules/tesseract.js-core/${file}`,`${target}/${file}`);
}
await copyFile('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',`${target}/eng.traineddata.gz`);
