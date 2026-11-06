// systems/marvel-multiverse/print-mock/build.js — the printed sheet, as a mockup.
//
//   node build.js [data.json] [out.html]    defaults: sample-hero.json, sheet.html
//
// Not part of the app. It exists so the layout can be judged on real paper
// before the pack is built. The CSS and the three page functions are what move
// into the pack; the shell's print centre will reach them through SYS.printSheet.
//
// Same paper as core/print.js: letter, half-inch margins, Arial for reading and
// Oswald for labels. Nothing depends on a background colour, because a printer
// not told to print backgrounds leaves them out.
const fs = require('fs');
const path = require('path');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sign = n => (n >= 0 ? '+' : '') + n;

const CSS = name => `
@page{size:letter portrait;margin:.5in .5in .62in;
  @bottom-left{content:"${name}";font:600 8pt Oswald,Arial,sans-serif;letter-spacing:.8px;color:#444}
  @bottom-right{content:"Page " counter(page);font:8pt Arial,sans-serif;color:#444}}
/* A continuation page has no heading of its own, so the footer says what it is. */
@page powers{@bottom-center{content:"Powers";font:600 8pt Oswald,Arial,sans-serif;letter-spacing:.8px;color:#444}}
@page traits{@bottom-center{content:"Traits & Tags";font:600 8pt Oswald,Arial,sans-serif;letter-spacing:.8px;color:#444}}
.pg-powers{page:powers}
.pg-traits{page:traits}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111;background:#fff;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.lb{font-family:Oswald,Arial,sans-serif;font-weight:500;font-size:7.5pt;letter-spacing:.9px;
  text-transform:uppercase;color:#444}
.pg{break-after:page}
.pg:last-child{break-after:auto}

/* ── page one: the sheet you play from ─────────────────────────────── */
.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:16pt;
  border-bottom:2.5pt solid #111;padding-bottom:6pt;margin-bottom:9pt}
.hd-n{font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:30pt;line-height:1;letter-spacing:.4px}
.hd-r{font-size:10.5pt;color:#333;margin-top:4pt}
.hd-rank{border:2pt solid #111;width:52pt;height:52pt;text-align:center;flex:none;padding-top:5pt}
.hd-rank b{display:block;font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:25pt;line-height:1}
.ids{display:flex;gap:18pt;margin-bottom:13pt}
.ids div{min-width:0}
.ids span{display:block;font-size:10.5pt;font-weight:700;margin-top:1pt}

.top{display:grid;grid-template-columns:1fr 2.62in;gap:14pt;margin-bottom:11pt}
table.ab{width:100%;border-collapse:collapse}
table.ab th{font-family:Oswald,Arial,sans-serif;font-weight:500;font-size:7.5pt;letter-spacing:.8px;
  text-transform:uppercase;color:#444;padding:0 0 4pt;text-align:center;border-bottom:1.25pt solid #111}
table.ab th:first-child{text-align:left}
table.ab td{padding:5pt 0;text-align:center;border-bottom:.5pt solid #aaa;font-size:10.5pt}
table.ab td:first-child{text-align:left;font-weight:700;font-size:11pt}
table.ab td.sc{font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:15pt;line-height:1}
.vit{display:grid;grid-template-rows:1fr 1fr auto;gap:7pt}
.vb{border:1.25pt solid #111;padding:6pt 8pt 8pt}
.vb-h{display:flex;justify-content:space-between;align-items:baseline}
.vb-t{font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:11pt;letter-spacing:.5px;text-transform:uppercase}
.vb-m{font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:15pt}
.vb-s{font-size:7.5pt;color:#444;margin-top:1pt;min-height:9pt}
.vb-w{height:17pt;margin-top:3pt;border-bottom:.75pt solid #777;display:flex;align-items:flex-end;padding-bottom:1pt}
.vb-w .lb{font-size:6.5pt}
.boxes{display:flex;gap:5pt;margin-top:5pt}
.boxes i{display:block;width:15pt;height:15pt;border:1pt solid #111}

.strip{display:flex;justify-content:space-between;border-top:1.25pt solid #111;border-bottom:1.25pt solid #111;
  padding:5pt 2pt;margin-bottom:12pt}
.strip div{text-align:center}
.strip b{display:block;font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:14pt;line-height:1.1}
.strip small{display:block;font-size:6.5pt;color:#444;margin-top:1pt}

.sec{font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:11pt;letter-spacing:.8px;
  text-transform:uppercase;margin-bottom:5pt}
table.gl{width:100%;border-collapse:collapse;margin-bottom:10pt}
table.gl tr{break-inside:avoid}
.also{display:grid;grid-template-columns:.8in 1fr;gap:6pt;font-size:9.5pt;line-height:1.45;padding:5pt 0;border-top:.5pt solid #bbb}
.also .lb{padding-top:2.5pt}
.also .c{font-size:8pt;color:#444}
table.gl.dense td{padding:3pt 5pt 3pt 0}
.en-n{min-width:0}
table.gl th{font-family:Oswald,Arial,sans-serif;font-weight:500;font-size:7pt;letter-spacing:.8px;
  text-transform:uppercase;color:#444;text-align:left;padding:0 5pt 3pt 0;border-bottom:1.25pt solid #111}
table.gl td{padding:5pt 5pt 5pt 0;border-bottom:.5pt solid #bbb;font-size:9pt;vertical-align:baseline}
table.gl td.nm{font-weight:700;font-size:9.5pt}
table.gl td.fc{white-space:nowrap}
table.gl tr.gp td{font-family:Oswald,Arial,sans-serif;font-weight:500;font-size:7.5pt;letter-spacing:.9px;
  text-transform:uppercase;color:#444;padding:7pt 0 2pt;border-bottom:.75pt solid #777}
table.gl tr.gp:first-child td{padding-top:0}

.low{display:grid;grid-template-columns:1fr 1fr;gap:18pt;margin-bottom:13pt}
.rule p{font-size:8.5pt;line-height:1.38;margin-bottom:3pt}
.cond{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3.5pt 6pt;font-size:8.5pt}
.cond label{display:flex;align-items:center;gap:4pt}
.cond i{display:block;width:9pt;height:9pt;border:.75pt solid #111;flex:none}
.adv{break-inside:avoid;margin-top:18pt}
.adv p{font-size:9.25pt;line-height:1.4;margin-bottom:9pt;color:#333}
.sch{display:grid;grid-template-columns:repeat(10,1fr);gap:5pt}
.sch div{border:1pt solid #111;height:44pt;text-align:center;font-size:8pt;color:#333;padding-top:32pt;line-height:1;white-space:nowrap}

/* ── the full text: every entry stands alone ───────────────────────── */
.pt{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5pt solid #111;
  padding-bottom:4pt;margin-bottom:12pt}
.pt-t{font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:19pt;line-height:1}
.note{border:1pt solid #111;padding:6pt 9pt;margin-bottom:14pt;font-size:9.5pt;line-height:1.35}
.cols{column-count:2;column-gap:.36in;column-rule:.5pt solid #bbb}
.grp{font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:12pt;letter-spacing:1px;text-transform:uppercase;
  border-bottom:1.5pt solid #111;padding-bottom:2pt;margin:0 0 11pt;break-after:avoid}
.grp:not(:first-child){margin-top:12pt}
.en{break-inside:avoid;padding-bottom:12pt;margin-bottom:12pt;border-bottom:.5pt solid #bbb}
.en:last-child,.en.last{border-bottom:0}
.en-h{display:flex;justify-content:space-between;align-items:baseline;gap:8pt}
.en-n{font-weight:700;font-size:11.5pt;line-height:1.2}
.en-c{font-family:Oswald,Arial,sans-serif;font-weight:600;font-size:9pt;letter-spacing:.5px;white-space:nowrap;
  text-transform:uppercase}
.en-m{font-size:8pt;color:#444;margin:2.5pt 0 6pt;line-height:1.3}
.en-f{font-size:9.25pt;line-height:1.38;margin-bottom:4.5pt}
.en-f b{font-family:Oswald,Arial,sans-serif;font-weight:500;font-size:7.5pt;letter-spacing:.8px;
  text-transform:uppercase;margin-right:3pt}
.en-t{font-size:9.75pt;line-height:1.46}
.en-t strong{font-weight:700}
.tagcols{margin-top:4pt}

@media screen{
  html{background:#8a8f8a}
  body{width:8.5in;margin:18px auto;padding:.5in;box-shadow:0 2px 14px rgba(0,0,0,.4)}
  .pg{margin-bottom:.5in}
}
`;

