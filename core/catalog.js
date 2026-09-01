// core/catalog.js — the item catalogue: everything the game knows about, and
// everything the table has made.
//
// Two sources, one list:
//
//   the book   the pack's own catalogue (SYS.catalogs[<name>]). Code, so it is
//              the same for every save, every browser and every player, and a
//              correction to a row reaches them all on reload. Read-only here;
//              you copy a row rather than edit it.
//   yours      items made at the table. These live on the UNIVERSE, beside the
//              wiki and the roster — not on a character, because an item a GM
//              builds must not vanish the moment somebody opens a different
//              crawler. Universes are already per-pack, so a comic universe
//              never sees crawler gear.
//
// Adding from the catalogue COPIES. Editing "Healing Potion, Greater" later
// does not reach into a bag and change the three already in it: a potion you
// have already drunk should not change retroactively.

function ensureCatalogItems(u) {
  if (u && !Array.isArray(u.items)) u.items = [];
  return u;
}

// The block whose catalogue this is. Named by the view, or the first inventory
// block that declares one.
function catalogBlock(blockId) {
  const blocks = (SYS && SYS.schema && SYS.schema.blocks) || [];
  if (blockId) return blocks.filter(function (b) { return b.id === blockId; })[0] || null;
  return blocks.filter(function (b) { return b.type === 'inventory' && b.catalog; })[0] || null;
}

function listCatalogItems() {
  const u = (typeof currentUniverse === 'function') ? currentUniverse() : null;
  if (!u) return [];
  ensureCatalogItems(u);
  u.items.forEach(function (e) { if (typeof ensureId === 'function') ensureId(e); });
  return u.items;
}

function saveCatalogItem(entry) {
  const u = (typeof currentUniverse === 'function') ? currentUniverse() : null;
  if (!u || !entry || !String(entry.name || '').trim()) return null;
  ensureCatalogItems(u);
  if (typeof ensureId === 'function') ensureId(entry);
  entry.updatedAt = Date.now();
  const i = u.items.findIndex(function (e) { return e.id === entry.id; });
  if (i >= 0) u.items[i] = entry;
  else { entry.createdAt = Date.now(); u.items.push(entry); }
  saveUniverses();
  // Items are shared: what the GM builds, the players can hold. Both hooks are
  // installed by the multiplayer layer and absent in a solo game.
  if (typeof window !== 'undefined' && typeof window.mpPushShared === 'function') window.mpPushShared();
  return entry;
}

function deleteCatalogItem(id) {
  const u = (typeof currentUniverse === 'function') ? currentUniverse() : null;
  if (!u) return;
  ensureCatalogItems(u);
  u.items = u.items.filter(function (e) { return e.id !== id; });
  saveUniverses();
  if (typeof window !== 'undefined' && typeof window.mpDeleteCatalogItem === 'function') {
    window.mpDeleteCatalogItem(id);
  }
}

// Both sources as one list, each row saying where it came from. The book first,
// then what the table has added, each alphabetical — a catalogue is looked up,
// so the order has to be the same every time you open it.
function catalogRows(blockId) {
  const b = catalogBlock(blockId);
  const name = b && b.catalog;
  const book = (name && SYS && SYS.catalogs && SYS.catalogs[name]) || [];
  const by = function (x, y) { return String(x.name).localeCompare(String(y.name)); };
  return book.slice().sort(by).map(function (r) { return { row: r, source: 'book' }; })
    .concat(listCatalogItems().slice().sort(by).map(function (r) { return { row: r, source: 'yours' }; }));
}

function catalogRowById(blockId, id) {
  return catalogRows(blockId).filter(function (e) { return String(e.row.id) === String(id); })[0] || null;
}

// One catalogue row as an item to carry. A book row goes through the pack's own
// template; one of yours is already in item shape, minus the bookkeeping.
const CATALOG_META_KEYS = ['id', 'kind', 'tier', 'page', 'effect', 'slot', 'source',
                           'createdAt', 'updatedAt', 'remoteAt', 'remoteBy'];
function catalogItemFrom(blockId, entry) {
  const b = catalogBlock(blockId);
  if (!entry) return null;
  if (entry.source === 'book') {
    const fn = b ? sysDerive(b.itemTemplate) : null;
    if (fn) { try { return fn(entry.row.name); } catch (e) { /* falls through */ } }
  }
  const out = { name: entry.row.name, qty: 1 };
  Object.keys(entry.row).forEach(function (k) {
    if (CATALOG_META_KEYS.indexOf(k) >= 0 || k === 'name' || k === 'qty') return;
    out[k] = entry.row[k];
  });
  if (entry.row.effect && !out.notes) out.notes = entry.row.effect;
  return out;
}

