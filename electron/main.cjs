/**
 * Electron main process — the desktop wrapper around the built Vite app.
 *
 * This is the SSF (solo self-found) shell: entirely offline, no backend, no marketplace. It loads
 * the same `dist/` the web build produces, so there is one game and two delivery targets rather than
 * two codebases.
 *
 * ── The app is served over a custom `app://` protocol, NOT file:// ──
 * This is the single most important decision in this file, and skipping it produces a blank window
 * that is hard to diagnose.
 *
 * Vite emits `<script type="module">`, and the bundle additionally does a dynamic `import()` for the
 * three.js backdrop chunk. Module scripts are subject to CORS, and Chromium treats every `file://`
 * URL as an opaque origin — so a module fetched from file:// is a cross-origin request that always
 * fails. `loadFile('dist/index.html')` therefore loads the HTML and then silently fails to run any
 * of the JavaScript.
 *
 * A custom scheme registered as `standard` + `secure` gives the page a real, stable origin, which
 * fixes three things at once:
 *   1. module scripts and dynamic imports load,
 *   2. `localStorage` gets a durable partition — the game's entire save lives there, and on file://
 *      the origin is opaque enough that persistence is not something to rely on,
 *   3. the page counts as a secure context, which `AudioContext` and WebGL are happier with.
 *
 * The alternative — `webSecurity: false` — also makes the modules load, and disables a pile of
 * protections to do it. Don't.
 */

