import { useMemo, useState } from 'react';
import ResourceQuantityPopover from './ResourceQuantityPopover';
import LootTierBadge from './LootTierBadge';
import { getLootTier } from '../game/lootTiers';

const ORE_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/ores/*.webp', { eager: true, import: 'default' })).map(([path, src]) => [
    path.split('/').pop().replace(/\s+ore\.webp$/i, '').toLowerCase(),
    src,
  ]),
);

const INGOT_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/ingots/*.webp', { eager: true, import: 'default' })).map(([path, src]) => [
    path.split('/').pop().replace(/\.webp$/, '').toLowerCase(),
    src,
  ]),
);

const WILDERNESS_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/resources/*.webp', { eager: true, import: 'default' })).map(([path, src]) => [
    path.split('/').pop().replace(/\.webp$/, '').toLowerCase(),
    src,
  ]),
);

function getResourceArt(entry) {
  if (entry.source === 'ore') return ORE_ART[entry.id] ?? null;
  if (entry.source === 'ingot') return INGOT_ART[entry.id] ?? null;
  return WILDERNESS_ART[entry.name.toLowerCase()] ?? WILDERNESS_ART[entry.id.toLowerCase()] ?? null;
}

function fmtCount(count) {
  return new Intl.NumberFormat('en-US').format(count ?? 0);
}

function ResourcePocketTile({ entry, onRemove, onBeginCarry }) {
  const artSrc = useMemo(() => getResourceArt(entry), [entry]);

  function handleOpenCarry(event) {
    event.preventDefault();
    event.stopPropagation();
    onBeginCarry?.(event, entry);
  }

  return (
    <div
      className="resource-pocket__card-shell"
      onMouseDown={event => {
        if (event.button === 2) handleOpenCarry(event);
      }}
      onContextMenu={handleOpenCarry}
      title={`${entry.name} · ${fmtCount(entry.count)}`}
    >
      <div
        className="resource-pocket__card-frame card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned foundry-square-resource--sidebar"
        onMouseDown={event => {
          if (event.button === 2) handleOpenCarry(event);
        }}
        onContextMenu={handleOpenCarry}
      >
        <div className="card-face-inner">
          <div className="card-face-front foundry-square-resource__front">
            <div className="foundry-square-resource__header">
              <span className="foundry-square-resource__name">{entry.name}</span>
              <span className="foundry-square-resource__count">{fmtCount(entry.count)}</span>
            </div>
            <div className="foundry-square-resource__art-wrap">
              {artSrc ? (
                <img src={artSrc} alt={entry.name} className="foundry-square-resource__art" />
              ) : null}
            </div>
            <LootTierBadge tier={getLootTier(entry.source, entry.id, entry)} />
          </div>
        </div>
        <button
          className="resource-pocket__card-remove"
          onClick={event => {
            event.stopPropagation();
            onRemove(entry.key);
          }}
          aria-label={`Remove ${entry.name} from resource pocket`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function ResourcePocket({ pocket = [], onRemove, onBeginCarry }) {
  const [expanded, setExpanded] = useState(true);
  const [carryPopover, setCarryPopover] = useState(null);

  return (
    <>
      <ResourceQuantityPopover
        open={Boolean(carryPopover)}
        position={carryPopover?.position ?? { x: 0, y: 0 }}
        title={carryPopover ? `Carry ${carryPopover.entry.name}` : ''}
        max={carryPopover?.entry?.count ?? 0}
        mode="carry"
        onCancel={() => setCarryPopover(null)}
        onConfirm={amount => {
          if (!carryPopover) return;
          carryPopover.onConfirm?.(carryPopover.entry, amount);
          setCarryPopover(null);
        }}
      />
      <div className={`card-pocket card-pocket--resource card-pocket--left${expanded ? ' card-pocket--expanded' : ''}`}>
      <button
        className="card-pocket__header"
        onClick={() => setExpanded(current => !current)}
        aria-expanded={expanded}
      >
        <span className="card-pocket__header-rune" aria-hidden="true">⬡</span>
        <span className="card-pocket__title">Resources</span>
        <span className="card-pocket__count">{pocket.length} stacks</span>
        <span className="card-pocket__chevron" aria-hidden="true">
          {expanded ? '▾' : '▴'}
        </span>
      </button>

      <div className={`card-pocket__body resource-pocket__body${expanded ? '' : ' card-pocket__body--collapsed'}`}>
        {pocket.length === 0 ? (
          <p className="card-pocket__empty-hint">Right-click a resource to stash it here</p>
        ) : (
          <div className="resource-pocket__cards">
            <div className="resource-pocket__cards-track">
              {pocket.map(entry => (
                <ResourcePocketTile
                  key={entry.key}
                  entry={entry}
                  onRemove={onRemove}
                  onBeginCarry={(event, nextEntry) => {
                    setCarryPopover({
                      entry: nextEntry,
                      position: { x: event.clientX + 10, y: event.clientY + 10 },
                      onConfirm: onBeginCarry,
                    });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
