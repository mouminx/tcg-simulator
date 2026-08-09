import { useEffect, useMemo, useState } from 'react';
import SceneBackdrop from './SceneBackdrop';
import { useGraphicsFeatures } from '../game/graphics';
import { RELEASE } from '../game/changelog';

const STREAM_RUNES = ['ᚠ', 'ᚨ', 'ᛁ', 'ᚾ', 'ᛗ', 'ᛟ', '⩔', '𐌘', 'ᚱ', 'ᛊ', 'ᛞ', 'ᚷ', 'ᚲ', 'ᛚ'];

/**
 * The drifting stream that crosses the title screen from lower-left to upper-right.
 *
 * DOM rather than part of the 3D scene, for two reasons: the runes are real glyphs in the game's
 * runic face, which would otherwise need a texture atlas baked per glyph; and it composites over
 * the WebGL canvas so it still works when the scene falls back to its CSS gradient.
 *
 * Built once with a seeded generator so the field does not reshuffle on every re-render — the
 * menu re-renders when the notes are collapsed, and particles jumping at that moment would be
 * very obvious.
 */
function makeStream(count) {
  let seed = 20260807;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => {
    // Every third particle is a rune; the rest are motes. All runes would read as a spell effect
    // rather than as drifting air.
    const rune = i % 3 === 0 ? STREAM_RUNES[Math.floor(rnd() * STREAM_RUNES.length)] : null;
    return {
      id: i,
      rune,
      lane: rnd(),
      // Negative, so the stream is already mid-flight when the screen opens instead of starting
      // empty and filling in over half a minute.
      delay: -rnd() * 70,
      // Wide spread rather than a narrow band. Squared toward the slow end, so most particles
      // drift and a few move noticeably faster — a uniform speed reads as a scrolling texture
      // rather than as air.
      duration: 20 + rnd() * rnd() * 62,
      scale: rune ? 0.75 + rnd() * 0.8 : 0.55 + rnd() * 0.95,
      sway: (rnd() * 2 - 1).toFixed(2),
      swayDuration: 7 + rnd() * 9,
      opacity: (rune ? 0.34 : 0.42) + rnd() * 0.4,
    };
  });
}

/**
 * The main menu — **one screen, one behaviour**.
 *
 * There used to be two modes: a one-shot `intro` on load that auto-advanced after 6s and could be
 * dismissed by clicking anywhere, and a `menu` reopened from the wordmark that carried the release
 * notes. Two variants of the same screen meant the thing a player saw first was not the thing they
 * could get back to, and the one they saw first threw them into the game whether they were ready or
 * not. There is now just the menu: the mountains, the notes, and an explicit Enter.
 *
 * **No auto-advance and no click-anywhere dismissal.** Both would fire while the player is reading
 * or arrow-scrolling the notes. Escape or the Enter button, deliberately.
 *
 * `onDismiss` is called after the fade so the parent can unmount us and, with it, the
 * splash's WebGL context.
 */
export default function SplashScreen({ onDismiss, resumable = false }) {
  const [leaving, setLeaving] = useState(false);
  // Closed by default. Three cards fill the middle of the screen, which is exactly where the
  // mountains and the drifting stream are — expanded, the menu is a changelog with some scenery
  // at the edges rather than a title screen. Opening the menu should show the artwork; the notes
  // are one click away.
  const [notesOpen, setNotesOpen] = useState(false);
  const features = useGraphicsFeatures();
  // Same gate as the nav runes: at low and medium the CSS quality overrides switch off always-on
  // animations, so these would sit frozen on screen as a scatter of static dots.
  const stream = useMemo(() => (features.runeParticles ? makeStream(92) : []), [features.runeParticles]);

  // Unmount after the fade-out transition.
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = window.setTimeout(() => onDismiss?.(), 620);
    return () => window.clearTimeout(timer);
  }, [leaving, onDismiss]);

  useEffect(() => {
    function handleKey(event) {
      // Escape only. Any-key would fire while the player is scrolling the notes with the arrows.
      if (event.key !== 'Escape') return;
      setLeaving(true);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const release = RELEASE;

  return (
    <div
      className={[
        'splash',
        leaving ? 'splash--leaving' : '',
        // Drives the title's size and position: large and centred with the notes closed, smaller
        // and raised with them open, so the notes have somewhere to go.
        notesOpen ? 'splash--notes-open' : '',
      ].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
      tabIndex={-1}
    >
      <SceneBackdrop scene="splash" className="scene-backdrop--splash-host" />

      {stream.length > 0 && (
        <div className="splash__stream" aria-hidden="true">
          {stream.map(particle => (
            <span
              key={particle.id}
              className="splash__stream-particle"
              style={{
                left: `${-14 + particle.lane * 78}%`,
                '--dur': `${particle.duration}s`,
                '--delay': `${particle.delay}s`,
                '--op': particle.opacity,
              }}
            >
              <span
                className="splash__stream-sway"
                style={{ '--sway': particle.sway, '--sway-dur': `${particle.swayDuration}s` }}
              >
                {particle.rune
                  ? <span className="splash__stream-rune" style={{ '--s': particle.scale }}>{particle.rune}</span>
                  : <span className="splash__stream-mote" style={{ '--s': particle.scale }} />}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="splash__content">
        <h1 className="splash__title">Cards of Arcana</h1>

        <div className="splash__rule" aria-hidden="true">
          <span className="splash__rule-line" />
          <span className="splash__rule-rune">ᛜ</span>
          <span className="splash__rule-line" />
        </div>

        <p className="splash__build">
          <span className="splash__build-stage">{release.stage}</span>
          <span className="splash__build-version">{__APP_VERSION__}</span>
        </p>

        <button
          type="button"
          className="splash__notes-toggle"
          onClick={() => setNotesOpen(open => !open)}
          aria-expanded={notesOpen}
        >
          {notesOpen ? 'Hide release notes' : 'Show release notes'}
        </button>

        {notesOpen && (
          <div className="splash__notes">
            {[
              ['Changelog', 'changelog', release.changelog],
              ['Known Issues', 'known', release.known],
              ['Planned', 'planned', release.planned],
            ].map(([heading, key, items]) => (items?.length ? (
              <section key={key} className={`splash__note-card splash__note-card--${key}`}>
                <h3 className="splash__note-card__title">{heading}</h3>
                <ul className="splash__note-card__list">
                  {items.map(item => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ) : null))}
          </div>
        )}

        <button
          type="button"
          className="splash__enter"
          onClick={e => { e.stopPropagation(); setLeaving(true); }}
        >
          {resumable ? 'Resume' : 'Enter'}
        </button>
      </div>
    </div>
  );
}
