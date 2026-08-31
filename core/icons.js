// core/icons.js — one icon picker, instantiated.
//
// The icons come from game-icons.net, but there is no game-icons.net API: this
// is Iconify's search endpoint filtered to that set. They are drawn as CSS
// masks rather than <img>, which is why they take each pack's theme colour
// instead of arriving as fixed-colour art.
//
// This file exists because the picker was already written twice — pdIcon* in
// core/util.js for Daring Comics' powers, mapIcon* in core/map.js for map cells
// — with the same fetch, the same 250ms debounce, the same markup and the same
// error string, differing only in which element ids and which variable held the
// selection. Items and Skills would have made four copies. Same shape as the
// roller in core/dice.js: one component, instance-scoped ids, state found by id
// rather than held in a pile of module-level variables.

const ICON_API = 'https://api.iconify.design/search?query=';
const ICON_PREFIX = 'game-icons';

// id -> {value, timer, fallback, onPick, els}
const ICON_PICKERS = {};

function iconUrl(id) { return 'https://api.iconify.design/' + encodeURIComponent(id) + '.svg'; }
// Kept: core/print.js and core/map.js have called it this since the powers picker.
function pdIconUrl(id) { return iconUrl(id); }

// A game-icons id ("game-icons:city") or a bare slug ("city", "fire-ray").
// Emoji and free text will not match, so legacy emoji icons still render as text.
function iconIsSlug(v) { return /^(game-icons:)?[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(String(v || '')); }
function iconId(v) { return String(v).indexOf(':') >= 0 ? String(v) : ICON_PREFIX + ':' + v; }

// One icon, in the current text colour unless told otherwise. Returns '' for no
// icon and the raw value for a legacy emoji, so callers can drop it straight
// into markup without checking first.
//
// Pass no size to leave the dimensions to CSS: the map cell sizes its icons from
// a class that changes at a breakpoint, and an inline width would beat it.
function iconHTML(value, size, color, cls) {
  if (!value) return '';
  if (!iconIsSlug(value)) return esc(String(value));      // legacy emoji / free text
  const u = iconUrl(iconId(value));
  return '<span class="pw-icon' + (cls ? ' ' + cls : '') + '" style="' +
    (size ? 'width:' + size + 'px;height:' + size + 'px;' : '') +
    (color ? 'color:' + color + ';' : '') +
    '-webkit-mask-image:url(\'' + u + '\');mask-image:url(\'' + u + '\')"></span>';
}

function iconInit(id, opts) {
  const o = opts || {};
  const st = ICON_PICKERS[id] || (ICON_PICKERS[id] = { value: '', timer: null });
  if (o.value !== undefined) st.value = o.value || '';
  if (o.fallback !== undefined) st.fallback = o.fallback || '';
  if (o.onPick !== undefined) st.onPick = o.onPick;
  // A picker grafted onto markup that already exists — Daring Comics' power
  // editor — names the elements it already has.
  st.els = Object.assign({
    preview: id + '-icon-preview',
    search: id + '-icon-search',
    results: id + '-icon-results',
  }, o.els || {});
  return st;
}
function iconState(id) { return ICON_PICKERS[id] || iconInit(id, {}); }
function iconValue(id) { return iconState(id).value || ''; }
function iconSet(id, v) { iconState(id).value = v || ''; }

// The picker's markup. Drop it into a form; call iconSearch(id) once it is in
// the DOM to fill the results.
function iconField(id, opts) {
  const o = opts || {}, st = iconState(id);
  return '<div class="form-group"><label>' + esc(o.label || 'Icon') +
    ' <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">' +
    '(from game-icons.net)</span></label>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
    '<div id="' + esc(st.els.preview) + '" class="ic-preview"></div>' +
    '<input id="' + esc(st.els.search) + '" placeholder="' +
    esc(o.placeholder || 'Search icons — sword, potion, skull…') +
    '" oninput="iconSearch(&#39;' + esc(id) + '&#39;)"></div>' +
    '<div id="' + esc(st.els.results) + '" class="ic-results"></div></div>';
}

function iconPreview(id) {
  const st = iconState(id), el = document.getElementById(st.els.preview);
  if (!el) return;
  el.innerHTML = st.value
    ? iconHTML(st.value, 26, 'var(--accent)')
    : '<span style="font-size:9px;color:var(--muted);text-align:center;line-height:1.1">no icon</span>';
}

function iconResults(id, icons) {
  const st = iconState(id), res = document.getElementById(st.els.results);
  if (!res) return;
  if (!icons || !icons.length) {
    res.innerHTML = '<div class="ic-note">No icons found — try another word ' +
      '(sword, potion, skull, shield).</div>';
    return;
  }
  res.innerHTML = icons.map(function (ic) {
    return '<button type="button" class="ic-opt' + (ic === st.value ? ' sel' : '') + '"' +
      ' data-icon="' + esc(ic) + '" onclick="iconPick(&#39;' + esc(id) + '&#39;,&#39;' + esc(ic) + '&#39;)"' +
      ' title="' + esc(ic.replace(ICON_PREFIX + ':', '')) + '">' +
      iconHTML(ic, 24) + '</button>';
  }).join('');
}

// Debounced, because this fires on every keystroke. An empty box searches the
// fallback term the caller supplied — the item's own name, usually — so the
// panel opens with something plausible rather than blank.
function iconSearch(id, q) {
  const st = iconState(id);
  const inp = document.getElementById(st.els.search);
  const res = document.getElementById(st.els.results);
  const query = (typeof q === 'string' ? q : (inp ? inp.value : '')) || '';
  const term = query.trim() || st.fallback || 'sword';
  clearTimeout(st.timer);
  // No fetch at all — an embedded view, or a test harness. Say so rather than
  // throwing out of a setTimeout where nothing can catch it.
  if (typeof fetch !== 'function') {
    if (res) res.innerHTML = '<div class="ic-note">Icon search needs a connection.</div>';
    return;
  }
  if (res && !res.innerHTML) res.innerHTML = '<div class="ic-note">Searching game-icons.net…</div>';
  st.timer = setTimeout(function () {
    fetch(ICON_API + encodeURIComponent(term) + '&prefix=' + ICON_PREFIX + '&limit=48')
      .then(function (r) { return r.json(); })
      .then(function (d) { iconResults(id, d.icons || []); })
      .catch(function () {
        // The app runs offline and from file://, so this is expected, not
        // exceptional. Say what happened rather than leaving a blank panel.
        if (res) res.innerHTML = '<div class="ic-note">Couldn’t reach game-icons.net. ' +
          'Check your connection and try again.</div>';
      });
  }, 250);
}

// Clicking the selected icon again clears it — there is no other way to say
// "actually, no icon".
function iconPick(id, val) {
  const st = iconState(id);
  st.value = (val === st.value) ? '' : val;
  iconPreview(id);
  const res = document.getElementById(st.els.results);
  if (res) {
    [].slice.call(res.querySelectorAll('.ic-opt')).forEach(function (b) {
      b.classList.toggle('sel', b.getAttribute('data-icon') === st.value);
    });
  }
  if (typeof st.onPick === 'function') { try { st.onPick(st.value); } catch (e) {} }
}
