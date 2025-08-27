import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  addFiles,
  listMedia,
  type MediaItem,
  resolveTokenToObjectUrl,
  renameMedia,
  removeMedia,
} from '../utils/media'

/* ---------- build-time manifest of repo images in src/assets ---------- */
const ASSET_MANIFEST: Record<string, string> =
  import.meta.glob('../assets/*.{png,jpg,jpeg,webp,gif,svg}', { eager: true, as: 'url' }) as any

type MediaWithUrl = MediaItem & { url?: string }  // allow url on items from assets

/* ======================= Small helpers ======================= */

// Assets are view-only; anything else is an upload (supports media:, media://, bare UUIDs)
const isAsset  = (id?: string) => !!id && (id.startsWith('asset:') || id.startsWith('asset://'))
const isUpload = (id?: string) => !!id && !isAsset(id)

/* Breakpoint-based columns so the left pane gets 2 / 3 / 4 columns. */
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

/* ---------- ID → token helper: handles several shapes safely ---------- */
function idToToken(id: string | undefined): string {
  if (!id) return ''
  if (id.startsWith('asset://') || id.startsWith('media://')) return id
  if (id.startsWith('asset:')) return `asset://${id.slice('asset:'.length)}`
  if (id.startsWith('media:')) return `media://${id.slice('media:'.length)}`
  if (/^[0-9a-f-]{32,36}$/i.test(id)) return `media://${id}`
  return ''
}

/* ---------- Resolve a preview URL for any item ---------- */
function useThumbUrl(item: MediaWithUrl) {
  const [url, setUrl] = useState<string | undefined>(item.url)

  useEffect(() => {
    let alive = true
    let toRevoke: string | null = null

    async function run() {
      if (item.url) { setUrl(item.url); return }

      if (item.id?.startsWith('asset:')) {
        const name = item.id.slice('asset:'.length)
        const path = Object.keys(ASSET_MANIFEST).find(p => p.endsWith('/' + name))
        if (path) { setUrl((ASSET_MANIFEST as any)[path]); return }
      }

      const token = idToToken(item.id)
      if (token) {
        const u = await resolveTokenToObjectUrl(token)
        if (!alive) return
        setUrl(u || undefined)
        if (u && u.startsWith('blob:')) toRevoke = u
      } else {
        setUrl(undefined)
      }
    }

    run()
    return () => {
      alive = false
      if (toRevoke) URL.revokeObjectURL(toRevoke)
    }
  }, [item.id, item.url])

  return url
}

/* ======================= Modals ======================= */

function ConfirmModal({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  onConfirm, onCancel, busy = false,
}: {
  open: boolean
  title: string
  message: React.ReactNode   // allow rich content (bold filename)
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onCancel} />
      <div className="relative z-10 w-[min(92vw,520px)] rounded-lg border bg-white p-4 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-neutral-700">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded border hover:bg-neutral-50 disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function RenameModal({
  open, initial, onSubmit, onCancel, busy = false,
}: {
  open: boolean
  initial: string
  onSubmit: (next: string) => void
  onCancel: () => void
  busy?: boolean
}) {
  const [val, setVal] = useState(initial)
  const inputRef = React.useRef<HTMLInputElement>(null)

  useEffect(()=>{ 
    if (open) {
      setVal(initial)
      // Focus + select all so typing replaces the name immediately
      setTimeout(() => {
        if (!busy) {
          inputRef.current?.focus()
          inputRef.current?.select()
        }
      }, 0)
    }
  }, [open, initial, busy])

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onCancel} />
      <div className="relative z-10 w-[min(92vw,520px)] rounded-lg border bg-white p-4 shadow-xl">
        <h3 className="text-lg font-semibold">Rename image</h3>
        <input
          ref={inputRef}
          className="mt-3 w-full rounded border p-2"
          value={val}
          onChange={(e)=> setVal(e.target.value)}
          onKeyDown={(e)=> { if (e.key === 'Enter' && !busy) onSubmit(val.trim()) }}
          disabled={busy}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded border hover:bg-neutral-50 disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={()=> onSubmit(val.trim())}
            disabled={busy}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  ) : null
}

/* ======================= Cards ======================= */

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

