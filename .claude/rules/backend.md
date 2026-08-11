---
paths:
  - "supabase/**"
  - "src/game/storage.js"
  - "src/game/account.js"
  - "src/game/slots.js"
  - "electron/**"
  - "src/components/LoginPage.jsx"
  - "src/components/SaveSlots.jsx"
  - "src/components/AccountMenu.jsx"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# Backend

Where the save lives, the three slots, accounts, and the RLS security model. Read this before touching anything under supabase/.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

## Where the save lives

`src/game/storage.js`. The `localStorage` calls used to be inlined in `App.jsx`, which is right for a
browser-only game and wrong for what this one is becoming: the desktop shell wants a real file, and the
online mode wants a server row. Both are read-a-blob / write-a-blob, so they sit behind one contract.

| Build | Adapter | Location |
|---|---|---|
| Web (Vercel), SSF slot | `localStorage` | `tcg-sim` (slot 1), `tcg-sim:slot:2`, `…:slot:3` |
| Desktop (Electron), SSF slot | `desktop-file` | `save-1.json` … `save-3.json` under `userData` |
| Online slot | `supabase` | `saves` row keyed `(user_id, slot)` |

**An adapter is built for a SLOT, not for a build.** `getLocalAdapter(2)` is slot 2 on this device;
`makeRemoteAdapter(client, 2)` is slot 2 on the account. `src/game/slots.js` owns which slot is which
mode; `storage.js` only knows how to read and write one. Slot 1 keeps the original `tcg-sim` key and
`save-1.json` inherits a pre-slots `save.json`, so nothing existing had to move.

`getStorage()` returns the *active* adapter — the one slot the session is playing, set by `setStorage()`
when a slot is opened. `getLocalAdapter(slot)` memoizes per slot, because the desktop adapter's one-time
localStorage import must not be able to run twice for the same slot. It probes for the *save bridge*, not
for `window.desktop`, so an older preload degrades to `localStorage` instead of throwing.

### The adapter moves raw strings, not parsed state

`read()` returns the serialized save verbatim; `write()` takes it the same way. Parsing, migrating and
defaulting stay in `parseSave`/`serializeSave` in `App.jsx`, which already own the shape.

This split is the whole point. An adapter dealing in parsed objects would have to understand the
schema, so every save-format change would touch all three adapters *and* the server. Opaque blobs mean
the remote adapter is a fetch call that never learns what a card is, and a migration stays one function
in one file.

### `read()` is async, which forced the boot gate

`localStorage` is synchronous; a file over IPC and a network round-trip are not.

`GameApp` reads its entire starting state from `savedState` in ~40 `useState` initializers that run
once, on first render — so the save must be in hand *before* it mounts. `App` is now a thin wrapper
that awaits the read in an effect and renders `<div className="app-booting" />` until it resolves.

**Making `GameApp` tolerate a null save is the wrong shape**, and was considered: it means
`useState(() => savedState?.balance ?? STARTING_BALANCE)` forty times over plus an effect to fill them
in later — forty chances to get a default wrong, every initializer describing two situations, and the
production ticker briefly running against a fresh save, creating then discarding real progress. Gating
the mount keeps the contract "`savedState` is always complete".

There is deliberately **no spinner**. A local read resolves in a few milliseconds, and an indicator
that appears and vanishes inside one frame reads as broken layout. `.app-booting` is `.app`'s darkest
gradient stop, the same value as the Electron window's `backgroundColor`, so window-open through to
title screen is one unbroken dark field.

### The desktop write path is in `electron/main.cjs`

Only the main process can touch the filesystem, and only it knows about the two files. The renderer
side is a channel with no filename, no directory, and no way to name what it reads or writes.

- **Atomic replace.** Write to `save.json.tmp` → **fsync** → move `save.json` to `save.json.bak` →
  rename the temp into place. `rename` within a directory is atomic, so the last step either happened
  or it did not. The narrow window between the last two steps leaves only `.bak`, which `readSave`
  recovers from.
- **The fsync is not optional.** `writeFileSync` returning only means the data reached the OS page
  cache. On power loss the rename can be durable while the contents are not, giving a `save.json` of
  zero bytes — the classic way this pattern still loses data.
