import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single source of truth for the version the game displays. Read from package.json so the
// badge in the header cannot drift from the actual build.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/**
 * Three build modes:
 *
 *   (default)  the web build — Vercel. Online mode configured from the environment.
 *   desktop    the Electron build that SHIPS ON STEAM. Online-capable; SSF is a per-slot choice.
 *   ssf        an Electron build with online mode compiled out entirely. Not currently shipped.
 *
 * `desktop` used to be the offline-only build, which was right while Steam was hypothetical and the
 * web build was the product. It is now the reverse: Steam is the release, so the desktop build has to
 * reach the backend or none of the online work is shipping anywhere. SSF survives as a *mode inside the
 * app* — a slot is SSF or online — rather than as a property of the binary, which is where it belongs:
 * a player choosing to play offline is a gameplay decision, not a download decision.
 *
 * `ssf` is kept because "cannot phone home" is occasionally something a build needs to be able to claim
 * (a DRM-free store, a sandboxed environment). It is one flag rather than a branch to re-derive later.
 */
const DESKTOP_MODES = ['desktop', 'ssf']

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Relative asset paths for the Electron builds, absolute for the web.
  //
  // Vercel serves from a domain root, so `/assets/...` is correct there. The Electron shell serves
  // `dist/` over a custom `app://` protocol from a synthetic host, and while absolute paths happen to
  // resolve there too, relative ones are immune to whatever host or subpath the shell mounts at —
  // including a plain file:// fallback. Cheap insurance for a build that has no dev server to catch
  // the mistake.
  base: DESKTOP_MODES.includes(mode) ? './' : '/',
  plugins: [react()],
  server: {
    watch: {
      /**
       * Keep the watcher out of the desktop build's output directories.
       *
       * `release/` holds electron-builder's packaged app — including Electron's own bundled files —
       * so every `npm run dist:desktop` fired a burst of HMR reloads at any browser tab that
       * happened to be open, on files like `release/mac-arm64/LICENSES.chromium.html`. `build/`
       * holds the generated icon, which `npm run icons` rewrites.
       *
       * Vite merges this with its own defaults (`.git`, `node_modules`) and already ignores the
       * configured `outDir`, which is why `dist/` needs no entry here but these two do.
       */
      ignored: ['**/release/**', '**/build/**'],
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),

    /**
     * `ssf` mode compiles online mode out, and this is what makes that structural rather than
     * circumstantial.
     *
     * **Vite loads `.env.local` in every mode**, so without this an `ssf` build would pick up whatever
     * Supabase project the developer happened to have configured and quietly stop being offline. Relying
     * on `.env.ssf.local` to blank the vars instead does not work: it is gitignored and per-machine, so
     * the guarantee would hold only on the machine that happened to have the file.
     *
     * Hard-coding both to empty makes `isOnlineConfigured()` false by construction, so `getClient()`
     * returns null before it can reach the dynamic `import()` and no network client is ever instantiated.
     *
     * It does NOT remove the `@supabase/supabase-js` chunk: Rollup cannot prove a runtime-guarded
     * `import()` is unreachable, so ~215 KB of never-fetched JavaScript is still emitted. That costs
     * nothing at runtime and is invisible beside Electron's ~200 MB. Aliasing the package to a stub would
     * make it genuinely absent, and was avoided because a stub lets the app silently do the wrong thing
     * if the guard above is ever changed.
     *
     * **`desktop` is deliberately NOT in this list.** That build ships on Steam and has to reach the
     * backend; blanking it there was the old arrangement, from when the web build was the product.
     */
    ...(mode === 'ssf' ? {
      'import.meta.env.VITE_SUPABASE_URL': '""',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
    } : {}),
  },
  build: {
    // Vite inlines assets under 4 KB as base64 data URIs. That is right for the small
    // rarity-gem and tier-star SVGs, but wrong for audio: base64 inflates by ~33% and
    // moves the bytes into the JS bundle, which is parsed eagerly on load. Several encoded
    // SFX are 2-4 KB and were being swallowed that way. Audio should stay as separate
    // files so it is fetched on demand and cached independently.
    assetsInlineLimit(filePath) {
      if (/\.(webm|weba|mp3|ogg|wav|m4a|opus)$/i.test(filePath)) return false;
      return undefined; // everything else keeps Vite's default behaviour
    },
  },
}))
