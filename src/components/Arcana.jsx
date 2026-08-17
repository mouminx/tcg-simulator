import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ARCANA_ITEMS_BY_ID, ESSENCES_BY_ID, parseElementResourceId } from '../game/arcana';
import { INGOT_RESOURCES, ORE_TYPES } from '../game/foundry';
import {
  CRAFTED_RESOURCES_BY_ID,
  CRAFTING_RESOURCE_SOURCES,
  createCraftingCardSlots,
  createCraftingGridSlots,
  findCraftingRecipe,
  getCraftingResult,
  getMaxCraftableCount,
} from '../game/crafting';
import { GATHERED_ONLY_RESOURCES, PROCESSED_RESOURCES } from '../game/wilderness';
import {
  getArcanaResourceArt,
  getCraftedArt,
  getIngotArt,
  getOreArt,
  getResourceArt,
} from '../game/resourceArt';
import CardFace from './CardFace';
import { socketedCardDragProps } from './CardPocket';
import ResourceQuantityPopover from './ResourceQuantityPopover';
import ToolCard from './ToolCard';
import LootTierBadge from './LootTierBadge';
import { TOOL_TIER_LABELS, TOOL_TYPES } from '../game/tools';
import { getLootTier } from '../game/lootTiers';

const CRAFTER_LABELS = ['Crafter I', 'Crafter II', 'Crafter III', 'Crafter IV', 'Crafter V'];
const CRAFTING_DIVIDER_RUNES = ['ᚠ', 'ᚱ', 'ᚨ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛞ', 'ᛟ', 'ᚲ', 'ᛗ', 'ᛚ'];
const CRAFTING_GRID_RUNES = ['ᚦ', 'ᛉ', 'ᚾ', 'ᛃ', 'ᚱ', 'ᛇ', 'ᚹ', 'ᛏ', 'ᛒ'];
const RESOURCE_META = {
  ore: Object.fromEntries(ORE_TYPES.map(resource => [resource.id, resource])),
  ingot: INGOT_RESOURCES,
  gathered: Object.fromEntries(GATHERED_ONLY_RESOURCES.map(resource => [resource.id, resource])),
  processed: Object.fromEntries(PROCESSED_RESOURCES.map(resource => [resource.id, resource])),
  crafted: CRAFTED_RESOURCES_BY_ID,
};