- **`readSave` probes with `JSON.parse` but returns the raw string.** The probe is what lets a corrupt
  primary fall through to `.bak` rather than being handed to the renderer, where it would throw during
  boot and read as a wiped save. The *result* of the parse is discarded, because the shape is the
  game's business.
- **Two IPC channels, and the second one matters.** A routine autosave is `invoke`, fire-and-forget, so
  it stays off the game loop. The flush on `pagehide` uses **`sendSync`**, because the renderer is
  about to be destroyed and an async message posted then may never be delivered — that is up to
  `SAVE_DEBOUNCE_MS` (2s) of progress lost on every window close. Verified: a purchase made 200ms
  before close reaches disk, which only the sync path can explain.

### The first desktop read imports `localStorage`

The packaged shell used to persist there, so anyone who already played it has their whole collection in
the renderer's localStorage partition; switching to a file without adopting it looks exactly like a
wiped save. The adapter reads the file, and only if there is none falls back to importing localStorage
and writing it out.

**The localStorage copy is deliberately not deleted.** It costs a few hundred KB and it is the only
fallback if the file path ever fails on a machine we cannot debug. The import is still one-time, because
the file exists from then on and wins — verified with a stale localStorage copy left in place.

---

## Online mode and accounts

```text
supabase/migrations/*.sql      schema, RLS, save_game() — the security model
src/game/account.js            auth, player names, the remote save adapter
src/game/slots.js              the three slots and how local/online positions reconcile
src/components/LoginPage.jsx   sign in / create account / play offline
src/components/SaveSlots.jsx   the slot picker
src/components/AccountMenu.jsx in-game account + switch save (header)
.env.example                   the two env vars, and the one that must never exist
```

## Save slots

**Three positions (1–3), each holding at most one save, and each save is either SSF or online.** One
list, one badge per entry. The boot sequence is `login → slots → game`; the login page only appears when
online is configured and there is no session, so the desktop SSF build goes straight to the picker.

### Positions can collide, and the local save is the one that yields

The two stores are independent — local slots live on a device, online slots on the account. So a player
with an SSF save in position 2, who created an online save in position 2 on another machine, has two
saves claiming one position.

**The server's slot index wins and the local save is moved.** Local data is ours to reorganise, so
relocating it is invisible and lossless; a server slot index is shared across every device the player
signs in on, so moving *that* would make one save appear at different positions depending on where you
looked. `moveLocalSlot` copies then deletes — in that order, so a failure between the two leaves a
duplicate rather than nothing.

### Overflow is reported, never resolved by deleting

Three local saves plus one online save is four saves for three positions. It takes deliberate effort
across devices but it is reachable, and both alternatives are worse than admitting it: silently hiding a
save looks like data loss, and deleting one *is* data loss. `listSlots` returns the extras flagged
`overflow`, the picker says so, and creation is blocked until a position is freed. Nothing is destroyed
to make the list fit.

### `saves.meta` exists so the picker is cheap

The picker shows a balance and a card count for three saves. Reading `data` to get them would download
three entire saves — hundreds of KB — to draw a menu on every launch. `meta` is a small display
projection the client writes alongside, and the picker selects only that. **It is never authoritative**:
if `meta` and `data` disagree, `data` is the save.

### The in-game account menu

`AccountMenu.jsx`, in the header beside the audio mixer. Before it, the only way back to the picker was
reloading and sign-out existed solely on the picker, so a player already in a save had no way to change
their mind.

**Its panel is portaled to `document.body`, and that is mandatory** — the same trap the audio mixer hit.
`.header` is a stacking context at `z-index: 200` and `.nav-shell` sits above it at 201 so the tab runes
are not clipped; a z-index on a header *descendant* cannot escape its ancestor's context. The
outside-click handler therefore has to test the trigger **and** the portaled panel.

**Leaving a save awaits the flush.** `leaveSave` in `GameApp` awaits `flushSave()` before handing control
back, which is why `saveState` and `flushSave` now return the adapter's write result. The unmount cleanup
also flushes but cannot await, and on a cloud slot the write is an HTTP request — so an un-awaited flush
would race teardown and drop up to `SAVE_DEBOUNCE_MS` of play on every switch. A player choosing to leave
is the one moment we can afford to wait. Verified: a purchase 200ms before switching reaches the save.

