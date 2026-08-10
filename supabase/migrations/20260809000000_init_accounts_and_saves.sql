-- ═══════════════════════════════════════════════════════════════════════════════
-- Accounts and saves — the online mode's foundation.
--
-- One row per player holding the same JSON blob the SSF build keeps in a file. The interesting part
-- is not the schema, it is who is allowed to write it.
--
-- ── RLS proves WHO you are, not whether your data is legitimate ──
-- This is the mistake this migration exists to avoid. The obvious design is a `saves` table with
-- `USING (auth.uid() = user_id)` on UPDATE, which reads as secure and is not: it authenticates the
-- writer and then accepts whatever JSON they send. The client is a bundle of JavaScript on the
-- player's machine, so "the authenticated user sent it" is worth nothing as a guarantee about the
-- contents. A player opens devtools and writes `{"balance": 999999999}`, and RLS approves, because the
-- row genuinely is theirs.
--
-- That is tolerable in a single-player game — cheating only affects you. It is not tolerable the
-- moment there is a marketplace, because forged gold and forged cards get *traded to other players*
-- and the whole economy is downstream of it.
--
-- So clients get **no INSERT, UPDATE or DELETE on `saves` at all**. The only write path is
-- `save_game()`, a SECURITY DEFINER function. Today that function validates structure, size and
-- monotonicity rather than re-simulating the game — full validation is the next phase, and it needs
-- server-side game rules to exist first. The point of doing this now is that the chokepoint is in
-- place: when validation arrives it goes inside a function every client already calls, rather than
-- requiring a migration that takes away a permission players have been relying on.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Public-facing identity, kept separate from `auth.users` because that table holds the email and
-- password hash and must never be exposed. A marketplace needs to show *someone* as the seller, and
-- that someone is this row.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),

  -- Loose enough to allow real names, tight enough that a display name cannot be used to inject
  -- markup into another player's client or impersonate a system account by padding with whitespace.
  constraint display_name_length check (char_length(display_name) between 2 and 24),
  constraint display_name_trimmed check (display_name = btrim(display_name))
);

comment on table public.profiles is
  'Public player identity. Never contains credentials — those stay in auth.users.';

-- ── saves ────────────────────────────────────────────────────────────────────
create table public.saves (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  -- The same blob `src/game/storage.js` moves around. Deliberately opaque to the database: the save's
  -- shape is the game's business, and encoding it as columns here would mean a migration on both
  -- sides for every gameplay change. See the adapter's "raw strings, not parsed state" note.
  data         jsonb not null,
  -- The client's SAVE_VERSION. Stored alongside rather than dug out of `data` so the server can reason
  -- about compatibility without knowing the save's internals.
  save_version integer not null,
  -- Optimistic concurrency. Two clients signed into one account — a desktop app and a browser tab —
  -- would otherwise silently overwrite each other, last-write-wins, and the loser's session vanishes.
  revision     bigint not null default 1,
  updated_at   timestamptz not null default now(),

  -- 0 is the "never saved" sentinel the signup trigger seeds, and it has to be inside the constraint:
  -- with a floor of 1 the trigger's own insert failed the check, which made every registration fail
  -- with a constraint violation. Real client versions start at 1.
  constraint save_version_sane check (save_version between 0 and 10000),
  -- A real save is tens to low hundreds of KB. This is a backstop against a client uploading
  -- something enormous, which is the cheapest denial-of-service available to an authenticated user.
  constraint data_size check (pg_column_size(data) <= 4 * 1024 * 1024),
  -- The save must be a JSON object. `'[]'::jsonb` and `'null'::jsonb` are both valid jsonb and would
  -- crash the client on load.
  constraint data_is_object check (jsonb_typeof(data) = 'object')
);

comment on table public.saves is
  'One save per account. Clients may SELECT their own row and may NOT write it directly — see save_game().';

-- ── Row-level security ───────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.saves    enable row level security;

-- Profiles are readable by any signed-in player: a marketplace listing has to name its seller.
-- Anonymous readers get nothing, so display names are not a scrapeable public directory.
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- A player may rename themselves. This is safe to allow directly because a display name has no
-- economic value — nothing else in the system is derived from it.
create policy "players may update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Read your own save. This is the ONLY policy on `saves`.
--
-- The absence of INSERT/UPDATE/DELETE policies is the security model, not an oversight: with RLS
-- enabled and no permissive policy for a command, that command is denied for every non-superuser.
-- Nothing needs to be explicitly revoked, and adding a policy later is the thing to be suspicious of.
create policy "players may read their own save"
  on public.saves for select
  to authenticated
  using (auth.uid() = user_id);

