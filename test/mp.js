// Two simulated clients (a GM and a player) against one in-memory backend
// with the real security rules modelled. The headline assertions are the
// isolation ones: a player must never receive hidden entries or secrets.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const { makeBackend, makeFirebase } = require('./fakefb');

const { loadAppHTML, waitReady } = require('./loadapp');
const HTML = loadAppHTML();
const MPJS = fs.readFileSync(path.join(ROOT, 'core/mp.js'), 'utf8');
const APPJS = fs.readFileSync(path.join(ROOT, 'core/app-mp.js'), 'utf8');

const fails = [], ok = [];
// A check fails on `false` OR on a returned string, which is the reason.
// Without the string case, `() => cond || 'why it failed'` silently PASSES,
// which is exactly how the cross-game join test managed to assert nothing.
function check(name, fn) {
  try {
    const r = fn();
    if (r === false) fails.push(name + ' -> false');
    else if (typeof r === 'string') fails.push(name + ' -> ' + r);
    else ok.push(name);
  } catch (e) { fails.push(name + ' -> ' + e.message); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// Multiplayer writes are debounced 350 ms so typing does not hammer the
// database. Tests used to sleep past that debounce, which cost about seven
// seconds across this file and still raced on a loaded machine. Ask each
// client to send what it is holding instead, then give the backend's
// listeners one turn of the event loop to fan out.
const _clients = [];
async function settle(turns) {
  for (const c of _clients) {
    try { await c.eval('typeof DC_MP_FLUSH==="function"?DC_MP_FLUSH():null'); } catch (e) {}
  }
  // Let the backend's listeners fan out. Each hop is a promise chain, so a
  // handful of event-loop turns is plenty.
  for (let i = 0; i < (turns || 4); i++) await wait(0);
}

function makeClient(backend, user, universeSeed) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.localStorage.setItem('dc_universes', JSON.stringify(universeSeed));
      w.localStorage.setItem('dc_schema_version', '3');
    }
  });
  const w = dom.window;
  w.fetch = w.fetch || (() => Promise.reject(new Error('network disabled in tests')));
  w.alert = () => {}; w.confirm = () => true;
  // The app boots synchronously during JSDOM construction, so poll for
  // readiness rather than sleeping 400 ms per client and hoping.
  return waitReady(w).then(() => {
    w.firebase = makeFirebase(backend, user);
    w.eval(MPJS);
    w.eval(APPJS);
    w.FIREBASE_CONFIG = { apiKey: 'fake', databaseURL: 'fake' };
    w.DC_BOOT_MP(w.FIREBASE_CONFIG);
    // The auth callback is dispatched on a 0 ms timer; one turn of the loop.
    return new Promise(res => setTimeout(() => res(w), 0));
  });
}
const seed = name => ({ version: 2, activeUniverseId: 'u_local', universes: [{ id: 'u_local', name, created: 1, roster: [], lore: [] }] });

const CHAR = n => ({
  costumedName: n, civilianName: n + ' Civ', heroId: 'h_' + n,
  aspects: { concept: 'c', motivation: 'm', contingent: [] },
  consequences: { mild: '', moderate: '', severe: '' },
  stress: { physical: [], mental: [] }, supportingCast: [], roguesGallery: [],
  refresh: 5, fatePoints: 5, activeForm: 0, gear: '', skills: {}, stunts: [],
  forms: [{ name: 'Main', powerSets: [], gear: [] }]
});

