/**
 * The connector under a station's input row: one stem per input slot dropping into a shared trunk,
 * then a single arrowhead into Output.
 *
 * Shared by the Foundry's forge rows and the Wilderness's processing rows. **The stems are keyed by
 * POSITION, not by what the slot holds** (`left` / `middle` / `right`) — the connector has no opinion
 * about ore versus raw material, and naming them after the forge's slots would have made Wilderness
 * import forge vocabulary to describe its own recipes.
 *
 * ── Each stem is lit independently ──
 * A single merged shape could only ever say "this row is working"; it could not say *which* input is
 * actually feeding it. A recipe that needs no ingredient leaves that stem dark, a slot holding some
 * material but not enough shows a waiting stem, and only a slot genuinely feeding the cycle glows.
 * That makes the connector a readout of the recipe rather than decoration.
 *
 * The division of labour: **stems say what is feeding, the trunk says how far along.** The trunk's
 * lit copy is driven by `--forge-progress`, so the channel brightens as the cycle runs.
 *
 * x positions are the centres of three equal columns (100/6, 50, 500/6), which is exactly what
 * `.foundry-forge-row__rail` lays its slots on — so the stems meet their slots at any panel width.
 */

/** `[positionKey, path]`. Left and right elbow inward; the middle drops straight. */
const MERGE_STEMS = [
  ['left', 'M16.667 0 V21 H50'],
  ['middle', 'M50 0 V21'],
  ['right', 'M83.333 0 V21 H50'],
];

const MERGE_TRUNK = 'M50 21 V42';

/**
 * @param stems `{ left, middle, right }`, each `'off' | 'idle' | 'live'`:
 *   off   this input plays no part in the current recipe — nothing to wait for
 *   idle  needed, but not satisfied yet
 *   live  loaded and feeding
 */
export default function StationMerge({ progress = 0, running = false, ready = false, stems = {} }) {
  /**
   * Right-angle elbows, not diagonals — and that is forced by the geometry, not a style choice.
   * This svg carries `preserveAspectRatio="none"` so it can stretch across whatever width the
   * process panel happens to be, which means x and y scale by different factors (roughly 3.5:1).
   * A true diagonal would be squashed almost flat by that and would change angle every time the
   * panel resized. Verticals and horizontals are immune to it, so the corners are square instead.
   */
  return (
    <svg
      className={`foundry-forge-merge${running ? ' foundry-forge-merge--running' : ''}${ready ? ' foundry-forge-merge--ready' : ''}`}
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ '--forge-progress': progress }}
    >
      {MERGE_STEMS.map(([key, d]) => (
        <g key={key} className={`foundry-forge-merge__stem foundry-forge-merge__stem--${stems[key] ?? 'off'}`}>
          <path className="foundry-forge-merge__track" d={d} />
          <path className="foundry-forge-merge__lit" d={d} />
        </g>
      ))}
      <g className="foundry-forge-merge__trunk">
        <path className="foundry-forge-merge__track" d={MERGE_TRUNK} />
        <path className="foundry-forge-merge__lit" d={MERGE_TRUNK} />
      </g>
      {/* Narrow in viewBox units because the same `preserveAspectRatio="none"` stretch that forces
          right angles above also widens this triangle ~3.5x. At 30 units it rendered ~104px across
          — a blob wider than the trunk feeding it. */}
      <path className="foundry-forge-merge__head" d="M42 40 L50 58 L58 40 Z" />
    </svg>
  );
}