// ─── state ──────────────────────────────────────────────────────────────────
let _catQuery = '', _catKind = '', _catSource = '', _catBlock = '', _catHost = '';
let _catQty = 1, _catEdit = null;

function renderCatalog(hostId, blockId) {
  if (hostId) _catHost = hostId;
  if (blockId) _catBlock = blockId;
  const el = document.getElementById(_catHost);
  if (!el) return;
  const b = catalogBlock(_catBlock);
  if (!b) { el.innerHTML = '<div class="card tac text-muted">This game has no item catalogue.</div>'; return; }
  if (!currentUniverse()) {
    el.innerHTML = '<div class="card tac"><div class="pg-title" style="font-size:18px">No universe yet</div>' +
      '<div class="pg-sub">Items you make belong to a world. Create one first.</div></div>';
    return;
  }
  if (_catEdit) { el.innerHTML = catalogEditorHTML(b); return; }

  const rows = catalogRows(_catBlock);
  const kinds = [];
  rows.forEach(function (e) { if (e.row.kind && kinds.indexOf(e.row.kind) < 0) kinds.push(e.row.kind); });
  const q = _catQuery.trim().toLowerCase();
  const shown = rows.filter(function (e) {
    if (_catSource && e.source !== _catSource) return false;
    if (_catKind && e.row.kind !== _catKind) return false;
    if (!q) return true;
    return [e.row.name, e.row.effect, e.row.kind, e.row.tier, e.row.skill]
      .filter(Boolean).join(' ').toLowerCase().indexOf(q) >= 0;
  });

  let h = '<div class="card" style="padding:11px">';
  h += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">' +
    '<input id="cat-search" type="search" placeholder="Look something up…" value="' + esc(_catQuery) + '"' +
    ' oninput="_catQuery=this.value;renderCatalog();_refocus(\'cat-search\',this.selectionStart)" style="flex:1;min-width:150px">' +
    '<button class="btn btn-gold btn-xs" onclick="catalogNew()">+ New item</button></div>';

  h += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px">';
  h += catChip('', 'All (' + rows.length + ')', !_catSource && !_catKind, "_catSource='';_catKind=''");
  h += catChip('', 'From the book', _catSource === 'book', "_catSource='book'");
  h += catChip('', 'Yours (' + listCatalogItems().length + ')', _catSource === 'yours', "_catSource='yours'");
  kinds.forEach(function (k) {
    h += catChip(k, k, _catKind === k, "_catKind=" + jsArg(_catKind === k ? '' : k));
  });
  h += '</div>';

  // How many, and where it goes. One row of controls for the whole list,
  // because a GM stocking a floor sets it once and then taps down the page.
  const targets = (b.containers || []);
  h += '<div class="inv-add-opts" style="align-items:center;gap:6px">' +
    '<span style="font-size:11px;color:var(--muted)">Add</span>' +
    '<button class="btn btn-secondary btn-xs" onclick="catalogQty(-1)">−</button>' +
    '<span class="num" style="min-width:26px;text-align:center;font-weight:700">' + _catQty + '</span>' +
    '<button class="btn btn-secondary btn-xs" onclick="catalogQty(1)">+</button>' +
    '<span style="font-size:11px;color:var(--muted)">to</span>' +
    '<select id="cat-target" style="width:auto">' +
    targets.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.label || c.id) + '</option>';
    }).join('') + '</select></div>';
  h += '<div style="font-size:10px;color:var(--muted);margin-top:4px">' +
    esc(String(shown.length)) + ' of ' + rows.length + ' shown. Adding copies the entry — ' +
    'editing it later leaves what you already carry alone.</div>';
  h += '</div>';

  if (!shown.length) {
    h += '<div class="card tac text-muted" style="padding:18px;font-size:12px">Nothing matches that.</div>';
    el.innerHTML = h;
    return;
  }

  h += '<div class="cat-list">';
  shown.forEach(function (e) { h += catalogRowHTML(b, e); });
  h += '</div>';
  el.innerHTML = h;
}

// `expr` is already attribute-safe — jsArg() escapes its own quotes. Running it
// through esc() as well turned &quot; into &amp;quot; and every filter chip
// became a button that threw instead of filtering.
function catChip(id, label, on, expr) {
  return '<button class="btn btn-xs ' + (on ? 'btn-primary' : 'btn-secondary') + '"' +
    ' style="font-size:10px;padding:3px 7px" onclick="' + expr + ';renderCatalog()">' +
    esc(label) + '</button>';
}

