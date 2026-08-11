/** Build an empty output-count map for every stable production slot id. */
export function createProductionOutputQueues(slotIds = []) {
  return Object.fromEntries(slotIds.map(slotId => [String(slotId), {}]));
}

function positiveInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function sanitizeOutputCounts(counts, validOutputIds) {
  const valid = new Set(validOutputIds);
  return Object.fromEntries(
    Object.entries(counts ?? {})
      .filter(([outputId]) => valid.has(outputId))
      .map(([outputId, count]) => [outputId, positiveInteger(count)])
      .filter(([, count]) => count > 0),
  );
}

/**
 * Normalize the per-row queue, or migrate the old resource-wide queue without losing pending output.
 *
 * Legacy saves cannot tell us which of several identical rows produced an item. Prefer a row whose
 * currently loaded recipe matches that output; otherwise put it on the least-loaded row. Once migrated,
 * every new completion is attributed to its exact slot and never needs this fallback again.
 */
export function normalizeProductionOutputQueues({
  savedQueues,
  slotIds = [],
  validOutputIds = [],
  legacyQueue = {},
  legacySlotOutputs = {},
} = {}) {
  const normalized = createProductionOutputQueues(slotIds);
  const hasPerSlotSave = savedQueues && typeof savedQueues === 'object' && !Array.isArray(savedQueues);

  if (hasPerSlotSave) {
    slotIds.forEach(slotId => {
      normalized[String(slotId)] = sanitizeOutputCounts(savedQueues[String(slotId)], validOutputIds);
    });
    return normalized;
  }

  const totalForSlot = slotId => Object.values(normalized[String(slotId)] ?? {})
    .reduce((sum, count) => sum + count, 0);

  Object.entries(sanitizeOutputCounts(legacyQueue, validOutputIds)).forEach(([outputId, count]) => {
    const matchingSlot = slotIds.find(slotId => legacySlotOutputs[String(slotId)] === outputId);
    const targetSlot = matchingSlot ?? [...slotIds].sort((a, b) => totalForSlot(a) - totalForSlot(b))[0];
    if (targetSlot == null) return;
    const key = String(targetSlot);
    normalized[key] = { ...normalized[key], [outputId]: (normalized[key][outputId] ?? 0) + count };
  });

  return normalized;
}

export function addProductionOutput(queues, slotId, outputId, amount) {
  const count = positiveInteger(amount);
  if (!outputId || count <= 0) return queues;
  const key = String(slotId);
  const row = queues?.[key] ?? {};
  return {
    ...queues,
    [key]: { ...row, [outputId]: (row[outputId] ?? 0) + count },
  };
}

export function mergeProductionOutputs(queues, completedBySlot = {}) {
  let next = queues;
  Object.entries(completedBySlot).forEach(([slotId, outputs]) => {
    Object.entries(outputs ?? {}).forEach(([outputId, amount]) => {
      next = addProductionOutput(next, slotId, outputId, amount);
    });
  });
  return next;
}

export function totalProductionOutputs(queues = {}, outputIds = []) {
  const total = Object.fromEntries(outputIds.map(outputId => [outputId, 0]));
  Object.values(queues ?? {}).forEach(row => {
    Object.entries(row ?? {}).forEach(([outputId, count]) => {
      total[outputId] = (total[outputId] ?? 0) + positiveInteger(count);
    });
  });
  return total;
}

export function hasProductionOutput(outputs = {}) {
  return Object.values(outputs ?? {}).some(count => positiveInteger(count) > 0);
}

/** Subtract exactly the snapshot that began a collection flight, preserving output made in transit. */
export function subtractProductionOutputs(queues, slotId, collected = {}) {
  const key = String(slotId);
  const current = queues?.[key] ?? {};
  const nextRow = { ...current };
  Object.entries(collected).forEach(([outputId, amount]) => {
    const remaining = positiveInteger(current[outputId]) - positiveInteger(amount);
    if (remaining > 0) nextRow[outputId] = remaining;
    else delete nextRow[outputId];
  });
  return { ...queues, [key]: nextRow };
}
