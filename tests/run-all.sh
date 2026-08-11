#!/bin/zsh
# Full regression run.
#
# ── The env file is managed per section, and this is not cosmetic ──
# `.env.local` holds the HOSTED project, because that is what gets built and deployed. The test suites
# must never point there: the online suites create accounts and write saves, and doing that in production
# would seed it with junk players. It was caught the honest way — the hosted auth rejected the suites'
# `@example.test` addresses, so the run failed instead of quietly succeeding.
#
# Each section therefore gets the env it needs:
#   local-path suites → NO .env.local (online not configured)
#   online suites     → a temporary .env.local pointing at the LOCAL supabase stack
#   desktop suite     → builds in `ssf` mode, which compiles online out entirely
# The real file is restored on exit, including on failure.
set -e
# Derived from this script's own location — these were absolute paths into a machine-specific scratchpad,
# which is precisely why the suites could not live in the repo.
S="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT="$(cd "$S/.." && pwd)"
cd "$ROOT"

# NOTE: every statement here must be guarded so it CANNOT fail.
# This runs as the EXIT trap, and it used to read
#   [ -f "$ROOT/.env.local.real" ] && mv -f ...
# which returns 1 once the file has already been restored — and under `set -e` that aborts the function
# before its `return 0`, making the whole script exit 1 with every suite green. That false red was showing
# up on every run. `pkill` has the same shape: it returns 1 when nothing matches.
restore() {
  if [ -f "$ROOT/.env.local.real" ]; then
    mv -f "$ROOT/.env.local.real" "$ROOT/.env.local" || true
  fi
  pkill -f "vite --port 5199" 2>/dev/null || true
  return 0
}
trap restore EXIT

[ -f "$ROOT/.env.local" ] && cp "$ROOT/.env.local" "$ROOT/.env.local.real"

start_vite() {
  pkill -f "vite --port 5199" 2>/dev/null || true
  sleep 2
  nohup npx vite --port 5199 --strictPort > "$S/vite.log" 2>&1 &
  # Waits for readiness rather than guessing. A fixed sleep is what made a whole suite fail with
  # "waiting until networkidle" once the machine happened to be busier.
  for i in $(seq 1 40); do
    curl -sf -o /dev/null http://localhost:5199/ && return 0
    sleep 0.5
  done
  echo "vite did not come up"; tail -5 "$S/vite.log"; exit 1
}


# ── Running one suite ──
# Captures the output ONCE and asserts a FULL pass. Two bugs this replaces, both of which hid a real
# failure:
#   * `grep -E "^[0-9]+/[0-9]+ passed"` matches "44/45 passed", so a partial pass read as success. That
#     happened — test-slots-ui reported 44/45 and the run carried on reporting it as green.
#   * on failure it RE-RAN the suite to print details. For the online suites that means creating more
#     accounts, takes minutes, and — since these are timing-sensitive — the second run can pass, so the
#     evidence for the failure destroys itself.
run_suite() {
  local name="$1" file="$2" out rc line got want
  printf "%-24s " "$name"
  out=$(node "$S/$file" 2>&1); rc=$?
  line=$(printf '%s\n' "$out" | grep -E "^[0-9]+/[0-9]+ passed$" | tail -1)
  if [ -z "$line" ]; then
    echo "FAILED (no summary line, exit $rc)"
    printf '%s\n' "$out" | tail -14
    return 1
  fi
  got=${line%%/*}; want=${line#*/}; want=${want%% *}
  echo "$line"
  if [ "$got" != "$want" ] || [ "$rc" -ne 0 ]; then
    echo "  ^ NOT a full pass (exit $rc). Failing checks:"
    printf '%s\n' "$out" | grep -E "^FAIL|^  - " | head -12
    return 1
  fi
  return 0
}

echo "############ LOCAL-PATH SUITES (online NOT configured) ############"
rm -f "$ROOT/.env.local"
start_vite
for t in test-storage-web test-migration test-gold-seam test-drag-identity test-write-failure test-account-menu test-arc-and-collection test-echo-scope test-shop-rotation test-goods test-forge-selector test-processing-selector test-output-collection test-staged-loot test-merge test-upgrades test-shop-summon test-stacked-rows test-treasure; do
  run_suite "$t" "$t.mjs" || exit 1
done

echo
echo "############ ONLINE SUITES (pointed at the LOCAL stack, never the hosted project) ############"
supabase status >/dev/null 2>&1 || { echo "local supabase is not running — run 'supabase start'"; exit 1; }
API=$(supabase status -o env | grep '^API_URL=' | cut -d= -f2- | tr -d '"')
KEY=$(supabase status -o env | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '"')
printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\n' "$API" "$KEY" > "$ROOT/.env.local"
echo "  (targeting $API)"
start_vite
run_suite "test-slots-rls" "test-slots-rls.mjs" || exit 1
run_suite "test-slots-ui" "test-slots-ui.mjs" || exit 1

echo
echo "############ DESKTOP SUITE (packaged ssf build) ############"
run_suite "run-desktop-tests" "run-desktop-tests.mjs" || exit 1

echo
echo "############ BUILD MODES ############"
# The Steam build must reach the backend; the ssf build must not. Asserted on the emitted bundle, since
# this is the property that silently regressed once already.
#
# The pattern matches a FULL project URL, not the bare domain. `.supabase.co` appears inside the
# supabase-js chunk itself (the library builds hostnames from it), so grepping for the domain reported a
# leak in the ssf build that was not one — the configured URL was genuinely absent.
URLPAT='https://[a-z0-9]\{8,\}\.supabase\.co\|http://127\.0\.0\.1:54321'
restore                                     # build against the real hosted env, as a release would
printf "%-24s " "desktop reaches backend"
npm run build:desktop >/dev/null 2>&1
grep -rlq "$URLPAT" dist/assets/*.js 2>/dev/null \
  && echo "ok" || { echo "FAILED — no backend URL in the Steam build"; exit 1; }
printf "%-24s " "ssf has online removed"
npm run build:ssf >/dev/null 2>&1
grep -rlq "$URLPAT" dist/assets/*.js 2>/dev/null \
  && { echo "FAILED — ssf build leaked a configured backend URL"; exit 1; } || echo "ok"
npm run build:desktop >/dev/null 2>&1        # leave dist/ in the shipping configuration
