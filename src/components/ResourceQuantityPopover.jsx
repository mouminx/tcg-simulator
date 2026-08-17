import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

function clampPopoverPosition(position) {
  if (typeof window === 'undefined') return position;
  const width = 248;
  const height = 144;
  return {
    x: Math.max(12, Math.min(position.x, window.innerWidth - width - 12)),
    y: Math.max(12, Math.min(position.y, window.innerHeight - height - 12)),
  };
}

export default function ResourceQuantityPopover({
  open = false,
  position = { x: 0, y: 0 },
  title = '',
  max = 0,
  mode = 'pocket',
  onConfirm,
  onCancel,
}) {
  const initialValue = useMemo(() => {
    const half = Math.floor(max / 2);
    return Math.max(1, half || max || 1);
  }, [max]);

  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
  }, [open, initialValue]);

  if (!open || max <= 0) return null;

  const clamped = clampPopoverPosition(position);

  return createPortal(
    <div
      className="resource-quantity-popover"
      style={{ left: clamped.x, top: clamped.y }}
      onClick={event => event.stopPropagation()}
      onContextMenu={event => event.preventDefault()}
    >
      <div className="resource-quantity-popover__head">
        <span className="resource-quantity-popover__title">{title}</span>
        <span className="resource-quantity-popover__value">{value}</span>
      </div>
      <input
        className="resource-quantity-popover__slider"
        type="range"
        min="1"
        max={String(max)}
        value={value}
        onChange={event => setValue(Number(event.target.value))}
      />
      <div className="resource-quantity-popover__range">
        <span>1</span>
        <span>{max}</span>
      </div>

      {mode === 'carry' ? (
        <div className="resource-quantity-popover__actions resource-quantity-popover__actions--dual">
          <button
            type="button"
            className="resource-quantity-popover__btn resource-quantity-popover__btn--cancel"
            onClick={onCancel}
            aria-label="Cancel"
          >
            ✕
          </button>
          <button
            type="button"
            className="resource-quantity-popover__btn resource-quantity-popover__btn--confirm"
            onClick={() => onConfirm?.(value)}
            aria-label="Confirm"
          >
            ✓
          </button>
        </div>
      ) : (
        <div className="resource-quantity-popover__actions">
          <button
            type="button"
            className="resource-quantity-popover__btn resource-quantity-popover__btn--confirm"
            onClick={() => onConfirm?.(value)}
          >
            Pocket Resources
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
