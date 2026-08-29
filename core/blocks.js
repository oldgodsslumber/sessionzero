// core/blocks.js — the generic character-sheet block renderers.
//
// A system pack declares `schema.blocks`; the shell renders them. This is the
// (b)-with-(a) hybrid from SHELL-PLAN §2: a block either names a `type` handled
// here, or supplies its own `render(ctx)` and drops out of the vocabulary.
//
// Blocks render INTO a container and re-render only themselves. That is
// deliberate: the whole-tab innerHTML rebuild is what caused the search-focus
// bug, and a vocabulary that repeated the pattern would multiply it across every
// system. Call blockRepaint(id) after mutating state, not a full sheet render.
//
// Implemented so far: traitGrid, track, pool, readout, skillList, inventory,
// entityList.
// Still to come: textList, catalogItems, groups, variants, richText,
// statusEffects, progression.

const BLOCK_TYPES = {};
function registerBlockType(id, def) { BLOCK_TYPES[id] = def; }

// ─── context ────────────────────────────────────────────────────────────────
// Every renderer gets {block, data, char, floor, set}. `data` is the block's own
// slice of the character, created on first use so a pack can add a block to an
// existing save without a migration.
function blockCtx(block, char) {
  if (!char.blocks) char.blocks = {};
  // `== null` catches null as well as undefined. A block that came back null —
  // from a save, or from a deletion synced out of the database — used to slip
  // past this and every renderer then dereferenced it, which blanked the whole
  // sheet and left the player looking at their identity card alone.
  if (char.blocks[block.id] == null) {
    const t = BLOCK_TYPES[block.type];
    char.blocks[block.id] = (t && t.init) ? t.init(block, char) : {};
  }
  return {
    block,
    data: char.blocks[block.id],
    char,
    floor: (typeof S !== 'undefined' && S && S.floor) || 0,
    set() { if (typeof save === 'function') save(); },
  };
}

function blockElId(id) { return 'blk-' + id; }

// Render one block into its own wrapper.
function renderBlock(block, char) {
  const t = BLOCK_TYPES[block.type];
  const inner = block.render ? block.render(blockCtx(block, char))
              : t ? t.render(blockCtx(block, char))
              : `<div class="card"><div class="label">${esc(block.id)}</div>
                 <div style="font-size:12px;color:var(--muted)">No renderer for block type
                 "${esc(block.type || 'none')}" yet.</div></div>`;
  return `<div id="${blockElId(block.id)}" class="blk">${inner}</div>`;
}

// Re-render a single block in place. This is the whole point of the layer.
function blockRepaint(id) {
  if (!SYS) return;
  const block = sysBlock(id);
  const el = document.getElementById(blockElId(id));
  if (!block || !el) return;
  const char = (typeof S !== 'undefined' && S) ? S.char : null;
  if (!char) return;
  const t = BLOCK_TYPES[block.type];
  el.innerHTML = block.render ? block.render(blockCtx(block, char))
               : t ? t.render(blockCtx(block, char)) : '';
}

// Render every declared block, in order.
function renderBlockSheet(char, targetEl) {
  const el = typeof targetEl === 'string' ? document.getElementById(targetEl) : targetEl;
  if (!el || !SYS) return;
  const blocks = (SYS.schema && SYS.schema.blocks) || [];
  // Rendered one at a time. A single throw used to abort the whole map, so
  // nothing was assigned and the sheet showed only the cards above this
  // element — the character looked like it had failed to finish creation.
  // Now the rest of the sheet survives and the broken block says what happened.
  el.innerHTML = blocks.map(function (b) {
    try {
      return renderBlock(b, char);
    } catch (e) {
      return '<div class="card" style="border-color:var(--red)">' +
        '<div class="label mb-1" style="color:var(--red)">' + esc(b.label || b.id) +
        ' could not be drawn</div>' +
        '<div style="font-size:11px;color:var(--muted)">' + esc(e.message) +
        '</div></div>';
    }
  }).join('');
}

// What the character's gear adds to a trait or a Skill. The block names a
// derive; the pack works out the number from whatever is worn. Kept derived
// rather than stored so that removing an item removes its bonus, which is the
// whole point of the Enhanced layer: "the Unenhanced score plus any bonuses
// from gear, Spells, Buffs, and other sources".
function blockExtra(block, kind, id, char) {
  const fn = sysDerive(block && block.extra);
  if (!fn || !char) return 0;
  try { return Number(fn(char, kind, id)) || 0; } catch (e) { return 0; }
}

// Resolve a block field that may be a literal, a 'derive.x' string, or a function.
function blockValue(spec, ctx, fallback) {
  if (spec === undefined || spec === null) return fallback;
  if (typeof spec === 'number' || Array.isArray(spec)) return spec;
  const fn = sysDerive(spec);
  if (fn) return fn(ctx.char, ctx);
  return typeof spec === 'function' ? spec(ctx.char, ctx) : spec;
}

// ════════════════════════════════════════════════════════════════════════════
// traitGrid — named traits with numeric values.
//
// DUAL LAYER (added for DCC): a trait may carry a base value and an enhanced
// value, with a derived modifier read off the enhanced layer. Single-layer packs
// (Daring Comics) just omit `layers` and get one number per trait, as before.
// ════════════════════════════════════════════════════════════════════════════
registerBlockType('traitGrid', {
  init(block) {
    const d = {};
    (block.traits || []).forEach(t => {
      const id = t.id || t;
      d[id] = block.layers ? { base: 0, bonus: 0 } : 0;
    });
    return d;
  },
  render(ctx) {
    const b = ctx.block, d = ctx.data, dual = !!b.layers;
    const traits = b.traits || [];
    const modOf = b.mod ? sysDerive(b.mod) : null;
    let h = `<div class="card"><div class="blk-title">${esc(b.label || 'Traits')}</div>`;
    if (b.hint) h += `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${esc(b.hint)}</div>`;
    if (dual) {
      h += `<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:6px 8px;align-items:center">
            <div></div>
            <div class="label" style="margin:0;text-align:center">${esc(b.layers[0] || 'Base')}</div>
            <div class="label" style="margin:0;text-align:center">${esc(b.layers[1] || 'Enhanced')}</div>
            <div class="label" style="margin:0;text-align:center">Mod</div>`;
      traits.forEach(t => {
        const id = t.id || t, cell = d[id] || { base: 0, bonus: 0 };
        // Gear is part of the Enhanced score by definition, but it is not
        // STORED there — it is read from what you are wearing, so taking the
        // item off takes the bonus with it.
        const worn = blockExtra(b, 'trait', id, ctx.char);
        const enhanced = (cell.base || 0) + (cell.bonus || 0) + worn;
        const mod = modOf ? modOf(enhanced) : 0;
        h += `<div style="font-size:13px;font-weight:600" title="${esc(t.desc || '')}">${esc(t.name || id)}</div>
              <input type="number" value="${cell.base || 0}" style="width:64px;text-align:center;padding:5px"
                oninput="traitSet('${esc(b.id)}','${esc(id)}','base',this.value)"
                onchange="traitCommit('${esc(b.id)}')">
              <div id="tg-${esc(b.id)}-${esc(id)}-tot" style="width:64px;text-align:center;font-weight:700">${enhanced}</div>
              <div id="tg-${esc(b.id)}-${esc(id)}-mod" style="width:52px;text-align:center;color:var(--accent);font-weight:700">${mod >= 0 ? '+' : ''}${mod}</div>`;
      });
      h += `</div><div style="font-size:10px;color:var(--muted);margin-top:8px">
            Enhanced = ${esc(b.layers[0] || 'Base')} + gear, Spells and Buffs. The Mod comes off the Enhanced value.</div>`;
    } else {
      h += `<div style="display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center">`;
      traits.forEach(t => {
        const id = t.id || t;
        h += `<div style="font-size:13px">${esc(t.name || id)}</div>
              <input type="number" value="${d[id] || 0}" style="width:64px;text-align:center;padding:5px"
                oninput="traitSet('${esc(b.id)}','${esc(id)}','value',this.value)"
                onchange="traitCommit('${esc(b.id)}')">`;
      });
      h += `</div>`;
    }
    return h + '</div>';
  },
});

