import { useState, useEffect, useRef, useMemo } from 'react';
import CardFace from './CardFace';
import { RARITIES } from '../game/cards';

// ── Config presets ─────────────────────────────────────────────────────────────
export const FUSION_CONFIGS = {
  default: {
    orbitRadius:    150,
    cardScale:      0.65,
    enterMs:        500,
    orbitMs:        1400,
    chargeMs:       900,
    slamIntervalMs: 420,   // time between each card's pullback start
    pullbackMs:     220,   // wind-up duration per card
    slamTravelMs:   300,   // travel-to-center + white-flash duration
    slamFlashMs:    200,   // center impact flash duration
    revealMs:       1100,
    particleCount:  28,
    rayCount:       8,
    spinMult:       1.6,   // Y-spin degrees per orbit degree
  },
};

const P = {
  ENTER:  'enter',
  ORBIT:  'orbit',
  CHARGE: 'charge',
  SLAM:   'slam',
  REVEAL: 'reveal',
  DONE:   'done',
};

const ORBIT_SPEED = {
  [P.ORBIT]:  45,
  [P.CHARGE]: 210,
  [P.SLAM]:   440,
};

const CARD_W = 80;
const CARD_H = 112;

// ── Main component ─────────────────────────────────────────────────────────────
export default function FusionAnimation({
  cards,
  resultRarity,
  success,
  onComplete,
  config,
}) {
  const cfg = { ...FUSION_CONFIGS.default, ...(config ?? {}) };
  const resultColor = RARITIES[resultRarity]?.color ?? '#ffffff';
  const n = cards.length;

  const [phase,            setPhase]            = useState(P.ENTER);
  const [entered,          setEntered]          = useState(false);
  const [angleDeg,         setAngleDeg]         = useState(0);
  // Cards fully removed from the scene
  const [slammedCount,     setSlammedCount]     = useState(0);
  // Card currently mid-slam (animating to center)
  const [slammingActive,   setSlammingActive]   = useState(false);
  const [slammingCaptureDeg, setSlammingCaptureDeg] = useState(0);
  // Card in pullback wind-up
  const [pullingBackIdx,   setPullingBackIdx]   = useState(-1);
  const [flash,            setFlash]            = useState(false);
  const [particles,        setParticles]        = useState([]);

  const phaseRef          = useRef(P.ENTER);
  const angleDegRef       = useRef(0);   // RAF value (used for integration)
  const angleDegRenderRef = useRef(0);   // last-rendered value (used for slam capture)
  const rafRef            = useRef(null);
  const lastTRef          = useRef(null);
  const completedRef      = useRef(false);

  function safeComplete() {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 40);
    return () => clearTimeout(t);
  }, []);

  // ── Phase timeline ──────────────────────────────────────────────────────────
  useEffect(() => {
    const ts = [];
    const at = (ms, fn) => ts.push(setTimeout(fn, ms));
    const { enterMs, orbitMs, chargeMs } = cfg;
    at(enterMs,                      () => setPhase(P.ORBIT));
    at(enterMs + orbitMs,            () => setPhase(P.CHARGE));
    at(enterMs + orbitMs + chargeMs, () => setPhase(P.SLAM));
    return () => ts.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Slam sequencer ──────────────────────────────────────────────────────────
  // Three steps per card:
  //  1. Pullback  (wind-up scale/glow)
  //  2. Start slam (card leaves orbit, CSS animation flies it to center)
  //  3. Impact    (flash, card fully removed)
  useEffect(() => {
    if (phase !== P.SLAM) return;
    const ts = [];
    for (let i = 0; i < n; i++) {
      const base = i * cfg.slamIntervalMs;

      // Step 1: wind-up
      ts.push(setTimeout(() => setPullingBackIdx(i), base));

      // Step 2: leave orbit, begin flight to center.
      // Use angleDegRenderRef so captured angle matches the last-painted orbit position.
      ts.push(setTimeout(() => {
        setPullingBackIdx(-1);
        setSlammingCaptureDeg(angleDegRenderRef.current);
        setSlammingActive(true);
      }, base + cfg.pullbackMs));

      // Step 3: impact flash, card fully gone
      ts.push(setTimeout(() => {
        setSlammingActive(false);
        setSlammedCount(i + 1);
        setFlash(true);
        ts.push(setTimeout(() => setFlash(false), cfg.slamFlashMs));
        if (i === n - 1) {
          ts.push(setTimeout(() => {
            if (!success) setParticles(genParticles(cfg.particleCount));
            setPhase(P.REVEAL);
          }, 350));
        }
      }, base + cfg.pullbackMs + cfg.slamTravelMs));
    }
    return () => ts.forEach(clearTimeout);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── REVEAL → DONE ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== P.REVEAL) return;
    const t = setTimeout(() => setPhase(P.DONE), cfg.revealMs);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-advance on success ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== P.DONE || !success) return;
    safeComplete();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RAF rotation ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === P.ENTER || phase === P.REVEAL || phase === P.DONE) {
      cancelAnimationFrame(rafRef.current);
      lastTRef.current = null;
      return;
    }
    const tick = (ts) => {
      if (lastTRef.current == null) lastTRef.current = ts;
      const dt = (ts - lastTRef.current) / 1000;
      lastTRef.current = ts;
      const newAngle = (angleDegRef.current + (ORBIT_SPEED[phaseRef.current] ?? 45) * dt) % 360;
      angleDegRef.current = newAngle;
      setAngleDeg(newAngle);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); lastTRef.current = null; };
  }, [phase]);

  const baseAngles = useMemo(
    () => cards.map((_, i) => (i / n) * 360),
    [n], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Cards that have left orbit = fully removed + 1 if actively slamming
  const exitedOrbit = slammedCount + (slammingActive ? 1 : 0);

  // Compute slamming card's start position from captured angle
  const slammingCardIndex = slammedCount; // the card currently in-flight
  const slammingStartX = useMemo(() => {
    if (!slammingActive || slammingCardIndex >= n) return 0;
    const deg = (baseAngles[slammingCardIndex] + slammingCaptureDeg) % 360;
    return Math.cos(deg * Math.PI / 180) * cfg.orbitRadius;
  }, [slammingActive, slammingCardIndex, slammingCaptureDeg, baseAngles, cfg.orbitRadius, n]);

  const slammingStartY = useMemo(() => {
    if (!slammingActive || slammingCardIndex >= n) return 0;
    const deg = (baseAngles[slammingCardIndex] + slammingCaptureDeg) % 360;
    return Math.sin(deg * Math.PI / 180) * cfg.orbitRadius;
  }, [slammingActive, slammingCardIndex, slammingCaptureDeg, baseAngles, cfg.orbitRadius, n]);

  // Keep render-side ref in sync — used so slam capture matches last-painted angle
  angleDegRenderRef.current = angleDeg;

  const labelColor = (phase === P.REVEAL || phase === P.DONE)
    ? (success ? resultColor : '#ff5555')
    : 'rgba(255,255,255,0.75)';

  return (
    <div className="fusion-anim-overlay" onClick={safeComplete}>
      <div className="fusion-anim-stage">

        {/* ── Ambient glow ── */}
        <div
          className={`fusion-anim-glow fusion-anim-glow--${phase}`}
          style={{ '--rc': resultColor }}
        />

        {/* ── Rays ── */}
        {(phase === P.CHARGE || phase === P.SLAM) &&
          Array.from({ length: cfg.rayCount }).map((_, i) => (
            <div
              key={i}
              className="fusion-anim-ray"
              style={{
                '--rc': resultColor,
                transform: `translateX(-50%) rotate(${(i / cfg.rayCount) * 360}deg)`,
                animationDelay: `${(i / cfg.rayCount) * 0.45}s`,
              }}
            />
          ))
        }

        {/* ── Impact flash ── */}
        {flash && <div className="fusion-anim-flash" style={{ '--rc': resultColor }} />}

        {/* ── Ghost card ── */}
        <div
          className={[
            'fusion-anim-ghost',
            phase === P.REVEAL && success  ? 'fusion-anim-ghost--success' : '',
            phase === P.REVEAL && !success ? 'fusion-anim-ghost--fail'    : '',
            phase === P.DONE              ? 'fusion-anim-ghost--done'    : '',
          ].filter(Boolean).join(' ')}
          style={{ '--rc': resultColor }}
        />

        {/* ── Orbiting cards (cards still in ring) ── */}
        {cards.map((card, i) => {
          if (i < exitedOrbit) return null;

          const deg     = (baseAngles[i] + angleDeg) % 360;
          const rad     = deg * (Math.PI / 180);
          const x       = Math.cos(rad) * cfg.orbitRadius;
          const y       = Math.sin(rad) * cfg.orbitRadius;
          const spinDeg = angleDeg * cfg.spinMult;

          const isEntering = phase === P.ENTER;
          const atCenter   = isEntering && !entered;
          const isPullback = pullingBackIdx === i;

          return (
            // Layer 1: position — RAF-driven, no CSS transition
            <div
              key={card.id}
              style={{
                position:        'absolute',
                left:            '50%',
                top:             '50%',
                width:           CARD_W,
                height:          CARD_H,
                transform:       atCenter
                  ? 'translate(-50%, -50%)'
                  : `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                transition:    isEntering
                  ? `transform ${cfg.enterMs - 60}ms cubic-bezier(0.34,1.2,0.64,1) ${i * 70}ms`
                  : 'none',
                pointerEvents: 'none',
              }}
            >
              {/* Layer 2: Y-axis spin — RAF-driven, no transition */}
              <div style={{
                width:           '100%',
                height:          '100%',
                transform:       `rotateY(${spinDeg}deg)`,
                transformOrigin: 'center center',
              }}>
                {/* Layer 3: scale + pullback effects — CSS transition only */}
                {/* display:flex centers CardFace (110×160) inside this box so
                    transformOrigin:center lands on the visual card center */}
                <div style={{
                  width:           '100%',
                  height:          '100%',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  transform:       `scale(${isPullback ? cfg.cardScale * 1.55 : cfg.cardScale})`,
                  transformOrigin: 'center center',
                  transition:      isPullback
                    ? 'transform 200ms cubic-bezier(0.34,1.5,0.64,1), filter 200ms ease-out'
                    : 'transform 90ms ease-in, filter 90ms ease-in',
                  filter:          isPullback
                    ? `brightness(3.5) saturate(1.8) drop-shadow(0 0 16px ${resultColor})`
                    : 'none',
                }}>
                  <CardFace card={card} holo={false} />
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Slamming card: flies from ring to center, flashes white ── */}
        {slammingActive && slammingCardIndex < n && (
          <div
            className="fusion-anim-slam-card"
            style={{
              '--sx':              `${slammingStartX}px`,
              '--sy':              `${slammingStartY}px`,
              '--rc':              resultColor,
              animationDuration:   `${cfg.slamTravelMs}ms`,
            }}
          >
            <div style={{
              width:           CARD_W,
              height:          CARD_H,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              transform:       `scale(${cfg.cardScale})`,
              transformOrigin: 'center center',
            }}>
              <CardFace card={cards[slammingCardIndex]} holo={false} />
            </div>
          </div>
        )}

        {/* ── Failure particles ── */}
        {particles.map(p => (
          <div
            key={p.id}
            className="fusion-anim-particle"
            style={{
              width:  p.size,
              height: p.size,
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              background: `hsl(${p.hue}, 90%, 65%)`,
            }}
          />
        ))}

      </div>

      <p className="fusion-anim-label" style={{ color: labelColor }}>
        {PHASE_LABELS[phase]?.(success) ?? ''}
      </p>

      {phase === P.DONE && !success && (
        <button
          className="fusion-anim-done-btn"
          onClick={e => { e.stopPropagation(); safeComplete(); }}
        >
          Continue
        </button>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PHASE_LABELS = {
  [P.ENTER]:  ()    => 'Preparing fusion\u2026',
  [P.ORBIT]:  ()    => 'Gathering energy\u2026',
  [P.CHARGE]: ()    => 'Charging\u2026',
  [P.SLAM]:   ()    => 'Fusing!',
  [P.REVEAL]: (ok)  => ok ? '\u2736 Fusion Successful' : '\u2715 Fusion Failed',
  [P.DONE]:   (ok)  => ok ? '\u2736 Fusion Successful' : '\u2715 Fusion Failed',
};

function genParticles(count) {
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = (i / count) * 360 + (Math.random() * 20 - 10);
    const dist     = 70 + Math.random() * 120;
    const rad      = angleDeg * (Math.PI / 180);
    return {
      id:   i,
      size: 4 + Math.random() * 6,
      tx:   Math.cos(rad) * dist,
      ty:   Math.sin(rad) * dist,
      hue:  20 + Math.random() * 40,
    };
  });
}
