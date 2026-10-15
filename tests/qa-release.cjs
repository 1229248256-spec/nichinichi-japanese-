const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const c={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(dist,'content.js'),'utf8'),c);
vm.runInNewContext(fs.readFileSync(path.join(dist,'audio-data.js'),'utf8'),c);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/audio-sources.json'),'utf8'));
assert.equal(manifest.clips.length,Object.keys(c.window.BUNDLED_WORD_AUDIO).length);
for(const clip of manifest.clips){
 const embedded=c.window.BUNDLED_WORD_AUDIO[clip.id];assert(embedded,clip.id);
 const bytes=Buffer.from(embedded.dataUrl.split(',')[1],'base64');
 assert.equal(bytes.length,clip.bytes,clip.id);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),clip.sha256,clip.id);
 for(const field of ['word','reading','sourcePage','license'])assert.equal(embedded[field],clip[field],clip.id+' '+field);
 assert.match(clip.sourcePage,/^https:\/\/github\.com\/(tofugu|kanjialive)\//);
}
assert.equal(manifest.clips.filter(c=>c.license==='CC BY-SA 4.0').length,219);
assert.equal(manifest.clips.filter(c=>c.license==='CC BY 4.0').length,1);
const data=JSON.parse(fs.readFileSync(path.join(dist,'vocabulary-data.json'),'utf8'));
assert.equal(JSON.stringify(c.window.STUDY_DATA.vocabulary),JSON.stringify(data.vocabulary));
const files=fs.readdirSync(dist);
for(const name of files.filter(x=>/\.(js|html|json|md|webmanifest)$/.test(x))){
 const content=fs.readFileSync(path.join(dist,name),'utf8');
 assert(!/高考日语\s*\d+|四级\s*\d+(?:\.\d+)?|[A-Z]:[\\/](?:Users|Documents)[\\/]|[a-z0-9-]+\.chatgpt\.site|appgprj_|appgdep_|自動化工学|自动化工程/.test(content),name+' contains private context');
}
for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md','README.md','CONTRIBUTING.md'])assert(fs.statSync(path.join(root,name)).size>100);
console.log('PASS public distribution: audio hashes and credits, vocabulary parity, redacted app context, license files');
