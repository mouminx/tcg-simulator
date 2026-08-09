import { useState, useRef, useEffect } from 'react';
import PackCard from './PackCard';
import { getPackTypeById } from '../game/cards';

const PACK_PAGE = 10;

export default function Packs({ packs, onOpenPack }) {
  const [visibleCount, setVisibleCount] = useState(PACK_PAGE);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    let fired = false;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired) {
        fired = true;
        setVisibleCount(n => n + PACK_PAGE);
      }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount]);

  if (packs.length === 0) {
    return (
      <div className="packs-view">
        <h2>Your Packs</h2>
        <p className="empty-msg">No packs — visit the shop to buy some!</p>
      </div>
    );
  }

  const visible = packs.slice(0, visibleCount);

  return (
    <div className="packs-view">
      <h2>Your Packs <span className="card-count">({packs.length} unopened)</span></h2>
      <div className="packs-grid">
        {visible.map(pack => {
          const packType = getPackTypeById(pack.packTypeId);
          return (
            <div key={pack.id} className="pack-grid-item">
              <PackCard size="sm" packType={packType} />
              <div className="open-overlay">
                <button className="open-btn" onClick={() => onOpenPack(pack.id)}>Open</button>
              </div>
            </div>
          );
        })}
      </div>
      {packs.length > visibleCount && <div ref={sentinelRef} style={{ height: 1 }} />}
    </div>
  );
}