// Called on every keystroke, so it must NOT repaint its own block: rebuilding
// the markup would replace the <input> being typed into and drop the caret.
// The two derived cells are updated in place instead, and the blocks that
// depend on this trait are repainted because they contain no input.
function traitSet(blockId, traitId, layer, v) {
  const char = S && S.char; if (!char) return;
  const block = sysBlock(blockId); if (!block) return;
  const d = blockCtx(block, char).data;
  const n = parseInt(v, 10) || 0;
  if (block.layers) {
    if (!d[traitId]) d[traitId] = { base: 0, bonus: 0 };
    d[traitId][layer === 'bonus' ? 'bonus' : 'base'] = n;
  } else {
    d[traitId] = n;
  }
  save();

  if (block.layers) {
    const cell = d[traitId] || { base: 0, bonus: 0 };
    const total = (cell.base || 0) + (cell.bonus || 0) + blockExtra(block, 'trait', traitId, S.char);
    const modOf = block.mod ? sysDerive(block.mod) : null;
    const mod = modOf ? modOf(total) : 0;
    const tot = document.getElementById('tg-' + blockId + '-' + traitId + '-tot');
    const md = document.getElementById('tg-' + blockId + '-' + traitId + '-mod');
    if (tot) tot.textContent = total;
    if (md) md.textContent = (mod >= 0 ? '+' : '') + mod;
  }
  // e.g. stats -> health, mana, evade. Repainting a block replaces its markup,
  // so if the player is part-way through typing into one of those blocks — the
  // Health track carries a damage input — their number is destroyed and the
  // focus falls to <body>. Skip any block that currently holds the caret.
  (block.affects || []).forEach(function (id) {
    if (blockHoldsFocus(id)) return;
    blockRepaint(id);
  });
}

// Is the caret inside this block right now? Repainting it would take the
// element out from under the player mid-keystroke.
function blockHoldsFocus(id) {
  const el = document.getElementById('blk-' + id);
  const a = document.activeElement;
  if (!el || !a || a === document.body) return false;
  return el.contains(a);
}

// On blur, redraw the grid once so anything else it shows is normalised.
function traitCommit(blockId) { blockRepaint(blockId); }

// ════════════════════════════════════════════════════════════════════════════
// track — a row of slots.
//
// NON-UNIFORM (added for DCC): each slot can hold a VALUE, and damage is
// consumed slot-by-slot rather than subtracted, with any remainder discarded.
// Slots can fill right-to-left and carry percentage labels. A plain checkbox
// track (Fate stress) is the degenerate case: slotValue 1, no percentages.
// ════════════════════════════════════════════════════════════════════════════
registerBlockType('track', {
  init(block) { return { marked: 0, tracks: {} }; },
  render(ctx) {
    const b = ctx.block, d = ctx.data;
    const count = blockValue(b.slots, ctx, 10) || 0;
    const slotValue = blockValue(b.slotValue, ctx, 1) || 0;
    const rtl = b.fill === 'rtl';
    const marked = Math.min(d.marked || 0, count);
    const remaining = count - marked;
    let h = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
             <div class="blk-title">${esc(b.label || 'Track')}</div>
             <div style="font-size:12px;color:var(--muted)">${remaining}/${count}${b.percent ? ' · ' + Math.round(remaining / count * 100) + '%' : ''}</div></div>`;
    h += `<div style="display:flex;gap:3px;flex-wrap:wrap">`;
    for (let i = 0; i < count; i++) {
      // rtl: slot 0 is the leftmost/lowest %, and marks land on the highest first
      const isMarked = rtl ? (i >= remaining) : (i < marked);
      const pct = Math.round((i + 1) / count * 100);
      // Classed rather than inline-styled, so a pack theme can say what a live
      // slot and a spent one look like. Health reads better as "what is left"
      // than as "what is gone".
      h += `<div class="trk-slot${isMarked ? ' is-spent' : ''}"
             onclick="trackToggle('${esc(b.id)}',${i})" title="${b.percent ? pct + '%' : ''}">
             <div class="trk-v">${slotValue}</div>
             ${b.percent ? `<div style="font-size:8px;color:var(--muted)">${pct}%</div>` : ''}</div>`;
    }
    h += `</div>`;
    if (b.damageInput) {
      h += `<div style="display:flex;gap:6px;align-items:center;margin-top:8px">
            <input id="dmg-${esc(b.id)}" type="number" placeholder="damage" style="width:96px;padding:6px">
            <button class="btn btn-secondary btn-xs" onclick="trackDamage('${esc(b.id)}')">Apply</button>
            <button class="btn btn-secondary btn-xs" onclick="trackHeal('${esc(b.id)}',1)">Heal 1</button>
            <button class="btn btn-secondary btn-xs" onclick="trackHeal('${esc(b.id)}',${count})">Full</button></div>`;
      h += `<div style="font-size:10px;color:var(--muted);margin-top:6px">
            Damage is not subtracted: it consumes whole slots of ${slotValue}. Anything left over that
            can't fill a slot is lost.</div>`;
    }
    if (remaining === 0 && b.emptyWarning) {
      h += `<div style="margin-top:8px;padding:6px 8px;border:1px solid var(--red);border-radius:6px;
            font-size:12px;color:var(--red)">${esc(b.emptyWarning)}</div>`;
    }
    return h + '</div>';
  },
});

function _trackBlock(id) {
  const char = S && S.char; if (!char) return null;
  const block = sysBlock(id); if (!block) return null;
  return { block, ctx: blockCtx(block, char) };
}
// Click an unmarked slot to mark through it; click a marked slot to heal it back.
function trackToggle(id, i) {
  const t = _trackBlock(id); if (!t) return;
  const count = blockValue(t.block.slots, t.ctx, 10) || 0;
  const marked = Math.min(t.ctx.data.marked || 0, count);
  const remaining = count - marked;
  let next;
  if (t.block.fill === 'rtl') {
    // rightmost slot is 100%; damage marks from the right, so slot i is marked
    // when i >= remaining. Marking through i leaves i slots; healing i leaves i+1.
    next = (i < remaining) ? count - i : count - (i + 1);
  } else {
    // plain left-to-right checkbox track: slot i is marked when i < marked.
    next = (i >= marked) ? i + 1 : i;
  }
  t.ctx.data.marked = Math.max(0, Math.min(count, next));
  save(); blockRepaint(id);
}
// Slot-consumption damage: walk whole slots of `slotValue`, discard the
// remainder that cannot fill one. Generic — a pack supplies only the slot value.
function trackSlotsLost(damage, slotValue, slotsRemaining) {
  const v = Number(slotValue) || 0;
  const dmg = Number(damage) || 0;
  if (v <= 0 || dmg < v) return 0;
  return Math.min(Math.floor(dmg / v), Math.max(0, slotsRemaining));
}

