import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from '../game/audio/audioEngine';
import { SOUND_IDS } from '../game/audio/audioLibrary';
import { createPortal } from 'react-dom';

import CardFace from './CardFace';
import { socketedCardDragProps } from './CardPocket';
import StationMerge from './StationMerge';
import HoverCardPreview, { buildHoverCardPreview } from './HoverCardPreview';
import ResourceQuantityPopover from './ResourceQuantityPopover';
import { ESSENCES_BY_ID, getElementResourceDescription, parseElementResourceId } from '../game/arcana';
import {
  ALL_GATHERING_RESOURCES,
  PROCESSING_SLOT_COUNT,
  PROCESSING_RECIPES,
  PROCESSED_RESOURCES_BY_ID,
  TREASURE_PACK_RESOURCE,
  getGatheringAffixBonusPercent,
  getGatheringDurationSeconds,
  getProcessingAffixBonusPercent,
  getProcessingDurationSeconds,
  hasQueuedGatheredResources,
  hasQueuedProcessedResources,
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
      gainNoun: 'coins',
    });
  }

  Object.entries(queue).forEach(([resourceId, count]) => {
    if (resourceId === 'coins' || !(count > 0)) return;
    const { elementId, tier } = parseElementResourceId(resourceId);
    const baseName = ESSENCES_BY_ID[elementId]?.name?.replace(/\s+Essence$/i, '') ?? elementId;
    const labelTier = tier.charAt(0).toUpperCase() + tier.slice(1);
    entries.push({
      id: resourceId,
      name: `${baseName} ${labelTier}`,
      artKey: `${elementId} ${tier}`,
      description: getElementResourceDescription(resourceId),
      count,
      gainNoun: labelTier.toLowerCase(),
    });
  });

  return entries;
}