const { app, BrowserWindow, Menu, ipcMain, protocol, net, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'app';
const DIST = path.join(__dirname, '..', 'dist');

/**
 * Must be called before `app.ready`, which is why it is at module scope rather than inside a
 * handler. `standard` makes the scheme URL-parse like http (so relative paths and origins work),
 * `secure` makes it a secure context, and `supportFetchAPI` lets `net.fetch` serve it.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

/**
 * Serves `dist/` over `app://`.
 *
 * `stream: true` above matters for audio: the music tracks are streamed through
 * `MediaElementAudioSourceNode`, and a protocol handler that cannot do range requests would force
 * the whole file to buffer before playing.
 */
function serveDist() {
  protocol.handle(APP_SCHEME, request => {
    const { pathname } = new URL(request.url);
    // Any path that is not an existing asset resolves to the app shell. There is no client-side
    // router today, so this only ever fires for '/', but it costs nothing and means adding routes
    // later does not require touching the main process.
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const target = path.join(DIST, relative);

    // Refuse anything that escapes dist/. The renderer is not trusted with filesystem reach just
    // because it shares a process tree with us.
    if (!target.startsWith(DIST)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

// ── The save file ─────────────────────────────────────────────────────────────

/**
 * The desktop save lives on disk instead of in `localStorage`, which is the whole point of the
 * storage adapter: a file can be backed up, copied between machines, and inspected when a player
 * reports something impossible. A localStorage partition can also be evicted by Chromium under disk
 * pressure, which for a game with no server is simply data loss.
 *
 * `userData` is the OS's per-user application-data directory — on macOS
 * `~/Library/Application Support/Cards of Arcana`. Electron creates it, and it is the one location
 * guaranteed writable in a signed, sandboxed, installed app.
 */
const SLOT_COUNT = 3;
const SAVE_FILE = slot => path.join(app.getPath('userData'), `save-${slot}.json`);
const BAK_FILE = slot => `${SAVE_FILE(slot)}.bak`;
const LEGACY_SAVE_FILE = () => path.join(app.getPath('userData'), 'save.json');

/** Rejects anything that is not one of the three slots, so a renderer cannot name a path. */
function validSlot(slot) {
  const n = Number(slot);
  return Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT ? n : null;
}

/**
 * Moves a pre-slots `save.json` into slot 1.
 *
 * Anyone who played the desktop build before slots existed has their whole game in that file. Leaving
 * it would show three empty slots and read as a wiped save; deleting it would be worse. Renaming is
 * atomic and keeps the `.bak` alongside it.
 *
 * Guarded on slot 1 not already existing, so this cannot clobber a real save if the legacy file is ever
 * recreated by an older build running against the same directory.
 */
function migrateLegacySaveFile() {
  const legacy = LEGACY_SAVE_FILE();
  const target = SAVE_FILE(1);
  try {
    if (!fs.existsSync(legacy) || fs.existsSync(target)) return;
    fs.renameSync(legacy, target);
    if (fs.existsSync(`${legacy}.bak`)) fs.renameSync(`${legacy}.bak`, BAK_FILE(1));
    console.log('[save] migrated legacy save.json into slot 1');
  } catch (err) {
    console.error('[save] could not migrate legacy save.json:', err.message);
  }
}

/**
 * Writes the save so that a crash cannot leave a half-written file.
 *
 * `fs.writeFileSync` straight onto `save.json` is not safe: the whole save is one JSON document, so a
 * process killed partway through truncates it into something that will not parse — and it is the only
 * copy. The sequence here means there is always at least one complete file on disk:
 *
 *   1. write the new save to `save.json.tmp` and fsync it,
 *   2. move the current `save.json` aside to `save.json.bak`,
 *   3. rename the temp file into place.
 *
 * `rename` within one directory is atomic on every platform we target, so step 3 either happened or
 * it did not. The narrow window is between 2 and 3, where only `.bak` exists — which `readSave`
 * recovers from, so it is survivable rather than fatal.
 *
 * The fsync matters and is easy to leave out: `writeFileSync` returning only means the data reached
 * the OS page cache. On a power loss the rename can be durable while the file contents are not, which
 * produces a `save.json` full of zero bytes — the classic way this pattern still loses data.
 */
function writeSave(slot, serialized) {
  const n = validSlot(slot);
  if (n === null) {
    console.error('[save] refused a write for an invalid slot:', slot);
    return false;
  }
  const file = SAVE_FILE(n);
  const tmp = `${file}.tmp`;
  try {
    const handle = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(handle, serialized);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    if (fs.existsSync(file)) fs.renameSync(file, BAK_FILE(n));
    fs.renameSync(tmp, file);
    return true;
  } catch (err) {
    console.error('[save] write failed:', err.message);
    // Leave no half-written temp file behind to be mistaken for a real save later.
    try { fs.unlinkSync(tmp); } catch { /* already gone */ }
    return false;
  }
}

/**
 * Reads the save, falling back to the backup if the primary is missing or unparseable.
 *
 * The `JSON.parse` here is a validity probe, not a parse whose result is used — the renderer gets the
 * raw string, because the save's shape is the game's business and not the shell's (see
 * `src/game/storage.js`). Probing is what lets a corrupt file fall through to `.bak` instead of being
 * handed to the renderer, where it would throw during boot and read as a wiped save.
 */
function readSave(slot) {
  const n = validSlot(slot);
  if (n === null) return null;
  for (const file of [SAVE_FILE(n), BAK_FILE(n)]) {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // not present
    }
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      console.error(`[save] ${path.basename(file)} is not valid JSON; trying the backup`);
    }
  }
  return null;
}

/**
 * Two channels rather than one, because the flush-on-exit path has a different requirement.
 *
 * A routine autosave is `invoke`/fire-and-forget: it must not block the renderer, which is running the
 * game loop. The flush the renderer performs on `pagehide` cannot be async — the renderer is about to
 * be destroyed, and an async message posted at that point may never be delivered. `sendSync` blocks
 * the renderer until the write has actually happened, which is exactly the guarantee needed there and
 * exactly the wrong default everywhere else.
 */
function registerSaveIpc() {
  migrateLegacySaveFile();
  ipcMain.handle('save:read', (_event, slot) => readSave(slot));
  ipcMain.handle('save:write', (_event, slot, serialized) => writeSave(slot, serialized));
  ipcMain.on('save:write-sync', (event, slot, serialized) => {
    event.returnValue = writeSave(slot, serialized);
  });
  /**
   * Deleting a save frees a slot, which is a normal player action once there are only three.
   * Both files go: leaving the `.bak` would let the next read resurrect the save the player just
   * deleted, which is the opposite of what they asked for.
   */
  ipcMain.handle('save:delete', (_event, slot) => {
    const n = validSlot(slot);
    if (n === null) return false;
    for (const file of [SAVE_FILE(n), BAK_FILE(n)]) {
      try { fs.rmSync(file, { force: true }); } catch { /* nothing there */ }
    }
    return true;
  });
}

/**
 * Content-Security-Policy, applied as a response header rather than a `<meta>` tag in index.html.
 *
 * Electron warns loudly when a renderer has no CSP, and it is right to: without one, any future
 * injection has the whole `app://` origin to play with. Setting it here rather than in the shared
 * index.html keeps the web build's headers Vercel's business and this build's ours.
 *
 * Each directive is here for a reason the game actually needs:
 *   style-src 'unsafe-inline'  the UI drives geometry through inline style attributes — the hand
 *                              fan's per-card `--hand-angle`, the forge's `--forge-progress`, the
 *                              gold burst's deltas. These are style ATTRIBUTES, which CSP blocks
 *                              without this, and there are hundreds of them.
 *   img-src data:              Vite inlines assets under 4 KB as data URIs — the rarity gems and
 *                              tier stars land that way.
 *   media-src                  the streamed music and ambience beds.
 *   No 'unsafe-eval'           three.js and React production builds do not need it, and it is the
 *                              directive most worth withholding.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

function applyCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] },
    });
  });
}

/**
 * A deliberately small menu, replacing Electron's default.
 *
 * The default menu ships Edit, Speech, and zoom controls — none of which a card game wants, and the
 * zoom items are actively harmful (see `lockZoom`). But the menu cannot simply be removed: on macOS
 * the app menu is where Cmd+Q lives, and this window opens fullscreen with no chrome, so a player
 * with no menu and no titlebar has no way out. Quit and Toggle Full Screen are the two things that
 * have to exist. Reload is kept as an escape hatch if a render ever wedges.
 */
function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'Game',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'reload' },
        // DevTools only in a development run. A shipped game has no business offering an inspector,
        // but testing the shell without one means debugging blind — and the renderer is the whole app.
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ]));
}