function MediaCard({
  item,
  selected,
  onToggle,
  onRename,
  onDelete,
  actionsDisabled,       // disables Rename/Delete
  checkboxDisabled,      // disables the selection checkbox
}: {
  item: MediaWithUrl
  selected: boolean
  onToggle: (id: string, next: boolean) => void
  onRename: (id: string, currentName: string) => void
  onDelete: (id: string, name: string) => void
  actionsDisabled: boolean
  checkboxDisabled: boolean
}) {
  const thumb = useThumbUrl(item)
  const asset = isAsset(item.id)
  return (
    <article className="relative rounded border bg-white p-3 w-full box-border">
      {/* Checkbox for uploads only */}
      {!asset && (
        <label className="absolute left-2 top-2 z-10 flex items-center gap-1 bg-white/90 rounded px-1.5 py-0.5 border">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e)=> onToggle(item.id!, e.target.checked)}
            aria-label={`Select ${item.name}`}
            disabled={checkboxDisabled}
          />
        </label>
      )}

      <div
        className="relative rounded border bg-neutral-100 overflow-hidden"
        style={{ aspectRatio: '4 / 3', minHeight: 120, width: '100%' }}
      >
        {thumb ? (
          <img src={thumb} alt={item.name} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <PlaceholderThumb />
        )}
      </div>

      <div className="mt-2 text-sm truncate" title={item.name}>
        {item.name}
      </div>

      {/* Per-item actions (uploads only) */}
      {!asset && (
        <div className="mt-2 flex gap-2">
          <button
            className="px-2 py-1 text-xs rounded border hover:bg-neutral-50 disabled:opacity-50"
            onClick={()=> onRename(item.id!, item.name)}
            disabled={actionsDisabled}
          >
            Rename
          </button>
          <button
            className="px-2 py-1 text-xs rounded border text-red-700 hover:bg-red-50 disabled:opacity-50"
            onClick={()=> onDelete(item.id!, item.name)}
            disabled={actionsDisabled}
          >
            Delete
          </button>
        </div>
      )}
    </article>
  )
}

/* ======================= Panel ======================= */

