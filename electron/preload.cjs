/**
 * Preload — the only bridge between the renderer and the main process.
 *
 * Deliberately almost empty. The game currently needs nothing from Node: the save lives in
 * `localStorage`, every asset is bundled, and there is no network in the SSF build. Exposing an API
 * "just in case" is how a renderer ends up with filesystem reach it never asked for.
 *
 * What it does expose is a marker the app can branch on. Two things will need it:
 *   - hiding the marketplace in the SSF build, once the online mode exists,
 *   - swapping the save's storage adapter from `localStorage` to a real file on disk, which is
 *     backup-able and survives a cache clear. That is the natural place for the first real IPC
 *     channel, and the storage adapter is the seam it plugs into.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  // Which game mode this build permits. The Electron shell is offline-only for now, so a
  // marketplace has nothing to talk to.
  mode: 'ssf',
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});
