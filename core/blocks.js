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
// Implemented so far (phases D1–D2): traitGrid, track, pool, readout.
// Still to come: textList, catalogItems, groups, variants, entityRefs,
// richText, inventory, statusEffects, progression.

const BLOCK_TYPES = {};
function registerBlockType(id, def) { BLOCK_TYPES[id] = def; }

// ─── context ────────────────────────────────────────────────────────────────
// Every renderer gets {block, data, char, floor, set}. `data` is the block's own
// slice of the character, created on first use so a pack can add a block to an
// existing save without a migration.
function blockCtx(block, char) {
  if (!char.blocks) char.blocks = {};
  if (char.blocks[block.id] === undefined) {
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
  el.innerHTML = blocks.map(b => renderBlock(b, char)).join('');
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
    let h = `<div class="card"><div class="pg-title" style="font-size:18px">${esc(b.label || 'Traits')}</div>`;
    if (b.hint) h += `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${esc(b.hint)}</div>`;
    if (dual) {
      h += `<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:6px 8px;align-items:center">
            <div></div>
            <div class="label" style="margin:0;text-align:center">${esc(b.layers[0] || 'Base')}</div>
            <div class="label" style="margin:0;text-align:center">${esc(b.layers[1] || 'Enhanced')}</div>
            <div class="label" style="margin:0;text-align:center">Mod</div>`;
      traits.forEach(t => {
        const id = t.id || t, cell = d[id] || { base: 0, bonus: 0 };
        const enhanced = (cell.base || 0) + (cell.bonus || 0);
        const mod = modOf ? modOf(enhanced) : 0;
        h += `<div style="font-size:13px;font-weight:600" title="${esc(t.desc || '')}">${esc(t.name || id)}</div>
              <input type="number" value="${cell.base || 0}" style="width:64px;text-align:center;padding:5px"
                oninput="traitSet('${esc(b.id)}','${esc(id)}','base',this.value)">
              <div style="width:64px;text-align:center;font-weight:700">${enhanced}</div>
              <div style="width:52px;text-align:center;color:var(--accent);font-weight:700">${mod >= 0 ? '+' : ''}${mod}</div>`;
      });
      h += `</div><div style="font-size:10px;color:var(--muted);margin-top:8px">
            Enhanced = ${esc(b.layers[0] || 'Base')} + gear, Spells and Buffs. The Mod comes off the Enhanced value.</div>`;
    } else {
      h += `<div style="display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center">`;
      traits.forEach(t => {
        const id = t.id || t;
        h += `<div style="font-size:13px">${esc(t.name || id)}</div>
              <input type="number" value="${d[id] || 0}" style="width:64px;text-align:center;padding:5px"
                oninput="traitSet('${esc(b.id)}','${esc(id)}','value',this.value)">`;
      });
      h += `</div>`;
    }
    return h + '</div>';
  },
});

function traitSet(blockId, traitId, layer, v) {
  const char = S && S.char; if (!char) return;
  const block = sysBlock(blockId); if (!block) return;
  const d = blockCtx(block, char).data;
  const n = parseInt(v, 10) || 0;
  if (block.layers) { if (!d[traitId]) d[traitId] = { base: 0, bonus: 0 }; d[traitId][layer === 'bonus' ? 'bonus' : 'base'] = n; }
  else d[traitId] = n;
  save();
  blockRepaint(blockId);
  (block.affects || []).forEach(blockRepaint);   // e.g. stats -> health, mana, evade
}

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
             <div class="pg-title" style="font-size:18px">${esc(b.label || 'Track')}</div>
             <div style="font-size:12px;color:var(--muted)">${remaining}/${count}${b.percent ? ' · ' + Math.round(remaining / count * 100) + '%' : ''}</div></div>`;
    h += `<div style="display:flex;gap:3px;flex-wrap:wrap">`;
    for (let i = 0; i < count; i++) {
      // rtl: slot 0 is the leftmost/lowest %, and marks land on the highest first
      const isMarked = rtl ? (i >= remaining) : (i < marked);
      const pct = Math.round((i + 1) / count * 100);
      h += `<div onclick="trackToggle('${esc(b.id)}',${i})" title="${b.percent ? pct + '%' : ''}"
             style="width:38px;height:44px;border:2px solid ${isMarked ? 'var(--red)' : 'var(--border)'};
             border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;
             cursor:pointer;background:${isMarked ? 'var(--surface3)' : 'var(--surface2)'};
             opacity:${isMarked ? '.45' : '1'}">
             <div style="font-weight:700;font-size:14px">${slotValue}</div>
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
    const cur = d.current || 0;
    return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center">
      <div><div class="pg-title" style="font-size:18px">${esc(b.label || b.id)}</div>
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