function trackDamage(id) {
  const t = _trackBlock(id); if (!t) return;
  const inp = document.getElementById('dmg-' + id);
  const dmg = parseInt(inp && inp.value, 10) || 0;
  const count = blockValue(t.block.slots, t.ctx, 10) || 0;
  const slotValue = blockValue(t.block.slotValue, t.ctx, 1) || 0;
  const remaining = count - Math.min(t.ctx.data.marked || 0, count);
  const lost = trackSlotsLost(dmg, slotValue, remaining);
  t.ctx.data.marked = Math.min(count, (t.ctx.data.marked || 0) + lost);
  if (inp) inp.value = '';
  save(); blockRepaint(id);
  if (typeof flashSaved === 'function' && dmg) flashSaved();
}
function trackHeal(id, slots) {
  const t = _trackBlock(id); if (!t) return;
  t.ctx.data.marked = Math.max(0, (t.ctx.data.marked || 0) - (slots || 1));
  save(); blockRepaint(id);
}

// ════════════════════════════════════════════════════════════════════════════
// pool — a current/max resource (Mana, AI Favor, Popularity, Gold).
// `max` may be a literal, a derive reference, or absent for an open-ended count.
// ════════════════════════════════════════════════════════════════════════════
registerBlockType('pool', {
  init(block) { return { current: block.start || 0 }; },
  render(ctx) {
    const b = ctx.block, d = ctx.data;
    const max = b.max === undefined ? null : blockValue(b.max, ctx, null);
    // Bring a stale value back into range as the block draws, so a pool whose
    // derived max has fallen reads "5/5" rather than "13/5".
    if (max !== null && (d.current || 0) > max) d.current = max;
    const cur = d.current || 0;
    return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center">
      <div><div class="blk-title">${esc(b.label || b.id)}</div>
      ${b.hint ? `<div style="font-size:11px;color:var(--muted)">${esc(b.hint)}</div>` : ''}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="btn btn-secondary btn-xs" onclick="poolAdj('${esc(b.id)}',-1)">−</button>
        <div style="font-size:24px;font-weight:800;min-width:70px;text-align:center">${cur}${max !== null ? `<span style="font-size:13px;color:var(--muted)">/${max}</span>` : ''}</div>
        <button class="btn btn-secondary btn-xs" onclick="poolAdj('${esc(b.id)}',1)">+</button>
      </div></div></div>`;
  },
});
function poolAdj(id, delta) {
  const char = S && S.char; if (!char) return;
  const block = sysBlock(id); if (!block) return;
  const ctx = blockCtx(block, char);
  const max = block.max === undefined ? null : blockValue(block.max, ctx, null);
  // Clamp what is already stored before adjusting. A derived max can fall after
  // the pool was filled — drop INT and Mana read "13/5" — and starting from the
  // stale value made "+" reduce it by 8.
  if (max !== null && (ctx.data.current || 0) > max) ctx.data.current = max;
  let v = (ctx.data.current || 0) + delta;
  if (v < 0) v = 0;
  if (max !== null && v > max) v = max;
  ctx.data.current = v;
  save(); blockRepaint(id);
}

// ════════════════════════════════════════════════════════════════════════════
// readout — derived values the player never edits (Evade, Move, Step, DR).
// ════════════════════════════════════════════════════════════════════════════
registerBlockType('readout', {
  init() { return {}; },
  render(ctx) {
    const b = ctx.block;
    const items = (b.items || []).map(it => {
      const v = blockValue(it.value, ctx, '—');
      return `<div style="text-align:center;min-width:76px">
              <div style="font-size:26px;font-weight:800;color:var(--accent)">${esc(String(v))}</div>
              <div class="label" style="margin:0">${esc(it.label)}</div>
              ${it.hint ? `<div style="font-size:9px;color:var(--muted)">${esc(it.hint)}</div>` : ''}</div>`;
    }).join('');
    return `<div class="card"><div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:space-around">${items}</div></div>`;
  },
});

// ════════════════════════════════════════════════════════════════════════════
// skillList — ranked skills with an advancement mark.
//
// Added for DCC, where Skills do NOT improve on level-up: you tick a box the
// first time you use a Skill in a period, then roll to see whether it advances
// (DCC RPG p. 169). The mark is the mechanic, so it is part of the block rather
// than a note. Generic enough for any system with use-based advancement: the
// pack supplies the cadence text and the advancement roll.
// ════════════════════════════════════════════════════════════════════════════
registerBlockType('skillList', {
  init() { return { skills: [] }; },
  render(ctx) {
    const b = ctx.block, d = ctx.data;
    const list = d.skills || [];
    const modOf = b.statMod ? sysDerive(b.statMod) : null;
    const marked = list.filter(s => s.marked).length;
    let h = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div class="blk-title">${esc(b.label || 'Skills')}</div>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="font-size:11px;color:var(--muted)">${list.length} known${marked ? ' · ' + marked + ' marked' : ''}</span>
        <button class="btn btn-secondary btn-xs" onclick="skillAddToggle('${esc(b.id)}')">${d.adding ? 'Cancel' : '+ Skill'}</button>
        ${marked ? `<button class="btn btn-primary btn-xs" onclick="skillAdvance('${esc(b.id)}')">Advance (${marked})</button>` : ''}
      </div></div>`;
    if (b.hint) h += `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${esc(b.hint)}</div>`;
    if (d.adding) {
      // A custom Skill is a first-class option in the book (p. 174), so it is
      // typed here rather than being limited to the catalogue.
      const cat = (SYS.catalogs && SYS.catalogs[b.catalog || 'skills']) || [];
      h += `<div class="card-sm" style="border-color:var(--accent);margin-bottom:8px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <input id="sk-add-${esc(b.id)}" list="sk-list-${esc(b.id)}" placeholder="Name" style="flex:1;min-width:130px;padding:6px">
          <datalist id="sk-list-${esc(b.id)}">${cat.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
          <select id="sk-stat-${esc(b.id)}" style="width:76px">
            <option value="">Stat…</option>
            ${(b.stats || ['STR', 'INT', 'CON', 'DEX', 'CHA']).map(x => `<option value="${x}">${x}</option>`).join('')}
          </select>
          <input id="sk-rank-${esc(b.id)}" type="number" value="1" style="width:58px;text-align:center;padding:6px">
          <button class="btn btn-primary btn-xs" onclick="skillAdd('${esc(b.id)}')">Add</button>
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px">
          Pick one from the list, or type your own \u2014 a Skill the book does not have is still a Skill.</div>
      </div>`;
    }
    if (!list.length) {
      h += `<div class="tac text-muted" style="padding:14px;font-size:12px">No skills yet.</div>`;
      return h + '</div>';
    }
    h += `<div style="max-height:46vh;overflow-y:auto">`;
    list.slice().sort((a, z) => a.name.localeCompare(z.name)).forEach(s => {
      const i = list.indexOf(s);
      const mod = (modOf && s.stat) ? modOf(ctx.char, s.stat) : 0;
      const total = (s.rank || 0) + mod + blockExtra(b, 'skill', s.name, ctx.char);
      h += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        <div title="Mark when you use this Skill" onclick="skillMark('${esc(b.id)}',${i})"
          style="width:20px;height:20px;flex-shrink:0;border:2px solid ${s.marked ? 'var(--green)' : 'var(--border)'};
          border-radius:4px;cursor:pointer;background:${s.marked ? 'var(--green)' : 'transparent'};
          display:flex;align-items:center;justify-content:center;font-size:12px;color:#08140b">${s.marked ? '✓' : ''}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${esc(s.name)}${s.passive ? ' <span style="font-size:9px;color:var(--muted)">PASSIVE</span>' : ''}${s.custom ? ' <span style="font-size:9px;color:var(--accent)">CUSTOM</span>' : ''}</div>
          <div style="font-size:10px;color:var(--muted)">${esc(s.stat || '—')}${mod ? ' +' + mod : ''}${s.checkType ? ' · ' + esc(s.checkType) : ''}</div>
          ${(() => {
            // What it actually does. A Spell called "Heal" tells you nothing on
            // its own, and the catalogue has had the answer all along.
            const info = skillInfo(b, s);
            return info ? `<div class="sk-effect">${esc(info)}</div>` : '';
          })()}
        </div>
        <div class="num" style="min-width:34px;text-align:center;font-weight:700"
             title="Rank. Skills advance from use, not by hand.">${s.rank || 0}</div>
        <div style="min-width:44px;text-align:right;font-weight:700;color:var(--accent)">${total >= 0 ? '+' : ''}${total}</div>
        ${skillIsYours(s)
          ? `<button class="btn btn-secondary btn-xs" title="Remove this ${esc(b.label || 'entry')} — you added it yourself" onclick="skillDel('${esc(b.id)}',${i})">✕</button>`
          : `<span style="width:24px" title="This came from character creation, so it is part of who you are rather than something to delete"></span>`}
      </div>`;
    });
    // Offer to put back anything creation granted that is no longer listed.
    // Skills your gear lends you. Not editable and not advanced from use — they
    // are only here while the item is worn.
    skillLent(b, ctx.char).forEach(function (g) {
      const look = sysDerive(b.lookup);
      const cat = look ? look(g.name) : null;
      const stat = (cat && cat.stat) || g.stat || '';
      const statFn = sysDerive(b.statMod);
      const mod = statFn && stat ? (statFn(ctx.char, stat) || 0) : 0;
      const worn = blockExtra(b, 'skill', g.name, ctx.char);
      const total = mod + worn;
      const info = skillInfo(b, { name: g.name });
      h += `<div class="sk-row is-lent">
        <div style="width:18px"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${esc(g.name)}
            <span class="sk-lent-tag">from ${esc(g.from || 'gear')}</span></div>
          <div style="font-size:10px;color:var(--muted)">${esc(stat || '\u2014')}${mod ? ' +' + mod : ''}</div>
          ${info ? `<div class="sk-effect">${esc(info)}</div>` : ''}
        </div>
        <div class="num" style="min-width:34px;text-align:center;font-weight:700"
             title="Untrained — you have no Ranks of your own">\u2014</div>
        <div style="min-width:44px;text-align:right;font-weight:700;color:var(--accent)">${total >= 0 ? '+' : ''}${total}</div>
        <span style="width:24px"></span>
      </div>`;
    });
    const gone = skillMissing(b, ctx.char);
    if (gone.length) {
      h += `<div class="card-sm" style="border-color:var(--blue);margin-top:6px;display:flex;`
        + `justify-content:space-between;align-items:center;gap:8px">`
        + `<div style="font-size:11px;color:var(--muted)">`
        + `${gone.length} from character creation ${gone.length === 1 ? 'is' : 'are'} missing: `
        + `<strong style="color:var(--text)">${esc(gone.map(function (g) { return g.name; }).join(', '))}</strong></div>`
        + `<button class="btn btn-secondary btn-xs" onclick="skillRestore('${esc(b.id)}')">Put back</button></div>`;
    }
    return h + '</div></div>';
  },
});

