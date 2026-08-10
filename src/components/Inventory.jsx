import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ORE_TYPES, INGOT_RESOURCES } from '../game/foundry';
import { GATHERED_ONLY_RESOURCES, PROCESSED_RESOURCES } from '../game/wilderness';
import {
  CHARMS,
  CATALYSTS,
  SIGILS,
  ESSENCES_BY_ID,
  getElementResourceDescription,
  parseElementResourceId,
} from '../game/arcana';
import ResourceQuantityPopover from './ResourceQuantityPopover';
// Moved to `game/resourceArt.js` so the shop's Goods shelf can draw the same cards. See that file for why
// ore and ingot art must stay in separate maps.
import {
  getArcanaResourceArt,
  getIngotArt,
  getOreArt,
  getResourceArt,
} from '../game/resourceArt';

/**
 * Drawstring sack — the tab's identity marker. Inline rather than an asset so it
 * inherits `currentColor` from the tab's hover/active states.
 */
function SackIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {/* Cinched neck, gathered by the drawstring */}
      <path
        d="M10.1 2.4c1.2.7 2.6.7 3.8 0l.7 3.5H9.4z"
        fill="currentColor"
        opacity="0.72"
      />
      {/* Drawstring band */}
      <rect x="8.3" y="5.5" width="7.4" height="2" rx="1" fill="currentColor" />
      {/* Body — narrow at the tie, bulging toward the base */}
      <path
        d="M9.7 7.7C6.5 9.7 3.5 12.8 3.5 16.1c0 3.7 3.9 5.8 8.5 5.8s8.5-2.1 8.5-5.8c0-3.3-3-6.4-6.2-8.4z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}


