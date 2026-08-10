/**
 * Preload — the only bridge between the renderer and the main process.
 *
 * Deliberately narrow. The renderer gets a marker it can branch on, and a save channel: no `fs`, no
 * path, no arbitrary IPC. Exposing an API "just in case" is how a renderer ends up with filesystem
 * reach it never asked for, and this renderer runs the whole game — including, eventually, content
 * fetched from a server.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  /**
   * There is deliberately no `mode: 'ssf'` here any more.
   *
   * It used to declare that this build permitted offline play only, which was true while the desktop
   * build was the offline one. The Steam build is online-capable, and more importantly SSF-versus-online
   * is now a property of a *save slot* (`SLOT_MODES` in src/game/slots.js), not of the binary — a player
   * can hold one of each. A build-level marker could only ever contradict that. Nothing read it.
   */
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },

  /**
   * The save channel behind `src/game/storage.js`'s desktop adapter.
   *
   * Note what is *not* here: no filename, no directory, no way for the renderer to name what it reads
   * or writes. The main process owns the path entirely, so a compromised renderer can overwrite the
   * save — which it can do anyway, since it holds the game state — but cannot reach anything else.
   *
   * `write`'s `sync` flag routes to a blocking channel. It exists for the flush the renderer performs
   * as it is being destroyed on window close, where an async message may never be delivered. It is the
   * wrong choice for a routine autosave and the only correct one there.
   */
  save: {
    slots: 3,
    read: slot => ipcRenderer.invoke('save:read', slot),
    write: (slot, serialized, sync = false) => (sync
      ? ipcRenderer.sendSync('save:write-sync', slot, serialized)
      : ipcRenderer.invoke('save:write', slot, serialized)),
    remove: slot => ipcRenderer.invoke('save:delete', slot),
  },
});
