/**
 * Where a save lives — the seam between the game and its storage.
 *
 * The game had `localStorage.getItem('tcg-sim')` and `.setItem` inlined in `App.jsx`. That is exactly
 * right for a browser-only game and wrong for everything this one is becoming: the desktop shell wants
 * real files (backup-able, survive a cache clear, not silently evictable), and the online mode wants
 * rows on a server. All of them are the same operation — read a blob, write a blob — so they belong
 * behind one contract rather than as branches at the call site.
 *
 * ── The adapter moves RAW STRINGS, not parsed state ──
 * `read()` returns the serialized save exactly as stored, and `write()` takes it the same way. Parsing,
 * migrating and defaulting stay in `App.jsx`, which already owns the save's shape and its many versions
 * of migration.
 *
 * That split is the whole point. An adapter dealing in parsed objects would have to understand the
 * schema, so every save-format change would touch all three adapters *and* the server. Opaque blobs
 * mean the remote adapter is a fetch call that never learns what a card is.
 *
 * ── `read()` is async, and that is load-bearing ──
 * `localStorage` is synchronous; a file over IPC and a network round-trip are not. Making the contract
 * async at the narrowest point means the call site waits *once*, rather than the interface being honest
 * for two adapters and a lie for the third. It is why `App` boots through a gate instead of reading the
 * save during render.
 *
 * ── One adapter per SLOT ──
 * There are three save slots, and each is either SSF (local) or online. An adapter is therefore built
 * *for a slot*, not for a build: `getLocalAdapter(2)` is slot 2 on this device. `src/game/slots.js` owns
 * which slot is which mode; this module only knows how to read and write one.
 */

/** The legacy single-save key, kept only so `migrateLegacyLocalSave` can find and move it. */
const LEGACY_KEY = 'tcg-sim';

export const SLOT_COUNT = 3;
export const SLOT_INDICES = Object.freeze([1, 2, 3]);

/** Slot 1 keeps the legacy key so an existing browser save needs no move at all. */
export const localKeyForSlot = slot => (slot === 1 ? LEGACY_KEY : `${LEGACY_KEY}:slot:${slot}`);

function isValidSlot(slot) {
  return Number.isInteger(slot) && slot >= 1 && slot <= SLOT_COUNT;
}

// ── localStorage (web) ───────────────────────────────────────────────────────

/**
 * `write` ignores the `sync` option because `localStorage.setItem` is already synchronous — the option
 * exists for adapters where the distinction is real (see the desktop adapter's flush path).
 */
