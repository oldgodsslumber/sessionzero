const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

const { loadAppHTML } = require('./loadapp');
const html = loadAppHTML();
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.fetch = w.fetch || (() => Promise.reject(new Error('network disabled in tests')));

const fails = [];
const ok = [];
// Run assertions INSIDE the page scope so top-level const/let bindings
// (S, U, LORE_TYPES, _wiki*) are reachable — they never land on window.
function check(name, expr) {
  try {
    const r = w.eval('(function(){' + expr + '})()');
    if (r === false) fails.push(name + ' -> false');
    else if (typeof r === 'string') fails.push(name + ' -> ' + r);
    else ok.push(name);
  } catch (e) { fails.push(name + ' -> ' + e.message); }
}
function run(expr) { return w.eval('(function(){' + expr + '})()'); }

w.addEventListener('error', e => fails.push('window error: ' + e.message));
w.confirm = () => true;
w.alert = m => { fails.push('unexpected alert: ' + m); };

setTimeout(() => {
  // ---- boot ----
  check('boot: LORE_TYPES present', 'return LORE_TYPES.length===7');
  check('boot: page-wiki exists', 'return !!document.getElementById("page-wiki")');
  check('boot: nb-wiki exists', 'return !!document.getElementById("nb-wiki")');
  check('boot: nb-theme gone', 'return !document.getElementById("nb-theme")');
  check('boot: modals exist', 'return !!document.getElementById("lore-modal")&&!!document.getElementById("ai-modal")');
  check('boot: theme sidebar swatches still wired', 'return document.querySelectorAll("#theme-wrap .theme-swatch").length===5');

  // ---- setup ----
  check('setup: create universe', 'createUniverse("Test Universe");return true');
  check('setup: create a save', 'var st=defaultState();st.universeId=currentUniverse()?currentUniverse().id:U.universes[0].id;var id=createSave(st);loadSave(id);return currentSaveId===id');
  check('setup: universe bound', 'return !!currentUniverse()');

  // ---- parser ----
  check('parse: clean JSON array', 'var r=parseLoreBlocks(\'[{"type":"character","name":"Doctor Malice","aliases":["Elias Kane"],"body":"A villain."}]\');return r.length===1&&r[0].name==="Doctor Malice"&&r[0].aliases[0]==="Elias Kane"');
  check('parse: JSON buried in prose', 'var r=parseLoreBlocks(\'Sure! Here you go:\\n{"type":"location","name":"Harrow Bay","body":"A port city."}\\nHope that helps!\');return r.length===1&&r[0].type==="location"');
  check('parse: fenced json', 'var r=parseLoreBlocks("```json\\n[{\\"name\\":\\"The Ninth Circle\\",\\"type\\":\\"organization\\"}]\\n```");return r.length===1&&r[0].type==="organization"');
  check('parse: trailing commas repaired', 'return parseLoreBlocks(\'[{"name":"Ironclad","type":"character",},]\').length===1');
  check('parse: {entries:[...]} unwrapped', 'return parseLoreBlocks(\'{"entries":[{"name":"A","type":"item"},{"name":"B","type":"item"}]}\').length===2');
  check('parse: bad type coerced to lore', 'return parseLoreBlocks(\'[{"name":"X","type":"nonsense"}]\')[0].type==="lore"');
  check('parse: nameless dropped', 'return parseLoreBlocks(\'[{"type":"item","body":"no name"}]\').length===0');
  check('parse: sentence-name dropped', 'return parseLoreBlocks(\'[{"name":"\'+"x".repeat(120)+\'"}]\').length===0');
  check('parse: refusal prose yields nothing', 'return parseLoreBlocks("I am sorry, I cannot help with that.").length===0');
  check('parse: aliases from comma string', 'return parseLoreBlocks(\'[{"name":"Q","aliases":"a, b, c"}]\')[0].aliases.length===3');
  check('parse: code fence stripped from body', 'return parseLoreBlocks(\'[{"name":"Q","body":"before ```junk``` after"}]\')[0].body.indexOf("junk")<0');

  // ---- upsert ----
  check('upsert: creates', 'var r=upsertLore({type:"character",name:"Doctor Malice",aliases:["Elias Kane"],body:"Runs the Ninth Circle."});return r.updated===false&&listLore().length===1');
  check('upsert: alias match updates, no duplicate', 'var r=upsertLore({type:"character",name:"Elias Kane",body:"Was a surgeon."});return r.updated===true&&listLore().length===1');
  check('upsert: body appended not clobbered', 'var e=listLore()[0];return e.body.indexOf("Ninth Circle")>=0&&e.body.indexOf("surgeon")>=0');
  check('upsert: repeat body not duplicated', 'upsertLore({name:"Doctor Malice",body:"Was a surgeon."});var e=listLore()[0];return (e.body.match(/Was a surgeon/g)||[]).length===1');
  check('upsert: handle retitled in place', 'upsertLore({type:"character",name:"the scarred woman",body:"Seen at the docks."});var b=listLore().length;upsertLore({type:"character",name:"Selina Vane",aliases:["the scarred woman"],body:"Real name learned."});var e=listLore().find(function(x){return x.name==="Selina Vane"});return listLore().length===b&&!!e&&e.aliases.indexOf("the scarred woman")>=0');
  check('upsert: old handle still finds the entry', 'var r=upsertLore({name:"the scarred woman",body:"More."});return r.updated===true');
  check('upsert: hidden flag sticks', 'upsertLore({type:"plot",name:"The Cathedral Job",hidden:true,body:"Secret."});return listLore().find(function(x){return x.name==="The Cathedral Job"}).hidden===true');

  // ---- universe scoping ----
  check('scope: lore lives on the universe', 'return (currentUniverse().lore||[]).length===listLore().length');
  check('scope: survives slot switch', 'var n=listLore().length;var st=defaultState();st.universeId=S.universeId;loadSave(createSave(st));return listLore().length===n');
  check('scope: second universe has its own wiki', 'var u2=createUniverse("Other");S.universeId=u2.id;bindUniverse();return listLore().length===0');
  check('scope: switching back restores', 'S.universeId=U.universes[0].id;bindUniverse();return listLore().length>0');

  // ---- render ----
  check('render: wiki renders', 'showTab("wiki");return document.getElementById("wiki-content").innerHTML.length>200');
  check('render: hidden masked by default', '_wikiShowHidden=false;renderWiki();return document.getElementById("wiki-content").innerHTML.indexOf("The Cathedral Job")<0');
  check('render: hidden shown when toggled', '_wikiShowHidden=true;renderWiki();return document.getElementById("wiki-content").innerHTML.indexOf("The Cathedral Job")>=0');
  check('render: search filters to empty state', '_wikiQuery="zzzznope";renderWiki();var h=document.getElementById("wiki-content").innerHTML;_wikiQuery="";renderWiki();return h.indexOf("Nothing matches")>=0');
  check('render: search matches alias', '_wikiQuery="elias";renderWiki();var h=document.getElementById("wiki-content").innerHTML;_wikiQuery="";renderWiki();return h.indexOf(">Doctor Malice<")>=0');
  check('render: type filter excludes others', '_wikiType="plot";renderWiki();var h=document.getElementById("wiki-content").innerHTML;_wikiType="";renderWiki();return h.indexOf(">Doctor Malice<")<0');
  check('render: theme strip present', 'return document.getElementById("wiki-content").innerHTML.indexOf("wiki-theme-strip")>=0');
  check('render: intake box hidden while locked', '_wikiEditMode=false;renderWiki();return document.getElementById("wiki-content").querySelector(".no-edit .edit-only")!==null');
  check('render: setTheme applies + persists', 'setTheme("cosmic");return document.documentElement.getAttribute("data-theme")==="cosmic"&&localStorage.getItem("dc_theme")==="cosmic"');

  // ---- editor ----
  check('editor: opens and populates', '_wikiEditMode=true;renderWiki();var id=listLore().find(function(x){return x.name==="Doctor Malice"}).id;openLoreEditor(id);return document.getElementById("lore-name").value==="Doctor Malice"');
  check('editor: saves edits', 'document.getElementById("lore-body").value="Edited body.";document.getElementById("lore-tags").value="villain, harrow bay";saveLoreFromEditor();var e=listLore().find(function(x){return x.name==="Doctor Malice"});return e.body==="Edited body."&&e.tags.length===2');
  check('editor: hidden checkbox round-trips', 'var id=listLore().find(function(x){return x.name==="Doctor Malice"}).id;openLoreEditor(id);document.getElementById("lore-hidden").checked=true;saveLoreFromEditor();var e=listLore().find(function(x){return x.name==="Doctor Malice"});var was=e.hidden===true;openLoreEditor(e.id);document.getElementById("lore-hidden").checked=false;saveLoreFromEditor();return was&&listLore().find(function(x){return x.name==="Doctor Malice"}).hidden===false');
  check('editor: new entry gets an id and persists', 'var n=listLore().length;openLoreEditor(null);document.getElementById("lore-name").value="Manual Entry";saveLoreFromEditor();return listLore().length===n+1&&!!listLore().find(function(x){return x.name==="Manual Entry"}).id');
  check('editor: create NPC from lore links by id', 'var id=listLore().find(function(x){return x.name==="Doctor Malice"}).id;openLoreEditor(id);createNPCFromLore();var e=listLore().find(function(x){return x.name==="Doctor Malice"});var npc=S.npcs.find(function(n){return n.id===e.npcId});return !!e.npcId&&!!npc&&npc.name==="Doctor Malice"');
  check('editor: NPC desc is a blurb, not the whole body', 'var e=listLore().find(function(x){return x.name==="Doctor Malice"});var npc=S.npcs.find(function(n){return n.id===e.npcId});return npc.desc.length<=200');
  check('editor: builder opened for the new NPC', 'return _npcFullMode===true&&S._npcDraft.name==="Doctor Malice"');
  check('editor: linked NPC is on the shared roster', 'var e=listLore().find(function(x){return x.name==="Doctor Malice"});return (currentUniverse().roster||[]).some(function(n){return n.id===e.npcId})');
  check('editor: unlink clears npcId', 'closeFullNPCBuilder();var e=listLore().find(function(x){return x.name==="Doctor Malice"});openLoreEditor(e.id);setLoreNPC("");return listLore().find(function(x){return x.name==="Doctor Malice"}).npcId===null');
  check('editor: delete removes entry', 'closeLoreEditor();var b=listLore().length;delLore(listLore().find(function(x){return x.name==="Manual Entry"}).id);return listLore().length===b-1');

  // ---- LLM config ----
  check('llm: defaults gemini + not ready', 'return llmConfig().backend==="gemini"&&llmReady()===false');
  check('llm: key makes it ready', 'saveLLMConfig({geminiKey:"AIzaFake"});return llmReady()===true');
  check('llm: local backend uses url readiness', 'saveLLMConfig({backend:"local"});return llmReady()===true&&llmBackendLabel().indexOf("Local")===0');
  check('llm: blank local url is not ready', 'saveLLMConfig({localUrl:""});var r=llmReady();saveLLMConfig({localUrl:"http://localhost:5000/v1",backend:"gemini"});return r===false');
  check('llm: config persists outside the save slot', 'var raw=localStorage.getItem("dc_llm")||"";var slot=localStorage.getItem("dc_slot_0")||"";return raw.indexOf("AIzaFake")>=0&&slot.indexOf("AIzaFake")<0');
  check('llm: AI setup modal renders both backends', 'openAISetup();var h=document.getElementById("ai-modal-body").innerHTML;closeAISetup();return h.indexOf("Gemini")>=0&&h.indexOf("Local")>=0');

  // ---- end-to-end intake ----
  run('saveLLMConfig({backend:"gemini",geminiKey:"AIzaFake"});_wikiEditMode=true;renderWiki();');
  w.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '[{"type":"organization","name":"The Ninth Circle","aliases":["Circle"],"body":"A syndicate in Harrow Bay."},{"type":"location","name":"Harrow Bay","body":"A rotting port city."}]' }] } }] })
  });
  run('document.getElementById("wiki-intake").value="The Ninth Circle runs Harrow Bay.";');

  run('return runWikiIntake()').then(() => {
    check('intake: created both entries', 'return !!listLore().find(function(x){return x.name==="The Ninth Circle"})&&!!listLore().find(function(x){return x.name==="Harrow Bay"})');
    check('intake: tagged AI-created', 'return listLore().find(function(x){return x.name==="Harrow Bay"}).createdBy==="llm"');
    check('intake: status reports counts', 'return /2 added/.test(_wikiStatus)');
    check('intake: textarea cleared on success', 'return _wikiIntakeText===""');
    check('intake: entries landed on the universe', 'return (currentUniverse().lore||[]).some(function(e){return e.name==="Harrow Bay"})');

    // re-run the same notes: should update, not duplicate
    run('document.getElementById("wiki-intake").value="The Ninth Circle runs Harrow Bay.";');
    return run('return runWikiIntake()');
  }).then(() => {
    check('intake: rerun updates rather than duplicating', 'return listLore().filter(function(x){return x.name==="Harrow Bay"}).length===1&&/2 updated/.test(_wikiStatus)');

    w.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'quota' } }) });
    run('document.getElementById("wiki-intake").value="more notes";');
    return run('return runWikiIntake()');
  }).then(() => {
    check('intake: rate limit surfaces readable error', 'return /rate limit/i.test(_wikiStatus)');
    check('intake: text preserved on failure', 'return _wikiIntakeText==="more notes"');

    w.fetch = async () => { throw new Error('network down'); };
    return run('saveLLMConfig({backend:"local"});document.getElementById("wiki-intake").value="x";return runWikiIntake()');
  }).then(() => {
    
    check('related: outgoing mention found', 'upsertLore({type:"character",name:"Ironclad",body:"Fought Doctor Malice at Harrow Bay."});var e=listLore().find(function(x){return x.name==="Ironclad"});var r=loreRelated(e);return r.out.some(function(o){return o.name==="Harrow Bay"})');
    check('related: backlink found', 'var e=listLore().find(function(x){return x.name==="Harrow Bay"});var r=loreRelated(e);return r.in.some(function(o){return o.name==="Ironclad"})');
    check('related: no self-reference', 'var e=listLore().find(function(x){return x.name==="Ironclad"});var r=loreRelated(e);return !r.out.concat(r.in).some(function(o){return o.name==="Ironclad"})');
    check('related: short names ignored', 'upsertLore({type:"item",name:"Orb",body:"x"});upsertLore({type:"lore",name:"Absorb Test",body:"The word absorb contains orb."});var e=listLore().find(function(x){return x.name==="Absorb Test"});return !loreRelated(e).out.some(function(o){return o.name==="Orb"})');
    check('related: renders in editor', '_wikiEditMode=true;var e=listLore().find(function(x){return x.name==="Ironclad"});openLoreEditor(e.id);var h=document.getElementById("lore-modal-body").innerHTML;closeLoreEditor();return h.indexOf("Related")>=0&&h.indexOf("Harrow Bay")>=0');
    check('intake: unreachable local server explains CORS', 'return /Couldn.t reach|CORS/i.test(_wikiStatus)');

    console.log('\nPASS ' + ok.length);
    if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  x ' + f)); process.exit(1); }
    else console.log('All checks passed.');
  }).catch(e => { console.log('HARNESS ERROR: ' + e.stack); process.exit(1); });
}, 500);
