import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getToolArt } from '../game/resourceArt';
import { TOOL_TIER_LABELS, formatToolAffix } from '../game/tools';
import LootTierBadge from './LootTierBadge';

export default function ToolCard({
  tool,
  className = '',
  draggable = false,
  onDragStart = null,
  onClick = null,
  tooltipNote = '',
}) {
  const [tipPos, setTipPos] = useState(null);
  const [clampedPos, setClampedPos] = useState(null);
  const tipRef = useRef(null);
  const artSrc = getToolArt(tool?.artKey);

  useLayoutEffect(() => {
    if (!tipPos || !tipRef.current) { setClampedPos(null); return; }
    const { width, height } = tipRef.current.getBoundingClientRect();
    const gap = 14;
    let x = tipPos.x + gap;
    let y = tipPos.y + gap;
    if (x + width > window.innerWidth - 8) x = tipPos.x - width - gap;
    if (y + height > window.innerHeight - 8) y = tipPos.y - height - gap;
    setClampedPos({ x, y });
  }, [tipPos]);

  if (!tool) return null;

  return (
    <>
      <div
        className={`card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned tool-card ${className}`.trim()}
        draggable={draggable}
        onDragStart={onDragStart}
        onClick={onClick}
        onMouseEnter={event => setTipPos({ x: event.clientX, y: event.clientY })}
        onMouseMove={event => setTipPos({ x: event.clientX, y: event.clientY })}
        onMouseLeave={() => setTipPos(null)}
        data-tool-id={tool.id}
        title={`${tool.name} ${TOOL_TIER_LABELS[tool.tier]} — ${tool.affixes?.length ?? 0} affixes`}
      >
        <div className="card-face-inner">
          <div className="card-face-front foundry-square-resource__front">
            <div className="foundry-square-resource__art-wrap">
              {artSrc ? <img src={artSrc} alt={tool.name} className="foundry-square-resource__art" /> : null}
            </div>
            <LootTierBadge tier={tool.tier} />
          </div>
        </div>
      </div>
      {tipPos ? createPortal(
        <div
          ref={tipRef}
          className="resource-tooltip tool-tooltip"
          style={{ left: (clampedPos ?? tipPos).x, top: (clampedPos ?? tipPos).y }}
        >
          <span className="resource-tooltip__name">{tool.name} {TOOL_TIER_LABELS[tool.tier]}</span>
          <span className="tool-tooltip__quality">Material Quality {TOOL_TIER_LABELS[tool.materialQuality]}</span>
          {tooltipNote ? <span className="resource-tooltip__desc crafting-resource-tooltip__action">{tooltipNote}</span> : null}
          <ul className="tool-tooltip__affixes">
            {(tool.affixes ?? []).map((affix, index) => <li key={`${affix.id}-${index}`}>{formatToolAffix(affix)}</li>)}
          </ul>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