-- ── Account bootstrap ────────────────────────────────────────────────────────
-- A trigger rather than a client call after sign-up. If the client created these rows, an interrupted
-- sign-up would leave an account that can authenticate but has no profile and no save — and the client
-- would need INSERT rights on both tables, which is exactly what the model above is withholding.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- An empty search_path is mandatory in a SECURITY DEFINER function. Without it a caller can prepend a
-- schema they control and have their own `profiles` table resolved instead, executing as the owner.
-- Every reference below is therefore schema-qualified.
set search_path = ''
as $$
declare
  requested_name text;
begin
  -- `display_name` may be supplied at sign-up. Fall back to the local part of the email, then to a
  -- generic name, so the NOT NULL constraint can never fail a registration.
  requested_name := btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  ));

  if char_length(requested_name) < 2 or char_length(requested_name) > 24 then
    requested_name := 'Adventurer';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, requested_name);

  -- An empty save rather than no row. `parseSave('{}')` yields a fresh game, so a new account is
  -- playable immediately and the client never has to distinguish "no row yet" from "new player".
  insert into public.saves (user_id, data, save_version, revision)
  values (new.id, '{}'::jsonb, 0, 0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── The only write path ──────────────────────────────────────────────────────
create function public.save_game(
  p_data         jsonb,
  p_save_version integer,
  p_revision     bigint
)
returns public.saves
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := auth.uid();
  current public.saves;
  result  public.saves;
begin
  -- SECURITY DEFINER means this function runs as its owner and bypasses RLS, so it must establish the
  -- caller's identity itself. Reading `auth.uid()` rather than taking a user id as a parameter is the
  -- whole difference between a save endpoint and an "overwrite anybody's save" endpoint.
  -- ── A note on these error codes, because the obvious choices are wrong ──
  -- PostgREST maps SQLSTATE to HTTP, and it treats `40001` (serialization_failure) as a *retryable*
  -- transaction conflict — it reissues the request automatically. Raising `40001` for a business-logic
  -- conflict therefore does not return 409 to the client; it makes PostgREST retry the same doomed
  -- write until the gateway gives up, and the client sees `504 upstream server is timing out`.
  --
  -- `PTxxx` is PostgREST's explicit escape hatch: the last three digits become the HTTP status. Using
  -- it states the intent instead of relying on a mapping that can change meaning.
  if caller is null then
    raise exception 'not authenticated' using errcode = 'PT401';
  end if;

  select * into current from public.saves where user_id = caller for update;

  if not found then
    -- The signup trigger should have created it. Recover rather than fail: a player who cannot save is
    -- worse off than one whose row was created late.
    insert into public.saves (user_id, data, save_version, revision)
    values (caller, p_data, p_save_version, 1)
    returning * into result;
    return result;
  end if;

  -- Optimistic concurrency. The client sends the revision it last saw; a mismatch means another
  -- session wrote in between, so this write is refused instead of silently discarding that session's
  -- progress. The client's job is to reload and let the player decide, not to retry blindly.
  if p_revision is not null and p_revision <> current.revision then
    raise exception 'save conflict: expected revision %, client had %', current.revision, p_revision
      using errcode = 'PT409';
  end if;

  -- A save version must never go backwards. An older client signing into an account already migrated
  -- by a newer one would otherwise write a shape the new client has no migration path back from —
  -- migrations only run forward. Equal is fine; that is the normal case.
  if p_save_version < current.save_version then
    raise exception 'save version regression: account is at %, client sent %', current.save_version, p_save_version
      using errcode = 'PT409';
  end if;

  update public.saves
     set data         = p_data,
         save_version = p_save_version,
         revision     = current.revision + 1,
         updated_at   = now()
   where user_id = caller
  returning * into result;

  return result;
end;
$$;

comment on function public.save_game is
  'The only way a client can write a save. Validates identity, revision and version monotonicity. '
  'Full gameplay validation belongs here and is the next phase.';

-- `execute` is granted to PUBLIC by default on new functions, which would let an unauthenticated
-- caller reach it — it would then fail on the auth.uid() check, but it should not be callable at all.
revoke execute on function public.save_game(jsonb, integer, bigint) from public;
grant  execute on function public.save_game(jsonb, integer, bigint) to authenticated;

-- Belt and braces alongside the absent policies: even if someone later adds a permissive policy by
-- mistake, the role still holds no table-level privilege to write these rows.
revoke insert, update, delete on public.saves from authenticated, anon;