// Which entries creation granted that are no longer on the sheet. A pack points
// `granted` at whatever recomputes its starting list, so the block can offer to
// put back anything lost — two Skills went missing off a finished sheet before
// deletion was fenced off, and rebuilding the character to recover them is not
// a reasonable thing to ask.
function skillMissing(block, char) {
  const fn = sysDerive(block.granted);
  if (!fn || !char) return [];
  let granted = [];
  try { granted = fn(char) || []; } catch (e) { return []; }
  const data = (char.blocks && char.blocks[block.id] && char.blocks[block.id].skills) || [];
  const have = data.map(function (s) { return String(s.name).toLowerCase(); });
  return granted.filter(function (g) { return have.indexOf(String(g.name).toLowerCase()) < 0; });
}

function skillRestore(id) {
  const t = _skillData(id); if (!t) return;
  const missing = skillMissing(t.block, S.char);
  if (!missing.length) return;
  t.ctx.data.skills = (t.ctx.data.skills || []).concat(missing.map(function (g) {
    return Object.assign({ marked: false }, g);
  }));
  save(); blockRepaint(id);
}

// The catalogue line for an entry: its cost, range and what it does. The pack
// supplies the lookup, so the shell does not need to know what a Spell is.
// Entries the character does not have, but their gear grants. A +3 to Tracking
// on a bow is worth nothing on a sheet that never mentions Tracking, so the
// list shows it, marked as coming from what you are carrying rather than from
// anything you learned.
function skillLent(block, char) {
  const fn = sysDerive(block.lent);
  if (!fn || !char) return [];
  let out = [];
  try { out = fn(char, block.id) || []; } catch (e) { return []; }
  const have = ((char.blocks && char.blocks[block.id] && char.blocks[block.id].skills) || [])
    .map(function (s) { return String(s.name).toLowerCase(); });
  return out.filter(function (g) { return have.indexOf(String(g.name).toLowerCase()) < 0; });
}

function skillInfo(block, entry, char) {
  char = char || ((typeof S !== 'undefined' && S) ? S.char : null);
  const look = sysDerive(block.lookup);
  if (!look || !entry) return '';
  let cat = null;
  try { cat = look(entry.name); } catch (e) { return ''; }
  if (!cat) return '';
  const bits = [];
  if (cat.mana !== undefined && cat.mana !== null) bits.push(cat.mana + ' Mana');
  if (cat.range) bits.push(cat.range);
  if (cat.baseDamage) bits.push(cat.baseDamage);
  // What this crawler's Rank has unlocked, where the pack tracks that.
  const upFn = sysDerive(block.upgrades);
  if (upFn) {
    let ups = [];
    try { ups = upFn(char, cat.name) || []; } catch (e) { ups = []; }
    ups.forEach(function (u) { bits.push('Rank ' + u.rank + ': ' + u.text); });
  }
  if (cat.effect) {
    // The printed entry repeats its own Base Damage and AI Favor lines inside
    // the effect text; both are shown separately, so trim them rather than
    // saying the same thing twice on one line.
    let e = String(cat.effect);
    if (cat.baseDamage) e = e.split('Base Damage: ' + cat.baseDamage).join('');
    e = e.replace(/^\s*AI Favor:\s*\d+\s*/i, '').replace(/\s{2,}/g, ' ').trim();
    if (e) bits.push(e);
  } else if (cat.limitations) {
    bits.push(cat.limitations);
  }
  return bits.join(' · ');
}

function _skillData(id) {
  const char = S && S.char; if (!char) return null;
  const block = sysBlock(id); if (!block) return null;
  return { block, ctx: blockCtx(block, char) };
}
// Show or hide the add row. Repainting here is fine: no input has focus yet.
function skillAddToggle(id) {
  const t = _skillData(id); if (!t) return;
  t.ctx.data.adding = !t.ctx.data.adding;
  save(); blockRepaint(id);
}

