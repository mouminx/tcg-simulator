import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SLOT_MODES } from '../game/slots';

/**
 * The in-game account control: who you are, which save you are in, and how to leave it.
 *
 * Before this, the only route back to the slot picker was reloading the page, and signing out existed
 * solely on the picker itself — so a player in a save had no way to change their mind.
 *
 * ── The panel is PORTALED to document.body, and that is not optional ──
 * `.header` is a stacking context (sticky, `z-index: 200`) and `.nav-shell` deliberately sits above it
 * at 201 so the rune particles rising out of the active tab are not clipped by the header. **A z-index
 * on a descendant of the header cannot escape its ancestor's context** — the audio mixer's panel carried
 * `z-index: 12100` and was still painted under the tab bar. Leaving the header entirely is the fix;
 * raising the header would hide the runes, which is the reason the nav is above it.
 *
 * Consequence: the outside-click handler must test **both** the trigger and the portaled panel, because
 * the panel is no longer a descendant of the trigger.
 */
export default function AccountMenu({
  signedIn,
  onlineAvailable,
  playerName,
  slot,
  onSwitchSave,
  onSignOut,
  onSignIn,
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const trigger = rootRef.current;
    if (!trigger) return undefined;
    const measure = () => {
      const box = trigger.getBoundingClientRect();
      // Anchored to the trigger's right edge and clamped, so it cannot run off a narrow window.
      setAnchor({ top: box.bottom + 9, right: Math.max(8, window.innerWidth - box.right) });
    };
    measure();
    // The header is sticky so scrolling does not move it, but a resize changes the clamp.
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
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

  const isCloud = slot?.mode === SLOT_MODES.ONLINE;
  const label = signedIn ? (playerName ?? 'Signed in') : 'Offline';

  /**
   * Both of these leave the current save, so they must not fire twice. `busy` latches rather than
   * resetting: the component is about to be replaced by the slot picker or the login page, and
   * re-enabling the buttons first would let a second click race the first.
   */
  const run = action => async () => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    await action();
  };

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu__trigger"
        aria-expanded={open}
        aria-label="Account and saves"
        title="Account and saves"
        onClick={() => setOpen(o => !o)}
      >
        <span className="account-menu__glyph" aria-hidden="true">ᛝ</span>
        <span className="account-menu__name">{label}</span>
      </button>

      {open && anchor && createPortal(
        <div
          className="account-menu__panel"
          ref={panelRef}
          style={{ top: `${anchor.top}px`, right: `${anchor.right}px` }}
          role="dialog"
          aria-label="Account and saves"
        >
          <div className="account-menu__header">
            <span className="account-menu__label">
              {signedIn ? 'Account' : 'Playing offline'}
            </span>
            {signedIn && <strong className="account-menu__player">{playerName ?? '…'}</strong>}
          </div>

          {slot && (
            <div className="account-menu__slot">
              <span className={`slots__badge slots__badge--${slot.mode}`}>
                {isCloud ? 'Cloud' : 'SSF'}
              </span>
              <span className="account-menu__slot-text">Slot {slot.slot}</span>
            </div>
          )}

          {/* Says plainly that there is no multiplayer yet, so a cloud save does not read as a promise
              of trading that is not there. The Market tab is gated by COMING_SOON_VIEWS. */}
          <p className="account-menu__note">
            {isCloud
              ? 'Saved to your account. Trading and the market are not open yet.'
              : 'Solo self-found, saved on this device only.'}
          </p>

          <div className="account-menu__actions">
            <button
              type="button" className="account-menu__action" disabled={busy}
              onClick={run(onSwitchSave)}
            >
              Switch Save
            </button>

            {signedIn && (
              <button
                type="button" className="account-menu__action" disabled={busy}
                onClick={run(onSignOut)}
              >
                Sign Out
              </button>
            )}
            {!signedIn && onlineAvailable && (
              <button
                type="button" className="account-menu__action" disabled={busy}
                onClick={run(onSignIn)}
              >
                Sign In
              </button>
            )}
          </div>

          <p className="account-menu__hint">Your progress is saved before leaving.</p>
        </div>,
        document.body,
      )}
    </div>
  );
}
