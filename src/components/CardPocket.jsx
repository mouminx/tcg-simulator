import { useState } from 'react';
import CardFace from './CardFace';
import Gold from './Gold';
import HoverCardPreview, { buildHoverCardPreview } from './HoverCardPreview';

export default function CardPocket({ pocket, capacity, balance = 0, nextUnlockCost = null, onAdd, onRemove, onUnlock, positionLeft = false }) {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver]  = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);

  const pocketCards = pocket ?? [];
  const isFull      = pocketCards.length >= capacity;
  const canUnlock   = nextUnlockCost != null;
  const canAffordUnlock = canUnlock && balance >= nextUnlockCost;

  function handleDragOver(e) {
    if (isFull) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) onAdd(cardId);
  }

  const filled  = pocketCards.length;

  return (
    <div
      className={[
        'card-pocket',
        positionLeft ? 'card-pocket--left'        : '',
        expanded     ? 'card-pocket--expanded'  : '',
        dragOver     ? 'card-pocket--drag-over'  : '',
        isFull       ? 'card-pocket--full'        : '',
      ].filter(Boolean).join(' ')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <HoverCardPreview preview={hoverPreview} />
      {/* Header — always visible */}
      <button
        className="card-pocket__header"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className="card-pocket__header-rune" aria-hidden="true">ᛜ</span>
        <span className="card-pocket__title">Pocket</span>
        <span className="card-pocket__count">{filled}/{capacity}</span>
        <span className="card-pocket__chevron" aria-hidden="true">
          {expanded ? '▾' : '▴'}
        </span>
      </button>

      {/* Body */}
      <div className={`card-pocket__body${expanded ? '' : ' card-pocket__body--collapsed'}`}>
          {filled === 0 ? (
            <p className="card-pocket__empty-hint">
              Drag cards here from your Collection
            </p>
          ) : (
            <div className="card-pocket__cards">
              <div className="card-pocket__cards-track">
                {pocketCards.map(card => (
                  <div
                    key={card.id}
                    className="card-pocket__card-shell"
                    draggable
                    onMouseEnter={e => setHoverPreview(buildHoverCardPreview(e.currentTarget, card))}
                    onMouseLeave={() => setHoverPreview(current => (current?.card?.id === card.id ? null : current))}
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', String(card.id));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    title={`Drag to Foundry or Lab · ${card.name}`}
                  >
                    <div className="card-pocket__card-frame">
                      <CardFace card={card} visualMode="compact" className="card-pocket__card-face no-twirl" />
                      <button
                        className="card-pocket__card-remove"
                        onClick={e => { e.stopPropagation(); onRemove(card.id); }}
                        aria-label={`Remove ${card.name} from pocket`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card-pocket__pip-row" aria-hidden="true">
            {Array.from({ length: capacity }).map((_, i) => (
              <span
                key={i}
                className={`card-pocket__pip${i < filled ? ' card-pocket__pip--filled' : ''}`}
              />
            ))}
          </div>

          {canUnlock && (
            <div className="card-pocket__upgrade-row">
              <button
                type="button"
                className="card-pocket__upgrade-btn"
                disabled={!canAffordUnlock}
                onClick={onUnlock}
              >
                Unlock Slot <Gold amount={nextUnlockCost} />
              </button>
            </div>
          )}
        </div>
    </div>
  );
}
