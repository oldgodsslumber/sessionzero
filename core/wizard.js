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
      <div class="wiz-title">${esc(step.label || step.id)}</div>
      <div class="wiz-count">${i + 1} / ${steps.length}</div>
    </div>
    <div style="display:flex;gap:3px">`;
  steps.forEach((s, n) => {
    const done = n < i, here = n === i;
    // One style attribute, opened and closed in one place. The old ternary put
    // a closing quote inside the "done" branch and the rest of the declarations
    // outside it, so every completed segment parsed as a junk attribute and
    // rendered with no flex, no height and no colour.
    // A descent, not nine equal ticks: each completed step is a rung you have
    // already dropped past, the current one is lit, and the rest are ahead.
    const cls = here ? 'wiz-rung is-here' : done ? 'wiz-rung is-done' : 'wiz-rung';
    h += `<div class="${cls}" title="${esc(s.label || s.id)}"${done ? ` onclick="wizGoto(${n})"` : ''}></div>`;
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
    <div id="wiz-msg" class="wiz-block${ok === true ? '' : ' is-blocking'}">${ok === true ? '' : esc(String(ok))}</div>
    <button id="wiz-next" class="btn btn-primary btn-xs" ${ok === true ? '' : 'disabled style="opacity:.4"'} onclick="wizNext()">
      ${last ? 'Finish' : 'Continue →'}</button></div>`;
  body.innerHTML = inner;
  // A screen's own handlers deliberately do NOT repaint — that is what protects
  // the caret while you type. But the footer that says why Continue is disabled
  // lives in the same body, so it went stale: you typed your name, the message
  // still read "needs a name", and the button stayed disabled. Recheck the gate
  // on any input without redrawing anything the player is typing into.
  body.oninput = wizRefreshGate;
  body.onchange = wizRefreshGate;
}

// Update only the two things the gate owns: the message and the button. Never
// re-render — this runs on every keystroke.
function wizRefreshGate() {
  const char = wizChar(); if (!char) return;
  const ok = wizValidate(char, wizStepIndex(char));
  const msg = document.getElementById('wiz-msg');
  const btn = document.getElementById('wiz-next');
  if (msg) {
    msg.textContent = ok === true ? '' : String(ok);
    msg.classList.toggle('is-blocking', ok !== true);
  }
  if (btn) {
    btn.disabled = ok !== true;
    btn.style.opacity = ok === true ? '' : '.4';
  }
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
      style="margin:0 4px 4px 0" onclick="${onPick}(${r.roll !== undefined ? r.roll : jsArg(v)})">${esc(v)}</button>`;
  }).join('');
}
