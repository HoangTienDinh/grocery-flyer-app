import React, { useEffect, useMemo, useRef, useState } from 'react'
import { addFiles, listMedia, type MediaItem } from '../utils/media'

/* ---------- build-time manifest of repo images in src/assets ---------- */
const ASSET_MANIFEST: Record<string, string> =
  import.meta.glob('../assets/*.{png,jpg,jpeg,webp,gif,svg}', { eager: true, as: 'url' }) as any

type MediaWithUrl = MediaItem & { url?: string }  // allow url on items from assets

// Breakpoint-based columns so the left pane gets 2 / 3 / 4 columns.
// Defaults tuned for 13" screens: 4 cols from ~760px+ container width.
function useBreakpointColumns(threeColMin = 560, fourColMin = 760) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [cols, setCols] = useState(2)
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = e.contentRect.width
        const next = w >= fourColMin ? 4 : w >= threeColMin ? 3 : 2
        setCols(next)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [threeColMin, fourColMin])
  return { ref, cols }
}

/* Use the url we attach on asset-backed items */
function thumbUrlFor(item: MediaWithUrl): string | undefined {
  return item.url
}

function PlaceholderThumb() {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        backgroundImage:
          'linear-gradient(45deg, #f2f2f2 25%, transparent 25%), linear-gradient(-45deg, #f2f2f2 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f2f2f2 75%), linear-gradient(-45deg, transparent 75%, #f2f2f2 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
      }}
    >
      <svg width="44" height="44" viewBox="0 0 24 24" role="img" aria-label="No preview">
        <path
          fill="#9CA3AF"
          d="M9.5 4h5l1 2H19a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h3.5l1-2Zm2.5 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
        />
      </svg>
    </div>
  )
}

export default function MediaPanel({ toast }: { toast: (m: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [q, setQ] = useState('')

  // Build “bundled assets” from the repo at build time
  const bundledAssets: MediaWithUrl[] = useMemo(() => {
    return Object.entries(ASSET_MANIFEST).map(([path, url]) => {
      const name = path.split('/').pop() || 'asset'
      return {
        id: `asset:${name}`,
        name,
        url,
      }
    })
  }, [])

  const load = () => listMedia().then(setItems)
  useEffect(() => { load() }, [])

  // Merge: repo assets first (read-only), then user uploads (editable)
  const library: MediaWithUrl[] = useMemo(
    () => [...bundledAssets, ...(items as MediaWithUrl[])],
    [bundledAssets, items]
  )

  const filtered = useMemo(
    () => library.filter(i => i.name.toLowerCase().includes(q.toLowerCase())),
    [library, q]
  )

  // 2–4 responsive columns tuned for your pane
  const { ref: gridRef, cols } = useBreakpointColumns(560, 760)

  // ---- Browse (PNG/JPG only) ----
  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    // Filter to .png/.jpg/.jpeg just in case (browser accept should already guard)
    const allowed = Array.from(files).filter(f =>
      /image\/png|image\/jpeg/i.test(f.type) || /\.(png|jpe?g)$/i.test(f.name)
    )
    if (allowed.length === 0) { toast('Only PNG or JPG are allowed'); return }
    await addFiles(allowed as unknown as FileList) // util supports FileList or array-like
    await load()
    toast(allowed.length === 1 ? 'Image uploaded' : `Uploaded ${allowed.length} images`)
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Toolbar — Browse + Search */}
      <div className="flex items-center gap-2">
        <label className="relative inline-flex">
          <input
            type="file"
            multiple
            // Strict to PNG/JPG
            accept="image/png,image/jpeg"
            onChange={(e) => onUpload(e.target.files)}
            className="hidden"
          />
          <span className="px-2.5 py-1 rounded bg-neutral-200 hover:bg-neutral-300 cursor-pointer text-xs sm:text-sm">
            Upload
          </span>
        </label>

        <input
          placeholder="Search…"
          className="ml-auto min-w-[180px] sm:min-w-[260px] flex-1 border rounded p-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search media"
        />
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {filtered.map((it) => {
          const thumb = thumbUrlFor(it)
          return (
            <article key={it.id} className="relative rounded border bg-white p-3">
              <div
                className="relative rounded border bg-neutral-100 overflow-hidden"
                style={{ aspectRatio: '4 / 3', minHeight: 120 }}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={it.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <PlaceholderThumb />
                )}
              </div>

              <div className="mt-2 text-sm truncate" title={it.name}>
                {it.name}
              </div>
            </article>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-sm text-neutral-500">No images yet.</div>
        )}
      </div>
    </div>
  )
}