function catalogRowHTML(b, e) {
  const r = e.row;
  const mine = e.source === 'yours';
  const char = (typeof S !== 'undefined' && S) ? S.char : null;
  // What it does, said the way the sheet says it — the same readout a carried
  // item gets, so what you see here is what you will get.
  let line = '';
  try { line = invReadout(b, catalogItemFrom(_catBlock, e) || {}, char) || ''; } catch (err) { line = ''; }
  return '<div class="cat-row">' +
    '<div class="cat-main">' +
      '<div class="cat-name">' + (r.icon ? iconHTML(r.icon, 15) + ' ' : '') + esc(r.name) +
        (mine ? ' <span class="cat-tag is-mine">yours</span>'
              : '<span class="cat-tag">' + esc(r.page ? 'p. ' + r.page : 'book') + '</span>') +
        (r.tier ? ' <span class="cat-tag">' + esc(r.tier) + '</span>' : '') +
        (r.kind ? ' <span class="cat-tag">' + esc(r.kind) + '</span>' : '') +
      '</div>' +
      (line ? '<div class="inv-stat">' + esc(line) + '</div>' : '') +
    '</div>' +
    '<div class="inv-ctl">' +
      '<button class="btn btn-primary btn-xs" onclick="catalogAdd(' + jsArg(String(r.id)) + ')">Add</button>' +
      '<button class="btn btn-secondary btn-xs" title="Make a copy you can edit"' +
        ' onclick="catalogDuplicate(' + jsArg(String(r.id)) + ')">Duplicate</button>' +
      (mine ? '<button class="btn btn-secondary btn-xs" onclick="catalogEdit(' + jsArg(String(r.id)) + ')">Edit</button>' +
              '<button class="btn btn-danger btn-xs" onclick="catalogDelete(' + jsArg(String(r.id)) + ')">✕</button>'
            : '') +
    '</div></div>';
}

// ─── acting on a row ────────────────────────────────────────────────────────
function catalogQty(d) {
  _catQty = Math.max(1, Math.min(99, _catQty + d));
  renderCatalog();
}

function catalogAdd(id) {
  const e = catalogRowById(_catBlock, id);
  const b = catalogBlock(_catBlock);
  if (!e || !b || !S || !S.char) return;
  const sel = document.getElementById('cat-target');
  const cid = (sel && sel.value) || (b.containers && b.containers[0] && b.containers[0].id);
  const c = (b.containers || []).filter(function (x) { return x.id === cid; })[0];
  if (!c) return;
  const ctx = blockCtx(b, S.char);
  if (!ctx.data[cid]) ctx.data[cid] = c.kind === 'slots' ? {} : [];
  let added = 0, refused = '';
  for (let n = 0; n < _catQty; n++) {
    const item = catalogItemFrom(_catBlock, e);
    if (!item) break;
    if (c.kind === 'stack') {
      const arr = ctx.data[cid];
      const at = arr.findIndex(function (x) {
        return x && String(x.name).toLowerCase() === String(item.name).toLowerCase();
      });
      const max = c.stackMax || 999;
      if (at >= 0) {
        if ((arr[at].qty || 1) >= max) { refused = item.name + ' is capped at ' + max; break; }
        arr[at].qty = (arr[at].qty || 1) + 1;
      } else {
        if (invRoom(b, ctx.data, cid, '') === 0) { refused = (c.label || c.id) + ' is full'; break; }
        invPlace(arr, item, c.size || 10);
      }
    } else if (c.kind === 'slots') {
      // Where it is worn is the pack's business; the shell asks and refuses if
      // that slot is full rather than putting a weapon on somebody's head.
      const want = invSlotFor(b, c, item);
      const slot = (c.slots || []).filter(function (x) {
        return (!want || x.id === want) && invRoom(b, ctx.data, cid, x.id) > 0;
      })[0];
      if (!slot) { refused = (c.label || c.id) + ' has no room for that'; break; }
      (ctx.data[cid][slot.id] = ctx.data[cid][slot.id] || []).push(item);
    } else {
      ctx.data[cid].push(item);
    }
    added++;
  }
  save();
  blockSyncAll(b.id, { force: true });
  renderCatalog();
  if (refused && typeof flashSaveError === 'function') flashSaveError(refused);
  else if (added && typeof flashNote === 'function') {
    flashNote(added + ' × ' + e.row.name + ' → ' + ((c.label || c.id)));
  }
}

