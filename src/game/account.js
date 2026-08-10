/**
 * The online account — Supabase auth, and the remote save adapters that ride on it.
 *
 * ── Everything here is optional at runtime ──
 * `isOnlineConfigured()` is false when the env vars are absent, and the whole online path then does not
 * exist as far as the UI is concerned: no sign-in, no online slots, the game boots into SSF exactly as it
 * did before. That is what makes the desktop build genuinely offline rather than online with the network
 * unplugged, and it means a clone with no Supabase project still runs.
 *
 * ── `@supabase/supabase-js` is imported LAZILY ──
 * It is ~215 KB of client that the SSF build has no use for. `three` is handled the same way and for the
 * same reason (see Scene Backdrops in CLAUDE.md): a static import anywhere in the module graph puts it in
 * the main bundle and every offline player downloads it. The dynamic `import()` below is load-bearing.
 */

/**
 * Vite requires `import.meta.env` keys to be statically analysable, so these are written out rather than
 * looked up from a variable. `VITE_`-prefixed vars are the only ones exposed to client code — which is
 * correct here: the publishable/anon key is designed to be public, and the security model is RLS plus
 * `save_game()`, not key secrecy. Nothing in this file should ever read a service-role key.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export function isOnlineConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let clientPromise = null;

/**
 * Creates the Supabase client, once.
 *
 * `persistSession` is on so a player is not asked to sign in every launch — the refresh token lives in
 * `localStorage` under Supabase's own keys, separate from the game saves and unaffected by the storage
 * adapters. `detectSessionInUrl` is off: there is no OAuth redirect to parse, and in the Electron shell
 * the app is served from `app://` where URL-based session detection is meaningless.
 */
export function getClient() {
  if (!isOnlineConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
    ));
  }
  return clientPromise;
}

// ── Player names ─────────────────────────────────────────────────────────────

export const NAME_MIN = 2;
export const NAME_MAX = 24;

/**
 * Client-side validation of a player name, matching the database's constraints exactly.
 *
 * Duplicated deliberately rather than relying on the server: this runs on every keystroke to give
 * immediate feedback, and a round-trip per character would be both slow and a needless load. The
 * database is still the authority — these rules exist there as CHECK constraints and a unique index, so
 * a mismatch here can only ever be *more* permissive than reality, and the submission would then fail
 * with the server's message.
 */
export function validateDisplayName(name) {
  const trimmed = (name ?? '').trim();
  if (trimmed.length < NAME_MIN) return `At least ${NAME_MIN} characters.`;
  if (trimmed.length > NAME_MAX) return `At most ${NAME_MAX} characters.`;
  if (/\s\s/.test(trimmed)) return 'No double spaces.';
  return null;
}

/**
 * Asks the server whether a name is free.
 *
 * Backed by `is_display_name_available`, which is callable before an account exists and returns only a
 * boolean — no ids, no listing, no near-matches. Returns null when the check itself could not run, which
 * the form must treat as "unknown" rather than "taken": refusing a name because the network hiccuped
 * would be worse than letting the submission fail with the real reason.
 */
export async function isDisplayNameAvailable(name) {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client.rpc('is_display_name_available', { p_name: name });
  if (error) return null;
  return data === true;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Supabase's auth errors are accurate and unhelpful to a player ("Invalid login credentials",
 * "AuthApiError"). These are the ones worth rewording; anything unrecognised falls through with its
 * original message, because inventing friendly copy for an error you have not seen hides real faults.
 */
function humanizeAuthError(error) {
  const raw = error?.message ?? 'Something went wrong.';
  if (/invalid login credentials/i.test(raw)) return 'That email and password do not match an account.';
  if (/already registered|already been registered/i.test(raw)) return 'An account already exists for that email.';
  if (/player name is already taken/i.test(raw)) return 'That player name is already taken.';
  if (/player name of 2-24/i.test(raw)) return 'Choose a player name of 2 to 24 characters.';
  if (/password should be at least/i.test(raw)) return 'Passwords need to be at least 6 characters.';
  if (/unable to validate email|invalid email/i.test(raw)) return 'That does not look like an email address.';
  if (/email not confirmed/i.test(raw)) return 'Check your email and confirm the account first.';
  if (/for security purposes|rate limit|too many/i.test(raw)) return 'Too many attempts. Wait a minute and try again.';
  if (/failed to fetch|networkerror|load failed/i.test(raw)) return 'Could not reach the server. Check your connection.';
  return raw;
}

export async function getSession() {
  const client = await getClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session ?? null;
}

export async function signIn({ email, password }) {
  const client = await getClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(humanizeAuthError(error));
  return data.session;
}

/**
 * `display_name` goes into `raw_user_meta_data`, which the `handle_new_user` trigger reads when it
 * creates the profile row. The client cannot insert that row itself — it has no INSERT rights — so this
 * is the only point at which a player gets to choose their name.
 *
 * A name collision makes the trigger raise, which rolls the whole transaction back including the
 * `auth.users` insert. So a failed sign-up leaves nothing behind and the email is still free to retry
 * with a different name.
 */
export async function signUp({ email, password, displayName }) {
  const client = await getClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw new Error(humanizeAuthError(error));
  // With email confirmation enabled a session is null here and the player must confirm first. Returning
  // it rather than asserting lets the caller say so instead of appearing to hang.
  return data.session ?? null;
}

