import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from '../game/audio/audioEngine';
import { SOUND_IDS } from '../game/audio/audioLibrary';
import { clearLootFlightGhosts, flyLootElement } from '../game/lootFlight';
import { hasProductionOutput } from '../game/productionOutputQueues';
import { aggregateStagedCounts, LOOT_STAGE_FLIGHT_MS } from '../game/stagedLoot';
import { createPortal } from 'react-dom';

import CardFace from './CardFace';
import { socketedCardDragProps } from './CardPocket';
import StationMerge from './StationMerge';
import HoverCardPreview, { buildHoverCardPreview } from './HoverCardPreview';
import ResourceQuantityPopover from './ResourceQuantityPopover';
import ToolCard from './ToolCard';
import LootTierBadge from './LootTierBadge';
import { getLootTier } from '../game/lootTiers';
import { ESSENCES_BY_ID, getElementResourceDescription, parseElementResourceId } from '../game/arcana';
import { CRAFTED_RESOURCES_BY_ID } from '../game/crafting';
import {
  ALL_GATHERING_RESOURCES,
  PROCESSING_BOOSTERS,
  PROCESSING_OUTPUT_RESOURCES_BY_ID,
  TREASURE_PACK_RESOURCE,
  getGatheringAffixBonusPercent,
  getProcessingAffixBonusPercent,
  getProcessingBoosterSpeedPercent,
  getProcessingDurationSeconds,
  getProcessingRecipe,
  hasQueuedGatheredResources,
  isProcessingSlotReady,
} from '../game/wilderness';

/** Processing row names. "Bench" rather than "Row" — it names the thing rather than its position, the
 *  same reason the forge's are "Forge I/II/III". */
const PROCESSING_ROW_LABELS = ['Bench I', 'Bench II', 'Bench III'];

const DIVIDER_RUNES = ['ᚠ', 'ᚱ', 'ᚨ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛞ', 'ᛟ', 'ᚲ', 'ᛗ', 'ᛚ', 'ᚾ', 'ᛜ', 'ᚦ', 'ᚹ'];
const DIVIDER_REPEAT = 6;

// Build a combined art map from resources, ore, and ingot folders so that
// miner/blacksmith pool items resolve correctly via their artKey.
const RESOURCE_ART = (() => {
  const map = {};
  const add = (files, stripSuffix = '') => {
    for (const [path, src] of Object.entries(files)) {
      const name = path.split('/').pop().replace(/\.webp$/i, '').toLowerCase();
      const key = stripSuffix ? name.replace(new RegExp(`\\s+${stripSuffix}$`, 'i'), '') : name;
      map[key] = src;
    }
  };
  add(import.meta.glob('../assets/resources/*.webp', { eager: true, import: 'default' }));
  add(import.meta.glob('../assets/crafted/*.webp', { eager: true, import: 'default' }));
  add(import.meta.glob('../assets/ores/*.webp', { eager: true, import: 'default' }), 'ore');
  add(import.meta.glob('../assets/ingots/*.webp', { eager: true, import: 'default' }));
  add(import.meta.glob('../assets/elements/**/*.webp', { eager: true, import: 'default' }));
  return map;
})();

const BONUS_COIN_REWARD = {
  threshold: 50,
  fewArtKey: 'few coins',
  lotsArtKey: 'lots of coins',
};

function getResourceArt(resource) {
  if (!resource) return null;
  if (typeof resource === 'string') return RESOURCE_ART[resource.toLowerCase()] ?? null;
  const key = (resource.artKey ?? resource.name).toLowerCase();
  return RESOURCE_ART[key] ?? null;
}

function fmtCount(count) {
  return new Intl.NumberFormat('en-US').format(count ?? 0);
}