**`App` clears `savedState` and the adapter when leaving.** `GameApp`'s ~40 `useState` initializers run
once, so handing a remount the previous save's object would silently resurrect it; and nothing should be
able to write to the slot just left.

**The title screen shows once per session, not per save.** It was unconditionally `true`, which was right
when entering the game happened once — now a switch would replay the title card immediately after the
player had been on the picker. `enteredBeforeRef` is set on the way **out**, in `handleSwitchSave`.
Setting it in `openSlot` looked equivalent and was not: it runs synchronously before React re-renders, so
the very first save would already read `true` and skip the splash it is supposed to show.

### "Online" is displayed as "Cloud", and multiplayer is barred

The mode id stays `online` — that is the slot which gains market access when the market opens, and an SSF
slot never will, which is the point of self-found. But the **badge says `Cloud`**, because there is no
multiplayer yet and a badge reading "Online" promises trading that is not there.

Multiplayer is barred by `COMING_SOON_VIEWS`, which already disables Market (with Lab and Expedition).
Nothing else needs gating: the online mode today *is* cloud saves, with no trading, listings or player
interaction of any kind. The plan is solo first, market later, so the copy in the login page and the
account menu says so explicitly rather than leaving a cloud save looking like a half-built lobby.

### Deleting needs an RPC

The client holds no DELETE privilege on `saves` — by design — so freeing an online slot goes through
`delete_save()`. Locally it removes the file *and its `.bak`*: leaving the backup would let the next read
resurrect the save the player just deleted.

Two modes, two saves, **deliberately separate**: SSF is local, online is the account row. The login page
says so before the player chooses, because silently starting an empty online account for someone with
hours of offline progress reads as a wipe.

## Player names

One **globally unique** name per account, chosen at sign-up, shown as the seller on marketplace
listings. Enforced by a **unique index on `lower(display_name)`**, not a unique constraint on the column:
a constraint would let `Mouminx` and `mouminx` coexist, which is not uniqueness in any sense a player
cares about — it is precisely how impersonation works, and on a listing the difference is invisible. A
CHECK also forbids consecutive whitespace, which is the same trick wearing a hat.

- The name is **required**, and the signup trigger raises if it is missing or the wrong length. It used to
  fall back to the email's local part; with the name now an identity rather than a label, that would hand
  someone a name they never chose and cannot change.
- `is_display_name_available()` is callable by `anon`, because the form needs it *before* an account
  exists. That makes it a boolean oracle for "does this name exist" — a deliberate trade, since names are
  shown to every signed-in player anyway, and the alternative is a form that can only report a collision
  after failing a submission. It returns a boolean and nothing else.
- The form's check is **debounced 450ms** with a request counter, so a slow reply for `Mou` cannot
  overwrite a fast one for `Mouminx` and lie about the name in the box. An `unknown` result (the check
  itself failed) is allowed through to submission — refusing a name because the network hiccuped is worse
  than letting the server give the real reason.
- A collision makes the trigger raise, which **rolls back the `auth.users` insert too**, so a failed
  sign-up leaves nothing behind and the email stays reusable. Verified.

### The whole point: RLS proves WHO you are, not that your data is legitimate

This is the mistake the schema is built to avoid, and it is worth stating because the wrong version
looks more secure than the right one.

The obvious design is a `saves` table with `USING (auth.uid() = user_id)` on UPDATE. That reads as
airtight and is not: it authenticates the *writer* and then accepts whatever JSON they send. The client
is JavaScript on the player's machine, so "the authenticated user sent it" says nothing about the
contents. A player opens devtools, writes `{"balance": 999999999}`, and RLS approves — the row genuinely
is theirs.

That is survivable in single-player. It is not survivable with a marketplace, because forged gold and
forged cards get **traded to other players** and the whole economy is downstream.

So:

| Table | What a signed-in client may do |
|---|---|
| `profiles` | `SELECT` any (a listing must name its seller), `UPDATE` own display name |
| `saves` | `SELECT` own rows. **Nothing else. No INSERT, UPDATE or DELETE.** |

