// Bundles client-side interactivity islands (hono/jsx/dom) into a single
// external script served from /static. Keeps reader pages SSR-first: the JS is
// a progressive-enhancement layer, only loaded on pages that opt in (frontend.md
// §5, PRD §55). Run via `bun run build:islands`.
const result = await Bun.build({
  entrypoints: ['src/client/islands.tsx'],
  outdir: 'public/static',
  minify: true,
  target: 'browser',
  sourcemap: 'none',
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

const bytes = result.outputs.reduce((n, o) => n + o.size, 0)
console.log(`islands: built ${result.outputs.length} file(s), ${(bytes / 1024).toFixed(1)} KiB`)