// Add a Skill, from the catalogue or invented. A catalogue match brings its
// Stat and check type with it; anything else takes what was typed.
function skillAdd(id) {
  const t = _skillData(id); if (!t) return;
  const name = (document.getElementById('sk-add-' + id) || {}).value || '';
  if (!name.trim()) return;
  const statSel = (document.getElementById('sk-stat-' + id) || {}).value || '';
  const rank = parseInt((document.getElementById('sk-rank-' + id) || {}).value, 10) || 0;
  const lookup = sysDerive(t.block.lookup);
  const cat = lookup ? lookup(name.trim()) : null;
  t.ctx.data.skills = t.ctx.data.skills || [];
  if (t.ctx.data.skills.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
    if (typeof flashSaveError === 'function') flashSaveError(voice('alreadyKnown','Already known'));
    return;
  }
  t.ctx.data.skills.push({
    name: cat ? cat.name : name.trim(),
    rank: Math.max(0, Math.min(t.block.rankCap || 20, rank)),
    stat: statSel || (cat ? cat.stat : null),
    checkType: cat ? cat.checkType : null,
    passive: !!(cat && cat.passive),
    source: cat ? 'added' : 'custom',
    custom: !cat,
    marked: false,
  });
  t.ctx.data.adding = false;
  save(); blockRepaint(id);
}

function skillMark(id, i) {
  const t = _skillData(id); if (!t) return;
  const s = t.ctx.data.skills[i]; if (!s || s.passive) return;   // passives never mark
  s.marked = !s.marked; save(); blockRepaint(id);
}
// Not wired to any button. Ranks are not nudged by hand — a Skill rises when
// you use it and pass its advancement roll — but this is still the single place
// that applies the floor and the Rank cap, so advancement goes through it.
function skillRank(id, i, d) {
  const t = _skillData(id); if (!t) return;
  const s = t.ctx.data.skills[i]; if (!s) return;
  const cap = s.cap || (t.block.rankCap || 20);
  s.rank = Math.max(0, Math.min(cap, (s.rank || 0) + d));
  save(); blockRepaint(id);
}
// A Skill that came from creation — your background, Race, Class or a tutorial
// roll — is part of who the character is, not a list entry to tidy away. Only
// something added on the sheet afterwards is yours to remove.
function skillIsYours(s) {
  return !!s && (s.source === 'added' || s.source === 'custom');
}

function skillDel(id, i) {
  const t = _skillData(id); if (!t) return;
  const s = t.ctx.data.skills[i];
  if (!skillIsYours(s)) return;
  // Deleting used to happen on a single click with no warning, which is how
  // two Skills went missing off a finished sheet.
  if (typeof confirm === 'function' &&
      !confirm('Remove ' + (s && s.name ? s.name : 'this entry') + '?')) return;
  t.ctx.data.skills.splice(i, 1); save(); blockRepaint(id);
}
// Resolve advancement for every marked skill, then clear the marks.
function skillAdvance(id) {
  const t = _skillData(id); if (!t) return;
  const roll = sysDerive(t.block.advanceRoll);
  if (!roll) return;
  const lines = [];
  t.ctx.data.skills.forEach(s => {
    if (!s.marked) return;
    const r = roll(s);
    if (r.gained) s.rank = r.rank;
    s.marked = false;
    lines.push(`${s.name}: rolled ${r.roll} vs Rank ${r.before} — ${r.gained ? 'up to ' + r.rank : 'no change'}`);
  });
  save(); blockRepaint(id);
  if (lines.length && typeof alert === 'function') alert('Skill Advancement\n\n' + lines.join('\n'));
}

// ════════════════════════════════════════════════════════════════════════════
// inventory — the third block contract DCC forced, and the one SHELL-PLAN §8
// under-described. It is not one list: it is several containers with DIFFERENT
// rules, and moving an item between them is the whole point.
//
// Three container kinds, each generic:
//   slots — named slots with a capacity each (worn gear: Head, Torso, Hands…)
//   stack — a fixed number of numbered slots, each holding a stack (a Hotlist)
//   list  — unbounded (a backpack)
//
// A pack declares which containers it has and what the rules are; the shell
// enforces capacity and the moves. Fate's "gear is a text note" is the
// degenerate case of a single list container.
// ════════════════════════════════════════════════════════════════════════════
registerBlockType('inventory', {
  init(block) {
    const d = { counters: {} };
    (block.containers || []).forEach(c => {
      if (c.kind === 'slots') {
        d[c.id] = {};
        (c.slots || []).forEach(s => { d[c.id][s.id] = []; });
      } else {
        d[c.id] = [];
      }
    });
    (block.counters || []).forEach(c => { d.counters[c.id] = 0; });
    return d;
  },
  render(ctx) {
    const b = ctx.block, d = ctx.data;
    let h = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
      <div class="blk-title">${esc(b.label || 'Gear')}</div>`;
    const cap = b.carryLimit ? blockValue(b.carryLimit, ctx, null) : null;
    if (cap !== null) h += `<div style="font-size:11px;color:var(--muted)">${esc(String(cap))}</div>`;
    h += `</div>`;
    if (b.hint) h += `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${esc(b.hint)}</div>`;

    (b.containers || []).forEach(c => {
      h += `<div class="label" style="margin:10px 0 4px">${esc(c.label || c.id)}`;
      if (c.note) h += ` <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted)">${esc(c.note)}</span>`;
      h += `</div>`;
      if (c.kind === 'slots') h += invSlots(b, c, d);
      else if (c.kind === 'stack') h += invStack(b, c, d);
      else h += invList(b, c, d);
      h += invAdder(b, c);
    });

    if ((b.counters || []).length) {
      h += `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px">`;
      b.counters.forEach(c => {
        h += `<div style="display:flex;align-items:center;gap:6px">
          <button class="btn btn-secondary btn-xs" onclick="invCounter('${esc(b.id)}','${esc(c.id)}',-1)">−</button>
          <div style="text-align:center;min-width:56px">
            <div style="font-size:18px;font-weight:800">${(d.counters || {})[c.id] || 0}</div>
            <div class="label" style="margin:0">${esc(c.label || c.id)}</div></div>
          <button class="btn btn-secondary btn-xs" onclick="invCounter('${esc(b.id)}','${esc(c.id)}',1)">+</button></div>`;
      });
      h += `</div>`;
    }
    return h + '</div>';
  },
});

