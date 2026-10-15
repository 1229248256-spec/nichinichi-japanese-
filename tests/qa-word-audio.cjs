const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const root = require('node:path').resolve(__dirname,'..');
const dist = path.join(root, 'dist');
const source = Object.fromEntries(['content.js', 'audio-data.js', 'pronunciation.js', 'materials.js', 'vocabulary.js', 'lesson-data.js', 'app.js', 'academy.js'].map(name => [name, fs.readFileSync(path.join(dist, name), 'utf8')]));
const results = [];
const settle = () => new Promise(resolve => setImmediate(resolve));

function harness({ saved = null, clips = [], database = true, files = source } = {}) {
  const storage = new Map(saved ? [['nichinichi-v1', saved]] : []);
  const records = new Map(clips.map(record => [record.id, record]));
  const nodes = new Map(), docEvents = {}, winEvents = {}, audios = [], revoked = [], created = [], reads = [], writes = [];
  const document = {
    visibilityState: 'visible',
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', value: '1', open: false, events: {}, classList: { add() {}, remove() {} }, showModal() { this.open = true; }, close() { this.open = false; for (const callback of this.events.close || []) callback(); }, addEventListener(type, callback) { (this.events[type] ??= []).push(callback); } });
      return nodes.get(selector);
    },
    addEventListener(type, callback) { (docEvents[type] ??= []).push(callback); },
    createElement() { return { click() {} }; }
  };
  const synth = {
    active: null, canceled: 0, spoken: [],
    getVoices() { return [{ lang: 'ja-JP', name: 'mock-ja' }]; },
    cancel() { this.active = null; this.canceled++; },
    speak(utterance) { this.active = utterance; this.spoken.push(utterance); }
  };
  class MockUtterance { constructor(text) { this.text = text; } }
  class MockAudio {
    constructor(src) { this.src = src; this.originalSrc = src; this.paused = true; this.played = false; this.fail = ctx.failNextAudio; ctx.failNextAudio = false; audios.push(this); }
    play() { this.paused = false; this.played = true; return this.fail ? Promise.reject(Error('mock format unsupported')) : Promise.resolve(); }
    pause() { this.paused = true; }
  }
  class MockDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-13T10:00:00+08:00'])); } static now() { return new Date('2026-10-13T10:00:00+08:00').getTime(); } }
  const db = {
    objectStoreNames: { contains: name => name === 'clips' }, createObjectStore() {}, close() {},
    transaction() {
      const tx = { objectStore() { return {
        get(id) { reads.push(id); const request = {}; queueMicrotask(() => { request.result = records.get(id); request.onsuccess?.(); }); return request; },
        getAllKeys() { const request = {}; queueMicrotask(() => { request.result = [...records.keys()]; request.onsuccess?.(); }); return request; },
        put(record) { records.set(record.id, record); queueMicrotask(() => tx.oncomplete?.()); },
        delete(id) { records.delete(id); queueMicrotask(() => tx.oncomplete?.()); }
      }; } };
      return tx;
    }
  };
  const ctx = vm.createContext({ Date: MockDate, Intl, document, location: { hash: '', protocol: 'file:' }, navigator: {}, history: { replaceState(_, __, hash) { ctx.location.hash = hash; } }, localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { writes.push(key); storage.set(key, value); } }, setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {}, Blob, console, SpeechSynthesisUtterance: MockUtterance, Audio: MockAudio, FormData: class { constructor(form) { this.fields = form.fields; } *[Symbol.iterator]() { yield* Object.entries(this.fields); } }, URL: { createObjectURL(blob) { const url = 'blob:mock-' + (created.length + 1); created.push({ blob, url }); return url; }, revokeObjectURL(url) { revoked.push(url); } } });
  ctx.window = ctx;
  ctx.scrollTo = () => {};
  ctx.speechSynthesis = synth;
  ctx.addEventListener = (type, callback) => (winEvents[type] ??= []).push(callback);
  if (database) ctx.indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess?.(); }); return request; } };
  for (const name of ['content.js', 'audio-data.js', 'pronunciation.js', 'materials.js', 'vocabulary.js', 'lesson-data.js', 'app.js', 'academy.js']) vm.runInContext(files[name]||'', ctx, { filename: name });
  const run = code => vm.runInContext(code, ctx);
  const emit = async (handlers, type, event = {}) => { await Promise.all((handlers[type] || []).map(fn => fn(event))); await settle(); };
  return { ctx, run, storage, records, nodes, synth, audios, revoked, created, reads, writes, docEvents, winEvents,
    async ready() { await settle(); await settle(); },
    click(action, id) { return emit(docEvents, 'click', { target: { closest(selector) { return selector === '[data-action]' ? { dataset: { action, id } } : null; } } }); },
    change(id, value, file = null) { return emit(docEvents, 'change', { target: { id, value, files: file ? [file] : [], dataset: {}, matches(selector) { return selector === 'select' && id !== 'word-audio-file'; } } }); },
    windowEvent(type) { return emit(winEvents, type); },
    modalEvent(type) { return emit(nodes.get('#modal').events, type); },
    backup() { return storage.get('nichinichi-v1'); }
  };
}