function makeLocalStorageAdapter(slot) {
  const key = localKeyForSlot(slot);
  return {
    name: 'localStorage',
    slot,
    describe: () => `localStorage["${key}"]`,
    async read() {
      try {
        return localStorage.getItem(key);
      } catch {
        // Private-mode Safari and some managed configurations throw here rather than returning null.
        // A game that cannot persist is still playable, so this is not fatal.
        return null;
      }
    },
    write(serialized) {
      try {
        localStorage.setItem(key, serialized);
        return true;
      } catch {
        return false;
      }
    },
    async remove() {
      try {
        localStorage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ── Desktop file ─────────────────────────────────────────────────────────────

/**
 * The desktop adapter — a real JSON file per slot under the OS's per-user application-data directory.
 *
 * The heavy lifting (atomic replace, the `.bak` rotation, corruption recovery, the legacy `save.json`
 * rename) is in `electron/main.cjs`, because only the main process can touch the filesystem and only it
 * knows about the two files per slot. This side is a thin channel that cannot name a path.
 *
 * **Slot 1's first read imports whatever is in `localStorage`.** The packaged shell persisted there
 * before the file adapter existed, so anyone who already played the desktop build has their entire
 * collection in the renderer's localStorage partition; switching to files without adopting it would look
 * exactly like a wiped save. Only slot 1, because that is where a single pre-slots save belongs.
 *
 * The localStorage copy is deliberately *not* deleted: it costs a few hundred KB and it is the only
 * fallback if the file path ever fails on a machine we cannot debug.
 */
function makeDesktopAdapter(bridge, slot) {
  return {
    name: 'desktop-file',
    slot,
    describe: () => `save-${slot}.json in the app data directory`,
    async read() {
      const fromFile = await bridge.read(slot);
      if (fromFile != null) return fromFile;
      if (slot !== 1) return null;

      let legacy = null;
      try {
        legacy = localStorage.getItem(LEGACY_KEY);
      } catch { /* no localStorage partition; nothing to import */ }
      if (legacy == null) return null;

      // Adopt it, then persist synchronously so this only happens once — a crash between adopting and
      // the next debounced write would otherwise keep the legacy copy authoritative indefinitely.
      bridge.write(slot, legacy, true);
      return legacy;
    },
    /**
     * `sync` is used only by the flush-on-exit path. A normal debounced save is fire-and-forget, which
     * keeps a 2-second autosave off the renderer's critical path; a flush cannot be, because the
     * renderer is about to be destroyed and an async message may never be delivered.
     */
    write(serialized, sync = false) {
      return bridge.write(slot, serialized, sync);
    },
    async remove() {
      return bridge.remove ? bridge.remove(slot) : false;
    },
  };
}

// ── Selection ────────────────────────────────────────────────────────────────

/**
 * The save bridge for this build, or null in a browser.
 *
 * Probed for its *methods* rather than for `window.desktop` alone, so an older preload that predates
 * slots degrades to `localStorage` instead of throwing on a missing argument.
 */
function desktopBridge() {
  const bridge = typeof window !== 'undefined' ? window.desktop?.save : null;
  return bridge && typeof bridge.read === 'function' && typeof bridge.write === 'function' ? bridge : null;
}

export function isDesktopStorage() {
  return desktopBridge() !== null;
}

const localAdapters = new Map();

/**
 * The local (SSF) adapter for one slot — a file in the desktop shell, a localStorage key in a browser.
 *
 * Memoized per slot, because the desktop adapter's one-time localStorage import must not be able to run
 * twice for the same slot.
 */
export function getLocalAdapter(slot) {
  if (!isValidSlot(slot)) throw new Error(`invalid save slot: ${slot}`);
  if (!localAdapters.has(slot)) {
    const bridge = desktopBridge();
    localAdapters.set(slot, bridge ? makeDesktopAdapter(bridge, slot) : makeLocalStorageAdapter(slot));
  }
  return localAdapters.get(slot);
}

let active = null;

/**
 * The adapter the game is currently saving through. There is exactly one per session.
 *
 * Deliberately a module-level switch rather than something threaded through React. The save path runs
 * from a debounced timer and from `pagehide`, neither of which is a render, and passing the adapter down
 * as a prop would let a stale closure write one slot's progress into another — or a signed-out player's
 * into the previous account.
 */
export function setStorage(adapter) {
  active = adapter;
}

export function getStorage() {
  return active;
}

/**
 * Reads every local slot's raw contents, for the slot picker.
 *
 * Returns an array of `{ slot, raw }` with `raw` null for an empty slot. Parsing is the caller's job —
 * this module does not know what a save looks like — and it is cheap here because the source is local
 * either way.
 */
export async function readAllLocalSlots() {
  return Promise.all(SLOT_INDICES.map(async slot => {
    try {
      return { slot, raw: await getLocalAdapter(slot).read() };
    } catch {
      return { slot, raw: null };
    }
  }));
}

/**
 * Moves a local save from one slot to another, used when an online slot claims a position a local save
 * is sitting in.
 *
 * Local data is ours to reorganise, which is what makes the shared-position slot model workable: server
 * slot indices are fixed, so the local save is the one that yields. Copy-then-delete rather than a
 * rename, because the two storage backends have no rename primitive in common — and in that order, so a
 * failure between the two leaves a duplicate rather than nothing.
 */
export async function moveLocalSlot(fromSlot, toSlot) {
  if (fromSlot === toSlot) return true;
  const source = getLocalAdapter(fromSlot);
  const raw = await source.read();
  if (raw == null) return false;
  const ok = await getLocalAdapter(toSlot).write(raw);
  if (ok === false) return false;
  await source.remove();
  return true;
}
