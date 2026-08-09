import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AUDIO_BUSES } from '../game/audio/audioLibrary';
import { audioEngine } from '../game/audio/audioEngine';

const BUS_ROWS = [
  { bus: AUDIO_BUSES.master, label: 'Master' },
  { bus: AUDIO_BUSES.music, label: 'Music' },
  { bus: AUDIO_BUSES.sfx, label: 'Effects' },
  { bus: AUDIO_BUSES.ui, label: 'Interface' },
  { bus: AUDIO_BUSES.ambient, label: 'Ambience' },
];

function SpeakerIcon({ muted, className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9.5h3.4L12.6 5v14L7.4 14.5H4z" fill="currentColor" opacity="0.92" />
      {muted ? (
        <path
          d="M15.6 9.2l5.2 5.6M20.8 9.2l-5.2 5.6"
          stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none"
        />
      ) : (
        <>
          <path
            d="M15.8 9.4a3.6 3.6 0 0 1 0 5.2"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.85"
          />
          <path
            d="M18.4 7.2a7 7 0 0 1 0 9.6"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.55"
          />
        </>
      )}
    </svg>
  );
}

/**
 * Audio mixer popover.
 *
 * `audioSettings` was persisted from the start but had no way to change it — this is that
 * missing surface. Each slider writes straight through to the engine, which applies the
 * gain immediately, so a drag is audible while you drag it.
 *
 * Moving a slider plays a short tone on that slider's own bus. Without it you would be
 * adjusting a level with nothing to hear, which is the usual reason game audio sliders feel
 * broken.
 */
export default function AudioSettings({ settings, onChange }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const lastAuditionRef = useRef(0);

  /**
   * The panel is PORTALED to `document.body` rather than positioned inside the header, and that is
   * the only thing that puts it above the nav.
   *
   * `.header` is a stacking context (sticky + `z-index: 200`) and `.nav-shell` sits deliberately
   * above it at 201, so the rune particles rising out of the active tab are not hidden behind the
   * header. A z-index on a descendant of the header cannot escape its ancestor's context — the
   * panel already carried `z-index: 12100` and was still covered by the bar. Leaving the header
   * entirely is the fix; raising the header instead would put it over the runes.
   */
  useLayoutEffect(() => {
    if (!open) return undefined;
    const trigger = rootRef.current;
    if (!trigger) return undefined;
    const measure = () => {
      const box = trigger.getBoundingClientRect();
      // Anchored to the trigger's RIGHT edge, matching where the panel used to sit, and clamped so
      // it cannot run off the viewport on a narrow window.
      setAnchor({ top: box.bottom + 9, right: Math.max(8, window.innerWidth - box.right) });
    };
    measure();
    // The header is sticky, so a scroll does not move it — but a resize does change the clamp.
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      // Both boxes, because the panel is no longer a descendant of the trigger's wrapper — checking
      // only `rootRef` would close the popover on its own sliders.
      if (rootRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function setBus(bus, value) {
    onChange({
      ...settings,
      buses: { ...settings.buses, [bus]: value },
    });
    // Throttled audition so dragging does not fire a tone per pixel.
    const now = performance.now();
    if (now - lastAuditionRef.current > 140) {
      lastAuditionRef.current = now;
      void audioEngine.playTone({
        bus: bus === AUDIO_BUSES.master ? AUDIO_BUSES.ui : bus,
        frequency: 660,
        durationMs: 90,
        volume: 0.16,
      });
    }
  }

  return (
    <div className="audio-settings" ref={rootRef}>
      <button
        type="button"
        className={`audio-settings__trigger${settings.muted ? ' audio-settings__trigger--muted' : ''}`}
        onClick={() => setOpen(v => !v)}
        title="Audio"
        aria-label="Audio settings"
        aria-expanded={open}
      >
        <SpeakerIcon muted={settings.muted} className="audio-settings__icon" />
      </button>

      {open && anchor && createPortal(
        <div
          className="audio-settings__panel"
          role="dialog"
          aria-label="Audio mixer"
          ref={panelRef}
          style={{ top: `${anchor.top}px`, right: `${anchor.right}px` }}
        >
          <div className="audio-settings__head">
            <span className="audio-settings__title">Audio</span>
            <button
              type="button"
              className={`audio-settings__mute${settings.muted ? ' audio-settings__mute--on' : ''}`}
              onClick={() => onChange({ ...settings, muted: !settings.muted })}
            >
              {settings.muted ? 'Unmute' : 'Mute'}
            </button>
          </div>

          {BUS_ROWS.map(({ bus, label }) => (
            <label key={bus} className="audio-settings__row">
              <span className="audio-settings__label">{label}</span>
              <input
                className="audio-settings__slider"
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={settings.buses[bus] ?? 1}
                disabled={settings.muted}
                onChange={e => setBus(bus, Number(e.target.value))}
              />
              <span className="audio-settings__value">
                {Math.round((settings.buses[bus] ?? 1) * 100)}
              </span>
            </label>
          ))}

          <p className="audio-settings__note">
            Sounds are placeholders, synthesised at runtime.
          </p>
        </div>,
        document.body,
      )}
    </div>
  );
}
