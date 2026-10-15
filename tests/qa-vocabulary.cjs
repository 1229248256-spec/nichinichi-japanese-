/* Independent vocabulary regression checks. Node VM fixtures, not a real browser. */
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixturePath=path.join(__dirname,'qa-static.cjs');
let fixture=fs.readFileSync(fixturePath,'utf8').split('function test(name,fn)')[0];
assert(fixture.includes('function harness('),'Existing VM harness must be available');
fixture=fixture.replace('return {run:',"return {input(id,value){for(const fn of events.input||[])fn({target:{id,value}});},run:");
const fixtureModule=new Module(fixturePath,module);
fixtureModule.filename=fixturePath;
fixtureModule.paths=module.paths;
fixtureModule._compile(fixture+'\nmodule.exports=harness;',fixturePath);
const harness=fixtureModule.exports;
const results=[];
const clone=value=>JSON.parse(JSON.stringify(value));
const tuesday='2026-10-13T10:00:00+08:00';
const h=harness(tuesday);
const words=clone(h.run('DATA.vocabulary'));
const original=[
 ['f-v01','予定','よてい'],['f-v02','約束','やくそく'],['f-v03','間に合う','まにあう'],['f-v04','準備','じゅんび'],
 ['f-v05','続ける','つづける'],['f-v06','比べる','くらべる'],['f-v07','確かめる','たしかめる'],['f-v08','必要','ひつよう'],
 ['f-v09','慣れる','なれる'],['f-v10','途中','とちゅう'],['f-v11','原因','げんいん'],['f-v12','復習','ふくしゅう'],
 ['n-v01','改善','かいぜん'],['n-v02','維持','いじ'],['n-v03','傾向','けいこう'],['n-v04','影響','えいきょう'],
 ['n-v05','対応','たいおう'],['n-v06','判断','はんだん'],['n-v07','効率','こうりつ'],['n-v08','実施','じっし'],
 ['n-v09','調整','ちょうせい'],['n-v10','取り組む','とりくむ'],['n-v11','見直す','みなおす'],['n-v12','応用','おうよう']
];
async function test(name,fn){try{const details=await fn();results.push({name,pass:true,details});console.log('PASS '+name);}catch(error){results.push({name,pass:false,error:error.stack||String(error)});console.error('FAIL '+name+': '+error.message);}}
function currentWord(ctx){return clone(ctx.run('vocab().find(v=>v.id===wordDrill.ids[wordDrill.index])'));}
function matchIds(ctx,filter){return clone(ctx.run(`libraryMatches(${JSON.stringify({query:'',stage:'all',topic:'all',status:'all',...filter})}).map(v=>v.id)`));}
async function main(){
 await test('4790 complete Chinese word records preserve 320 detailed cards',()=>{
  assert.equal(words.length,4790);assert.equal(new Set(words.map(v=>v.id)).size,4790);assert.equal(new Set(words.map(v=>v.word+'|'+v.reading)).size,4790);
  for(const w of words)for(const key of ['word','reading','meaning','topic','stage'])assert(typeof w[key]==='string'&&w[key].trim(),w.id+' '+key);
  const detailed=words.filter(w=>!w.source);assert.equal(detailed.length,320);for(const w of detailed)for(const key of ['collocation','example','exampleZh'])assert(w[key]?.trim(),w.id+' '+key);
  assert.equal(words.filter(w=>w.source==='openjlpt-tomoshi').length,4470);for(const w of words.filter(w=>w.source))assert(w.dictionarySenses.length&&w.dictionarySenses.every(s=>s.glosses.length));return 'All words have Chinese, reading and topic; original detailed cards keep their examples';
 });
 await test('every raw N5-N2 source identity is covered exactly once with the stated reference level',()=>{
  const all=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/openjlpt-identities.json'),'utf8')),ids=words.flatMap(w=>w.sourceIds||[]);
  assert.equal(all.length,4741);assert.equal(ids.length,4741);assert.equal(new Set(ids).size,4741);
  for(const src of all){const w=words.find(w=>w.sourceIds?.includes(src.id));assert(w,src.id);assert.equal(w.referenceLevel,src.level);assert([src.word,...(src.other_forms||[])].includes(w.word),src.word+' alias identity');}
  assert.equal(words.filter(w=>w.referenceLevel==='N2').length,1778);assert.equal(words.filter(w=>w.referenceLevel==='N3').length,1659);return 'Coverage checked against a compact identity snapshot extracted from pinned upstream JSON';
 });
 await test('known dictionary mismatches use manual glosses and never expose an unrelated JMdict sense',()=>{
  const silent=words.find(w=>w.word==='しいんと');assert(silent.manualGloss);assert.equal(silent.jmdictId,null);assert.match(silent.meaning,/静悄悄|鸦雀无声/);assert(!silent.meaning.includes('死亡'));const serve=words.find(w=>w.word==='務める');assert.match(serve.meaning,/担任/);assert.equal(words.filter(w=>w.manualGloss).length,16);return '16 unmatched or differently inflected entries are explicit corrections';
 });
 await test('all original 24 IDs still identify the same words and readings',()=>{for(const [id,word,reading]of original){const v=words.find(v=>v.id===id);assert(v,id);assert.equal(v.word,word);assert.equal(v.reading,reading);}return 'Original review and audio identities remain valid';});
 await test('every bundled recording exactly matches its vocabulary identity',()=>{const clips=clone(h.run('window.BUNDLED_WORD_AUDIO'));for(const [id,clip]of Object.entries(clips)){const v=words.find(v=>v.id===id);assert(v,id);assert.equal(clip.word,v.word,id);assert.equal(clip.reading,v.reading,id);assert.match(clip.dataUrl,/^data:audio\//,id);}return {clips:Object.keys(clips).length,limit:'No requirement that every stage already has recordings; does not listen to recording contents.'};});
 await test('old N2 backup gains new fields without losing SRS, custom cards or notes',()=>{
  const legacy=harness(tuesday);legacy.submit('word-form',{word:'記録確認用の自作語',reading:'きろくかくにんようのじさくご',meaning:'测试词',example:'',exampleZh:'',level:'n2'});legacy.run("state.level='n2';state.reviews['n-v01']={stage:2,reps:5,due:'2026-10-14'};state.notes.push({id:'old-note',title:'原笔记',body:'保留',type:'随笔',date:'2026-10-12'});delete state.vocabStage;delete state.wordPractice;delete state.priorityWords;delete state.custom[0].stage;persist()");
  const restored=harness(tuesday,legacy.backup());assert.equal(restored.run('storageAvailable'),true);assert.equal(restored.run('state.vocabStage'),'n2');assert.equal(restored.run('state.wordPractice.length'),0);assert.deepEqual(clone(restored.run("state.reviews['n-v01']")),{stage:2,reps:5,due:'2026-10-14'});assert.equal(restored.run('state.custom[0].word'),'記録確認用の自作語');assert.equal(restored.run("state.notes.find(n=>n.id==='old-note').body"),'保留');return 'Legacy N2 data survives actual initialization migration';
 });
 await test('due words stay first and five new words are shared across stage switches',()=>{
  const q=harness(tuesday);q.run("state.reviews['f-v01']={stage:1,reps:2,due:today};state.reviews['n-v01']={stage:1,reps:2,due:today};study('vocabulary')");q.change('vocab-stage','bridge');
  assert.deepEqual(clone(q.run('queue.slice(0,2)')),['f-v01','n-v01']);assert(q.run("queue.slice(2).every(id=>vocabStage(vocab().find(v=>v.id===id))==='bridge')"));
  for(let i=0;i<4;i++)q.run("rateCard('good')");assert.equal(q.run('currentDay().newWords.length'),2);q.change('vocab-stage','n2');assert.equal(q.run('queue.length'),3);for(let i=0;i<3;i++)q.run("rateCard('good')");assert.equal(q.run('currentDay().newWords.length'),5);q.change('vocab-stage','foundation');assert.equal(q.run('queue.length'),0);assert.equal(new Set(clone(q.run('currentDay().newWords'))).size,5);return '2 old due + 2 bridge new + 3 N2 new, then no extra new foundation cards';
 });
 await test('Sunday stage changes never introduce fresh words',()=>{const q=harness('2026-10-18T10:00:00+08:00');q.run("state.reviews['f-v01']={stage:0,reps:1,due:today};study('vocabulary')");for(const stage of ['foundation','bridge','n2']){q.change('vocab-stage',stage);assert.deepEqual(clone(q.run('queue')),['f-v01']);}return 'All three stages preserve Sunday review-only behavior';});
 await test('dictionary searches kanji, both kana scripts, Chinese and collocations',()=>{
  const target=words.find(v=>v.word==='届く');assert(target);const katakana=target.reading.replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));for(const query of [target.word,target.reading,katakana,target.meaning,target.collocation])assert(matchIds(h,{query}).includes(target.id),'missing query '+query);
  assert(matchIds(h,{query:'ヨテイ'}).includes('f-v01'));assert(matchIds(h,{query:'ﾖﾃｲ'}).includes('f-v01'));return 'Actual entries found by text, hiragana, katakana, halfwidth kana, Chinese meaning and phrase';
 });
 await test('combined stage, topic and learning-state filters match requested records',()=>{
  const s=harness(tuesday);s.run("state.reviews['f-v01']={stage:0,reps:1,due:today};state.reviews['n-v01']={stage:0,reps:1,due:addDays(today,1)}");assert.deepEqual(matchIds(s,{status:'due'}),['f-v01']);assert.equal(matchIds(s,{status:'new'}).length,words.length-2);assert.equal(matchIds(s,{stage:'bridge'}).length,words.filter(w=>w.stage==='bridge').length);assert.equal(matchIds(s,{stage:'n2',status:'due'}).length,0);
  const target=words.find(v=>v.stage==='bridge');const filtered=matchIds(s,{stage:'bridge',topic:target.topic});assert(filtered.includes(target.id));assert(filtered.every(id=>words.find(v=>v.id===id).topic===target.topic));const audio=matchIds(s,{status:'audio'});assert(audio.length>0);assert(audio.every(id=>s.run(`!!bundledWordRecording(vocab().find(v=>v.id===${JSON.stringify(id)}))`)));return 'Due/new/audio filters combine correctly with stage and topic';
 });
 await test('pagination reaches every entry once and new searches reset page',()=>{
  const p=harness(tuesday);p.click('word-audio-library');const ids=[];for(let i=0;i<Math.ceil(words.length/20);i++){const html=p.nodes.get('#vocab-results').innerHTML;const pageIds=[...html.matchAll(/data-action="speak-word" data-id="([^"]+)"/g)].map(m=>m[1]);assert.equal(pageIds.length,Math.min(20,words.length-i*20));ids.push(...pageIds);if(i<Math.ceil(words.length/20)-1)p.click('library-next');}assert.equal(new Set(ids).size,words.length);assert.match(p.nodes.get('#vocab-results').innerHTML,/data-action="library-next" disabled/);p.input('vocab-query','絶対に存在しない検索語xyz');assert.equal(p.run('libraryFilter.page'),0);assert.match(p.nodes.get('#vocab-results').innerHTML,/没有找到匹配词条/);p.input('vocab-query','よてい');assert.match(p.nodes.get('#vocab-results').innerHTML,/予定/);p.change('library-stage','n2');assert.match(p.nodes.get('#vocab-results').innerHTML,/没有找到匹配词条/);return 'All pages cover every vocabulary ID; real event handlers reset and combine filters';
 });
 await test('untrusted custom words, details and topics stay escaped in library HTML',()=>{
  const x=harness(tuesday),payload='<img src=x onerror=window.__xss=1>';x.submit('word-form',{word:payload,reading:'てすと',meaning:payload,example:payload,exampleZh:payload,stage:'bridge'});x.run(`Object.assign(state.custom[0],${JSON.stringify({topic:payload,collocation:payload,note:payload})})`);x.click('word-audio-library');x.input('vocab-query','てすと');const html=x.nodes.get('#modal-content').innerHTML+x.nodes.get('#vocab-results').innerHTML;assert(!html.includes('<img src=x'));assert(html.includes('&lt;img src=x'));assert.equal(x.run('typeof window.__xss'),'undefined');return 'Custom text remains escaped in attributes and text markup; no actual browser execution tested';
 });
 await test('dictation starts blind and correct katakana input does not change SRS or daily counts',()=>{
  const d=harness(tuesday);d.run("state.reviews['f-v01']={stage:2,reps:4,due:addDays(today,7)};persist()");const before=d.run('JSON.stringify({reviews:state.reviews,days:state.days})');d.click('word-drill-start');assert.equal(d.run('wordDrill.ids.length'),5);const target=currentWord(d),html=d.nodes.get('#modal-content').innerHTML;assert(!html.includes(target.word));assert(!html.includes(target.reading));assert(!html.includes('sourcePage'));const answer=target.reading.replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));d.submit('word-drill-form',{answer});assert.equal(d.run('wordDrill.answers[0].correct'),true);assert.equal(d.run('state.wordPractice.length'),1);assert.equal(d.run('state.notes.length'),0);assert.equal(d.run('JSON.stringify({reviews:state.reviews,days:state.days})'),before);d.submit('word-drill-form',{answer});assert.equal(d.run('state.wordPractice.length'),1);return 'Blind prompt, kana normalization, independent history and double-submit guard';
 });
 await test('wrong dictation creates escaped feedback, a note and next-round priority',()=>{
  const d=harness(tuesday);d.click('word-drill-start');const wrong=currentWord(d),payload='<svg onload=window.__xss=1>';d.submit('word-drill-form',{answer:payload});assert.equal(d.run('wordDrill.answers[0].correct'),false);assert(d.run(`state.notes.some(n=>n.id===${JSON.stringify('word-listen-'+wrong.id)}&&n.type==='听写')`));assert(!d.nodes.get('#modal-content').innerHTML.includes('<svg onload'));assert(d.nodes.get('#modal-content').innerHTML.includes('&lt;svg onload'));
  for(let i=1;i<5;i++){d.click('drill-next');d.submit('word-drill-form',{answer:currentWord(d).reading});}d.click('drill-next');assert.match(d.nodes.get('#modal-content').innerHTML,/4 \/ 5/);d.click('word-drill-start');assert.equal(d.run('wordDrill.ids[0]'),wrong.id);assert.equal(d.run('Object.keys(state.reviews).length'),0);assert.equal(d.run('currentDay().newWords.length'),0);return 'Wrong answer saved once, other four correct, and the missed word returns first';
 });
 await test('blank answer leaves question open while skip deliberately records a miss',()=>{const d=harness(tuesday);d.click('word-drill-start');d.submit('word-drill-form',{answer:'   '});assert.equal(d.run('wordDrill.checked'),false);assert.equal(d.run('state.wordPractice.length'),0);d.click('drill-skip');assert.equal(d.run('wordDrill.checked'),true);assert.equal(d.run('state.wordPractice[0].correct'),false);assert.equal(d.run('state.notes.length'),1);return 'Blank accidental submission does not penalize; explicit reveal does';});
 await test('dictation history, notes, custom stage and original reviews survive backup restore',()=>{
  const d=harness(tuesday);d.submit('word-form',{word:'自作詞',reading:'じさくし',meaning:'自写词句',example:'',exampleZh:'',stage:'bridge'});d.run("state.reviews['n-v01']={stage:3,reps:8,due:'2026-11-01'}");d.click('word-drill-start');d.click('drill-skip');const before=d.backup(),r=harness(tuesday,before);assert.equal(r.run('storageAvailable'),true);assert.deepEqual(clone(r.run('state.wordPractice')),clone(d.run('state.wordPractice')));assert.deepEqual(clone(r.run('state.reviews')),clone(d.run('state.reviews')));assert.deepEqual(clone(r.run('state.notes')),clone(d.run('state.notes')));assert.equal(r.run('state.custom[0].stage'),'bridge');return 'Actual localStorage initialization validates and restores both old and new fields';
 });
 await test('empty or non-kana custom readings cannot enter recorded dictation',()=>{
  const d=harness(tuesday);d.run('window.BUNDLED_WORD_AUDIO={}');for(const [word,reading]of [['空读音',''],['汉字读音','漢字'],['罗马音','romaji']])d.submit('word-form',{word,reading,meaning:'测试',example:'',exampleZh:'',stage:'foundation'});d.run('state.custom.forEach(v=>localWordAudioIds.add(v.id))');d.click('word-drill-start');assert.equal(d.run('wordDrill.ids.length'),0);assert.match(d.nodes.get('#modal-content').innerHTML,/补齐读音与音频/);d.submit('word-form',{word:'合格读音',reading:'テスト',meaning:'测试',example:'',exampleZh:'',stage:'foundation'});d.run('localWordAudioIds.add(state.custom[3].id)');d.click('word-drill-start');assert.deepEqual(clone(d.run('wordDrill.ids')),clone(d.run('[state.custom[3].id]')));return 'Imported audio alone is insufficient; katakana is accepted as a valid known reading';
 });
 await test('stale personal recording cannot silently fall back to TTS during dictation',async()=>{
  const d=harness(tuesday);d.run('window.BUNDLED_WORD_AUDIO={};window.__ttsCalls=0;speak=()=>window.__ttsCalls++;loadWordRecording=async()=>null');await d.run('playWordAudio(DATA.vocabulary[0],{requireRecording:true})');assert.equal(d.run('window.__ttsCalls'),0);assert.match(d.nodes.get('#toast').textContent,/录音已不可用/);await d.run('playWordAudio(DATA.vocabulary[0])');assert.equal(d.run('window.__ttsCalls'),1);return 'Required-recording branch blocks speech; normal vocabulary playback retains its fallback';
 });
 await test('dictation click requests recording-only playback',()=>{const d=harness(tuesday);d.click('word-drill-start');d.run('window.__playArgs=null;playWordAudio=(v,options)=>window.__playArgs={id:v.id,options}');d.click('drill-play');assert.equal(d.run('window.__playArgs.options.requireRecording'),true);assert.equal(d.run('window.__playArgs.id'),d.run('wordDrill.ids[0]'));return 'Actual click handler requests the no-TTS path';});
 await test('continuous foreground dictation refreshes the date after midnight',()=>{
  const d=harness('2026-10-13T23:59:00+08:00');d.run("study('vocabulary')");d.click('word-drill-start');const first=currentWord(d);d.setDate('2026-10-14T00:01:00+08:00');d.click('drill-skip');assert.equal(d.run('state.wordPractice[0].date'),'2026-10-14');assert.equal(d.run(`state.notes.find(n=>n.id===${JSON.stringify('word-listen-'+first.id)}).date`),'2026-10-14');assert.equal(d.run('today'),'2026-10-14');assert.equal(d.run('currentDay().newWords.length'),0);assert.equal(d.run('Object.keys(state.reviews).length'),0);d.click('drill-next');d.submit('word-drill-form',{answer:currentWord(d).reading});assert.equal(d.run('state.wordPractice[1].date'),'2026-10-14');return 'Both first midnight-crossing answer and continued round use new local date without SRS changes';
 });
 await test('dictation history remains restorable at the 1000-record retention limit',()=>{
  const d=harness(tuesday);d.run("state.wordPractice=Array.from({length:1000},(_,i)=>({id:'f-v01',date:i===0?'2026-10-01':'2026-10-12',correct:true}))");d.click('word-drill-start');d.click('drill-skip');assert.equal(d.run('state.wordPractice.length'),1000);assert.equal(d.run('state.wordPractice[0].date'),'2026-10-12');assert.equal(d.run('state.wordPractice.at(-1).date'),'2026-10-13');const r=harness(tuesday,d.backup());assert.equal(r.run('storageAvailable'),true);assert.equal(r.run('state.wordPractice.length'),1000);return 'Oldest record is removed while newest practice and backup schema remain valid';
 });
 await test('textbook themes and source-level filter expose real subsets without inventing lesson numbers',()=>{
  const t=harness(tuesday);t.click('textbook-topic','technology');assert.equal(t.run('libraryFilter.theme'),'technology');assert(t.run('libraryMatches().length')>20);assert(t.run("libraryMatches().every(w=>w.themes.includes('technology'))"));t.change('library-theme','all');t.change('library-reference','N2');assert.equal(t.run('libraryMatches().length'),1778);assert.match(t.run('textbookThemesPanel()'),/不是两套教材逐课生词表/);return 'Theme buttons and actual reference selector work through registered handlers';
 });
 await test('selected new words keep due-first order, share the five-word cap and survive backups',()=>{
  const p=harness(tuesday);p.run("state.reviews['f-v01']={stage:1,reps:3,due:today}");p.click('word-audio-library');const selected=words.filter(w=>w.source&&w.stage==='n2').slice(0,6).map(w=>w.id);for(const id of selected)p.click('prioritize-word',id);assert.equal(p.run('state.priorityWords.length'),6);p.run('buildQueue()');assert.equal(p.run('queue[0]'),'f-v01');assert.deepEqual(clone(p.run('queue.slice(1)')),selected.slice(0,5));for(let i=0;i<6;i++)p.run("rateCard('good')");assert.equal(p.run('currentDay().newWords.length'),5);p.run('buildQueue()');assert.equal(p.run('queue.length'),0);assert.deepEqual(clone(p.run('state.priorityWords')),selected.slice(5));const r=harness(tuesday,p.backup());assert.deepEqual(clone(r.run('state.priorityWords')),selected.slice(5));assert.equal(r.run('storageAvailable'),true);return 'Six requested words spread across days; none become learned merely by selection';
 });
 await test('open-data senses and provenance are escaped and required attribution is present',()=>{
  const p=harness(tuesday);const html=p.run("vocabularyDetail({dictionarySenses:[{glosses:['<img src=x onerror=1>'],notes:'<svg onload=1>'}],referenceMeaning:'<x>'})");assert(!html.includes('<img'));assert(!html.includes('<svg'));assert(html.includes('&lt;img'));const credit=p.run('vocabularyDatasetCredit()');for(const x of ['OpenJLPT','EDRDG','Tomoshi','CC BY-SA 4.0','机器辅助'])assert(credit.includes(x));for(const name of ['vocabulary-LICENSE.txt','OpenJLPT-NOTICE.md','Tomoshi-LICENSE.md','Tomoshi-NOTICE.md'])assert(fs.statSync(path.join(root,'dist',name)).size>100);return 'Definition markup remains text; offline distribution includes upstream notices';
 });
 const report={checkedAt:new Date().toISOString(),mode:'Node VM simulations using actual source and delegated event handlers',limitations:['Does not launch a real browser or parse HTML into a real DOM','Does not verify focus, scroll, layout, IME behavior, real audio playback or mobile support','Completeness checks do not certify linguistic correctness or an official JLPT word list'],total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,tests:results};
 fs.writeFileSync(path.join(root,'tests/.reports/qa-vocabulary-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
