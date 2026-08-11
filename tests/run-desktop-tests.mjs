/**
 * Desktop storage tests, across several real Electron launches with the files inspected in between.
 *
 * Multiple launches are necessary: the legacy-file migration, the localStorage import and the corruption
 * recovery are all "what happens on the NEXT start", which one process cannot observe.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Derived from this file's location, not hardcoded to one machine.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
/** Scratch space for the packaged build's userData and any temp artefacts. */
const SCRATCH = path.join(ROOT, 'tests', '.tmp');
fs.mkdirSync(SCRATCH, { recursive: true });
const TEST_DIR = path.join(SCRATCH, 'userdata-test');
/**
 * The harness is SOURCE, so it lives in `tests/` and is committed — not in `.tmp/`, which is gitignored and
 * wiped. Pointing at the temp dir is why the desktop suite died with "Unable to find Electron app at
 * tests/.tmp/desktop-harness.cjs" the first time it ran from the repo: the file simply was not there.
 */
const HARNESS = path.join(HERE, 'desktop-harness.cjs');

// This suite covers the LOCAL/SSF save path only, so it builds in `ssf` mode. Two reasons: it isolates
// what is under test (files on disk, not accounts), and `desktop` mode is now online-capable — building
// that here would point the harness at whatever project .env.local names and create real accounts in it.
execFileSync('npm', ['run', 'build:ssf'], { cwd: ROOT, stdio: 'ignore' });

const slotFile = n => path.join(TEST_DIR, `save-${n}.json`);
const bakFile = n => `${slotFile(n)}.bak`;
const tmpFile = n => `${slotFile(n)}.tmp`;
const LEGACY = path.join(TEST_DIR, 'save.json');

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

function run(phase) {
  const env = { ...process.env, PHASE: phase, TEST_USERDATA: TEST_DIR };
  delete env.ELECTRON_RUN_AS_NODE; // it makes the electron binary run as plain node
  let stdout = '';
  try {
    stdout = execFileSync(path.join(ROOT, 'node_modules/.bin/electron'), [HARNESS], {
      env, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    stdout = (err.stdout || '') + (err.stderr || '');
  }
  const line = stdout.split('\n').find(l => l.startsWith('RESULT '));
  return line ? JSON.parse(line.slice(7)) : { harnessFailed: true, raw: stdout.slice(-400) };
}
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const packs = f => (readJson(f)?.packs ?? []).length;

fs.rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });

// ── Phase 1: fresh launch → slot picker → create an SSF save in slot 1 ──
console.log('\n--- phase 1: fresh launch, create slot 1 ---');
let r = run('boot');
check('the desktop shell shows the slot picker, not a login page', r.pickerShown === true,
  `pickerShown=${r.pickerShown}`);
check('the save bridge is exposed by preload', r.hasSaveBridge === true, `hasSaveBridge=${r.hasSaveBridge}`);
check('creating an SSF save mounted the game', r.mounted === true && r.booting === false,
  `opened=${r.openedSlot} picked=${r.pickedMode} mounted=${r.mounted}`);
check('a new SSF save starts at 25', r.headerBalance === 25, `balance=${r.headerBalance}`);
check('save-1.json was created', fs.existsSync(slotFile(1)));
check('it is valid JSON at version 25', readJson(slotFile(1))?.version === 25,
  `version=${readJson(slotFile(1))?.version}`);
check('no other slot files exist yet',
  !fs.existsSync(slotFile(2)) && !fs.existsSync(slotFile(3)));
check('no leftover .tmp file', !fs.existsSync(tmpFile(1)));
check('no console errors on first launch', (r.consoleErrors ?? []).length === 0,
  (r.consoleErrors ?? []).join(' | '));

// ── Phase 2: a purchase persists, and the backup rotates in ──
console.log('\n--- phase 2: write + .bak rotation ---');
const before2 = packs(slotFile(1));
r = run('buy');
check('the pack button was clickable', r.clicked === true, `opened=${r.openedSlot}`);
check('the purchase reached save-1.json', packs(slotFile(1)) === before2 + 1,
  `packs ${before2} -> ${packs(slotFile(1))}`);
check('save-1.json.bak now exists', fs.existsSync(bakFile(1)));
check('the backup holds the PREVIOUS save, not the current one',
  packs(bakFile(1)) === before2, `bak=${packs(bakFile(1))} live=${packs(slotFile(1))}`);
check('no leftover .tmp after rotation', !fs.existsSync(tmpFile(1)));

