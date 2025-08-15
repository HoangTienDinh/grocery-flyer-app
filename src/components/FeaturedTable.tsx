import React, { useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FeaturedItem } from '../utils/xlsx'
import { maskCurrencyFromDigits, normalizePrice } from '../utils/format'
import { listMedia, tokenFor, MediaItem } from '../utils/media'

const SIZE_COL_W = 150
const PRICE_COL_W = 96
const INDEX_COL_W = 24
const DRAG_COL_W  = 24
const REMOVE_COL_W = 48

function useThumb(url: string) {
  const isDrive = /drive\.google\.com|googleusercontent\.com/.test(url)
  if (!url) return ''
  if (isDrive) {
    const m = url.match(/(?:file\/d\/|id=)([^/&?]+)/)
    const id = m?.[1] || url
    return `https://drive.google.com/thumbnail?id=${id}&sz=w120`
  }
  if (url.startsWith('media://')) return ''
  return url
}

function MediaAutocomplete({ value, onPick }: { value: string; onPick: (token: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<MediaItem[]>([])
  React.useEffect(() => { listMedia().then(setItems) }, [])
  const filtered = React.useMemo(
    () => items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8),
    [items, q]
  )
  return (
    <div className="relative w-full">
      <input
        className="w-full border rounded p-1 truncate"
        placeholder="Image URL or type to search media…"
        value={q || value}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow">
          {filtered.map(it => (
            <button key={it.id} className="flex w-full items-center gap-2 px-2 py-1 hover:bg-neutral-50 text-left"
              onClick={() => { onPick(tokenFor(it.id)); setQ(''); setOpen(false) }}>
              <span className="inline-block w-6 h-6 bg-neutral-200 rounded" />
              <span className="truncate text-sm">{it.name}</span>
            </button>
          ))}
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
  const thumb = useMemo(() => useThumb(item.imageUrl), [item.imageUrl])

  // --- Validation ---
  const nameError = !item.name.trim()
  const priceVal = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0
  const priceError = priceVal < 0.01

  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'opacity-60' : ''}>
      {/* drag handle */}
      <td className="px-2" style={{ width: DRAG_COL_W }}>
        <button {...attributes} {...listeners} className="cursor-grab text-neutral-400" title="Drag to reorder">⋮⋮</button>
      </td>

      {/* index */}
      <td className="px-2 text-neutral-500" style={{ width: INDEX_COL_W }}>{index + 1}</td>

      {/* Product Name */}
      <td className="px-2 align-top">
        <div>
          <input
            className={`w-full border rounded p-1 truncate ${nameError ? 'border-red-500' : ''}`}
            value={item.name}
            onChange={e => update('name', e.target.value)}
            placeholder="Product name"
          />
          {nameError && (
            <div className="text-xs text-red-600 mt-1">Product name is required</div>
          )}
        </div>
      </td>

      {/* Size */}
      <td className="px-2 align-top" style={{ width: SIZE_COL_W }}>
        <input
          className="border rounded p-1 truncate"
          style={{ width: SIZE_COL_W }}
          value={item.size}
          onChange={e => update('size', e.target.value)}
          placeholder="e.g., 750ml"
        />
      </td>

      {/* Price */}
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
          {priceError && (
            <div className="text-xs text-red-600 mt-1">Price must be at least $0.01</div>
          )}
        </div>
      </td>

      {/* Image chooser */}
      <td className="px-2 align-top">
        <div className="flex items-center gap-2">
          {thumb && <img src={thumb} alt="" className="w-8 h-8 object-contain rounded border" />}
          <MediaAutocomplete value={item.imageUrl} onPick={(token) => update('imageUrl', token)} />
        </div>
      </td>

      {/* Remove */}
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