function titleCase(value = '') {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getResourceMeta(slot) {
  if (!slot?.id || !slot.source) return null;
  if (slot.source === 'arcana') {
    const { elementId, tier } = parseElementResourceId(slot.id);
    const essence = ESSENCES_BY_ID[elementId];
    const base = essence?.name?.replace(/ Essence$/i, '') ?? titleCase(elementId);
    return {
      name: tier === 'essence' ? `${base} Essence` : `${base} ${titleCase(tier)}`,
      color: essence?.color ?? '#9cc9ff',
      art: getArcanaResourceArt(slot.id),
      description: essence?.description ?? '',
      tier: getLootTier('arcana', slot.id),
    };
  }
  const definition = RESOURCE_META[slot.source]?.[slot.id];
  const art = slot.source === 'ore'
    ? getOreArt(slot.id)
    : slot.source === 'ingot'
      ? getIngotArt(definition?.artKey ?? slot.id)
      : slot.source === 'crafted'
        ? getCraftedArt(definition?.artKey ?? slot.id)
        : getResourceArt(definition?.artKey ?? slot.id);
  return {
    name: definition?.name ?? slot.name ?? titleCase(slot.id),
    color: definition?.color ?? '#c9a85f',
    art,
    description: definition?.description ?? '',
    tier: getLootTier(slot.source, slot.id, definition),
  };
}

function CraftingResourceCard({ meta, count, className = '', tooltipNote = '', tier = null }) {
  const [tipPos, setTipPos] = useState(null);
  const [clampedPos, setClampedPos] = useState(null);
  const tipRef = useRef(null);

  useLayoutEffect(() => {
    if (!tipPos || !tipRef.current) {
      setClampedPos(null);
      return;
    }
    const { width, height } = tipRef.current.getBoundingClientRect();
    const offset = 14;
    let x = tipPos.x + offset;
    let y = tipPos.y + offset;
    if (x + width > window.innerWidth - 8) x = tipPos.x - width - offset;
    if (y + height > window.innerHeight - 8) y = tipPos.y - height - offset;
    setClampedPos({ x, y });
  }, [tipPos]);

  function updateTooltip(event) {
    setTipPos({ x: event.clientX, y: event.clientY });
  }

  const displayedTier = tier ?? meta.tier ?? null;

  return (
    <>
      <div
        className={`card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned crafting-resource-card ${className}`.trim()}
        onMouseEnter={updateTooltip}
        onMouseMove={updateTooltip}
        onMouseLeave={() => setTipPos(null)}
      >
        <div className="card-face-inner">
          <div className="card-face-front foundry-square-resource__front">
            <div className="foundry-square-resource__header foundry-square-resource__header--count-only">
              <span className="foundry-square-resource__count crafting-material-slot__count">{count}</span>
            </div>
            <div className="foundry-square-resource__art-wrap" style={{ '--material-color': meta.color }}>
              {meta.art
                ? <img src={meta.art} alt={meta.name} className="foundry-square-resource__art" />
                : <span className="crafting-resource-card__fallback">{meta.name.charAt(0)}</span>}
            </div>
            <LootTierBadge tier={displayedTier} />
          </div>
        </div>
      </div>
      {tipPos && createPortal(
        <div
          ref={tipRef}
          className="resource-tooltip"
          style={{ left: (clampedPos ?? tipPos).x, top: (clampedPos ?? tipPos).y }}
        >
          <span className="resource-tooltip__name">{meta.name}</span>
          {meta.description && <span className="resource-tooltip__desc">{meta.description}</span>}
          {tooltipNote && <span className="resource-tooltip__desc crafting-resource-tooltip__action">{tooltipNote}</span>}
        </div>,
        document.body,
      )}
    </>
  );
}

function CrafterSlot({ slot, onSocket, onUnsocket }) {
  const card = slot.card;

  function handleDrop(event) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData('text/plain');
    if (cardId) onSocket?.(cardId, slot.slotId);
  }

  return (
    <div
      className={`crafting-crafter-slot${card ? ' crafting-crafter-slot--filled' : ''}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('text/plain')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={handleDrop}
    >
      <div className="crafting-crafter-slot__heading">
        <span>{CRAFTER_LABELS[slot.slotId - 1]}</span>
        <small>{card ? titleCase(card.classType) : 'Unit slot'}</small>
      </div>
      {card ? (
        <div className="crafting-crafter-slot__body">
          <div className="crafting-crafter-slot__card" {...socketedCardDragProps(card)}>
            <CardFace card={card} visualMode="compact" className="no-twirl" />
          </div>
          <button
            type="button"
            className="crafting-slot-remove"
            onClick={() => onUnsocket?.(slot.slotId)}
            aria-label={`Remove ${card.name} from crafting`}
          >
            ×
          </button>
        </div>
      ) : (
        <div className="crafting-crafter-slot__empty">
          <span aria-hidden="true">◇</span>
          <p>Drag a unit from your Hand</p>
        </div>
      )}
    </div>
  );
}

function MaterialSlot({
  slot,
  carriedResource,
  isDistributionTarget,
  onBeginDistribution,
  onOpenSplit,
  onUnload,
}) {
  const meta = getResourceMeta(slot);
  const canPlace = carriedResource
    && CRAFTING_RESOURCE_SOURCES.includes(carriedResource.source)
    && (!slot.id || (slot.id === carriedResource.id && slot.source === carriedResource.source));

  return (
    <div
      className={[
        'crafting-material-slot',
        slot.id ? 'crafting-material-slot--filled' : 'crafting-material-slot--empty',
        canPlace ? 'crafting-material-slot--ready' : '',
        isDistributionTarget ? 'crafting-material-slot--distribution-target' : '',
      ].filter(Boolean).join(' ')}
      data-resource-drop-target="crafting-grid-slot"
      data-crafting-slot-id={slot.slotId}
      onPointerDown={event => {
        if (event.button !== 0 || !canPlace) return;
        onBeginDistribution?.(event, slot.slotId);
      }}
      onContextMenu={event => {
        event.preventDefault();
        event.stopPropagation();
        if (!meta || !(slot.count > 0) || carriedResource) return;
        onOpenSplit?.({
          slotId: slot.slotId,
          name: meta.name,
          max: slot.count,
          position: { x: event.clientX + 10, y: event.clientY + 10 },
        });
      }}
      aria-label={meta ? `${meta.name}, ${slot.count}` : 'Empty crafting material slot'}
    >
      {meta ? (
        <>
          <CraftingResourceCard meta={meta} count={slot.count} />
          <button
            type="button"
            className="crafting-material-slot__remove"
            onPointerDown={event => event.stopPropagation()}
            onClick={() => onUnload?.(slot.slotId)}
            aria-label={`Return ${slot.count} ${meta.name} to the Bag`}
          >
            ×
          </button>
        </>
      ) : (
        <span className="crafting-material-slot__rune" aria-hidden="true">
          {CRAFTING_GRID_RUNES[(slot.slotId - 1) % CRAFTING_GRID_RUNES.length]}
        </span>
      )}
    </div>
  );
}

export default function Arcana({
  craftingCardSlots = createCraftingCardSlots(),
  craftingGridSlots = createCraftingGridSlots(),
  carriedResource = null,
  onSocketCard,
  onUnsocketCard,
  onLoadMaterial,
  onDistributeMaterial,
  onPickUpMaterial,
  onUnloadMaterial,
  onClearMaterials,
  onCraft,
}) {
  const matrixRef = useRef(null);
  const distributionRef = useRef(null);
  const [distributionSlotIds, setDistributionSlotIds] = useState([]);
  const [splitPopover, setSplitPopover] = useState(null);
  const filledMaterials = craftingGridSlots.filter(slot => slot.id && slot.count > 0).length;
  const matchedRecipe = findCraftingRecipe(craftingGridSlots);
  const previewOutput = getCraftingResult(craftingGridSlots);
  const resultDefinition = matchedRecipe && !previewOutput?.kind ? CRAFTED_RESOURCES_BY_ID[matchedRecipe.output.id] : null;
  const resultMeta = previewOutput?.kind === 'arcana'
    ? getResourceMeta({ source: 'arcana', id: previewOutput.id, name: previewOutput.id })
    : previewOutput?.kind === 'gathered'
      ? getResourceMeta({ source: 'gathered', id: previewOutput.id, name: previewOutput.id })
    : resultDefinition ? {
      ...resultDefinition,
      art: getCraftedArt(resultDefinition.artKey),
    } : null;
  const tieredResultDefinition = previewOutput?.kind === 'tieredCrafted'
    ? CRAFTED_RESOURCES_BY_ID[previewOutput.id]
    : null;
  const tieredResultMeta = tieredResultDefinition ? {
    ...tieredResultDefinition,
    art: getCraftedArt(tieredResultDefinition.artKey),
  } : null;
  const callingResultDefinition = previewOutput?.kind === 'calling'
    ? ARCANA_ITEMS_BY_ID[previewOutput.id]
    : null;
  const callingResultMeta = callingResultDefinition ? {
    ...callingResultDefinition,
    color: '#8d6aae',
    art: getCraftedArt(callingResultDefinition.artKey),
  } : null;
  const toolDefinition = previewOutput?.kind === 'tool' ? TOOL_TYPES[previewOutput.toolType] : null;
  const toolPreview = toolDefinition ? {
    id: `preview-${toolDefinition.id}`,
    itemType: 'tool',
    toolType: toolDefinition.id,
    name: toolDefinition.name,
    artKey: toolDefinition.artKey,
    tier: previewOutput.tier,
    materialQuality: previewOutput.materialQuality,
    affixes: [],
  } : null;
  const maxCraftable = getMaxCraftableCount(craftingGridSlots);

  function slotAcceptsCarriedResource(slotId) {
    if (!carriedResource || !CRAFTING_RESOURCE_SOURCES.includes(carriedResource.source)) return false;
    const slot = craftingGridSlots.find(entry => entry.slotId === Number(slotId));
    return Boolean(slot) && (!slot.id || (slot.id === carriedResource.id && slot.source === carriedResource.source));
  }

  function beginDistribution(event, slotId) {
    if (!slotAcceptsCarriedResource(slotId)) return;
    event.preventDefault();
    event.stopPropagation();
    distributionRef.current = { pointerId: event.pointerId, slotIds: [slotId] };
    setDistributionSlotIds([slotId]);
    matrixRef.current?.setPointerCapture?.(event.pointerId);
  }

  function extendDistribution(event) {
    const gesture = distributionRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-crafting-slot-id]');
    if (!target || !matrixRef.current?.contains(target)) return;
    const slotId = Number(target.dataset.craftingSlotId);
    if (!slotAcceptsCarriedResource(slotId) || gesture.slotIds.includes(slotId)) return;
    if (gesture.slotIds.length >= (carriedResource?.count ?? 0)) return;
    gesture.slotIds = [...gesture.slotIds, slotId];
    setDistributionSlotIds(gesture.slotIds);
  }

  function finishDistribution(event, cancelled = false) {
    const gesture = distributionRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    distributionRef.current = null;
    setDistributionSlotIds([]);
    if (matrixRef.current?.hasPointerCapture?.(event.pointerId)) {
      matrixRef.current.releasePointerCapture(event.pointerId);
    }
    if (cancelled) return;
    (onDistributeMaterial ?? (slotIds => onLoadMaterial?.(slotIds[0])))?.(gesture.slotIds);
  }

  return (
    <section className="crafting-page" aria-label="Crafting">
      <div className="crafting-workbench">
        <aside className="crafting-crafters" aria-label="Crafter card slots">
          <div className="crafting-section-heading">
            <span>Artisans</span>
          </div>
          <div className="crafting-crafters__stack">
            {craftingCardSlots.map(slot => (
              <CrafterSlot
                key={slot.slotId}
                slot={slot}
                onSocket={onSocketCard}
                onUnsocket={onUnsocketCard}
              />
            ))}
          </div>
        </aside>

        <div className="crafting-rune-divider crafting-rune-divider--horizontal" aria-hidden="true">
          <span className="crafting-rune-divider__sigil">ᛟ</span>
          <div className="crafting-rune-divider__stream">
            {CRAFTING_DIVIDER_RUNES.map((rune, index) => <span key={`${rune}-${index}`}>{rune}</span>)}
          </div>
        </div>

        <div className="crafting-pattern-workspace">
          <div className="crafting-matrix-panel">
            <div className="crafting-section-heading">
              <span>Pattern</span>
            </div>
            <div className="crafting-matrix-frame">
              <div
                ref={matrixRef}
                className="crafting-matrix"
                aria-label="3 by 3 crafting grid"
                onPointerMove={extendDistribution}
                onPointerUp={event => finishDistribution(event)}
                onPointerCancel={event => finishDistribution(event, true)}
              >
                {craftingGridSlots.map(slot => (
                  <MaterialSlot
                    key={slot.slotId}
                    slot={slot}
                    carriedResource={carriedResource}
                    isDistributionTarget={distributionSlotIds.includes(slot.slotId)}
                    onBeginDistribution={beginDistribution}
                    onOpenSplit={setSplitPopover}
                    onUnload={onUnloadMaterial}
                  />
                ))}
              </div>
              <div className="crafting-matrix-frame__corners" aria-hidden="true" />
            </div>
            <div className="crafting-matrix-panel__footer">
              <button
                type="button"
                className="crafting-clear-button"
                onClick={onClearMaterials}
                disabled={filledMaterials === 0}
              >
                Return all
              </button>
            </div>
          </div>

          <aside className="crafting-result-panel" aria-label="Crafting result">
            <div className="crafting-section-heading crafting-result-panel__spacer" aria-hidden="true">
              <span>Pattern</span>
            </div>
            <div className="crafting-result-flow">
              {resultMeta || tieredResultMeta || callingResultMeta || toolPreview ? (
                <button
                  type="button"
                  className="crafting-result-slot crafting-result-slot--ready"
                  onClick={event => onCraft?.({ max: event.shiftKey })}
                  aria-label={`Craft ${resultMeta?.name ?? tieredResultMeta?.name ?? callingResultMeta?.name ?? toolPreview.name}`}
                >
                  {toolPreview ? (
                    <ToolCard
                      tool={toolPreview}
                      className="crafting-result-card crafting-result-tool-card"
                      tooltipNote={`Material score ${previewOutput.materialScore}/${previewOutput.maximumMaterialScore} · Tier ${TOOL_TIER_LABELS[previewOutput.tier]} · ${previewOutput.tier} affix${previewOutput.tier === 1 ? '' : 'es'} when crafted.`}
                    />
                  ) : (
                    <CraftingResourceCard
                      meta={resultMeta ?? tieredResultMeta ?? callingResultMeta}
                      count={matchedRecipe.output.count}
                      className="crafting-result-card"
                      tier={['tieredCrafted', 'calling'].includes(previewOutput?.kind) ? previewOutput.tier : null}
                      tooltipNote={previewOutput?.kind === 'tieredCrafted'
                        ? `Material score ${previewOutput.materialScore}/${previewOutput.maximumMaterialScore} · Tier ${TOOL_TIER_LABELS[previewOutput.tier]}. Click to craft one. Shift-click to craft all ${maxCraftable}.`
                        : previewOutput?.kind === 'calling'
                          ? `Inherits Tier ${TOOL_TIER_LABELS[previewOutput.tier]} from its Empty Calling. Click to craft one. Shift-click to craft all ${maxCraftable}.`
                        : `Click to craft ${matchedRecipe.output.count}. Shift-click to craft all ${maxCraftable * matchedRecipe.output.count}.`}
                    />
                  )}
                </button>
              ) : (
                <div className="crafting-result-slot crafting-result-slot--empty" aria-label="No crafting result">
                  <span className="crafting-result-slot__glyph" aria-hidden="true">✦</span>
                </div>
              )}
            </div>
            <span className="crafting-result-label">Result</span>
          </aside>
        </div>
      </div>
      <ResourceQuantityPopover
        open={Boolean(splitPopover) && !carriedResource}
        position={splitPopover?.position ?? { x: 0, y: 0 }}
        title={splitPopover ? `Carry ${splitPopover.name}` : 'Carry Material'}
        max={splitPopover?.max ?? 0}
        mode="carry"
        onCancel={() => setSplitPopover(null)}
        onConfirm={amount => {
          if (!splitPopover) return;
          onPickUpMaterial?.(splitPopover.slotId, amount);
          setSplitPopover(null);
        }}
      />
    </section>
  );
}
