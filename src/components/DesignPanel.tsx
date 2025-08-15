import React from 'react'

export type BadgeStyle = 'starburst' | 'pill' | 'badge' | 'sticker'
export type Theme = {
  fontFamily: string
  backgroundColor: string
  companyNameColor: string
  dateTextColor: string
  saleBubble: { textColor: string; bgColor: string; style: BadgeStyle }
  featured:   { textColor: string; bgColor: string }
  category:   { textColor: string; bgColor: string }
  saleItem:   { textColor: string; fontScale: number }   // ← added fontScale
}

const FONT_OPTIONS = ['Roboto','Inter','Open Sans','Lato','Montserrat','Noto Sans']

export const DEFAULT_THEME: Theme = {
  fontFamily: 'Roboto',
  backgroundColor: '#FFFFFF',
  companyNameColor: '#335B29',
  dateTextColor: '#F19F1F',
  saleBubble: { textColor: '#FFFFFF', bgColor: '#8B1F1F', style: 'starburst' },
  featured:   { textColor: '#000000', bgColor: '#FFEAC7' },
  category:   { textColor: '#8B332A', bgColor: '#EEDFB6' },
  saleItem:   { textColor: '#000000', fontScale: 1 },     // ← default 100%
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

function ColorRow({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){
  return (<div className="flex items-center justify-between gap-3">
    <span className="text-sm">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={e=>onChange(e.target.value)} />
      <input className="border rounded p-1 w-28" value={value} onChange={e=>onChange(e.target.value)} />
    </div>
  </div>)
}

export default function DesignPanel({ theme, setTheme, toast }:{ theme:Theme; setTheme:(t:Theme)=>void; toast:(m:string)=>void }){
  const update = (p:(t:Theme)=>Theme)=>{ setTheme(p(theme)); toast('Theme updated') }
  const reset = ()=>{ setTheme(DEFAULT_THEME); toast('Theme reset to defaults') }
  const applyPreset = (key:string)=>{ setTheme(PRESETS[key]); toast(`Applied theme: ${key}`) }

  // convenience for % display
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
            <div className="flex items-center justify-between">
              <span className="text-sm">Font</span>
              <select className="border rounded p-1" value={theme.fontFamily} onChange={e=>update(t=>({...t,fontFamily:e.target.value}))}>
                {FONT_OPTIONS.map(f=> <option key={f} value={f}>{f}</option>)}
              </select>
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
            {/* New: row font size */}
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
