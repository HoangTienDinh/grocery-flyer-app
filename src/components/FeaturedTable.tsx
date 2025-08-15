import React, { useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FeaturedItem } from '../utils/xlsx'
import { maskCurrencyFromDigits, normalizePrice } from '../utils/format'
import {
  listMedia,
  listBundledAssets,
  tokenFor,
  type MediaItem,
  resolveTokenToObjectUrl,
} from '../utils/media'

const SIZE_COL_W = 150
const PRICE_COL_W = 96
const INDEX_COL_W = 24
const DRAG_COL_W  = 24
const REMOVE_COL_W = 48

/** Resolve preview URL for anything:
 * - http(s) / drive: return as-is (or drive small thumb)
 * - media:// or asset:// → resolveTokenToObjectUrl
 */
function usePreviewUrl(source: string) {
  const [url, setUrl] = React.useState<string>('')

  React.useEffect(() => {
    let alive = true

    async function run() {
      if (!source) { setUrl(''); return }

      // Google Drive: use thumbnail if possible
      if (/drive\.google\.com|googleusercontent\.com/.test(source)) {
        const m = source.match(/(?:file\/d\/|id=)([^/&?]+)/)
        const id = m?.[1] || source
        if (alive) setUrl(`https://drive.google.com/thumbnail?id=${id}&sz=w120`)
        return
      }

      // http(s) image URL
      if (/^https?:\/\//i.test(source)) {
        if (alive) setUrl(source)
        return
      }

      // token (media:// or asset://)
      if (source.startsWith('media://') || source.startsWith('asset://')) {
        const u = await resolveTokenToObjectUrl(source)
        if (alive) setUrl(u || '')
        return
      }

      // fallback (treat as raw)
      if (alive) setUrl(source)
    }

    run()
    return () => { alive = false }
  }, [source])

  return url
}