function SquareResourceCard({ resource, count = 0, className = '', tileRef = null, gainLabel = null, onContextMenu = null, onClick = null, dataDropTarget = null }) {
  const artSrc = getResourceArt(resource);
  const name = typeof resource === 'string' ? resource : resource.name;
  const description = typeof resource === 'object' ? (resource.description ?? '') : '';
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
            <div className="foundry-square-resource__header foundry-square-resource__header--count-only">
              <span className="foundry-square-resource__count">{fmtCount(count)}</span>
            </div>
            <div className="foundry-square-resource__art-wrap">
              {artSrc ? <img src={artSrc} alt={name} className="foundry-square-resource__art" /> : null}
            </div>
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
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
  returnsToPocket,
  now,
  onPreviewEnter,
  onPreviewLeave,
}) {
  const remainingMs = slot.endsAt ? Math.max(0, slot.endsAt - now) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const running = Boolean(slot.startedAt && slot.endsAt && remainingMs > 0);
  const bonusPercent = slot.card ? getGatheringAffixBonusPercent(slot.card) : 0;
  const durationSeconds = slot.card ? getGatheringDurationSeconds(slot.card) : null;
  const progress = running && durationSeconds ? Math.max(0, Math.min(1, remainingMs / (durationSeconds * 1000))) : 0;
  const clearTitle = returnsToPocket ? 'Remove and return to pocket' : 'Remove and return to collection';

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
              className={`foundry-mine-slot__timer${running ? ' foundry-mine-slot__timer--running' : ''}`}
              style={{ '--mine-progress': progress }}
              aria-hidden="true"
              title={running ? `${formatCountdown(remainingSeconds)} remaining` : 'Cycle ready'}
            >
              <span className="foundry-mine-slot__timer-core" />
            </div>
            <div className="foundry-mine-slot__meta">
              <span className="foundry-mine-slot__meta-line foundry-mine-slot__meta-line--accent">
                +{bonusPercent}% Speed
              </span>
            </div>
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
  const resource = slot.inputId ? ALL_GATHERING_RESOURCES.find(entry => entry.id === slot.inputId) : null;

  return (
    <>
      <div
        className={`foundry-forge-ore-slot${resource ? ' foundry-forge-ore-slot--filled' : ''}${isDragOver ? ' foundry-forge-ore-slot--drag-over' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPointerDown={e => {
          if (e.button !== 0) return;
          if (carriedResource?.source === 'gathered') { onLoadFromCarry?.(); return; }
          if (!carriedResource && resource && (slot.inputCount ?? 0) > 0) onPickUp?.(slot.inputCount);
        }}
        onContextMenu={e => {
          e.preventDefault();
          if (!resource || !(slot.inputCount > 0)) return;
          setPickUpPopover({ max: slot.inputCount, position: { x: e.clientX + 10, y: e.clientY + 10 } });
        }}
        data-resource-drop-target="wilderness-processing-input-slot"
        data-processing-slot-id={slot.slotId}
      >
        {resource ? (
          <div className="foundry-forge-ore-slot__placed">
            <button
              className="foundry-forge-ore-slot__clear"
              onPointerDown={e => e.stopPropagation()}
              onClick={onClear}
              aria-label={`Remove ${resource.name} from processing slot`}
            >
              ✕
            </button>
            <SquareResourceCard
              resource={resource}
              count={slot.inputCount ?? 0}
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
          onPickUp?.(amount);
          setPickUpPopover(null);
        }}
      />
    </>
  );
}

function ProcessingOutputSlot({ slot, processedClaimQueue, queueGainByProcessed, tileRef = null }) {
  const output = slot.outputId ? PROCESSED_RESOURCES_BY_ID[slot.outputId] : null;
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
      count={processedClaimQueue[output.id] ?? 0}
      gainLabel={queueGainByProcessed[output.id] ? `+ ${queueGainByProcessed[output.id]} crafted` : null}
      className="foundry-forge-row__output-card wilderness-square-resource wilderness-square-resource--processed"
    />
  );
}

function ProcessingRow({
  slot,
  now,
  processedClaimQueue,
  queueGainByProcessed,
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
  carriedResource,
  onPreviewEnter,
  onPreviewLeave,
  onCollect,
}) {
  const progress = getProcessingRowProgress(slot, now);
  const running = progress > 0 && progress < 1;
  const recipe = slot.inputId ? PROCESSING_RECIPES[slot.inputId] : null;
  const hasOutput = slot.outputId ? (processedClaimQueue[slot.outputId] ?? 0) > 0 : false;
  const ready = Boolean(slot.card && recipe && (slot.inputCount ?? 0) >= recipe.inputCount);
  const durationSeconds = slot.card ? getProcessingDurationSeconds(slot.card) : null;
  const remainingMs = slot.endsAt ? Math.max(0, slot.endsAt - now) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  /**
   * Which inputs are actually feeding this cycle, keyed by position for the shared connector.
   * Processing takes ONE material, so the middle stem is the only live one — the two aux slots are
   * placeholders for a feature that does not exist yet and stay dark.
   */
  const stemStates = {
    left: 'off',
    middle: !recipe ? 'idle' : (ready ? 'live' : 'idle'),
    right: 'off',
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
              <div className="foundry-forge-row__aux-slot">
                <span className="foundry-forge-row__aux-rune" aria-hidden="true">ᚲ</span>
              </div>
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
                onClear={() => onUnsocketInput?.(slot.slotId)}
                onLoadFromCarry={() => onLoadInput?.(slot.slotId)}
                onPickUp={amount => onPickUpInput?.(slot.slotId, amount)}
                carriedResource={carriedResource}
              />
            </div>
            <div className={`foundry-forge-row__stem-host foundry-forge-row__stem-host--${stemStates.right}`}>
              <div className="foundry-forge-row__aux-slot">
                <span className="foundry-forge-row__aux-rune" aria-hidden="true">ᛚ</span>
              </div>
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
              processedClaimQueue={processedClaimQueue}
              queueGainByProcessed={queueGainByProcessed}
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
  processingSlots = [],
  processedClaimQueue = {},
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
  onCollectProcessedResources,
  carriedResource = null,
  onPlaceCarriedResource,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [dragOverSlotId, setDragOverSlotId] = useState(null);
  const [dragOverProcessingCardSlotId, setDragOverProcessingCardSlotId] = useState(null);
  const [dragOverProcessingInputSlotId, setDragOverProcessingInputSlotId] = useState(null);
  const [queueGainByResource, setQueueGainByResource] = useState({});
  const [queueGainByProcessed, setQueueGainByProcessed] = useState({});
  const [queueGainByGatheringReward, setQueueGainByGatheringReward] = useState({});
  const [queueGainByProcessingReward, setQueueGainByProcessingReward] = useState({});
  const [hoverPreview, setHoverPreview] = useState(null);
  /** Which processing bench is shown. Not persisted, and nothing auto-follows it — see the Forge. */
  const [activeProcessing, setActiveProcessing] = useState(0);
  const previousQueueRef = useRef(gatheringClaimQueue);
  const previousProcessedQueueRef = useRef(processedClaimQueue);
  const previousGatheringRewardQueueRef = useRef(gatheringRewardQueue);
  const previousProcessingRewardQueueRef = useRef(processingRewardQueue);
  const queueTileRefs = useRef({});
  const processedOutputRefs = useRef({});
  const gatheringRewardRefs = useRef({});
  const processingRewardRefs = useRef({});
  const treasurePackRefs = useRef({});

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
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
    const previousQueue = previousProcessedQueueRef.current ?? {};
    const nextGains = {};

    for (const resourceId of Object.keys(PROCESSED_RESOURCES_BY_ID)) {
      const currentCount = processedClaimQueue[resourceId] ?? 0;
      const previousCount = previousQueue[resourceId] ?? 0;
      if (currentCount > previousCount) nextGains[resourceId] = currentCount - previousCount;
    }

    previousProcessedQueueRef.current = processedClaimQueue;
    if (Object.keys(nextGains).length === 0) return;

    setQueueGainByProcessed(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByProcessed(prev => {
        const next = { ...prev };
        for (const resourceId of Object.keys(nextGains)) delete next[resourceId];
        return next;
      });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [processedClaimQueue]);

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
    const recipe = slot.inputId ? PROCESSING_RECIPES[slot.inputId] : null;
    const progress = getProcessingRowProgress(slot, now);
    const hasCard = Boolean(slot.card);
    const inputOk = Boolean(recipe) && (slot.inputCount ?? 0) >= recipe.inputCount;
    return {
      progress,
      running: progress > 0 && progress < 1,
      ready: hasCard && inputOk,
      hasCard,
      hasOutput: slot.outputId ? (processedClaimQueue[slot.outputId] ?? 0) > 0 : false,
      needs: !hasCard ? 'card' : !inputOk ? 'material' : null,
    };
  });
  const activeProcessingIndex = Math.min(activeProcessing, Math.max(0, processingSlots.length - 1));
  const activeProcessingSlot = processingSlots[activeProcessingIndex] ?? null;
  const queueHasProcessed = hasQueuedProcessedResources(processedClaimQueue) || hasQueuedBonusRewards(processingRewardQueue);

  function handleGatheringSlotDrop(slotId, event) {
    event.preventDefault();
    setDragOverSlotId(null);
    const cardId = event.dataTransfer.getData('text/plain') || event.dataTransfer.getData('card-id');
    if (!cardId || typeof onSocketGatheringCard !== 'function') return;
    onSocketGatheringCard(cardId, slotId);
  }

  function handleCollectGathered() {
    if (typeof onCollectGatheredResources !== 'function' || !queueHasResources) return;
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
        el.style.animation = 'none';
        const rect = el.getBoundingClientRect();
        el.style.position = 'fixed';
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
        el.style.margin = '0';
        el.style.zIndex = '9999';
        el.getBoundingClientRect();
        const dx = tx - (rect.left + rect.width / 2);
        const dy = ty - (rect.top + rect.height / 2);
        el.style.transition = `transform 0.5s ease ${index * 0.07}s, opacity 0.4s ease ${index * 0.07 + 0.1}s`;
        el.style.transform = `translate(${dx}px, ${dy}px) scale(0.05)`;
        el.style.opacity = '0';
        index++;
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
      window.setTimeout(onCollectGatheredResources, 750 + count * 70);
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
    if (carriedResource?.source !== 'gathered' || typeof onLoadProcessingInput !== 'function') return;
    onLoadProcessingInput(slotId);
  }

  function handleCollectProcessed() {
    if (typeof onCollectProcessedResources !== 'function' || !queueHasProcessed) return;
    audioEngine.play(SOUND_IDS.rewardClaim);
    const targetEl = collectTargetRef?.current ?? null;
    if (targetEl) {
      const targetRect = targetEl.getBoundingClientRect();
      const tx = targetRect.left + targetRect.width / 2;
      const ty = targetRect.top + targetRect.height / 2;
      let i = 0;
      [
        ...Object.values(processedOutputRefs.current),
        ...Object.values(processingRewardRefs.current),
      ].forEach(el => {
        if (!el) return;
        el.style.animation = 'none';
        const rect = el.getBoundingClientRect();
        el.style.position = 'fixed';
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
        el.style.margin = '0';
        el.style.zIndex = '9999';
        el.getBoundingClientRect();
        const dx = tx - (rect.left + rect.width / 2);
        const dy = ty - (rect.top + rect.height / 2);
        el.style.transition = `transform 0.5s ease ${i * 0.07}s, opacity 0.4s ease ${i * 0.07 + 0.1}s`;
        el.style.transform = `translate(${dx}px, ${dy}px) scale(0.05)`;
        el.style.opacity = '0';
        i++;
      });
      const count = [
        ...Object.values(processedOutputRefs.current),
        ...Object.values(processingRewardRefs.current),
      ].filter(Boolean).length;
      window.setTimeout(onCollectProcessedResources, 750 + count * 70);
    } else {
      onCollectProcessedResources();
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

              <div className="foundry-queue wilderness-queue">
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
                    processedClaimQueue={processedClaimQueue}
                    queueGainByProcessed={queueGainByProcessed}
                    outputTileRef={el => { processedOutputRefs.current[activeProcessingSlot.slotId] = el; }}
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
                    carriedResource={carriedResource}
                    onPreviewEnter={(element, card) => setHoverPreview(buildHoverCardPreview(element, card))}
                    onPreviewLeave={card => setHoverPreview(current => (current?.card?.id === card?.id ? null : current))}
                    onCollect={handleCollectProcessed}
                  />
                ) : null}
              </div>

              {processingRewardEntries.length > 0 ? (
                <div className="foundry-queue wilderness-queue wilderness-queue--processing-bonus">
                  <div className="foundry-inventory__head">
                    <p className="foundry-inventory__label">Bonus Queue</p>
                    <button
                      className="foundry-collect-btn wilderness-collect-btn"
                      disabled={!queueHasProcessed}
                      onClick={handleCollectProcessed}
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
                        resource={{ name: entry.name, artKey: entry.artKey, description: entry.description }}
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