export async function signOut() {
  const client = await getClient();
  if (client) await client.auth.signOut();
}

/**
 * The signed-in player's own profile.
 *
 * **The `.eq('id', ...)` filter is required.** `profiles` is readable by every authenticated user — a
 * marketplace listing has to be able to name its seller — so an unfiltered select returns *all* profiles,
 * and `maybeSingle()` then errors on multiple rows and yields null. That is not a security problem, it is
 * simply the wrong query, and it showed up as "Signed in as …" with the name never arriving.
 *
 * Unlike `saves`, RLS cannot narrow this for us, so the query has to say who it means.
 */
export async function getProfile() {
  const client = await getClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  if (error) return null;
  return data;
}

// ── Online slots ─────────────────────────────────────────────────────────────

/**
 * Lists the account's online saves for the slot picker.
 *
 * Selects `meta` rather than `data` on purpose: `meta` is a few hundred bytes of display projection,
 * `data` is the whole save. Reading `data` for three slots would download hundreds of KB to draw a menu
 * on every launch. RLS restricts this to the caller's own rows, so no filter is needed — and an
 * unfiltered select returning someone else's row is one of the things the security tests assert against.
 */
export async function listRemoteSlots(client) {
  const { data, error } = await client
    .from('saves')
    .select('slot, meta, save_version, revision, updated_at');
  if (error) throw new Error(`Could not list your online saves: ${error.message}`);
  return data ?? [];
}

export async function deleteRemoteSlot(client, slot) {
  const { error } = await client.rpc('delete_save', { p_slot: slot });
  if (error) throw new Error(`Could not delete that save: ${error.message}`);
  return true;
}

/**
 * Builds a storage adapter backed by one slot of the player's account.
 *
 * It satisfies the same contract as the local adapters (see `src/game/storage.js`) with two honest
 * differences, both forced by the transport:
 *
 * 1. **It parses.** The others move an opaque blob; this one must hand Postgres real `jsonb`, and must
 *    pull `version` out for `p_save_version` so the server can enforce version monotonicity without
 *    understanding the save. That plus the `meta` projection is the extent of its schema knowledge.
 * 2. **It cannot write synchronously.** See `write` below.
 *
 * `revision` starts at 0 meaning "this slot does not exist yet", which is what `save_game` expects for a
 * first write — starting a new game in an empty online slot.
 */
export function makeRemoteAdapter(client, slot, { buildMeta } = {}) {
  /**
   * The revision this client last saw. `save_game()` refuses a write whose revision does not match the
   * row, which is what stops two signed-in sessions — a desktop app and a browser tab — from silently
   * overwriting each other. Held here rather than in React state because the save path is not a render
   * concern and must not be able to go stale behind a re-render.
   */
  let revision = 0;
  let conflicted = false;

  return {
    name: 'supabase',
    slot,
    describe: () => `slot ${slot} of your online account`,

    async read() {
      const { data, error } = await client
        .from('saves')
        .select('data, save_version, revision')
        .eq('slot', slot)
        .maybeSingle();

      if (error) throw new Error(`Could not load your save: ${error.message}`);
      if (!data) {
        // An empty slot, which is a new game rather than a fault: rows are created by the first write,
        // not seeded at signup. Revision stays 0 so `save_game` takes its insert path.
        revision = 0;
        return null;
      }
      revision = data.revision;
      return JSON.stringify(data.data);
    },

    /**
     * `sync` is accepted and **cannot be honoured**, and pretending otherwise would be the bug here.
     *
     * The flush path fires while the page is being torn down. A file write can be made synchronous over
     * IPC; an HTTP request cannot. `fetch(..., {keepalive: true})` is the standard tool for outliving a
     * page, but it caps the request body at 64 KB and a real save is comfortably larger, so it is not a
     * general answer either.
     *
     * What actually protects progress is that the flush also runs on `visibilitychange` → hidden, which
     * fires while the page is still alive, so the normal async write usually completes. The residual
     * exposure is up to `SAVE_DEBOUNCE_MS` of play if the process is killed outright — which is what the
     * revision check is for: the account stays coherent, it is just occasionally behind.
     */
    async write(serialized) {
      // Once a conflict is seen, every later write would hit the same one and log again. Stopping keeps
      // one clear message instead of a stream, and the player has to reload to resolve it anyway.
      if (conflicted) return false;

      let parsed;
      try {
        parsed = JSON.parse(serialized);
      } catch {
        return false; // Never send something the server would reject as malformed.
      }

      const { data, error } = await client.rpc('save_game', {
        p_slot: slot,
        p_data: parsed,
        p_save_version: parsed.version ?? 0,
        p_revision: revision,
        p_meta: buildMeta ? buildMeta(parsed) : {},
      });

      if (error) {
        if (error.code === 'PT409') {
          conflicted = true;
          console.error('[save] conflict: another session has written this slot. Reload to continue.');
        } else {
          console.error('[save] remote write rejected:', error.message);
        }
        return false;
      }

      const next = Array.isArray(data) ? data[0] : data;
      if (next?.revision != null) revision = next.revision;
      return true;
    },

    async remove() {
      return deleteRemoteSlot(client, slot);
    },
  };
}
