// Turn OCR lines into readable prose.
//
// OCR drops spaces ("Bullseye.He", "peoplebut"), reads em dashes as hyphens ("girlfriend-the"),
// and the book hyphenates at line ends. An English word list (.book/words.txt, exported by
// pyspellchecker) decides what is a word, and the book's own usage decides the rest, so an
// unusual name like Halfworld is left alone rather than mangled.
import fs from 'node:fs';

export function buildVocab(bookFile, wordsFile) {
  const book = new Map();
  (fs.readFileSync(bookFile, 'utf8').match(/[A-Za-z'’-]+/g) || []).forEach(w => {
    const k = w.toLowerCase();
    book.set(k, (book.get(k) || 0) + 1);
  });
  const dict = new Set(fs.readFileSync(wordsFile, 'utf8').split(/\r?\n/).filter(Boolean));
  return { book, dict };
}

const inBook = (v, w) => v.book.get(String(w).toLowerCase()) || 0;
const isWord = (v, w) => v.dict.has(String(w).toLowerCase().replace(/’/g, "'"));
// Known to the language, or used often enough in the book to be a word of this game's.
const known = (v, w) => isWord(v, w) || inBook(v, w) >= 3;

// "resurfac-" + "ing" is one word; "half-" + "human" keeps its hyphen; "Spider-" + "Man" too.
function joinLines(lines, v) {
  let out = '';
  lines.forEach(line => {
    const t = line.trim();
    if (!out) { out = t; return; }
    if (out.endsWith('-')) {
      const head = /([A-Za-z]+)-$/.exec(out);
      const tail = /^([A-Za-z]+)/.exec(t);
      let keep = false;
      if (head && tail) {
        const joined = head[1] + tail[1];
        keep = /^[A-Z]/.test(tail[1]) || (isWord(v, head[1]) && isWord(v, tail[1])
          && (!known(v, joined) || inBook(v, head[1] + '-' + tail[1]) > inBook(v, joined)));
      }
      out = keep ? out + t : out.slice(0, -1) + t;
    } else out += ' ' + t;
  });
  return out;
}

// A capitalised token may be a name, so only split it off a word that starts sentences.
const OPENERS = /^(If|In|On|At|The|He|She|It|As|And|But|Of|To|His|Her|They|When|While|After)$/;

function splitWord(word, v, keep, log) {
  const m = /^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/.exec(word);
  if (!m || m[2].length < 5 || keep.has(m[2]) || known(v, m[2])) return word;
  const w = m[2], capital = /^[A-Z]/.test(w);
  for (let i = 2; i < w.length - 1; i++) {
    const a = w.slice(0, i), b = w.slice(i);
    if (!isWord(v, a) || !isWord(v, b) || /[A-Z]/.test(b)) continue;
    if (capital && !OPENERS.test(a)) continue;
    log.push(`${w} -> ${a} ${b}`);
    return m[1] + a + ' ' + b + m[3];
  }
  return word;
}

// A hyphen before a word that cannot end a compound, or before a name, is an em dash.
const AFTER_DASH = /^(the|a|an|as|at|they|both|and|but|he|she|it|who|that|which|or|in|on|to|if|his|her|their|until|including|even|not|with|for|from|especially|like|sometimes|often|though|although|because|while|when|where)$/;
const PREFIX = /^(non|anti|pre|post|ex|mid|pro|semi|neo|pan|over|under|half|all|self|super|once)$/i;

function dashes(text) {
  return text.replace(/\b([A-Za-z]+)-([A-Za-z]+)\b/g, (whole, a, b) => {
    if (AFTER_DASH.test(b)) return a + '—' + b;
    if (/^[a-z]/.test(a) && /^[A-Z]/.test(b) && !PREFIX.test(a)) return a + '—' + b;
    return whole;
  });
}

// OCR scatters the spaces round quote marks. They come in pairs, so count them.
function quotes(text) {
  const parts = text.split('"');
  if (parts.length % 2 === 0) return text;     // unbalanced: leave it for a person
  return parts.map((p, i) => {
    if (i % 2) return p.trim();                // inside the quotes
    let o = p;
    if (i > 0 && /^[A-Za-z]/.test(o)) o = ' ' + o;
    if (i < parts.length - 1) o = o.replace(/\s*$/, '') + (o.trim() ? ' ' : '');
    return o;
  }).join('"');
}

export function cleanParagraph(lines, v, prose, log) {
  let t = joinLines(lines, v)
    .replace(/([a-z)"’'])([.,;:!?])(?=[A-Za-z"])/g, '$1$2 ')   // "Bullseye.He", not "S.H.I.E.L.D."
    .replace(/(?<=[A-Z]\.)(?=[A-Z][a-z]|[a-z])/g, ' ')         // "S.H.I.E.L.D.Agent", "A.I.M.scientists"
    .replace(/\)(?=[A-Za-z])/g, ') ')                          // "(Invisible Woman)with"
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s+/g, ' ').trim();
  t = dashes(t);
  t = t.split(' ').map(w => splitWord(w, v, prose.keep, log)).join(' ');
  prose.fixes.forEach(([a, b]) => { t = t.split(a).join(b); });
  return quotes(t);
}

// Worth a person's eye: lower case, and neither a word nor one the book uses.
export function suspects(text, v) {
  return (text.match(/[A-Za-z'’]+/g) || []).filter(w => /^[a-z]/.test(w) && w.length > 2 && !known(v, w));
}