// ── Phase 3: the synchronous flush on window close ──
console.log('\n--- phase 3: sync flush on close ---');
const before3 = packs(slotFile(1));
r = run('buy-then-close');
check('a purchase 200ms before close still reached disk', packs(slotFile(1)) === before3 + 1,
  `packs ${before3} -> ${packs(slotFile(1))} (debounce is 2000ms, so only the sync flush explains this)`);

// ── Phase 4: corruption recovery from .bak ──
console.log('\n--- phase 4: corrupt save-1.json ---');
const good = readJson(slotFile(1));
fs.writeFileSync(bakFile(1), JSON.stringify({ ...good, balance: 909.09 }));
fs.writeFileSync(slotFile(1), '{ truncated mid-write');
r = run('boot');
check('a corrupt slot file falls back to its backup', r.headerBalance === 909.09,
  `header=${r.headerBalance}, expected 909.09`);
check('the game still mounted after recovery', r.mounted === true);
check('save-1.json is valid again', readJson(slotFile(1)) !== null);

// ── Phase 5: a pre-slots save.json migrates into slot 1 ──
console.log('\n--- phase 5: legacy save.json -> slot 1 ---');
fs.rmSync(slotFile(1), { force: true });
fs.rmSync(bakFile(1), { force: true });
fs.writeFileSync(LEGACY, JSON.stringify({
  version: 23, balance: 777.77, collection: [], packs: [], pocket: [],
}));
check('only a legacy save.json exists before launch',
  fs.existsSync(LEGACY) && !fs.existsSync(slotFile(1)));
r = run('boot');
check('the legacy save was adopted as slot 1', r.headerBalance === 777.77,
  `header=${r.headerBalance}, expected 777.77`);
check('save.json was renamed, not copied', !fs.existsSync(LEGACY));
check('save-1.json now exists', fs.existsSync(slotFile(1)));

// The guard: a legacy file must never clobber a real slot 1.
fs.writeFileSync(LEGACY, JSON.stringify({ version: 23, balance: 1.11, collection: [], packs: [], pocket: [] }));
const keepBalance = readJson(slotFile(1)).balance;
r = run('boot');
check('a legacy file does NOT overwrite an existing slot 1',
  readJson(slotFile(1)).balance === keepBalance && fs.existsSync(LEGACY),
  `slot1 balance=${readJson(slotFile(1)).balance} (was ${keepBalance}), legacy still present=${fs.existsSync(LEGACY)}`);
fs.rmSync(LEGACY, { force: true });

// ── Phase 6: one-time import of a legacy localStorage save ──
console.log('\n--- phase 6: localStorage import ---');
run('seed-ls');                        // writes balance 4242.42 into the localStorage partition
fs.rmSync(slotFile(1), { force: true });
fs.rmSync(bakFile(1), { force: true });
check('no slot 1 file before the import launch', !fs.existsSync(slotFile(1)));
r = run('boot');
check('the legacy localStorage save was adopted into slot 1', r.headerBalance === 4242.42,
  `header=${r.headerBalance}, expected 4242.42`);
check('it was written to the file', fs.existsSync(slotFile(1)));
check('the file holds the imported balance', readJson(slotFile(1))?.balance === 4242.42,
  `file balance=${readJson(slotFile(1))?.balance}`);

// ── Phase 7: the file is authoritative from then on ──
console.log('\n--- phase 7: file wins over the stale localStorage copy ---');
fs.writeFileSync(slotFile(1), JSON.stringify({ ...readJson(slotFile(1)), balance: 111.11 }));
fs.rmSync(bakFile(1), { force: true });
r = run('boot');
check('the file takes precedence over the stale localStorage copy', r.headerBalance === 111.11,
  `header=${r.headerBalance}, expected 111.11 (localStorage still has 4242.42)`);

// ── Phase 8: slots are independent on disk ──
console.log('\n--- phase 8: slot independence ---');
fs.writeFileSync(slotFile(3), JSON.stringify({
  version: 23, balance: 555.55, collection: [], packs: [], pocket: [],
}));
r = run('boot');
check('opening slot 1 does not load slot 3', r.headerBalance === 111.11,
  `header=${r.headerBalance}, slot 3 holds 555.55`);
check('slot 3 is untouched by slot 1 activity', readJson(slotFile(3))?.balance === 555.55,
  `slot3=${readJson(slotFile(3))?.balance}`);

console.log(`\nsave dir: ${fs.readdirSync(TEST_DIR).filter(f => f.startsWith('save')).sort().join(', ')}`);

const failed = results.filter(x => !x.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
