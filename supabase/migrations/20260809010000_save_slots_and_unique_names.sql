-- ═══════════════════════════════════════════════════════════════════════════════
-- Save slots, and globally unique player names.
--
-- Two changes:
--   1. `saves` becomes one row per (account, slot) instead of one per account. Three slots, and a
--      slot is either SSF (local, no row here) or online (a row here).
--   2. `profiles.display_name` becomes globally unique and case-insensitively so, because it is the
--      name a marketplace listing is attributed to.
--
-- Written as a second migration rather than by editing the first, because migrations are append-only
-- once they have been applied anywhere. Editing the initial file would break an already-pushed project
-- with no warning; this applies cleanly whether or not that has happened.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Unique player names ──────────────────────────────────────────────────────
--
-- A UNIQUE INDEX on `lower(display_name)` rather than a UNIQUE CONSTRAINT on the column itself. The
-- constraint would let "Mouminx" and "mouminx" coexist, which is not uniqueness in any sense a player
-- cares about — it is precisely how impersonation works, and on a marketplace listing the difference
-- is invisible.
--
-- `citext` would be the other way to do this; a functional index is chosen because it needs no
-- extension and keeps the column a plain `text` that every client already reads correctly.
create unique index profiles_display_name_unique on public.profiles (lower(display_name));

-- Also forbid names that are only decoratively different. Consecutive whitespace lets "Mou  minx" and
-- "Mou minx" both exist, which is the same impersonation problem wearing a hat.
alter table public.profiles
  add constraint display_name_no_double_space check (display_name !~ '\s\s');

-- ── Slots ────────────────────────────────────────────────────────────────────
alter table public.saves add column slot smallint not null default 1;
alter table public.saves add constraint slot_in_range check (slot between 1 and 3);

-- The primary key moves from `user_id` to `(user_id, slot)`. Dropping and recreating it is the only way
-- to widen a primary key in Postgres.
alter table public.saves drop constraint saves_pkey;
alter table public.saves add primary key (user_id, slot);

alter table public.saves alter column slot drop default;

/**
 * Picker metadata, kept out of `data` on purpose.
 *
 * The slot picker needs to show a name, a balance and a card count for three saves at once. Reading
 * `data` to get them would download three entire saves — hundreds of KB — to render a menu, on every
 * launch. This column is small, the client fills it in as it saves, and the picker selects only this.
 *
 * It is display-only and never trusted for anything: it is a projection of `data`, and if the two ever
 * disagree, `data` is the save.
 */
alter table public.saves add column meta jsonb not null default '{}'::jsonb;
alter table public.saves add constraint meta_is_object check (jsonb_typeof(meta) = 'object');
alter table public.saves add constraint meta_size check (pg_column_size(meta) <= 4096);

comment on column public.saves.meta is
  'Small display projection of `data` for the slot picker. Never authoritative.';

-- ── The signup trigger no longer creates a save ──────────────────────────────
--
-- It used to seed one row with `save_version = 0` as a "never saved" marker. With slots, "which slots
-- exist" is real information: a row means the player created a save there. Seeding three empty rows
-- would make every slot look occupied, and seeding one would privilege slot 1 for no reason.
--
-- A slot row is now created by the first `save_game` call for that slot, which is what happens when a
-- player starts a new game in an empty slot.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  -- The name is required now that it is an identity rather than a label. Falling back to a generated
  -- one would hand a player a name they never chose and cannot change without a UI that does not exist.
  if char_length(requested_name) < 2 or char_length(requested_name) > 24 then
    raise exception 'A player name of 2-24 characters is required.' using errcode = 'PT400';
  end if;

  -- Checked explicitly so the player gets this sentence instead of a raw unique-violation. The index is
  -- still what enforces it — this is only the error message. A concurrent signup with the same name can
  -- still lose the race here and fall through to the constraint, which the handler below catches.
  if exists (select 1 from public.profiles where lower(display_name) = lower(requested_name)) then
    raise exception 'That player name is already taken.' using errcode = 'PT409';
  end if;

  begin
    insert into public.profiles (id, display_name) values (new.id, requested_name);
  exception when unique_violation then
    raise exception 'That player name is already taken.' using errcode = 'PT409';
  end;

  return new;
end;
$$;

