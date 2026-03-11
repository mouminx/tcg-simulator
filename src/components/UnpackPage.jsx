import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PackCard from './PackCard';
import PackOpening from './PackOpening';
import { PACK_TYPES } from '../game/cards';

// Order to pick next pack: lowest → highest rarity/cost
const PACK_TYPE_ORDER = ['dusk', 'iron', 'arcane', 'void', 'primordial'];

function getNextPack(packs) {
  for (const typeId of PACK_TYPE_ORDER) {
    const pack = packs.find(p => p.packTypeId === typeId);
    if (pack) return pack;
  }
  return packs[0] ?? null;
}

// Fly a md-sized pack (starts scaled down to match sm size) to the stage center
function FlyingPack({ packType, startX, startY, endX, endY, onDone }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition =
          'left 0.52s cubic-bezier(0.4,0,0.2,1), top 0.52s cubic-bezier(0.4,0,0.2,1), transform 0.52s cubic-bezier(0.4,0,0.2,1)';
        el.style.left = `${endX}px`;
        el.style.top = `${endY}px`;
        el.style.transform = 'translate(-50%,-50%) scale(1)';
      });
    });
    const t = setTimeout(onDone, 560);
    return () => clearTimeout(t);
  }, []);

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: startX,
        top: startY,
        transform: 'translate(-50%,-50%) scale(0.55)',
        transformOrigin: 'center center',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <PackCard size="md" packType={packType} />
    </div>,
    document.body
  );
}

export default function UnpackPage({
  packs,
  pendingCards,
  pendingPackType,
  onOpenPack,
  onPackDone,
  collectionBtnRef,
}) {
  const [flyingPack, setFlyingPack] = useState(null);
  const [hiddenPackId, setHiddenPackId] = useState(null);
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const packItemRefs = useRef({});
  const stageRef = useRef(null);
  const packOpeningRef = useRef(null);

  const isOpening = pendingCards.length > 0;
  const busy = !!flyingPack || isOpening;

  const RADIUS = 600;
  const PACK_W = 110;
  const totalAngle = packs.length > 1 ? Math.min(60, (packs.length - 1) * 10) : 0;

  function handlePackClick(pack) {
    if (busy) return;
    setShowNextPrompt(false);

    const packEl = packItemRefs.current[pack.id];
    const stageEl = stageRef.current;
    const packType = PACK_TYPES[pack.packTypeId] ?? PACK_TYPES.iron;

    if (packEl && stageEl) {
      const packRect = packEl.getBoundingClientRect();
      const stageRect = stageEl.getBoundingClientRect();
      setHiddenPackId(pack.id);
      setFlyingPack({
        packId: pack.id,
        packType,
        startX: packRect.left + packRect.width / 2,
        startY: packRect.top + packRect.height / 2,
        endX: stageRect.left + stageRect.width / 2,
        endY: stageRect.top + 196,
      });
    } else {
      onOpenPack(pack.id);
    }
  }

  function handleFlyDone() {
    const packId = flyingPack.packId;
    setFlyingPack(null);
    setHiddenPackId(null);
    onOpenPack(packId);
  }

  // Wraps onPackDone — after collecting, offer to open the next pack if any remain
  function handlePackDone() {
    const hasMore = packs.length > 0;
    onPackDone();
    if (hasMore) setShowNextPrompt(true);
  }

  function handleUnpackNext() {
    const next = getNextPack(packs);
    if (next) handlePackClick(next);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'u' && e.key !== 'U') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (isOpening) {
        packOpeningRef.current?.advance();
      } else if (showNextPrompt || (!busy && packs.length > 0)) {
        handleUnpackNext();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpening, showNextPrompt, busy, packs]);

  return (
    <div className="unpack-page">

      {/* Pack row */}
      {packs.length > 0 && (
        <div className={`unpack-pack-row${busy ? ' unpack-pack-row--busy' : ''}`}>
          {packs.map((pack, i) => {
            const packType = PACK_TYPES[pack.packTypeId] ?? PACK_TYPES.iron;
            const isHidden = hiddenPackId === pack.id;
            const angle = packs.length > 1 ? (i / (packs.length - 1) - 0.5) * totalAngle : 0;
            const angleRad = angle * Math.PI / 180;
            const x = Math.sin(angleRad) * RADIUS;
            const y = (1 - Math.cos(angleRad)) * RADIUS;
            return (
              <div
                key={pack.id}
                ref={el => { packItemRefs.current[pack.id] = el; }}
                className={`unpack-pack-item${isHidden ? ' unpack-pack-item--hidden' : ''}`}
                style={{
                  left: `calc(50% + ${x.toFixed(1)}px - ${PACK_W / 2}px)`,
                  top: `${(y + 16).toFixed(1)}px`,
                  zIndex: i + 1,
                  '--pack-angle': `${angle.toFixed(1)}deg`,
                }}
                onClick={() => handlePackClick(pack)}
              >
                <PackCard size="sm" packType={packType} />
              </div>
            );
          })}
        </div>
      )}

      {/* Idle prompt */}
      {!busy && !showNextPrompt && packs.length > 0 && (
        <p className="unpack-prompt">Select a pack above to open</p>
      )}

      {/* Empty state */}
      {!isOpening && !showNextPrompt && packs.length === 0 && (
        <p className="empty-msg" style={{ marginTop: '3rem' }}>
          No packs — visit the shop to buy some!
        </p>
      )}

      {/* Opening stage */}
      <div ref={stageRef} className="unpack-stage">
        {isOpening && (
          <PackOpening
            ref={packOpeningRef}
            cards={pendingCards}
            onDone={handlePackDone}
            collectionBtnRef={collectionBtnRef}
            packType={pendingPackType}
          />
        )}
        {showNextPrompt && (
          <div className="pack-opening">
            <p className="hint">&nbsp;</p>
            <div className="opening-stage">
              <div className="unpack-next-area">
                <p className="unpack-next-label">
                  {packs.length} pack{packs.length !== 1 ? 's' : ''} remaining
                </p>
                <button className="unpack-next-btn" onClick={handleUnpackNext}>
                  Unpack Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Flying pack portal */}
      {flyingPack && (
        <FlyingPack
          packType={flyingPack.packType}
          startX={flyingPack.startX}
          startY={flyingPack.startY}
          endX={flyingPack.endX}
          endY={flyingPack.endY}
          onDone={handleFlyDone}
        />
      )}
    </div>
  );
}
