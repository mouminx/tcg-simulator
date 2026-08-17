import { useEffect } from 'react';
import CardFace from './CardFace';
import { getGemFamily } from '../game/cardSockets';

/**
 * Intentionally quiet. This is an inspection surface first, not a separate
 * station: the Bag remains open beside it and knowledgeable players use those
 * inventory items directly on the enlarged card.
 */
export default function CardCraftingView({ card, pendingGemId = null, chiselActive = false, extractorActive = false, onCardSelect, onAffixSelect, onSocketSelect, onClose }) {
  const selectingAffix = getGemFamily(pendingGemId) === 'diamond';
  const gemActive = Boolean(pendingGemId);

  useEffect(() => {
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="card-crafting-modal card-crafting-modal--minimal"
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${card.name}`}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <CardFace
        card={card}
        holo
        artDetail="full"
        className={`card-crafting-modal__face viewer-card no-twirl${chiselActive || gemActive ? ' card-crafting-modal__face--socket-target' : ''}`}
        resourceDropTarget={chiselActive || gemActive ? 'card-crafting-card' : null}
        onClick={chiselActive || gemActive ? onCardSelect : null}
        onAffixClick={selectingAffix ? onAffixSelect : null}
        onSocketClick={extractorActive ? onSocketSelect : null}
        showSocketTooltips
      />
    </div>
  );
}
