// core/system.js — the system-pack registry.
//
// This is the seam between the shell (engine) and a game's ruleset. A pack
// calls registerSystem() at load; the shell reads the active manifest through
// SYS and the lexicon through lex().
//
// PHASE 2 STATUS: the registry is live and inert. Nothing in core/ reads SYS
// yet — the Daring Comics ruleset is still wired in directly. Routing the
// existing constants and derive-formulas through here is Phase 2 proper; see
// SHELL-PLAN.md §4. Loading this file changes no behaviour.
//
// Load-order rule (SHELL-PLAN.md §10): this file only DECLARES. A pack may call
// registerSystem() at load time, but nothing here runs against the DOM or
// against app state until the boot IIFE in core/mp-boot.js.

// ─── where the shell lives ──────────────────────────────────────────────────
// Each game sits in its own folder (dcc/, daring-comics/, ...) so its Pages URL
// is a clean /dcc/ rather than /dungeon-crawler-carl.html. That puts the entry
// file one level below core/, which breaks any path resolved at RUNTIME against
// the document — the lazy multiplayer and firebase-config loads. Script tags in
// the entry file are fine because they are written relative to it.
//
// So derive the shell root from this file's own <script src> once, at load, and
// build runtime paths from it. Works at any folder depth, and on a user site or
// a project site alike.
// Split out so it is testable: the jsdom harness inlines scripts, which leaves
// document.currentScript null, so the derivation itself has to be checked directly.
function shellBaseFrom(src) {
  if (!src) return '';
  return String(src).replace(/core\/system\.js(\?.*)?$/, '');
}
const SHELL_BASE = (function () {
  try { return shellBaseFrom(document.currentScript && document.currentScript.src); }
  catch (e) { return ''; }
})();
function shellPath(rel) { return SHELL_BASE + rel; }

// ─── lexicon ────────────────────────────────────────────────────────────────
// User-facing vocabulary. The shell is deliberately neutral (decision 4); a
// pack overrides only the words its game actually uses differently.
//
//   Daring Comics -> universe:'Universe',  hero:'Hero',     region:'Neighborhood'
//   Dungeon Crawler Carl -> universe:'Crawl', hero:'Crawler', region:'Floor'
const DEFAULT_LEXICON = {
  universe: 'World',      universes: 'Worlds',
  hero: 'Character',      heroes: 'Characters',
  roster: 'Roster',       npc: 'NPC',            npcs: 'NPCs',
  team: 'Party',          region: 'Region',      regions: 'Regions',
  logBreak: 'Chapter',    log: 'Journal',        wiki: 'Codex',
  save: 'Save',           saves: 'Saves',        sheet: 'Character Sheet',
};

const SYSTEMS = {};
let SYS = null;

// Register a system pack. Returns the stored manifest.
//
// Required: id, name. Everything else is optional — the shell must degrade to
// a sane default for any key a pack omits, so that a half-finished pack still
// boots. That is the property that makes a new game cheap to start.
function registerSystem(def) {
  if (!def || !def.id) throw new Error('registerSystem: a pack needs an id');
  if (SYSTEMS[def.id]) throw new Error('registerSystem: duplicate id ' + def.id);
  const pack = Object.assign({
    name: def.id,
    theme: null,          // data-theme value this pack's CSS defines
    themes: [],           // [[value, label, 'cssGradient'], ...] for the swatch row
    fonts: [],            // Google-Fonts hrefs this pack needs (shell ships none)
    lexicon: {},
    schema: { identity: [], blocks: [] },
    creation: [],
    derive: {},
    dice: null,
    catalogs: {},
    npcTypes: [],
    loreTypes: null,      // null = shell defaults
    generators: {},
    migrate: [],
  }, def);
  pack.lexicon = Object.assign({}, DEFAULT_LEXICON, def.lexicon || {});
  SYSTEMS[pack.id] = pack;
  if (!SYS) SYS = pack;   // first pack registered wins until sysActivate() says otherwise
  return pack;
}

function listSystems() { return Object.keys(SYSTEMS).map(k => SYSTEMS[k]); }

// Choose the active pack: explicit ?system=, then remembered choice, then the
// only one loaded. Call from boot, not at load time.
function sysActivate(id) {
  const want = id
    || new URLSearchParams(location.search).get('system')
    || (function () { try { return localStorage.getItem('rpg:system'); } catch (e) { return null; } })();
  if (want && SYSTEMS[want]) SYS = SYSTEMS[want];
  else if (!SYS) SYS = listSystems()[0] || null;
  if (SYS) { try { localStorage.setItem('rpg:system', SYS.id); } catch (e) {} }
  return SYS;
}