function invItemRow(b, c, item, where, idx, extra) {
  // In a slots container the player can move an item between slots. The shell
  // has no idea whether a thing is worn or held, so where it lands by default
  // is a guess — this is how you correct it.
  let slotPick = '';
  if (c.kind === 'slots') {
    slotPick = `<select title="Which slot this is in" style="flex:0 0 auto;font-size:11px;padding:2px 4px"
      onchange="invMove('${esc(b.id)}','${esc(c.id)}','${esc(c.id)}','${esc(where)}',${idx},this.value)">` +
      (c.slots || []).map(sl =>
        `<option value="${esc(sl.id)}"${sl.id === where ? ' selected' : ''}>${esc(sl.name)}</option>`
      ).join('') + `</select>`;
  }
  // Items are not all the same kind of thing: a weapon works as a Skill, armour
  // grants DR, a scroll casts a Spell you have no Ranks in, a tome teaches one.
  // The pack declares which fields an item can carry; this is the editor for
  // them, folded away until asked for so the row stays readable on a phone.
  const fields = (b.itemFields && sysDerive(b.itemFields)) ? sysDerive(b.itemFields)() : (b.itemFields || []);
  const rowKey = c.id + ':' + where + ':' + idx;
  const openDetail = _invDetailOpen === rowKey;
  let detail = '';
  if (fields && fields.length) {
    detail = `<button class="btn btn-secondary btn-xs" title="What this is"
      onclick="invDetail('${esc(b.id)}','${esc(rowKey)}')">${openDetail ? '−' : '⋯'}</button>`;
  }
  // Change what an existing item works as, so a mis-added Baseball Bat can be
  // made into a Club without deleting and retyping it.
  const asFn = sysDerive(b.itemOptions);
  let asPick = '';
  if (asFn) {
    let opts = [];
    try { opts = asFn() || []; } catch (e) { opts = []; }
    if (opts.length) {
      asPick = `<select title="What this works as" style="flex:0 0 auto;font-size:11px;padding:2px 4px"
        onchange="invSetSkill('${esc(b.id)}','${esc(c.id)}','${esc(where)}',${idx},this.value)">` +
        `<option value="">—</option>` +
        opts.map(o => `<option value="${esc(o.value)}"${o.value === (item.skill || '') ? ' selected' : ''}>${esc(o.value)}</option>`).join('') +
        `</select>`;
    }
  }
  const moves = (b.containers || []).filter(x => x.id !== c.id).map(x =>
    `<button class="btn btn-secondary btn-xs" title="Move to ${esc(x.label || x.id)}"
      onclick="invMove('${esc(b.id)}','${esc(c.id)}','${esc(x.id)}','${esc(where)}',${idx})">→ ${esc((x.label || x.id).split(' ')[0])}</button>`
  ).join('');
  // Name and controls are separate groups so they can wrap onto their own
  // lines. As one flex row the name was squeezed to nothing on a phone — five
  // controls and an item called "Chef's Knife of Unwelcome Surprises" do not
  // share 360px.
  return `<div class="inv-row">
    <div class="inv-name">${esc(item.name)}${item.qty > 1 ? ` <span style="color:var(--muted)">×${item.qty}</span>` : ''}
      ${(() => { const r = invReadout(b, item, (typeof S !== 'undefined' && S) ? S.char : null);
                 return r ? `<span class="inv-stat">${esc(r)}</span>` : ''; })()}</div>
    <div class="inv-ctl">${extra || ''}${detail}${slotPick}${moves}
      <button class="btn btn-secondary btn-xs" title="Remove" onclick="invRemove('${esc(b.id)}','${esc(c.id)}','${esc(where)}',${idx})">✕</button>
    </div>
    ${openDetail ? invDetailHTML(b, c, item, where, idx, fields) : ''}
  </div>`;
}

function invSlots(b, c, d) {
  const store = d[c.id] || {};
  let h = '';
  (c.slots || []).forEach(s => {
    const items = store[s.id] || [];
    const full = items.length >= (s.max || 1);
    h += `<div class="inv-slot">
      <div class="inv-slot-h${full ? ' is-full' : ''}">
        ${esc(s.name)}<span class="inv-slot-n">${items.length}/${s.max || 1}</span></div>
      <div class="inv-slot-items">`;
    if (!items.length) h += `<div style="font-size:11px;color:var(--muted);padding:2px 0">empty</div>`;
    items.forEach((it, i) => { h += invItemRow(b, c, it, s.id, i); });
    h += `</div></div>`;
  });
  return h;
}

function invStack(b, c, d) {
  const items = d[c.id] || [];
  const size = c.size || 10;
  let h = `<div>`;
  for (let i = 0; i < size; i++) {
    const it = items[i];
    // Grouped and wrapping, like the gear rows. As one flex line the controls
    // ran straight off the side of the card on a phone.
    h += `<div class="inv-row"><div class="inv-slotno">${i + 1}</div>`;
    if (!it) {
      h += `<div class="inv-name" style="color:var(--muted)">empty</div></div>`;
      continue;
    }
    const line = invReadout(b, it, (typeof S !== 'undefined' && S) ? S.char : null);
    h += `<div class="inv-name">${esc(it.name)}${line ? `<span class="inv-stat">${esc(line)}</span>` : ''}</div>
      <div class="inv-ctl">
      <button class="btn btn-secondary btn-xs" onclick="invQty('${esc(b.id)}','${esc(c.id)}',${i},-1)">−</button>
      <div class="num" style="min-width:28px;text-align:center;font-weight:700">${it.qty || 1}</div>
      <button class="btn btn-secondary btn-xs" onclick="invQty('${esc(b.id)}','${esc(c.id)}',${i},1)">+</button>`;
    (b.containers || []).filter(x => x.id !== c.id).forEach(x => {
      h += `<button class="btn btn-secondary btn-xs" onclick="invMove('${esc(b.id)}','${esc(c.id)}','${esc(x.id)}','',${i})">→ ${esc((x.label || x.id).split(' ')[0])}</button>`;
    });
    h += `<button class="btn btn-secondary btn-xs" title="Remove" onclick="invRemove('${esc(b.id)}','${esc(c.id)}','',${i})">✕</button></div></div>`;
  }
  return h + `</div>`;
}

function invList(b, c, d) {
  const items = d[c.id] || [];
  if (!items.length) return `<div style="font-size:11px;color:var(--muted);padding:2px 0">empty</div>`;
  return items.map((it, i) => invItemRow(b, c, it, '', i,
    `<button class="btn btn-secondary btn-xs" onclick="invQty('${esc(b.id)}','${esc(c.id)}',${i},-1)">−</button>
     <div style="min-width:26px;text-align:center;font-weight:700">${it.qty || 1}</div>
     <button class="btn btn-secondary btn-xs" onclick="invQty('${esc(b.id)}','${esc(c.id)}',${i},1)">+</button>`)).join('');
}

// What an item IS, as opposed to what it is called. A pack lists the things an
// item can work as — for a weapon that is the Skill you attack with — so a
// Baseball Bat can be a real Club rather than a label.
function invAsPick(b, c, chosen) {
  const fn = sysDerive(b.itemOptions);
  if (!fn) return '';
  let opts = [];
  try { opts = fn() || []; } catch (e) { return ''; }
  if (!opts.length) return '';
  return `<select id="inv-as-${esc(b.id)}-${esc(c.id)}" title="What this works as" style="flex:0 0 132px">` +
    `<option value="">— just an item —</option>` +
    opts.map(o => `<option value="${esc(o.value)}"${o.value === chosen ? ' selected' : ''}>${esc(o.label)}</option>`).join('') +
    `</select>`;
}

// The mechanical line under an item's name: what it does at the table.
function invReadout(b, item, char) {
  const fn = sysDerive(b.itemReadout);
  if (!fn || !item) return '';
  try { return fn(item, char) || ''; } catch (e) { return ''; }
}

function invAdder(b, c) {
  const slotPick = c.kind === 'slots'
    ? `<select id="inv-slot-${esc(b.id)}-${esc(c.id)}" style="flex:0 0 130px">` +
      (c.slots || []).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('') + `</select>`
    : '';
  // An input, a slot picker, a "works as" picker and a button never fit one
  // line on a phone, so they are grouped and allowed to wrap.
  return `<div class="inv-add">
    <input id="inv-add-${esc(b.id)}-${esc(c.id)}" placeholder="Add to ${esc(c.label || c.id)}…"
      onkeydown="if(event.key==='Enter')invAdd('${esc(b.id)}','${esc(c.id)}')">
    <div class="inv-add-opts">${slotPick}${invAsPick(b, c, '')}
      <button class="btn btn-secondary btn-xs" onclick="invAdd('${esc(b.id)}','${esc(c.id)}')">Add</button></div></div>`;
}

