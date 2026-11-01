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

// ── loading ─────────────────────────────────────────────────────────────────
// Icons arrive in bulk, not one request each. Iconify's public API answers
// ~150 quick requests and then 429s the rest, and a mask whose fetch fails
// paints nothing — so a 48-result picker page, re-searched on every keystroke,
// left most buttons blank. Each batch of ids is now one JSON request, and icons
// are served from an in-memory cache as data: URIs. An id not loaded yet draws
// as an empty placeholder tagged "#gi=<id>", swapped in place when its batch
// lands.
//
// ICON_FLY holds one promise per id that is queued or in flight, so a re-render
// mid-fetch (the sheet re-renders on every save) joins that request instead of
// queueing a duplicate — duplicates are what pushed Daring Comics back into
// the 429s.
const ICON_BASE = 'https://api.iconify.design/';
const ICON_PEND = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E#gi=';
const ICON_SVG = {}, ICON_MISS = {}, ICON_FLY = {};
let iconQueue = [], iconTimer = null;

function iconSplit(id) {
  const i = String(id).indexOf(':');
  return i < 0 ? [ICON_PREFIX, String(id)] : [id.slice(0, i), id.slice(i + 1)];
}
// Per-icon URLs must be prefix/name.svg. Iconify 404s the prefix:name.svg form
// — it used to accept it, which is why icons the browser had cached still
// showed while every new one stayed blank.
function iconRemote(id) {
  const p = iconSplit(id);
  return ICON_BASE + encodeURIComponent(p[0]) + '/' + encodeURIComponent(p[1]) + '.svg';
}
// Inline styles quote url('…'); encodeURIComponent leaves ' alone, so encode it too.
function iconData(body, w, h) {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg>').replace(/'/g, '%27');
}

// direct: for markup leaving this document — the print window — where a
// placeholder would never be swapped. That gets the per-icon URL instead.
function iconUrl(id, direct) {
  if (ICON_SVG[id]) return ICON_SVG[id];
  if (direct || ICON_MISS[id]) return iconRemote(id);
  iconLoad([id]);
  return ICON_PEND + encodeURIComponent(id);
}
// Kept: core/print.js, core/map.js and core/state.js have called it this since
// the powers picker.
function pdIconUrl(id, direct) { return iconUrl(id, direct); }

// Queue ids for the next bulk fetch; resolves once they are loaded (or given up on).
function iconLoad(ids) {
  const ps = [];
  (ids || []).forEach(function (id) {
    if (!id || ICON_SVG[id] || ICON_MISS[id]) return;
    if (!ICON_FLY[id]) {
      ICON_FLY[id] = new Promise(function (res) { iconQueue.push({ id: id, res: res, tries: 0 }); });
      iconSchedule(0);
    }
    ps.push(ICON_FLY[id]);
  });
  return Promise.all(ps).then(function () {});
}
function iconSchedule(ms) { clearTimeout(iconTimer); iconTimer = setTimeout(iconFlush, ms); }
function iconFlush() {
  const jobs = iconQueue; iconQueue = [];
  if (!jobs.length) return;
  const byPfx = {};
  jobs.forEach(function (j) { const p = iconSplit(j.id)[0]; (byPfx[p] = byPfx[p] || []).push(j); });
  const reqs = [];
  Object.keys(byPfx).forEach(function (pfx) {
    const js = byPfx[pfx];
    for (let i = 0; i < js.length; i += 80) reqs.push(iconFetch(pfx, js.slice(i, i + 80)));
  });
  Promise.all(reqs).then(function (failed) {
    iconPatch();
    // Retries count per id: three strikes and the id is released (left blank)
    // so a later render can ask for it again — not a global counter that, once
    // spent, stopped every later failure from retrying.
    const again = [];
    [].concat.apply([], failed).forEach(function (j) {
      if (++j.tries < 3) again.push(j); else { delete ICON_FLY[j.id]; j.res(); }
    });
    if (again.length) {
      const wait = 1500 * Math.max.apply(null, again.map(function (j) { return j.tries; }));
      setTimeout(function () { iconQueue = iconQueue.concat(again); iconSchedule(0); }, wait);
    }
  });
}
// Settles the jobs it loads; resolves to the jobs worth retrying (network
// failure or rate limit). With no fetch at all — file:// in an embedded view, or
// a test harness — there is nothing to retry, so the ids are released at once.
function iconFetch(pfx, jobs) {
  if (typeof fetch !== 'function') {
    jobs.forEach(function (j) { delete ICON_FLY[j.id]; j.res(); });
    return Promise.resolve([]);
  }
  const names = jobs.map(function (j) { return iconSplit(j.id)[1]; });
  return fetch(ICON_BASE + encodeURIComponent(pfx) + '.json?icons=' + names.map(encodeURIComponent).join(','))
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) {
      const icons = (d && d.icons) || {}, aliases = (d && d.aliases) || {};
      jobs.forEach(function (j, k) {
        const n = names[k], al = aliases[n];
        let ic = icons[n];
        if (!ic && al) ic = icons[al.parent];
        if (!ic) ICON_MISS[j.id] = 1;
        else {
          const w = (al && al.width) || ic.width || d.width || 16;
          const h = (al && al.height) || ic.height || d.height || 16;
          ICON_SVG[j.id] = iconData(ic.body, w, h);
        }
        delete ICON_FLY[j.id]; j.res();
      });
      return [];
    })
    .catch(function () { return jobs; });
}
// Swap loaded icons into any placeholders already on the page.
function iconPatch() {
  if (typeof document === 'undefined') return;
  const re = /data:image\/svg\+xml,[^'")]*?#gi=([^'")\s]+)/g;
  function sub(s) {
    return s.replace(re, function (m, enc) {
      const id = decodeURIComponent(enc);
      return ICON_SVG[id] || (ICON_MISS[id] ? iconRemote(id) : m);
    });
  }
  [].slice.call(document.querySelectorAll('[style*="#gi="]')).forEach(function (el) {
    const s = el.getAttribute('style'), n = sub(s);
    if (n !== s) el.setAttribute('style', n);
  });
  [].slice.call(document.querySelectorAll('img[src*="#gi="]')).forEach(function (el) {
    const s = el.getAttribute('src'), n = sub(s);
    if (n !== s) el.setAttribute('src', n);
  });
}

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
      // Load the page of results in one bulk request before drawing it, so the
      // buttons arrive with their pictures rather than as 48 placeholders.
      .then(function (d) {
        const ic = d.icons || [];
        return iconLoad(ic).then(function () { iconResults(id, ic); });
      })
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
