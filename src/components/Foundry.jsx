import { fmt } from '../game/cards';
import { audioEngine } from '../game/audio/audioEngine';
import { SOUND_IDS } from '../game/audio/audioLibrary';
import { clearLootFlightGhosts, flyLootElement } from '../game/lootFlight';
import { hasProductionOutput } from '../game/productionOutputQueues';
import { aggregateStagedCounts, LOOT_STAGE_FLIGHT_MS } from '../game/stagedLoot';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import _iron from '../assets/ores/iron ore.webp';
import _silver from '../assets/ores/silver ore.webp';
import _gold from '../assets/ores/gold ore.webp';
import _platinum from '../assets/ores/platinum ore.webp';
import _starlit from '../assets/ores/starlit ore.webp';

import _steel from '../assets/ingots/steel.webp';
import _isilver from '../assets/ingots/silver.webp';
import _igold from '../assets/ingots/gold.webp';
import _iplatinum from '../assets/ingots/platinum.webp';
import _starsteel from '../assets/ingots/starsteel.webp';

import _coal from '../assets/resources/coal.webp';
import _stone from '../assets/resources/stone.webp';
import _fewCoins from '../assets/resources/few coins.webp';
import _lotsCoins from '../assets/resources/lots of coins.webp';

import CardFace from './CardFace';
import { socketedCardDragProps } from './CardPocket';
import StationMerge from './StationMerge';
import HoverCardPreview, { buildHoverCardPreview } from './HoverCardPreview';
import ResourceQuantityPopover from './ResourceQuantityPopover';
import { ESSENCES_BY_ID, getElementResourceDescription, parseElementResourceId } from '../game/arcana';
import {
  FORGE_CYCLE_DURATION_SECONDS,
  FORGE_FUEL_TYPE,
  FORGE_SMELTS_PER_COAL,
  MAX_MINE_SLOT_CAPACITY,
  ORE_TYPES,
  SMELT_RECIPES,
  getForgeFuelChargeFraction,
  getMiningAffixBonusPercent,
  hasQueuedOre,
} from '../game/foundry';

/** Forge row names. Roman numerals rather than "Forge 1" — the tabs are narrow and the game already
 *  numbers card tiers this way, so it reads as a station name instead of an array index. */
const FORGE_ROW_LABELS = ['Forge I', 'Forge II', 'Forge III'];

const INGOT_ART = {
  steel: _steel,
  silver: _isilver,
  gold: _igold,
  platinum: _iplatinum,
  starsteel: _starsteel,
};

const ORE_ART = {
  stone: _stone,
  coal: _coal,
  iron: _iron,
  silver: _silver,
  gold: _gold,
  platinum: _platinum,
  starlit: _starlit,
};

const ELEMENT_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/elements/**/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\.webp$/i, '').toLowerCase(), src]),
);

const BONUS_COIN_REWARD = {
  id: 'coins',
  fewArt: _fewCoins,
  lotsArt: _lotsCoins,
  threshold: 50,
};

const INGOT_RESOURCES = {
  steel: {
    id: 'steel',
    name: 'Steel Ingot',
    family: 'Forged Steel',
    color: '#5f7486',
    glow: 'rgba(95,116,134,0.34)',
    description: 'Sturdy iron-based alloy refined in the forge, the backbone of weapons and structural crafting.',
  },
  silver: {
    id: 'silver',
    name: 'Silver Ingot',
    family: 'Refined Silver',
    color: '#c9d5e4',
    glow: 'rgba(201,213,228,0.34)',
    description: 'Refined silver bar prized for its purity and use in precision instruments and enchantment work.',
  },
  gold: {
    id: 'gold',
    name: 'Gold Ingot',
    family: 'Refined Gold',
    color: '#efbe3d',
    glow: 'rgba(239,190,61,0.34)',
    description: 'Purified gold bar essential for high-value alchemy, fine jewelry, and premium equipment crafting.',
  },
  platinum: {
    id: 'platinum',
    name: 'Platinum Ingot',
    family: 'Refined Platinum',
    color: '#9fd9e9',
    glow: 'rgba(159,217,233,0.32)',
    description: 'Dense, heat-resistant bar smelted from rare platinum ore, used in masterwork and high-grade alloys.',
  },
  starsteel: {
    id: 'starsteel',
    name: 'Starsteel Ingot',
    family: 'Celestial Alloy',
    color: '#a68cff',
    glow: 'rgba(166,140,255,0.34)',
    description: 'Celestial alloy forged from starlit ore, radiating faint arcane energy suited for legendary-tier crafting.',
  },
};

const DIVIDER_RUNES = ['ᚠ', 'ᚱ', 'ᚨ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛞ', 'ᛟ', 'ᚲ', 'ᛗ', 'ᛚ', 'ᚾ', 'ᛜ', 'ᚦ', 'ᚹ'];
const DIVIDER_REPEAT = 6;

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
      artSrc: many ? BONUS_COIN_REWARD.lotsArt : BONUS_COIN_REWARD.fewArt,
      count: queue.coins ?? 0,
      description: 'Claimable coins earned from Coin Generation affixes during production.',
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
      artSrc: ELEMENT_ART[`${elementId} ${tier}`] ?? null,
      count,
      description: getElementResourceDescription(resourceId),
      gainNoun: labelTier.toLowerCase(),
    });
  });

  return entries;
}

function getForgeRowProgress(forgeFuelSlot, now) {
  if (!forgeFuelSlot?.startedAt || !forgeFuelSlot?.endsAt) return 0;
  const duration = Math.max(1, forgeFuelSlot.endsAt - forgeFuelSlot.startedAt);
  const elapsed = Math.max(0, Math.min(duration, now - forgeFuelSlot.startedAt));
  return elapsed / duration;
}

/**
 * Everything about one forge row's state, derived in one place.
 *
 * This was computed twice — once inside `ForgeSmeltingRow` and again in the half's `forgeReadyCount`
 * reduce — with the `ingredientOk` / `oreRequired` chain written out both times. The selector needs the
 * same answer for all three rows, and a third copy of a four-condition readiness test is a copy that
 * will eventually disagree with the ticker about whether a row is running.
 *
 * `needs` is the reason a row is NOT ready, which is what the selector has to show: with two rows hidden,
 * "row II is waiting for coal" has nowhere else to be said.
 */
