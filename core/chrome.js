// core/chrome.js — the shell's chrome: nav, page containers, modal shells.
//
// This markup used to live in index.html. With one entry file per game it would
// have been duplicated once PER GAME, so it lives here instead and is injected
// as the first step of boot. A game's .html file is now just a title, a
// stylesheet link and its script tags.
//
// Load-order rule (SHELL-PLAN.md §10): this file only DECLARES. buildShellChrome()
// touches the DOM and is called by the boot IIFE in core/mp-boot.js, never at
// load time.

const SHELL_CHROME = `<nav id="nav">
  <button class="nb active" onclick="showTab('hero')" id="nb-hero">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>Hero
  </button>
  <button class="nb" onclick="showTab('hud')" id="nb-hud">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>HUD
  </button>
  <button class="nb" onclick="showTab('npcs')" id="nb-npcs">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3 2.7-5 6-5m4 0c3.3 0 6 2 6 5"/></svg>NPCs
  </button>
  <button class="nb" onclick="showTab('map')" id="nb-map">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>Map
  </button>
  <button class="nb" onclick="showTab('dice')" id="nb-dice">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>Dice
  </button>
  <button class="nb" onclick="showTab('conflict')" id="nb-conflict">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>Conflict
  </button>
  <button class="nb" onclick="showTab('notes')" id="nb-notes">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>Notes
  </button>
  <button class="nb" onclick="openSecondScreen()" id="nb-second">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>Screen
  </button>
  <button class="nb" onclick="showTab('print')" id="nb-print">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print
  </button>
  <button class="nb" onclick="showTab('wiki')" id="nb-wiki">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="16" y2="11"/></svg>Wiki
  </button>
  <div id="theme-wrap"></div>
</nav>
<!-- The table clock. It lives outside the pages because the floor matters on
     every one of them: the map you are drawing, the Mobs you are fighting and
     the salvage you are rolling all follow it. Empty for a pack with no such
     idea, which is every pack but one so far. -->
<div id="floor-strip"></div>
<div class="page roller-page active" id="page-hero"><div id="hero-main" class="roller-main"><div id="hero-creation"></div><div id="hero-sheet" style="display:none"></div></div><div id="hero-dice-sidebar" class="roller-side"></div></div>
<div class="page roller-page" id="page-hud"><div id="hud-main" class="roller-main"><div id="hud-content"></div></div><div id="hud-dice-sidebar" class="roller-side"></div></div>
<div class="page" id="page-npcs"><div id="npcs-content"></div></div>
<div class="page" id="page-map"><div id="map-content"></div></div>
<div class="page" id="page-dice"><div id="dice-content"></div></div>
<div class="page" id="page-conflict"><div id="conflict-content"></div></div>
<div class="page" id="page-notes"><div id="notes-content"></div></div>
<div class="page" id="page-print"><div id="print-content"></div></div>
<div class="page" id="page-wiki"><div id="wiki-content"></div></div>
<div class="modal-overlay" id="slot-modal"><div class="modal-inner"><div class="card" id="slot-modal-body"></div></div></div>
<div class="modal-overlay" id="power-modal"><div class="modal-inner"><div id="power-modal-body"></div></div></div>
<div class="modal-overlay" id="gear-modal"><div class="modal-inner"><div id="gear-modal-body"></div></div></div>
<div class="modal-overlay" id="npc-modal"><div class="modal-inner"><div class="card" id="npc-modal-body"></div></div></div>
<div class="modal-overlay" id="universe-modal"><div class="modal-inner"><div id="universe-modal-body"></div></div></div>
<div class="modal-overlay" id="lore-modal"><div class="modal-inner"><div class="card" id="lore-modal-body"></div></div></div>
<div class="modal-overlay" id="ai-modal"><div class="modal-inner"><div class="card" id="ai-modal-body"></div></div></div>
<div class="modal-overlay" id="npc-export-modal"><div class="modal-inner"><div class="card" id="npc-export-modal-body"></div></div></div>`;

// Inject the chrome, then let the active pack supply its fonts and themes.
function buildShellChrome() {
  if (document.getElementById('nav')) return;          // already built
  const host = document.createElement('div');
  host.innerHTML = SHELL_CHROME;
  while (host.firstChild) document.body.appendChild(host.firstChild);
  applySysFonts();
  renderThemeSwatches();
  applyHudTab();
  applySecondScreenTab();
}

// The pop-out second screen is Daring Comics' — it reads costumedName, stress
// and Fate Points, and draws 4dF. It was shown for every pack regardless, so on
// Dungeon Crawler Carl it opened a window that said "Waiting…" forever and threw
// on the first state push. A pack declares `secondScreen: true` or has no button.
function applySecondScreenTab() {
  const btn = document.getElementById('nb-second');
  if (!btn) return;
  if (!(SYS && SYS.secondScreen)) btn.remove();
}

// The HUD tab is a pack's own play screen — what you need in front of you
// mid-fight, rather than the whole sheet. The shell owns the nav slot and the
// container and knows nothing else about it: a pack that declares no
// renderHUD() has no tab at all, the same way a pack that declares no themes
// gets no swatch row. The button is REMOVED rather than hidden, because .nb
// carries display:flex and would win against [hidden] or an inline style.
function applyHudTab() {
  const btn = document.getElementById('nb-hud');
  if (!btn) return;
  if (!(SYS && typeof SYS.renderHUD === 'function')) btn.remove();
}

