// Runs every suite and summarises. Exits non-zero if any suite fails.
//   npm test            all suites
//   node test/mp.js     one suite
const { execFileSync } = require('child_process');
const path = require('path');

const SUITES = [
  ['wiki',   'Wiki: parser, upsert, universe scoping, cross-links, intake'],
  ['saves',  'Save files: migration, index repair, quota, CRUD'],
  ['series', 'Universe series + first-run gate'],
  ['mp',     'Multiplayer: sync, GM secret isolation, collaboration'],
  ['dcc',    'Dungeon Crawler Carl: rules maths, blocks, system selection'],
  ['rules',  'Database rules: GM boundary invariants, doc/file agreement']
];

let total = 0, failed = 0;
for (const [name, blurb] of SUITES) {
  let out = '';
  try {
    // Pipe stderr rather than inheriting it, so jsdom's chatter only surfaces
    // when a suite actually fails.
    out = execFileSync(process.execPath, [path.join(__dirname, name + '.js')],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    failed++;
  }
  const pass = (out.match(/^PASS (\d+)/m) || [])[1];
  total += Number(pass || 0);
  const bad = /^FAIL (\d+)/m.exec(out);
  console.log((bad ? 'FAIL' : ' ok ') + '  ' + name.padEnd(7) + (pass || '0').padStart(4) + ' checks   ' + blurb);
  if (bad) {
    out.split('\n').filter(l => /^\s+x /.test(l)).forEach(l => console.log('        ' + l.trim()));
    if (!/^FAIL/m.test(out)) console.log(out.split('\n').slice(-15).join('\n'));
  }
}
console.log('\n' + total + ' checks across ' + SUITES.length + ' suites' + (failed ? ' — ' + failed + ' SUITE(S) FAILED' : ' — all passing'));
process.exit(failed ? 1 : 0);