function forgeRowStatus({ slot, oreSlot, ingredientSlot, fuelSlot, outputQueue = {}, now }) {
  const recipe = oreSlot?.oreType ? SMELT_RECIPES[oreSlot.oreType] : null;
  const oreRequired = recipe?.oreCount ?? 4;
  const ingredientRequired = recipe?.ingredient ?? null;
  const ingredientOk = !ingredientRequired
    || (ingredientSlot?.ingotType === ingredientRequired.type
      && (ingredientSlot?.count ?? 0) >= ingredientRequired.count);
  const oreOk = Boolean(oreSlot?.oreType) && (oreSlot.count ?? 0) >= oreRequired;
  const fuelOk = (fuelSlot?.loadedCoal ?? 0) > 0;
  const hasCard = Boolean(slot?.card);

  const progress = getForgeRowProgress(fuelSlot, now);
  const running = progress > 0 && progress < 1;
  const ready = hasCard && oreOk && ingredientOk && fuelOk;

  const hasOutput = hasProductionOutput(outputQueue);

  // Ordered by what the player has to do first, so the label names one next action rather than listing
  // everything missing at once.
  const needs = !hasCard ? 'card'
    : !fuelOk ? 'coal'
      : !oreOk ? 'ore'
        : !ingredientOk ? 'ingredient'
          : null;

  return {
    recipe, oreRequired, ingredientRequired, ingredientOk, oreOk, fuelOk, hasCard,
    progress, running, ready, hasOutput, needs,
  };
}

function SquareResourceCard({
  name,
  artSrc,
  count,
  requiredCount = null,
  description = '',
  className = '',
  tileRef = null,
  gainLabel = null,
  draggable = false,
  onDragStart = null,
  onContextMenu = null,
  onClick = null,
  dataDropTarget = null,
}) {
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
        draggable={draggable}
        onDragStart={onDragStart}
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

function MineSlot({
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
}) {
  const stagedTileRefs = useRef({});
  const stagedFlightsRef = useRef([]);
  const remainingMs = slot.endsAt ? Math.max(0, slot.endsAt - now) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const running = Boolean(slot.startedAt && slot.endsAt && remainingMs > 0);
  const bonusPercent = slot.card ? getMiningAffixBonusPercent(slot.card) : 0;
  const durationMs = slot.startedAt && slot.endsAt ? Math.max(1, slot.endsAt - slot.startedAt) : 0;
  const progress = running && durationMs ? Math.max(0, Math.min(1, (now - slot.startedAt) / durationMs)) : 0;
  const clearTitle = returnsToPocket ? 'Remove and return to pocket' : 'Remove and return to collection';
  const stagedOre = aggregateStagedCounts(stagedLoot, 'loot');
  const stagedRewards = aggregateStagedCounts(stagedLoot, 'rewards');
  const stagedOreEntries = ORE_TYPES.filter(ore => (stagedOre[ore.id] ?? 0) > 0);
  const stagedRewardEntries = buildBonusRewardEntries(stagedRewards);
  const hasStagedLoot = stagedOreEntries.length > 0 || stagedRewardEntries.length > 0;
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
        slot.card ? 'foundry-mine-slot--filled' : '',
        running ? 'foundry-mine-slot--running' : '',
        isDragOver ? 'foundry-mine-slot--drag-over' : '',
      ].filter(Boolean).join(' ')}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {slot.card && (
        <button
          className="foundry-mine-slot__clear"
          onClick={onClear}
          aria-label={`Remove ${slot.card.name} from mine slot`}
          title={clearTitle}
        >
          ✕
        </button>
      )}

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
            <div className="station-tool-slot" aria-label="Mining tool or buff slot">
              <span className="station-tool-slot__speed">+{bonusPercent}% Speed</span>
              <div className="station-tool-slot__socket">
                <span>Tool/Buff</span>
              </div>
            </div>
            <div className={`station-loot-stage${hasStagedLoot ? ' station-loot-stage--active' : ''}`}>
              <div className="station-loot-stage__stack" aria-live="polite">
                {stagedOreEntries.map(ore => (
                  <div key={`mine-stage-${ore.id}`} className="station-loot-stage__item">
                    <SquareResourceCard
                      name={ore.name}
                      artSrc={ORE_ART[ore.id]}
                      count={stagedOre[ore.id]}
                      description={ore.description}
                      tileRef={element => { stagedTileRefs.current[`ore-${ore.id}`] = element; }}
                      className="station-loot-stage__card"
                    />
                  </div>
                ))}
                {stagedRewardEntries.map(entry => (
                  <div key={`mine-stage-reward-${entry.id}`} className="station-loot-stage__item">
                    <SquareResourceCard
                      name={entry.name}
                      artSrc={entry.artSrc}
                      count={entry.count}
                      description={entry.description}
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
            className={`station-cycle-progress${running ? ' station-cycle-progress--running' : ''}`}
            style={{ '--station-progress': progress }}
            role="progressbar"
            aria-label="Mining cycle progress"
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
          <span className="foundry-mine-slot__placeholder-rune" aria-hidden="true">ᛗ</span>
          <span className="foundry-mine-slot__placeholder-text">Drop a card</span>
        </div>
      )}
    </div>
  );
}

function ForgeCardSlot({
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
            aria-label={`Remove ${slot.card.name} from forge slot`}
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
        </div>
      ) : (
        <div className="foundry-card-slot__placeholder">
          <span className="foundry-card-slot__placeholder-rune" aria-hidden="true">ᛟ</span>
          <span className="foundry-card-slot__placeholder-text">Drop a collection card</span>
        </div>
      )}
    </div>
  );
}

