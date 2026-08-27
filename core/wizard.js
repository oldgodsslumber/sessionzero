// core/wizard.js — the generic character-creation frame.
//
// The shell owns the frame: progress, Back/Continue, validation gating, resume.
// A pack owns the screens. Each entry in SYS.creation is:
//
//   { id, label,
//     render(ctx)   -> html for the screen body
//     validate(char) -> true, or a string saying what is still missing
//     enter(char)    -> optional, called once when the screen is first shown }
//
// ctx is { char, floor, step, wizard } — the same shape blocks get, so a screen
// can reuse block renderers.
//
// Repaint discipline, as in core/blocks.js: a screen repaints ITSELF via
// wizRepaint(), never the whole tab. Text inputs must only store their value and
// must not trigger a repaint, or the caret jumps — the bug that started all of
// this. Anything that changes what is on screen (a pick, a roll) repaints.

function wizSteps() { return (SYS && SYS.creation) || []; }
function wizChar() { return (typeof S !== 'undefined' && S) ? S.char : null; }

function wizState(char) {
  if (!char.creation) char.creation = { step: 0, complete: false };
  return char.creation;
}

function wizStepIndex(char) {
  const st = wizState(char);
  return Math.max(0, Math.min(wizSteps().length - 1, st.step || 0));
}

function wizCtx(char) {
  return {
    char,
    floor: (typeof S !== 'undefined' && S && S.floor) || 3,
    step: wizSteps()[wizStepIndex(char)],
    wizard: true,
  };
}

// Is this screen satisfied? Returns true or the reason it is not.
function wizValidate(char, i) {
  const step = wizSteps()[i];
  if (!step || typeof step.validate !== 'function') return true;
  try { return step.validate(char); } catch (e) { return e.message; }
}

function renderWizard(targetEl) {
  const el = typeof targetEl === 'string' ? document.getElementById(targetEl) : targetEl;
  const char = wizChar();
  if (!el || !char || !wizSteps().length) return;
  const steps = wizSteps();
  const i = wizStepIndex(char);
  const step = steps[i];
  if (typeof step.enter === 'function') { try { step.enter(char); } catch (e) {} }

  let h = `<div class="card" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <div class="pg-title" style="font-size:22px">${esc(step.label || step.id)}</div>
      <div style="font-size:11px;color:var(--muted)">Step ${i + 1} of ${steps.length}</div>
    </div>
    <div style="display:flex;gap:3px">`;
  steps.forEach((s, n) => {
    const done = n < i, here = n === i;
    h += `<div title="${esc(s.label || s.id)}" ${n < i ? `onclick="wizGoto(${n})" style="cursor:pointer;"` : 'style="'}
      flex:1;height:5px;border-radius:3px;background:${here ? 'var(--accent)' : done ? 'var(--accent2)' : 'var(--surface3)'}"></div>`;
  });
  h += `</div></div><div id="wiz-body"></div>`;
  el.innerHTML = h;
  wizRepaint();
}

// Repaint only the current screen's body plus the footer.
function wizRepaint() {
  const char = wizChar();
  const body = document.getElementById('wiz-body');
  if (!char || !body) return;
  const steps = wizSteps();
  const i = wizStepIndex(char);
  const step = steps[i];
  let inner = '';
  try { inner = step.render(wizCtx(char)) || ''; }
  catch (e) { inner = `<div class="card"><div style="color:var(--red)">This screen failed to render: ${esc(e.message)}</div></div>`; }

  const ok = wizValidate(char, i);
  const last = i === steps.length - 1;
  inner += `<div class="card-sm" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px">
    <button class="btn btn-secondary btn-xs" ${i === 0 ? 'disabled style="opacity:.4"' : ''} onclick="wizBack()">← Back</button>
    <div style="flex:1;font-size:11px;color:${ok === true ? 'var(--muted)' : 'var(--accent)'};text-align:center">
      ${ok === true ? '' : esc(String(ok))}</div>
    <button class="btn btn-primary btn-xs" ${ok === true ? '' : 'disabled style="opacity:.4"'} onclick="wizNext()">
      ${last ? 'Finish' : 'Continue →'}</button></div>`;
  body.innerHTML = inner;
}

function wizGoto(n) {
  const char = wizChar(); if (!char) return;
  const steps = wizSteps();
  wizState(char).step = Math.max(0, Math.min(steps.length - 1, n));
  save();
  renderWizard('hero-creation');
}
function wizBack() { const c = wizChar(); if (c) wizGoto(wizStepIndex(c) - 1); }
function wizNext() {
  const char = wizChar(); if (!char) return;
  const i = wizStepIndex(char);
  if (wizValidate(char, i) !== true) return;
  const steps = wizSteps();
  if (i >= steps.length - 1) {
    wizState(char).complete = true;
    if (typeof SYS.finishCreation === 'function') SYS.finishCreation(char);
    save();
    renderHero();
    return;
  }
  wizGoto(i + 1);
}

// Re-enter creation on a finished character (the sheet offers this).
function wizReopen() {
  const char = wizChar(); if (!char) return;
  wizState(char).complete = false;
  save();
  renderHero();
}

// ─── helpers packs use when writing screens ─────────────────────────────────
function wizRoll(sides) { return 1 + Math.floor(Math.random() * (sides || 6)); }

// A row of "roll or choose" options. `sel` is the currently chosen value.
function wizOptions(rows, sel, onPick, labelOf) {
  return rows.map(r => {
    const v = labelOf ? labelOf(r) : r;
    const on = String(sel) === String(r.roll !== undefined ? r.roll : v);
    return `<button class="btn btn-xs ${on ? 'btn-primary' : 'btn-secondary'}"
      style="margin:0 4px 4px 0" onclick="${onPick}(${r.roll !== undefined ? r.roll : JSON.stringify(v)})">${esc(v)}</button>`;
  }).join('');
}