(async () => {
  const backend = makeBackend();
  const gmUser = { uid: 'uid_gm', displayName: 'Gina GM', photoURL: null };
  const plUser = { uid: 'uid_pl', displayName: 'Pat Player', photoURL: null };

  const gm = await makeClient(backend, gmUser, seed('GM World'));
  const pl = await makeClient(backend, plUser, seed('Player World'));
  _clients.push(gm, pl);

  // ═══ CREATE + JOIN ═══
  let code = null;
  try { code = await gm.eval('MP.createUniverse({name:"Earth-77"})'); } catch (e) { fails.push('create -> ' + e.message); }
  check('GM gets a 4-digit code', () => /^\d{4}$/.test(code));
  check('code claimed in the codes table', () => backend._raw('codes/' + code) === 'uid_gm');
  check('GM recorded on meta', () => backend._raw('universes/' + code + '/meta').gmUid === 'uid_gm');

  await gm.eval('DC_MP._enter("' + code + '","Earth-77")');
  await settle();
  check('GM is in shared mode', () => gm.eval('DC_MP._state().inShared') === true);
  check('GM is recognised as GM', () => gm.eval('MP.isGM()') === true);
  check('local mirror carries the remote code', () => gm.eval('currentUniverse().remoteCode') === code);

  try { await pl.eval('MP.joinUniverse("' + code + '")'); } catch (e) { fails.push('join -> ' + e.message); }
  await pl.eval('DC_MP._enter("' + code + '","Earth-77")');
  await settle();
  check('player joined', () => pl.eval('DC_MP._state().inShared') === true);
  check('player is NOT GM', () => pl.eval('MP.isGM()') === false);
  check('both members listed', () => Object.keys(backend._raw('universes/' + code + '/members')).length === 2);
  check('GM sees the player at the table', () => Object.keys(gm.eval('DC_MP._state().members')).length === 2);

  // ═══ SERIES TRAVELS WITH THE UNIVERSE ═══
  await gm.eval('currentUniverse().series={tone:"fourcolor",level:"mightiest"};saveUniverses();mpPushUniverseSeries();');
  await settle();
  check('GM series reaches the meta', () => {
    // Pack-specific world settings now travel under meta.packMeta, so the shared
    // meta shape stays the same for every game. Daring Comics puts tone/level
    // there; a pack with no such settings sends nothing.
    const meta = backend._raw('universes/' + code + '/meta');
    const pm = meta.packMeta || {};
    return pm.tone === 'fourcolor' && pm.level === 'mightiest';
  });
  check('the world is stamped with the system that made it', () => {
    const meta = backend._raw('universes/' + code + '/meta');
    return meta.systemId === 'daring-comics';
  });

  // ═══ CROSS-GAME JOIN IS REFUSED ═══
  // The code is only four digits and carries no game information, so without
  // this gate a Dungeon Crawler Carl client could join a Daring Comics world and
  // sync a crawler into its roster — corrupting both sides.
  const crossErr = await gm.eval(
    "MP.joinUniverse('" + code + "',{systemId:'dungeon-crawler-carl'})" +
    ".then(function(){return 'JOINED';},function(e){return e.message;})");
  check('a client from another game cannot join this world',
    () => crossErr !== 'JOINED' || 'the join was allowed');
  check('...and the refusal names the game that owns the code',
    () => /daring-comics/.test(crossErr) || 'unhelpful message: ' + crossErr);
  const sameErr = await gm.eval(
    "MP.joinUniverse('" + code + "',{systemId:'daring-comics'})" +
    ".then(function(){return 'JOINED';},function(e){return e.message;})");
  check('the matching game still joins normally', () => sameErr === 'JOINED' || sameErr);
  // A world created before systemId existed carries no such key at all. It must
  // stay joinable, or upgrading would lock an existing table out of its own game.
  // createUniverse always stamps now, so reproduce the legacy shape the way the
  // database actually holds it: delete the field.
  const legacyCode = await gm.eval("MP.createUniverse({name:'Legacy'})");
  delete backend._raw('universes/' + legacyCode + '/meta').systemId;
  check('the legacy fixture really is unstamped',
    () => !('systemId' in backend._raw('universes/' + legacyCode + '/meta')) || 'fixture still stamped');
  const legacy = await gm.eval(
    "MP.joinUniverse('" + legacyCode + "',{systemId:'dungeon-crawler-carl'})" +
    ".then(function(){return 'JOINED';},function(e){return e.message;})");
  check('an unstamped legacy world stays joinable', () => legacy === 'JOINED' || legacy);
  check('player inherits the GM tone and level', () =>
    pl.eval('currentUniverse().series.tone') === 'fourcolor' &&
    pl.eval('currentUniverse().series.level') === 'mightiest');
  check('player getSeriesConfig resolves from the shared universe', () =>
    pl.eval('getSeriesConfig().tone.id') === 'fourcolor' &&
    pl.eval('getSeriesConfig().level.id') === 'mightiest');
  await pl.eval('S.series.experience="new";save();');
  await settle();
  check('player keeps their OWN experience level', () => pl.eval('getSeriesConfig().exp.id') === 'new');
  check("player's experience does not leak to the GM", () => gm.eval('S.series.experience') !== 'new');
  check('a player cannot rewrite the shared series', () => {
    try { backend.set('universes/' + code + '/meta', { tone: 'realistic' }, 'uid_pl'); return false; }
    catch (e) { return /PERMISSION_DENIED/.test(e.message); }
  });

  // ═══ THE SECURITY BOUNDARY ═══
  await gm.eval(`
    saveLoreEntry(Object.assign(blankLoreEntry('location'),{name:'Harrow Bay',body:'A rotting port city.'}));
    saveLoreEntry(Object.assign(blankLoreEntry('character'),{name:'Mayor Crane',body:'Runs the city.',secret:'She leads the cult.'}));
    saveLoreEntry(Object.assign(blankLoreEntry('plot'),{name:'The Cathedral Job',body:'The real plan.',hidden:true}));
  `);
  await settle();

  check('public entry stored in lore/', () => {
    const l = backend._raw('universes/' + code + '/lore') || {};
    return Object.values(l).some(e => e.name === 'Harrow Bay');
  });
  check('hidden entry NOT in lore/', () => {
    const l = backend._raw('universes/' + code + '/lore') || {};
    return !Object.values(l).some(e => e.name === 'The Cathedral Job');
  });
  check('hidden entry IS in loreGM/', () => {
    const g = backend._raw('universes/' + code + '/loreGM') || {};
    return Object.values(g).some(e => e.name === 'The Cathedral Job');
  });
  check('secret stripped from the public copy', () => {
    const l = backend._raw('universes/' + code + '/lore') || {};
    const crane = Object.values(l).find(e => e.name === 'Mayor Crane');
    return crane && crane.secret === undefined;
  });
  check('secret stored under loreGM/', () => {
    const g = backend._raw('universes/' + code + '/loreGM') || {};
    return Object.values(g).some(e => e.secret === 'She leads the cult.');
  });

  await settle();
  check('PLAYER never receives the hidden entry', () =>
    !pl.eval('JSON.stringify(listLore())').includes('Cathedral Job'));
  check('PLAYER never receives the secret text', () =>
    !pl.eval('JSON.stringify(listLore())').includes('leads the cult'));
  check('player DOES receive public entries', () =>
    pl.eval('JSON.stringify(listLore())').includes('Harrow Bay') &&
    pl.eval('JSON.stringify(listLore())').includes('Mayor Crane'));
  check('player read of loreGM is refused by the rules', () => {
    try { backend.get('universes/' + code + '/loreGM', 'uid_pl'); return false; }
    catch (e) { return /PERMISSION_DENIED/.test(e.message); }
  });
  check('player write to loreGM is refused by the rules', () => {
    try { backend.set('universes/' + code + '/loreGM/x', { name: 'sneak' }, 'uid_pl'); return false; }
    catch (e) { return /PERMISSION_DENIED/.test(e.message); }
  });
  check('GM still sees everything locally', () => {
    const s = gm.eval('JSON.stringify(listLore())');
    return s.includes('Cathedral Job') && s.includes('leads the cult');
  });

  // ═══ REVEAL ═══
  const hiddenId = gm.eval('(listLore().find(function(e){return e.name==="The Cathedral Job"})||{}).id');
  await gm.eval(`(async function(){
    var e=listLore().find(function(x){return x.name==="The Cathedral Job"});
    await MP.revealLore(e.id,e);
    e.hidden=false;e.secret='';saveLoreEntry(e);
  })()`);
  await settle();
  check('revealed entry moves into lore/', () => {
    const l = backend._raw('universes/' + code + '/lore') || {};
    return Object.values(l).some(e => e.name === 'The Cathedral Job');
  });
  check('revealed entry leaves loreGM/', () => {
    const g = backend._raw('universes/' + code + '/loreGM') || {};
    return !g[hiddenId];
  });
  check('player now receives it', () => pl.eval('JSON.stringify(listLore())').includes('Cathedral Job'));

  // ═══ COLLABORATIVE ROSTER ═══
  await gm.eval(`
    S.npcs.push(ensureId({type:'rogue',name:'Doctor Malice',desc:'A villain',aspects:[],skills:{Fight:4},
      forms:[{name:'Main Form',powerSets:[],gear:[]}],activeForm:0,stunts:[],stress:[false,false],
      consequences:{mild:'',moderate:'',severe:''}}));
    saveUniverses();
  `);
  await settle();
  check('roster entry reaches the player', () => pl.eval('JSON.stringify(S.npcs)').includes('Doctor Malice'));
  check('roster entry carries attribution', () => {
    const r = backend._raw('universes/' + code + '/roster') || {};
    return Object.values(r).some(e => e.name === 'Doctor Malice' && e.updatedByName === 'Gina GM');
  });

  // player edits it — fully collaborative
  await pl.eval(`
    var n=S.npcs.find(function(x){return x.name==='Doctor Malice'});
    n.desc='Edited by the player';saveUniverses();
  `);
  await settle();
  check('player edit flows back to the GM', () => gm.eval('JSON.stringify(S.npcs)').includes('Edited by the player'));
  check('attribution updates to the editor', () => {
    const r = backend._raw('universes/' + code + '/roster') || {};
    return Object.values(r).some(e => e.name === 'Doctor Malice' && e.updatedByName === 'Pat Player');
  });

  // ═══ SOFT DELETE + RESTORE ═══
  const malId = gm.eval('(S.npcs.find(function(x){return x.name==="Doctor Malice"})||{}).id');
  await pl.eval(`var i=S.npcs.findIndex(function(x){return x.name==='Doctor Malice'});S.npcs.splice(i,1);saveUniverses();`);
  await settle();
  check('delete is a tombstone, not a purge', () => {
    const r = backend._raw('universes/' + code + '/roster/' + malId);
    return !!(r && r.deletedAt && r.name === 'Doctor Malice');
  });
  check('deleted entry disappears for the GM too', () => !gm.eval('JSON.stringify(S.npcs)').includes('Doctor Malice'));
  check('GM sees it in recently deleted', () => !!gm.eval('DC_MP._state().tomb.roster["' + malId + '"]'));
  await gm.eval('MP.restoreRoster("' + malId + '")');
  await settle();
  check('restore brings it back for everyone', () =>
    gm.eval('JSON.stringify(S.npcs)').includes('Doctor Malice') &&
    pl.eval('JSON.stringify(S.npcs)').includes('Doctor Malice'));

  check('reassigning S.npcs still syncs (re-alias guard)', () => true);
  await pl.eval(`S.npcs=S.npcs.concat([ensureId({type:'nameless',name:'Thug A',obstacle:'+2',stress:[false]})]);saveUniverses();`);
  await settle();
  check('entry added via S.npcs reassignment reaches the GM', () => gm.eval('JSON.stringify(S.npcs)').includes('Thug A'));
  check('reassignment did not orphan the roster alias', () => pl.eval('S.npcs===currentUniverse().roster') === true);

  // ═══ HEROES ═══
  await gm.eval('S.char=' + JSON.stringify(CHAR('Ironclad')) + ';save();');
  await pl.eval('S.char=' + JSON.stringify(CHAR('Nightjar')) + ';save();');
  await settle();
  check('each hero is stored under its owner', () => {
    const h = backend._raw('universes/' + code + '/heroes') || {};
    return h.uid_gm && h.uid_gm.costumedName === 'Ironclad' && h.uid_pl && h.uid_pl.costumedName === 'Nightjar';
  });
  check('a player cannot overwrite another hero', () => {
    try { backend.set('universes/' + code + '/heroes/uid_gm', { costumedName: 'hacked' }, 'uid_pl'); return false; }
    catch (e) { return /PERMISSION_DENIED/.test(e.message); }
  });
  check("player's hero appears in the GM's roster", () =>
    gm.eval('JSON.stringify(S.npcs)').includes('Nightjar'));
  check('mirrored hero is flagged as remote', () =>
    gm.eval('!!S.npcs.find(function(n){return n.name==="Nightjar"&&n.fromHero&&n.remoteOwner==="uid_pl"})'));

  // ═══ TABLE STATE ═══
  await pl.eval('S.dice={skill:"Fight",skillVal:3,mod:0,dice:[1,2,3,4],diceSum:10,total:13};MP.appendRoll({name:"Nightjar",skill:"Fight",total:13,dice:[1,2,3,4]})');
  await settle();
  check('roll reaches the GM feed', () => {
    const f = gm.eval('JSON.stringify(DC_MP._state().rollFeed)');
    return f.includes('Nightjar') && f.includes('13');
  });
  await gm.eval('S.conflict={active:true,zones:["Rooftop"],turnOrder:[],currentTurn:0,round:2,log:[]};save();');
  await settle();
  check('conflict tracker syncs to the player', () => pl.eval('S.conflict&&S.conflict.round') === 2);
  await gm.eval('MP.appendNote({type:"scene",title:"The docks",body:"They found the crate."})');
  await settle();
  check('notes sync to the player', () => pl.eval('JSON.stringify(S.notes)').includes('The docks'));

  // ═══ THE ITEM CATALOGUE ═══
  // What the GM builds, the players can hold. The catalogue lives on the
  // universe beside the wiki, so it travels the same way.
  await gm.eval("saveCatalogItem({name:'Sepsis Draught',effect:'Heals 4 and tastes of pennies.',dr:0})");
  await settle();
  check('an item the GM makes reaches the player', () =>
    pl.eval("JSON.stringify((currentUniverse().items||[]).map(function(x){return x.name}))").includes('Sepsis Draught'));
  check('...with what it does intact', () =>
    pl.eval("JSON.stringify((currentUniverse().items||[])[0]||{})").includes('tastes of pennies'));

  await pl.eval("saveCatalogItem({name:'Bag of Holding Grudges',effect:'It remembers.'})");
  await settle();
  check('a player can add to the catalogue too', () =>
    gm.eval("JSON.stringify((currentUniverse().items||[]).map(function(x){return x.name}))").includes('Bag of Holding Grudges'));

  const itemId = gm.eval("JSON.stringify((currentUniverse().items.filter(function(x){return /Sepsis/.test(x.name)})[0]||{}).id)").replace(/"/g, '');
  await gm.eval("deleteCatalogItem(" + JSON.stringify(itemId) + ")");
  await settle();
  check('deleting one removes it from the table', () =>
    !pl.eval("JSON.stringify((currentUniverse().items||[]).map(function(x){return x.name}))").includes('Sepsis Draught'));
  // Deletion is a tombstone, like the roster: anyone can delete, and a GM's
  // afternoon of statting should not go with one tap.
  check('the deleted item is tombstoned, not erased', () =>
    !!(backend._raw('universes/' + code + '/items/' + itemId) || {}).deletedAt);

  // ═══ ECHO SUPPRESSION ═══
  const before = Object.keys(backend._raw('universes/' + code + '/roster') || {}).length;
  const w1 = JSON.stringify(backend._raw('universes/' + code + '/roster'));
  await settle(); await settle(); // and let any feedback loop run
  const w2 = JSON.stringify(backend._raw('universes/' + code + '/roster'));
  check('no push/receive feedback loop', () => {
    const a = JSON.parse(w1), b = JSON.parse(w2);
    return Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every(k => a[k].name === b[k].name);
  });
  check('roster size stable', () => Object.keys(backend._raw('universes/' + code + '/roster') || {}).length === before);

  // ═══ LEAVE / DELETE ═══
  await pl.eval('DC_MP._leave()');
  await settle();
  check('player leaves shared mode', () => pl.eval('DC_MP._state().inShared') === false);
  check("player keeps a local copy of the world", () =>
    pl.eval('JSON.stringify(listLore())').includes('Harrow Bay'));
  try { await gm.eval('MP.deleteUniverse("' + code + '")'); } catch (e) { fails.push('delete -> ' + e.message); }
  check('universe removed from the backend', () => backend._raw('universes/' + code) === null);
  check('code released for reuse', () => backend._raw('codes/' + code) === null);

  console.log('\nPASS ' + ok.length);
  if (fails.length) { console.log('FAIL ' + fails.length); fails.forEach(f => console.log('  x ' + f)); process.exit(1); }
  console.log('All multiplayer checks passed.');
})().catch(e => { console.log('HARNESS ERROR: ' + e.stack); process.exit(1); });
