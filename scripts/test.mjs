import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
fs.mkdirSync(new URL('../tests/.reports/',import.meta.url),{recursive:true});
const suites=['qa-static.cjs','qa-vocabulary.cjs','qa-academy.cjs','qa-word-audio.cjs','qa-mobile.cjs','qa-release.cjs'];
let failed=false;
for(const suite of suites){
 const result=spawnSync(process.execPath,['tests/'+suite],{cwd:root,stdio:'inherit'});
 if(result.status!==0){failed=true;if(result.error)console.error(result.error);}
}
if(failed)process.exitCode=1;