// ─── mutators ───────────────────────────────────────────────────────────────
function _inv(id) {
  const char = S && S.char; if (!char) return null;
  const block = sysBlock(id); if (!block) return null;
  return { block, ctx: blockCtx(block, char) };
}
function _container(block, cid) {
  return (block.containers || []).find(c => c.id === cid) || null;
}
// How many more items will this container take? null means no limit.
function invRoom(block, data, cid, slotId) {
  const c = _container(block, cid); if (!c) return 0;
  if (c.kind === 'slots') {
    const s = (c.slots || []).find(x => x.id === slotId);
    if (!s) return 0;
    return Math.max(0, (s.max || 1) - ((data[cid] || {})[slotId] || []).length);
  }
  if (c.kind === 'stack') return Math.max(0, (c.size || 10) - (data[cid] || []).length);
  return null;
}
function invAdd(id, cid) {
  const t = _inv(id); if (!t) return;
  const inp = document.getElementById('inv-add-' + id + '-' + cid);
  const name = (inp && inp.value || '').trim();
  if (!name) return;
  const c = _container(t.block, cid);
  const sel = document.getElementById('inv-slot-' + id + '-' + cid);
  const slotId = sel ? sel.value : '';
  // What it works as: the player's pick, or an exact catalogue match on the
  // name so typing "Club" simply is a Club.
  const asSel = document.getElementById('inv-as-' + id + '-' + cid);
  let works = asSel ? asSel.value : '';
  if (!works) {
    const look = sysDerive(t.block.lookup);
    const hit = look ? look(name) : null;
    if (hit && hit.name && hit.name.toLowerCase() === name.toLowerCase()) works = hit.name;
  }

  // A stack container holds one entry per NAME, counted up — "You may place up
  // to 999 of the same item by name into a single slot of your Hotlist"
  // (p. 112). Adding a second Healing Potion used to take a second of the ten
  // slots instead of making the first one read x2, so a Hotlist filled up with
  // duplicates of the same thing.
  if (c.kind === 'stack') {
    const list = t.ctx.data[cid] = t.ctx.data[cid] || [];
    const at = list.findIndex(x => x && String(x.name).toLowerCase() === name.toLowerCase());
    if (at >= 0) {
      const max = c.stackMax || 999;
      if ((list[at].qty || 1) >= max) {
        if (typeof flashSaveError === 'function') flashSaveError(list[at].name + ' is capped at ' + max);
        return;
      }
      list[at].qty = (list[at].qty || 1) + 1;
      if (inp) inp.value = '';
      save(); blockSyncAll(id);
      return;
    }
    // A new name needs a free slot of its own.
    if (invRoom(t.block, t.ctx.data, cid, slotId) === 0) {
      if (typeof flashSaveError === 'function') flashSaveError(voice('noRoom','No room there'));
      return;
    }
    list.push(works ? { name, qty: 1, skill: works } : { name, qty: 1 });
    if (inp) inp.value = '';
    save(); blockSyncAll(id);
    return;
  }

  if (invRoom(t.block, t.ctx.data, cid, slotId) === 0) {
    if (typeof flashSaveError === 'function') flashSaveError(voice('noRoom','No room there'));
    return;
  }
  const item = works ? { name, qty: 1, skill: works } : { name, qty: 1 };
  if (c.kind === 'slots') (t.ctx.data[cid][slotId] = t.ctx.data[cid][slotId] || []).push(item);
  else t.ctx.data[cid].push(item);
  if (inp) inp.value = '';
  save(); blockSyncAll(id);
}
function invRemove(id, cid, slotId, i) {
  const t = _inv(id); if (!t) return;
  const c = _container(t.block, cid);
  const arr = c.kind === 'slots' ? (t.ctx.data[cid] || {})[slotId] : t.ctx.data[cid];
  if (!arr) return;
  arr.splice(i, 1);
  save(); blockSyncAll(id);
}
function invQty(id, cid, i, delta) {
  const t = _inv(id); if (!t) return;
  const c = _container(t.block, cid);
  const arr = t.ctx.data[cid];
  const it = Array.isArray(arr) ? arr[i] : null;
  if (!it) return;
  const max = c.stackMax || 999;
  it.qty = Math.max(1, Math.min(max, (it.qty || 1) + delta));
  save(); blockSyncAll(id);
}
// Move an item between containers, refusing when the destination is full.
// Which gear slot an item belongs in. The shell cannot know a Club is held
// rather than worn, so the pack decides; without an answer we fall back to the
// first slot with room, which is what used to put weapons on your head.
let _invDetailOpen = '';
function invDetail(id, rowKey) {
  _invDetailOpen = _invDetailOpen === rowKey ? '' : rowKey;
  blockRepaint(id);
}

function invDetailHTML(b, c, item, where, idx, fields) {
  let h = '<div class="inv-detail">';
  fields.forEach(function (f) {
    const val = item[f.key] === undefined || item[f.key] === null ? '' : item[f.key];
    h += '<label class="inv-f"><span>' + esc(f.label) + '</span>';
    if (f.options) {
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      h += '<select onchange="invSetField(' + jsArg(b.id) + ',' + jsArg(c.id) + ',' + jsArg(where) +
           ',' + idx + ',' + jsArg(f.key) + ',this.value)"><option value="">—</option>' +
           (opts || []).map(function (o) {
             const v = o.value === undefined ? o : o.value;
             const l = o.label === undefined ? v : o.label;
             return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') +
                    '>' + esc(l) + '</option>';
           }).join('') + '</select>';
    } else {
      h += '<input type="' + (f.type === 'number' ? 'number' : 'text') + '" value="' + esc(String(val)) +
           '" placeholder="' + esc(f.hint || '') + '"' +
           ' oninput="invSetField(' + jsArg(b.id) + ',' + jsArg(c.id) + ',' + jsArg(where) +
           ',' + idx + ',' + jsArg(f.key) + ',this.value)">';
    }
    h += '</label>';
  });
  // Anything the pack can DO with this item, such as reading a tome.
  const actFn = sysDerive(b.itemActions);
  let acts = [];
  if (actFn) { try { acts = actFn(item, (typeof S !== 'undefined' && S) ? S.char : null) || []; } catch (e) { acts = []; } }
  acts.forEach(function (a) {
    h += '<button class="btn btn-primary btn-xs" onclick="invAct(' + jsArg(b.id) + ',' + jsArg(c.id) +
         ',' + jsArg(where) + ',' + idx + ',' + jsArg(a.id) + ')">' + esc(a.label) + '</button>';
  });
  return h + '</div>';
}

// Store a field WITHOUT repainting: this runs on every keystroke in a text box.
function invSetField(id, cid, where, i, key, value) {
  const t = _inv(id); if (!t) return;
  const c = _container(t.block, cid); if (!c) return;
  const list = c.kind === 'slots' ? (t.ctx.data[cid] || {})[where] : t.ctx.data[cid];
  const item = list && list[i]; if (!item) return;
  const num = value !== '' && !isNaN(Number(value));
  if (value === '') delete item[key]; else item[key] = num ? Number(value) : value;
  save();
  // This runs on every keystroke, so the block being typed into is NOT
  // repainted — that would take the field out from under the caret. Everything
  // else is, because a single field here can move a Stat, a Skill or your
  // Damage Resistance.
  blockSyncAll(null);
}

