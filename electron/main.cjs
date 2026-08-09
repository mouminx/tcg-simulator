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

const { app, BrowserWindow, protocol, net, session, shell } = require('electron');
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

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    fullscreen: true,
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

  win.loadURL(`${APP_SCHEME}://-/index.html`);
  return win;
}

app.whenReady().then(() => {
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
