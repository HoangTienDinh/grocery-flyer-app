import React, { useEffect, useMemo, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'

export type BadgeStyle = 'starburst' | 'pill' | 'badge' | 'sticker'
export type Theme = {
  fontFamily: string
  backgroundColor: string
  companyNameColor: string
  dateTextColor: string
  saleBubble: { textColor: string; bgColor: string; style: BadgeStyle }
  featured:   { textColor: string; bgColor: string }
  category:   { textColor: string; bgColor: string }
  saleItem:   { textColor: string; fontScale: number }
}

const FONT_OPTIONS = [
  'Roboto', 'Inter', 'Open Sans', 'Lato', 'Montserrat', 'Noto Sans',
  'Creepster', 'Great Vibes', 'Pacifico', 'Bebas Neue', 'Lobster'
] as const
type FontName = typeof FONT_OPTIONS[number]

/* Google Fonts CSS endpoints */
const FONT_CSS: Record<FontName, string> = {
  'Roboto':      'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'Inter':       'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap',
  'Open Sans':   'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap',
  'Lato':        'https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap',
  'Montserrat':  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap',
  'Noto Sans':   'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap',
  'Creepster': 'https://fonts.googleapis.com/css2?family=Creepster&display=swap',
  'Great Vibes': 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap',
  'Pacifico': 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap',
  'Bebas Neue': 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
  'Lobster': 'https://fonts.googleapis.com/css2?family=Lobster&display=swap',
}

function fontStack(name: string) {
  return `${name}, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Helvetica Neue", sans-serif`
}
function ensureFontCssLoaded(family: FontName) {
  const id = `gf-${family.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const href = FONT_CSS[family]
  if (!href) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

export const DEFAULT_THEME: Theme = {
  fontFamily: 'Roboto',
  backgroundColor: '#FFFFFF',
  companyNameColor: '#335B29',
  dateTextColor: '#F19F1F',
  saleBubble: { textColor: '#FFFFFF', bgColor: '#8B1F1F', style: 'starburst' },
  featured:   { textColor: '#000000', bgColor: '#FFEAC7' },
  category:   { textColor: '#8B332A', bgColor: '#EEDFB6' },
  saleItem:   { textColor: '#000000', fontScale: 1 },
}

export const PRESETS: Record<string, Theme> = {
  'Classic': DEFAULT_THEME,
  'Halloween': {
    fontFamily: 'Montserrat',
    backgroundColor: '#1A1A1A',
    companyNameColor: '#FF7A00',
    dateTextColor: '#FFD166',
    saleBubble: { textColor: '#FFFFFF', bgColor: '#D7263D', style: 'sticker' },
    featured: { textColor: '#FFFFFF', bgColor: '#3A3A3A' },
    category: { textColor: '#FF7A00', bgColor: '#2A2A2A' },
    saleItem: { textColor: '#EAEAEA', fontScale: 1 },
  },
  'Christmas': {
    fontFamily: 'Noto Sans',
    backgroundColor: '#FFFFFF',
    companyNameColor: '#0E7C3A',
    dateTextColor: '#C62828',
    saleBubble: { textColor: '#FFFFFF', bgColor: '#C62828', style: 'badge' },
    featured: { textColor: '#0E0E0E', bgColor: '#F0FFF5' },
    category: { textColor: '#0E7C3A', bgColor: '#E6F5EB' },
    saleItem: { textColor: '#0E0E0E', fontScale: 1 },
  },
  'Easter': {
    fontFamily: 'Lato',
    backgroundColor: '#FFFDF7',
    companyNameColor: '#7E57C2',
    dateTextColor: '#26A69A',
    saleBubble: { textColor: '#FFFFFF', bgColor: '#7E57C2', style: 'pill' },
    featured: { textColor: '#2E2E2E', bgColor: '#FFF0F6' },
    category: { textColor: '#26A69A', bgColor: '#E6FFF6' },
    saleItem: { textColor: '#2E2E2E', fontScale: 1 },
  }
}

/* ----------------- Shared utils ----------------- */

function useOutside(ref: React.RefObject<HTMLElement>, onOutside: ()=>void){
  useEffect(()=>{
    function handler(e: MouseEvent){
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return ()=> document.removeEventListener('mousedown', handler)
  }, [ref, onOutside])
}

/* ----------------- Color picker with popover ----------------- */

function normalizeHex(v: string){
  // force #RRGGBB; allow shorthand or missing '#'
  let s = v.trim()
  if (!s.startsWith('#')) s = `#${s}`
  if (/^#([0-9a-f]{3})$/i.test(s)) {
    const [, r,g,b] = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i) as RegExpMatchArray
    s = `#${r}${r}${g}${g}${b}${b}`
  }
  if (/^#([0-9a-f]{6})$/i.test(s)) return s.toUpperCase()
  return '#000000'
}

function ColorRow({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(value || '#000000')
  const rootRef = useRef<HTMLDivElement>(null)
  useOutside(rootRef, ()=> setOpen(false))

  useEffect(()=>{ setLocal(value) }, [value])

  const commit = (v: string)=>{
    const hex = normalizeHex(v)
    setLocal(hex)
    onChange(hex)
  }

  return (
    <div className="flex items-center justify-between gap-3" ref={rootRef}>
      <span className="text-sm">{label}</span>

      <div className="relative flex items-center gap-2">
        {/* swatch that opens the popover */}
        <button
          type="button"
          className="h-8 w-8 rounded border shadow-inner"
          style={{ backgroundColor: value }}
          onClick={()=> setOpen(true)}
          aria-label={`Choose ${label} color`}
        />

        {/* hex input */}
        <input
          className="border rounded p-1 w-28"
          value={local}
          onChange={e=> setLocal(e.target.value)}
          onBlur={()=> commit(local)}
          onKeyDown={(e)=>{ if (e.key === 'Enter') commit(local) }}
        />

        {/* popover */}
        {open && (
          <div className="absolute right-0 top-10 z-30 rounded border bg-white p-3 shadow-lg">
            <HexColorPicker
              color={local}
              onChange={(c)=> setLocal(c.toUpperCase())}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                className="px-2 py-1 text-sm rounded border hover:bg-neutral-100"
                onClick={()=> setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-2 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={()=>{ commit(local); setOpen(false) }}
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ----------------- Custom Font Select (combobox/listbox) ----------------- */

function FontSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: FontName)=>void
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, FONT_OPTIONS.findIndex(f => f === value))
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useOutside(rootRef, ()=> setOpen(false))

  // load all once so the menu previews immediately
  useEffect(()=>{ (FONT_OPTIONS as readonly FontName[]).forEach(ensureFontCssLoaded) }, [])

  // ensure active item in view when using arrows
  useEffect(()=>{
    if (!open || !listRef.current) return
    const li = listRef.current.children[activeIndex] as HTMLElement | undefined
    li?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const setByIndex = (idx: number)=>{
    const next = Math.min(FONT_OPTIONS.length-1, Math.max(0, idx))
    setActiveIndex(next)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={()=> setOpen(v=>!v)}
        onKeyDown={(e)=>{
          if (e.key === 'ArrowDown'){ e.preventDefault(); setOpen(true); setByIndex(activeIndex+1) }
          if (e.key === 'ArrowUp'){ e.preventDefault(); setOpen(true); setByIndex(activeIndex-1) }
          if (e.key === 'Enter' || e.key === ' '){
            e.preventDefault()
            if (!open) { setOpen(true) }
            else { onChange(FONT_OPTIONS[activeIndex]); setOpen(false) }
          }
          if (e.key === 'Escape'){ setOpen(false) }
        }}
        className="border rounded p-1 min-w-[12rem] flex items-center justify-between"
        style={{ fontFamily: fontStack(value) }}
      >
        <span>{value}</span>
        <svg width="14" height="14" viewBox="0 0 20 20" className="opacity-70"><path d="M5 8l5 5 5-5H5z" fill="currentColor"/></svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          className="absolute right-0 z-20 mt-1 max-h-64 w-[16rem] overflow-auto rounded border bg-white shadow"
        >
          {FONT_OPTIONS.map((f, i)=>(
            <li
              key={f}
              role="option"
              aria-selected={value === f}
              onMouseEnter={()=> setActiveIndex(i)}
              onMouseDown={(e)=>{ e.preventDefault(); }} // keep focus
              onClick={()=> { onChange(f); setOpen(false) }}
              className={[
                "px-3 py-2 cursor-pointer text-sm",
                i === activeIndex ? "bg-blue-50" : "bg-white",
                value === f ? "font-medium" : "font-normal"
              ].join(" ")}
              style={{ fontFamily: fontStack(f) }}
            >
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ----------------- Panel ----------------- */

export default function DesignPanel({ theme, setTheme, toast }:{ theme:Theme; setTheme:(t:Theme)=>void; toast:(m:string)=>void }){
  const update = (p:(t:Theme)=>Theme)=>{ setTheme(p(theme)); toast('Theme updated') }
  const reset = ()=>{ setTheme(DEFAULT_THEME); toast('Theme reset to defaults') }
  const applyPreset = (key:string)=>{ setTheme(PRESETS[key]); toast(`Applied theme: ${key}`) }

  // also preload selected font to avoid FOUT in the closed control
  useEffect(()=>{
    const f = theme.fontFamily as FontName
    if ((FONT_OPTIONS as readonly string[]).includes(f)) ensureFontCssLoaded(f as FontName)
  }, [theme.fontFamily])

  const salePct = Math.round((theme.saleItem?.fontScale ?? 1) * 100)

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-2">
        <label className="text-sm">Preset</label>
        <select className="border rounded p-1" onChange={(e)=>applyPreset(e.target.value)} defaultValue="">
          <option value="" disabled>Choose preset…</option>
          {Object.keys(PRESETS).map(k=> <option key={k} value={k}>{k}</option>)}
        </select>
        <button className="ml-auto text-sm px-3 py-1 rounded bg-neutral-200 hover:bg-neutral-300" onClick={reset}>Reset to defaults</button>
      </div>

      <div className="space-y-4">
        <div className="border rounded">
          <div className="bg-neutral-100 px-3 py-2 font-semibold rounded-t">General</div>
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Font</span>
              <FontSelect
                value={theme.fontFamily}
                onChange={(f)=> update(t=> ({...t, fontFamily: f}))}
              />
            </div>
            <ColorRow label="Background color" value={theme.backgroundColor} onChange={(v)=>update(t=>({...t,backgroundColor:v}))} />
          </div>
        </div>

        <div className="border rounded">
          <div className="bg-neutral-100 px-3 py-2 font-semibold rounded-t">Company Name</div>
          <div className="p-3 space-y-3">
            <ColorRow label="Text color" value={theme.companyNameColor} onChange={(v)=>update(t=>({...t,companyNameColor:v}))} />
          </div>
        </div>

        <div className="border rounded">
          <div className="bg-neutral-100 px-3 py-2 font-semibold rounded-t">Date text</div>
          <div className="p-3 space-y-3">
            <ColorRow label="Text color" value={theme.dateTextColor} onChange={(v)=>update(t=>({...t,dateTextColor:v}))} />
          </div>
        </div>

        <div className="border rounded">
          <div className="bg-neutral-100 px-3 py-2 font-semibold rounded-t">Sale Bubble</div>
          <div className="p-3 space-y-3">
            <ColorRow label="Text color" value={theme.saleBubble.textColor} onChange={(v)=>update(t=>({...t,saleBubble:{...t.saleBubble,textColor:v}}))} />
            <ColorRow label="Background color" value={theme.saleBubble.bgColor} onChange={(v)=>update(t=>({...t,saleBubble:{...t.saleBubble,bgColor:v}}))} />
            <div className="flex items-center justify-between">
              <span className="text-sm">Style</span>
              <div className="flex gap-2">
                {(['starburst','pill','badge','sticker'] as const).map(s=>(
                  <label key={s} className="text-xs border rounded px-2 py-1 cursor-pointer">
                    <input type="radio" name="badgeStyle" className="mr-1" checked={theme.saleBubble.style===s} onChange={()=>update(t=>({...t,saleBubble:{...t.saleBubble, style:s}}))}/>
                    {s}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded">
          <div className="bg-neutral-100 px-3 py-2 font-semibold rounded-t">Featured Item</div>
          <div className="p-3 space-y-3">
            <ColorRow label="Text color" value={theme.featured.textColor} onChange={(v)=>update(t=>({...t,featured:{...t.featured,textColor:v}}))} />
            <ColorRow label="Background color" value={theme.featured.bgColor} onChange={(v)=>update(t=>({...t,featured:{...t.featured,bgColor:v}}))} />
          </div>
        </div>

        <div className="border rounded">
          <div className="bg-neutral-100 px-3 py-2 font-semibold rounded-t">Category</div>
          <div className="p-3 space-y-3">
            <ColorRow label="Text color" value={theme.category.textColor} onChange={(v)=>update(t=>({...t,category:{...t.category,textColor:v}}))} />
            <ColorRow label="Background color" value={theme.category.bgColor} onChange={(v)=>update(t=>({...t,category:{...t.category,bgColor:v}}))} />
          </div>
        </div>

        <div className="border rounded">
          <div className="bg-neutral-100 px-3 py-2 font-semibold rounded-t">Sale Item</div>
          <div className="p-3 space-y-3">
            <ColorRow label="Text color" value={theme.saleItem.textColor} onChange={(v)=>update(t=>({...t,saleItem:{...t.saleItem,textColor:v}}))} />
            <div className="flex items-center justify-between">
              <span className="text-sm">Row font size</span>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={80} max={140} step={5}
                  value={salePct}
                  onChange={e=>{
                    const v = Number(e.target.value)/100
                    update(t=>({...t, saleItem:{...t.saleItem, fontScale:v}}))
                  }}
                />
                <span className="text-xs w-10 text-right">{salePct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