export default function MediaPanel({ toast }: { toast: (m: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Modal + busy state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [busyDelete, setBusyDelete] = useState(false)
  const [busyRename, setBusyRename] = useState(false)

  const load = () => listMedia().then(setItems)
  useEffect(() => { load() }, [])

  // Build bundled assets (with URLs) at build time
  const bundledAssets: MediaWithUrl[] = useMemo(() => {
    return Object.entries(ASSET_MANIFEST).map(([path, url]) => {
      const name = path.split('/').pop() || 'asset'
      return { id: `asset:${name}`, name, url }
    })
  }, [])

  // Merge: assets first, then user uploads
  const library: MediaWithUrl[] = useMemo(
    () => [...bundledAssets, ...(items as MediaWithUrl[])],
    [bundledAssets, items]
  )

  // Search filter (view only)
  const filtered = useMemo(
    () => library.filter(i => i.name.toLowerCase().includes(q.toLowerCase())),
    [library, q]
  )

  // All uploads (source of truth for selection counting)
  const allUploads = useMemo(
    () => (items as MediaWithUrl[]).filter(i => isUpload(i.id)),
    [items]
  )

  const selectedIds = useMemo(() => [...selected], [selected])
  const selectedUploads = useMemo(
    () => selectedIds.map(id => allUploads.find(u => u.id === id)).filter(Boolean) as MediaWithUrl[],
    [selectedIds, allUploads]
  )
  const selectedCount = selectedUploads.length
  const singleName = selectedCount === 1 ? selectedUploads[0].name : ''
  const deleteDisabled = selectedCount === 0

  const { ref: gridRef, cols } = useBreakpointColumns(560, 760)

  // ---- Upload ----
  const clearSelection = () => setSelected(new Set())

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const allowed = Array.from(files).filter(f =>
      /image\/png|image\/jpeg/i.test(f.type) || /\.(png|jpe?g)$/i.test(f.name)
    )
    if (allowed.length === 0) { toast('Only PNG or JPG are allowed'); return }
    await addFiles(allowed as unknown as FileList)
    await load()
    clearSelection() // UX: clear after upload
    toast(allowed.length === 1 ? 'Image uploaded' : `Uploaded ${allowed.length} images`)
  }

  // ---- Selection helpers ----
  const toggleOne = (id: string, next: boolean) => {
    setSelected(prev => {
      const copy = new Set(prev)
      if (next) copy.add(id); else copy.delete(id)
      return copy
    })
  }

  // ---- Delete Selected ----
  const onDeleteSelected = async () => {
    setBusyDelete(true)
    try {
      const ids = [...selected]
      if (ids.length === 0) return
      for (const id of ids) {
        try { await removeMedia(id) } catch { /* ignore per-item errors */ }
      }
      await load()
      toast(ids.length === 1 ? 'Deleted 1 image' : `Deleted ${ids.length} images`)
    } finally {
      setBusyDelete(false)
      setConfirmOpen(false)
      clearSelection() // UX: clear selection after delete
    }
  }

  // ---- Per-item Delete / Rename ----
  const askDeleteOne = (id: string, name: string) => {
    setSelected(new Set([id])) // keeps modal in "single" mode
    setConfirmOpen(true)
  }

  const askRename = (id: string, name: string) => {
    setRenameTarget({ id, name })
    setRenameOpen(true)
  }

  const doRename = async (next: string) => {
    if (!renameTarget) { setRenameOpen(false); return }
    const trimmed = next.trim()
    if (!trimmed || trimmed === renameTarget.name) {
      setRenameOpen(false); setRenameTarget(null)
      return
    }
    setBusyRename(true)
    try {
      await renameMedia(renameTarget.id, trimmed)
      await load()
      toast('Renamed')
      clearSelection() // UX: clear after rename
    } catch (e) {
      toast('Rename failed')
    } finally {
      setBusyRename(false)
      setRenameOpen(false)
      setRenameTarget(null)
    }
  }

  // Disable per-item actions when any modal/busy OR when multiple items selected
  const anyModalOpen = confirmOpen || renameOpen
  const actionsDisabled = anyModalOpen || busyDelete || busyRename || selectedCount > 1
  // Checkboxes should only be disabled by modal/busy (not by multi-select)
  const checkboxDisabled = anyModalOpen || busyDelete || busyRename

  return (
    <div className="p-3 flex flex-col gap-3 min-w-0 overflow-x-hidden">
      {/* Toolbar — Upload + Delete Selected + Unselect All + Search */}
      <div className="flex items-center gap-2">
        <label className="relative inline-flex">
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg"
            onChange={(e) => onUpload(e.target.files)}
            className="hidden"
            disabled={anyModalOpen || busyDelete || busyRename}
          />
          <span className={[
            "px-2.5 py-1 rounded cursor-pointer text-xs sm:text-sm",
            anyModalOpen || busyDelete || busyRename
              ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
              : "bg-neutral-200 hover:bg-neutral-300"
          ].join(' ')}>
            Upload
          </span>
        </label>

        <button
          type="button"
          className={[
            "px-2.5 py-1 rounded text-xs sm:text-sm border",
            deleteDisabled
              ? "text-neutral-400 bg-neutral-100 cursor-not-allowed"
              : "text-red-700 bg-white hover:bg-red-50 border-red-300"
          ].join(" ")}
          disabled={deleteDisabled || anyModalOpen || busyDelete || busyRename}
          onClick={()=> setConfirmOpen(true)}
          title={deleteDisabled ? "Select images to delete" : "Delete selected images"}
        >
          Delete Selected Images
        </button>

        <button
          type="button"
          className={[
            "px-2.5 py-1 rounded text-xs sm:text-sm border",
            deleteDisabled
              ? "text-neutral-400 bg-neutral-100 cursor-not-allowed"
              : "text-neutral-700 bg-white hover:bg-neutral-50"
          ].join(" ")}
          disabled={deleteDisabled || anyModalOpen || busyDelete || busyRename}
          onClick={clearSelection}
          title={deleteDisabled ? "No images selected" : "Unselect all selected images"}
        >
          Unselect All
        </button>

        <input
          placeholder="Search…"
          className="ml-auto min-w-[180px] sm:min-w-[260px] flex-1 border rounded p-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search media"
          disabled={anyModalOpen || busyDelete || busyRename}
        />
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className="grid gap-3 min-w-0"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {filtered.map((it) => (
          <MediaCard
            key={it.id}
            item={it}
            selected={selected.has(it.id!)}
            onToggle={toggleOne}
            onRename={askRename}
            onDelete={askDeleteOne}
            actionsDisabled={actionsDisabled}
            checkboxDisabled={checkboxDisabled}
          />
        ))}

        {filtered.length === 0 && (
          <div className="text-sm text-neutral-500">No images yet.</div>
        )}
      </div>

      {/* Confirm delete modal */}
      <ConfirmModal
        open={confirmOpen}
        title={selectedCount === 1 ? "Delete image?" : "Delete images?"}
        message={
          selectedCount === 1
            ? <>You are about to delete <strong>{singleName}</strong>. This cannot be undone.</>
            : <>You are about to delete <strong>{selectedCount}</strong> images. This cannot be undone.</>
        }
        confirmLabel={selectedCount === 1 ? "Delete" : `Delete ${selectedCount} images`}
        onConfirm={onDeleteSelected}
        onCancel={()=> setConfirmOpen(false)}
        busy={busyDelete}
      />

      {/* Rename modal */}
      <RenameModal
        open={renameOpen}
        initial={renameTarget?.name || ''}
        onSubmit={doRename}
        onCancel={()=> { if (!busyRename) { setRenameOpen(false); setRenameTarget(null) } }}
        busy={busyRename}
      />
    </div>
  )
}