// A copy you own, seeded from whatever you copied. This is how a row from the
// book gets changed: the book itself is code and stays as printed.
function catalogDuplicate(id) {
  const e = catalogRowById(_catBlock, id);
  if (!e) return;
  const copy = JSON.parse(JSON.stringify(e.row));
  delete copy.id; delete copy.createdAt; delete copy.updatedAt;
  delete copy.remoteAt; delete copy.remoteBy;
  copy.page = undefined; delete copy.page;
  copy.name = e.row.name + ' (copy)';
  _catEdit = copy;
  renderCatalog();
}

function catalogNew() {
  _catEdit = { name: '', kind: 'item' };
  renderCatalog();
}

function catalogEdit(id) {
  const e = catalogRowById(_catBlock, id);
  if (!e || e.source !== 'yours') return;
  _catEdit = JSON.parse(JSON.stringify(e.row));
  renderCatalog();
}

function catalogDelete(id) {
  const e = catalogRowById(_catBlock, id);
  if (!e || e.source !== 'yours') return;
  if (typeof confirm === 'function' && !confirm('Remove "' + e.row.name + '" from the catalogue?')) return;
  deleteCatalogItem(id);
  renderCatalog();
}

// Save an item you are already carrying into the catalogue, so the next one is
// one tap away. Offered from the bag's own detail panel.
function catalogSaveItem(blockId, cid, where, i) {
  const t = _inv(blockId); if (!t) return;
  const c = _container(t.block, cid); if (!c) return;
  const list = c.kind === 'slots' ? (t.ctx.data[cid] || {})[where] : t.ctx.data[cid];
  const item = list && list[i]; if (!item) return;
  const copy = JSON.parse(JSON.stringify(item));
  delete copy.qty;
  const saved = saveCatalogItem(copy);
  if (!saved) return;
  if (typeof flashNote === 'function') flashNote(saved.name + ' is in the catalogue');
}

// ─── the editor ─────────────────────────────────────────────────────────────
function catalogEditorHTML(b) {
  const fields = (b.itemFields && sysDerive(b.itemFields)) ? sysDerive(b.itemFields)() : (b.itemFields || []);
  const e = _catEdit;
  let h = '<div class="card">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">' +
    '<div class="pg-title" style="font-size:20px">' + (e.id ? 'Edit item' : 'New item') + '</div>' +
    '<button class="btn btn-secondary btn-xs" onclick="catalogCancel()">Cancel</button></div>';
  h += '<div class="form-group"><label>Name</label>' +
    '<input id="cat-name" value="' + esc(e.name || '') + '" placeholder="What it is called"' +
    ' oninput="_catEdit.name=this.value"></div>';
  h += '<div class="form-group"><label>What it does</label>' +
    '<textarea id="cat-effect" rows="2" placeholder="The line that shows under it on the sheet"' +
    ' oninput="_catEdit.effect=this.value">' + esc(e.effect || '') + '</textarea></div>';
  h += '<div class="inv-detail">' + detailFieldsHTML(fields, e, {
    set: function (f) { return 'catalogSetField(' + jsArg(f.key) + ',this.value)'; },
    icon: { host: 'cat', onPick: function (v, f) { catalogSetField(f.key, v); } },
  }) + '</div>';
  h += '<div style="display:flex;gap:6px;margin-top:10px">' +
    '<button class="btn btn-primary" style="flex:1" onclick="catalogSave()">Save to the catalogue</button>' +
    '<button class="btn btn-secondary" onclick="catalogCancel()">Cancel</button></div>';
  return h + '</div>';
}

function catalogSetField(key, value) {
  if (!_catEdit) return;
  const b = catalogBlock(_catBlock);
  const fields = (b && b.itemFields && sysDerive(b.itemFields)) ? sysDerive(b.itemFields)() : [];
  const f = fields.filter(function (x) { return x.key === key; })[0] || null;
  if (value === '') delete _catEdit[key];
  else _catEdit[key] = (typeof fieldValue === 'function') ? fieldValue(f, value) : value;
}

function catalogSave() {
  if (!_catEdit) return;
  const name = String(_catEdit.name || '').trim();
  if (!name) {
    if (typeof flashSaveError === 'function') flashSaveError('An item needs a name');
    return;
  }
  _catEdit.name = name;
  saveCatalogItem(_catEdit);
  _catEdit = null;
  renderCatalog();
}

function catalogCancel() { _catEdit = null; renderCatalog(); }

// Redraw only if the catalogue is actually on screen. Multiplayer calls this
// whenever the table changes something, and every other surface it calls has
// the same guard.
function renderCatalogIfOpen() {
  if (_catHost && document.getElementById(_catHost)) renderCatalog();
}


