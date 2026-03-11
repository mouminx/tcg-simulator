import { useState, useRef, useEffect, useMemo } from 'react';

const RARITIES = {
  common:    { name: 'Common',    color: '#94a3b8' },
  uncommon:  { name: 'Uncommon',  color: '#4ade80' },
  rare:      { name: 'Rare',      color: '#60a5fa' },
  epic:      { name: 'Epic',      color: '#c084fc' },
  legendary: { name: 'Legendary', color: '#fbbf24' },
  mythic:    { name: 'Mythic',    color: '#f87171' },
};

const BLEND_MODES = [
  'normal', 'color-dodge', 'screen', 'overlay',
  'hard-light', 'soft-light', 'luminosity', 'color',
];

const EFFECT_TYPES = {
  radialRings:    'Radial Rings',
  linearGradient: 'Linear Gradient',
  conicGradient:  'Conic Gradient',
  solidOverlay:   'Solid Overlay',
};

const TIERS = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };

const ANIM_TYPES = {
  none:      'None',
  hueRotate: 'Hue Rotate',
  scroll:    'Scroll',
  pulse:     'Pulse',
};

const DEFAULT_STOPS_RADIAL = [
  { hue: 0,   opacity: 0.52 },
  { hue: 36,  opacity: 0.48 },
  { hue: 72,  opacity: 0.52 },
  { hue: 108, opacity: 0.48 },
  { hue: 144, opacity: 0.52 },
  { hue: 180, opacity: 0.48 },
  { hue: 216, opacity: 0.52 },
  { hue: 252, opacity: 0.48 },
  { hue: 288, opacity: 0.52 },
  { hue: 324, opacity: 0.48 },
];

