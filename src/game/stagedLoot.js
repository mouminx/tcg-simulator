export const LOOT_STAGE_DURATION_MS = 2400;
export const LOOT_STAGE_FLIGHT_MS = 650;

function positiveCounts(counts = {}) {
  return Object.fromEntries(
    Object.entries(counts).filter(([, amount]) => Number.isFinite(amount) && amount > 0),
  );
}

export function createStagedLootEvents(completedBySlot = [], now = Date.now(), prefix = 'loot') {
  return completedBySlot.map((completion, index) => ({
    id: `${prefix}-${completion.slotId}-${now}-${index}`,
    slotId: Number(completion.slotId),
    loot: positiveCounts(completion.loot),
    rewards: positiveCounts(completion.rewards),
    releaseAt: now + LOOT_STAGE_DURATION_MS,
  }));
}

export function normalizeStagedLootEvents(events = []) {
  if (!Array.isArray(events)) return [];
  return events.flatMap((event, index) => {
    const slotId = Number(event?.slotId);
    const releaseAt = Number(event?.releaseAt);
    if (!Number.isFinite(slotId) || slotId < 1 || !Number.isFinite(releaseAt)) return [];
    return [{
      id: typeof event.id === 'string' ? event.id : `restored-loot-${slotId}-${releaseAt}-${index}`,
      slotId,
      loot: positiveCounts(event.loot),
      rewards: positiveCounts(event.rewards),
      releaseAt,
    }];
  });
}

export function partitionStagedLoot(events = [], now = Date.now()) {
  const due = [];
  const pending = [];
  events.forEach(event => (event.releaseAt <= now ? due : pending).push(event));
  return { due, pending };
}

export function aggregateStagedCounts(events = [], field = 'loot') {
  return events.reduce((total, event) => {
    Object.entries(event?.[field] ?? {}).forEach(([id, amount]) => {
      if (amount > 0) total[id] = (total[id] ?? 0) + amount;
    });
    return total;
  }, {});
}
