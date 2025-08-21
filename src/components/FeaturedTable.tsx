import React, { useEffect, useMemo, useRef, useState } from 'react'
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
} from '../utils/media'
import { createPortal } from 'react-dom'

const SIZE_COL_W = 150
const PRICE_COL_W = 96
const INDEX_COL_W = 24
const DRAG_COL_W  = 24
const REMOVE_COL_W = 48

type FloatingPos =
  | { kind: 'bottom'; left: number; top: number; width: number; maxHeight: number }
  | { kind: 'top';    left: number; bottom: number; width: number; maxHeight: number }

function getScrollParents(node: HTMLElement | null) {
  const out: HTMLElement[] = []
  let el: HTMLElement | null = node
  while (el && el.parentElement) {
    el = el.parentElement
    if (!el) break
    const style = getComputedStyle(el)
    if (/(auto|scroll|overlay)/.test(style.overflowY)) out.push(el)
  }
  if (document.scrollingElement) out.push(document.scrollingElement as HTMLElement)
  return out
}

function useFloating(anchorEl: HTMLElement | null, offset = 6, maxMenuHeight = 360) {
  const [pos, setPos] = useState<FloatingPos | null>(null)

  React.useEffect(() => {
    if (!anchorEl) { setPos(null); return }

    const compute = () => {
      const r = anchorEl.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      const margin = 8
      const left = Math.round(Math.max(margin, Math.min(r.left, vw - r.width - margin)))
      const width = Math.round(r.width)

      const spaceBelow = vh - r.bottom
      const spaceAbove = r.top
      const desired = Math.min(maxMenuHeight, vh * 0.5)

      if (spaceBelow >= desired || spaceBelow >= spaceAbove) {
        setPos({
          kind: 'bottom',
          left,
          top: Math.round(r.bottom + offset),
          width,
          maxHeight: Math.max(140, Math.min(maxMenuHeight, spaceBelow - offset - 4)),
        })
      } else {
        setPos({
          kind: 'top',
          left,
          bottom: Math.round(vh - (r.top - offset)),
          width,
          maxHeight: Math.max(140, Math.min(maxMenuHeight, spaceAbove - offset - 4)),
        })
      }
    }

    compute()
    const parents = getScrollParents(anchorEl)
    const onScroll = () => compute()
    const onResize = () => compute()
    parents.forEach(p => p.addEventListener('scroll', onScroll, { passive: true }))
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(() => compute())
    ro.observe(anchorEl)

    return () => {
      parents.forEach(p => p.removeEventListener('scroll', onScroll))
      window.removeEventListener('resize', onResize)
      ro.disconnect()
    }
  }, [anchorEl, offset, maxMenuHeight])

  return pos
}

/* ---------- Filename → token helpers ---------- */
function stripPathAndLower(s: string) {
  const justFile = s.replace(/^.*[\\/]/, '')
  return justFile.toLowerCase().trim()
}
function noExt(nameLower: string) {
  return nameLower.replace(/\.[a-z0-9]+$/i, '')
}