async function test(name, callback) {
  try { const details = await callback(); results.push({ name, pass: true, details }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.log('FAIL ' + name + ': ' + error.message); }
}

(async () => {
  await test('bundled audio words and readings match the corresponding study cards', async () => {
    const h = harness(); await h.ready();
    const clips = h.run('Object.entries(window.BUNDLED_WORD_AUDIO).map(([id,c])=>({id,word:c.word,reading:c.reading,dataUrl:c.dataUrl,sourcePage:c.sourcePage}))');
    assert(clips.length >= 21 && clips.length <= h.run('DATA.vocabulary.length'));
    for (const clip of clips) {
      const word = h.run(`vocab().find(v=>v.id===${JSON.stringify(clip.id)})`);
      assert(word, clip.id); assert.equal(clip.word, word.word); assert.equal(clip.reading, word.reading);
      assert.match(clip.dataUrl, /^data:audio\/(?:mpeg|mp3);base64,/);
      assert(Buffer.from(clip.dataUrl.split(',')[1], 'base64').length > 500, clip.id);
      assert.match(clip.sourcePage, /^https:\/\/(?:github\.com\/(?:tofugu|kanjialive)\/|(?:media\.)?kanjialive\.com\/)/);
    }
    return { bundled: clips.length, foundation: clips.filter(c => c.id.startsWith('f-')).length, n2: clips.filter(c => c.id.startsWith('n-')).length };
  });
  await test('bundled matching rejects a changed word or changed reading', async () => {
    const h = harness(); await h.ready();
    assert(h.run("bundledWordRecording(vocab().find(v=>v.id==='f-v01'))"));
    assert.equal(h.run("bundledWordRecording({...vocab().find(v=>v.id==='f-v01'),word:'別語'})"), null);
    assert.equal(h.run("bundledWordRecording({...vocab().find(v=>v.id==='f-v01'),reading:'べつご'})"), null);
    return 'Both orthography and reading must match the registered word ID';
  });
  await test('bundled recordings play without IndexedDB or a Japanese synthesis voice', async () => {
    const h = harness({ database: false }); h.synth.getVoices = () => [];
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    assert.equal(h.audios.length, 1); assert.match(h.audios[0].originalSrc, /^data:audio/); assert.equal(h.synth.spoken.length, 0);
    assert.equal(h.run("wordAudioButtonLabel(vocab().find(v=>v.id==='f-v01'))"), '▷ 播放真人录音');
    return 'Native recording does not depend on device TTS or audio import support';
  });
  await test('unbundled reading is explicitly synthesized and marked as device speech', async () => {
    const h = harness(); await h.ready();
    const id = h.run('vocab().find(v=>!bundledWordRecording(v)).id');
    await h.run(`playWordAudio(vocab().find(v=>v.id===${JSON.stringify(id)}))`);
    assert.equal(h.audios.length, 0); assert.equal(h.synth.spoken.length, 1);
    assert.equal(h.synth.active.text, h.run(`vocab().find(v=>v.id===${JSON.stringify(id)}).reading`));
    assert.match(h.run(`wordAudioButtonLabel(vocab().find(v=>v.id===${JSON.stringify(id)}))`), /设备朗读/);
    assert.match(h.run(`wordVoiceLinks(vocab().find(v=>v.id===${JSON.stringify(id)}))`), /设备合成语音/);
    return id;
  });
  await test('imported audio takes precedence over bundled recordings and TTS', async () => {
    const h = harness(); await h.ready();
    h.ctx.testFile = { name: '予定.mp3', type: 'audio/mpeg', size: 1500 };
    await h.run("saveWordRecording('f-v01',testFile)");
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    assert.equal(h.audios.length, 1); assert.match(h.audios[0].originalSrc, /^blob:/);
    assert.equal(h.created[0].blob, h.ctx.testFile); assert.equal(h.synth.spoken.length, 0);
    assert.match(h.run("wordAudioButtonLabel(vocab().find(v=>v.id==='f-v01'))"), /本地音频/);
    return 'Local attachment > bundled native clip > device speech';
  });
  await test('imported audio survives a fresh session through its separate IndexedDB store', async () => {
    const file = { name: 'my-word.m4a', type: 'audio/mp4', size: 2000 };
    const h = harness({ clips: [{ id: 'f-v01', name: file.name, blob: file }] }); await h.ready();
    assert.equal(h.run("hasWordRecording('f-v01')"), true);
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    assert.match(h.audios[0].originalSrc, /^blob:/); assert.deepEqual(h.reads, ['f-v01']);
    return 'Existing attachment IDs are restored and the audio is loaded on demand';
  });
  await test('removing an attachment restores the bundled recording', async () => {
    const h = harness({ clips: [{ id: 'f-v01', name: 'own.mp3', blob: {} }] }); await h.ready();
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    const first = h.audios[0]; await h.run("removeWordRecording('f-v01')");
    assert.equal(first.paused, true); assert.equal(h.revoked.length, 1); assert.equal(h.records.has('f-v01'), false);
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    assert.match(h.audios[1].originalSrc, /^data:audio/); assert.match(h.run("wordAudioButtonLabel(vocab().find(v=>v.id==='f-v01'))"), /真人录音/);
    return 'Attachment, cache, ID marker, and Blob URL all removed';
  });
  await test('invalid or excessive attachments are rejected before database writes', async () => {
    const h = harness(); await h.ready();
    for (const file of [{ name: 'x.mp3', type: 'audio/mpeg', size: 0 }, { name: 'x.mp3', type: 'audio/mpeg', size: 10 * 1024 * 1024 + 1 }, { name: 'x.exe', type: 'application/octet-stream', size: 1000 }]) {
      h.ctx.testFile = file; await assert.rejects(h.run("saveWordRecording('f-v01',testFile)"));
    }
    assert.equal(h.records.size, 0); return 'Empty, greater-than-10MB, and unsupported file rejected';
  });
  await test('rapid word clicks stop the previous player and stale callbacks cannot stop the current one', async () => {
    const h = harness(); await h.ready();
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))"); const first = h.audios[0];
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v02'))"); const second = h.audios[1];
    assert.equal(first.paused, true); assert.equal(first.src, '');
    first.onended(); assert.equal(second.paused, false); first.onerror(); assert.equal(second.paused, false);
    assert.equal(h.run('activeWordAudio'), second); return 'Only the latest player remains active';
  });
  await test('navigation while a word recording is loading prevents delayed playback', async () => {
    const h = harness(); await h.ready();
    h.run('loadWordRecording=()=>new Promise(resolve=>window.resolveDelayedClip=resolve)');
    const pending = h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    await h.click('plan'); h.ctx.resolveDelayedClip(null); await pending;
    assert.equal(h.audios.length, 0); assert.equal(h.synth.spoken.length, 0);
    return 'Request token is invalidated before the async load returns';
  });
  await test('route navigation and hash changes stop native audio and device speech', async () => {
    const h = harness(); await h.ready();
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    h.ctx.location.hash = '#notes'; await h.windowEvent('hashchange'); assert.equal(h.audios[0].paused, true);
    const id = h.run('vocab().find(v=>!bundledWordRecording(v)).id');
    await h.run(`playWordAudio(vocab().find(v=>v.id===${JSON.stringify(id)}))`); assert(h.synth.active);
    await h.click('study-tab', 'grammar'); assert.equal(h.synth.active, null);
    return 'Both playback mechanisms stop when changing views';
  });
  await test('level selection stops the prior native recording before switching study content', async () => {
    const h = harness(); await h.ready();
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    await h.change('level', 'n2'); assert.equal(h.audios[0].paused, true); assert.equal(h.run('state.level'), 'n2');
    return 'Actual registered change listener receives a select target';
  });
  await test('closing the word-audio library stops both native playback and device fallback', async () => {
    const h = harness(); await h.ready(); await h.click('word-audio-library');
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))"); await h.click('close-modal'); assert.equal(h.audios[0].paused, true);
    await h.click('word-audio-library'); const id = h.run('vocab().find(v=>!bundledWordRecording(v)).id');
    await h.run(`playWordAudio(vocab().find(v=>v.id===${JSON.stringify(id)}))`); await h.click('close-modal'); assert.equal(h.synth.active, null);
    return 'Modal close button cancels both playback mechanisms';
  });
  await test('native dialog Escape cancellation stops the active recording', async () => {
    const h = harness(); await h.ready(); await h.click('word-audio-library');
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    await h.modalEvent('cancel'); assert.equal(h.audios[0].paused, true); assert.equal(h.run('activeWordAudio'), null);
    return 'Registered native dialog cancel handler stops playback';
  });
  await test('native dialog close event stops device speech even without a data-action click', async () => {
    const h = harness(); await h.ready(); await h.click('word-audio-library');
    const id = h.run('vocab().find(v=>!bundledWordRecording(v)).id');
    await h.run(`playWordAudio(vocab().find(v=>v.id===${JSON.stringify(id)}))`); assert(h.synth.active);
    await h.modalEvent('close'); assert.equal(h.synth.active, null);
    return 'Registered native dialog close handler cancels speech synthesis';
  });
  await test('rating the next SRS card stops playback but preserves normal SRS behavior', async () => {
    const h = harness(); await h.ready(); h.run("state.level='foundation';buildQueue()"); const id = h.run('queue[0]');
    await h.run(`playWordAudio(vocab().find(v=>v.id===${JSON.stringify(id)}))`);
    await h.click('rate', 'good'); assert.equal(h.audios[0].paused, true);
    assert.equal(h.run(`state.reviews[${JSON.stringify(id)}].due`), '2026-10-14'); assert.equal(h.run(`state.reviews[${JSON.stringify(id)}].reps`), 1);
    assert.equal(h.run('currentDay().newWords.length'), 1); return 'Original next-day scheduling retained';
  });
  await test('audio actions do not reset or mutate study records and the localStorage key remains stable', async () => {
    const initial = harness(); await initial.ready(); initial.run("buildQueue();rateCard('good');state.notes.push({id:'qa-note',title:'keep',body:'body',type:'随笔',date:today});persist()");
    const backup = initial.backup(); const h = harness({ saved: backup }); await h.ready();
    const before = h.run('JSON.stringify(state)'); await h.click('word-audio-library'); await h.click('speak-word', 'f-v01'); await h.click('close-modal');
    h.ctx.testFile = { name: 'own.mp3', type: 'audio/mpeg', size: 1500 }; await h.run("saveWordRecording('f-v01',testFile)"); await h.run("removeWordRecording('f-v01')");
    assert.equal(h.run('JSON.stringify(state)'), before); assert.equal(h.backup(), backup); assert.equal(h.run('KEY'), 'nichinichi-v1');
    assert.equal(h.writes.length, 0); return 'Existing reviews, notes, daily records, and exact stored JSON preserved';
  });
  await test('library plays all existing words without entering the daily SRS queue', async () => {
    const h = harness(); await h.ready(); const before = h.run('JSON.stringify({queue,queueActive,state})');
    await h.click('word-audio-library'); const html = h.nodes.get('#modal-content').innerHTML, rows=h.nodes.get('#vocab-results').innerHTML;
    assert.equal((rows.match(/data-action="speak-word"/g) || []).length,20); assert.equal(h.run('libraryMatches().length'),h.run('vocab().length')); assert.equal(h.run('JSON.stringify({queue,queueActive,state})'), before);
    assert.match(html,/基础恢复/);assert.match(html,/N3 衔接/);assert.match(html,/N2 拓展/);return 'All words are available through paginated search without consuming daily cards';
  });
  await test('card and resource UI clearly identify real recordings, device fallback and commercial resource limits', async () => {
    const h = harness(); await h.ready(); h.run('buildQueue()');
    assert.match(h.run('renderVocabulary()'), /播放真人录音/);
    const card = h.run('wordAudioResourceCard()'); assert.match(card, /N2 拓展/); assert.match(card, /不包含这些教材的整套下载包/); assert.match(card, /设备朗读/);
    assert.match(card, /CC BY-SA 4\.0/); assert.match(card, /CC BY 4\.0/); assert.match(card, /未改动录音/);
    return 'Sample scope and licensing presented in product UI';
  });
  await test('unloading the page stops players and revokes temporary Blob URLs', async () => {
    const h = harness({ clips: [{ id: 'f-v01', name: 'own.mp3', blob: {} }] }); await h.ready();
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))"); await h.windowEvent('pagehide');
    assert.equal(h.audios[0].paused, true); assert.deepEqual(h.revoked, ['blob:mock-1']); assert.equal(h.run('activeWordAudio'), null);
    return 'No active player or temporary audio URL remains';
  });
  await test('source metadata and offline bundle assets exist', async () => {
    const h = harness(); await h.ready(); assert.equal(h.run('window.BUNDLED_WORD_AUDIO_SOURCE.license'), 'CC BY-SA 4.0');
    const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
    assert(index.indexOf('audio-data.js') < index.indexOf('pronunciation.js')); assert(index.indexOf('pronunciation.js') < index.indexOf('app.js'));
    assert.match(sw, /audio-data\.js/); assert.match(sw, /pronunciation\.js/); assert(fs.statSync(path.join(dist, 'audio-LICENSE.txt')).size > 1000);
    return 'Source credits, audio license, deferred loading order, and service-worker cache assets verified statically';
  });
  await test('playback failure stops its player, revokes an imported URL and shows useful feedback', async () => {
    const h = harness({ clips: [{ id: 'f-v01', name: 'own.mp3', blob: {} }] }); await h.ready(); h.ctx.failNextAudio = true;
    await h.run("playWordAudio(vocab().find(v=>v.id==='f-v01'))");
    assert.equal(h.audios[0].paused, true); assert.equal(h.run('activeWordAudio'), null); assert.deepEqual(h.revoked, ['blob:mock-1']);
    assert.match(h.nodes.get('#toast').textContent, /mock format unsupported/);
    return 'A rejected play promise cannot leak a player or a temporary Blob URL';
  });
  const report = { date: '2026-10-13', mode: 'Independent Node VM with simulated Audio, SpeechSynthesis, IndexedDB and DOM event targets', artifactsIncluded: false, sourceBytes: Object.fromEntries(Object.entries(source).map(([k, v]) => [k, Buffer.byteLength(v)])), tests: results, limits: ['No real audio decoding or listening-quality assessment', 'No real browser, phone, audio autoplay restrictions, file-origin IndexedDB or storage quota verification', 'No browser layout or installed service-worker behavior verification', 'This suite checks the multi-file public source distribution'] };
  fs.writeFileSync(path.join(root, 'tests/.reports/qa-word-audio-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ total: results.length, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass) }));
  if (results.some(r => !r.pass)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
