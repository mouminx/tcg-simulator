import { useState } from 'react';
import { SLOT_MODES } from '../game/slots';
import { fmt } from '../game/cards';

/**
 * The slot picker — three positions, each empty or holding an SSF or online save.
 *
 * Shown after the login page (or straight away when signed out / offline-only). `slots` comes from
 * `listSlots()`, which has already reconciled local and server positions.
 *
 * ── Deleting asks twice ──
 * A save is hours of play and there is no undo — the online path is a server-side DELETE and the local one
 * removes the file and its backup. So the button becomes a confirm in place rather than opening a dialog:
 * a modal that appears under the cursor is exactly how someone confirms something they did not mean to.
 */
export default function SaveSlots({
  slots,
  overflow = [],
  canCreate = true,
  signedIn,
  playerName,
  onPlay,
  onCreate,
  onDelete,
  onSignOut,
  onSignIn,
  /**
   * Whether online mode exists in this build at all. False in an `ssf` build, where the Supabase vars
   * are compiled out — offering "Sign In For Online Saves" there is a dead end, because the login page
   * would render with no possible way to succeed.
   */
  onlineAvailable = true,
  busySlot = null,
  error = null,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [creatingIn, setCreatingIn] = useState(null);

  const describe = entry => {
    if (entry.corrupt) return 'Unreadable save';
    const m = entry.meta ?? {};
    const bits = [];
    if (m.cards != null) bits.push(`${m.cards} card${m.cards === 1 ? '' : 's'}`);
    if (m.balance != null) bits.push(`${fmt(m.balance)} gold`);
    return bits.length ? bits.join(' · ') : 'New game';
  };

  return (
    <div className="gate">
      <div className="gate__panel gate__panel--slots">
        <h1 className="gate__title">Choose a Save</h1>

        <div className="gate__rule" aria-hidden="true">
          <span className="gate__rule-line" />
          <span className="gate__rule-rune">ᚱ</span>
          <span className="gate__rule-line" />
        </div>

        <p className="slots__account">
          {signedIn
            ? <>Signed in as <strong>{playerName ?? '…'}</strong></>
            : <>Playing offline — only saves on this device are available</>}
        </p>

        {error && <p className="gate__error" role="alert">{error}</p>}

        <ul className="slots__list">
          {slots.map(entry => {
            const busy = busySlot === entry.slot;
            const isEmpty = entry.mode == null;
            const confirming = confirmingDelete === entry.slot;
            const choosing = creatingIn === entry.slot;

            return (
              <li key={entry.slot} className={`slots__item${isEmpty ? ' slots__item--empty' : ''}`}>
                <span className="slots__index">{entry.slot}</span>

                {isEmpty ? (
                  <div className="slots__body">
                    {choosing ? (
                      <>
                        <span className="slots__prompt">New game in slot {entry.slot}</span>
                        <div className="slots__actions">
                          <button
                            type="button" className="slots__btn slots__btn--primary" disabled={busy}
                            onClick={() => { setCreatingIn(null); onCreate(entry.slot, SLOT_MODES.SSF); }}
                          >
                            SSF
                          </button>
                          <button
                            type="button" className="slots__btn slots__btn--primary"
                            disabled={busy || !signedIn}
                            title={signedIn ? undefined : 'Sign in to create a cloud save'}
                            onClick={() => { setCreatingIn(null); onCreate(entry.slot, SLOT_MODES.ONLINE); }}
                          >
                            Cloud
                          </button>
                          <button
                            type="button" className="slots__btn" disabled={busy}
                            onClick={() => setCreatingIn(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button" className="slots__new" disabled={busy || !canCreate}
                        title={canCreate ? undefined : 'Free a slot before creating a new save'}
                        onClick={() => setCreatingIn(entry.slot)}
                      >
                        + Empty Slot
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="slots__body">
                    <div className="slots__headline">
                      {/* "Cloud", not "Online": there is no multiplayer yet, and a badge saying
                          Online reads as a promise of trading that is not there. The underlying mode id
                          stays `online`, because that is the slot which gains market access when the
                          market opens — an SSF slot never will, which is the point of self-found. */}
                      <span className={`slots__badge slots__badge--${entry.mode}`}>
                        {entry.mode === SLOT_MODES.ONLINE ? 'Cloud' : 'SSF'}
                      </span>
                      <span className="slots__summary">{describe(entry)}</span>
                    </div>

                    <div className="slots__actions">
                      {confirming ? (
                        <>
                          <span className="slots__confirm-text">Delete this save?</span>
                          <button
                            type="button" className="slots__btn slots__btn--danger" disabled={busy}
                            onClick={() => { setConfirmingDelete(null); onDelete(entry); }}
                          >
                            Delete
                          </button>
                          <button
                            type="button" className="slots__btn" disabled={busy}
                            onClick={() => setConfirmingDelete(null)}
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button" className="slots__btn slots__btn--primary" disabled={busy}
                            onClick={() => onPlay(entry)}
                          >
                            {busy ? 'Loading…' : 'Play'}
                          </button>
                          <button
                            type="button" className="slots__btn" disabled={busy}
                            onClick={() => setConfirmingDelete(entry.slot)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Only appears when saves outnumber positions. Nothing has been lost; it says what to do. */}
        {overflow.length > 0 && (
          <p className="slots__overflow" role="status">
            You have {slots.filter(s => s.mode).length + overflow.length} saves for 3 slots, so
            {overflow.length === 1 ? ' one is' : ` ${overflow.length} are`} not shown. Nothing has been
            deleted — free a slot and it will reappear.
          </p>
        )}

        <div className="gate__rule gate__rule--minor" aria-hidden="true">
          <span className="gate__rule-line" />
          <span className="gate__rule-rune">ᛟ</span>
          <span className="gate__rule-line" />
        </div>

        {signedIn && (
          <button className="gate__offline" type="button" onClick={onSignOut}>Sign Out</button>
        )}
        {!signedIn && onlineAvailable && (
          <button className="gate__offline" type="button" onClick={onSignIn}>Sign In For Cloud Saves</button>
        )}
      </div>
    </div>
  );
}
