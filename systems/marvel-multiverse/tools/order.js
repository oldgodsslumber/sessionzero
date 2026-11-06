// Turn per-page OCR boxes into reading-order text with an XY cut: split a region at its
// widest empty gutter (columns first, then rows), and recurse.
// usage: node order.js <ocrdir> <outfile>
const fs = require('fs'), path = require('path');
const [,, dir, outFile] = process.argv;

const MIN_COL_GAP = 14, MIN_ROW_GAP = 16;

function widestGap(rows, lo, hi) {
  const spans = rows.map(r => [r[lo], r[hi]]).sort((a, b) => a[0] - b[0]);
  let best = null, end = spans[0][1];
  for (const [a, b] of spans) {
    if (a > end && (!best || a - end > best.size)) best = { at: (a + end) / 2, size: a - end };
    if (b > end) end = b;
  }
  return best;
}

function cut(rows) {
  if (rows.length < 2) return [rows];
  const col = widestGap(rows, 'x0', 'x1');
  const row = widestGap(rows, 'y0', 'y1');
  // A real column gutter has text on both sides over a shared vertical band. Prefer a large
  // row gap first when it is a clear section break, otherwise split columns.
  if (col && col.size >= MIN_COL_GAP && (!row || row.size < 40 || col.size > row.size)) {
    const a = rows.filter(r => (r.x0 + r.x1) / 2 < col.at), b = rows.filter(r => (r.x0 + r.x1) / 2 >= col.at);
    if (a.length && b.length) return [...cut(a), ...cut(b)];
  }
  if (row && row.size >= MIN_ROW_GAP) {
    const a = rows.filter(r => (r.y0 + r.y1) / 2 < row.at), b = rows.filter(r => (r.y0 + r.y1) / 2 >= row.at);
    if (a.length && b.length) return [...cut(a), ...cut(b)];
  }
  return [rows];
}

function tidy(s) {
  return s
    .replace(/([a-z\)])([.,;:!?])([A-Z])/g, '$1$2 $3')
    .replace(/([a-z])([,;:])([a-z])/g, '$1$2 $3')
    .replace(/\s+/g, ' ')
    .trim();
}

function blockText(rows) {
  const sorted = rows.slice().sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines = [];
  for (const r of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - r.y0) < 7) { last.parts.push(r); last.y = (last.y + r.y0) / 2; }
    else lines.push({ y: r.y0, parts: [r] });
  }
  return lines.map(l => tidy(l.parts.sort((a, b) => a.x0 - b.x0).map(p => p.t).join('  '))).join('\n');
}

const files = fs.readdirSync(dir).filter(f => /^p\d+\.json$/.test(f)).sort();
let out = '', low = 0, total = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  total += d.rows.length;
  low += d.rows.filter(r => r.s < 0.8).length;
  // PDF page n is book page n-1 (checked on Bullseye: PDF 151 prints as 150).
  out += `\n\n=== PDF ${d.page} / book ${d.page - 1} ===\n`;
  if (d.rows.length) out += cut(d.rows).map(blockText).join('\n\n');
}
fs.writeFileSync(outFile, out, 'utf8');
console.log(files.length, 'pages', total, 'lines', low, 'low-confidence lines', out.length, 'chars');
