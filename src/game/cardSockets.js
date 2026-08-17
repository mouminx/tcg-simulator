import { GEM_RESOURCES_BY_ID } from './gems';

export const MAX_CARD_SOCKETS = 3;

// Deliberately rarity-agnostic. Legendary and Mythic only differ by being allowed
// to keep the vanishingly rare three-socket result.
export const CARD_SOCKET_WEIGHTS = Object.freeze({
  0: 80,
  1: 17,
  2: 2.8,
  3: 0.2,
});

export const GEM_EFFECTS = Object.freeze({
  ruby: Object.freeze({ label: 'Overflow', values: [0, 3, 5, 8, 12, 18] }),
  sapphire: Object.freeze({ label: 'Momentum', values: [0, 3, 5, 8, 12, 18] }),
  emerald: Object.freeze({ label: 'Fortune', values: [0, 4, 7, 11, 16, 24] }),
  topaz: Object.freeze({ label: 'Focus', values: [0, 15, 30, 50, 75, 110] }),
  diamond: Object.freeze({ label: 'Resonance', values: [0, 4, 7, 10, 14, 20] }),
});

const THREE_SOCKET_RARITIES = new Set(['legendary', 'mythic']);

export function rollCardSocketCount(rarity, random = Math.random) {
  const max = THREE_SOCKET_RARITIES.has(rarity) ? 3 : 2;
  const entries = Object.entries(CARD_SOCKET_WEIGHTS)
    .map(([count, weight]) => [Number(count), weight])
    .filter(([count]) => count <= max);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * total;
  for (const [count, weight] of entries) {
    roll -= weight;
    if (roll < 0) return count;
  }
  return max;
}

export function getCardSocketCount(card) {
  return Math.max(0, Math.min(MAX_CARD_SOCKETS, Math.floor(Number(card?.socketCount) || 0)));
}

export function getMaxCardSocketCount(card) {
  return THREE_SOCKET_RARITIES.has(card?.rarity) ? MAX_CARD_SOCKETS : 2;
}

export function normalizeCardSockets(card) {
  const count = getCardSocketCount(card);
  const saved = Array.isArray(card?.gemSockets) ? card.gemSockets : [];
  return Array.from({ length: count }, (_, index) => {
    const socket = saved[index];
    if (!socket?.gemId || !GEM_RESOURCES_BY_ID[socket.gemId]) return null;
    return {
      gemId: socket.gemId,
      ...(socket.boundResourceId ? { boundResourceId: socket.boundResourceId } : null),
      ...(socket.boundSource ? { boundSource: socket.boundSource } : null),
      ...(socket.boundName ? { boundName: socket.boundName } : null),
      ...(socket.boundAffixId ? { boundAffixId: socket.boundAffixId } : null),
    };
  });
}

export function getGemFamily(gemId) {
  const id = String(gemId ?? '');
  return id.slice(id.lastIndexOf('_') + 1);
}

export function getGemEffectValue(gemId) {
  const gem = GEM_RESOURCES_BY_ID[gemId];
  const effect = GEM_EFFECTS[getGemFamily(gemId)];
  return effect?.values?.[gem?.tier ?? 0] ?? 0;
}

export function getSocketEffectTotal(card, family, predicate = null) {
  return normalizeCardSockets(card).reduce((total, socket) => {
    if (!socket || getGemFamily(socket.gemId) !== family) return total;
    if (predicate && !predicate(socket)) return total;
    return total + getGemEffectValue(socket.gemId);
  }, 0);
}

export function rollSocketEffect(card, family, random = Math.random) {
  const chance = Math.max(0, getSocketEffectTotal(card, family));
  return chance > 0 && random() * 100 < chance;
}

export function getDiamondAffixAmplification(card, affixId) {
  return getSocketEffectTotal(card, 'diamond', socket => socket.boundAffixId === affixId);
}

export function getTopazWeightMultiplier(card, resourceId, source = null) {
  const percent = getSocketEffectTotal(card, 'topaz', socket => (
    socket.boundResourceId === resourceId && (!source || !socket.boundSource || socket.boundSource === source)
  ));
  return 1 + percent / 100;
}

export function socketGemOnCard(card, gemId, binding = {}) {
  if (!GEM_RESOURCES_BY_ID[gemId]) return null;
  const sockets = normalizeCardSockets(card);
  const emptyIndex = sockets.findIndex(socket => socket == null);
  if (emptyIndex < 0) return null;
  sockets[emptyIndex] = {
    gemId,
    ...(binding.boundResourceId ? { boundResourceId: binding.boundResourceId } : null),
    ...(binding.boundSource ? { boundSource: binding.boundSource } : null),
    ...(binding.boundName ? { boundName: binding.boundName } : null),
    ...(binding.boundAffixId ? { boundAffixId: binding.boundAffixId } : null),
  };
  return { ...card, gemSockets: sockets };
}

/** Cut one permanent empty socket into a card without disturbing existing gems. */
export function addCardSocket(card) {
  const count = getCardSocketCount(card);
  if (count >= getMaxCardSocketCount(card)) return null;
  return {
    ...card,
    socketCount: count + 1,
    gemSockets: [...normalizeCardSockets(card), null],
  };
}

/** Remove a gem while leaving the socket itself intact. */
export function extractSocketedGem(card, socketIndex) {
  const sockets = normalizeCardSockets(card);
  const index = Math.floor(Number(socketIndex));
  const socket = sockets[index];
  if (!socket?.gemId) return null;
  sockets[index] = null;
  return {
    card: { ...card, gemSockets: sockets },
    gemId: socket.gemId,
  };
}

/** Apply Sapphire's carried progress to a cycle that has just restarted. */
export function applySapphireMomentum(card, cycle, now = Date.now()) {
  if (!cycle?.startedAt || !cycle?.endsAt) return cycle;
  const percent = Math.min(90, getSocketEffectTotal(card, 'sapphire'));
  if (percent <= 0) return cycle;
  const duration = Math.max(0, cycle.endsAt - cycle.startedAt);
  return {
    ...cycle,
    startedAt: now - duration * (percent / 100),
    endsAt: now + duration * (1 - percent / 100),
  };
}

export function describeSocket(socket) {
  if (!socket) return 'Empty socket';
  const gem = GEM_RESOURCES_BY_ID[socket.gemId];
  const family = getGemFamily(socket.gemId);
  const effect = GEM_EFFECTS[family];
  const value = getGemEffectValue(socket.gemId);
  if (family === 'topaz') return `${gem?.name ?? socket.gemId}: +${value}% weight for ${socket.boundName ?? 'its imprinted resource'}`;
  if (family === 'diamond') return `${gem?.name ?? socket.gemId}: +${value}% to its bound affix`;
  const suffix = family === 'sapphire' ? ' cycle progress' : ' chance';
  return `${gem?.name ?? socket.gemId}: +${value}% ${effect?.label ?? family}${suffix}`;
}
