import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single source of truth for the version the game displays. Read from package.json so the
// badge in the header cannot drift from the actual build.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Relative asset paths for the desktop build, absolute for the web.
  //
  // Vercel serves from a domain root, so `/assets/...` is correct there. The Electron shell serves
  // `dist/` over a custom `app://` protocol from a synthetic host, and while absolute paths happen to
  // resolve there too, relative ones are immune to whatever host or subpath the shell mounts at —
  // including a plain file:// fallback. Cheap insurance for a build that has no dev server to catch
  // the mistake.
  base: mode === 'desktop' ? './' : '/',
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
