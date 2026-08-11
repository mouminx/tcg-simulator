/**
 * Create a viewport-level visual copy of a loot/card tile and fly it toward a point.
 *
 * A large z-index cannot escape an ancestor's `overflow: hidden/auto`. Queue and summon panels use
 * those overflow modes deliberately, so collection animations must leave that DOM subtree. The ghost is
 * appended directly to `<body>` while the source stays invisibly in flow, preserving both paint order and
 * layout size for the duration of the flight.
 */
export function flyLootElement(source, {
  x,
  y,
  index = 0,
  durationMs = 500,
  fadeDurationMs = 400,
  delayStepMs = 70,
  fadeDelayMs = 100,
  scale = 0.05,
} = {}) {
  if (!source || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const rect = source.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const ghost = source.cloneNode(true);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.classList.add('loot-flight-ghost');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    zIndex: '12300',
    pointerEvents: 'none',
    animation: 'none',
    transform: 'none',
    transition: 'none',
    opacity: '1',
  });
  document.body.appendChild(ghost);

  // `visibility`, unlike `display` or removing the source, keeps the queue's measured box intact.
  source.style.visibility = 'hidden';

  ghost.getBoundingClientRect(); // commit the start geometry before enabling the transition
  const dx = x - (rect.left + rect.width / 2);
  const dy = y - (rect.top + rect.height / 2);
  ghost.style.transition = [
    `transform ${durationMs / 1000}s ease ${index * delayStepMs / 1000}s`,
    `opacity ${fadeDurationMs / 1000}s ease ${(index * delayStepMs + fadeDelayMs) / 1000}s`,
  ].join(', ');
  ghost.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  ghost.style.opacity = '0';

  return { ghost, source };
}

/** Remove flight ghosts and restore any source nodes that are still mounted. */
export function clearLootFlightGhosts(flights) {
  (flights ?? []).forEach(({ ghost, source }) => {
    ghost?.remove();
    if (source?.isConnected) source.style.visibility = '';
  });
  if (Array.isArray(flights)) flights.length = 0;
}