/**
 * Swallows the browser zoom shortcuts.
 *
 * The whole layout is a fixed `100vh` flex column with `overflow: hidden` on html, body and #root —
 * nothing scrolls, by design. Zooming does not scale that gracefully, it just pushes content past
 * the viewport edge where it cannot be reached, and there is no scrollbar to recover with. Leaving
 * the accelerators out of the menu is not enough: Chromium binds them internally.
 */
function lockZoom(contents) {
  contents.setVisualZoomLevelLimits(1, 1); // pinch-to-zoom on a trackpad
  contents.on('before-input-event', (event, input) => {
    const mod = process.platform === 'darwin' ? input.meta : input.control;
    if (mod && ['+', '-', '=', '0', 'Plus', 'Minus'].includes(input.key)) event.preventDefault();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    /**
     * Fullscreen only in the packaged app. `npm run desktop` opens a large window instead, so the
     * shell can sit beside a terminal while being tested — a fullscreen window with no chrome is
     * genuinely awkward to develop against. Ctrl/Cmd+Cmd+F toggles either way, so the fullscreen
     * path is still one keystroke from any dev run.
     */
    fullscreen: app.isPackaged,
    ...(app.isPackaged ? {} : { width: 1600, height: 1000 }),
    backgroundColor: '#0d0a07', // matches .app's darkest gradient stop, so there is no white flash
    title: 'Cards of Arcana',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Shown only once the first paint is ready. The game has a title screen that fades in; showing the
  // window before it exists means a frame of empty background.
  win.once('ready-to-show', () => win.show());

  // External links open in the real browser. Nothing in the game does this yet, but a marketplace
  // or a credits link would, and a navigation inside the shell would trap the player with no chrome
  // to get back.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  lockZoom(win.webContents);

  /**
   * The renderer never navigates. It is a single page with no router, so any navigation away from
   * the shell is either a bug or something hostile — and unlike a browser tab there is no back
   * button to recover with. External links are handled by the window-open handler above.
   */
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  win.loadURL(`${APP_SCHEME}://-/index.html`);
  return win;
}

app.whenReady().then(() => {
  buildMenu();
  applyCsp();
  registerSaveIpc();
  serveDist();
  createWindow();
});

/**
 * Quits on every platform, macOS included.
 *
 * The macOS convention is to keep the process alive with no windows and re-open one on dock
 * activate, which is right for a document app you dip in and out of. It is wrong for a game: closing
 * the window means "I'm done playing", and a fullscreen game left running with nothing on screen is
 * indistinguishable from a hung process. It also blocked the terminal on every `npm run desktop`,
 * since npm waits for a child that never exits.
 *
 * The `activate` handler that used to re-create a window went with it — once the app quits on the
 * last window closing, `activate` can never fire with zero windows, so it was unreachable.
 */
app.on('window-all-closed', () => {
  app.quit();
});
