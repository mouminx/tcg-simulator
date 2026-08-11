# Tests

21 suites, ~380 assertions, driven through a real browser with Playwright. `npm test` runs all of them.

These are **behavioural** suites, not unit tests: they boot the app, seed a save, click through it and measure
the DOM. That is deliberate — nearly every bug this project has had was a layout or wiring fault that a unit
test could not see. Several suites exist specifically to pin an invariant that has already regressed once.

## Running them

```bash
npm install          # playwright is a devDependency
npx playwright install chromium
npm test             # the whole thing, in the order below
node tests/test-treasure.mjs     # one suite, against an already-running dev server on :5199
```

`run-all.sh` manages the dev server itself. To run a single suite by hand, start one first:

```bash
npm run dev -- --port 5199 --strictPort
```

**Start it from the repo root.** `npx vite` from elsewhere resolves a different Vite install and serves the
wrong directory — the symptom is a blank page and a 404 on `/`, which reads like a code fault and is not one.

## Three sections, three environments

`run-all.sh` splits the run because the suites need different configurations, and getting this wrong is how
you seed a production database with junk players:

| Section | `.env.local` | Why |
|---|---|---|
| local-path | **removed** | online is unconfigured, so the app takes the offline path |
| online | rewritten to the **local** Supabase stack | these create accounts and write saves |
| desktop | n/a — builds in `ssf` mode | online is compiled out entirely |

The real `.env.local` is stashed and restored on exit, including on failure. **Never point the online suites
at the hosted project.** That was caught the honest way: after `.env.local` was switched to the hosted
project the suites started failing, because hosted auth rejects `@example.test` addresses — a failure rather
than a quiet success.

The online section needs a local stack:

```bash
supabase start       # Docker; first run pulls images
```

## Two harness bugs that are fixed, and worth not reintroducing

Both let a red run report itself green, which is worse than no test at all:

- **The summary regex matched a partial pass.** `grep -E "^[0-9]+/[0-9]+ passed"` matches `44/45 passed`.
  `run_suite` now compares the two numbers *and* the suite's exit code.
- **A failing suite was re-run to print its details.** For the online suites that means creating more
  accounts, takes minutes, and — since they are timing-sensitive — the second run can pass, so the evidence
  destroys itself. Output is captured once and the `FAIL` lines printed from it.

Also: every statement in the `restore` EXIT trap must be guarded so it cannot fail. `[ -f x ] && mv x y`
returns 1 once the file is gone, and under `set -e` that aborts the trap before its `return 0`, making the
whole script exit 1 with every suite green.

## The desktop suite needs its harness as SOURCE

`run-desktop-tests.mjs` launches `tests/desktop-harness.cjs` with Electron, which `require`s the **real**
`electron/main.cjs` against an isolated `userData` directory. It requires the real main process rather than
reimplementing it: the point is to exercise the shipped write path (atomic replace, `.bak` rotation, the sync
flush channel), and a reimplementation would only test itself.

That harness lives in `tests/` and is committed. It briefly pointed at `tests/.tmp/`, which is gitignored and
wiped — the symptom was an Electron dialog reading *"Unable to find Electron app at tests/.tmp/
desktop-harness.cjs"*. `.tmp/` is for artefacts the run produces, never for files it needs.

## Writing a suite

Follow the shape of an existing one. `enter.mjs` exports `enterGame(page)`, which gets past the title screen
and the slot picker. Conventions that matter:

- **Seed through `localStorage`, then reload.** Wait out `SAVE_DEBOUNCE_MS` (2s) *before* writing: the app
  flushes its own state on `pagehide`, so a seed written while the save is dirty is overwritten during the
  reload. That failure looks exactly like the feature ignoring your fixture.
- **Assert the thing that would actually break.** `getComputedStyle` returns a custom property as its literal
  token string, so a `calc()` variable reads as `NaN` — an early suite happily asserted three NaNs were
  "identical across displays". Resolve such a variable by sizing a hidden probe element with it.
- **Measure a state that exists.** A card size read from an empty slot is `null` on every viewport, and the
  comparison passes for the wrong reason.
- **Park the pointer before measuring positions.** Stacked rows lift on hover, which shows up as a second
  distinct `top`.
- **Click a stacked item at its visible strip** (`position: {x: 18, y: 60}`), not its centre — Playwright
  aims at the centre, which sits under the neighbouring item.
- **Close the Bag before reaching for anything on the right.** It is an overlay and it intercepts clicks.

## Don't `pkill -f` a pattern that matches your own command

`pkill -f "vite --port 5199"` matches the shell running it, so the command kills itself and exits 144
(128+SIGTERM). It looks exactly like the thing you were testing crashing. Cost three separate debugging
detours. Kill by pid, or narrow the pattern so it cannot match the invoking shell.

## Don't restart the dev server while a run is in flight

It kills the server out from under the suites, and the resulting `ERR_CONNECTION_REFUSED` /
`ERR_CONNECTION_RESET` failures look like real regressions. Cost two debugging cycles to recognise as
self-inflicted.