// The Fantastic clause is what a player's eye is hunting for, mid-fight.
const effectHTML = t => esc(t).replace(/On a Fantastic success/g, '<strong>On a Fantastic success</strong>');

// Six powers have a cost that is a sentence ("Same as the character's Telekinetic
// Protection power"). In the chip it ran across the column into the next entry, so
// those get a labelled line instead.
const isLongCost = cost => cost.length > 18;
const focusChip = cost => (cost === 'None' ? 'No Focus' : isLongCost(cost) ? '' : cost);
// The same cost, in the fewest words, for page one.
function shortCost(cost) {
  if (cost === 'None') return '';
  const same = /^Same as the character's (.*) power$/.exec(cost);
  if (same) return 'as ' + same[1];
  if (cost === 'Varies') return 'varies';
  return cost.replace(' Focus', '');
}

const GROUPS = [
  ['attack', 'Attacks'],
  ['action', 'Actions'],
  ['reaction', 'Reactions'],
  ['passive', 'Always on'],
];

function powersPage(d) {
  let h = '<section class="pg pg-powers"><div class="pt"><div class="pt-t">Powers</div><div class="lb">' +
    esc(d.hero.name) + ' · Full text</div></div>';
  if (d.hero.element) {
    h += '<div class="note"><span class="lb">Your element</span> &nbsp;<strong>' + esc(d.hero.element) +
      '.</strong> Wherever a power below says “the elemental type’s special effect”: ' +
      esc(d.hero.elementFx) + '</div>';
  }
  h += '<div class="cols">';
  GROUPS.forEach(([id, label]) => {
    const rows = d.powers.filter(p => p.cat === id);
    if (!rows.length) return;
    h += '<div class="grp">' + label + '</div>';
    rows.forEach((p, i) => {
      h += '<div class="en' + (i === rows.length - 1 ? ' last' : '') + '"><div class="en-h"><div class="en-n">' +
        esc(p.name) + '</div><div class="en-c">' + esc(focusChip(p.cost)) + '</div></div>' +
        '<div class="en-m">' + esc(p.action) + ' · ' + esc(p.duration) + ' · ' + esc(p.set) + '</div>';
      if (isLongCost(p.cost)) h += '<div class="en-f"><b>Focus</b>' + esc(p.cost) + '</div>';
      if (p.roll) h += '<div class="en-f"><b>Roll</b>' + esc(p.roll) + '</div>';
      if (p.trigger) h += '<div class="en-f"><b>Trigger</b>' + esc(p.trigger) + '</div>';
      if (p.range) h += '<div class="en-f"><b>Range</b>' + esc(p.range) + '</div>';
      h += '<div class="en-t">' + effectHTML(p.effect) + '</div></div>';
    });
  });
  return h + '</div></section>';
}

