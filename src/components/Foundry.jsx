import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import _iron from '../assets/ores/iron ore.png';
import _silver from '../assets/ores/silver ore.png';
import _gold from '../assets/ores/gold ore.png';
import _platinum from '../assets/ores/platinum ore.png';
import _starlit from '../assets/ores/starlit ore.png';

import _steel from '../assets/ingots/steel.png';
import _isilver from '../assets/ingots/silver.png';
import _igold from '../assets/ingots/gold.png';
import _iplatinum from '../assets/ingots/platinum.png';
import _starsteel from '../assets/ingots/starsteel.png';

import _coal from '../assets/resources/coal.png';
import _stone from '../assets/resources/stone.png';

import CardFace from './CardFace';
import HoverCardPreview, { buildHoverCardPreview } from './HoverCardPreview';
import ResourceQuantityPopover from './ResourceQuantityPopover';
import {
  FORGE_CYCLE_DURATION_SECONDS,
  FORGE_FUEL_TYPE,
  FORGE_SMELTS_PER_COAL,
  MAX_MINE_SLOT_CAPACITY,
  ORE_TYPES,
  SMELT_RECIPES,
  getForgeFuelChargeFraction,
  getMiningAffixBonusPercent,
  getMiningDurationSeconds,
  hasQueuedOre,
} from '../game/foundry';

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

function getForgeRowProgress(forgeFuelSlot, now) {
  if (!forgeFuelSlot?.startedAt || !forgeFuelSlot?.endsAt) return 0;
  const duration = Math.max(1, forgeFuelSlot.endsAt - forgeFuelSlot.startedAt);
  const elapsed = Math.max(0, Math.min(duration, now - forgeFuelSlot.startedAt));
  return elapsed / duration;
}

