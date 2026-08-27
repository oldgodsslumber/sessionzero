// Loads a game's entry file for JSDOM with its external assets inlined.
//
// Each game lives in its own folder (dcc/index.html, daring-comics/index.html)
// so its Pages URL is a clean /dcc/. JSDOM is constructed from an HTML *string*
// with no `resources:'usable'`, so it never fetches the linked files. Rather
// than turn on network/file loading (slow, and it would make runs depend on
// fetch ordering), substitute each tag with its file contents in place. Order
// and semantics match the browser: same files, same sequence, all still classic
// scripts sharing one global.
//
// Paths in an entry file are relative to that file (../core/system.js), so they
// are resolved against its directory, not the repo root.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const SCRIPT_TAG = /<script src="([^"]+)"><\/script>/g;
const STYLE_TAG = /<link rel="stylesheet" href="([^"]+)">/g;

const DEFAULT_ENTRY = 'daring-comics/index.html';

function loadAppHTML(entryFile) {
  const entry = entryFile || DEFAULT_ENTRY;
  const entryDir = path.dirname(path.join(ROOT, entry));
  const html = fs.readFileSync(path.join(ROOT, entry), 'utf8');

  const read = (rel, what) => {
    const file = path.resolve(entryDir, rel);
    if (!fs.existsSync(file)) {
      throw new Error(entry + ' references a missing ' + what + ': ' + rel +
                      ' (resolved to ' + file + ')');
    }
    return fs.readFileSync(file, 'utf8');
  };

  return html
    .replace(STYLE_TAG, (m, href) => '<style>' + read(href, 'stylesheet') + '</style>')
    .replace(SCRIPT_TAG, (m, src) => {
      const js = read(src, 'script');
      // A literal </script> inside the source would close the tag early. None of
      // the app files contain one (template literals escape it as <\/script>),
      // so guard rather than silently produce a broken document.
      if (js.includes('</scr' + 'ipt>')) {
        throw new Error('cannot inline ' + src + ': contains a literal </script>');
      }
      return '<script>' + js + '</script>';
    });
}

// Wait until the app is actually usable, rather than sleeping a fixed 500 ms.
// The boot IIFE runs synchronously during JSDOM construction, so in practice
// this returns on the first poll; the timeout only matters if that ever stops
// being true, in which case a suite should fail loudly rather than silently
// race.
function waitReady(win, ready, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 500);
  const test = ready || (w => typeof w.showTab === 'function' && !!w.document.getElementById('nav'));
  return new Promise((resolve, reject) => {
    (function poll() {
      let ok = false;
      try { ok = !!test(win); } catch (e) { ok = false; }
      if (ok) return resolve(win);
      if (Date.now() > deadline) {
        return reject(new Error('app never became ready within ' + (timeoutMs || 500) + 'ms'));
      }
      setTimeout(poll, 5);
    })();
  });
}

module.exports = { loadAppHTML, DEFAULT_ENTRY, waitReady };
