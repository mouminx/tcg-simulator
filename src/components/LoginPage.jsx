import { useEffect, useRef, useState } from 'react';
import { NAME_MAX, isDisplayNameAvailable, signIn, signUp, validateDisplayName } from '../game/account';

/**
 * The login page — sign in, create an account, or play offline.
 *
 * Rendered by `App`'s boot gate, and only when online mode is configured. A build with no Supabase
 * project never shows it, and neither does the desktop SSF build, so this component may assume the online
 * path exists rather than reasoning about whether it should.
 *
 * ── Offline is a real button, not a fallback link ──
 * SSF is a mode the player is entitled to, not a degraded state, and it is also the honest answer to "I
 * have no connection". A sign-in screen that cannot succeed and offers no way past itself is a trap.
 */
export default function LoginPage({ onSignedIn, onPlayOffline, initialError }) {
  const [mode, setMode] = useState('signIn');
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
      <div className="gate__panel">
        <h1 className="gate__title">Cards of Arcana</h1>

        <div className="gate__rule" aria-hidden="true">
          <span className="gate__rule-line" />
          <span className="gate__rule-rune">ᚱ</span>
          <span className="gate__rule-line" />
        </div>

        <div className="gate__tabs" role="tablist" aria-label="Account">
          <button
            type="button" role="tab" aria-selected={!isSignUp}
            className={`gate__tab${!isSignUp ? ' gate__tab--active' : ''}`}
            onClick={() => switchMode('signIn')}
          >
            Sign In
          </button>
          <button
            type="button" role="tab" aria-selected={isSignUp}
            className={`gate__tab${isSignUp ? ' gate__tab--active' : ''}`}
            onClick={() => switchMode('signUp')}
          >
            Create Account
          </button>
        </div>

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

        <div className="gate__rule gate__rule--minor" aria-hidden="true">
          <span className="gate__rule-line" />
          <span className="gate__rule-rune">ᛟ</span>
          <span className="gate__rule-line" />
        </div>

        <button className="gate__offline" type="button" onClick={onPlayOffline} disabled={busy}>
          Play Offline
        </button>
        <p className="gate__offline-note">
          Solo self-found, stored on this device. No account needed.
          <br />
          Signing in adds cloud saves that follow you between machines. Trading and the market are not
          open yet.
        </p>
      </div>
    </div>
  );
}