const DEFAULT_STOPS_LINEAR = [
  { hue: 0,   opacity: 0.45 },
  { hue: 60,  opacity: 0.45 },
  { hue: 120, opacity: 0.45 },
  { hue: 180, opacity: 0.45 },
  { hue: 240, opacity: 0.45 },
  { hue: 300, opacity: 0.45 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildBgImage(effectType, colorStops, ringSize, gradientAngle) {
  const stops = colorStops;
  if (effectType === 'radialRings') {
    const s = stops.map((st, i) =>
      `hsla(${st.hue}, 100%, 65%, ${st.opacity}) ${i * ringSize}px`
    ).join(', ');
    return `repeating-radial-gradient(circle at 50% 50%, ${s})`;
  }
  if (effectType === 'linearGradient') {
    const s = stops.map((st, i) =>
      `hsla(${st.hue}, 100%, 65%, ${st.opacity}) ${Math.round(i / (stops.length - 1) * 100)}%`
    ).join(', ');
    return `repeating-linear-gradient(${gradientAngle}deg, ${s})`;
  }
  if (effectType === 'conicGradient') {
    const s = stops.map((st, i) =>
      `hsla(${st.hue}, 100%, 65%, ${st.opacity}) ${Math.round(i / (stops.length - 1) * 100)}%`
    ).join(', ');
    return `conic-gradient(from ${gradientAngle}deg at 50% 50%, ${s})`;
  }
  if (effectType === 'solidOverlay') {
    const st = stops[0];
    return `radial-gradient(ellipse at 50% 50%, hsla(${st.hue}, 100%, 65%, ${st.opacity}) 0%, transparent 70%)`;
  }
  return '';
}

function buildBgImageForCss(effectType, colorStops, ringSize, gradientAngle) {
  const stops = colorStops;
  if (effectType === 'radialRings') {
    const s = stops.map((st, i) =>
      `\n    hsla(${st.hue}, 100%, 65%, ${st.opacity}) ${i * ringSize}px`
    ).join(',');
    return `repeating-radial-gradient(\n  circle at 50% 50%,${s}\n  )`;
  }
  if (effectType === 'linearGradient') {
    const s = stops.map((st, i) =>
      `\n    hsla(${st.hue}, 100%, 65%, ${st.opacity}) ${Math.round(i / (stops.length - 1) * 100)}%`
    ).join(',');
    return `repeating-linear-gradient(\n  ${gradientAngle}deg,${s}\n  )`;
  }
  if (effectType === 'conicGradient') {
    const s = stops.map((st, i) =>
      `\n    hsla(${st.hue}, 100%, 65%, ${st.opacity}) ${Math.round(i / (stops.length - 1) * 100)}%`
    ).join(',');
    return `conic-gradient(\n  from ${gradientAngle}deg at 50% 50%,${s}\n  )`;
  }
  if (effectType === 'solidOverlay') {
    const st = stops[0];
    return `radial-gradient(ellipse at 50% 50%, hsla(${st.hue}, 100%, 65%, ${st.opacity}) 0%, transparent 70%)`;
  }
  return '';
}

function generateCSS(params) {
  const {
    effectType, blendMode, opacity, animType, animDuration, animDirection,
    colorStops, ringSize, gradientAngle, cardFrontFilter, cardFrontFilterAmount,
  } = params;

  const bgImage = buildBgImageForCss(effectType, colorStops, ringSize, gradientAngle);

  let animLine = '';
  let keyframesCss = '';
  const rev = animDirection === 'reverse';

  if (animType === 'hueRotate') {
    animLine = `animation: fxe-hue-cycle ${animDuration}s linear infinite${rev ? ' reverse' : ''};`;
    keyframesCss = `@keyframes fxe-hue-cycle {
  0%   { filter: hue-rotate(  0deg) saturate(1.6); }
  100% { filter: hue-rotate(360deg) saturate(1.6); }
}`;
  } else if (animType === 'scroll') {
    animLine = `background-size: 100% 400%;\n  animation: fxe-scroll ${animDuration}s linear infinite${rev ? ' reverse' : ''};`;
    keyframesCss = `@keyframes fxe-scroll {
  0%   { background-position: 50% 0%; }
  100% { background-position: 50% 400%; }
}`;
  } else if (animType === 'pulse') {
    animLine = `animation: fxe-pulse ${animDuration}s ease-in-out infinite${rev ? ' alternate-reverse' : ' alternate'};`;
    keyframesCss = `@keyframes fxe-pulse {
  0%   { opacity: ${(opacity * 0.4).toFixed(2)}; }
  100% { opacity: ${opacity.toFixed(2)}; }
}`;
  }

  let cardFrontCss = '';
  if (cardFrontFilter !== 'none') {
    const a = cardFrontFilterAmount;
    const fv =
      cardFrontFilter === 'hueRotate'  ? `hue-rotate(${a}deg) saturate(1.3)` :
      cardFrontFilter === 'saturate'   ? `saturate(${(a / 10).toFixed(1)})` :
      cardFrontFilter === 'brightness' ? `brightness(${(a / 100).toFixed(2)})` : '';
    cardFrontCss = `\n.has-tag-custom .card-face-front {\n  filter: ${fv};\n}`;
  }

  const lines = [
    `/* Custom FX — generated by FX Editor */`,
    `.tag-vfx--custom {`,
    `  z-index: 4;`,
    `  border-radius: 10px;`,
    bgImage    ? `  background-image: ${bgImage};` : null,
    `  mix-blend-mode: ${blendMode};`,
    `  opacity: ${opacity.toFixed(2)};`,
    animLine   ? `  ${animLine}` : null,
    `  pointer-events: none;`,
    `}`,
    keyframesCss ? `\n${keyframesCss}` : null,
    cardFrontCss || null,
  ].filter(Boolean).join('\n');

  return lines;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Slider({ label, min, max, step = 1, value, onChange, unit = '' }) {
  return (
    <label className="fxe-row">
      <span className="fxe-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} className="fxe-slider" />
      <span className="fxe-val">{value}{unit}</span>
    </label>
  );
}

function Select({ label, options, value, onChange }) {
  return (
    <label className="fxe-row">
      <span className="fxe-label">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="fxe-select">
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </label>
  );
}

function ColorStop({ index, hue, opacity, onChange, onRemove, canRemove }) {
  return (
    <div className="fxe-colorstop">
      <div className="fxe-colorstop-header">
        <span className="fxe-colorstop-idx">#{index + 1}</span>
        {canRemove && (
          <button className="fxe-rm-btn" onClick={() => onRemove(index)}>×</button>
        )}
      </div>
      <div className="fxe-colorstop-row">
        <span className="fxe-colorstop-label">Hue</span>
        <input type="range" min={0} max={360} step={1} value={hue}
          onChange={e => onChange(index, 'hue', Number(e.target.value))}
          className="fxe-slider fxe-slider--hue" style={{ '--hue': hue }} />
        <span className="fxe-val">{hue}°</span>
      </div>
      <div className="fxe-colorstop-row">
        <span className="fxe-colorstop-label">Alpha</span>
        <input type="range" min={0} max={1} step={0.01} value={opacity}
          onChange={e => onChange(index, 'opacity', Number(e.target.value))}
          className="fxe-slider" />
        <span className="fxe-val">{Math.round(opacity * 100)}%</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULTS = {
  rarity: 'legendary',
  tier: 3,
  effectType: 'radialRings',
  blendMode: 'color-dodge',
  opacity: 0.65,
  animType: 'hueRotate',
  animDuration: 2.4,
  animDirection: 'forward',
  ringSize: 10,
  gradientAngle: 125,
  colorStops: DEFAULT_STOPS_RADIAL,
  cardFrontFilter: 'none',
  cardFrontFilterAmount: 180,
};

export default function FXEditor() {
  const [rarity, setRarity]           = useState(DEFAULTS.rarity);
  const [tier, setTier]               = useState(DEFAULTS.tier);
  const [effectType, setEffectType]   = useState(DEFAULTS.effectType);
  const [blendMode, setBlendMode]     = useState(DEFAULTS.blendMode);
  const [opacity, setOpacity]         = useState(DEFAULTS.opacity);
  const [animType, setAnimType]       = useState(DEFAULTS.animType);
  const [animDuration, setAnimDuration] = useState(DEFAULTS.animDuration);
  const [animDirection, setAnimDirection] = useState(DEFAULTS.animDirection);
  const [ringSize, setRingSize]       = useState(DEFAULTS.ringSize);
  const [gradientAngle, setGradientAngle] = useState(DEFAULTS.gradientAngle);
  const [colorStops, setColorStops]   = useState(DEFAULTS.colorStops);
  const [cardFrontFilter, setCardFrontFilter] = useState(DEFAULTS.cardFrontFilter);
  const [cardFrontFilterAmount, setCardFrontFilterAmount] = useState(DEFAULTS.cardFrontFilterAmount);
  const [copied, setCopied]           = useState(false);

  function handleReset() {
    setRarity(DEFAULTS.rarity);
    setTier(DEFAULTS.tier);
    setEffectType(DEFAULTS.effectType);
    setBlendMode(DEFAULTS.blendMode);
    setOpacity(DEFAULTS.opacity);
    setAnimType(DEFAULTS.animType);
    setAnimDuration(DEFAULTS.animDuration);
    setAnimDirection(DEFAULTS.animDirection);
    setRingSize(DEFAULTS.ringSize);
    setGradientAngle(DEFAULTS.gradientAngle);
    setColorStops(DEFAULTS.colorStops);
    setCardFrontFilter(DEFAULTS.cardFrontFilter);
    setCardFrontFilterAmount(DEFAULTS.cardFrontFilterAmount);
  }

  // Mouse-tracking for 3-D tilt
  const wrapRef = useRef(null);
  const rafRef  = useRef(null);
  const styleRef = useRef(null);

  function handleMouseMove(e) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = wrapRef.current;
      if (!el) return;
      const r  = el.getBoundingClientRect();
      const cx = r.width / 2, cy = r.height / 2;
      const dx = e.clientX - r.left - cx;
      const dy = e.clientY - r.top  - cy;
      el.style.setProperty('--rx', -(dy / cy) * 15);
      el.style.setProperty('--ry',  (dx / cx) * 15);
      el.style.setProperty('--hyp', Math.min(Math.hypot(dx / cx, dy / cy), 1));
    });
  }

  function handleMouseLeave() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const el = wrapRef.current;
    if (!el) return;
    el.classList.add('holo-spring');
    el.style.setProperty('--rx', 0);
    el.style.setProperty('--ry', 0);
    el.style.setProperty('--hyp', 0);
    setTimeout(() => el?.classList.remove('holo-spring'), 600);
  }

  function handleMouseEnter() {
    wrapRef.current?.classList.remove('holo-spring');
  }

  // Inject animation class + keyframes together into one style tag
  useEffect(() => {
    if (!styleRef.current) {
      styleRef.current = document.createElement('style');
      document.head.appendChild(styleRef.current);
    }
    const rev = animDirection === 'reverse';
    let rule = '';
    if (animType === 'hueRotate') {
      rule = `.fxe-anim-active { animation: fxe-hue-cycle ${animDuration}s linear infinite${rev ? ' reverse' : ''}; }
@keyframes fxe-hue-cycle {
  0%   { filter: hue-rotate(  0deg) saturate(1.6); }
  100% { filter: hue-rotate(360deg) saturate(1.6); }
}`;
    } else if (animType === 'scroll') {
      rule = `.fxe-anim-active { animation: fxe-scroll ${animDuration}s linear infinite${rev ? ' reverse' : ''}; background-size: 100% 400%; }
@keyframes fxe-scroll {
  0%   { background-position: 50% 0%; }
  100% { background-position: 50% 400%; }
}`;
    } else if (animType === 'pulse') {
      rule = `.fxe-anim-active { animation: fxe-pulse ${animDuration}s ease-in-out infinite${rev ? ' alternate-reverse' : ' alternate'}; }
@keyframes fxe-pulse {
  0%   { opacity: ${(opacity * 0.4).toFixed(2)}; }
  100% { opacity: ${opacity.toFixed(2)}; }
}`;
    }
    styleRef.current.textContent = rule;
  }, [animType, animDuration, animDirection, opacity]);

  useEffect(() => () => styleRef.current?.remove(), []);

  const params = {
    rarity, effectType, blendMode, opacity, animType, animDuration, animDirection,
    ringSize, gradientAngle, colorStops, cardFrontFilter, cardFrontFilterAmount,
  };
  const css = generateCSS(params);

  // Inline styles for the VFX overlay — animation handled separately via injected class
  const vfxStyle = useMemo(() => {
    const bgImage = buildBgImage(effectType, colorStops, ringSize, gradientAngle);
    return {
      position: 'absolute',
      inset: 0,
      borderRadius: 10,
      zIndex: 4,
      pointerEvents: 'none',
      backgroundImage: bgImage,
      mixBlendMode: blendMode,
      opacity,
    };
  }, [effectType, colorStops, ringSize, gradientAngle, blendMode, opacity]);

  // Card base filter inline style
  const cardFrontStyle = useMemo(() => {
    const rarityColor = RARITIES[rarity]?.color ?? '#fbbf24';
    if (cardFrontFilter === 'none') return { backgroundColor: rarityColor };
    const a = cardFrontFilterAmount;
    const fv =
      cardFrontFilter === 'hueRotate'  ? `hue-rotate(${a}deg) saturate(1.3)` :
      cardFrontFilter === 'saturate'   ? `saturate(${(a / 10).toFixed(1)})` :
      cardFrontFilter === 'brightness' ? `brightness(${(a / 100).toFixed(2)})` : '';
    return { backgroundColor: rarityColor, filter: fv };
  }, [rarity, cardFrontFilter, cardFrontFilterAmount]);

  function handleEffectTypeChange(t) {
    setEffectType(t);
    setColorStops(t === 'radialRings' ? DEFAULT_STOPS_RADIAL : DEFAULT_STOPS_LINEAR);
  }

  function handleStopChange(i, field, val) {
    setColorStops(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function handleStopRemove(i) {
    setColorStops(prev => prev.filter((_, idx) => idx !== i));
  }
  function handleStopAdd() {
    setColorStops(prev => [...prev, { hue: Math.round(Math.random() * 360), opacity: 0.5 }]);
  }
  function handleCopy() {
    navigator.clipboard.writeText(css).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const rarityColor = RARITIES[rarity]?.color ?? '#fbbf24';

  return (
    <div className="fxe">
      <div className="fxe-header">
        <div className="fxe-header-top">
          <div>
            <h2 className="fxe-title">FX Editor</h2>
            <p className="fxe-sub">Design card effects with live preview. Copy CSS to share with Claude.</p>
          </div>
          <button className="fxe-reset-btn" onClick={handleReset}>Reset to Defaults</button>
        </div>
      </div>

      <div className="fxe-body">
        {/* ── Left: Preview ── */}
        <div className="fxe-preview-col">
          <div className="fxe-preview-wrap">
            <div
              ref={wrapRef}
              className={`card-face-wrapper viewer-card tier-${tier} holo-active holo--${rarity}`}
              style={{ '--glow-color': rarityColor, '--rx': 0, '--ry': 0, '--hyp': 0 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={handleMouseEnter}
            >
              <div className="card-face-inner">
                <div className="card-face-front" style={cardFrontStyle}>
                  <div className="card-tier-overlay" />
                  {/* VFX overlay — inline styles for appearance, class for animation */}
                  <div style={vfxStyle} className={animType !== 'none' ? 'fxe-anim-active' : ''} />
                  <div className="card-rarity">{RARITIES[rarity].name}{tier > 1 ? ` · Tier ${TIERS[tier]}` : ''}</div>
                  <div className="card-name">Preview Card</div>
                  <div className="card-value">$250.00</div>
                </div>
              </div>
            </div>
          </div>
          <Select
            label="Rarity"
            options={Object.fromEntries(Object.entries(RARITIES).map(([k, v]) => [k, v.name]))}
            value={rarity} onChange={setRarity}
          />
          <Select
            label="Tier"
            options={{ 1: 'I — Base', 2: 'II', 3: 'III — Sheen', 4: 'IV — Radiant', 5: 'V — Apex' }}
            value={tier} onChange={v => setTier(Number(v))}
          />
        </div>

        {/* ── Middle: Controls ── */}
        <div className="fxe-controls">
          <div className="fxe-section">
            <div className="fxe-section-title">Effect</div>
            <Select label="Type" options={EFFECT_TYPES} value={effectType} onChange={handleEffectTypeChange} />
            <Select label="Blend Mode" options={Object.fromEntries(BLEND_MODES.map(b => [b, b]))} value={blendMode} onChange={setBlendMode} />
            <Slider label="Opacity" min={0} max={1} step={0.01} value={opacity} onChange={setOpacity} />
            {effectType === 'radialRings' && (
              <Slider label="Ring Size" min={4} max={40} step={1} value={ringSize} onChange={setRingSize} unit="px" />
            )}
            {(effectType === 'linearGradient' || effectType === 'conicGradient') && (
              <Slider label="Angle" min={0} max={360} step={1} value={gradientAngle} onChange={setGradientAngle} unit="°" />
            )}
          </div>

          <div className="fxe-section">
            <div className="fxe-section-title">Animation</div>
            <Select label="Type" options={ANIM_TYPES} value={animType} onChange={setAnimType} />
            {animType !== 'none' && (
              <>
                <Slider label="Duration" min={0.5} max={12} step={0.1} value={animDuration} onChange={setAnimDuration} unit="s" />
                <Select label="Direction" options={{ forward: 'Forward', reverse: 'Reverse' }} value={animDirection} onChange={setAnimDirection} />
              </>
            )}
          </div>

          <div className="fxe-section">
            <div className="fxe-section-title">Card Base Filter</div>
            <Select
              label="Filter"
              options={{ none: 'None', hueRotate: 'Hue Rotate', saturate: 'Saturate', brightness: 'Brightness' }}
              value={cardFrontFilter} onChange={setCardFrontFilter}
            />
            {cardFrontFilter !== 'none' && (
              <Slider
                label="Amount"
                min={cardFrontFilter === 'hueRotate' ? 0 : cardFrontFilter === 'saturate' ? 5 : 50}
                max={cardFrontFilter === 'hueRotate' ? 360 : cardFrontFilter === 'saturate' ? 30 : 200}
                step={1} value={cardFrontFilterAmount} onChange={setCardFrontFilterAmount}
                unit={cardFrontFilter === 'hueRotate' ? '°' : ''}
              />
            )}
          </div>
        </div>

        {/* ── Right: Color Stops ── */}
        <div className="fxe-stops-col">
          <div className="fxe-section-title">Color Stops</div>
          <p className="fxe-stops-help">
            {effectType === 'radialRings'
              ? 'Each stop = one concentric ring. Hue sets its color position on the spectrum. Alpha sets transparency. Ring Size controls spacing between stops in px.'
              : effectType === 'linearGradient' || effectType === 'conicGradient'
              ? 'Stops are spread evenly across the gradient. Hue sets color, Alpha sets transparency. The pattern repeats after the last stop.'
              : 'One stop controls the center color of the radial overlay. Hue sets its color, Alpha controls how opaque it is at the center.'}
          </p>
          <div className="fxe-stops-list">
            {colorStops.map((s, i) => (
              <ColorStop key={i} index={i} hue={s.hue} opacity={s.opacity}
                onChange={handleStopChange} onRemove={handleStopRemove}
                canRemove={colorStops.length > 2} />
            ))}
          </div>
          <button className="fxe-add-btn" onClick={handleStopAdd}>+ Add Stop</button>
        </div>
      </div>

      {/* ── CSS Output ── */}
      <div className="fxe-output">
        <div className="fxe-output-header">
          <span className="fxe-output-label">Generated CSS</span>
          <button className={`fxe-copy-btn${copied ? ' fxe-copy-btn--done' : ''}`} onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy CSS'}
          </button>
        </div>
        <pre className="fxe-code">{css}</pre>
      </div>
    </div>
  );
}
