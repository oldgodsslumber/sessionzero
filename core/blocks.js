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
// Implemented so far: traitGrid, track, pool, tally, readout, skillList, inventory,
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

// A block can be on screen more than once: the Health Bar is block two of the
// crawler sheet AND the first thing on the HUD. The id stays unique per mount
// so nothing is duplicated, and every lookup goes through the data attribute so
// a repaint reaches all of them. Taking damage on one screen and leaving the
// other showing stale hit points is the bug this shape exists to prevent.
function blockElId(id, mount) { return (mount ? mount + '-' : '') + 'blk-' + id; }
function blockMounts(id) {
  return [].slice.call(document.querySelectorAll('[data-blk="' + id + '"]'));
}

// Render one block into its own wrapper.
function renderBlock(block, char, mount) {
  const t = BLOCK_TYPES[block.type];
  const inner = block.render ? block.render(blockCtx(block, char))
              : t ? t.render(blockCtx(block, char))
              : `<div class="card"><div class="label">${esc(block.id)}</div>
                 <div style="font-size:12px;color:var(--muted)">No renderer for block type
                 "${esc(block.type || 'none')}" yet.</div></div>`;
  // `span` is the block's own answer to "how wide am I on a desktop": 1, 2, 3 or
  // 'full'. It is declared by the pack and read only by CSS, so a pack that says
  // nothing gets one column and nothing here has to know what a column is. It
  // rides on the wrapper rather than the content because blockRepaint() replaces
  // the content — a span written inside it would be lost on the first repaint.
  const span = block.span ? ` data-span="${esc(String(block.span))}"` : '';
  return `<div id="${blockElId(block.id, mount)}" class="blk" data-blk="${esc(block.id)}"${span}>${inner}</div>`;
}

// Re-render a block in place, on every screen currently showing it.
function blockRepaint(id) {
  if (!SYS) return;
  const block = sysBlock(id);
  const mounts = blockMounts(id);
  if (!block || !mounts.length) return;
  const char = (typeof S !== 'undefined' && S) ? S.char : null;
  if (!char) return;
  const t = BLOCK_TYPES[block.type];
  const html = block.render ? block.render(blockCtx(block, char))
             : t ? t.render(blockCtx(block, char)) : '';
  mounts.forEach(function (el) { el.innerHTML = html; });
}