**The absence of those policies IS the security model, not an oversight.** With RLS on and no permissive
policy for a command, that command is denied. Table-level `INSERT/UPDATE/DELETE` are also revoked from
`authenticated` and `anon` as a second layer. A future migration that *adds* a write policy to `saves`
is the thing to be suspicious of.

The only write path is `save_game(p_data, p_save_version, p_revision)`, a `SECURITY DEFINER` function.
It takes **no user id** — it reads `auth.uid()` itself, which is the entire difference between a save
endpoint and an "overwrite anybody's save" endpoint.

Today it validates identity, revision, version monotonicity, size and JSON shape — not full gameplay.
**Server-side simulation is the next phase**, and the reason to build the chokepoint first is that
validation then lands inside a function every client already calls, rather than needing a migration that
takes away a permission players have come to rely on.

### Four things in the SQL that are load-bearing

1. **`set search_path = ''` on every `SECURITY DEFINER` function, with all references schema-qualified.**
   Without it a caller can prepend a schema they control and have their own `profiles` table resolved
   instead — executing as the function's owner. This is the standard privilege-escalation route.
2. **`PT409`, not `40001`, for a conflict.** PostgREST treats `40001` (`serialization_failure`) as a
   *retryable* transaction conflict and reissues the request automatically, so raising it for a
   business-logic conflict does not return 409 — it retries a doomed write until the gateway gives up and
   the client sees **`504 upstream server is timing out`**. That is what happened, and it looked like a
   hang rather than a refusal. `PTxxx` is PostgREST's explicit "use this HTTP status" escape hatch.
3. **`save_version` must allow 0.** It is the "never saved" sentinel the signup trigger seeds. A floor of
   1 made the trigger's own insert fail its check constraint, which made **every registration fail**.
4. **The profile is created by a trigger on `auth.users`, not by the client.** The client has no INSERT
   rights (see above), and an interrupted client-side bootstrap would leave an account that can
   authenticate but has no profile. The trigger creates **no save row**: with slots, "which slots exist"
   is real information, so seeding three would make every slot look occupied and seeding one would
   privilege slot 1 for no reason. A slot row is created by the first `save_game` call for it, which is
   what "new game in an empty slot" means.

### Optimistic concurrency

`saves.revision` increments on every accepted write, and `save_game` refuses a write whose `p_revision`
does not match. Two signed-in sessions — a desktop app and a browser tab — would otherwise silently
overwrite each other last-write-wins, and the loser's session would vanish. On `PT409` the remote adapter
**logs and stops rather than retrying**: which state to keep is the player's decision, not something to
resolve by picking a winner.

### The remote adapter's two honest differences

It satisfies the same contract as the other two, except:

- **It parses.** The others move an opaque blob; this one must hand Postgres real `jsonb`, and must pull
  `version` out for `p_save_version` so the server can enforce monotonicity without understanding the
  save. That one field is the entire extent of its schema knowledge.
- **It cannot honour `sync`.** A file write can be made synchronous over IPC; an HTTP request cannot.
  `fetch(..., {keepalive: true})` is the tool for outliving a page but caps the body at **64 KB**, and a
  real save is larger. What actually protects progress is that the flush also runs on `visibilitychange`
  → hidden, while the page is still alive. Residual exposure is up to `SAVE_DEBOUNCE_MS` of play if the
  process is killed outright — which is what the revision check is for: the account stays coherent, it is
  just occasionally behind.

### A remote read failure must NOT fall back to a new game

Locally, "no save" and "unreadable save" both sensibly mean a fresh start. Online they do not: an
unreachable server would mount an empty game over an account that has progress, and **the first autosave
would overwrite it with nothing**. So `App`'s boot returns the player to the gate with the reason.
`read()` also throws rather than returning null when the row is missing entirely, since the trigger
guarantees it exists and its absence means something is wrong server-side.

### Configuration, and the key that must never appear

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. **Unset is a supported state** — no sign-in screen, no
account, SSF only, which is how a fresh clone runs with no Supabase project at all.

