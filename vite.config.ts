/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import { defineConfig, type Plugin } from 'vite'
import { lessonMeta, searchLesson } from './src/content/derive.ts'

/**
 * Derived lesson data (src/content/derive.ts): `<lesson>.json?lesson-meta` / `?lesson-search` import a small
 * build-time projection of a lesson JSON instead of the whole file, so step bodies and scenes stay in the
 * lazily loaded per-lesson chunks.
 */
function lessonData(): Plugin {
  const QUERY = /\.json\?lesson-(meta|search)$/
  const PREFIX = '\0lesson-'
  const derive = { meta: lessonMeta, search: searchLesson }
  return {
    name: 'lesson-data',
    enforce: 'pre',
    async resolveId(source, importer) {
      const m = QUERY.exec(source)
      if (!m) return null
      const file = await this.resolve(source.slice(0, -m[0].length + 5), importer, { skipSelf: true })
      // The ".js" suffix keeps Vite's JSON plugin off the virtual module.
      return file && `${PREFIX}${m[1]}:${file.id}.js`
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null
      const [kind, file] = [id.slice(PREFIX.length, id.indexOf(':')), id.slice(id.indexOf(':') + 1, -3)]
      this.addWatchFile(file)
      const lesson = JSON.parse(readFileSync(file, 'utf8'))
      return `export default ${JSON.stringify(derive[kind as keyof typeof derive](lesson))}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [lessonData(), react()],
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
