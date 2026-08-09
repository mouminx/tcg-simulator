import { createPortal } from 'react-dom';
import CardFace from './CardFace';

const PREVIEW_WIDTH = 330;
const PREVIEW_HEIGHT = 480;
const PREVIEW_GAP = 18;
const VIEWPORT_GAP = 16;

export function buildHoverCardPreview(element, card) {
  if (!element || !card) return null;
  const rect = element.getBoundingClientRect();
  const prefersRight = window.innerWidth - rect.right >= PREVIEW_WIDTH + PREVIEW_GAP + VIEWPORT_GAP;
  const dir = prefersRight ? 'right' : 'left';
  const x = prefersRight
    ? rect.right + PREVIEW_GAP
    : rect.left - PREVIEW_WIDTH - PREVIEW_GAP;
  const centeredY = rect.top + rect.height / 2 - PREVIEW_HEIGHT / 2;
  const y = Math.min(
    Math.max(VIEWPORT_GAP, centeredY),
    window.innerHeight - PREVIEW_HEIGHT - VIEWPORT_GAP,
  );

  return { card, x, y, dir };
}

export default function HoverCardPreview({ preview }) {
  if (!preview?.card) return null;

  return createPortal(
    <div
      className={`hover-card-preview hover-card-preview--${preview.dir ?? 'right'}`}
      style={{ left: preview.x, top: preview.y }}
    >
      <CardFace card={preview.card} className="viewer-card hover-preview-card no-twirl" holo artDetail="full" />
    </div>,
    document.body,
  );
}
