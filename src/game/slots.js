/**
 * The three save slots.
 *
 * A slot is a *position* (1, 2 or 3) holding at most one save, and each save is either **SSF** (local to
 * this device) or **online** (a row on the account). One list, one badge per entry.
 *
 * ── Why positions can collide, and who yields ──
 * The two stores are independent: local slots live on this device, online slots live on the account. So a
 * player with an SSF save in position 2 who signs in on a new device, having created an online save in
 * position 2 elsewhere, has two saves claiming one position.
 *
 * The rule is that **the server's slot index is authoritative and the local save moves**. Local data is
 * ours to reorganise — moving it is invisible and lossless — whereas a server slot index is shared across
 * every device the player signs in on, so relocating *that* would make the same save appear in different
 * positions depending on where you looked.
 *
 * ── Overflow is possible, and is reported rather than hidden ──
 * Three local saves plus one online save is four saves for three positions. It takes deliberate effort
 * across devices, but it is reachable, and the alternatives are both worse than admitting it: silently
 * hiding a save looks like data loss, and deleting one is data loss. So `listSlots` may return more than
 * three entries with the extras flagged `overflow`, and slot creation is blocked until the player frees a
 * position. Nothing is ever destroyed to make the list fit.
 */

import {
  SLOT_INDICES,
  getLocalAdapter,
  moveLocalSlot,
  readAllLocalSlots,
} from './storage';
import { listRemoteSlots, makeRemoteAdapter } from './account';

export const SLOT_MODES = Object.freeze({ SSF: 'ssf', ONLINE: 'online' });

/**
 * The display projection stored in `saves.meta` and derived for local slots.
 *
 * Small on purpose — it is read to draw a menu, not to play. Keep it to values a player recognises at a
 * glance; anything that needs the real save belongs after the slot is loaded.
 */
export function buildSlotMeta(save) {
  if (!save || typeof save !== 'object') return {};
  return {
    balance: Number(save.balance) || 0,
    cards: Array.isArray(save.collection) ? save.collection.length : 0,
    packsOpened: Number(save.packsOpened) || 0,
    savedAt: new Date().toISOString(),
  };
}

/** Parses just enough of a local save to describe it, without trusting its shape. */
function metaFromRaw(raw) {
  try {
    const parsed = JSON.parse(raw);
    return {
      meta: {
        balance: Number(parsed.balance) || 0,
        cards: Array.isArray(parsed.collection) ? parsed.collection.length : 0,
        packsOpened: Number(parsed.packsOpened) || 0,
      },
      saveVersion: Number(parsed.version) || 0,
    };
  } catch {
    // A local save that will not parse is still a save the player has — it is reported as present but
    // undescribed, so the picker can offer to delete it rather than pretending the slot is empty.
    return { meta: {}, saveVersion: 0, corrupt: true };
  }
}

/**
 * Builds the slot list.
 *
 * `client` is null when signed out, in which case only local slots exist and no reconciliation is needed.
 *
 * Reconciliation, when signed in:
 *   1. Online slots take the positions the server gives them.
 *   2. Any local save sitting in one of those positions is **moved** to the lowest free position.
 *   3. Local saves with nowhere to go are returned flagged `overflow`.
 */
export async function listSlots(client) {
  const localRaw = await readAllLocalSlots();
  let locals = localRaw
    .filter(entry => entry.raw != null)
    .map(entry => ({ slot: entry.slot, mode: SLOT_MODES.SSF, ...metaFromRaw(entry.raw) }));

  let remotes = [];
  if (client) {
    remotes = (await listRemoteSlots(client)).map(row => ({
      slot: row.slot,
      mode: SLOT_MODES.ONLINE,
      meta: row.meta ?? {},
      saveVersion: row.save_version,
      revision: row.revision,
      updatedAt: row.updated_at,
    }));
  }

  const claimed = new Set(remotes.map(r => r.slot));
  const overflow = [];

  if (claimed.size) {
    const displaced = locals.filter(l => claimed.has(l.slot));
    const settled = locals.filter(l => !claimed.has(l.slot));

    for (const local of displaced) {
      const taken = new Set([...claimed, ...settled.map(s => s.slot)]);
      const free = SLOT_INDICES.find(i => !taken.has(i));
      if (free == null) {
        // Nothing to move it to. Reported, never deleted.
        overflow.push({ ...local, overflow: true });
        continue;
      }
      const moved = await moveLocalSlot(local.slot, free);
      if (moved) settled.push({ ...local, slot: free });
      else overflow.push({ ...local, overflow: true });
    }
    locals = settled;
  }

  const all = [...remotes, ...locals].sort((a, b) => a.slot - b.slot);
  const occupied = new Set(all.map(s => s.slot));
  const empty = SLOT_INDICES.filter(i => !occupied.has(i)).map(slot => ({ slot, mode: null }));

  return {
    slots: [...all, ...empty].sort((a, b) => a.slot - b.slot),
    overflow,
    // Creation is blocked while an overflow save has nowhere to live — otherwise a fourth save would be
    // created on top of a list that already cannot fit.
    canCreate: overflow.length === 0 && empty.length > 0,
  };
}

/**
 * The adapter for one slot, given its mode.
 *
 * This is the single place a slot becomes storage, which is why `App` never has to branch on mode when
 * saving — it sets one adapter and the rest of the game is unaware there was ever a choice.
 */
export function adapterForSlot({ slot, mode }, client) {
  if (mode === SLOT_MODES.ONLINE) {
    if (!client) throw new Error('An online save needs you to be signed in.');
    return makeRemoteAdapter(client, slot, { buildMeta: buildSlotMeta });
  }
  return getLocalAdapter(slot);
}

/**
 * Deletes a save and frees its position.
 *
 * Routed through the adapter so the online path goes to `delete_save()` — the client holds no DELETE
 * privilege on `saves`, by design.
 */
export async function deleteSlot({ slot, mode }, client) {
  const adapter = adapterForSlot({ slot, mode }, client);
  return adapter.remove ? adapter.remove() : false;
}