function formatCountdown(remainingSeconds) {
  const clamped = Math.max(0, remainingSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function hasQueuedBonusRewards(queue = {}) {
  return Object.entries(queue).some(([key, count]) => key !== 'coins' ? (count ?? 0) > 0 : (count ?? 0) > 0);
}

function buildBonusRewardEntries(queue = {}) {
  const entries = [];
  if ((queue.coins ?? 0) > 0) {
    const many = (queue.coins ?? 0) >= BONUS_COIN_REWARD.threshold;
    entries.push({
      id: 'coins',
      name: many ? 'Lots of Coins' : 'Few Coins',
      artKey: many ? BONUS_COIN_REWARD.lotsArtKey : BONUS_COIN_REWARD.fewArtKey,
      description: 'Claimable coins earned from Coin Generation affixes during wilderness work.',
      count: queue.coins ?? 0,
      tier: getLootTier('currency', 'coins'),
      gainNoun: 'coins',
    });
  }

  Object.entries(queue).forEach(([resourceId, count]) => {
    if (resourceId === 'coins' || !(count > 0)) return;
    const crafted = CRAFTED_RESOURCES_BY_ID[resourceId];
    if (crafted) {
      entries.push({
        ...crafted,
        count,
        tier: getLootTier('crafted', resourceId, crafted),
        gainNoun: crafted.name.toLowerCase(),
      });
      return;
    }
    const { elementId, tier } = parseElementResourceId(resourceId);
    const baseName = ESSENCES_BY_ID[elementId]?.name?.replace(/\s+Essence$/i, '') ?? elementId;
    const labelTier = tier.charAt(0).toUpperCase() + tier.slice(1);
    entries.push({
      id: resourceId,
      name: `${baseName} ${labelTier}`,
      artKey: `${elementId} ${tier}`,
      description: getElementResourceDescription(resourceId),
      count,
      tier: getLootTier('arcana', resourceId),
      gainNoun: labelTier.toLowerCase(),
    });
  });

  return entries;
}

function SquareResourceCard({ resource, count = 0, requiredCount = null, className = '', tileRef = null, gainLabel = null, onContextMenu = null, onClick = null, dataDropTarget = null }) {
  const artSrc = getResourceArt(resource);
  const name = typeof resource === 'string' ? resource : resource.name;
  const description = typeof resource === 'object' ? (resource.description ?? '') : '';
  const tier = getLootTier(null, typeof resource === 'string' ? resource : resource?.id, resource);
  const showsRequirement = Number.isFinite(requiredCount) && requiredCount > 0;
  const [tipPos, setTipPos] = useState(null);
  const [clampedPos, setClampedPos] = useState(null);
  const tipRef = useRef(null);

  useLayoutEffect(() => {
    if (!tipPos || !tipRef.current) { setClampedPos(null); return; }
    const { width, height } = tipRef.current.getBoundingClientRect();
    const OFFSET = 14;
    let x = tipPos.x + OFFSET;
    let y = tipPos.y + OFFSET;
    if (x + width > window.innerWidth - 8) x = tipPos.x - width - OFFSET;
    if (y + height > window.innerHeight - 8) y = tipPos.y - height - OFFSET;
    setClampedPos({ x, y });
  }, [tipPos]);

  function handleMouseMove(e) {
    setTipPos({ x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <div
        ref={tileRef}
        onMouseEnter={handleMouseMove}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTipPos(null)}
        onContextMenu={onContextMenu}
        onClick={onClick}
        data-resource-drop-target={dataDropTarget}
        className={`card-face-wrapper no-twirl foundry-square-resource${count > 0 ? ' foundry-square-resource--owned' : ' foundry-square-resource--empty'} ${className}`.trim()}
      >
        {gainLabel ? (
          <span className="foundry-square-resource__gain">{gainLabel}</span>
        ) : null}
        <div className="card-face-inner">
          <div className="card-face-front foundry-square-resource__front">
            <div className={`foundry-square-resource__header foundry-square-resource__header--count-only${showsRequirement ? ' foundry-square-resource__header--requirement' : ''}`}>
              <span
                className={`foundry-square-resource__count${showsRequirement ? ' foundry-square-resource__count--requirement' : ''}`}
                data-material-requirement={showsRequirement ? `${count ?? 0}/${requiredCount}` : undefined}
                aria-label={showsRequirement ? `${fmtCount(count)} of ${fmtCount(requiredCount)} required` : undefined}
              >
                {showsRequirement ? `${fmtCount(count)} / ${fmtCount(requiredCount)}` : fmtCount(count)}
              </span>
            </div>
            <div className="foundry-square-resource__art-wrap">
              {artSrc ? <img src={artSrc} alt={name} className="foundry-square-resource__art" /> : null}
            </div>
            <LootTierBadge tier={tier} />
          </div>
        </div>
      </div>
      {tipPos && createPortal(
        <div
          ref={tipRef}
          className="resource-tooltip"
          style={{ left: (clampedPos ?? tipPos).x, top: (clampedPos ?? tipPos).y }}
        >
          <span className="resource-tooltip__name">{name}</span>
          {description && <span className="resource-tooltip__desc">{description}</span>}
        </div>,
        document.body,
      )}
    </>
  );
}

function GatheringSlot({
  slot,
  stagedLoot = [],
  stageTargetRef = null,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
  returnsToPocket,
  now,
  onPreviewEnter,
  onPreviewLeave,
  onSocketTool,
  onUnsocketTool,
}) {
  const stagedTileRefs = useRef({});
  const stagedFlightsRef = useRef([]);
  const remainingMs = slot.endsAt ? Math.max(0, slot.endsAt - now) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const running = Boolean(slot.startedAt && slot.endsAt && remainingMs > 0);
  const bonusPercent = slot.card ? getGatheringAffixBonusPercent(slot.card, slot.tool, slot.momentumStacks) : 0;
  const durationMs = slot.startedAt && slot.endsAt ? Math.max(1, slot.endsAt - slot.startedAt) : 0;
  const progress = running && durationMs ? Math.max(0, Math.min(1, (now - slot.startedAt) / durationMs)) : 0;
  const clearTitle = returnsToPocket ? 'Remove and return to pocket' : 'Remove and return to collection';
  const stagedResources = aggregateStagedCounts(stagedLoot, 'loot');
  const stagedRewards = aggregateStagedCounts(stagedLoot, 'rewards');
  const stagedResourceEntries = ALL_GATHERING_RESOURCES.filter(resource => (stagedResources[resource.id] ?? 0) > 0);
  const stagedRewardEntries = buildBonusRewardEntries(stagedRewards);
  const hasStagedLoot = stagedResourceEntries.length > 0 || stagedRewardEntries.length > 0;
  const stagedKey = stagedLoot.map(event => event.id).join('|');
  const nextReleaseAt = stagedLoot.length > 0 ? Math.min(...stagedLoot.map(event => event.releaseAt)) : null;

  useEffect(() => {
    clearLootFlightGhosts(stagedFlightsRef.current);
    if (!stagedKey || !nextReleaseAt) return undefined;
    const timeout = window.setTimeout(() => {
      const target = stageTargetRef?.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      Object.values(stagedTileRefs.current).filter(Boolean).forEach((source, index) => {
        const flight = flyLootElement(source, {
          x: rect.left + rect.width / 2,
          y: rect.top + 24,
          index,
          durationMs: 500,
          delayStepMs: 45,
        });
        if (flight) stagedFlightsRef.current.push(flight);
      });
    }, Math.max(0, nextReleaseAt - Date.now() - LOOT_STAGE_FLIGHT_MS));
    return () => {
      window.clearTimeout(timeout);
      clearLootFlightGhosts(stagedFlightsRef.current);
    };
  }, [nextReleaseAt, stagedKey, stageTargetRef]);

  return (
    <div
      className={[
        'foundry-mine-slot',
        'wilderness-gather-slot',
        slot.card ? 'foundry-mine-slot--filled' : '',
        running ? 'foundry-mine-slot--running' : '',
        isDragOver ? 'foundry-mine-slot--drag-over' : '',
      ].filter(Boolean).join(' ')}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {slot.card ? (
        <button
          className="foundry-mine-slot__clear"
          onClick={onClear}
          aria-label={`Remove ${slot.card.name} from gathering slot`}
          title={clearTitle}
        >
          ✕
        </button>
      ) : null}

      {slot.card ? (
        <>
          <div
            className="foundry-mine-slot__card"
            {...socketedCardDragProps(slot.card)}
            onMouseEnter={e => onPreviewEnter?.(e.currentTarget, slot.card)}
            onMouseLeave={() => onPreviewLeave?.(slot.card)}
            title={`${slot.card.name} — drag to your Hand, or press x to release it`}
          >
            <CardFace card={slot.card} visualMode="compact" className="foundry-mine-slot__card-face no-twirl" />
          </div>
          <div className="foundry-mine-slot__right">
            <div
              className={`station-tool-slot${slot.tool ? ' station-tool-slot--filled' : ''}`}
              aria-label="Gathering tool or buff slot"
              data-tool-drop-target="gathering"
              data-tool-slot-id={slot.slotId}
              onDragOver={event => {
                if (!event.dataTransfer.types.includes('application/x-cards-of-arcana-tool')) return;
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={event => {
                const toolId = event.dataTransfer.getData('application/x-cards-of-arcana-tool');
                if (!toolId) return;
                event.preventDefault();
                event.stopPropagation();
                onSocketTool?.(toolId);
              }}
            >
              <span className="station-tool-slot__speed">+{bonusPercent}% Speed</span>
              <div className={`station-tool-slot__socket${slot.tool ? ' station-tool-slot__socket--filled' : ''}`}>
                {slot.tool ? (
                  <ToolCard
                    tool={slot.tool}
                    className="station-tool-card"
                    onClick={() => onUnsocketTool?.()}
                  />
                ) : <span>Tool/Buff</span>}
              </div>
            </div>
            <div className={`station-loot-stage${hasStagedLoot ? ' station-loot-stage--active' : ''}`}>
              <div className="station-loot-stage__stack" aria-live="polite">
                {stagedResourceEntries.map(resource => (
                  <div key={`gather-stage-${resource.id}`} className="station-loot-stage__item">
                    <SquareResourceCard
                      resource={resource}
                      count={stagedResources[resource.id]}
                      tileRef={element => { stagedTileRefs.current[`resource-${resource.id}`] = element; }}
                      className="station-loot-stage__card"
                    />
                  </div>
                ))}
                {stagedRewardEntries.map(entry => (
                  <div key={`gather-stage-reward-${entry.id}`} className="station-loot-stage__item">
                    <SquareResourceCard
                      resource={{ name: entry.name, artKey: entry.artKey, description: entry.description }}
                      count={entry.count}
                      tileRef={element => { stagedTileRefs.current[`reward-${entry.id}`] = element; }}
                      className="station-loot-stage__card"
                    />
                  </div>
                ))}
                {!hasStagedLoot ? <span className="station-loot-stage__empty">Loot</span> : null}
              </div>
            </div>
          </div>
          <div
            className={`station-cycle-progress station-cycle-progress--wilderness${running ? ' station-cycle-progress--running' : ''}`}
            style={{ '--station-progress': progress }}
            role="progressbar"
            aria-label="Gathering cycle progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(progress * 100)}
            title={running ? `${formatCountdown(remainingSeconds)} remaining` : 'Cycle ready'}
          >
            <span className="station-cycle-progress__fill" />
          </div>
        </>
      ) : (
        <div className="foundry-mine-slot__placeholder">
          <span className="foundry-mine-slot__placeholder-rune" aria-hidden="true">ᛃ</span>
          <span className="foundry-mine-slot__placeholder-text">Drop a card</span>
        </div>
      )}
    </div>
  );
}

function getProcessingRowProgress(slot, now) {
  if (!slot?.startedAt || !slot?.endsAt) return 0;
  const duration = Math.max(1, slot.endsAt - slot.startedAt);
  const elapsed = Math.max(0, Math.min(duration, now - slot.startedAt));
  return elapsed / duration;
}

function ProcessingCardSlot({
  slot,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
  onPreviewEnter,
  onPreviewLeave,
}) {
  return (
    <div
      className={`foundry-card-slot${slot.card ? ' foundry-card-slot--filled' : ''}${isDragOver ? ' foundry-card-slot--drag-over' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {slot.card ? (
        <div className="foundry-card-slot__placed foundry-card-slot__placed--card">
          <button
            className="foundry-card-slot__clear"
            onClick={onClear}
            aria-label={`Remove ${slot.card.name} from processing slot`}
          >
            ✕
          </button>
          <div
            className="foundry-card-slot__card-hover"
            {...socketedCardDragProps(slot.card)}
            onMouseEnter={e => onPreviewEnter?.(e.currentTarget, slot.card)}
            onMouseLeave={() => onPreviewLeave?.(slot.card)}
            title={`${slot.card.name} — drag to your Hand, or press x to release it`}
          >
            <CardFace card={slot.card} visualMode="compact" className="foundry-card-slot__card-face no-twirl" />
          </div>
          <span className="foundry-card-slot__meta-line">{slot.card.name}</span>
          <span className="foundry-card-slot__meta-line foundry-card-slot__meta-line--accent">+{getProcessingAffixBonusPercent(slot.card)}% Speed</span>
        </div>
      ) : (
        <div className="foundry-card-slot__placeholder">
          <span className="foundry-card-slot__placeholder-rune" aria-hidden="true">ᛟ</span>
          <span className="foundry-card-slot__placeholder-text">Drop a pocket card</span>
        </div>
      )}
    </div>
  );
}

function ProcessingInputSlot({
  slot,
  kind = 'primary',
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
  onLoadFromCarry,
  onPickUp,
  carriedResource,
}) {
  const [pickUpPopover, setPickUpPopover] = useState(null);
  const recipe = getProcessingRecipe(slot);
  const isIngredient = kind === 'ingredient';
  const source = isIngredient ? slot.ingredientSource : slot.inputSource;
  const id = isIngredient ? slot.ingredientId : slot.inputId;
  const count = isIngredient ? slot.ingredientCount : slot.inputCount;
  const requiredCount = isIngredient ? recipe?.ingredientCount : recipe?.inputCount;
  const resource = id
    ? (source === 'crafted' ? CRAFTED_RESOURCES_BY_ID[id] : ALL_GATHERING_RESOURCES.find(entry => entry.id === id))
    : null;

  return (
    <>
      <div
        className={`foundry-forge-ore-slot${resource ? ' foundry-forge-ore-slot--filled' : ''}${isDragOver ? ' foundry-forge-ore-slot--drag-over' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPointerDown={e => {
          if (e.button !== 0) return;
          if (['gathered', 'crafted'].includes(carriedResource?.source)) { onLoadFromCarry?.(); return; }
          if (!carriedResource && resource && count > 0) onPickUp?.(source, id, count);
        }}
        onContextMenu={e => {
          e.preventDefault();
          if (!resource || !(count > 0)) return;
          setPickUpPopover({ max: count, position: { x: e.clientX + 10, y: e.clientY + 10 } });
        }}
        data-resource-drop-target="wilderness-processing-input-slot"
        data-processing-slot-id={slot.slotId}
      >
        {resource ? (
          <div className="foundry-forge-ore-slot__placed">
            <button
              className="foundry-forge-ore-slot__clear"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onClear?.(source, id)}
              aria-label={`Remove ${resource.name} from processing slot`}
            >
              ✕
            </button>
            <SquareResourceCard
              resource={resource}
              count={count ?? 0}
              requiredCount={requiredCount ?? null}
              className="foundry-forge-ore-slot__resource wilderness-square-resource"
            />
          </div>
        ) : (
          <div className="foundry-forge-ore-slot__placeholder">
            <span className="foundry-forge-ore-slot__placeholder-rune" aria-hidden="true">⬡</span>
            <span className="foundry-forge-ore-slot__placeholder-text">Place material</span>
          </div>
        )}
      </div>
      <ResourceQuantityPopover
        open={Boolean(pickUpPopover)}
        position={pickUpPopover?.position ?? { x: 0, y: 0 }}
        title={resource ? `Carry ${resource.name}` : 'Carry Material'}
        max={pickUpPopover?.max ?? 0}
        mode="carry"
        onCancel={() => setPickUpPopover(null)}
        onConfirm={amount => {
          onPickUp?.(source, id, amount);
          setPickUpPopover(null);
        }}
      />
    </>
  );
}

function ProcessingBoosterSlot({ slot, onLoadFromCarry, onClear, onPickUp, carriedResource }) {
  const booster = PROCESSING_BOOSTERS[slot?.boosterId] ?? null;
  const resource = booster ? CRAFTED_RESOURCES_BY_ID[booster.id] : null;
  const hasBooster = Boolean(resource && slot?.boosterCount > 0);
  const canLoad = carriedResource?.source === 'crafted' && carriedResource?.id === 'tannin';

  return (
    <div
      className={`foundry-forge-ingredient-slot station-booster-slot${hasBooster ? ' foundry-forge-ingredient-slot--filled station-booster-slot--active' : ''}`}
      onPointerDown={event => {
        if (event.button !== 0) return;
        if (canLoad) { onLoadFromCarry?.(); return; }
        if (!carriedResource && hasBooster) onPickUp?.();
      }}
      onDragOver={event => event.preventDefault()}
      onDrop={event => { event.preventDefault(); onLoadFromCarry?.(); }}
      data-resource-drop-target="wilderness-processing-booster-slot"
      data-processing-slot-id={slot?.slotId}
      aria-label={hasBooster ? `${resource.name}, ${booster.speedPercent}% tanning speed` : 'Place tannin'}
    >
      {hasBooster ? (
        <div className="foundry-forge-ingredient-slot__placed">
          <button
            className="foundry-forge-ingredient-slot__clear"
            onPointerDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); onClear?.(); }}
            aria-label={`Remove ${resource.name}`}
          >
            ✕
          </button>
          <SquareResourceCard
            resource={{
              ...resource,
              description: `${resource.description} +${booster.speedPercent}% tanning speed; one is consumed every ${booster.cyclesPerUnit} completed cycles.`,
            }}
            count={slot.boosterCount}
            className="foundry-forge-ingredient-slot__resource station-booster-slot__resource"
          />
          <span className="station-booster-slot__charges">
            {slot.boosterCharges}/{booster.cyclesPerUnit}
          </span>
        </div>
      ) : (
        <div className="foundry-forge-ingredient-slot__placeholder">
          <span className="foundry-forge-ingredient-slot__placeholder-rune" aria-hidden="true">ᛚ</span>
          <span className="foundry-forge-ingredient-slot__placeholder-text">Tannin</span>
        </div>
      )}
    </div>
  );
}

function ProcessingOutputSlot({ slot, outputQueue, queueGain, tileRef = null }) {
  const queuedEntries = Object.entries(outputQueue ?? {}).filter(([, count]) => count > 0);
  const outputId = queuedEntries[0]?.[0] ?? slot.outputId ?? null;
  const output = outputId ? PROCESSING_OUTPUT_RESOURCES_BY_ID[outputId] : null;
  if (!output) {
    return (
      <div className="foundry-forge-row__output-placeholder">
        <span className="foundry-forge-ore-slot__placeholder-rune" aria-hidden="true">⬢</span>
        <span className="foundry-forge-ore-slot__placeholder-text">Output</span>
      </div>
    );
  }

  return (
    <SquareResourceCard
      tileRef={tileRef}
      resource={output}
      count={queuedEntries.reduce((sum, [, count]) => sum + count, 0)}
      gainLabel={queueGain ? `+ ${queueGain} crafted` : null}
      className="foundry-forge-row__output-card wilderness-square-resource wilderness-square-resource--processed"
    />
  );
}

function ProcessingRow({
  slot,
  now,
  outputQueue,
  queueGain,
  outputTileRef,
  dragOverCardSlotId,
  dragOverInputSlotId,
  setDragOverCardSlotId,
  setDragOverInputSlotId,
  handleCardSlotDrop,
  handleInputSlotDrop,
  onUnsocketCard,
  onUnsocketInput,
  onLoadInput,
  onPickUpInput,
  onLoadBooster,
  onUnsocketBooster,
  onPickUpBooster,
  carriedResource,
  onPreviewEnter,
  onPreviewLeave,
  onCollect,
}) {
  const progress = getProcessingRowProgress(slot, now);
  const running = progress > 0 && progress < 1;
  const recipe = getProcessingRecipe(slot);
  const hasOutput = hasProductionOutput(outputQueue);
  const ready = isProcessingSlotReady(slot);
  const durationSeconds = slot.card
    ? getProcessingDurationSeconds(slot.card, getProcessingBoosterSpeedPercent(slot))
    : null;
  const remainingMs = slot.endsAt ? Math.max(0, slot.endsAt - now) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  /**
   * Which inputs are actually feeding this cycle, keyed by position for the shared connector.
   * Tanner's advanced recipe uses the left ingredient branch; single-material recipes stay centred.
   */
  const stemStates = {
    left: recipe?.ingredientId ? (ready ? 'live' : 'idle') : 'off',
    middle: !recipe ? 'idle' : (ready ? 'live' : 'idle'),
    right: getProcessingBoosterSpeedPercent(slot) > 0 ? 'live' : 'off',
  };

  return (
    <div className={`foundry-forge-row wilderness-processing-row${running ? ' foundry-forge-row--running' : ''}${ready ? ' foundry-forge-row--ready' : ''}`}>
      <div className="foundry-forge-row__panel foundry-forge-row__panel--card">
        <ProcessingCardSlot
          slot={slot}
          isDragOver={dragOverCardSlotId === slot.slotId}
          onDragOver={event => {
            event.preventDefault();
            setDragOverCardSlotId(slot.slotId);
          }}
          onDragLeave={() => setDragOverCardSlotId(current => (current === slot.slotId ? null : current))}
          onDrop={event => handleCardSlotDrop(slot.slotId, event)}
          onClear={() => onUnsocketCard?.(slot.slotId)}
          onPreviewEnter={onPreviewEnter}
          onPreviewLeave={onPreviewLeave}
        />
      </div>

      {/* Input and Output as centred bands on the shared three-column rail, ruled apart — the same
          layout as a forge row. There is no Fuel band: processing burns nothing. */}
      <div className="foundry-forge-row__panel foundry-forge-row__panel--process">
        <div className="foundry-forge-row__cell foundry-forge-row__cell--materials wilderness-processing-row__input">
          <div className="foundry-forge-row__rail foundry-forge-row__smelt-slots">
            <div className={`foundry-forge-row__stem-host foundry-forge-row__stem-host--${stemStates.left}`}>
              {recipe?.ingredientId || slot.ingredientId ? (
                <ProcessingInputSlot
                  slot={slot}
                  kind="ingredient"
                  isDragOver={dragOverInputSlotId === slot.slotId}
                  onDragOver={event => { event.preventDefault(); setDragOverInputSlotId(slot.slotId); }}
                  onDragLeave={() => setDragOverInputSlotId(current => (current === slot.slotId ? null : current))}
                  onDrop={event => handleInputSlotDrop(slot.slotId, event)}
                  onClear={(source, id) => onUnsocketInput?.(slot.slotId, source, id)}
                  onLoadFromCarry={() => onLoadInput?.(slot.slotId)}
                  onPickUp={(source, id, amount) => onPickUpInput?.(slot.slotId, source, id, amount)}
                  carriedResource={carriedResource}
                />
              ) : (
                <div className="foundry-forge-row__aux-slot">
                  <span className="foundry-forge-row__aux-rune" aria-hidden="true">ᚲ</span>
                </div>
              )}
            </div>
            {/* The real slot takes the MIDDLE column, matching the forge putting ore there — the
                primary input belongs on the trunk's own axis. */}
            <div className={`foundry-forge-row__stem-host foundry-forge-row__stem-host--${stemStates.middle}`}>
              <ProcessingInputSlot
                slot={slot}
                isDragOver={dragOverInputSlotId === slot.slotId}
                onDragOver={event => {
                  event.preventDefault();
                  setDragOverInputSlotId(slot.slotId);
                }}
                onDragLeave={() => setDragOverInputSlotId(current => (current === slot.slotId ? null : current))}
                onDrop={event => handleInputSlotDrop(slot.slotId, event)}
                onClear={(source, id) => onUnsocketInput?.(slot.slotId, source, id)}
                onLoadFromCarry={() => onLoadInput?.(slot.slotId)}
                onPickUp={(source, id, amount) => onPickUpInput?.(slot.slotId, source, id, amount)}
                carriedResource={carriedResource}
              />
            </div>
            <div className={`foundry-forge-row__stem-host foundry-forge-row__stem-host--${stemStates.right}`}>
              <ProcessingBoosterSlot
                slot={slot}
                onLoadFromCarry={() => onLoadBooster?.(slot.slotId)}
                onClear={() => onUnsocketBooster?.(slot.slotId)}
                onPickUp={() => onPickUpBooster?.(slot.slotId)}
                carriedResource={carriedResource}
              />
            </div>
          </div>

          <StationMerge progress={progress} running={running} ready={ready} stems={stemStates} />

          {/* The forge shows remaining time on its fuel ring. Processing has no fuel box, so the
              countdown would otherwise only exist in a tooltip. */}
          <p className="wilderness-processing-row__status">
            {running && durationSeconds
              ? `${formatCountdown(remainingSeconds)} remaining`
              : ready
                ? 'Ready to process'
                : slot.card
                  ? 'Load a material'
                  : 'Socket a card'}
          </p>
        </div>

        <div className="foundry-forge-row__rule" aria-hidden="true" />

        <div className="foundry-forge-row__cell foundry-forge-row__cell--output">
          <div className="foundry-forge-row__rail foundry-forge-row__rail--single">
            <ProcessingOutputSlot
              slot={slot}
              outputQueue={outputQueue}
              queueGain={queueGain}
              tileRef={outputTileRef}
            />
            <button
              className="foundry-collect-btn foundry-collect-btn--row"
              disabled={!hasOutput}
              onClick={onCollect}
            >
              Collect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Wilderness({
  pocket = [],
  processedInventory = {},
  gatheringSlots = [],
  gatheringClaimQueue = {},
  gatheringRewardQueue = {},
  gatheringLootStages = [],
  processingSlots = [],
  processingOutputQueues = {},
  processingRewardQueue = {},
  returnsGatheringCardsToPocket = true,
  returnsProcessingCardsToPocket = true,
  collectTargetRef = null,
  summonTargetRef = null,
  onSocketGatheringCard,
  onUnsocketGatheringCard,
  onCollectGatheredResources,
  onSocketProcessingCard,
  onUnsocketProcessingCard,
  onLoadProcessingInput,
  onUnsocketProcessingInput,
  onPickUpProcessingInput,
  onLoadProcessingBooster,
  onUnsocketProcessingBooster,
  onPickUpProcessingBooster,
  onCollectProcessedOutput,
  onCollectProcessingRewards,
  onSocketGatheringTool,
  onUnsocketGatheringTool,
  carriedResource = null,
  onPlaceCarriedResource,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [dragOverSlotId, setDragOverSlotId] = useState(null);
  const [dragOverProcessingCardSlotId, setDragOverProcessingCardSlotId] = useState(null);
  const [dragOverProcessingInputSlotId, setDragOverProcessingInputSlotId] = useState(null);
  const [queueGainByResource, setQueueGainByResource] = useState({});
  const [queueGainByProcessingOutput, setQueueGainByProcessingOutput] = useState({});
  const [queueGainByGatheringReward, setQueueGainByGatheringReward] = useState({});
  const [queueGainByProcessingReward, setQueueGainByProcessingReward] = useState({});
  const [hoverPreview, setHoverPreview] = useState(null);
  /** Which processing bench is shown. Not persisted, and nothing auto-follows it — see the Forge. */
  const [activeProcessing, setActiveProcessing] = useState(0);
  const previousQueueRef = useRef(gatheringClaimQueue);
  const previousProcessingOutputQueuesRef = useRef(processingOutputQueues);
  const previousGatheringRewardQueueRef = useRef(gatheringRewardQueue);
  const previousProcessingRewardQueueRef = useRef(processingRewardQueue);
  const queueTileRefs = useRef({});
  const processedOutputRefs = useRef({});
  const gatheringRewardRefs = useRef({});
  const processingRewardRefs = useRef({});
  const treasurePackRefs = useRef({});
  const gatheringStageTargetRef = useRef(null);
  const flyGhostsRef = useRef([]);
  const collectTimeoutRef = useRef(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (collectTimeoutRef.current) window.clearTimeout(collectTimeoutRef.current);
    clearLootFlightGhosts(flyGhostsRef.current);
  }, []);

  useEffect(() => {
    const previousQueue = previousQueueRef.current ?? {};
    const nextGains = {};

    for (const resource of ALL_GATHERING_RESOURCES) {
      const currentCount = gatheringClaimQueue[resource.id] ?? 0;
      const previousCount = previousQueue[resource.id] ?? 0;
      if (currentCount > previousCount) nextGains[resource.id] = currentCount - previousCount;
    }

    previousQueueRef.current = gatheringClaimQueue;
    if (Object.keys(nextGains).length === 0) return;

    setQueueGainByResource(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByResource(prev => {
        const next = { ...prev };
        for (const resourceId of Object.keys(nextGains)) delete next[resourceId];
        return next;
      });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [gatheringClaimQueue]);

  useEffect(() => {
    const previousQueue = previousGatheringRewardQueueRef.current ?? {};
    const nextGains = {};

    for (const entry of buildBonusRewardEntries(gatheringRewardQueue)) {
      const currentCount = gatheringRewardQueue[entry.id] ?? 0;
      const previousCount = previousQueue[entry.id] ?? 0;
      if (currentCount > previousCount) nextGains[entry.id] = currentCount - previousCount;
    }

    previousGatheringRewardQueueRef.current = gatheringRewardQueue;
    if (Object.keys(nextGains).length === 0) return;

    setQueueGainByGatheringReward(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByGatheringReward(prev => {
        const next = { ...prev };
        for (const resourceId of Object.keys(nextGains)) delete next[resourceId];
        return next;
      });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [gatheringRewardQueue]);

  useEffect(() => {
    const previousQueues = previousProcessingOutputQueuesRef.current ?? {};
    const nextGains = {};

    Object.entries(processingOutputQueues).forEach(([slotId, outputs]) => {
      const previousOutputs = previousQueues[slotId] ?? {};
      const gained = Object.entries(outputs ?? {}).reduce((sum, [outputId, count]) => (
        sum + Math.max(0, count - (previousOutputs[outputId] ?? 0))
      ), 0);
      if (gained > 0) nextGains[slotId] = gained;
    });

    previousProcessingOutputQueuesRef.current = processingOutputQueues;
    if (Object.keys(nextGains).length === 0) return;

    setQueueGainByProcessingOutput(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByProcessingOutput(prev => {
        const next = { ...prev };
        for (const slotId of Object.keys(nextGains)) delete next[slotId];
        return next;
      });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [processingOutputQueues]);

  useEffect(() => {
    const previousQueue = previousProcessingRewardQueueRef.current ?? {};
    const nextGains = {};

    for (const entry of buildBonusRewardEntries(processingRewardQueue)) {
      const currentCount = processingRewardQueue[entry.id] ?? 0;
      const previousCount = previousQueue[entry.id] ?? 0;
      if (currentCount > previousCount) nextGains[entry.id] = currentCount - previousCount;
    }

    previousProcessingRewardQueueRef.current = processingRewardQueue;
    if (Object.keys(nextGains).length === 0) return;

    setQueueGainByProcessingReward(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByProcessingReward(prev => {
        const next = { ...prev };
        for (const resourceId of Object.keys(nextGains)) delete next[resourceId];
        return next;
      });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [processingRewardQueue]);

  const dividerGlyphs = useMemo(
    () => Array.from({ length: DIVIDER_RUNES.length * DIVIDER_REPEAT }, (_, i) => DIVIDER_RUNES[i % DIVIDER_RUNES.length]),
    [],
  );
  const gatheringRewardEntries = useMemo(() => buildBonusRewardEntries(gatheringRewardQueue), [gatheringRewardQueue]);
  const processingRewardEntries = useMemo(() => buildBonusRewardEntries(processingRewardQueue), [processingRewardQueue]);

  // Resources to show in the queue section: only items with a non-zero queued count.
  const queueResources = useMemo(() => {
    return ALL_GATHERING_RESOURCES.filter(r => r.id !== TREASURE_PACK_RESOURCE.id && (gatheringClaimQueue[r.id] ?? 0) > 0);
  }, [gatheringClaimQueue]);
  const queuedTreasurePacks = gatheringClaimQueue[TREASURE_PACK_RESOURCE.id] ?? 0;

  const gatheringRunningCount = gatheringSlots.filter(slot => slot.card && slot.startedAt).length;
  const queueHasResources = hasQueuedGatheredResources(gatheringClaimQueue) || hasQueuedBonusRewards(gatheringRewardQueue);
  const processingRunningCount = processingSlots.filter(slot => slot.card && slot.startedAt).length;
  /**
   * Every processing row's state, for the selector. Derived here rather than inside `ProcessingRow`
   * because the two rows the selector HIDES still have to report themselves on their tabs — the same
   * reasoning as the Forge's `forgeStatuses`, and as the nav's loot diamond before it.
   */
  const processingStatuses = processingSlots.map(slot => {
    const progress = getProcessingRowProgress(slot, now);
    const hasCard = Boolean(slot.card);
    const inputOk = isProcessingSlotReady(slot);
    return {
      progress,
      running: progress > 0 && progress < 1,
      ready: hasCard && inputOk,
      hasCard,
      hasOutput: hasProductionOutput(processingOutputQueues[String(slot.slotId)] ?? {}),
      needs: !hasCard ? 'card' : !inputOk ? 'material' : null,
    };
  });
  const activeProcessingIndex = Math.min(activeProcessing, Math.max(0, processingSlots.length - 1));
  const activeProcessingSlot = processingSlots[activeProcessingIndex] ?? null;
  const queueHasProcessingRewards = hasQueuedBonusRewards(processingRewardQueue);

  function handleGatheringSlotDrop(slotId, event) {
    event.preventDefault();
    setDragOverSlotId(null);
    const cardId = event.dataTransfer.getData('text/plain') || event.dataTransfer.getData('card-id');
    if (!cardId || typeof onSocketGatheringCard !== 'function') return;
    onSocketGatheringCard(cardId, slotId);
  }

  function handleCollectGathered() {
    if (typeof onCollectGatheredResources !== 'function' || !queueHasResources || flyGhostsRef.current.length > 0) return;
    // Played on the press, not in the App callback that runs when the fly animation lands.
    // That callback is behind a 600ms timer here (and 750ms + 70ms per item in Wilderness),
    // which is exactly the 1-2 second lag this was reported as: the sound was correct, it was
    // just waiting for an animation.
    audioEngine.play(SOUND_IDS.rewardClaim);
    const inventoryTarget = collectTargetRef?.current ?? null;
    const summonTarget = summonTargetRef?.current ?? null;
    const animateGroup = (elements, targetEl, startIndex = 0) => {
      if (!targetEl) return startIndex;
      const targetRect = targetEl.getBoundingClientRect();
      const tx = targetRect.left + targetRect.width / 2;
      const ty = targetRect.top + targetRect.height / 2;
      let index = startIndex;
      elements.forEach(el => {
        if (!el) return;
        const flight = flyLootElement(el, { x: tx, y: ty, index });
        if (flight) {
          flyGhostsRef.current.push(flight);
          index++;
        }
      });
      return index;
    };

    if (inventoryTarget || summonTarget) {
      const inventoryElements = [
        ...Object.values(queueTileRefs.current),
        ...Object.values(gatheringRewardRefs.current),
      ].filter(Boolean);
      const treasureElements = Object.values(treasurePackRefs.current).filter(Boolean);
      let count = animateGroup(inventoryElements, inventoryTarget, 0);
      count = animateGroup(treasureElements, summonTarget, count);
      collectTimeoutRef.current = window.setTimeout(() => {
        collectTimeoutRef.current = null;
        onCollectGatheredResources();
        clearLootFlightGhosts(flyGhostsRef.current);
      }, 750 + count * 70);
    } else {
      onCollectGatheredResources();
    }
  }

  function handleProcessingCardSlotDrop(slotId, event) {
    event.preventDefault();
    setDragOverProcessingCardSlotId(null);
    const cardId = event.dataTransfer.getData('text/plain') || event.dataTransfer.getData('card-id');
    if (!cardId || typeof onSocketProcessingCard !== 'function') return;
    onSocketProcessingCard(cardId, slotId);
  }

  function handleProcessingInputSlotDrop(slotId, event) {
    event.preventDefault();
    setDragOverProcessingInputSlotId(null);
    if (!['gathered', 'crafted'].includes(carriedResource?.source) || typeof onLoadProcessingInput !== 'function') return;
    onLoadProcessingInput(slotId);
  }

  function flyElementsToCollectTarget(elements) {
    const targetEl = collectTargetRef?.current ?? null;
    if (!targetEl) return 0;
    const targetRect = targetEl.getBoundingClientRect();
    const tx = targetRect.left + targetRect.width / 2;
    const ty = targetRect.top + targetRect.height / 2;
    let count = 0;
    elements.forEach(el => {
      if (!el) return;
      const flight = flyLootElement(el, { x: tx, y: ty, index: count });
      if (flight) {
        flyGhostsRef.current.push(flight);
        count++;
      }
    });
    return count;
  }

  function handleCollectProcessedOutput(slotId) {
    const outputQueue = processingOutputQueues[String(slotId)] ?? {};
    if (typeof onCollectProcessedOutput !== 'function' || !hasProductionOutput(outputQueue) || flyGhostsRef.current.length > 0) return;
    audioEngine.play(SOUND_IDS.rewardClaim);
    const count = flyElementsToCollectTarget([processedOutputRefs.current[String(slotId)]]);
    if (count > 0) {
      collectTimeoutRef.current = window.setTimeout(() => {
        collectTimeoutRef.current = null;
        onCollectProcessedOutput(slotId);
        clearLootFlightGhosts(flyGhostsRef.current);
      }, 750 + count * 70);
    } else {
      onCollectProcessedOutput(slotId);
    }
  }

  function handleCollectProcessingRewards() {
    if (typeof onCollectProcessingRewards !== 'function' || !queueHasProcessingRewards || flyGhostsRef.current.length > 0) return;
    audioEngine.play(SOUND_IDS.rewardClaim);
    const elements = Object.entries(processingRewardRefs.current)
      .filter(([id, el]) => (processingRewardQueue[id] ?? 0) > 0 && el)
      .map(([, el]) => el);
    const count = flyElementsToCollectTarget(elements);
    if (count > 0) {
      collectTimeoutRef.current = window.setTimeout(() => {
        collectTimeoutRef.current = null;
        onCollectProcessingRewards();
        clearLootFlightGhosts(flyGhostsRef.current);
      }, 750 + count * 70);
    } else {
      onCollectProcessingRewards();
    }
  }

  return (
    <div className="wilderness-page">
      <HoverCardPreview preview={hoverPreview} />
      {/* No page title — see the matching note in Foundry.jsx. The tab bar names the page and each half
          has its own heading, so this was the third label saying the same thing. */}

      <div className="wilderness-layout">
        <div className="wilderness-main">
          <div className="wilderness-split">
            <section className="foundry-half wilderness-half wilderness-half--gathering">
              <header className="foundry-half__header wilderness-half__header">
                <h3 className="foundry-half__title">Gathering</h3>
                <p className="foundry-half__label">
                  Drag pocketed cards into open slots. Gathering starts immediately and cycles every minute.
                </p>
              </header>

              <div className="foundry-mine-slots wilderness-mine-slots">
                {gatheringSlots.map(slot => (
                  <GatheringSlot
                    key={slot.slotId}
                    slot={slot}
                    stagedLoot={gatheringLootStages.filter(event => event.slotId === slot.slotId)}
                    stageTargetRef={gatheringStageTargetRef}
                    now={now}
                    isDragOver={dragOverSlotId === slot.slotId}
                    onDragOver={event => {
                      event.preventDefault();
                      setDragOverSlotId(slot.slotId);
                    }}
                    onDragLeave={() => setDragOverSlotId(current => (current === slot.slotId ? null : current))}
                    onDrop={event => handleGatheringSlotDrop(slot.slotId, event)}
                    onClear={() => typeof onUnsocketGatheringCard === 'function' && onUnsocketGatheringCard(slot.slotId)}
                    returnsToPocket={returnsGatheringCardsToPocket}
                    onPreviewEnter={(element, card) => setHoverPreview(buildHoverCardPreview(element, card))}
                    onPreviewLeave={card => setHoverPreview(current => (current?.card?.id === card?.id ? null : current))}
                    onSocketTool={toolId => onSocketGatheringTool?.(toolId, slot.slotId)}
                    onUnsocketTool={() => onUnsocketGatheringTool?.(slot.slotId)}
                  />
                ))}
              </div>

              {/* Only while nothing is gathering. "3 slots gathering" restated what the slots themselves
                  show — a card in a slot with a spinning dial is not ambiguous — and it cost a row in the
                  half with the least room, at exactly the moment loot exists to display. The empty-state
                  instruction stays, because that one is not inferable from an empty slot. */}
              {gatheringRunningCount === 0 && (
                <div className="foundry-action-row wilderness-action-row">
                  <p className="foundry-action-hint wilderness-action-hint">
                    {pocket.length > 0
                      ? 'Drag a card from Pocket into an open gathering slot'
                      : 'Pocket a card first, then socket it here'}
                  </p>
                </div>
              )}

              <div ref={gatheringStageTargetRef} className="foundry-queue wilderness-queue">
                <div className="foundry-inventory__head">
                  <p className="foundry-inventory__label">Collection Queue</p>
                  <button
                    className="foundry-collect-btn wilderness-collect-btn"
                    disabled={!queueHasResources}
                    onClick={handleCollectGathered}
                  >
                    Collect
                  </button>
                </div>
                {/* Counted from exactly what renders below: the treasure-pack tile, the drop pool, and the
                    bonus rewards. See `.stack-line` for why the count has to come from React. */}
                <div
                  className="foundry-queue-slots wilderness-queue-slots stack-line"
                  style={{ '--stack-gaps': Math.max(1,
                    (queuedTreasurePacks > 0 ? 1 : 0) + queueResources.length + gatheringRewardEntries.length - 1) }}
                >
                  {/* A loot tile like everything else beside it, not a miniature pack. It sits in a row of
                      resource cards, and rendering it as a pack made it the odd one out at a different size
                      and shape — and it also has to fit the stacked row's 72px box. It is still a real pack
                      once claimed; this is only how the pending reward is drawn. */}
                  {queuedTreasurePacks > 0 ? (
                    <SquareResourceCard
                      resource={TREASURE_PACK_RESOURCE}
                      count={queuedTreasurePacks}
                      gainLabel={queueGainByResource[TREASURE_PACK_RESOURCE.id] ? `+ ${queueGainByResource[TREASURE_PACK_RESOURCE.id]} pack` : null}
                      tileRef={el => { treasurePackRefs.current[TREASURE_PACK_RESOURCE.id] = el; }}
                      className="foundry-queue-slot wilderness-queue-slot"
                    />
                  ) : null}
                  {queueResources.length > 0 ? queueResources.map(resource => (
                    <SquareResourceCard
                      key={`queued-${resource.id}`}
                      resource={resource}
                      count={gatheringClaimQueue[resource.id] ?? 0}
                      gainLabel={queueGainByResource[resource.id] ? `+ ${queueGainByResource[resource.id]} ${resource.name.toLowerCase()}` : null}
                      tileRef={el => { queueTileRefs.current[resource.id] = el; }}
                      className="foundry-queue-slot wilderness-queue-slot"
                    />
                  )) : null}
                  {gatheringRewardEntries.map(entry => (
                    <SquareResourceCard
                      key={`queued-bonus-${entry.id}`}
                      resource={{ name: entry.name, artKey: entry.artKey, description: entry.description }}
                      count={entry.count}
                      gainLabel={queueGainByGatheringReward[entry.id] ? `+ ${queueGainByGatheringReward[entry.id]} ${entry.gainNoun}` : null}
                      tileRef={el => { gatheringRewardRefs.current[entry.id] = el; }}
                      className="foundry-queue-slot wilderness-queue-slot"
                    />
                  ))}
                  {queueResources.length === 0 && gatheringRewardEntries.length === 0 ? (
                    <p className="foundry-action-hint wilderness-action-hint" style={{ fontSize: '0.78rem', opacity: 0.5 }}>
                      Socket a card to see its drop pool here
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <div className="foundry-divider wilderness-divider" aria-hidden="true">
              <span className="foundry-divider__header-rune">ᛞ</span>
              <div className="foundry-divider__rune-column">
                {dividerGlyphs.map((glyph, index) => (
                  <span key={`wilderness-divider-${index}`} className="foundry-divider-rune">
                    {glyph}
                  </span>
                ))}
              </div>
            </div>

            <section className="foundry-half wilderness-half wilderness-half--processing">
              <header className="foundry-half__header wilderness-half__header">
                <h3 className="foundry-half__title">Processing</h3>
                {/* Summary in the header rather than an action row under the rows — that row cost 32px of
                    a half with none to spare, and the selector says it per row. */}
                <p className={`foundry-half__label${processingRunningCount === 0 ? ' foundry-half__label--warn' : ''}`}>
                  {processingRunningCount > 0
                    ? `${processingRunningCount} of ${processingSlots.length} benches active · pick a bench below`
                    : 'Socket a card and load gathered materials to refine them.'}
                </p>
              </header>

              {/* Same selector as the Forge, and for the same reason: these rows share the forge's
                  layout, so they share its height problem — 1066px of inner scroll at 1366x768. The
                  tabs carry each row's state because the two they hide would otherwise go dark. */}
              <div className="forge-selector" role="tablist" aria-label="Processing rows">
                {processingSlots.map((slot, index) => {
                  const status = processingStatuses[index];
                  const active = index === activeProcessingIndex;
                  const state = status.running ? 'running'
                    : status.ready ? 'ready'
                      : status.hasCard ? 'waiting' : 'empty';
                  return (
                    <button
                      key={`processing-tab-${slot.slotId}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`forge-selector__tab forge-selector__tab--${state}${active ? ' forge-selector__tab--active' : ''}`}
                      onClick={() => setActiveProcessing(index)}
                      title={
                        status.running ? `Processing — ${Math.round(status.progress * 100)}%`
                          : status.ready ? 'Ready to process'
                            : status.needs === 'card' ? 'Empty — socket a card'
                              : `Waiting for ${status.needs}`
                      }
                    >
                      <span className="forge-selector__name">
                        {PROCESSING_ROW_LABELS[index] ?? `Bench ${index + 1}`}
                      </span>
                      <span className="forge-selector__state">
                        {status.running ? `${Math.round(status.progress * 100)}%`
                          : status.ready ? 'Ready'
                            : status.needs === 'card' ? 'Empty'
                              : `Needs ${status.needs}`}
                      </span>
                      {status.running ? (
                        <span
                          className="forge-selector__fill"
                          style={{ '--forge-tab-progress': status.progress }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {status.hasOutput ? <span className="forge-selector__loot" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="foundry-forge-rows wilderness-processing-rows">
                {activeProcessingSlot ? (
                  <ProcessingRow
                    key={`processing-row-${activeProcessingSlot.slotId}`}
                    slot={activeProcessingSlot}
                    now={now}
                    outputQueue={processingOutputQueues[String(activeProcessingSlot.slotId)] ?? {}}
                    queueGain={queueGainByProcessingOutput[String(activeProcessingSlot.slotId)] ?? 0}
                    outputTileRef={el => { processedOutputRefs.current[String(activeProcessingSlot.slotId)] = el; }}
                    dragOverCardSlotId={dragOverProcessingCardSlotId}
                    dragOverInputSlotId={dragOverProcessingInputSlotId}
                    setDragOverCardSlotId={setDragOverProcessingCardSlotId}
                    setDragOverInputSlotId={setDragOverProcessingInputSlotId}
                    handleCardSlotDrop={handleProcessingCardSlotDrop}
                    handleInputSlotDrop={handleProcessingInputSlotDrop}
                    onUnsocketCard={onUnsocketProcessingCard}
                    onUnsocketInput={onUnsocketProcessingInput}
                    onLoadInput={onLoadProcessingInput}
                    onPickUpInput={onPickUpProcessingInput}
                    onLoadBooster={onLoadProcessingBooster}
                    onUnsocketBooster={onUnsocketProcessingBooster}
                    onPickUpBooster={onPickUpProcessingBooster}
                    carriedResource={carriedResource}
                    onPreviewEnter={(element, card) => setHoverPreview(buildHoverCardPreview(element, card))}
                    onPreviewLeave={card => setHoverPreview(current => (current?.card?.id === card?.id ? null : current))}
                    onCollect={() => handleCollectProcessedOutput(activeProcessingSlot.slotId)}
                  />
                ) : null}
              </div>

              {processingRewardEntries.length > 0 ? (
                <div className="foundry-queue wilderness-queue wilderness-queue--processing-bonus">
                  <div className="foundry-inventory__head">
                    <p className="foundry-inventory__label">Bonus Queue</p>
                    <button
                      className="foundry-collect-btn wilderness-collect-btn"
                      disabled={!queueHasProcessingRewards}
                      onClick={handleCollectProcessingRewards}
                    >
                      Collect
                    </button>
                  </div>
                  <div
                    className="foundry-queue-slots wilderness-queue-slots stack-line"
                    style={{ '--stack-gaps': Math.max(1, processingRewardEntries.length - 1) }}
                  >
                    {processingRewardEntries.map(entry => (
                      <SquareResourceCard
                        key={`processing-bonus-${entry.id}`}
                        resource={{ id: entry.id, name: entry.name, artKey: entry.artKey, description: entry.description, tier: entry.tier }}
                        count={entry.count}
                        gainLabel={queueGainByProcessingReward[entry.id] ? `+ ${queueGainByProcessingReward[entry.id]} ${entry.gainNoun}` : null}
                        tileRef={el => { processingRewardRefs.current[entry.id] = el; }}
                        className="foundry-queue-slot wilderness-queue-slot"
                      />
                    ))}
                  </div>
                </div>
              ) : null}

            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