// Render every declared block, in order. `mount` namespaces the wrapper ids so
// a second screen showing the same blocks does not collide with the sheet.
// `only` names the blocks to draw, for a surface that wants some of them — a
// pack tab. Without it the sheet draws everything EXCEPT what a tab has claimed,
// so a block does not appear twice under two headings.
function renderBlockSheet(char, targetEl, mount, only) {
  const el = typeof targetEl === 'string' ? document.getElementById(targetEl) : targetEl;
  if (!el || !SYS) return;
  const all = (SYS.schema && SYS.schema.blocks) || [];
  const claimed = (typeof sysTabBlockIds === 'function') ? sysTabBlockIds() : [];
  const blocks = only && only.length
    ? only.map(function (id) { return all.filter(function (b) { return b.id === id; })[0]; }).filter(Boolean)
    : all.filter(function (b) { return claimed.indexOf(b.id) < 0; });
  // The container carries the layout, the blocks carry their spans. Stamped
  // here rather than asked of the caller so every mount — sheet, second screen,
  // whatever a pack adds next — gets the desktop columns without being told.
  el.classList.add('blk-sheet');
  // Rendered one at a time. A single throw used to abort the whole map, so
  // nothing was assigned and the sheet showed only the cards above this
  // element — the character looked like it had failed to finish creation.
  // Now the rest of the sheet survives and the broken block says what happened.
  el.innerHTML = blocks.map(function (b) {
    try {
      return renderBlock(b, char, mount);
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
      // A fifth column only when there is something to put in it: a pack with no
      // dice contract must not get an empty gutter down its Stat grid.
      const roll = typeof rollSurfaces === 'function' && rollSurfaces() === 'sys';
      h += `<div style="display:grid;grid-template-columns:1fr auto auto auto${roll ? ' auto' : ''};gap:6px 8px;align-items:center">
            <div></div>
            <div class="label" style="margin:0;text-align:center">${esc(b.layers[0] || 'Base')}</div>
            <div class="label" style="margin:0;text-align:center">${esc(b.layers[1] || 'Enhanced')}</div>
            <div class="label" style="margin:0;text-align:center">Mod</div>
            ${roll ? '<div></div>' : ''}`;
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
              <div id="tg-${esc(b.id)}-${esc(id)}-mod" style="width:52px;text-align:center;color:var(--accent);font-weight:700">${mod >= 0 ? '+' : ''}${mod}</div>
              ${roll ? traitRollBtn(b.id, id, t.name || id) : ''}`;
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
// element out from under the player mid-keystroke. True if ANY mount holds it:
// the repaint is all-or-nothing, so one screen being typed into protects the
// other as well rather than letting them fall out of step.
function blockHoldsFocus(id) {
  const a = document.activeElement;
  if (!a || a === document.body) return false;
  return blockMounts(id).some(function (el) { return el.contains(a); });
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
// tally — a quantity that gets large.
//
// A pool with plus and minus buttons is right for Mana or AI Favor, where the
// numbers are small and every single point is a decision. It is useless for
// money: the book prices an Engineering Table at 2,000 gold and a Sapper's
// Table at 3,000, and prints a reward of 250,000. Nobody is clicking a ticker
// a quarter of a million times.
//
// So: a grouped readout, an amount box with gained/spent, and a way to type the
// exact figure when it needs correcting. What actually happens at a table is
// "we found 2d8" or "that costs 2,000", which is an adjustment — so that is the
// control nearest to hand, and the absolute set sits quieter underneath.
// ════════════════════════════════════════════════════════════════════════════
registerBlockType('tally', {
  init(block) { return { current: block.start || 0 }; },
  render(ctx) {
    const b = ctx.block, d = ctx.data;
    const id = esc(b.id);
    return `<div class="card">
      <div class="blk-title">${esc(b.label || b.id)}</div>
      ${b.hint ? `<div class="tal-hint">${esc(b.hint)}</div>` : ''}
      <div class="tal-n" id="tal-n-${id}">${esc(tallyFormat(d.current))}</div>
      <div class="tal-row">
        <input id="tal-adj-${id}" type="number" min="0" step="1" placeholder="amount"
               onkeydown="if(event.key==='Enter')tallyAdjust('${id}',1)">
        <button class="btn btn-primary btn-xs" onclick="tallyAdjust('${id}',1)">Gained</button>
        <button class="btn btn-secondary btn-xs" onclick="tallyAdjust('${id}',-1)">Spent</button>
      </div>
      <div class="tal-row tal-set">
        <input id="tal-set-${id}" type="number" min="0" step="1" placeholder="or set the exact total">
        <button class="btn btn-secondary btn-xs" onclick="tallySet('${id}')">Set</button>
      </div>
    </div>`;
  },
});

// Grouped in threes so six figures can be read at a glance rather than counted.
function tallyFormat(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Never below zero: you cannot owe the System money, and a negative total is a
// typo every time.
function tallyWrite(id, value) {
  const char = S && S.char; if (!char) return;
  const block = sysBlock(id); if (!block) return;
  const ctx = blockCtx(block, char);
  ctx.data.current = Math.max(0, Math.round(Number(value) || 0));
  save();
  // Only the readout changed. Repainting the whole block would wipe the boxes
  // the player is mid-way through typing in.
  const el = document.getElementById('tal-n-' + id);
  if (el) el.textContent = tallyFormat(ctx.data.current);
  (block.affects || []).forEach(function (other) {
    if (!blockHoldsFocus(other)) blockRepaint(other);
  });
}

function tallyAdjust(id, sign) {
  const char = S && S.char; if (!char) return;
  const block = sysBlock(id); if (!block) return;
  const inp = document.getElementById('tal-adj-' + id);
  const amount = Math.abs(Math.round(Number(inp && inp.value) || 0));
  if (!amount) return;
  const cur = Number(blockCtx(block, char).data.current) || 0;
  tallyWrite(id, cur + sign * amount);
  if (inp) inp.value = '';
}

function tallySet(id) {
  const inp = document.getElementById('tal-set-' + id);
  if (!inp || String(inp.value).trim() === '') return;
  tallyWrite(id, inp.value);
  inp.value = '';
}

// ════════════════════════════════════════════════════════════════════════════
// pool — a small current/max resource (Mana, AI Favor, Popularity).
// For anything that reaches four figures, use `tally` — see above.
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
//
// A row also loads itself into the roller. Reading a Skill and rolling it are
// the same motion at the table, and splitting them across a sheet and a tab was
// how a whole game shipped with nowhere to roll. Nothing is offered to a pack
// with no dice contract, and a passive Skill is not something you roll.
// ════════════════════════════════════════════════════════════════════════════
// The die button a rollable row carries. On desktop it pops the roller up next
// to the row; on a phone there is nowhere to put a popover, so the sticky bar
// opens instead. `ref` names the thing unambiguously — a Stat called Strength
// and a Skill called Strength are different rolls.
function rollRowBtn(ref, title) {
  if (typeof rollSurfaces !== 'function' || rollSurfaces() !== 'sys') return '';
  return '<button class="btn btn-secondary btn-xs" style="padding:3px 6px" title="' +
    esc(title || 'Roll this') + '" onclick="sysOpenRoller(&#39;' +
    esc(String(ref).replace(/\\/g, '\\\\').replace(/'/g, "\\'")) +
    '&#39;,this)">\u{1F3B2}</button>';
}

// Give a Skill an icon. Skills have no detail panel to put a field in, so the
// popover IS the affordance — the same shell panel the roller is summoned into.
// The ⋯ that opens one entry's own fields. Only shown where the pack has
// declared some, so a block with no vocabulary gets the row it always had.
let _skillDetailOpen = '';
function skillDetailKey(id, i) { return id + ':' + i; }
function skillDetailBtn(b, i) {
  if (!entryFieldsOf(b).length) return '';
  const open = _skillDetailOpen === skillDetailKey(b.id, i);
  return '<button class="btn btn-secondary btn-xs ic-btn" title="' +
    (open ? 'Close' : 'What this is — Mana, range, what it does') + '"' +
    ' onclick="skillDetail(' + jsArg(b.id) + ',' + i + ')">' + (open ? '−' : '⋯') + '</button>';
}

function skillDetail(id, i) {
  const key = skillDetailKey(id, i);
  _skillDetailOpen = _skillDetailOpen === key ? '' : key;
  blockRepaint(id);
}

// One entry's fields, plus what the catalogue would have said if the player
// leaves them empty — because a blank box beside a Spell the book DOES describe
// reads as though the app has lost the description.
function skillDetailPanel(b, entry, i) {
  if (_skillDetailOpen !== skillDetailKey(b.id, i)) return '';
  const fields = entryFieldsOf(b);
  if (!fields.length) return '';
  const look = sysDerive(b.lookup);
  let cat = null;
  try { cat = look ? look(entry.name) : null; } catch (e) { cat = null; }
  let h = '<div class="inv-detail">';
  h += detailFieldsHTML(fields, entry, {
    set: function (f) {
      return 'skillSetField(' + jsArg(b.id) + ',' + i + ',' + jsArg(f.key) + ',this.value)';
    },
    // Skills already carry an icon button of their own on the row, so the
    // picker is not repeated inside the panel.
    icon: null,
  });
  // Anything the pack can DO with this entry — writing a scroll of it, so far.
  // Same shape as an item's actions, in the same panel, for the same reason.
  const actFn = sysDerive(b.entryActions);
  let acts = [];
  if (actFn) {
    try { acts = actFn(entry, (typeof S !== 'undefined' && S) ? S.char : null) || []; } catch (e) { acts = []; }
  }
  acts.forEach(function (a) {
    h += '<button class="btn btn-primary btn-xs" onclick="skillAct(' + jsArg(b.id) + ',' + i +
         ',' + jsArg(a.id) + ')">' + esc(a.label) + '</button>';
  });
  if (cat) {
    const from = fields.filter(function (f) {
      return (entry[f.key] === undefined || entry[f.key] === '') &&
             cat[f.key] !== undefined && cat[f.key] !== null && cat[f.key] !== '';
    }).map(function (f) { return f.label + ': ' + String(cat[f.key]); });
    if (from.length) {
      h += '<div class="inv-f inv-f-wide" style="font-size:10px;color:var(--muted)">' +
        'From the book, unless you fill it in: ' + esc(from.join(' · ')) + '</div>';
    }
  } else {
    h += '<div class="inv-f inv-f-wide" style="font-size:10px;color:var(--muted)">' +
      esc(entry.name) + ' is not in the book, so what it does is whatever you write here.</div>';
  }
  return h + '</div>';
}

// Do the thing this entry can do. The pack owns what that is and what it costs;
// the shell runs it, saves, redraws and says what came back.
function skillAct(id, i, actionId) {
  const t = _skillData(id); if (!t) return null;
  const entry = (t.ctx.data.skills || [])[i]; if (!entry) return null;
  const fn = sysDerive(t.block.entryAct); if (!fn) return null;
  let res;
  try { res = fn(actionId, entry, S.char); } catch (e) { res = { ok: false, message: e.message }; }
  if (res && res.remove) t.ctx.data.skills.splice(i, 1);
  save(); blockSyncAll(null);
  if (res && res.message) {
    if (res.ok === false) { if (typeof flashSaveError === 'function') flashSaveError(res.message); }
    else if (typeof flashNote === 'function') flashNote(res.message);
  }
  return res || null;
}

// Store WITHOUT repainting the block being typed into — same rule as gear.
function skillSetField(id, i, key, value) {
  const t = _skillData(id); if (!t) return;
  const entry = (t.ctx.data.skills || [])[i]; if (!entry) return;
  const num = value !== '' && !isNaN(Number(value));
  if (value === '') delete entry[key]; else entry[key] = num ? Number(value) : value;
  save();
  // Everything else is redrawn, because a Mana cost typed here changes the
  // Spell's card on the HUD; the block holding the caret is left alone.
  blockSyncAll(null);
}

function skillIconBtn(b, s, i) {
  if (typeof iconField !== 'function') return '';
  return '<button class="btn btn-secondary btn-xs ic-btn" title="' +
    (s.icon ? 'Change the icon' : 'Choose an icon') + '"' +
    ' onclick="skillIconOpen(' + jsArg(b.id) + ',' + i + ',this)">' +
    (s.icon ? iconHTML(s.icon, 14) : '<span class="ic-btn-empty">◌</span>') + '</button>';
}

function skillIconOpen(blockId, i, anchor) {
  const block = sysBlock(blockId);
  const char = (typeof S !== 'undefined' && S) ? S.char : null;
  if (!block || !char) return;
  const list = blockCtx(block, char).data.skills || [];
  const s = list[i];
  if (!s) return;
  iconInit('skill', {
    value: s.icon || '', fallback: s.name,
    onPick: function (v) { s.icon = v; save(); blockRepaint(blockId); },
  });
  popOpen('<div class="pg-title" style="font-size:15px;margin-bottom:6px">' + esc(s.name) + '</div>' +
    iconField('skill', { placeholder: 'Search icons — ' + esc(s.name) + ', flame, shield…' }), anchor);
  iconPreview('skill');
  iconSearch('skill');
}

function skillRollBtn(s, blockId) {
  if (typeof rollSurfaces !== 'function' || rollSurfaces() !== 'sys') return '';
  if (s && s.passive) return '<span style="width:26px"></span>';
  return rollRowBtn(rollRef('skill', blockId, s.name), 'Roll ' + s.name);
}

// The same control on a Stat row. A Stat Check adds no Skill Ranks, so the
// roller picks the pack's own check kind when one of these is loaded.
function traitRollBtn(blockId, traitId, name) {
  if (typeof rollSurfaces !== 'function' || rollSurfaces() !== 'sys') return '';
  return rollRowBtn(rollRef('stat', blockId, traitId), 'Roll ' + (name || traitId));
}

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
          <div style="font-size:13px;font-weight:600">${s.icon ? iconHTML(s.icon, 15) + ' ' : ''}${esc(s.name)}${s.passive ? ' <span style="font-size:9px;color:var(--muted)">PASSIVE</span>' : ''}${s.custom ? ' <span style="font-size:9px;color:var(--accent)">CUSTOM</span>' : ''}</div>
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
        <div class="sk-total" style="min-width:44px;text-align:right;font-weight:700;color:var(--accent)">${total >= 0 ? '+' : ''}${total}</div>
        ${skillIconBtn(b, s, i)}
        ${skillDetailBtn(b, i)}
        ${skillRollBtn(s, b.id)}
        ${skillIsYours(s)
          ? `<button class="btn btn-secondary btn-xs" title="Remove this ${esc(b.label || 'entry')} — you added it yourself" onclick="skillDel('${esc(b.id)}',${i})">✕</button>`
          : `<span style="width:24px" title="This came from character creation, so it is part of who you are rather than something to delete"></span>`}
      </div>${skillDetailPanel(b, s, i)}`;
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
        <div class="sk-total" style="min-width:44px;text-align:right;font-weight:700;color:var(--accent)">${total >= 0 ? '+' : ''}${total}</div>
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

// The fields a pack lets a player fill in on one entry — the Spell's Mana, its
// effect, what it does. Declared exactly like an item's `itemFields`.
function entryFieldsOf(block) {
  const fn = sysDerive(block && block.entryFields);
  if (!fn) return Array.isArray(block && block.entryFields) ? block.entryFields : [];
  try { return fn() || []; } catch (e) { return []; }
}

// What this entry actually IS: the catalogue row, with anything the player has
// filled in themselves laid over the top.
//
// The catalogue used to be the only answer, which meant a Spell that is not in
// the book — one you invented, one the GM handed you, one crafted with Arcane,
// which Table 45 says is a thing you can do — had no Mana cost, no damage and
// no text, on the sheet, in the HUD and on the printed page alike. It also
// meant a garbled entry (the catalogue was read out of a PDF and some of it
// came back mangled) could not be corrected by the person looking at it.
//
// One resolution point, so every surface agrees about what a Spell costs.
function skillFacts(block, entry) {
  if (!entry) return null;
  const look = sysDerive(block && block.lookup);
  let cat = null;
  try { cat = look ? look(entry.name) : null; } catch (e) { cat = null; }
  const out = Object.assign({}, cat || {});
  entryFieldsOf(block).forEach(function (f) {
    const v = entry[f.key];
    if (v === undefined || v === null || v === '') return;
    out[f.key] = v;
  });
  if (!cat && !Object.keys(out).length) return null;
  if (!out.name) out.name = entry.name;
  return out;
}

function skillInfo(block, entry, char) {
  char = char || ((typeof S !== 'undefined' && S) ? S.char : null);
  if (!entry) return '';
  const cat = skillFacts(block, entry);
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
  const fields = invDetailFields(b, item);
  const rowKey = c.id + ':' + where + ':' + idx;
  const openDetail = _invDetailItem ? _invDetailItem === item : _invDetailOpen === rowKey;
  let detail = '';
  if (fields && fields.length) {
    detail = `<button class="btn btn-secondary btn-xs" title="What this is"
      onclick="invDetail('${esc(b.id)}','${esc(rowKey)}')">${openDetail ? '−' : '⋯'}</button>`;
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
    <div class="inv-name">${item.icon ? iconHTML(item.icon, 16) + ' ' : ''}${esc(item.name)}${item.qty > 1 ? ` <span style="color:var(--muted)">×${item.qty}</span>` : ''}
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
    if (!items.filter(Boolean).length) h += `<div style="font-size:11px;color:var(--muted);padding:2px 0">empty</div>`;
    // A hole in a slots container is not a thing to draw. One null here used to
    // throw out of invItemRow and take the whole Gear block with it.
    items.forEach((it, i) => { if (it) h += invItemRow(b, c, it, s.id, i); });
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
    const char = (typeof S !== 'undefined' && S) ? S.char : null;
    const line = invReadout(b, it, char);
    // A stack row used to be the ONE container with no detail panel, so an item
    // added straight to the Hotlist could never be given an icon or told what it
    // works as — and the Hotlist is exactly the container whose icons are read
    // at arm's length on the HUD keypad. Two playtesters found it independently.
    const fields = invDetailFields(b, it);
    const rowKey = c.id + ':' + '' + ':' + i;
    const openDetail = _invDetailItem ? _invDetailItem === it : _invDetailOpen === rowKey;
    h += `<div class="inv-name">${it.icon ? iconHTML(it.icon, 15) + ' ' : ''}${esc(it.name)}${line ? `<span class="inv-stat">${esc(line)}</span>` : ''}</div>
      <div class="inv-ctl">
      <button class="btn btn-secondary btn-xs" onclick="invQty('${esc(b.id)}','${esc(c.id)}',${i},-1)">−</button>
      <div class="num" style="min-width:28px;text-align:center;font-weight:700">${it.qty || 1}</div>
      <button class="btn btn-secondary btn-xs" onclick="invQty('${esc(b.id)}','${esc(c.id)}',${i},1)">+</button>`;
    if (fields && fields.length) {
      h += `<button class="btn btn-secondary btn-xs" title="What this is"
        onclick="invDetail('${esc(b.id)}','${esc(rowKey)}')">${openDetail ? '−' : '⋯'}</button>`;
    }
    (b.containers || []).filter(x => x.id !== c.id).forEach(x => {
      h += `<button class="btn btn-secondary btn-xs" onclick="invMove('${esc(b.id)}','${esc(c.id)}','${esc(x.id)}','',${i})">→ ${esc((x.label || x.id).split(' ')[0])}</button>`;
    });
    h += `<button class="btn btn-secondary btn-xs" title="Remove" onclick="invRemove('${esc(b.id)}','${esc(c.id)}','',${i})">✕</button></div>`;
    if (openDetail && fields && fields.length) h += invDetailHTML(b, c, it, '', i, fields);
    h += `</div>`;
  }
  return h + `</div>`;
}

function invList(b, c, d) {
  const items = d[c.id] || [];
  if (!items.filter(Boolean).length) return `<div style="font-size:11px;color:var(--muted);padding:2px 0">empty</div>`;
  return items.map((it, i) => !it ? '' : invItemRow(b, c, it, '', i,
    `<button class="btn btn-secondary btn-xs" onclick="invQty('${esc(b.id)}','${esc(c.id)}',${i},-1)">−</button>
     <div style="min-width:26px;text-align:center;font-weight:700">${it.qty || 1}</div>
     <button class="btn btn-secondary btn-xs" onclick="invQty('${esc(b.id)}','${esc(c.id)}',${i},1)">+</button>`)).join('');
}

// What an item IS, as opposed to what it is called. A pack lists the things an
// item can work as — for a weapon that is the Skill you attack with — so a
// Baseball Bat can be a real Club rather than a label.
// ─── what KIND of thing is this ─────────────────────────────────────────────
// The first question used to be "which weapon is it?" — the only control on the
// add box was a list of attack Skills, so a potion, a rope and a coupon all had
// to answer a question that was not about them, and every field in the editor
// was shown for every item whatever it was.
//
// A pack declares its kinds; the shell asks which one first and then shows only
// what that kind needs. `other` is the way out: an item that is none of these is
// still just a name, which is how "12 googly eyes" got onto a sheet.
function invKinds(block) {
  const fn = sysDerive(block && block.itemKinds);
  let kinds = [];
  if (fn) { try { kinds = fn() || []; } catch (e) { kinds = []; } }
  else if (Array.isArray(block && block.itemKinds)) kinds = block.itemKinds;
  return kinds;
}
function invKind(block, id) {
  return invKinds(block).filter(function (k) { return k.id === id; })[0] || null;
}

// The fields this kind cares about, in the pack's declared order. A kind that
// names none — or an item with no kind at all — gets the whole list, which is
// what every item used to get.
function invFieldsFor(block, kindId) {
  const fn = sysDerive(block.itemFields);
  let all = [];
  if (fn) { try { all = fn() || []; } catch (e) { all = []; } }
  else if (Array.isArray(block.itemFields)) all = block.itemFields;
  const k = invKind(block, kindId);
  if (!k || !k.fields || !k.fields.length) return all;
  return k.fields.map(function (key) {
    return all.filter(function (f) { return f.key === key; })[0];
  }).filter(Boolean);
}

// What this kind may work AS. A weapon swings with an attack Skill; a tool is
// used with any Skill at all; a potion works as nothing. The pack answers, and
// is asked with the kind so it can give a different list per kind.
function invAsOptions(block, kindId) {
  const fn = sysDerive(block.itemOptions);
  if (!fn) return [];
  try { return fn(kindId) || []; } catch (e) { return []; }
}

let _invAddKind = {};
function invAddKindKey(bId, cId) { return bId + ':' + cId; }
function invSetAddKind(bId, cId, value) {
  _invAddKind[invAddKindKey(bId, cId)] = value;
  blockRepaint(bId);
}

function invAsPick(b, c, chosen) {
  const kindId = _invAddKind[invAddKindKey(b.id, c.id)] || '';
  const opts = invAsOptions(b, kindId);
  if (!opts.length) return '';
  const k = invKind(b, kindId);
  const label = (k && k.asLabel) || 'What this works as';
  return `<select id="inv-as-${esc(b.id)}-${esc(c.id)}" title="${esc(label)}" style="flex:0 0 132px">` +
    `<option value="">— ${esc(label)} —</option>` +
    opts.map(o => `<option value="${esc(o.value)}"${o.value === chosen ? ' selected' : ''}>${esc(o.label)}</option>`).join('') +
    `</select>`;
}

// The kind picker itself, which only exists for a pack that declares kinds.
function invKindPick(b, c) {
  const kinds = invKinds(b);
  if (!kinds.length) return '';
  const cur = _invAddKind[invAddKindKey(b.id, c.id)] || '';
  return `<select id="inv-kind-${esc(b.id)}-${esc(c.id)}" title="What kind of thing this is"
      style="flex:0 0 128px"
      onchange="invSetAddKind(${jsArg(b.id)},${jsArg(c.id)},this.value)">` +
    `<option value="">— what is it? —</option>` +
    kinds.map(k => `<option value="${esc(k.id)}"${k.id === cur ? ' selected' : ''}>${esc(k.label || k.id)}</option>`).join('') +
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
  // The pack's own catalogue on the box, so the book's items can be typed by
  // name and arrive with what the book says they do. A pack with no catalogue
  // gets the plain box it always had.
  const cat = (b.catalog && SYS && SYS.catalogs && SYS.catalogs[b.catalog]) || [];
  const listId = 'inv-cat-' + b.id + '-' + c.id;
  const datalist = cat.length
    ? `<datalist id="${esc(listId)}">` +
      cat.map(x => `<option value="${esc(x.name || x)}">`).join('') + `</datalist>`
    : '';
  // Kind first, then the name, then whatever that kind needs. Picking a kind
  // redraws the row, so a weapon grows a Skill picker and a potion does not.
  const kindId = _invAddKind[invAddKindKey(b.id, c.id)] || '';
  const k = invKind(b, kindId);
  return `<div class="inv-add">
    <input id="inv-add-${esc(b.id)}-${esc(c.id)}" placeholder="${esc(k ? 'Name your ' + String(k.label || k.id).toLowerCase() + '…' : 'Add to ' + (c.label || c.id) + '…')}"
      ${cat.length ? `list="${esc(listId)}"` : ''}
      onkeydown="if(event.key==='Enter')invAdd('${esc(b.id)}','${esc(c.id)}')">${datalist}
    <div class="inv-add-opts">${invKindPick(b, c)}${slotPick}${invAsPick(b, c, '')}
      <button class="btn btn-secondary btn-xs" onclick="invAdd('${esc(b.id)}','${esc(c.id)}')">Add</button></div>
    ${k && k.hint ? `<div style="font-size:10px;color:var(--muted);margin-top:3px">${esc(k.hint)}</div>` : ''}</div>`;
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
  // Holes are not occupancy: a stack with slot 1 emptied still has room in it.
  if (c.kind === 'stack') {
    return Math.max(0, (c.size || 10) - (data[cid] || []).filter(Boolean).length);
  }
  return null;
}

// ── stack containers keep their slot numbers ────────────────────────────────
// A stack is a KEYPAD, not a list: slot 3 is slot 3 whatever happens to slot 1.
// Emptying one leaves a hole rather than closing up, and adding fills the first
// hole rather than appending.
//
// Splicing was the bug two playtesters found independently: drinking the potion
// in slot 1 shifted every later item down a slot, so the Hotlist rearranged
// itself at the exact moment a player is relying on muscle memory — which is
// the whole reason the keypad has fixed positions.
function invIsStack(block, cid) {
  const c = _container(block, cid);
  return !!c && c.kind === 'stack';
}
function invVacate(arr, i, isStack) {
  if (!Array.isArray(arr)) return;
  if (isStack) arr[i] = null; else arr.splice(i, 1);
}
// `at` asks for one particular slot number — what a keypad needs, where the
// point of Slot 4 is that it is always Slot 4. It is a preference, not a
// demand: an occupied slot falls through to the first one with room.
function invPlace(arr, item, size, at) {
  if (at != null && at >= 0 && at < size && !arr[at]) { arr[at] = item; return at; }
  for (let k = 0; k < size; k++) {
    if (!arr[k]) { arr[k] = item; return k; }
  }
  arr.push(item);
  return arr.length - 1;
}
function invAdd(id, cid) {
  const t = _inv(id); if (!t) return;
  const inp = document.getElementById('inv-add-' + id + '-' + cid);
  const name = (inp && inp.value || '').trim();
  if (!name) return;
  const c = _container(t.block, cid);
  if (!c) return;
  // A container this save has never used may simply be absent. invMove creates
  // it; adding threw instead, and the throw was silent because the button has
  // nowhere to report to.
  if (!t.ctx.data[cid]) t.ctx.data[cid] = c.kind === 'slots' ? {} : [];
  // Adding from the box leaves the caret in the box: you type, press Enter, and
  // type the next one.
  const keepFocus = !!inp && document.activeElement === inp;
  const refocus = function () {
    if (!keepFocus) return;
    const again = document.getElementById('inv-add-' + id + '-' + cid);
    if (again) again.focus();
  };
  const sel = document.getElementById('inv-slot-' + id + '-' + cid);
  const slotId = sel ? sel.value : '';
  // What it works as: the player's pick, or an exact catalogue match on the
  // name so typing "Club" simply is a Club.
  const kindSel = document.getElementById('inv-kind-' + id + '-' + cid);
  let kindId = kindSel ? kindSel.value : (_invAddKind[invAddKindKey(id, cid)] || '');
  const asSel = document.getElementById('inv-as-' + id + '-' + cid);
  let works = asSel ? asSel.value : '';
  if (!works) {
    const look = sysDerive(t.block.lookup);
    const hit = look ? look(name) : null;
    // Only to something the editor can also SHOW. The lookup covers every Skill
    // in the catalogue while the "works as" list is weapons, so typing "Cooking"
    // used to attach a Skill the dropdown then rendered as "—" — an invisible
    // value the player could not see, keep or clear.
    // With a kind chosen, only link to what that kind can work as. With none —
    // somebody typing "Club" straight into the box, which is the fastest way to
    // add a weapon and has always worked — let the name say what it is, and
    // record that it is a weapon.
    if (hit && hit.name && hit.name.toLowerCase() === name.toLowerCase()) {
      if (kindId && invOffers(t.block, hit.name, kindId)) works = hit.name;
      else if (!kindId && invOffers(t.block, hit.name, 'weapon')) { works = hit.name; kindId = 'weapon'; }
    }
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
      save(); blockSyncAll(id, { force: true }); refocus();
      return;
    }
    // A new name needs a free slot of its own.
    if (invRoom(t.block, t.ctx.data, cid, slotId) === 0) {
      if (typeof flashSaveError === 'function') flashSaveError(voice('noRoom','No room there'));
      return;
    }
    // invPlace, not push: a stack is a keypad. Appending past the last slot put
    // the item at index 10 of a ten-slot Hotlist, where nothing renders it —
    // not the sheet, not the HUD, not print — while invRoom still counted it,
    // so the visibly empty slot refused everything for ever after.
    invPlace(list, invNewItem(t.block, name, works, kindId), c.size || 10);
    if (inp) inp.value = '';
    save(); blockSyncAll(id, { force: true }); refocus();
    return;
  }

  if (invRoom(t.block, t.ctx.data, cid, slotId) === 0) {
    if (typeof flashSaveError === 'function') flashSaveError(voice('noRoom','No room there'));
    return;
  }
  const item = invNewItem(t.block, name, works, kindId);
  if (c.kind === 'slots') (t.ctx.data[cid][slotId] = t.ctx.data[cid][slotId] || []).push(item);
  else if (c.kind === 'stack') invPlace(t.ctx.data[cid], item, c.size || 10);
  else t.ctx.data[cid].push(item);
  if (inp) inp.value = '';
  save(); blockSyncAll(id, { force: true }); refocus();
}

// One new item. A pack that declares an item template gets asked first, so a
// name in its catalogue arrives carrying what the book gives it; anything else
// is a name and a quantity, which is what an item has always been.
function invNewItem(block, name, works, kindId) {
  const fn = sysDerive(block.itemTemplate);
  let base = null;
  if (fn) { try { base = fn(name) || null; } catch (e) { base = null; } }
  const k = invKind(block, kindId);
  // The kind rides along on the item. It is what lets the ⋯ panel keep showing
  // the right fields a week later, and what a long catalogue is filtered by.
  const item = Object.assign({ name: name, qty: 1 },
                             (k && k.defaults) || {}, base || {},
                             kindId ? { kind: kindId } : {});
  if (works) item.skill = works;
  return item;
}

// Does the pack's "works as" list offer this name? Used to decide whether a
// name typed into the add box may quietly link itself to a catalogue entry.
function invOffers(block, name, kindId) {
  const opts = invAsOptions(block, kindId);
  if (!opts.length) return false;
  const want = String(name).toLowerCase();
  return opts.some(function (o) {
    const v = o && o.value !== undefined ? o.value : o;
    return String(v).toLowerCase() === want;
  });
}
function invRemove(id, cid, slotId, i) {
  const t = _inv(id); if (!t) return;
  const c = _container(t.block, cid);
  const arr = c.kind === 'slots' ? (t.ctx.data[cid] || {})[slotId] : t.ctx.data[cid];
  if (!arr) return;
  invVacate(arr, i, c.kind === 'stack');
  save(); blockSyncAll(id, { force: true });
}
function invQty(id, cid, i, delta) {
  const t = _inv(id); if (!t) return;
  const c = _container(t.block, cid);
  const arr = t.ctx.data[cid];
  const it = Array.isArray(arr) ? arr[i] : null;
  if (!it) return;
  // Only a container that declares a cap has one. The Hotlist's 999 was being
  // applied to the Inventory, whose only stated limit is what you can lift.
  const max = c.stackMax || Infinity;
  it.qty = Math.max(1, Math.min(max, (it.qty || 1) + delta));
  save(); blockSyncAll(id, { force: true });
}

// Spend one. Unlike invQty this can reach empty: quantity clamps at 1 there
// because the ± controls should never silently bin an item, but drinking your
// last potion has to be possible, and going to the sheet to delete the empty
// slot mid-fight is not a thing anyone will do.
//
// Returns what it did, so the caller can offer an undo — a tap that spends
// something with no ± to correct it needs a way back.
function invSpend(id, cid, i) {
  const t = _inv(id); if (!t) return null;
  const arr = t.ctx.data[cid];
  const it = Array.isArray(arr) ? arr[i] : null;
  if (!it) return null;
  const qty = it.qty || 1;
  const stack = invIsStack(t.block, cid);
  const undo = { blockId: id, cid: cid, index: i, stack: stack,
                 item: JSON.parse(JSON.stringify(it)), emptied: qty <= 1 };
  if (qty <= 1) invVacate(arr, i, stack);
  else it.qty = qty - 1;
  save(); blockSyncAll(id, { force: true });
  return undo;
}

// Put back exactly what invSpend() took, in the slot it came from — which for a
// stack means THAT slot number, not "wherever it lands".
function invUnspend(u) {
  if (!u) return;
  const t = _inv(u.blockId); if (!t) return;
  const arr = t.ctx.data[u.cid];
  if (!Array.isArray(arr)) return;
  if (!u.emptied && arr[u.index]) arr[u.index].qty = (arr[u.index].qty || 0) + 1;
  else if (u.stack) {
    // Only into the slot it left, and only while that slot is still empty.
    // Restoring blind overwrote whatever had been put there since — the item
    // was not moved anywhere, it was destroyed.
    if (arr[u.index]) {
      if (typeof flashSaveError === 'function') {
        flashSaveError('Slot ' + (u.index + 1) + ' is not empty any more');
      }
      return;
    }
    arr[u.index] = u.item;
  } else arr.splice(u.index, 0, u.item);
  save(); blockSyncAll(u.blockId, { force: true });
}
// Move an item between containers, refusing when the destination is full.
// Which gear slot an item belongs in. The shell cannot know a Club is held
// rather than worn, so the pack decides; without an answer we fall back to the
// first slot with room, which is what used to put weapons on your head.
// Which item's detail panel is open — the item itself, not where it sits. A
// positional key survived a reindex: delete the row above the open one and the
// panel stayed open on what was now a different item, so the next field typed
// landed on something the player had not opened.
let _invDetailOpen = '';
let _invDetailItem = null;
function invDetailFind(id, rowKey) {
  const t = _inv(id); if (!t) return null;
  const bits = String(rowKey).split(':');
  const c = _container(t.block, bits[0]); if (!c) return null;
  const list = c.kind === 'slots' ? (t.ctx.data[bits[0]] || {})[bits[1]] : t.ctx.data[bits[0]];
  return (list && list[Number(bits[2])]) || null;
}
function invDetail(id, rowKey) {
  const item = invDetailFind(id, rowKey);
  const same = _invDetailOpen === rowKey && _invDetailItem === item;
  _invDetailOpen = same ? '' : rowKey;
  _invDetailItem = same ? null : item;
  blockRepaint(id);
  // The picker's preview and results can only be filled once its markup is in
  // the DOM, which is after the repaint above.
  if (_invDetailOpen && typeof iconPreview === 'function' &&
      document.getElementById('inv-icon-results')) {
    iconPreview('inv');
    iconSearch('inv');
  }
}

// What the panel shows for THIS item: the fields its kind needs, or all of them
// for an item that never said what it was. "Show every field" is the escape
// hatch, because an item can turn out to be more than it looked.
let _invAllFields = false;
function invDetailFields(b, item) {
  if (_invAllFields || !item || !item.kind) {
    const fn = sysDerive(b.itemFields);
    if (fn) { try { return fn() || []; } catch (e) { return []; } }
    return Array.isArray(b.itemFields) ? b.itemFields : [];
  }
  return invFieldsFor(b, item.kind);
}
function invToggleAllFields(blockId) { _invAllFields = !_invAllFields; blockRepaint(blockId); }

// ── the shared field editor ────────────────────────────────────────────────
// The vocabulary — text, number, lines, select, icon — belongs to the pack; the
// ADDRESSING belongs to the host, because an item is found by container and slot
// and a Skill by block and index. Everything else about the two was identical,
// which is exactly the sort of thing that gets copied once and then drifts: gear
// could be described in detail and a Spell could not, and the reason was that
// only one of them had ever been given this panel.
//
//   fields — the pack's declared list
//   item   — the thing being edited, read for current values
//   o.set(f) — a JS call expression, as text, that stores this field's value.
//              It is spliced into an inline handler, so it must end mid-call
//              with `this.value` already supplied by the caller.
//   o.icon — {host, onPick} for the shared picker, or nothing to skip icon
//            fields entirely (a host that has its own icon control).
function detailFieldsHTML(fields, item, o) {
  let h = '';
  (fields || []).forEach(function (f) {
    const val = item[f.key] === undefined || item[f.key] === null ? '' : item[f.key];
    // An icon field is the shared picker rather than a text box. Only one detail
    // panel is open at a time, so one instance is right.
    if (f.type === 'icon') {
      if (!o.icon || typeof iconInit !== 'function') return;
      iconInit(o.icon.host, {
        value: String(val), fallback: item.name || '',
        onPick: function (v) { o.icon.onPick(v, f); },
      });
      h += '<div class="inv-f inv-f-wide">' + iconField(o.icon.host, {
        label: f.label,
        placeholder: 'Search icons — ' + (item.name ? esc(item.name) + ', ' : '') + 'potion, sword…',
      }) + '</div>';
      return;
    }
    // Prose — a Spell's effect, a homebrew Skill's rules text — needs room and
    // line breaks. A one-line input for it is a field nobody fills in.
    if (f.type === 'lines') {
      h += '<label class="inv-f inv-f-wide"><span>' + esc(f.label) + '</span>' +
        '<textarea rows="' + (f.rows || 3) + '" placeholder="' + esc(f.hint || '') +
        '" oninput="' + o.set(f) + '">' + esc(String(val)) + '</textarea></label>';
      return;
    }
    h += '<label class="inv-f' + (f.wide ? ' inv-f-wide' : '') + '"><span>' + esc(f.label) + '</span>';
    if (f.options) {
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      h += '<select onchange="' + o.set(f) + '"><option value="">—</option>' +
           (opts || []).map(function (op) {
             const v = op.value === undefined ? op : op.value;
             const l = op.label === undefined ? v : op.label;
             return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') +
                    '>' + esc(l) + '</option>';
           }).join('') + '</select>';
    } else {
      h += '<input type="' + (f.type === 'number' ? 'number' : 'text') + '" value="' + esc(String(val)) +
           '" placeholder="' + esc(f.hint || '') + '" oninput="' + o.set(f) + '">';
    }
    h += '</label>';
  });
  return h;
}

function invDetailHTML(b, c, item, where, idx, fields) {
  const setCall = function (f) {
    return 'invSetField(' + jsArg(b.id) + ',' + jsArg(c.id) + ',' + jsArg(where) +
           ',' + idx + ',' + jsArg(f.key) + ',this.value)';
  };
  let h = '<div class="inv-detail">';
  h += detailFieldsHTML(fields, item, {
    set: setCall,
    icon: { host: 'inv', onPick: function (v, f) { invSetField(b.id, c.id, where, idx, f.key, v); } },
  });
  // Anything the pack can DO with this item, such as reading a tome.
  const actFn = sysDerive(b.itemActions);
  let acts = [];
  if (actFn) { try { acts = actFn(item, (typeof S !== 'undefined' && S) ? S.char : null) || []; } catch (e) { acts = []; } }
  acts.forEach(function (a) {
    h += '<button class="btn btn-primary btn-xs" onclick="invAct(' + jsArg(b.id) + ',' + jsArg(c.id) +
         ',' + jsArg(where) + ',' + idx + ',' + jsArg(a.id) + ')">' + esc(a.label) + '</button>';
  });
  // Remember this one. An item you have described — what it works as, what it
  // resists, what it casts — is worth keeping, and the next one is then one tap
  // away in the catalogue instead of a retype. Explicit, because a bag is full
  // of one-offs and a catalogue that fills itself is a junk drawer.
  if (invKinds(b).length) {
    h += '<button class="btn btn-secondary btn-xs" title="' +
      (_invAllFields ? 'Show only what this kind needs' : 'Show every field there is') + '"' +
      ' onclick="invToggleAllFields(' + jsArg(b.id) + ')">' +
      (_invAllFields ? 'Fewer fields' : 'All fields') + '</button>';
  }
  if (b.catalog && typeof catalogSaveItem === 'function') {
    h += '<button class="btn btn-secondary btn-xs" title="Keep this in the catalogue"' +
      ' onclick="catalogSaveItem(' + jsArg(b.id) + ',' + jsArg(c.id) + ',' + jsArg(where) + ',' + idx +
      ')">☆ To catalogue</button>';
  }
  return h + '</div>';
}

// What a field's declared type says this string IS. Coercing by what the value
// LOOKS like read a Note of "007" as the number 7, turned a typed space into 0,
// and let a DR of "1e400" become Infinity, which JSON then saved as null.
function fieldNamed(spec, key) {
  const fn = sysDerive(spec);
  let fields = [];
  if (fn) { try { fields = fn() || []; } catch (e) { fields = []; } }
  else if (Array.isArray(spec)) fields = spec;
  return fields.filter(function (f) { return f && f.key === key; })[0] || null;
}
function fieldValue(f, value) {
  if (!f || f.type !== 'number') return value;
  const n = Number(value);
  if (!isFinite(n)) return 0;
  return (f.min !== undefined && n < f.min) ? f.min : n;
}

// Store a field WITHOUT repainting: this runs on every keystroke in a text box.
function invSetField(id, cid, where, i, key, value) {
  const t = _inv(id); if (!t) return;
  const c = _container(t.block, cid); if (!c) return;
  const list = c.kind === 'slots' ? (t.ctx.data[cid] || {})[where] : t.ctx.data[cid];
  const item = list && list[i]; if (!item) return;
  if (value === '') delete item[key];
  else item[key] = fieldValue(fieldNamed(t.block.itemFields, key), value);
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
  if (!fn) return null;
  let res;
  try { res = fn(actionId, item, S.char); } catch (e) { res = { ok: false, message: e.message }; }
  // A stack keeps its slot numbers when something leaves it. Splicing shifted
  // every later slot up by one, so reading the tome in Slot 1 quietly moved the
  // Heal in Slot 4 to Slot 3 — on a keypad whose whole value is that Slot 4 is
  // always Slot 4.
  //
  // And it consumes ONE. Reading one book off a stack of three burned all three
  // — invSpend has always counted down, and this did not.
  if (res && res.remove) {
    const qty = item.qty || 1;
    if (qty > 1) item.qty = qty - 1;
    else invVacate(list, i, invIsStack(t.block, cid));
  }
  save(); blockSyncAll(id, { force: true });
  if (res && res.message && typeof flashSaveError === 'function' && res.ok === false) flashSaveError(res.message);
  // Returned so a caller with a place to say what happened can say it. The
  // flash above is the fallback for the surfaces that have nowhere.
  return res || null;
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
// `opts.force` redraws even the block holding the caret. The guard below exists
// for KEYSTROKES — an oninput handler that repaints its own field takes the box
// out from under the typist — and it was applied to discrete actions too, which
// was wrong in a way that made the Gear block look broken: the Add box lives
// INSIDE that block, so adding an item with Enter (or with any Gear button,
// which a browser focuses on click) stored the item and drew nothing. The
// player then adds it again. Worse, the stale rows keep stale indices, so the
// next ✕ deletes a different item than the one under the pointer.
function blockSyncAll(changedId, opts) {
  const force = !!(opts && opts.force);
  const blocks = (SYS && SYS.schema && SYS.schema.blocks) || [];
  blocks.forEach(function (b) {
    if (!force && blockHoldsFocus(b.id)) return;
    blockRepaint(b.id);
  });
  // The one being edited is redrawn last, and only if it is not being typed in.
  if (changedId && (force || !blockHoldsFocus(changedId))) blockRepaint(changedId);
}

function invSlotFor(block, container, item) {
  const fn = sysDerive(container.slotFor || block.slotFor);
  if (!fn || !item) return '';
  try { return fn(item, container) || ''; } catch (e) { return ''; }
}

function invMove(id, fromId, toId, slotId, i, wantSlot, wantIndex) {
  const t = _inv(id); if (!t) return;
  const from = _container(t.block, fromId), to = _container(t.block, toId);
  if (!from || !to) return;
  const src = from.kind === 'slots' ? (t.ctx.data[fromId] || {})[slotId] : t.ctx.data[fromId];
  const item = src && src[i];
  if (!item) return;
  // A container this save has never put anything in can simply be absent — a
  // character older than the container, or a pack that has just added one.
  // invRoom() reads it defensively and reports room, so the move gets all the
  // way here and then threw on the write. Create it in the shape its kind
  // implies instead.
  if (!t.ctx.data[toId]) t.ctx.data[toId] = to.kind === 'slots' ? {} : [];
  // A slots destination needs a target slot. Taking the first one with room put
  // a Club on your head, because Head is simply the first slot in the list.
  // Ask the caller, then the pack, then fall back.
  let destSlot = '';
  if (to.kind === 'slots') {
    const want = wantSlot || invSlotFor(t.block, to, item);
    const fits = x => invRoom(t.block, t.ctx.data, toId, x.id) > 0;
    const named = want ? (to.slots || []).find(x => x.id === want) : null;
    // A named destination is a decision — the pack's (a weapon goes in your
    // hands) or the player's (they dropped it there). A full one is a refusal,
    // not an invitation to find somewhere else: falling through to "the first
    // slot with room" is how drawing a Handgun with both hands full would put
    // it on the crawler's head.
    if (named && !fits(named)) {
      if (typeof flashSaveError === 'function') flashSaveError((named.name || named.id) + ' is full');
      return;
    }
    const s = named || (to.slots || []).find(fits);
    if (!s) { if (typeof flashSaveError === 'function') flashSaveError(voice('noFreeSlot','No free slot')); return; }
    destSlot = s.id;
  }
  // A stack holds one entry per name, counted up — the same rule invAdd follows.
  // Moving a second Healing Potion in took a second of the ten slots instead of
  // making the first read x2, so the two routes to the Hotlist disagreed.
  let mergeAt = -1;
  if (to.kind === 'stack') {
    const arr = t.ctx.data[toId] || [];
    const want = String(item.name || '').toLowerCase();
    mergeAt = arr.findIndex(function (x) { return x && String(x.name).toLowerCase() === want; });
    const max = to.stackMax || 999;
    if (mergeAt >= 0 && (arr[mergeAt].qty || 1) + (item.qty || 1) > max) mergeAt = -1;
  }
  if (to.kind !== 'slots' && mergeAt < 0 && invRoom(t.block, t.ctx.data, toId, '') === 0) {
    if (typeof flashSaveError === 'function') flashSaveError((to.label || to.id) + ' is full');
    return;
  }
  invVacate(src, i, from.kind === 'stack');
  if (to.kind === 'slots') (t.ctx.data[toId][destSlot] = t.ctx.data[toId][destSlot] || []).push(item);
  else if (to.kind === 'stack') {
    const arr = t.ctx.data[toId];
    if (mergeAt >= 0) arr[mergeAt].qty = (arr[mergeAt].qty || 1) + (item.qty || 1);
    else invPlace(arr, item, to.size || 10, wantIndex);
  } else t.ctx.data[toId].push(item);
  save(); blockSyncAll(id, { force: true });
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
