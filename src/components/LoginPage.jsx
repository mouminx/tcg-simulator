import { useEffect, useRef, useState } from 'react';
import { NAME_MAX, isDisplayNameAvailable, signIn, signUp, validateDisplayName } from '../game/account';

/**
 * The entry page — choose Solo Self Found or preview the upcoming Online mode.
 *
 * Rendered by `App`'s boot gate whenever there is no restored online session. Online remains visible so
 * players know what is planned, but its account actions stay disabled until that mode is released.
 *
 * ── Offline is a real button, not a fallback link ──
 * SSF is a mode the player is entitled to, not a degraded state, and it is also the honest answer to "I
 * have no connection". A sign-in screen that cannot succeed and offers no way past itself is a trap.
 */
export default function LoginPage({ onSignedIn, onPlayOffline, initialError, onlineAvailable = true }) {
  const [mode, setMode] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? null);
  const [notice, setNotice] = useState(null);

  /** null = not checked, 'checking', 'free', 'taken', 'invalid', 'unknown' */
  const [nameState, setNameState] = useState(null);
  const [nameHint, setNameHint] = useState(null);

  const isSignUp = mode === 'signUp';
  const authOpen = mode !== null;
  const nameRequestRef = useRef(0);

  /**
   * Debounced availability check.
   *
   * 450ms because this fires a network request per settled keystroke and a name is short — checking on
   * every character would issue a request the player has already invalidated. Local validation runs
   * immediately, since it costs nothing and catches most mistakes without a round trip.
   *
   * The request counter guards against out-of-order replies: a slow check for "Mou" must not overwrite a
   * fast one for "Mouminx" and tell the player the wrong thing about the name in the box.
   */
  useEffect(() => {
    if (!isSignUp) { setNameState(null); setNameHint(null); return; }
    const trimmed = displayName.trim();
    if (!trimmed) { setNameState(null); setNameHint(null); return; }

    const localError = validateDisplayName(trimmed);
    if (localError) { setNameState('invalid'); setNameHint(localError); return; }

    setNameState('checking');
    setNameHint(null);
    const ticket = ++nameRequestRef.current;
    const timer = setTimeout(async () => {
      const available = await isDisplayNameAvailable(trimmed);
      if (ticket !== nameRequestRef.current) return;
      if (available === null) { setNameState('unknown'); setNameHint('Could not check right now.'); return; }
      setNameState(available ? 'free' : 'taken');
      setNameHint(available ? 'Available' : 'Already taken');
    }, 450);
    return () => clearTimeout(timer);
  }, [displayName, isSignUp]);

  function switchMode(next) {
    if (!onlineAvailable) return;
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    if (isSignUp) {
      const localError = validateDisplayName(displayName);
      if (localError) { setError(`Player name: ${localError.toLowerCase()}`); return; }
      // 'unknown' is allowed through deliberately — the check may have failed for network reasons, and
      // the server is the authority anyway. 'taken' is not, because we already know it will fail.
      if (nameState === 'taken') { setError('That player name is already taken.'); return; }
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (isSignUp) {
        const session = await signUp({ email, password, displayName: displayName.trim() });
        if (!session) {
          // Email confirmation is on. Saying so is the difference between "nothing happened" and "go and
          // check your inbox".
          setNotice('Account created. Confirm your email address, then sign in.');
          setMode('signIn');
          setBusy(false);
          return;
        }
        onSignedIn(session);
      } else {
        onSignedIn(await signIn({ email, password }));
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
    // No `setBusy(false)` on success: the component is about to be replaced by the slot picker, and
    // re-enabling the form first lets a second submit fire against a session that already won.
  }

  return (
    <div className="gate">
      <div className="gate__panel gate__panel--entry">
        <h1 className="gate__title">Cards of Arcana</h1>

        <div className="gate__rule" aria-hidden="true">
          <span className="gate__rule-line" />
          <span className="gate__rule-rune">ᚱ</span>
          <span className="gate__rule-line" />
        </div>

        <div className="gate__choices">
          <section className="gate__choice gate__choice--solo" aria-labelledby="gate-solo-title">
            <div className="gate__choice-mark" aria-hidden="true">ᛟ</div>
            <p className="gate__choice-kicker">Local Journey</p>
            <h2 id="gate-solo-title">Solo Self Found</h2>
            <p className="gate__choice-description">
              Build your collection alone with progress stored only on this device.
            </p>
            <button className="gate__offline" type="button" onClick={onPlayOffline} disabled={busy}>
              Play Offline
            </button>
          </section>

          <section className="gate__choice gate__choice--online gate__choice--locked" aria-labelledby="gate-online-title">
            <div className="gate__lock" aria-label="Coming soon">
              <span>Coming Soon</span>
            </div>
            <div className="gate__choice-mark gate__choice-mark--lock" aria-hidden="true">
              <span className="gate__padlock" />
            </div>
            <p className="gate__choice-kicker">Account Journey</p>
            <h2 id="gate-online-title">Online</h2>
            <p className="gate__choice-description">
              Sign in to carry cloud saves between devices while online features continue to grow.
            </p>
            <div className="gate__tabs" aria-label="Online account actions">
              <button
                type="button"
                className="gate__tab"
                disabled
              >
                Sign In
              </button>
              <button
                type="button"
                className="gate__tab"
                disabled
              >
                Create Account
              </button>
            </div>
          </section>
        </div>

        {initialError && !authOpen && <p className="gate__error gate__entry-error" role="alert">{initialError}</p>}

        {authOpen && (
          <div className="gate__auth-backdrop" role="presentation">
            <section className="gate__auth-dialog" role="dialog" aria-modal="true" aria-labelledby="gate-auth-title">
              <button
                type="button"
                className="gate__auth-close"
                onClick={() => switchMode(null)}
                aria-label="Back to play mode selection"
              >
                ×
              </button>
              <p className="gate__choice-kicker">Online Account</p>
              <h2 id="gate-auth-title">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
              <p className="gate__auth-description">
                {isSignUp ? 'Create an identity for cloud saves.' : 'Continue with your online saves.'}
              </p>

              <form className="gate__form" onSubmit={handleSubmit}>
                {isSignUp && (
                  <label className="gate__field">
                    <span className="gate__label">
                      Player Name
                      {nameHint && (
                        <span className={`gate__name-state gate__name-state--${nameState}`}>{nameHint}</span>
                      )}
                      {nameState === 'checking' && <span className="gate__name-state">Checking…</span>}
                    </span>
                    <input
                      className="gate__input" type="text" value={displayName} autoComplete="nickname"
                      onChange={e => setDisplayName(e.target.value)}
                      maxLength={NAME_MAX} required
                      placeholder="Unique, and how others see you"
                    />
                  </label>
                )}

                <label className="gate__field">
                  <span className="gate__label">Email</span>
                  <input
                    className="gate__input" type="email" value={email} autoComplete="email" required
                    onChange={e => setEmail(e.target.value)}
                  />
                </label>

                <label className="gate__field">
                  <span className="gate__label">Password</span>
                  <input
                    className="gate__input" type="password" value={password} required minLength={6}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    onChange={e => setPassword(e.target.value)}
                  />
                </label>

                {error && <p className="gate__error" role="alert">{error}</p>}
                {notice && <p className="gate__notice" role="status">{notice}</p>}

                <button className="gate__submit" type="submit" disabled={busy}>
                  {busy ? 'Please wait…' : (isSignUp ? 'Create Account' : 'Sign In')}
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
