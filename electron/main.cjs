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

const { app, BrowserWindow, Menu, protocol, net, session, shell } = require('electron');
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
  serveDist();
  createWindow();

  // macOS keeps the process alive with no windows; re-create on dock activate.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Windows and Linux expect the app to exit with its last window.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