// Word lookup. Falls back to the neutral default, then to the key itself, so a
// missing entry shows something readable instead of "undefined".
function lex(key) {
  return (SYS && SYS.lexicon && SYS.lexicon[key]) || DEFAULT_LEXICON[key] || key;
}

// Capitalised / lower variants, for mid-sentence copy.
function lexU(key) { const s = lex(key); return s.charAt(0).toUpperCase() + s.slice(1); }
function lexL(key) { return lex(key).toLowerCase(); }

// A value as a JavaScript literal, safe to embed in a DOUBLE-QUOTED HTML
// attribute. JSON.stringify alone is NOT safe here: it emits its own double
// quotes, which terminate the attribute early. That mistake silently killed
// every handler on the custom Race/Class card — the markup parsed, so nothing
// threw; the buttons simply did nothing. Use this for any argument that is not
// a bare number.
function jsArg(v) { return JSON.stringify(v).replace(/"/g, '&quot;'); }

// Per-system storage namespace, replacing the flat dc_* keys (Phase 5).
function sysKey(name) { return 'rpg:' + (SYS ? SYS.id : 'default') + ':' + name; }

// Look up a declared block by id, e.g. sysBlock('skills').
function sysBlock(id) {
  return (SYS && SYS.schema && SYS.schema.blocks || []).find(b => b.id === id) || null;
}

// Resolve a 'derive.foo' string reference (used in block declarations) to the
// pack's function. Returns null when absent so callers can fall back.
function sysDerive(ref) {
  if (typeof ref === 'function') return ref;
  if (typeof ref !== 'string') return null;
  const name = ref.replace(/^derive\./, '');
  return (SYS && SYS.derive && SYS.derive[name]) || null;
}

// ─── scratch storage for block-rendered packs ───────────────────────────────
// Packs that render through core/blocks.js are NOT wired into the save-file
// system yet (that is phase 5, which namespaces storage and stamps saves with a
// systemId). Until then they persist to their own key. This is what keeps a
// half-built pack from writing its character into whatever save file happens to
// be loaded — which, since save() writes all of S, would clobber it.
// Returns the character. Pass raw=true for the whole envelope. A v1 scratch key
// held the bare character, so unwrap only what is actually wrapped.
function sysScratchLoad(raw) {
  try {
    const d = localStorage.getItem(sysKey('scratch'));
    if (!d) return null;
    const p = JSON.parse(d);
    if (raw) return p;
    return (p && p.v === 2) ? (p.char || null) : p;
  }
  catch (e) { return null; }
}
// The session keys that belong to the table rather than to the character sheet.
// save() used to write only the character while flashing "Saved", so the Crawl
// Log, the floor, the map and an entire in-progress fight were silently dropped
// on reload.
const SYS_SESSION_KEYS = ['notes', 'floor', 'conflict', 'regions', 'activeRegion', 'npcs', 'universeId'];

function sysScratchSave(char, session) {
  try {
    const payload = { char: char, session: session || null, v: 2 };
    localStorage.setItem(sysKey('scratch'), JSON.stringify(payload));
    return true;
  } catch (e) { return false; }
}

// Pull the session half back out, or null if this scratch key predates it.
function sysScratchSession() {
  const d = sysScratchLoad(true);
  return (d && d.v === 2) ? (d.session || null) : null;
}

// The character's display name, whatever the pack calls that field. Reads the
// first non-empty identity field the manifest declares, so the shared tabs (map,
// log, HUD) stop reaching for Daring Comics' `costumedName` directly.
function sysCharName(char) {
  if (!char) return '';
  const ids = (SYS && SYS.schema && SYS.schema.identity) || [];
  for (const f of ids) {
    const v = char[f];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return String(char.costumedName || char.name || '').trim();
}

// ─── ruleset-constant fallbacks ─────────────────────────────────────────────
// Phase 2 is not done: ~97 references to Daring Comics constants (SERIES_TONES,
// SKILLS, POWERS, LADDER...) are still hard-wired into core/. That was invisible
// while every page loaded the Daring Comics data; one entry file per game
// exposed it immediately. Routing them all through SYS is Phase 2. Until then
// these helpers let the shell degrade instead of throwing for a pack that has
// no such data.
function sysList(globalName, packKey) {
  if (packKey && SYS && SYS.catalogs && Array.isArray(SYS.catalogs[packKey])) return SYS.catalogs[packKey];
  try {
    const v = eval(globalName);            // eslint-disable-line no-eval
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
// True when the active pack uses Daring Comics' series model (tone/level/exp).
function sysHasSeries() {
  return sysList('SERIES_TONES').length > 0;
}