function SquareResourceCard({
  name,
  artSrc,
  count,
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
              <span className="foundry-square-resource__count">{fmtCount(count)}</span>
            </div>
            <div className="foundry-square-resource__art-wrap">
              <img src={artSrc} alt={name} className="foundry-square-resource__art" />
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
  const bonusPercent = slot.card ? getMiningAffixBonusPercent(slot.card) : 0;
  const durationSeconds = slot.card ? getMiningDurationSeconds(slot.card) : null;
  const progress = running && durationSeconds ? Math.max(0, Math.min(1, remainingMs / (durationSeconds * 1000))) : 0;
  const clearTitle = returnsToPocket ? 'Remove and return to pocket' : 'Remove and return to collection';

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
            onMouseEnter={e => onPreviewEnter?.(e.currentTarget, slot.card)}
            onMouseLeave={() => onPreviewLeave?.(slot.card)}
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
            onMouseEnter={e => onPreviewEnter?.(e.currentTarget, slot.card)}
            onMouseLeave={() => onPreviewLeave?.(slot.card)}
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
          if (e.button !== 0 || !required) return;
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
              description={loadedIngot.description}
              className="foundry-forge-ingredient-slot__resource"
            />
          </div>
        ) : required ? (
          <div className="foundry-forge-ingredient-slot__placeholder">
            <span className="foundry-forge-ingredient-slot__placeholder-rune" aria-hidden="true">ᚲ</span>
            <span className="foundry-forge-ingredient-slot__placeholder-text">
              {INGOT_RESOURCES[required.type]?.name ?? required.type}
            </span>
          </div>
        ) : (
          <div className="foundry-forge-ingredient-slot__placeholder foundry-forge-ingredient-slot__placeholder--none">
            <span className="foundry-forge-ingredient-slot__placeholder-rune" aria-hidden="true">ᚲ</span>
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

function ForgeOutputSlot({ oreSlot, ingotClaimQueue, queueGainByIngot, tileRef = null }) {
  const ore = oreSlot?.oreType ? ORE_TYPES.find(entry => entry.id === oreSlot.oreType) : null;
  const ingot = ore?.ingotId ? INGOT_RESOURCES[ore.ingotId] : null;
  if (!ore || !ingot) {
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
      artSrc={INGOT_ART[ore.ingotId]}
      count={ingotClaimQueue[ore.ingotId] ?? 0}
      description={ingot.description}
      gainLabel={queueGainByIngot[ore.ingotId] ? `+ ${queueGainByIngot[ore.ingotId]} ingot` : null}
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
  ingotClaimQueue,
  queueGainByIngot,
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
  const progress = getForgeRowProgress(fuelSlot, now);
  const running = progress > 0 && progress < 1;
  const recipe = oreSlot?.oreType ? SMELT_RECIPES[oreSlot.oreType] : null;
  const rowIngotId = oreSlot?.oreType ? (ORE_TYPES.find(o => o.id === oreSlot.oreType)?.ingotId ?? null) : null;
  const hasOutput = rowIngotId ? (ingotClaimQueue[rowIngotId] ?? 0) > 0 : false;
  const oreRequired = recipe?.oreCount ?? 4;
  const ingredientRequired = recipe?.ingredient ?? null;
  const ingredientOk = !ingredientRequired || (ingredientSlot?.ingotType === ingredientRequired.type && (ingredientSlot?.count ?? 0) >= ingredientRequired.count);
  const ready = Boolean(slot.card && oreSlot?.oreType && (oreSlot.count ?? 0) >= oreRequired && ingredientOk && fuelSlot?.loadedCoal > 0);

  return (
    <div className={`foundry-forge-row${running ? ' foundry-forge-row--running' : ''}${ready ? ' foundry-forge-row--ready' : ''}`}>
      <div className="foundry-forge-row__cell foundry-forge-row__cell--card">
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

      <div className="foundry-forge-row__cell foundry-forge-row__cell--fuel">
        <ForgeFuelBox
          forgeFuelSlot={fuelSlot}
          now={now}
          onLoadFromCarry={() => onLoadForgeFuel?.(slot.slotId)}
          onUnload={() => onUnloadForgeFuel?.(slot.slotId)}
          onPickUp={amount => onPickUpFuel?.(slot.slotId, amount)}
          carriedResource={carriedResource}
        />
      </div>

      <div className="foundry-forge-row__cell foundry-forge-row__cell--materials">
        <div className="foundry-forge-row__materials-stack">
          <div className="foundry-forge-row__aux">
            <ForgeIngredientSlot
              ingredientSlot={ingredientSlot}
              oreSlot={oreSlot}
              onLoadFromCarry={() => onLoadForgeIngredient?.(slot.slotId)}
              onClear={() => onUnsocketForgeIngredient?.(slot.slotId)}
              onPickUp={amount => onPickUpIngredient?.(slot.slotId, amount)}
              carriedResource={carriedResource}
            />
            <div className="foundry-forge-row__aux-slot">
              <span className="foundry-forge-row__aux-rune" aria-hidden="true">ᛚ</span>
            </div>
          </div>
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
      </div>

      <div className="foundry-forge-row__cell foundry-forge-row__cell--progress">
        <div
          className={`foundry-forge-row__arrow${running ? ' foundry-forge-row__arrow--running' : ''}${ready ? ' foundry-forge-row__arrow--ready' : ''}`}
          style={{ '--forge-progress': progress }}
        >
          <span className="foundry-forge-row__arrow-core" />
        </div>
      </div>

      <div className="foundry-forge-row__cell foundry-forge-row__cell--output">
        <ForgeOutputSlot
          oreSlot={oreSlot}
          ingotClaimQueue={ingotClaimQueue}
          queueGainByIngot={queueGainByIngot}
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
          {cost ? `Unlock · ⬡ ${cost.toFixed(2)}` : 'Maxed'}
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
  forgeCardSlots = [],
  forgeOreSlots = [],
  forgeIngredientSlots = [],
  forgeFuelSlots = [],
  ingotClaimQueue = {},
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
  onCollectIngots,
  carriedResource = null,
  onPlaceCarriedResource,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [dragOverMineSlotId, setDragOverMineSlotId] = useState(null);
  const [dragOverForgeCardSlotId, setDragOverForgeCardSlotId] = useState(null);
  const [dragOverForgeOreSlotId, setDragOverForgeOreSlotId] = useState(null);
  const [queueGainByOre, setQueueGainByOre] = useState({});
  const [queueGainByIngot, setQueueGainByIngot] = useState({});
  const [isCollecting, setIsCollecting] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);
  const previousQueueRef = useRef(mineClaimQueue);
  const previousIngotQueueRef = useRef(ingotClaimQueue);
  const queueSlotRefs = useRef({});
  const ingotOutputRefs = useRef({});
  const collectTimeoutRef = useRef(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (collectTimeoutRef.current) window.clearTimeout(collectTimeoutRef.current);
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
    const previousQueue = previousIngotQueueRef.current ?? {};
    const nextGains = {};

    for (const ore of ORE_TYPES) {
      const ingotId = ore.ingotId;
      const currentCount = ingotClaimQueue[ingotId] ?? 0;
      const previousCount = previousQueue[ingotId] ?? 0;
      if (currentCount > previousCount) nextGains[ingotId] = currentCount - previousCount;
    }

    previousIngotQueueRef.current = ingotClaimQueue;
    if (Object.keys(nextGains).length === 0) return;

    setQueueGainByIngot(prev => ({ ...prev, ...nextGains }));
    const timeout = window.setTimeout(() => {
      setQueueGainByIngot(prev => {
        const next = { ...prev };
        for (const ingotId of Object.keys(nextGains)) delete next[ingotId];
        return next;
      });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [ingotClaimQueue]);

  const dividerGlyphs = useMemo(
    () => Array.from({ length: DIVIDER_RUNES.length * DIVIDER_REPEAT }, (_, i) => DIVIDER_RUNES[i % DIVIDER_RUNES.length]),
    [],
  );

  const miningRunningCount = mineSlots.filter(slot => slot.card && slot.startedAt).length;
  const queueHasOre = hasQueuedOre(mineClaimQueue);
  const queueHasIngots = ORE_TYPES.some(ore => (ingotClaimQueue[ore.ingotId] ?? 0) > 0);
  const forgeReadyCount = forgeCardSlots.reduce((count, slot, index) => {
    const oreSlot = forgeOreSlots[index];
    const ingredientSlot = forgeIngredientSlots[index];
    const fuelSlot = forgeFuelSlots[index];
    const recipe = oreSlot?.oreType ? SMELT_RECIPES[oreSlot.oreType] : null;
    const oreRequired = recipe?.oreCount ?? 4;
    const ingredientRequired = recipe?.ingredient ?? null;
    const ingredientOk = !ingredientRequired || (ingredientSlot?.ingotType === ingredientRequired.type && (ingredientSlot?.count ?? 0) >= ingredientRequired.count);
    return count + (slot?.card && oreSlot?.oreType && (oreSlot.count ?? 0) >= oreRequired && ingredientOk && (fuelSlot?.loadedCoal ?? 0) > 0 ? 1 : 0);
  }, 0);

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

  function flyToTarget(elementMap, targetEl) {
    if (!targetEl) return 0;
    const targetRect = targetEl.getBoundingClientRect();
    const tx = targetRect.left + targetRect.width / 2;
    const ty = targetRect.top + targetRect.height / 2;
    let count = 0;
    Object.values(elementMap).forEach(el => {
      if (!el) return;
      el.style.animation = 'none';
      const rect = el.getBoundingClientRect();
      // Re-pin as fixed at exact viewport position so it paints above all stacking contexts
      el.style.position = 'fixed';
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      el.style.margin = '0';
      el.style.zIndex = '99999';
      el.getBoundingClientRect(); // force reflow
      const dx = tx - (rect.left + rect.width / 2);
      const dy = ty - (rect.top + rect.height / 2);
      el.style.transition = `transform 0.5s ease ${count * 0.07}s, opacity 0.4s ease ${count * 0.07 + 0.1}s`;
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0.05)`;
      el.style.opacity = '0';
      count++;
    });
    return count;
  }

  function handleCollectQueue() {
    if (isCollecting || typeof onCollectMinedOre !== 'function' || !queueHasOre) return;
    setIsCollecting(true);
    const activeRefs = Object.fromEntries(
      Object.entries(queueSlotRefs.current).filter(([id]) => (mineClaimQueue[id] ?? 0) > 0 && queueSlotRefs.current[id]),
    );
    flyToTarget(activeRefs, collectTargetRef?.current ?? null);
    collectTimeoutRef.current = window.setTimeout(() => {
      onCollectMinedOre();
      setIsCollecting(false);
    }, 600);
  }

  function handleCollectIngots() {
    if (typeof onCollectIngots !== 'function' || !queueHasIngots) return;
    const activeRefs = Object.fromEntries(
      Object.entries(ingotOutputRefs.current).filter(([, el]) => el !== null && el !== undefined),
    );
    flyToTarget(activeRefs, collectTargetRef?.current ?? null);
    collectTimeoutRef.current = window.setTimeout(() => {
      onCollectIngots();
      // Reset inline styles flyToTarget set so re-rendered nodes remain visible
      requestAnimationFrame(() => {
        Object.values(ingotOutputRefs.current).forEach(el => {
          if (!el) return;
          el.style.cssText = '';
        });
      });
    }, 600);
  }

  return (
    <div className="foundry-page">
      <HoverCardPreview preview={hoverPreview} />
      <div className="foundry-header">
        <h2 className="foundry-title">Foundry</h2>
        <p className="foundry-subtitle">Socket pocket cards into the mine. Smelt collected ore into ingots.</p>
      </div>

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

              <div className="foundry-action-row">
                <p className="foundry-action-hint">
                  {miningRunningCount > 0
                    ? `${miningRunningCount} slot${miningRunningCount === 1 ? '' : 's'} mining`
                    : pocket.length > 0
                      ? 'Drag a card from Pocket into an open mine slot'
                      : 'Pocket a card first, then socket it into the mine'}
                </p>
              </div>

              <div className="foundry-queue">
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
                <div className="foundry-queue-slots">
                  {ORE_TYPES.filter(ore => (mineClaimQueue[ore.id] ?? 0) > 0).map(ore => (
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
                <p className="foundry-half__label">Load cards, fuel the forge with coal, then pair ores to smelt ingots.</p>
              </div>

              <div className="foundry-forge-rows">
                {forgeCardSlots.map((slot, index) => (
                  <ForgeSmeltingRow
                    key={`forge-row-${slot.slotId}`}
                    slot={slot}
                    oreSlot={forgeOreSlots[index]}
                    ingredientSlot={forgeIngredientSlots[index]}
                    fuelSlot={forgeFuelSlots[index]}
                    now={now}
                    ingotClaimQueue={ingotClaimQueue}
                    queueGainByIngot={queueGainByIngot}
                    outputTileRef={el => { ingotOutputRefs.current[index] = el; }}
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
                    onCollect={handleCollectIngots}
                  />
                ))}
              </div>

              <div className="foundry-action-row foundry-action-row--forge">
                <p className={`foundry-action-hint${forgeReadyCount === 0 ? ' foundry-action-hint--warn' : ''}`}>
                  {forgeReadyCount > 0
                    ? `${forgeReadyCount} forge row${forgeReadyCount === 1 ? '' : 's'} ready · arrow fills as smelting completes`
                    : forgeFuelSlots.every(slot => (slot?.loadedCoal ?? 0) <= 0)
                      ? 'Load coal into any forge row, then place ore'
                      : 'Socket cards and place ore from the resource pocket to begin'}
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