/** Autocomplete that searches both uploaded media and bundled repo assets. */
function MediaAutocomplete({ value, onPick }: { value: string; onPick: (token: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<MediaItem[]>([])
  const [active, setActive] = useState<number>(-1)
  const wrapRef = React.useRef<HTMLDivElement | null>(null)
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  React.useEffect(() => {
    const load = async () => {
      const [uploaded, assets] = await Promise.all([
        listMedia(),
        Promise.resolve(listBundledAssets()),
      ])
      const combined = [...assets, ...uploaded].sort((a, b) => a.name.localeCompare(b.name))
      setItems(combined)
    }
    load()
  }, [])

  const filtered = React.useMemo(
    () => items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10),
    [items, q]
  )

  // small preview for current token/url value
  const preview = usePreviewUrl(value)

  // close on outside click
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // keep the highlighted item in view
  React.useEffect(() => {
    if (active < 0) return
    optionRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const selectIndex = (idx: number) => {
    const it = filtered[idx]
    if (!it) return
    onPick(tokenFor(it.id))
    setQ('')
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); return }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      setActive(filtered.length ? 0 : -1)
      e.preventDefault()
      return
    }
    if (!open) return

    if (e.key === 'ArrowDown') {
      setActive(prev => {
        const next = Math.min((prev < 0 ? -1 : prev) + 1, filtered.length - 1)
        return next
      })
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setActive(prev => Math.max((prev < 0 ? filtered.length : prev) - 1, 0))
      e.preventDefault()
    } else if (e.key === 'Home') {
      setActive(filtered.length ? 0 : -1)
      e.preventDefault()
    } else if (e.key === 'End') {
      setActive(filtered.length ? filtered.length - 1 : -1)
      e.preventDefault()
    } else if (e.key === 'Enter') {
      if (active >= 0) {
        selectIndex(active)
        e.preventDefault()
      }
    }
  }

  // reset highlight whenever list changes or menu opens
  React.useEffect(() => {
    if (!open) { setActive(-1); return }
    setActive(filtered.length ? 0 : -1)
  }, [open, q, filtered.length])

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="flex items-center gap-2">
        {preview && <img src={preview} alt="" className="w-6 h-6 object-contain rounded border" />}
        <input
          className="w-full border rounded p-1 truncate"
          placeholder="Image URL or type to search…"
          value={q || value}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          aria-expanded={open}
          aria-activedescendant={active >= 0 ? `media-opt-${active}` : undefined}
          aria-controls="media-listbox"
          role="combobox"
        />
      </div>

      {open && filtered.length > 0 && (
        <div
          id="media-listbox"
          role="listbox"
          className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-64 overflow-auto"
        >
          {filtered.map((it, idx) => {
            const token = tokenFor(it.id)
            const isActive = idx === active
            return (
              <button
                key={it.id}
                id={`media-opt-${idx}`}
                ref={el => (optionRefs.current[idx] = el)}
                role="option"
                aria-selected={isActive}
                type="button"
                className={`flex w-full items-center gap-2 px-2 py-1 text-left ${
                  isActive ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                }`}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => e.preventDefault()} // keep focus on input
                onClick={() => selectIndex(idx)}
                title={it.name}
              >
                <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] rounded border">
                  {it.id.startsWith('asset:') ? 'A' : 'U'}
                </span>
                <span className="truncate text-sm">{it.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RowItem({
  id, index, item, update, remove
}: {
  id: string; index: number; item: FeaturedItem; update: (k: keyof FeaturedItem, v: string) => void; remove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  // --- Validation ---
  const nameError = !item.name.trim()
  const priceVal = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0
  const priceError = priceVal < 0.01

  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'opacity-60' : ''}>
      <td className="px-2" style={{ width: DRAG_COL_W }}>
        <button {...attributes} {...listeners} className="cursor-grab text-neutral-400" title="Drag to reorder">⋮⋮</button>
      </td>

      <td className="px-2 text-neutral-500" style={{ width: INDEX_COL_W }}>{index + 1}</td>

      <td className="px-2 align-top">
        <div>
          <input
            className={`w-full border rounded p-1 truncate ${nameError ? 'border-red-500' : ''}`}
            value={item.name}
            onChange={e => update('name', e.target.value)}
            placeholder="Product name"
          />
          {nameError && <div className="text-xs text-red-600 mt-1">Product name is required</div>}
        </div>
      </td>

      <td className="px-2 align-top" style={{ width: SIZE_COL_W }}>
        <input
          className="border rounded p-1 truncate"
          style={{ width: SIZE_COL_W }}
          value={item.size}
          onChange={e => update('size', e.target.value)}
          placeholder="e.g., 750ml"
        />
      </td>

      <td className="px-2 align-top" style={{ width: PRICE_COL_W }}>
        <div>
          <input
            className={`border rounded p-1 truncate text-right tabular-nums ${priceError ? 'border-red-500' : ''}`}
            style={{ width: PRICE_COL_W }}
            value={item.price}
            onChange={e => update('price', maskCurrencyFromDigits(e.target.value))}
            onBlur={e => update('price', normalizePrice(e.target.value))}
            placeholder="$0.00"
          />
          {priceError && <div className="text-xs text-red-600 mt-1">Price must be at least $0.01</div>}
        </div>
      </td>

      {/* Image chooser (single preview is inside the component now) */}
      <td className="px-2 align-top">
        <MediaAutocomplete value={item.imageUrl} onPick={(token) => update('imageUrl', token)} />
      </td>

      <td className="px-2 text-center" style={{ width: REMOVE_COL_W }}>
        <button className="text-red-600" onClick={remove} aria-label={`Remove row ${index + 1}`}>✕</button>
      </td>
    </tr>
  )
}

export default function FeaturedTable({
  items, setItems, onFocusAny
}: {
  items: FeaturedItem[]
  setItems: React.Dispatch<React.SetStateAction<FeaturedItem[]>>
  onFocusAny?: () => void
}) {
  const sensors = useSensors(useSensor(PointerSensor))
  const onDragEnd = (e: any) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((_, i) => String(i) === active.id)
    const newIndex = items.findIndex((_, i) => String(i) === over.id)
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  const canAddMore = items.length < 9

  return (
    <div className="overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="px-2" style={{ width: DRAG_COL_W }}></th>
                <th className="px-2" style={{ width: INDEX_COL_W }}>#</th>
                <th className="text-left px-2">Product Name</th>
                <th className="text-left px-2" style={{ width: SIZE_COL_W }}>Size</th>
                <th className="text-left px-2" style={{ width: PRICE_COL_W }}>Price</th>
                <th className="text-left px-2">Image</th>
                <th className="px-2" style={{ width: REMOVE_COL_W }}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <RowItem
                  key={String(i)}
                  id={String(i)}
                  index={i}
                  item={it}
                  update={(k, v) => {
                    onFocusAny?.()
                    setItems(prev => { const copy = [...prev]; copy[i] = { ...copy[i], [k]: v }; return copy })
                  }}
                  remove={() => setItems(prev => { const copy = [...prev]; copy.splice(i, 1); return copy })}
                />
              ))}
              {canAddMore && (
                <tr>
                  <td colSpan={7} className="px-2 pt-1">
                    <button
                      className="text-sm px-3 py-1 rounded bg-neutral-200 hover:bg-neutral-300"
                      onClick={() => setItems(prev => [...prev, { name: '', size: '', price: '$0.00', imageUrl: '' }])}
                    >
                      + Add row
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  )
}
