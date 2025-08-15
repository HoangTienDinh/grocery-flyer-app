import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  addFiles, listMedia, removeMedia, renameMedia,
  exportZip, importZip, tokenFor, type MediaItem
} from '../utils/media'
import { saveAs } from 'file-saver'

/* ---------- NEW: build-time manifest of repo images in src/assets ---------- */
const ASSET_MANIFEST: Record<string, string> =
  import.meta.glob('../assets/*.{png,jpg,jpeg,webp,gif,svg}', { eager: true, as: 'url' }) as any

type MediaWithUrl = MediaItem & { url?: string }  // allow url on items from assets

function useResizeColumns(maxCols = 3, cardMinWidth = 220) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [cols, setCols] = useState(3)
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = e.contentRect.width
        const computed = Math.max(1, Math.min(maxCols, Math.floor(w / cardMinWidth)))
        setCols(computed)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxCols, cardMinWidth])
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
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Build “bundled assets” from the repo at build time
  const bundledAssets: MediaWithUrl[] = useMemo(() => {
    return Object.entries(ASSET_MANIFEST).map(([path, url]) => {
      const name = path.split('/').pop() || 'asset'
      return {
        id: `asset:${name}`,      // distinguish from IndexedDB ids
        name,
        url,                      // used for thumbnails + resolve
      }
    })
  }, [])

  const load = () => listMedia().then(setItems)   // IndexedDB / uploaded items
  useEffect(() => { load() }, [])

  // Merge: repo assets first (read-only), then user uploads (editable)
  const library: MediaWithUrl[] = useMemo(
    () => [...bundledAssets, ...items as MediaWithUrl[]],
    [bundledAssets, items]
  )

  const filtered = useMemo(
    () => library.filter(i => i.name.toLowerCase().includes(q.toLowerCase())),
    [library, q]
  )

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    await addFiles(files)
    await load()
    toast(files.length === 1 ? 'Image uploaded' : `Uploaded ${files.length} images`)
  }

  const onExportAll = async () => {
    const blob = await exportZip()
    saveAs(blob, 'media-library.zip')
    toast('Exported media.zip')
  }

  const onExportSelected = async () => {
    if (selected.size === 0) { toast('No items selected'); return }
    try {
      // @ts-ignore your export may or may not support a subset
      const blob = await exportZip(Array.from(selected))
      saveAs(blob, 'media-selected.zip')
      toast('Exported selected')
    } catch {
      const blob = await exportZip()
      saveAs(blob, 'media-library.zip')
      toast('Exported all (selected-only not supported)')
    }
  }

  const onImport = async (f: File | null) => {
    if (!f) return
    const count = await importZip(f)
    await load()
    toast(`Imported ${count} images`)
  }

  const onDelete = async (id: string) => {
    // ignore deletes for bundled assets
    if (id.startsWith('asset:')) { toast('Bundled assets cannot be deleted'); return }
    await removeMedia(id)
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    await load()
    toast('Image deleted')
  }

  const onDeleteSelected = async () => {
    const onlyUserIds = Array.from(selected).filter(id => !id.startsWith('asset:'))
    if (onlyUserIds.length === 0) { toast('No deletable items selected'); return }
    if (!confirm(`Delete ${onlyUserIds.length} selected item(s)?`)) return
    for (const id of onlyUserIds) {
      // eslint-disable-next-line no-await-in-loop
      await removeMedia(id)
    }
    setSelected(new Set())
    await load()
    toast('Deleted selected')
  }

  // responsive grid (max 3 columns)
  const { ref: gridRef, cols } = useResizeColumns(3, 260)

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative inline-flex">
            <input type="file" multiple accept="image/*"
              onChange={(e) => onUpload(e.target.files)} className="hidden" />
            <span className="px-2.5 py-1 rounded bg-neutral-200 hover:bg-neutral-300 cursor-pointer text-xs sm:text-sm">
              Browse…
            </span>
          </label>

          <button className="hidden min-[520px]:inline-block px-2.5 py-1 rounded bg-neutral-200 hover:bg-neutral-300 text-xs sm:text-sm"
            onClick={onExportAll}>Export</button>

          <label className="hidden min-[520px]:inline-block px-2.5 py-1 rounded bg-neutral-200 hover:bg-neutral-300 cursor-pointer text-xs sm:text-sm">
            Import
            <input type="file" accept=".zip" className="hidden"
              onChange={(e) => onImport(e.target.files?.[0] || null)} />
          </label>

          <details className="min-[520px]:hidden">
            <summary className="px-2.5 py-1 rounded bg-neutral-200 hover:bg-neutral-300 cursor-pointer text-xs sm:text-sm select-none">
              More
            </summary>
            <div className="mt-1 flex flex-col rounded border bg-white shadow">
              <button className="px-3 py-1 text-left hover:bg-neutral-50" onClick={onExportAll}>Export</button>
              <label className="px-3 py-1 text-left hover:bg-neutral-50 cursor-pointer">
                Import
                <input type="file" accept=".zip" className="hidden"
                  onChange={(e) => onImport(e.target.files?.[0] || null)} />
              </label>
            </div>
          </details>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-neutral-600">{selected.size} selected</span>
            <button className="px-2.5 py-1 rounded bg-neutral-200 hover:bg-neutral-300 text-xs sm:text-sm"
              onClick={onExportSelected}>Export selected</button>
            <button className="px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 text-xs sm:text-sm"
              onClick={onDeleteSelected}>Delete selected</button>
          </div>
        )}

        <input placeholder="Search…" className="ml-auto min-w-[180px] sm:min-w-[260px] flex-1 border rounded p-1"
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
      </div>

      {/* Grid */}
      <div ref={gridRef} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {filtered.map((it) => {
          const checked = selected.has(it.id)
          const toggle = () =>
            setSelected(prev => {
              const s = new Set(prev)
              s.has(it.id) ? s.delete(it.id) : s.add(it.id)
              return s
            })
          const thumb = thumbUrlFor(it)

          // token: DB items use tokenFor(id); assets use asset://filename
          const token = it.id.startsWith('asset:')
            ? `asset://${it.id.slice(6)}`
            : tokenFor(it.id)

          return (
            <article key={it.id} className="relative rounded border bg-white p-3" tabIndex={-1}>
              <div className="relative rounded border bg-neutral-100 overflow-hidden" style={{ aspectRatio: '4 / 3', minHeight: 120 }}>
                <label className="absolute left-2 top-2 z-10 bg-white/90 rounded px-1">
                  <input type="checkbox" checked={checked} onChange={toggle} aria-label={`Select ${it.name}`} />
                </label>
                {thumb ? (
                  <img src={thumb} alt={it.name} className="w-full h-full object-contain" loading="lazy" />
                ) : (
                  <PlaceholderThumb />
                )}
              </div>

              <div className="mt-2 text-sm truncate" title={it.name}>{it.name}</div>

              <div className="mt-2 flex flex-wrap gap-1">
                <button className="px-2 py-1 text-xs rounded border hover:bg-neutral-50"
                        onClick={() => { navigator.clipboard.writeText(token); toast('Copied token') }}>
                  Copy token
                </button>

                {/* Disable rename/delete for bundled assets */}
                <button className={`px-2 py-1 text-xs rounded border hover:bg-neutral-50 ${it.id.startsWith('asset:') ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={it.id.startsWith('asset:')}
                        onClick={async () => { const name = prompt('New name?', it.name); if (!name || name===it.name) return; await renameMedia(it.id, name); await load(); toast('Renamed') }}>
                  Rename
                </button>
                <button className={`px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 ${it.id.startsWith('asset:') ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={it.id.startsWith('asset:')}
                        onClick={() => onDelete(it.id)}>
                  Delete
                </button>
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
