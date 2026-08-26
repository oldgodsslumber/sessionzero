// Loads index.html for JSDOM with its external <script src> files inlined.
//
// The app is split across core/*.js and systems/<id>/*.js, but JSDOM is
// constructed from an HTML *string* with no `resources:'usable'`, so it never
// fetches those files. Rather than turn on network/file loading (slow, and it
// would make test runs depend on fetch ordering), we substitute each tag with
// its file contents in place. Order and semantics are identical to the browser:
// same files, same sequence, all still classic scripts sharing one global.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const TAG = /<script src="([^"]+)"><\/script>/g;

// entryFile defaults to the Daring Comics app; the DCC suite passes its own.
function loadAppHTML(entryFile) {
  const html = fs.readFileSync(path.join(ROOT, entryFile || 'daring-comics.html'), 'utf8');
  return html.replace(TAG, (m, src) => {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) throw new Error('index.html references a missing script: ' + src);
    // A literal </script> inside the source would close the tag early. None of
    // the app files contain one (template literals escape it as <\/script>),
    // so guard rather than silently produce a broken document.
    const js = fs.readFileSync(file, 'utf8');
    if (js.includes('</scr' + 'ipt>')) throw new Error('cannot inline ' + src + ': contains a literal </script>');
    return '<script>' + js + '</script>';
  });
}

module.exports = { loadAppHTML };
