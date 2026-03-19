import PackCard from './PackCard';
import { ATTUNEMENT_SLOT_RULES, validateItemForSlot } from '../game/arcanaAttunement';

const SLOT_ORDER = ['calling', 'surge', 'inscription'];

function formatCategory(category) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default function AttunementStage({
  packType,
  loadout,
  inventory,
  activeSlotId,
  loadoutValidation,
  onSelectSlot,
  onAssign,
  onRemove,
  onConfirm,
  onCancel,
}) {
  if (!packType) return null;

  const validItemsForActiveSlot = inventory.filter(item => validateItemForSlot(activeSlotId, item).ok);

  return (
    <div className="attunement-stage">
      <div className="attunement-slot-strip">
        {SLOT_ORDER.map(slotId => {
          const slotRule = ATTUNEMENT_SLOT_RULES[slotId];
          const slottedItem = loadout?.[slotId] ?? null;
          const isActive = activeSlotId === slotId;

          return (
            <div
              key={slotId}
              className={[
                'attunement-slot-pill',
                isActive ? 'attunement-slot-pill--active' : '',
                slottedItem ? 'attunement-slot-pill--filled' : '',
              ].filter(Boolean).join(' ')}
            >
              <button
                type="button"
                className="attunement-slot-hit"
                onClick={() => onSelectSlot(slotId)}
              >
                <span className="attunement-slot-pill-label">{slotRule.label.replace(' slot', '')}</span>
                <span className="attunement-slot-pill-value">{slottedItem?.name ?? 'Empty'}</span>
              </button>
              {slottedItem ? (
                <button
                  type="button"
                  className="attunement-slot-pill-remove"
                  onClick={() => onRemove(slotId)}
                >
                  Clear
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="attunement-item-tray">
        {validItemsForActiveSlot.length === 0 ? (
          <div className="attunement-item-empty">
            No {ATTUNEMENT_SLOT_RULES[activeSlotId]?.acceptedCategory ?? 'Arcana'} items available
          </div>
        ) : (
          validItemsForActiveSlot.map(item => {
            const isSelected = loadout?.[activeSlotId]?.inventoryEntryId === item.inventoryEntryId;
            return (
              <button
                key={item.inventoryEntryId}
                type="button"
                className={`attunement-item-chip${isSelected ? ' attunement-item-chip--selected' : ''}`}
                onClick={() => onAssign(activeSlotId, item)}
              >
                <span className="attunement-item-chip-name">{item.name}</span>
                <span className="attunement-item-chip-meta">{formatCategory(item.category)}</span>
              </button>
            );
          })
        )}
      </div>

      <div className="attunement-pack-wrap">
        <PackCard size="md" packType={packType} />
      </div>

      <div className="attunement-stage-actions">
        <button type="button" className="attunement-stage-btn attunement-stage-btn--ghost" onClick={onCancel}>
          Back
        </button>
        <button
          type="button"
          className="attunement-stage-btn attunement-stage-btn--primary"
          onClick={onConfirm}
          disabled={!loadoutValidation?.ok}
        >
          Open Pack
        </button>
      </div>
    </div>
  );
}