-- ── Name availability, for the sign-up form ─────────────────────────────────
--
-- Callable by `anon` because it is needed *before* an account exists. That does make it a boolean
-- oracle for "does this name exist", which is a deliberate trade: display names are shown to every
-- signed-in player on marketplace listings, so they are public information by design, and the
-- alternative is a form that can only report a collision after failing a submission.
--
-- It returns a boolean and nothing else — no ids, no listing, no near-matches.
create function public.is_display_name_available(p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  candidate text := btrim(coalesce(p_name, ''));
begin
  if char_length(candidate) < 2 or char_length(candidate) > 24 then return false; end if;
  if candidate ~ '\s\s' then return false; end if;
  return not exists (
    select 1 from public.profiles where lower(display_name) = lower(candidate)
  );
end;
$$;

revoke execute on function public.is_display_name_available(text) from public;
grant  execute on function public.is_display_name_available(text) to anon, authenticated;

-- ── save_game gains a slot ──────────────────────────────────────────────────
-- The old signature is dropped rather than overloaded: two functions differing only by an added
-- parameter is exactly how a client ends up silently calling the wrong one and writing to slot 1.
drop function if exists public.save_game(jsonb, integer, bigint);

create function public.save_game(
  p_slot         smallint,
  p_data         jsonb,
  p_save_version integer,
  p_revision     bigint,
  p_meta         jsonb default '{}'::jsonb
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
  -- SECURITY DEFINER bypasses RLS, so identity is established here rather than trusted from a
  -- parameter. Taking a user id would turn this into an overwrite-anybody's-save endpoint.
  if caller is null then
    raise exception 'not authenticated' using errcode = 'PT401';
  end if;

  if p_slot is null or p_slot < 1 or p_slot > 3 then
    raise exception 'slot must be 1, 2 or 3' using errcode = 'PT400';
  end if;

  select * into current from public.saves where user_id = caller and slot = p_slot for update;

  if not found then
    -- First write to an empty slot: this is what "new game" means online. A caller claiming a revision
    -- for a slot that does not exist is out of step with the server and must re-read.
    if p_revision is not null and p_revision <> 0 then
      raise exception 'save conflict: slot % does not exist, client had revision %', p_slot, p_revision
        using errcode = 'PT409';
    end if;
    insert into public.saves (user_id, slot, data, save_version, revision, meta)
    values (caller, p_slot, p_data, p_save_version, 1, coalesce(p_meta, '{}'::jsonb))
    returning * into result;
    return result;
  end if;

  -- Optimistic concurrency: a mismatch means another session wrote in between. See the note in the
  -- first migration on why this is PT409 and not 40001 — PostgREST retries 40001 and the client sees a
  -- 504 instead of a refusal.
  if p_revision is not null and p_revision <> current.revision then
    raise exception 'save conflict: expected revision %, client had %', current.revision, p_revision
      using errcode = 'PT409';
  end if;

  if p_save_version < current.save_version then
    raise exception 'save version regression: slot % is at %, client sent %',
      p_slot, current.save_version, p_save_version using errcode = 'PT409';
  end if;

  update public.saves
     set data         = p_data,
         save_version = p_save_version,
         meta         = coalesce(p_meta, '{}'::jsonb),
         revision     = current.revision + 1,
         updated_at   = now()
   where user_id = caller and slot = p_slot
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.save_game(smallint, jsonb, integer, bigint, jsonb) from public;
grant  execute on function public.save_game(smallint, jsonb, integer, bigint, jsonb) to authenticated;

-- ── Deleting a save ─────────────────────────────────────────────────────────
--
-- Needed because the client holds no DELETE privilege on `saves` and must not be given one: a policy
-- permissive enough to delete your own row is also the shape that gets copy-pasted into an UPDATE
-- policy later. Three slots means freeing one is a normal action, not an admin task, so it gets a
-- function of its own.
create function public.delete_save(p_slot smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = 'PT401';
  end if;
  if p_slot is null or p_slot < 1 or p_slot > 3 then
    raise exception 'slot must be 1, 2 or 3' using errcode = 'PT400';
  end if;
  delete from public.saves where user_id = caller and slot = p_slot;
end;
$$;

revoke execute on function public.delete_save(smallint) from public;
grant  execute on function public.delete_save(smallint) to authenticated;