// ═══════════════════════════════════════════════════════════
// THE ANCHORED POPOVER
// ═══════════════════════════════════════════════════════════
// A small panel that appears next to the thing you clicked. Two things use it —
// the roller, summoned from a Stat or Skill row, and the icon picker, summoned
// from a Skill row — so it holds no opinion about its contents.
//
// Mounted on <body> rather than inside a page: a block repaint replaces the row
// it is anchored to, and a panel living inside that row would be torn out from
// under the player mid-interaction.
function popEl() {
  let el = document.getElementById('shell-pop');
  if (!el) {
    el = document.createElement('div');
    el.id = 'shell-pop';
    el.className = 'roll-pop';
    document.body.appendChild(el);
  }
  return el;
}

function popOpen(html, anchor) {
  const el = popEl();
  el.innerHTML = '<button class="roll-pop-x" onclick="popClose()" title="Close">×</button>' + html;
  el.classList.add('open');
  popPosition(el, anchor);
  popBind();
  return el;
}

function popClose() {
  const el = document.getElementById('shell-pop');
  if (!el) return;
  el.classList.remove('open');
  el.innerHTML = '';
}

function popIsOpen() {
  const el = document.getElementById('shell-pop');
  return !!(el && el.classList.contains('open'));
}

// Beside the anchor if it fits, flipped to its left if it does not, and never
// off the edge. JSDOM returns zeroed rects, so this is a no-op under test —
// which is why the suites assert what the popover CONTAINS, not where it is.
function popPosition(el, anchor) {
  if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return;
  let r;
  try { r = anchor.getBoundingClientRect(); } catch (e) { return; }
  const w = el.offsetWidth || 300, vw = window.innerWidth || 1024;
  let left = (window.pageXOffset || 0) + Math.min(r.right + 10, vw - w - 12);
  if (r.right + 10 > vw - w - 12) left = (window.pageXOffset || 0) + Math.max(12, r.left - w - 10);
  el.style.left = Math.max(8, left) + 'px';
  el.style.top = Math.max(8, (window.pageYOffset || 0) + r.top - 4) + 'px';
}

let _popBound = false;
function popBind() {
  if (_popBound) return;
  _popBound = true;
  document.addEventListener('mousedown', function (ev) {
    if (!popIsOpen()) return;
    const el = document.getElementById('shell-pop');
    if (el && el.contains(ev.target)) return;
    popClose();
  }, true);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') popClose();
  }, true);
}

// Filled by the pack. Kept in the shell so showTab() has one thing to call and
// a pack cannot end up owning a surface the shell cannot see — the mistake that
// left Dungeon Crawler Carl with no dice roller. See DEBRIEF.md.
function renderHUD() {
  const el = document.getElementById('hud-content');
  if (!el) return;
  el.innerHTML = (SYS && typeof SYS.renderHUD === 'function')
    ? (SYS.renderHUD(typeof S !== 'undefined' && S ? S.char : null) || '') : '';
  // The HUD wears the same layout as the Hero page: a sticky roller beside it on
  // desktop, and a collapsible bar inside the content on mobile (the pack puts
  // that one where it wants it). The rail lives outside #hud-content, so it is
  // filled once the pack's markup is in the DOM.
  if (typeof renderRollSidebar === 'function' && SYS && typeof SYS.renderHUD === 'function') {
    renderRollSidebar('hud-dice-sidebar', 'hs');
  }
  if (typeof markRollSurfaces === 'function') markRollSurfaces();
}

// A pack asks for the web fonts its theme uses. The shell ships none, so a pack
// that declares no fonts simply renders in the system stack.
function applySysFonts() {
  const fonts = (SYS && SYS.fonts) || [];
  fonts.forEach(function (href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  });
}

// The swatch row was hardcoded comic-book colours in the markup. Each pack now
// declares its own [value, label, gradientStops] triples; a pack with none gets
// no swatch row at all, rather than another game's palette.
// The persistent floor control. A pack that does not track a floor gets nothing,
// and the strip collapses.
function renderFloorStrip() {
  const el = document.getElementById('floor-strip');
  if (!el) return;
  const uses = typeof sysUsesBlocks === 'function' && sysUsesBlocks()
    && typeof S !== 'undefined' && S && S.floor !== undefined && S.floor !== null;
  if (!uses) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML =
    '<button class="uni-fbtn" title="Up a ' + esc(lexL('logBreak')) + '" onclick="sysFloorStep(-1)">\u2212</button>' +
    '<span class="fs-num">' + esc(lexU('logBreak')) + ' ' + esc(String(S.floor)) + '</span>' +
    '<button class="uni-fbtn" title="Down a ' + esc(lexL('logBreak')) + '" onclick="sysFloorStep(1)">+</button>' +
    '<span class="fs-hint">' + esc(lexU('logBreak')) + ' sets Mob DR, salvage and pet Ranks</span>';
}

function renderThemeSwatches() {
  const wrap = document.getElementById('theme-wrap');
  if (!wrap) return;
  const themes = (SYS && SYS.themes) || [];
  if (!themes.length) { wrap.style.display = 'none'; return; }
  let active = '';
  try { active = localStorage.getItem(storeKey('theme')) || ''; } catch (e) {}
  if (!active) active = (SYS && SYS.defaultTheme) || '';
  wrap.style.padding = '8px 10px';
  wrap.style.borderTop = '1px solid var(--border)';
  let h = '<div style="font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;'
        + 'color:var(--muted);margin-bottom:6px;text-align:center">Theme</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center">';
  themes.forEach(function (t) {
    h += '<button class="theme-swatch' + (t[0] === active ? ' active' : '') + '"'
       + ' data-theme="' + t[0] + '" title="' + t[1] + '"'
       + ' onclick="setTheme(' + String.fromCharCode(39) + t[0] + String.fromCharCode(39) + ')"'
       + ' style="background:linear-gradient(135deg,' + t[2] + ')"></button>';
  });
  wrap.innerHTML = h + '</div>';
  if (active) document.documentElement.setAttribute('data-theme', active);
}