function ForgeOreSlot({ slot, isDragOver, onDragOver, onDragLeave, onDrop, onClear, onLoadFromCarry, onPickUp, carriedResource }) {
  const [pickUpPopover, setPickUpPopover] = useState(null);
  const ore = slot.oreType ? ORE_TYPES.find(entry => entry.id === slot.oreType) : null;
  const requiredCount = slot.oreType ? SMELT_RECIPES[slot.oreType]?.oreCount ?? null : null;

  return (
    <>
    <div
      className={`foundry-forge-ore-slot${ore ? ' foundry-forge-ore-slot--filled' : ''}${isDragOver ? ' foundry-forge-ore-slot--drag-over' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerDown={e => {
        if (e.button !== 0) return;
        if (carriedResource?.source === 'ore') { onLoadFromCarry?.(); return; }
        if (!carriedResource && ore && (slot.count ?? 0) > 0) onPickUp?.(slot.count);
      }}
      onContextMenu={e => {
        e.preventDefault();
        if (!ore || !(slot.count > 0)) return;
        setPickUpPopover({ max: slot.count, position: { x: e.clientX + 10, y: e.clientY + 10 } });
      }}
      data-resource-drop-target="forge-ore-slot"
      data-forge-slot-id={slot.slotId}
    >
      {ore ? (
        <div className="foundry-forge-ore-slot__placed">
          <button
            className="foundry-forge-ore-slot__clear"
            onPointerDown={e => e.stopPropagation()}
            onClick={onClear}
            aria-label={`Remove ${ore.name} from forge ore slot`}
          >
            ✕
          </button>
          <SquareResourceCard
            name={ore.name}
            artSrc={ORE_ART[ore.id]}
            count={slot.count ?? 0}
            requiredCount={requiredCount}
            description={ore.description}
            className="foundry-forge-ore-slot__resource"
          />
        </div>
      ) : (
        <div className="foundry-forge-ore-slot__placeholder">
          <span className="foundry-forge-ore-slot__placeholder-rune" aria-hidden="true">⬡</span>
          <span className="foundry-forge-ore-slot__placeholder-text">Place ore</span>
        </div>
      )}
    </div>
    <ResourceQuantityPopover
      open={Boolean(pickUpPopover)}
      position={pickUpPopover?.position ?? { x: 0, y: 0 }}
      title={ore ? `Carry ${ore.name}` : 'Carry Ore'}
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

function ForgeFuelBox({ forgeFuelSlot, now, onLoadFromCarry, onUnload, onPickUp, carriedResource }) {
  const [pickUpPopover, setPickUpPopover] = useState(null);
  const loaded = forgeFuelSlot?.loadedCoal > 0;
  const running = Boolean(forgeFuelSlot?.startedAt && forgeFuelSlot?.endsAt && forgeFuelSlot.endsAt > now);
  const remainingMs = forgeFuelSlot?.endsAt ? Math.max(0, forgeFuelSlot.endsAt - now) : 0;
  const cycleProgress = running ? Math.max(0, Math.min(1, remainingMs / (FORGE_CYCLE_DURATION_SECONDS * 1000))) : 0;
  const fuelFraction = getForgeFuelChargeFraction(forgeFuelSlot);

  return (
    <>
    <div
      className={`foundry-fuel-box${loaded ? ' foundry-fuel-box--loaded' : ''}`}
      onPointerDown={e => {
        if (e.button !== 0) return;
        if (carriedResource?.id === FORGE_FUEL_TYPE) { onLoadFromCarry?.(); return; }
        if (!carriedResource && loaded) onPickUp?.(forgeFuelSlot.loadedCoal);
      }}
      onContextMenu={e => {
        e.preventDefault();
        if (!loaded) return;
        setPickUpPopover({ max: forgeFuelSlot.loadedCoal, position: { x: e.clientX + 10, y: e.clientY + 10 } });
      }}
      data-resource-drop-target="forge-fuel-slot"
      data-forge-slot-id={forgeFuelSlot?.slotId}
    >
      {loaded ? (
        <div className="foundry-fuel-box__loaded">
          <button
            className="foundry-fuel-box__clear"
            onPointerDown={e => e.stopPropagation()}
            onClick={event => {
              event.stopPropagation();
              onUnload?.();
            }}
            aria-label="Unload forge fuel"
          >
            ✕
          </button>
          <SquareResourceCard
            name="Coal"
            artSrc={_coal}
            count={forgeFuelSlot.loadedCoal}
            description="A carbon-rich mineral burned as fuel for the forge, providing sustained heat for smelting ore."
            className="foundry-fuel-box__resource"
          />
          <div className="foundry-fuel-box__status">
            <div
              className={`foundry-fuel-box__ring${running ? ' foundry-fuel-box__ring--running' : ''}`}
              style={{ '--mine-progress': cycleProgress, '--fuel-progress': fuelFraction }}
            >
              <span className="foundry-fuel-box__ring-core" />
            </div>
            <div className="foundry-fuel-box__meta">
              <span className="foundry-fuel-box__name">Coal</span>
              <span className="foundry-fuel-box__cost">{forgeFuelSlot.currentCoalCharges}/{FORGE_SMELTS_PER_COAL} smelts</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="foundry-fuel-box__empty">
          <span className="foundry-forge-ore-slot__placeholder-rune" aria-hidden="true">⬢</span>
          <span className="foundry-forge-ore-slot__placeholder-text">Place coal</span>
        </div>
      )}
    </div>
    <ResourceQuantityPopover
      open={Boolean(pickUpPopover)}
      position={pickUpPopover?.position ?? { x: 0, y: 0 }}
      title="Carry Coal"
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

function ForgeIngredientSlot({ ingredientSlot, oreSlot, onLoadFromCarry, onClear, onPickUp, carriedResource }) {
  const [pickUpPopover, setPickUpPopover] = useState(null);
  const recipe = oreSlot?.oreType ? SMELT_RECIPES[oreSlot.oreType] : null;
  const required = recipe?.ingredient ?? null;
  const loadedIngot = ingredientSlot?.ingotType ? INGOT_RESOURCES[ingredientSlot.ingotType] : null;

  return (
    <>
      <div
        className={[
          'foundry-forge-ingredient-slot',
          loadedIngot ? 'foundry-forge-ingredient-slot--filled' : '',
          !required ? 'foundry-forge-ingredient-slot--not-needed' : '',
        ].filter(Boolean).join(' ')}
        onPointerDown={e => {
          if (e.button !== 0) return;
          // NOT gated on `required`. It used to be, which meant the slot silently refused an ingot
          // until the row's ore was already loaded — so every recipe that needs a secondary
          // ingredient (silver, gold, platinum, starlit) looked broken if you reached for the ingot
          // first, and the player was left holding a stack already deducted from the Bag.
          if (carriedResource?.source === 'ingot') { onLoadFromCarry?.(); return; }
          if (!carriedResource && loadedIngot && (ingredientSlot?.count ?? 0) > 0) onPickUp?.(ingredientSlot.count);
        }}
        onContextMenu={e => {
          e.preventDefault();
          if (!loadedIngot || !(ingredientSlot?.count > 0)) return;
          setPickUpPopover({ max: ingredientSlot.count, position: { x: e.clientX + 10, y: e.clientY + 10 } });
        }}
        data-resource-drop-target="forge-ingredient-slot"
        data-forge-slot-id={ingredientSlot?.slotId}
      >
        {loadedIngot ? (
          <div className="foundry-forge-ingredient-slot__placed">
            <button
              className="foundry-forge-ingredient-slot__clear"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onClear?.(); }}
              aria-label={`Remove ${loadedIngot.name}`}
            >
              ✕
            </button>
            <SquareResourceCard
              name={loadedIngot.name}
              artSrc={INGOT_ART[loadedIngot.id]}
              count={ingredientSlot.count ?? 0}
              requiredCount={required?.count ?? null}
              description={loadedIngot.description}
              className="foundry-forge-ingredient-slot__resource"
            />
          </div>
        ) : required ? (
          <div className="foundry-forge-ingredient-slot__placeholder">
            <span
              className="foundry-crafting-requirement"
              data-material-requirement={`0/${required.count}`}
              aria-label={`0 of ${fmtCount(required.count)} required`}
            >
              0 / {fmtCount(required.count)}
            </span>
            <span className="foundry-forge-ingredient-slot__placeholder-rune" aria-hidden="true">ᚲ</span>
            <span className="foundry-forge-ingredient-slot__placeholder-text">
              {INGOT_RESOURCES[required.type]?.name ?? required.type}
            </span>
          </div>
        ) : (
          /* No ore in the row yet, so no recipe and no named requirement — but the slot still takes
             an ingot. It used to show a bare rune and nothing else, which read as a disabled slot. */
          <div className="foundry-forge-ingredient-slot__placeholder foundry-forge-ingredient-slot__placeholder--none">
            <span className="foundry-forge-ingredient-slot__placeholder-rune" aria-hidden="true">ᚲ</span>
            <span className="foundry-forge-ingredient-slot__placeholder-text">Ingredient</span>
          </div>
        )}
      </div>
      <ResourceQuantityPopover
        open={Boolean(pickUpPopover)}
        position={pickUpPopover?.position ?? { x: 0, y: 0 }}
        title={loadedIngot ? `Carry ${loadedIngot.name}` : 'Carry Ingredient'}
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

function ForgeOutputSlot({ oreSlot, outputQueue, queueGain, tileRef = null }) {
  const ore = oreSlot?.oreType ? ORE_TYPES.find(entry => entry.id === oreSlot.oreType) : null;
  const queuedEntries = Object.entries(outputQueue ?? {}).filter(([, count]) => count > 0);
  const outputId = queuedEntries[0]?.[0] ?? ore?.ingotId ?? null;
  const ingot = outputId ? INGOT_RESOURCES[outputId] : null;
  if (!ingot) {
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
      name={ingot.name}
      artSrc={INGOT_ART[outputId]}
      count={queuedEntries.reduce((sum, [, count]) => sum + count, 0)}
      description={ingot.description}
      gainLabel={queueGain ? `+ ${queueGain} ingot` : null}
      className="foundry-forge-row__output-card"
    />
  );
}

function ForgeSmeltingRow({
  slot,
  oreSlot,
  ingredientSlot,
  fuelSlot,
  now,
  outputQueue,
  queueGain,
  outputTileRef,
  dragOverForgeCardSlotId,
  dragOverForgeOreSlotId,
  setDragOverForgeCardSlotId,
  setDragOverForgeOreSlotId,
  handleForgeCardSlotDrop,
  handleForgeOreSlotDrop,
  onUnsocketForgeCard,
  onUnsocketForgeOre,
  onLoadForgeFuel,
  onUnloadForgeFuel,
  onLoadForgeOre,
  onLoadForgeIngredient,
  onUnsocketForgeIngredient,
  onPickUpFuel,
  onPickUpOre,
  onPickUpIngredient,
  carriedResource,
  onPreviewEnter,
  onPreviewLeave,
  onCollect,
}) {
  const {
    progress, running, ready, ingredientRequired, ingredientOk, oreOk, hasOutput,
  } = forgeRowStatus({ slot, oreSlot, ingredientSlot, fuelSlot, outputQueue, now });

  /**
   * Which of the three smelt inputs is actually feeding this cycle.
   *
   *   off   plays no part in the current recipe — nothing to wait for
   *   idle  needed, but not satisfied yet (empty, or holding less than the recipe wants)
   *   live  loaded and feeding
   *
   * Drives both the stem in the connector below and a lit edge on the slot itself, so "in use" is
   * legible from either. Aux is `off` unconditionally until that slot does something.
   */
  // Keyed by POSITION for the shared connector, then mapped back onto the slots by name below so the
  // markup stays readable. Ingredient sits left, ore in the middle, the unimplemented aux slot right.
  const stemStates = {
    left: !ingredientRequired ? 'off' : (ingredientOk ? 'live' : 'idle'),
    middle: oreOk ? 'live' : 'idle',
    right: 'off',
  };
  const slotStem = { ingredient: stemStates.left, ore: stemStates.middle, aux: stemStates.right };

  return (
    <div className={`foundry-forge-row${running ? ' foundry-forge-row--running' : ''}${ready ? ' foundry-forge-row--ready' : ''}`}>
      <div className="foundry-forge-row__panel foundry-forge-row__panel--card">
        <ForgeCardSlot
          slot={slot}
          isDragOver={dragOverForgeCardSlotId === slot.slotId}
          onDragOver={event => {
            event.preventDefault();
            setDragOverForgeCardSlotId(slot.slotId);
          }}
          onDragLeave={() => setDragOverForgeCardSlotId(current => (current === slot.slotId ? null : current))}
          onDrop={event => handleForgeCardSlotDrop(slot.slotId, event)}
          onClear={() => typeof onUnsocketForgeCard === 'function' && onUnsocketForgeCard(slot.slotId)}
          onPreviewEnter={onPreviewEnter}
          onPreviewLeave={onPreviewLeave}
        />
      </div>

      {/* The process side: Fuel, Smelt and Output as centred bands separated by ruled dividers,
          with the three smelt slots feeding a merge connector down into Output. */}
      <div className="foundry-forge-row__panel foundry-forge-row__panel--process">
      {/* Every band lays its tiles on the SAME three-column rail, which is what makes Fuel, the
          three Smelt inputs and Output identical in size and centred on each other without any of
          them carrying a width of its own. Fuel and Output take the middle column; the smelt inputs
          take one each. */}
      <div className="foundry-forge-row__cell foundry-forge-row__cell--fuel">
        <div className="foundry-forge-row__rail foundry-forge-row__rail--single">
          <ForgeFuelBox
            forgeFuelSlot={fuelSlot}
            now={now}
            onLoadFromCarry={() => onLoadForgeFuel?.(slot.slotId)}
            onUnload={() => onUnloadForgeFuel?.(slot.slotId)}
            onPickUp={amount => onPickUpFuel?.(slot.slotId, amount)}
            carriedResource={carriedResource}
          />
        </div>
      </div>

      <div className="foundry-forge-row__rule" aria-hidden="true" />

      <div className="foundry-forge-row__cell foundry-forge-row__cell--materials">
        <div className="foundry-forge-row__rail foundry-forge-row__smelt-slots">
          <div className={`foundry-forge-row__stem-host foundry-forge-row__stem-host--${slotStem.ingredient}`}>
            <ForgeIngredientSlot
              ingredientSlot={ingredientSlot}
              oreSlot={oreSlot}
              onLoadFromCarry={() => onLoadForgeIngredient?.(slot.slotId)}
              onClear={() => onUnsocketForgeIngredient?.(slot.slotId)}
              onPickUp={amount => onPickUpIngredient?.(slot.slotId, amount)}
              carriedResource={carriedResource}
            />
          </div>
          <div className={`foundry-forge-row__stem-host foundry-forge-row__stem-host--${slotStem.ore}`}>
            <ForgeOreSlot
              slot={oreSlot}
              isDragOver={dragOverForgeOreSlotId === oreSlot.slotId}
              onDragOver={event => {
                event.preventDefault();
                setDragOverForgeOreSlotId(oreSlot.slotId);
              }}
              onDragLeave={() => setDragOverForgeOreSlotId(current => (current === oreSlot.slotId ? null : current))}
              onDrop={event => handleForgeOreSlotDrop(oreSlot.slotId, event)}
              onClear={() => typeof onUnsocketForgeOre === 'function' && onUnsocketForgeOre(oreSlot.slotId)}
              onLoadFromCarry={() => onLoadForgeOre?.(oreSlot.slotId)}
              onPickUp={amount => onPickUpOre?.(oreSlot.slotId, amount)}
              carriedResource={carriedResource}
            />
          </div>
          <div className={`foundry-forge-row__stem-host foundry-forge-row__stem-host--${slotStem.aux}`}>
            <div className="foundry-forge-row__aux-slot">
              <span className="foundry-forge-row__aux-rune" aria-hidden="true">ᛚ</span>
            </div>
          </div>
        </div>

        <StationMerge progress={progress} running={running} ready={ready} stems={stemStates} />
      </div>

      <div className="foundry-forge-row__rule" aria-hidden="true" />

      <div className="foundry-forge-row__cell foundry-forge-row__cell--output">
        {/* Collect sits UNDER the output tile in the same rail column, so it is exactly one tile
            wide. Inline with the tile it ended up ~100px further right and fell under the Bag
            drawer on a 1280-1440px window — a button you cannot click. */}
        <div className="foundry-forge-row__rail foundry-forge-row__rail--single">
          <ForgeOutputSlot
            oreSlot={oreSlot}
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

function QueueOreSlot({ ore, count, gainLabel = null, slotRef = null }) {
  return (
    <SquareResourceCard
      tileRef={slotRef}
      name={ore.name}
      artSrc={ORE_ART[ore.id]}
      count={count}
      description={ore.description}
      gainLabel={gainLabel}
      className="foundry-queue-slot"
    />
  );
}

function QueueIngotSlot({ ingotId, count, gainLabel = null }) {
  const resource = INGOT_RESOURCES[ingotId];
  return (
    <SquareResourceCard
      name={resource.name}
      artSrc={INGOT_ART[ingotId]}
      count={count}
      description={resource.description}
      gainLabel={gainLabel}
      className="foundry-queue-slot foundry-queue-slot--ingot"
    />
  );
}

function LockedMineSlot({ cost, disabled, onUnlock }) {
  return (
    <div className="foundry-mine-slot foundry-mine-slot--locked">
      <div className="foundry-mine-slot__locked-core">
        <span className="foundry-mine-slot__locked-rune" aria-hidden="true">ᛝ</span>
        <span className="foundry-mine-slot__locked-text">Unlock mine socket</span>
        <button
          className="foundry-mine-slot__unlock"
          disabled={disabled}
          onClick={onUnlock}
        >
          {cost ? `Unlock · ⬡ ${fmt(cost)}` : 'Maxed'}
        </button>
      </div>
    </div>
  );
}

export default function Foundry({
  collection = [],
  pocket = [],
  balance = 0,
  mineSlots = [],
  mineSlotCapacity = 1,
  mineClaimQueue = {},
  mineRewardQueue = {},
  mineLootStages = [],
  forgeCardSlots = [],
  forgeOreSlots = [],
  forgeIngredientSlots = [],
  forgeFuelSlots = [],
  forgeOutputQueues = {},
  forgeRewardQueue = {},
  returnsMineCardsToPocket = true,
  nextMineSlotCost = null,
  collectTargetRef = null,
  onSocketMineCard,
  onUnsocketMineCard,
  onUnlockMineSlot,
  onCollectMinedOre,
  onSocketForgeCard,
  onUnsocketForgeCard,
  onSocketForgeOre,
  onUnsocketForgeOre,
  onLoadForgeFuel,
  onUnloadForgeFuel,
  onLoadForgeOre,
  onLoadForgeIngredient,
  onUnsocketForgeIngredient,
  onPickUpForgeFuel,
  onPickUpForgeOre,
  onPickUpForgeIngredient,
  onCollectIngotOutput,
  onCollectForgeRewards,
  carriedResource = null,
  onPlaceCarriedResource,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [dragOverMineSlotId, setDragOverMineSlotId] = useState(null);
  const [dragOverForgeCardSlotId, setDragOverForgeCardSlotId] = useState(null);
  const [dragOverForgeOreSlotId, setDragOverForgeOreSlotId] = useState(null);
  const [queueGainByOre, setQueueGainByOre] = useState({});
  const [queueGainByForgeOutput, setQueueGainByForgeOutput] = useState({});
  const [queueGainByMineReward, setQueueGainByMineReward] = useState({});
  const [queueGainByForgeReward, setQueueGainByForgeReward] = useState({});
  const [isCollecting, setIsCollecting] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);
  /**
   * Which forge row is shown. Deliberately NOT persisted: it is where the player happens to be looking,
   * not progress, and restoring it would be indistinguishable from the game having switched rows by itself.
   *
   * Nothing auto-follows it either. A row finishing does not steal the view — the tab lights up and the
   * player decides, the same contract the nav's loot diamond has.
   */
  const [activeForgeRow, setActiveForgeRow] = useState(0);
  const previousQueueRef = useRef(mineClaimQueue);
  const previousForgeOutputQueuesRef = useRef(forgeOutputQueues);
  const previousMineRewardQueueRef = useRef(mineRewardQueue);
  const previousForgeRewardQueueRef = useRef(forgeRewardQueue);
  const queueSlotRefs = useRef({});
  const ingotOutputRefs = useRef({});
  const mineRewardRefs = useRef({});
  const mineStageTargetRef = useRef(null);
  const forgeRewardRefs = useRef({});
  const collectTimeoutRef = useRef(null);
  // Ghost clones currently in flight, paired with the tile each was cloned from.
  const flyGhostsRef = useRef([]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (collectTimeoutRef.current) window.clearTimeout(collectTimeoutRef.current);
    // Ghosts live on <body>, outside this component's tree, so React will not remove them when
    // Foundry unmounts — navigating away mid-flight would otherwise leave them stuck on screen.
    clearLootFlightGhosts(flyGhostsRef.current);
  }, []);

  useEffect(() => {
    const previousQueue = previousQueueRef.current ?? {};
    const nextGains = {};

    for (const ore of ORE_TYPES) {
      const currentCount = mineClaimQueue[ore.id] ?? 0;
      const previousCount = previousQueue[ore.id] ?? 0;
      if (currentCount > previousCount) nextGains[ore.id] = currentCount - previousCount;
    }

    previousQueueRef.current = mineClaimQueue;
    if (Object.keys(nextGains).length === 0) return;

    setQueueGainByOre(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByOre(prev => {
        const next = { ...prev };
        for (const oreId of Object.keys(nextGains)) delete next[oreId];
        return next;
      });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [mineClaimQueue]);

  useEffect(() => {
    const previousQueue = previousMineRewardQueueRef.current ?? {};
    const nextGains = {};
    for (const entry of buildBonusRewardEntries(mineRewardQueue)) {
      const currentCount = mineRewardQueue[entry.id] ?? 0;
      const previousCount = previousQueue[entry.id] ?? 0;
      if (currentCount > previousCount) nextGains[entry.id] = currentCount - previousCount;
    }
    previousMineRewardQueueRef.current = mineRewardQueue;
    if (Object.keys(nextGains).length === 0) return;
    setQueueGainByMineReward(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByMineReward(prev => {
        const next = { ...prev };
        Object.keys(nextGains).forEach(key => delete next[key]);
        return next;
      });
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [mineRewardQueue]);

  useEffect(() => {
    const previousQueues = previousForgeOutputQueuesRef.current ?? {};
    const nextGains = {};

    Object.entries(forgeOutputQueues).forEach(([slotId, outputs]) => {
      const previousOutputs = previousQueues[slotId] ?? {};
      const gained = Object.entries(outputs ?? {}).reduce((sum, [outputId, count]) => (
        sum + Math.max(0, count - (previousOutputs[outputId] ?? 0))
      ), 0);
      if (gained > 0) nextGains[slotId] = gained;
    });

    previousForgeOutputQueuesRef.current = forgeOutputQueues;
    if (Object.keys(nextGains).length === 0) return;

    setQueueGainByForgeOutput(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByForgeOutput(prev => {
        const next = { ...prev };
        for (const slotId of Object.keys(nextGains)) delete next[slotId];
        return next;
      });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [forgeOutputQueues]);

  useEffect(() => {
    const previousQueue = previousForgeRewardQueueRef.current ?? {};
    const nextGains = {};
    for (const entry of buildBonusRewardEntries(forgeRewardQueue)) {
      const currentCount = forgeRewardQueue[entry.id] ?? 0;
      const previousCount = previousQueue[entry.id] ?? 0;
      if (currentCount > previousCount) nextGains[entry.id] = currentCount - previousCount;
    }
    previousForgeRewardQueueRef.current = forgeRewardQueue;
    if (Object.keys(nextGains).length === 0) return;
    setQueueGainByForgeReward(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByForgeReward(prev => {
        const next = { ...prev };
        Object.keys(nextGains).forEach(key => delete next[key]);
        return next;
      });
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [forgeRewardQueue]);

  const dividerGlyphs = useMemo(
    () => Array.from({ length: DIVIDER_RUNES.length * DIVIDER_REPEAT }, (_, i) => DIVIDER_RUNES[i % DIVIDER_RUNES.length]),
    [],
  );

  const miningRunningCount = mineSlots.filter(slot => slot.card && slot.startedAt).length;
  const mineRewardEntries = useMemo(() => buildBonusRewardEntries(mineRewardQueue), [mineRewardQueue]);
  // Hoisted out of the JSX so the stacked queue's `--stack-gaps` counts the same list it renders. Two
  // separate filters of the same predicate would eventually disagree, and the row would size for the wrong
  // number of tiles.
  const queuedOreTypes = useMemo(
    () => ORE_TYPES.filter(ore => (mineClaimQueue[ore.id] ?? 0) > 0),
    [mineClaimQueue],
  );
  const forgeRewardEntries = useMemo(() => buildBonusRewardEntries(forgeRewardQueue), [forgeRewardQueue]);
  const queueHasOre = hasQueuedOre(mineClaimQueue) || hasQueuedBonusRewards(mineRewardQueue);
  const queueHasForgeRewards = hasQueuedBonusRewards(forgeRewardQueue);
  /**
   * Every row's state, for the selector and the readiness hint alike.
   *
   * The selector shows ONE row at a time, so this is what stops the other two going dark: a hidden row
   * that finished a smelt, or ran out of coal, has to be able to say so on its tab. Same reasoning as the
   * nav's loot diamond — a completion the player cannot see is a completion they will not collect.
   */
  const forgeStatuses = forgeCardSlots.map((slot, index) => forgeRowStatus({
    slot,
    oreSlot: forgeOreSlots[index],
    ingredientSlot: forgeIngredientSlots[index],
    fuelSlot: forgeFuelSlots[index],
    outputQueue: forgeOutputQueues[String(slot.slotId)] ?? {},
    now,
  }));
  const forgeReadyCount = forgeStatuses.filter(s => s.ready).length;
  // Clamped at read time rather than corrected in an effect: an effect would render one frame against an
  // out-of-range index first, and `FORGE_SLOT_COUNT` changing is exactly the kind of thing that happens
  // once, quietly, in a later patch.
  const activeForgeRowIndex = Math.min(activeForgeRow, Math.max(0, forgeCardSlots.length - 1));
  const activeForgeSlot = forgeCardSlots[activeForgeRowIndex] ?? null;

  function handleMineSlotDrop(slotId, event) {
    event.preventDefault();
    setDragOverMineSlotId(null);
    const cardId = event.dataTransfer.getData('text/plain') || event.dataTransfer.getData('card-id');
    if (!cardId || typeof onSocketMineCard !== 'function') return;
    onSocketMineCard(cardId, slotId);
  }

  function handleForgeCardSlotDrop(slotId, event) {
    event.preventDefault();
    setDragOverForgeCardSlotId(null);
    const cardId = event.dataTransfer.getData('text/plain') || event.dataTransfer.getData('card-id');
    if (!cardId || typeof onSocketForgeCard !== 'function') return;
    onSocketForgeCard(cardId, slotId);
  }

  function handleForgeOreSlotDrop(slotId, event) {
    event.preventDefault();
    setDragOverForgeOreSlotId(null);
    const oreType = event.dataTransfer.getData('ore-id');
    if (!oreType || typeof onSocketForgeOre !== 'function') return;
    onSocketForgeOre(oreType, slotId);
  }

  /**
   * Flies each queued tile to the collect target.
   *
   * **A CLONE flies; the original stays in the layout and is only made `visibility: hidden`.**
   * This used to re-pin the original as `position: fixed`, which takes it out of flow — so the box
   * it occupied vanished and everything around it reflowed for the length of the animation. On a
   * forge row that was measured as the output cell dropping 154px -> 48px at 241ms and springing
   * back at 843ms (the 600ms callback timer plus a frame): a visible collapse-and-recover every
   * time you pressed Collect.
   *
   * `visibility: hidden` is the point — unlike `display: none` it keeps the element's box, so
   * nothing moves. The clone is appended to `<body>` so it paints above every stacking context,
   * which is what the `fixed` trick was really for.
   */
  function flyToTarget(elementMap, targetEl) {
    if (!targetEl) return 0;
    const targetRect = targetEl.getBoundingClientRect();
    const tx = targetRect.left + targetRect.width / 2;
    const ty = targetRect.top + targetRect.height / 2;
    let count = 0;
    Object.values(elementMap).forEach(el => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const flight = flyLootElement(el, { x: tx, y: ty, index: count });
      if (flight) {
        flyGhostsRef.current.push(flight);
        count++;
      }
    });
    return count;
  }

  /** Removes every ghost and un-hides the tiles it flew for. Safe to call more than once. */
  function clearFlyGhosts() {
    // A tile whose queue emptied has unmounted by now; one that persists (a forge row's output
    // stays put and just reads zero) is restored by the shared cleanup helper.
    clearLootFlightGhosts(flyGhostsRef.current);
  }

  function handleCollectQueue() {
    if (isCollecting || typeof onCollectMinedOre !== 'function' || !queueHasOre) return;
    // Played on the press, not in the App callback that runs when the fly animation lands.
    // That callback is behind a 600ms timer here (and 750ms + 70ms per item in Wilderness),
    // which is exactly the 1-2 second lag this was reported as: the sound was correct, it was
    // just waiting for an animation.
    audioEngine.play(SOUND_IDS.rewardClaim);
    setIsCollecting(true);
    const activeRefs = Object.fromEntries(
      [
        ...Object.entries(queueSlotRefs.current).filter(([id]) => (mineClaimQueue[id] ?? 0) > 0 && queueSlotRefs.current[id]),
        ...Object.entries(mineRewardRefs.current).filter(([id]) => (mineRewardQueue[id] ?? 0) > 0 && mineRewardRefs.current[id]),
      ],
    );
    flyToTarget(activeRefs, collectTargetRef?.current ?? null);
    collectTimeoutRef.current = window.setTimeout(() => {
      onCollectMinedOre();
      setIsCollecting(false);
      clearFlyGhosts();
    }, 600);
  }

  function handleCollectIngotOutput(slotId) {
    const outputQueue = forgeOutputQueues[String(slotId)] ?? {};
    if (typeof onCollectIngotOutput !== 'function' || !hasProductionOutput(outputQueue) || flyGhostsRef.current.length > 0) return;
    audioEngine.play(SOUND_IDS.rewardClaim);
    const activeRefs = { [slotId]: ingotOutputRefs.current[String(slotId)] };
    flyToTarget(activeRefs, collectTargetRef?.current ?? null);
    collectTimeoutRef.current = window.setTimeout(() => {
      collectTimeoutRef.current = null;
      onCollectIngotOutput(slotId);
      // No rAF and no `cssText = ''` reset any more: `flyToTarget` no longer touches the originals'
      // geometry, so there is nothing to rebuild — just drop the ghosts and un-hide the tiles.
      clearFlyGhosts();
    }, 600);
  }

  function handleCollectForgeRewards() {
    if (typeof onCollectForgeRewards !== 'function' || !queueHasForgeRewards || flyGhostsRef.current.length > 0) return;
    audioEngine.play(SOUND_IDS.rewardClaim);
    const activeRefs = Object.fromEntries(
      Object.entries(forgeRewardRefs.current).filter(([id, el]) => (forgeRewardQueue[id] ?? 0) > 0 && el),
    );
    flyToTarget(activeRefs, collectTargetRef?.current ?? null);
    collectTimeoutRef.current = window.setTimeout(() => {
      collectTimeoutRef.current = null;
      onCollectForgeRewards();
      clearFlyGhosts();
    }, 600);
  }

  return (
    <div className="foundry-page">
      <HoverCardPreview preview={hoverPreview} />
      {/* No page title. The tab bar already says FOUNDRY, and each half carries its own heading and
          instruction line ("The Mine" / "The Forge"), so a third label restated what two others said. It
          cost 46px plus the page's 14.4rem gap — ~60px given straight back to the halves, which is the
          scarcest space in the game. Arcana still uses `.foundry-header`, so those rules stay. */}

      <div className="foundry-layout">
        <div className="foundry-main">
          <div className="foundry-split">
            <div className="foundry-half foundry-half--mine">
              <div className="foundry-half__header">
                <h3 className="foundry-half__title">The Mine</h3>
                <p className="foundry-half__label">Socket pocket cards. Ore rolls are biased by rarity and tier, and mining starts immediately.</p>
              </div>

              <div className="foundry-mine-slots">
                {mineSlots.map(slot => (
                  <MineSlot
                    key={slot.slotId}
                    slot={slot}
                    stagedLoot={mineLootStages.filter(event => event.slotId === slot.slotId)}
                    stageTargetRef={mineStageTargetRef}
                    now={now}
                    isDragOver={dragOverMineSlotId === slot.slotId}
                    onDragOver={event => {
                      event.preventDefault();
                      setDragOverMineSlotId(slot.slotId);
                    }}
                    onDragLeave={() => setDragOverMineSlotId(current => (current === slot.slotId ? null : current))}
                    onDrop={event => handleMineSlotDrop(slot.slotId, event)}
                    onClear={() => typeof onUnsocketMineCard === 'function' && onUnsocketMineCard(slot.slotId)}
                    returnsToPocket={returnsMineCardsToPocket}
                    onPreviewEnter={(element, card) => setHoverPreview(buildHoverCardPreview(element, card))}
                    onPreviewLeave={card => setHoverPreview(current => (current?.card?.id === card?.id ? null : current))}
                  />
                ))}

                {mineSlotCapacity < MAX_MINE_SLOT_CAPACITY && (
                  <LockedMineSlot
                    cost={nextMineSlotCost}
                    disabled={!nextMineSlotCost || balance < nextMineSlotCost}
                    onUnlock={onUnlockMineSlot}
                  />
                )}
              </div>

              {/* Only while nothing is mining — see the matching note in Wilderness.jsx. The running count
                  restated what the slots already show; the empty-state instruction does not. */}
              {miningRunningCount === 0 && (
                <div className="foundry-action-row">
                  <p className="foundry-action-hint">
                    {pocket.length > 0
                      ? 'Drag a card from Pocket into an open mine slot'
                      : 'Pocket a card first, then socket it into the mine'}
                  </p>
                </div>
              )}

              <div ref={mineStageTargetRef} className="foundry-queue">
                <div className="foundry-inventory__head">
                  <p className="foundry-inventory__label">Collection Queue</p>
                  <button
                    className="foundry-collect-btn"
                    disabled={!queueHasOre || isCollecting}
                    onClick={handleCollectQueue}
                  >
                    Collect
                  </button>
                </div>
                {/* `--stack-gaps` lets the overlap tighten so the whole haul fits without the half
                    scrolling; see `.stack-line`. Counted from exactly what is rendered below. */}
                <div
                  className="foundry-queue-slots stack-line"
                  style={{ '--stack-gaps': Math.max(1, queuedOreTypes.length + mineRewardEntries.length - 1) }}
                >
                  {queuedOreTypes.map(ore => (
                    <QueueOreSlot
                      key={`queued-${ore.id}`}
                      ore={ore}
                      count={mineClaimQueue[ore.id] ?? 0}
                      gainLabel={queueGainByOre[ore.id] ? `+ ${queueGainByOre[ore.id]} ore` : null}
                      slotRef={element => {
                        queueSlotRefs.current[ore.id] = element;
                      }}
                    />
                  ))}
                  {mineRewardEntries.map(entry => (
                    <SquareResourceCard
                      key={`mine-bonus-${entry.id}`}
                      name={entry.name}
                      artSrc={entry.artSrc}
                      count={entry.count}
                      description={entry.description}
                      gainLabel={queueGainByMineReward[entry.id] ? `+ ${queueGainByMineReward[entry.id]} ${entry.gainNoun}` : null}
                      tileRef={element => {
                        mineRewardRefs.current[entry.id] = element;
                      }}
                      className="foundry-queue-slot"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="foundry-divider">
              <span className="foundry-divider__header-rune" aria-hidden="true">ᛟ</span>
              <div className="foundry-divider__rune-column" aria-hidden="true">
                {dividerGlyphs.map((glyph, index) => (
                  <span key={index} className="foundry-divider-rune">{glyph}</span>
                ))}
              </div>
            </div>

            <div className="foundry-half foundry-half--forge">
              <div className="foundry-half__header">
                <h3 className="foundry-half__title">The Forge</h3>
                {/* The summary lives in the header rather than in its own action row below the rows.
                    That row cost 32px of a half that has none to spare, and everything it said the
                    selector now says per row — where "needs coal" is actually actionable. */}
                <p className={`foundry-half__label${forgeReadyCount === 0 ? ' foundry-half__label--warn' : ''}`}>
                  {forgeReadyCount > 0
                    ? `${forgeReadyCount} of ${forgeCardSlots.length} rows ready · pick a row below`
                    : 'Socket a card, load coal, then pair ore to smelt ingots.'}
                </p>
              </div>

              {/* One row at a time, chosen here.
                  Three stacked rows needed 1844px in a half that gets 395px at 1366x768 — 131px per row,
                  less than one 112px rail tile — so no amount of shrinking fitted them. The selector is
                  the Shop's shelf pattern: a player has already met it, and it is the only option that
                  fits a short viewport without redrawing the row itself. */}
              <div className="forge-selector" role="tablist" aria-label="Forge rows">
                {forgeCardSlots.map((slot, index) => {
                  const status = forgeStatuses[index];
                  const active = index === activeForgeRowIndex;
                  const state = status.running ? 'running'
                    : status.ready ? 'ready'
                      : status.hasCard ? 'waiting' : 'empty';
                  return (
                    <button
                      key={`forge-tab-${slot.slotId}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`forge-selector__tab forge-selector__tab--${state}${active ? ' forge-selector__tab--active' : ''}`}
                      onClick={() => setActiveForgeRow(index)}
                      title={
                        status.running ? `Smelting — ${Math.round(status.progress * 100)}%`
                          : status.ready ? 'Ready to smelt'
                            : status.needs === 'card' ? 'Empty — socket a blacksmith'
                              : `Waiting for ${status.needs}`
                      }
                    >
                      <span className="forge-selector__name">
                        {FORGE_ROW_LABELS[index] ?? `Forge ${index + 1}`}
                      </span>
                      <span className="forge-selector__state">
                        {status.running ? `${Math.round(status.progress * 100)}%`
                          : status.ready ? 'Ready'
                            : status.needs === 'card' ? 'Empty'
                              : `Needs ${status.needs}`}
                      </span>
                      {/* Progress rides the tab itself, so a hidden row still reads as working. */}
                      {status.running ? (
                        <span
                          className="forge-selector__fill"
                          style={{ '--forge-tab-progress': status.progress }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {/* Output waiting on a row you are not looking at. Same signal as the nav diamond. */}
                      {status.hasOutput ? <span className="forge-selector__loot" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="foundry-forge-rows">
                {activeForgeSlot ? (
                  <ForgeSmeltingRow
                    key={`forge-row-${activeForgeSlot.slotId}`}
                    slot={activeForgeSlot}
                    oreSlot={forgeOreSlots[activeForgeRowIndex]}
                    ingredientSlot={forgeIngredientSlots[activeForgeRowIndex]}
                    fuelSlot={forgeFuelSlots[activeForgeRowIndex]}
                    now={now}
                    outputQueue={forgeOutputQueues[String(activeForgeSlot.slotId)] ?? {}}
                    queueGain={queueGainByForgeOutput[String(activeForgeSlot.slotId)] ?? 0}
                    outputTileRef={el => { ingotOutputRefs.current[String(activeForgeSlot.slotId)] = el; }}
                    dragOverForgeCardSlotId={dragOverForgeCardSlotId}
                    dragOverForgeOreSlotId={dragOverForgeOreSlotId}
                    setDragOverForgeCardSlotId={setDragOverForgeCardSlotId}
                    setDragOverForgeOreSlotId={setDragOverForgeOreSlotId}
                    handleForgeCardSlotDrop={handleForgeCardSlotDrop}
                    handleForgeOreSlotDrop={handleForgeOreSlotDrop}
                    onUnsocketForgeCard={onUnsocketForgeCard}
                    onUnsocketForgeOre={onUnsocketForgeOre}
                    onLoadForgeFuel={onLoadForgeFuel}
                    onUnloadForgeFuel={onUnloadForgeFuel}
                    onLoadForgeOre={onLoadForgeOre}
                    onLoadForgeIngredient={onLoadForgeIngredient}
                    onUnsocketForgeIngredient={onUnsocketForgeIngredient}
                    onPickUpFuel={onPickUpForgeFuel}
                    onPickUpOre={onPickUpForgeOre}
                    onPickUpIngredient={onPickUpForgeIngredient}
                    carriedResource={carriedResource}
                    onPreviewEnter={(element, card) => setHoverPreview(buildHoverCardPreview(element, card))}
                    onPreviewLeave={card => setHoverPreview(current => (current?.card?.id === card?.id ? null : current))}
                    onCollect={() => handleCollectIngotOutput(activeForgeSlot.slotId)}
                  />
                ) : null}
              </div>

              {queueHasForgeRewards ? (
                <div className="foundry-queue foundry-queue--bonus">
                  <div className="foundry-inventory__head">
                    <p className="foundry-inventory__label">Bonus Queue</p>
                    <button
                      className="foundry-collect-btn"
                      disabled={!queueHasForgeRewards}
                      onClick={handleCollectForgeRewards}
                    >
                      Collect
                    </button>
                  </div>
                  <div
                    className="foundry-queue-slots stack-line"
                    style={{ '--stack-gaps': Math.max(1, forgeRewardEntries.length - 1) }}
                  >
                    {forgeRewardEntries.map(entry => (
                      <SquareResourceCard
                        key={`forge-bonus-${entry.id}`}
                        name={entry.name}
                        artSrc={entry.artSrc}
                        count={entry.count}
                        description={entry.description}
                        gainLabel={queueGainByForgeReward[entry.id] ? `+ ${queueGainByForgeReward[entry.id]} ${entry.gainNoun}` : null}
                        tileRef={element => {
                          forgeRewardRefs.current[entry.id] = element;
                        }}
                        className="foundry-queue-slot"
                      />
                    ))}
                  </div>
                </div>
              ) : null}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