function traitsPage(d) {
  const entry = (r, last) => '<div class="en' + (last ? ' last' : '') + '"><div class="en-h"><div class="en-n">' +
    esc(r.name) + '</div><div class="lb">' + esc(r.from) + '</div></div>' +
    '<div class="en-t" style="margin-top:5pt">' + esc(r.effect) + '</div></div>';
  return '<section class="pg pg-traits"><div class="pt"><div class="pt-t">Traits &amp; Tags</div><div class="lb">' +
    esc(d.hero.name) + ' · Full text</div></div><div class="cols"><div class="grp">Traits</div>' +
    d.traits.map((r, i) => entry(r, i === d.traits.length - 1)).join('') +
    '<div class="grp">Tags</div>' +
    d.tags.map((r, i) => entry(r, i === d.tags.length - 1)).join('') + '</div>' +
    '<div class="adv"><div class="grp" style="margin-top:0">Getting Schooled</div>' +
    '<p>Check a box after a major adventure using your powers against a foe of equal or higher rank, or after training. You cannot check two training boxes in a row.</p>' +
    '<div class="sch">' + SCHOOLING.map(s => '<div>' + s + '</div>').join('') + '</div></div></section>';
}

const ABILITIES = [
  ['melee', 'Melee', true], ['agility', 'Agility', true], ['resilience', 'Resilience', false],
  ['vigilance', 'Vigilance', false], ['ego', 'Ego', true], ['logic', 'Logic', true],
];
// Conditions named anywhere in the source; the book settles this list.
const CONDITIONS = ['Ablaze', 'Bleeding', 'Blinded', 'Corroding', 'Deafened', 'Demoralized', 'Exhausted', 'Grabbed',
  'Paralyzed', 'Pinned', 'Poisoned', 'Prone', 'Shattered', 'Stunned', 'Surprised', 'Unconscious'];
