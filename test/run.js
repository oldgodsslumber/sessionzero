// Runs every suite and summarises. Exits non-zero if any suite fails.
//   npm test            all suites
//   node test/mp.js     one suite
const { execFile } = require('child_process');
const path = require('path');

const SUITES = [
  ['wiki',   'Wiki: parser, upsert, universe scoping, cross-links, intake'],
  ['saves',  'Save files: migration, index repair, quota, CRUD'],
  ['series', 'Universe series + first-run gate'],
  ['mp',     'Multiplayer: sync, GM secret isolation, collaboration'],
  ['dcc',    'Dungeon Crawler Carl: rules maths, blocks, system selection'],
  ['rules',  'Database rules: GM boundary invariants, doc/file agreement'],
  ['focus',  'Focus discipline: no oninput handler repaints its own input']
];

// The suites share nothing — each is its own node process with its own JSDOM
// and its own in-memory backend — so run them at once and wait. Serially this
// cost the sum of every suite; in parallel it costs the slowest one.
function runSuite(name) {
  return new Promise(resolve => {
    // Pipe stderr rather than inheriting it, so jsdom's chatter only surfaces
    // when a suite actually fails.
    execFile(process.execPath, [path.join(__dirname, name + '.js')],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => resolve({
        name,
        out: (stdout || '') + (stderr || ''),
        crashed: !!err,
      }));
  });
}

(async () => {
  const results = await Promise.all(SUITES.map(([name]) => runSuite(name)));
  let total = 0, failed = 0;
  results.forEach((r, i) => {
    const blurb = SUITES[i][1];
    const pass = (r.out.match(/^PASS (\d+)/m) || [])[1];
    total += Number(pass || 0);
    const bad = /^FAIL (\d+)/m.exec(r.out) || r.crashed;
    if (bad) failed++;
    console.log((bad ? 'FAIL' : ' ok ') + '  ' + r.name.padEnd(7) +
      (pass || '0').padStart(4) + ' checks   ' + blurb);
    if (bad) {
      r.out.split('\n').filter(l => /^\s+x /.test(l)).forEach(l => console.log('        ' + l.trim()));
      if (!/^FAIL/m.test(r.out)) console.log(r.out.split('\n').slice(-15).join('\n'));
    }
  });
  console.log('\n' + total + ' checks across ' + SUITES.length + ' suites' +
    (failed ? ' — ' + failed + ' SUITE(S) FAILED' : ' — all passing'));
  process.exit(failed ? 1 : 0);
})();