/* -------------------- Media Autocomplete (tokens only) -------------------- */
function MediaAutocomplete({ value, onPick }: { value: string; onPick: (token: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<MediaItem[]>([])
  const [active, setActive] = useState<number>(-1)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const load = async () => {
      const [uploaded, assets] = await Promise.all([listMedia(), Promise.resolve(listBundledAssets())])
      const combined = [...assets, ...uploaded].sort((a, b) => a.name.localeCompare(b.name))
      setItems(combined)
    }
    load()
  }, [])

  // token -> display name (assets: file name; media: stored name)
  const displayNameFor = useMemo(() => {
    const idToName = new Map(items.map(i => [i.id, i.name]))
    return (src: string): string => {
      if (!src) return ''
      if (src.startsWith('asset://')) return src.slice('asset://'.length)
      if (src.startsWith('media://')) {
        const id = src.slice('media://'.length)
        return idToName.get(id) ?? '(unnamed media)'
      }
      return '' // non-token not used anymore
    }
  }, [items])

  const filtered = useMemo(() => {
    const needle = (q || '').toLowerCase()
    if (!needle) return items.slice(0, 20)
    return items.filter(i => i.name.toLowerCase().includes(needle)).slice(0, 20)
  }, [items, q])

  const pos = useFloating(inputRef.current, 6, 360)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t)) return
      if (inputRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  useEffect(() => {
    if (active < 0) return
    optionRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const selectIndex = (idx: number) => {
    const it = filtered[idx]; if (!it) return
    onPick(tokenFor(it.id))  // store token
    setQ(''); setOpen(false); setActive(-1)
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); return }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true); setActive(filtered.length ? 0 : -1); e.preventDefault(); return
    }
    if (!open) return
    if (e.key === 'ArrowDown') { setActive(p => Math.min((p < 0 ? -1 : p) + 1, filtered.length - 1)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setActive(p => Math.max((p < 0 ? filtered.length : p) - 1, 0)); e.preventDefault() }
    else if (e.key === 'Home') { setActive(filtered.length ? 0 : -1); e.preventDefault() }
    else if (e.key === 'End') { setActive(filtered.length ? filtered.length - 1 : -1); e.preventDefault() }
    else if (e.key === 'Enter' && active >= 0) { selectIndex(active); e.preventDefault() }
  }

  useEffect(() => {
    if (!open) { setActive(-1); return }
    setActive(filtered.length ? 0 : -1)
  }, [open, q, filtered.length])

  const displayValue = q !== '' ? q : displayNameFor(value)

  return (
    <div className="relative w-full">
      <div className="flex items-center">
        <input
          ref={inputRef}
          className="w-full border rounded p-1 truncate"
          placeholder="Type to search…"
          value={displayValue}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-expanded={open}
          aria-activedescendant={active >= 0 ? `media-opt-${active}` : undefined}
          aria-controls="media-listbox"
          role="combobox"
        />
      </div>

      {open && filtered.length > 0 && pos &&
        createPortal(
          <div
            ref={menuRef}
            id="media-listbox"
            role="listbox"
            style={{
              position: 'fixed',
              left: pos.left,
              width: pos.width,
              ...(pos.kind === 'bottom' ? { top: pos.top } : { bottom: pos.bottom }),
              maxHeight: pos.maxHeight,
              overflowY: 'auto',
              zIndex: 9999,
              background: 'white',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
            }}
          >
            {filtered.map((it, idx) => {
              const isActive = idx === active
              return (
                <button
                  key={it.id}
                  id={`media-opt-${idx}`}
                  ref={el => (optionRefs.current[idx] = el)}
                  role="option"
                  aria-selected={isActive}
                  type="button"
                  className={`flex w-full items-center gap-2 px-2 py-2 text-left ${
                    isActive ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                  }`}
                  onMouseEnter={() => setActive(idx)}
                  onMouseDown={(e) => e.preventDefault()}
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
          </div>,
          document.body
        )
      }
    </div>
  )
}

/* -------------------- Row + Table -------------------- */
function RowItem({
  id, index, item, update, remove
}: {
  id: string; index: number; item: FeaturedItem; update: (k: keyof FeaturedItem, v: string) => void; remove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

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
          placeholder="e.g. 750ml"
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

  /* -------- Auto-map spreadsheet filenames to tokens -------- */
  const [nameToToken, setNameToToken] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    // Build the filename → token map from both sources
    const buildMap = async () => {
      const [uploaded, assets] = await Promise.all([listMedia(), Promise.resolve(listBundledAssets())])
      const all = [...assets, ...uploaded]
      const map = new Map<string, string>()
      for (const it of all) {
        const token = tokenFor(it.id)
        const n1 = stripPathAndLower(it.name)
        const n2 = noExt(n1)
        map.set(n1, token)
        if (!map.has(n2)) map.set(n2, token)
      }
      setNameToToken(map)
    }
    buildMap()
  }, [])

  useEffect(() => {
    if (!nameToToken.size || items.length === 0) return
    let changed = false
    const next = items.map((it) => {
      const src = (it.imageUrl || '').trim()
      // Already a token → leave as-is
      if (!src || src.startsWith('asset://') || src.startsWith('media://')) return it

      const base = stripPathAndLower(src)
      const key1 = base
      const key2 = noExt(base)

      const token = nameToToken.get(key1) || nameToToken.get(key2)
      if (token && token !== it.imageUrl) {
        changed = true
        return { ...it, imageUrl: token }
      }
      return it
    })
    if (changed) setItems(next)
  }, [items, nameToToken, setItems])

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