const SCHOOLING = ['Ability', 'Power', 'Ability', 'Trait', 'Power', 'Ability', 'Power', 'Ability', 'Power', 'Rank up'];

function frontPage(d) {
  const x = d.hero, a = x.abilities;
  const mult = id => x.rank + ((x.tiers || {})[id] || 0);
  let h = '<section class="pg"><div class="hd"><div><div class="hd-n">' + esc(x.name) + '</div>' +
    '<div class="hd-r">' + esc(x.real) + '</div></div>' +
    '<div class="hd-rank"><div class="lb" style="font-size:6.5pt">Rank</div><b>' + esc(x.rank) + '</b></div></div>';
  h += '<div class="ids">' + [['Origin', x.origin], ['Occupation', x.occupation], ['Size', x.size],
    ['Team', x.team || '—'], ['Power picks', x.picks]].map(r =>
    '<div><div class="lb">' + r[0] + '</div><span>' + esc(r[1]) + '</span></div>').join('') + '</div>';

  h += '<div class="top"><table class="ab"><tr><th>Ability</th><th>Score</th><th>Defense</th><th>Non-combat</th><th>Damage</th></tr>';
  ABILITIES.forEach(([id, label, dmg]) => {
    h += '<tr><td>' + label + '</td><td class="sc">' + sign(a[id]) + '</td><td>' + (a[id] + 10) + '</td>' +
      '<td>' + sign(a[id] + ((x.tiers || {})[id] || 0)) + '</td>' +
      '<td>' + (dmg ? '×' + mult(id) + ' ' + sign(a[id]) : '—') + '</td></tr>';
  });
  h += '</table><div class="vit">';
  const vital = (t, m, s) => '<div class="vb"><div class="vb-h"><span class="vb-t">' + t + '</span><span class="vb-m">' +
    m + '</span></div><div class="vb-s">' + s + '</div><div class="vb-w"><span class="lb">Current</span></div></div>';
  h += vital('Health', x.health, 'Damage Reduction ' + x.healthDR);
  h += vital('Focus', x.focus, 'Damage Reduction ' + x.focusDR + ' · ' + esc(x.focusNote));
  h += '<div class="vb"><div class="vb-h"><span class="vb-t">Karma</span><span class="vb-m">' + x.rank + '</span></div><div class="boxes">' +
    '<i></i>'.repeat(x.rank) + '</div></div>';
  h += '</div></div>';

  h += '<div class="strip">' +
    '<div><b>' + sign(x.initiative) + '</b><span class="lb">Initiative</span><small>' + esc(x.initiativeNote) + '</small></div>' +
    x.speeds.map(s => '<div><b>' + esc(s[1]) + '</b><span class="lb">' + esc(s[0]) + '</span></div>').join('') +
    '<div><b>' + esc(x.reach) + '</b><span class="lb">Reach</span></div></div>';

  // Only attacks get rows: they are the powers with numbers to read mid-fight.
  // Everything else is a named line with its cost, and the full text is one page
  // away. A table of every power outgrew the page and left the next one blank.
  h += '<div class="low"><div class="rule"><div class="sec">Rolling</div>' +
    '<p><strong>d616:</strong> two dice + the Marvel die + your ability. <strong>M counts as 6.</strong> You hit if the total meets the defense or TN.</p>' +
    '<p><strong>Fantastic:</strong> M on a hit. <strong>Ultimate:</strong> 6 M 6.</p>' +
    '<p><strong>Damage:</strong> the Marvel die × your multiplier + the ability. Their DR lowers your multiplier. Fantastic doubles it.</p>' +
    '</div>' +
    '<div><div class="sec">Conditions</div><div class="cond">' +
    CONDITIONS.map(c => '<label><i></i>' + c + '</label>').join('') + '</div></div></div>';

  const attacks = d.powers.filter(p => p.cat === 'attack');
  // A very big hero tightens the attack rows and drops the three name lists. They
  // are long by then and would spill alone onto a page of their own; the heading
  // already says the full text follows.
  const dense = attacks.length > 6 || d.powers.length > 24;
  if (attacks.length) {
    h += '<div class="sec">Attacks <span class="lb" style="margin-left:6pt">full text for every power on the next pages</span></div><table class="gl' + (dense ? ' dense' : '') + '"><thead><tr><th style="width:27%">Power</th><th style="width:10%">Focus</th>' +
      '<th style="width:22%">Roll</th><th>Damage on a hit</th></tr></thead><tbody>';
    attacks.forEach(p => {
      const ab = { A: 'agility', E: 'ego', L: 'logic', M: 'melee' }[p.dmg];
      const dm = ab ? 'Marvel die ×' + mult(ab) + ' ' + sign(a[ab]) + (p.dmgNote ? ', ' + p.dmgNote : '') : '';
      h += '<tr><td class="nm">' + esc(p.name) + '</td><td class="fc">' +
        esc(shortCost(p.cost) || '—') + '</td><td>' +
        esc(p.roll) + '</td><td>' + esc(dm) + '</td></tr>';
    });
    h += '</tbody></table>';
  }
  const named = (cat, costs) => d.powers.filter(p => p.cat === cat).map(p => {
    const c = shortCost(p.cost);
    const words = c === 'varies' ? 'Focus varies' : /^as /.test(c) ? 'Focus ' + c : c + ' Focus';
    return esc(p.name) + (costs && c ? ' <span class="c">(' + esc(words) + ')</span>' : '');
  }).join(' &nbsp;·&nbsp; ');
  if (!dense) {
    [['action', 'Actions', true], ['reaction', 'Reactions', true], ['passive', 'Always on', false]].forEach(([cat, label, costs]) => {
      const line = named(cat, costs);
      if (line) h += '<div class="also"><span class="lb">' + label + '</span><span>' + line + '</span></div>';
    });
  }
  return h + '</section>';
}

const dataFile = process.argv[2] || path.join(__dirname, 'sample-hero.json');
const outFile = process.argv[3] || path.join(__dirname, 'sheet.html');
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(data.hero.name) + ' — printed sheet mockup</title>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&display=swap">' +
  '<style>' + CSS(esc(data.hero.name)) + '</style></head><body>' +
  frontPage(data) + powersPage(data) + traitsPage(data) + '</body></html>';
fs.writeFileSync(outFile, html);
console.log('wrote', outFile, html.length, 'bytes');