Vite inlines every `VITE_`-prefixed var into the client bundle, so both of those are **public by
construction** and cannot be hidden. That is fine; the security model is RLS plus `save_game()`, not key
secrecy. The **service-role key bypasses RLS entirely** and must never be in a `VITE_` var or in this
repo — in a client bundle it hands every player unrestricted access to every account.

`.env*` is gitignored except `.env.example`.

### Build modes, and which one ships

| Mode | Command | Online | Ships as |
|---|---|---|---|
| web | `npm run build` | from the environment | Vercel (dev/playtest channel) |
| `desktop` | `npm run build:desktop` | **yes** | **the Steam release** |
| `ssf` | `npm run build:ssf` | compiled out | not shipped; kept for a "cannot phone home" build |

**`desktop` used to be the offline build, and that inverted.** It was right while Steam was hypothetical
and the web build was the product; once Steam became the release, blanking the Supabase vars there meant
none of the online work shipped anywhere. SSF now lives as a **per-slot** choice (`SLOT_MODES`) rather
than a property of the binary, which is where it belongs — playing offline is a gameplay decision, not a
download decision. `electron/preload.cjs` no longer declares `mode: 'ssf'`; a build-level marker could
only contradict the slot it is describing.

`ssf` mode blanks both vars in `vite.config.js`, and that is required rather than tidy: **Vite loads
`.env.local` in every mode**, so without it an `ssf` build would silently pick up whatever project the
developer had configured. `.env.ssf.local` is not an alternative — it is gitignored and per-machine, so
the guarantee would hold only on the machine that had the file.

Two traps found while verifying this:

- **The `ssf` picker offered "Sign In For Online Saves"**, which is a dead end when online is compiled
  out: the login page renders with no possible way to succeed. `SaveSlots` now takes `onlineAvailable`.
- **Grepping the bundle for `supabase.co` reports a false leak.** That string lives inside the
  supabase-js chunk, which builds hostnames from it. Assert on a full project URL
  (`https://<ref>.supabase.co`) instead.

The supabase-js chunk is still *emitted* in `ssf` mode — Rollup cannot prove a runtime-guarded `import()`
is unreachable — but it is never fetched. ~215 KB in `dist/`, invisible beside Electron's ~200 MB.

### Tests must never point at the hosted project

The online suites create accounts and write saves. `.env.local` holds the **hosted** project, so the test
runner stashes it and writes a temporary one pointing at the local stack. This was caught the honest way:
after `.env.local` was switched to the hosted project, the suites started failing because hosted auth
rejects `@example.test` addresses — a failure, rather than quietly seeding production with junk players.

### The runner must assert a FULL pass, and must not re-run to get details

Two bugs in `run-all.sh` that between them hid a real failure, both now fixed in `run_suite`:

- It matched the summary line with `grep -E "^[0-9]+/[0-9]+ passed"`, which **matches `44/45 passed`** — so
  a partial pass read as success. That happened: `test-slots-ui` reported 44/45 and the run carried on
  calling itself green. The check now compares the two numbers *and* the suite's exit code.
- On failure it **re-ran the suite** to print details. For the online suites that means creating more
  accounts, takes minutes, and — since they are timing-sensitive — the second run can pass, so the evidence
  for the failure destroys itself. Output is captured once and the `FAIL` lines are printed from it.

`test-slots-ui` is mildly flaky against a freshly-started local stack (that 44/45, then 45/45 on three
consecutive re-runs). Worth knowing before treating one red run as a regression — but with the above fixed,
a red run is now at least *reported* as red.

### supabase-js is lazily imported

`import('@supabase/supabase-js')` inside `getClient()`, for the same reason `three` is lazy: a static
import anywhere puts ~215 KB in the main bundle and every offline player downloads it. Verified — the
main chunk contains no `GoTrueClient`, and grew ~8 KB for all of this.

### Working on it locally

```bash
supabase start                    # Docker; first run pulls images
supabase status                   # copy URL + anon key into .env.local
supabase db reset                 # re-apply migrations from scratch
supabase stop
```

`supabase/config.toml` and `supabase/migrations/` are tracked; the CLI's own `.gitignore` excludes its
temp state. Local email confirmation is off (`enable_confirmations = false`), so sign-up returns a
session immediately — a hosted project with confirmations on returns none, which `signUp` reports rather
than appearing to hang.

---