function fmtCount(count) {
  return new Intl.NumberFormat('en-US').format(count ?? 0);
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatArcanaResourceName(resourceId) {
  const { elementId, tier } = parseElementResourceId(resourceId);
  const essence = ESSENCES_BY_ID[elementId];
  if (!essence) return resourceId;
  const base = essence.name.replace(/ Essence$/i, '');
  return tier === 'essence' ? essence.name : `${base} ${titleCase(tier)}`;
}

function ResourceTile({ name, artSrc, count, description = '', onContextMenu, onClick, dataDropTarget, tileRef, draggable = false, onDragStart = null }) {
  const [tipPos, setTipPos] = useState(null);
  const [clampedPos, setClampedPos] = useState(null);
  const [displayCount, setDisplayCount] = useState(count ?? 0);
  const [countAnimating, setCountAnimating] = useState(false);
  const tipRef = useRef(null);
  const previousCountRef = useRef(count ?? 0);

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

  useEffect(() => {
    const nextCount = count ?? 0;
    const previousCount = previousCountRef.current;

    if (nextCount === previousCount) {
      setDisplayCount(nextCount);
      return undefined;
    }

    previousCountRef.current = nextCount;

    if (nextCount < previousCount) {
      setCountAnimating(false);
      setDisplayCount(nextCount);
      return undefined;
    }

    const duration = 420;
    const delta = nextCount - previousCount;
    let frameId = 0;
    let timeoutId = 0;
    const start = performance.now();

    setCountAnimating(true);

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = previousCount + Math.round(delta * eased);
      setDisplayCount(current);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplayCount(nextCount);
        timeoutId = window.setTimeout(() => setCountAnimating(false), 180);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [count]);

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
        className={`card-face-wrapper no-twirl foundry-square-resource inventory-tile${count > 0 ? ' foundry-square-resource--owned' : ' foundry-square-resource--empty'}`}
      >
        <div className="card-face-inner">
          <div className="card-face-front foundry-square-resource__front">
            <div className="foundry-square-resource__header foundry-square-resource__header--count-only">
              <span className={`foundry-square-resource__count${countAnimating ? ' foundry-square-resource__count--updating' : ''}`}>{fmtCount(displayCount)}</span>
            </div>
            <div className="foundry-square-resource__art-wrap">
              {artSrc && <img src={artSrc} alt={name} className="foundry-square-resource__art" />}
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

function InventorySection({ title, total, children }) {
  return (
    <div className="inventory-section">
      <div className="inventory-section__head">
        <span className="inventory-section__title">{title}</span>
        <span className="inventory-section__count">{total}</span>
      </div>
      <div className="inventory-section__grid">
        {children}
      </div>
    </div>
  );
}

export default function Inventory({
  inventoryRef = null,
  resources = {},
  oreInventory = {},
  ingotInventory = {},
  gatheredInventory = {},
  processedInventory = {},
  arcanaInventory = [],
  onBeginCarry,
  onPlaceCarriedResource,
  carriedResource = null,
  open = true,
  onToggle,
}) {
  const [carryPopover, setCarryPopover] = useState(null);

  const ores = ORE_TYPES.filter(ore => (oreInventory[ore.id] ?? 0) > 0);
  const ingots = ORE_TYPES.filter(ore => (ingotInventory[ore.ingotId] ?? 0) > 0);
  /**
   * `GATHERED_ONLY_RESOURCES`, not `ALL_GATHERING_RESOURCES`. The gathering pools duplicate every ore
   * and ingot under their own ids, so the full list made this section a catch-all that showed Steel
   * Ingots and Iron Ore under "Gathered" while dedicated Ingots and Ores sections sat right above it.
   * Production now folds those into the canonical inventories (see GATHERED_CANONICAL_TARGET), and
   * filtering here keeps a stale save from re-displaying them in the wrong place before its migration
   * has been written back.
   */
  const gathered = GATHERED_ONLY_RESOURCES.filter(r => (gatheredInventory[r.id] ?? 0) > 0);
  const processed = PROCESSED_RESOURCES.filter(r => (processedInventory[r.id] ?? 0) > 0);
  const arcanaResources = Object.entries(resources)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([resourceId, count]) => {
      const { elementId, tier } = parseElementResourceId(resourceId);
      const essence = ESSENCES_BY_ID[elementId];
      return {
        resourceId,
        elementId,
        tier,
        name: formatArcanaResourceName(resourceId),
        count,
        description: getElementResourceDescription(resourceId) || essence?.description || '',
        artKey: elementId,
      };
    });

  const oreTotal = ORE_TYPES.reduce((sum, ore) => sum + (oreInventory[ore.id] ?? 0), 0);
  const ingotTotal = ORE_TYPES.reduce((sum, ore) => sum + (ingotInventory[ore.ingotId] ?? 0), 0);
  const gatheredTotal = GATHERED_ONLY_RESOURCES.reduce((sum, r) => sum + (gatheredInventory[r.id] ?? 0), 0);
  const processedTotal = PROCESSED_RESOURCES.reduce((sum, r) => sum + (processedInventory[r.id] ?? 0), 0);
  const arcanaResourceTotal = arcanaResources.reduce((sum, resource) => sum + (resource.count ?? 0), 0);
  const grandTotal = oreTotal + ingotTotal + gatheredTotal + processedTotal + arcanaResourceTotal + (arcanaInventory?.length ?? 0);

  const arcanaCounts = arcanaInventory.reduce((acc, item) => {
    acc[item.itemId] = (acc[item.itemId] ?? 0) + 1;
    return acc;
  }, {});
  const ALL_ARCANA_ITEMS = [...CHARMS, ...CATALYSTS, ...SIGILS];
  const arcanaItems = ALL_ARCANA_ITEMS.filter(item => (arcanaCounts[item.id] ?? 0) > 0);
  const arcanaTotal = arcanaResourceTotal + arcanaItems.reduce((sum, item) => sum + (arcanaCounts[item.id] ?? 0), 0);

  return (
    <>
      <div className={`inventory-panel${open ? ' inventory-panel--open' : ''}`}>
        <button
          className="drawer-tab inventory-toggle"
          onClick={onToggle}
          title={open ? 'Close bag' : 'Open bag'}
          aria-label={open ? 'Close bag' : 'Open bag'}
          aria-expanded={open}
        >
          <span className="drawer-tab__row">
            <span className="drawer-tab__chevron" aria-hidden="true">{open ? '›' : '‹'}</span>
            <SackIcon className="drawer-tab__icon" />
          </span>
          <span className="drawer-tab__name">
            Bag{grandTotal > 0 ? ` ${grandTotal}` : ''}
          </span>
        </button>

        <div className="inventory-panel__body">
          <div ref={inventoryRef} className="inventory-panel__head">
            <span className="inventory-panel__title">Inventory</span>
            <span className="inventory-panel__total">{grandTotal}</span>
          </div>

          {/* Only mounted while open. The panel holds ~80 resource icons; leaving
              them mounted behind a collapsed panel kept every one of those images
              decoded in memory for nothing. Section totals in the header above are
              plain numbers and stay visible either way. */}
          {open && (
          <div className="inventory-panel__scroll">
            <InventorySection title="Ores" total={oreTotal}>
              {ores.length > 0 ? ores.map(ore => (
                <ResourceTile
                  key={ore.id}
                  name={ore.name}
                  artSrc={getOreArt(ore.id)}
                  count={oreInventory[ore.id] ?? 0}
                  description={ore.description}
                  onContextMenu={e => {
                    e.preventDefault();
                    if ((oreInventory[ore.id] ?? 0) <= 0) return;
                    setCarryPopover({ source: 'ore', id: ore.id, name: ore.name, max: oreInventory[ore.id] ?? 0, position: { x: e.clientX + 10, y: e.clientY + 10 } });
                  }}
                  onClick={() => {
                    const count = oreInventory[ore.id] ?? 0;
                    if (carriedResource) { onPlaceCarriedResource?.({ source: 'ore', id: ore.id }); }
                    else if (count > 0) { onBeginCarry?.({ source: 'ore', id: ore.id, name: ore.name, amount: count }); }
                  }}
                  dataDropTarget={`ore:${ore.id}`}
                />
              )) : <p className="inventory-empty">No ores collected</p>}
            </InventorySection>

            <InventorySection title="Ingots" total={ingotTotal}>
              {ingots.length > 0 ? ingots.map(ore => {
                const ingot = INGOT_RESOURCES[ore.ingotId];
                return (
                  <ResourceTile
                    key={ore.ingotId}
                    name={ingot.name}
                    artSrc={getIngotArt(ingot.artKey)}
                    count={ingotInventory[ore.ingotId] ?? 0}
                    description={ingot.description}
                    onContextMenu={e => {
                      e.preventDefault();
                      if ((ingotInventory[ore.ingotId] ?? 0) <= 0) return;
                      setCarryPopover({ source: 'ingot', id: ore.ingotId, name: ingot.name, max: ingotInventory[ore.ingotId] ?? 0, position: { x: e.clientX + 10, y: e.clientY + 10 } });
                    }}
                    onClick={() => {
                      const count = ingotInventory[ore.ingotId] ?? 0;
                      if (carriedResource) { onPlaceCarriedResource?.({ source: 'ingot', id: ore.ingotId }); }
                      else if (count > 0) { onBeginCarry?.({ source: 'ingot', id: ore.ingotId, name: ingot.name, amount: count }); }
                    }}
                    dataDropTarget={`ingot:${ore.ingotId}`}
                  />
                );
              }) : <p className="inventory-empty">No ingots smelted</p>}
            </InventorySection>

            <InventorySection title="Gathered" total={gatheredTotal}>
              {gathered.length > 0 ? gathered.map(resource => (
                <ResourceTile
                  key={resource.id}
                  name={resource.name}
                  artSrc={getResourceArt(resource.artKey ?? resource.id)}
                  count={gatheredInventory[resource.id] ?? 0}
                  description={resource.description}
                  onContextMenu={e => {
                    e.preventDefault();
                    if ((gatheredInventory[resource.id] ?? 0) <= 0) return;
                    setCarryPopover({ source: 'gathered', id: resource.id, name: resource.name, max: gatheredInventory[resource.id] ?? 0, position: { x: e.clientX + 10, y: e.clientY + 10 } });
                  }}
                  onClick={() => {
                    const count = gatheredInventory[resource.id] ?? 0;
                    if (carriedResource) { onPlaceCarriedResource?.({ source: 'gathered', id: resource.id }); }
                    else if (count > 0) { onBeginCarry?.({ source: 'gathered', id: resource.id, name: resource.name, amount: count }); }
                  }}
                  dataDropTarget={`gathered:${resource.id}`}
                />
              )) : <p className="inventory-empty">No resources gathered</p>}
            </InventorySection>

            <InventorySection title="Processed" total={processedTotal}>
              {processed.length > 0 ? processed.map(resource => (
                <ResourceTile
                  key={resource.id}
                  name={resource.name}
                  artSrc={getResourceArt(resource.id)}
                  count={processedInventory[resource.id] ?? 0}
                  description={resource.description}
                  onContextMenu={e => {
                    e.preventDefault();
                    if ((processedInventory[resource.id] ?? 0) <= 0) return;
                    setCarryPopover({ source: 'processed', id: resource.id, name: resource.name, max: processedInventory[resource.id] ?? 0, position: { x: e.clientX + 10, y: e.clientY + 10 } });
                  }}
                  onClick={() => {
                    const count = processedInventory[resource.id] ?? 0;
                    if (carriedResource) { onPlaceCarriedResource?.({ source: 'processed', id: resource.id }); }
                    else if (count > 0) { onBeginCarry?.({ source: 'processed', id: resource.id, name: resource.name, amount: count }); }
                  }}
                  dataDropTarget={`processed:${resource.id}`}
                />
              )) : <p className="inventory-empty">Nothing processed yet</p>}
            </InventorySection>

            <InventorySection title="Arcana" total={arcanaTotal}>
              {arcanaResources.length > 0 ? arcanaResources.map(resource => (
                <ResourceTile
                  key={resource.resourceId}
                  name={resource.name}
                  artSrc={getArcanaResourceArt(resource.resourceId)}
                  count={resource.count}
                  description={resource.description}
                  onContextMenu={e => {
                    e.preventDefault();
                    if ((resource.count ?? 0) <= 0) return;
                    setCarryPopover({
                      source: 'arcana',
                      id: resource.resourceId,
                      name: resource.name,
                      max: resource.count ?? 0,
                      position: { x: e.clientX + 10, y: e.clientY + 10 },
                    });
                  }}
                  onClick={() => {
                    const count = resource.count ?? 0;
                    if (carriedResource) { onPlaceCarriedResource?.({ source: 'arcana', id: resource.resourceId }); }
                    else if (count > 0) { onBeginCarry?.({ source: 'arcana', id: resource.resourceId, name: resource.name, amount: count }); }
                  }}
                  dataDropTarget={`arcana:${resource.resourceId}`}
                  draggable
                  onDragStart={event => {
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('arcana-resource-id', resource.resourceId);
                  }}
                />
              )) : null}
              {arcanaItems.length > 0 ? arcanaItems.map(item => (
                <ResourceTile
                  key={item.id}
                  name={item.name}
                  artSrc={item.artKey ? getResourceArt(item.artKey) : null}
                  count={arcanaCounts[item.id] ?? 0}
                  description={item.description}
                  onContextMenu={e => {
                    e.preventDefault();
                    if ((arcanaCounts[item.id] ?? 0) <= 0) return;
                    setCarryPopover({
                      source: 'arcana-item',
                      id: item.id,
                      name: item.name,
                      max: arcanaCounts[item.id] ?? 0,
                      position: { x: e.clientX + 10, y: e.clientY + 10 },
                    });
                  }}
                  onClick={() => {
                    const count = arcanaCounts[item.id] ?? 0;
                    if (carriedResource) { onPlaceCarriedResource?.({ source: 'arcana-item', id: item.id }); }
                    else if (count > 0) { onBeginCarry?.({ source: 'arcana-item', id: item.id, name: item.name, amount: count }); }
                  }}
                  dataDropTarget={`arcana-item:${item.id}`}
                />
              )) : null}
              {arcanaResources.length === 0 && arcanaItems.length === 0 ? <p className="inventory-empty">No Arcana resources or crafted items</p> : null}
            </InventorySection>
          </div>
          )}
        </div>
      </div>

      <ResourceQuantityPopover
        open={Boolean(carryPopover) && !carriedResource}
        position={carryPopover?.position ?? { x: 0, y: 0 }}
        title={carryPopover ? `Carry ${carryPopover.name}` : ''}
        max={carryPopover?.max ?? 0}
        mode="carry"
        onCancel={() => setCarryPopover(null)}
        onConfirm={amount => {
          if (!carryPopover) return;
          onBeginCarry?.({ source: carryPopover.source, id: carryPopover.id, name: carryPopover.name, amount });
          setCarryPopover(null);
        }}
      />
    </>
  );
}
