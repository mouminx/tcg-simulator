import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single source of truth for the version the game displays. Read from package.json so the
// badge in the header cannot drift from the actual build.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
})