function invAct(id, cid, where, i, actionId) {
  const t = _inv(id); if (!t) return;
  const c = _container(t.block, cid); if (!c) return;
  const list = c.kind === 'slots' ? (t.ctx.data[cid] || {})[where] : t.ctx.data[cid];
  const item = list && list[i]; if (!item) return;
  const fn = sysDerive(t.block.itemAct);
  if (!fn) return;
  let res;
  try { res = fn(actionId, item, S.char); } catch (e) { res = { ok: false, message: e.message }; }
  if (res && res.remove) list.splice(i, 1);
  save(); blockSyncAll(id);
  if (res && res.message && typeof flashSaveError === 'function' && res.ok === false) flashSaveError(res.message);
}

function invSetSkill(id, cid, where, i, value) {
  const t = _inv(id); if (!t) return;
  const c = _container(t.block, cid); if (!c) return;
  const list = c.kind === 'slots' ? (t.ctx.data[cid] || {})[where] : t.ctx.data[cid];
  const item = list && list[i]; if (!item) return;
  if (value) item.skill = value; else delete item.skill;
  save(); blockSyncAll(id);
}

// Redraw every block except the ones the player is typing into.
//
// A block's `affects` list works when the relationship is fixed — a Stat drives
// Health and Mana, and always will. Gear is not like that: a ring can raise any
// Stat, gloves can raise any Skill, armour changes Damage Resistance, and a
// tome adds a Spell. Listing all of that on the gear block would be a lie the
// moment a pack adds a new kind of item, so a change to what you carry redraws
// the sheet instead.
//
// The caret guard is the reason this is safe to call from an oninput handler.
function blockSyncAll(changedId) {
  const blocks = (SYS && SYS.schema && SYS.schema.blocks) || [];
  blocks.forEach(function (b) {
    if (blockHoldsFocus(b.id)) return;
    blockRepaint(b.id);
  });
  // The one being edited is redrawn last, and only if it is not being typed in.
  if (changedId && !blockHoldsFocus(changedId)) blockRepaint(changedId);
}

function invSlotFor(block, container, item) {
  const fn = sysDerive(container.slotFor || block.slotFor);
  if (!fn || !item) return '';
  try { return fn(item, container) || ''; } catch (e) { return ''; }
}

function invMove(id, fromId, toId, slotId, i, wantSlot) {
  const t = _inv(id); if (!t) return;
  const from = _container(t.block, fromId), to = _container(t.block, toId);
  if (!from || !to) return;
  const src = from.kind === 'slots' ? (t.ctx.data[fromId] || {})[slotId] : t.ctx.data[fromId];
  const item = src && src[i];
  if (!item) return;
  // A slots destination needs a target slot. Taking the first one with room put
  // a Club on your head, because Head is simply the first slot in the list.
  // Ask the caller, then the pack, then fall back.
  let destSlot = '';
  if (to.kind === 'slots') {
    const want = wantSlot || invSlotFor(t.block, to, item);
    const fits = x => invRoom(t.block, t.ctx.data, toId, x.id) > 0;
    const s = (want && (to.slots || []).find(x => x.id === want && fits(x)))
           || (to.slots || []).find(fits);
    if (!s) { if (typeof flashSaveError === 'function') flashSaveError(voice('noFreeSlot','No free slot')); return; }
    destSlot = s.id;
  } else if (invRoom(t.block, t.ctx.data, toId, '') === 0) {
    if (typeof flashSaveError === 'function') flashSaveError((to.label || to.id) + ' is full');
    return;
  }
  src.splice(i, 1);
  if (to.kind === 'slots') (t.ctx.data[toId][destSlot] = t.ctx.data[toId][destSlot] || []).push(item);
  else t.ctx.data[toId].push(item);
  save(); blockSyncAll(id);
}
function invCounter(id, cid, delta) {
  const t = _inv(id); if (!t) return;
  t.ctx.data.counters = t.ctx.data.counters || {};
  t.ctx.data.counters[cid] = Math.max(0, (t.ctx.data.counters[cid] || 0) + delta);
  save(); blockSyncAll(id);
}

// ════════════════════════════════════════════════════════════════════════════
// entityList — companions: things that travel with you and have their own
// numbers, but are not characters in their own right. Pets, mounts, minions;
// in another system, allies or contacts or hirelings.
//
// The pack supplies the kinds and a per-row derived readout, so the shell never
// learns what a Floor Number is.
// ════════════════════════════════════════════════════════════════════════════
registerBlockType('entityList', {
  init() { return { entries: [] }; },
  render(ctx) {
    const b = ctx.block, d = ctx.data;
    const kinds = b.kinds || [];
    const rows = d.entries || [];
    let h = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div class="blk-title">${esc(b.label || 'Companions')}</div>
      <div style="display:flex;gap:4px;align-items:center">
        <input id="ent-add-${esc(b.id)}" placeholder="Name" style="width:120px;padding:5px">
        <select id="ent-kind-${esc(b.id)}" style="width:96px">
          ${kinds.map(k => `<option value="${esc(k.id)}">${esc(k.label)}</option>`).join('')}
        </select>
        <button class="btn btn-secondary btn-xs" onclick="entAdd('${esc(b.id)}')">Add</button>
      </div></div>`;
    if (b.hint) h += `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${esc(b.hint)}</div>`;
    if (!rows.length) {
      return h + `<div class="tac text-muted" style="padding:12px;font-size:12px">Nothing travelling with you.</div></div>`;
    }
    rows.forEach((e, i) => {
      const kind = kinds.find(k => k.id === e.kind) || kinds[0] || {};
      const readout = b.readout ? sysDerive(b.readout) : null;
      const bits = readout ? readout(ctx.char, e) : [];
      h += `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700">${esc(e.name)}
              <span style="font-size:10px;color:var(--muted);font-weight:400">${esc(kind.label || e.kind)}</span></div>
            ${bits.length ? `<div style="font-size:11px;color:var(--muted)">${bits.map(esc).join(' · ')}</div>` : ''}
          </div>
          ${e.kind === 'pet' ? `<button class="btn btn-secondary btn-xs" onclick="entLevel('${esc(b.id)}',${i},-1)">−</button>
            <div style="min-width:52px;text-align:center;font-size:11px">
              <div style="font-weight:700">${e.levelsGained || 0}</div>
              <div style="font-size:8px;color:var(--muted)">your levels</div></div>
            <button class="btn btn-secondary btn-xs" onclick="entLevel('${esc(b.id)}',${i},1)">+</button>` : ''}
          <button class="btn btn-secondary btn-xs" onclick="entDel('${esc(b.id)}',${i})">✕</button>
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${esc(kind.note || '')}</div>
      </div>`;
    });
    return h + '</div>';
  },
});

function _ent(id) {
  const char = S && S.char; if (!char) return null;
  const block = sysBlock(id); if (!block) return null;
  return { block, ctx: blockCtx(block, char) };
}
function entAdd(id) {
  const t = _ent(id); if (!t) return;
  const inp = document.getElementById('ent-add-' + id);
  const sel = document.getElementById('ent-kind-' + id);
  const name = (inp && inp.value || '').trim();
  if (!name) return;
  t.ctx.data.entries.push({ name, kind: sel ? sel.value : 'pet', levelsGained: 0 });
  if (inp) inp.value = '';
  save(); blockRepaint(id);
}
function entDel(id, i) {
  const t = _ent(id); if (!t) return;
  t.ctx.data.entries.splice(i, 1);
  save(); blockRepaint(id);
}
function entLevel(id, i, delta) {
  const t = _ent(id); if (!t) return;
  const e = t.ctx.data.entries[i]; if (!e) return;
  e.levelsGained = Math.max(0, (e.levelsGained || 0) + delta);
  save(); blockRepaint(id);
}
