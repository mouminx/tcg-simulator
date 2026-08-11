/**
 * Runs the REAL electron/main.cjs against an isolated userData directory and performs one scripted
 * action, so the orchestrator can inspect the resulting files between launches.
 *
 * It requires the real main process rather than reimplementing it — the point is to test the shipped
 * write path (atomic replace, .bak rotation, the sync flush channel), and a reimplementation would
 * only test itself. `userData` is redirected first, which works because main.cjs resolves the save
 * path lazily through `app.getPath` on each call rather than capturing it at module load.
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

/** Resolved from this file, not hardcoded to one machine — it lives in `tests/`, so main.cjs is `../electron/`. */
const MAIN_CJS = path.resolve(__dirname, '..', 'electron', 'main.cjs');

const PHASE = process.env.PHASE;
const TEST_DIR = process.env.TEST_USERDATA;
app.setPath('userData', TEST_DIR);

require(MAIN_CJS);

const consoleErrors = [];
const out = {};

const OPEN_SLOT_1 = `(() => {
  const rows = [...document.querySelectorAll('.slots__item')];
  if (!rows.length) return 'no-picker';
  const play = rows[0].querySelector('.slots__btn--primary');
  if (play && /play/i.test(play.textContent)) { play.click(); return 'played'; }
  const nu = rows[0].querySelector('.slots__new');
  if (nu) { nu.click(); return 'creating'; }
  return 'unknown';
})()`;
const PICK_SSF = `(() => {
  const rows = [...document.querySelectorAll('.slots__item')];
  const btn = [...rows[0].querySelectorAll('.slots__btn')].find(b => /^SSF$/i.test(b.textContent.trim()));
  if (btn) { btn.click(); return 'ssf'; }
  return 'no-ssf-button';
})()`;

const DISMISS = `(() => {
  const b = [...document.querySelectorAll('.splash button')].find(x => /^(Enter|Resume)$/.test(x.textContent.trim()));
  if (b) { b.click(); return true; } return false;
})()`;
const BUY = `(() => {
  const b = document.querySelector('.shelf-pack__grab.shop-pack-card--iron');
  if (b) { b.click(); return true; } return false;
})()`;
/**
 * Note what this does NOT do: import `/src/game/storage.js` to read the adapter's name. This runs
 * against the packaged production bundle, where that path does not exist — only the dev server serves
 * source paths. Adapter identity is established behaviourally instead (save.json is written, the
 * localStorage import fires, the file wins afterwards), which is stronger evidence than a name string.
 *
 * The balance is read from the HEADER, not from localStorage. With the desktop adapter the renderer
 * stops writing localStorage entirely, so anything left there is a stale artefact — reading it was the
 * bug that made the first run of this suite report three phantom failures.
 */
const REPORT = `(() => ({
  booting: !!document.querySelector('.app-booting'),
  mounted: !!document.querySelector('.app'),
  hasSaveBridge: !!(window.desktop && window.desktop.save
    && typeof window.desktop.save.read === 'function' && typeof window.desktop.save.write === 'function'),
  headerBalance: (() => {
    const el = document.querySelector('.header .gold-amount');
    if (!el) return null;
    const n = Number(el.textContent.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  })(),
}))()`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  // main.cjs registered its whenReady handler first (it was required synchronously), so the window
  // already exists by the time this runs.
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) { console.log(`RESULT ${JSON.stringify({ error: 'no window' })}`); app.exit(1); return; }

  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2 && !/WebGL|THREE|GPU stall|Content-Security-Policy/i.test(message)) {
      consoleErrors.push(message.slice(0, 150));
    }
  });

  // Boot gate, then the slot picker. The desktop build has no login page (offline by construction), so
  // it lands directly on slots and a save has to be opened before the game exists.
  await sleep(4000);
  out.pickerShown = await win.webContents.executeJavaScript(
    `!!document.querySelector('.slots__list')`).catch(() => false);
  out.openedSlot = await win.webContents.executeJavaScript(OPEN_SLOT_1).catch(e => `err:${e.message}`);
  if (out.openedSlot === 'creating') {
    await sleep(400);
    out.pickedMode = await win.webContents.executeJavaScript(PICK_SSF).catch(e => `err:${e.message}`);
  }
  await sleep(4500);
  Object.assign(out, await win.webContents.executeJavaScript(REPORT).catch(e => ({ reportFailed: e.message })));


  if (PHASE === 'buy' || PHASE === 'buy-then-close') {
    await win.webContents.executeJavaScript(DISMISS);
    await sleep(900);
    out.clicked = await win.webContents.executeJavaScript(BUY);
    if (PHASE === 'buy') {
      await sleep(3000); // let the 2s debounce elapse
    } else {
      // Deliberately well inside the debounce: only the synchronous flush on teardown can have
      // persisted this. If the flush is broken, the file will not contain the purchase.
      await sleep(200);
      out.consoleErrors = consoleErrors;
      console.log(`RESULT ${JSON.stringify(out)}`);
      win.close();       // triggers pagehide -> flushSave -> sendSync, then window-all-closed -> quit
      return;
    }
  }

  if (PHASE === 'seed-ls') {
    // Write a marker save straight into the renderer's localStorage partition. It survives the quit,
    // so the next launch (with save.json deleted) must import it.
    await win.webContents.executeJavaScript(`(() => {
      localStorage.setItem('tcg-sim', JSON.stringify({
        version: 23, __marker: 'from-localstorage', balance: 4242.42,
        collection: [], packs: [{ id: 'ls-pack-1', packTypeId: 'iron' }, { id: 'ls-pack-2', packTypeId: 'iron' }], pocket: [],
      }));
      return true;
    })()`);
    await sleep(300);
  }

  out.consoleErrors = consoleErrors;
  console.log(`RESULT ${JSON.stringify(out)}`);
  app.exit(0);
});
