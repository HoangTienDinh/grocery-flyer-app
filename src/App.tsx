import React, { useEffect, useMemo, useRef, useState } from 'react'
import SplitPane from './components/SplitPane'
import AccordionSection from './components/AccordionSection'
import TableEditor from './components/TableEditor'
import FeaturedTable from './components/FeaturedTable'
import ZoomBar from './components/ZoomBar'
import FitStage from './components/FitStage'
import { parseWorkbook, type FeaturedItem, type Row } from './utils/xlsx'
import { CANVAS_W, CANVAS_H, FeaturedLayer, GroceryLayer, GroupsLayer } from './components/CanvasComposer'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import dayjs from 'dayjs'
import { Stage } from 'react-konva'
import DesignPanel, { DEFAULT_THEME, type Theme } from './components/DesignPanel'
import MediaPanel from './components/MediaPanel'
import Toast from './components/Toast'

type Tab = 'featured' | 'grocery' | 'groups'
type LeftTab = 'editor' | 'design' | 'media'
const LS_KEY = 'kims-flyer-state-v2'
const THEME_KEY = 'kims-flyer-theme-v1'
const LEFTTAB_KEY = 'kims-flyer-lefttab-v1'

function useAvailableHeight(
  headerRef: React.RefObject<HTMLElement>,
  footerRef: React.RefObject<HTMLElement>
) {
  const [h, setH] = React.useState(800)
  React.useEffect(() => {
    const calc = () => {
      const winH = window.innerHeight
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 0
      const footerH = footerRef.current?.getBoundingClientRect().height ?? 0
      setH(winH - headerH - footerH)
    }
    calc()
    const roHeader = new ResizeObserver(calc)
    const roFooter = new ResizeObserver(calc)
    if (headerRef.current) roHeader.observe(headerRef.current)
    if (footerRef.current) roFooter.observe(footerRef.current)
    window.addEventListener('resize', calc)
    return () => {
      window.removeEventListener('resize', calc)
      roHeader.disconnect()
      roFooter.disconnect()
    }
  }, [headerRef, footerRef])
  return h
}

type Persist = {
  featured: FeaturedItem[]
  grocery: Row[]
  frozen: Row[]
  meat: Row[]
  produce: Row[]
  dateFrom: string
  dateTo: string
  tab: Tab
}

export default function App(){
  const [featured, setFeatured] = useState<FeaturedItem[]>([])
  const [grocery, setGrocery] = useState<Row[]>([])
  const [frozen, setFrozen] = useState<Row[]>([])
  const [meat, setMeat] = useState<Row[]>([])
  const [produce, setProduce] = useState<Row[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tab, setTab] = useState<Tab>('featured')
  const [leftTab, setLeftTab] = useState<LeftTab>('editor')
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)

  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toast = (m:string)=>{ setToastMsg(m) }
  const headerRef = useRef<HTMLDivElement | null>(null)
  const footerRef = useRef<HTMLDivElement | null>(null)
  const availableHeight = useAvailableHeight(headerRef, footerRef)

  useEffect(()=>{
    try{
      const raw = localStorage.getItem(LS_KEY)
      if(raw){
        const s = JSON.parse(raw) as Persist
        setFeatured(s.featured||[]); setGrocery(s.grocery||[]); setFrozen(s.frozen||[]); setMeat(s.meat||[]); setProduce(s.produce||[])
        setDateFrom(s.dateFrom||''); setDateTo(s.dateTo||''); setTab(s.tab||'featured')
      }
      const t = localStorage.getItem(THEME_KEY)
      if(t) setTheme(JSON.parse(t))
      const lt = localStorage.getItem(LEFTTAB_KEY) as LeftTab | null
      if(lt) setLeftTab(lt)
    }catch{}
  }, [])

  useEffect(()=>{
    const t = setTimeout(()=>{
      try{
        const payload: Persist = { featured, grocery, frozen, meat, produce, dateFrom, dateTo, tab }
        localStorage.setItem(LS_KEY, JSON.stringify(payload))
      }catch{}
    }, 150)
    return ()=> clearTimeout(t)
  }, [featured, grocery, frozen, meat, produce, dateFrom, dateTo, tab])

  useEffect(()=>{
    const t = setTimeout(()=>{
      try{ localStorage.setItem(THEME_KEY, JSON.stringify(theme)) }catch{}
    }, 120)
    return ()=> clearTimeout(t)
  }, [theme])

  useEffect(()=>{
    try{ localStorage.setItem(LEFTTAB_KEY, leftTab) }catch{}
  }, [leftTab])

  const dateRange = useMemo(()=>{
    if (!dateFrom || !dateTo) return ''
    return `${dayjs(dateFrom).format('MMMM D')} – ${dayjs(dateTo).format('MMMM D')}`
  }, [dateFrom, dateTo])

  const [zoom, setZoom] = useState(1)
  const [fitOn, setFitOn] = useState(true)
  const stageRef = useRef<Stage|null>(null)
  const resetFit = () => setFitOn(true)

  const onUpload = async (file: File) => {
    setUploadError(null)
    try {
      const ab = await file.arrayBuffer()
      const parsed = parseWorkbook(ab)
      setFeatured(parsed.featured); setGrocery(parsed.grocery); setFrozen(parsed.frozen); setMeat(parsed.meat); setProduce(parsed.produce)
    } catch {
      setUploadError('Could not read your spreadsheet. Ensure it is a .xlsx with all required sheets.')
    }
  }

  const downloadCurrent = ()=>{
    const s = stageRef.current; if (!s) return
    const name = tab==='featured'?'image1_featured.png':tab==='grocery'?'image2_grocery.png':'image3_groups.png'
    const uri = s.toDataURL({ pixelRatio: 2 }); const a=document.createElement('a'); a.href=uri; a.download=name; a.click()
  }

  // const downloadAll = async ()=>{
  //   const old=tab; const zip=new JSZip()
  //   async function cap(t:Tab,n:string){ setTab(t); await new Promise(r=>setTimeout(r,120)); const s=stageRef.current; if(!s) return; const d=s.toDataURL({pixelRatio:2}); zip.file(n,d.split(',')[1],{base64:true}) }
  //   await cap('featured','image1_featured.png'); await cap('grocery','image2_grocery.png'); await cap('groups','image3_groups.png'); setTab(old)
  //   const blob=await zip.generateAsync({type:'blob'}); saveAs(blob,'kims-flyer-images.zip')
  // }

  const downloadAll = async () => {
    const old = tab;

    // [tabName, filename]
    const shots: Array<[Tab, string]> = [
      ['featured', 'image1_featured.png'],
      ['grocery',  'image2_grocery.png'],
      ['groups',   'image3_groups.png'],
    ];

    for (const [t, name] of shots) {
      setTab(t);
      // give Konva a tick to render
      await new Promise(r => setTimeout(r, 140));
      const s = stageRef.current;
      if (!s) continue;

      // ensure latest draw before capture
      s.batchDraw?.();

      const dataUrl = s.toDataURL({ pixelRatio: 3 });
      const blob = await (await fetch(dataUrl)).blob(); // convert dataURL → Blob
      saveAs(blob, name);

      // tiny gap so browsers don’t coalesce downloads
      await new Promise(r => setTimeout(r, 60));
    }

    setTab(old);
  };

  const EditorPane = (
    <div className="min-h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="text-sm text-neutral-600 mb-2">Upload .xlsx</div>
        <input type="file" accept=".xlsx" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) onUpload(f) }} />
        {uploadError && <div className="text-sm text-red-600 mt-2">{uploadError}</div>}
      </div>
      <AccordionSection title="Dates" defaultOpen>
        <div className="grid grid-cols-2 gap-3 pb-2">
          <div>
            <label className="text-sm block mb-1">From</label>
            <input type="date" className="border rounded p-2 w-full" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-sm block mb-1">To</label>
            <input type="date" className="border rounded p-2 w-full" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
          </div>
        </div>
      </AccordionSection>
      <AccordionSection title="Featured — order & edits" defaultOpen>
        <FeaturedTable items={featured} setItems={setFeatured} onFocusAny={()=>setTab('featured')} />
      </AccordionSection>
      <AccordionSection title="Grocery">
        <TableEditor rows={grocery} setRows={setGrocery} onFocusAny={()=>setTab('grocery')} />
      </AccordionSection>
      <AccordionSection title="Frozen Foods">
        <TableEditor rows={frozen} setRows={setFrozen} onFocusAny={()=>setTab('groups')} />
      </AccordionSection>
      <AccordionSection title="Meat">
        <TableEditor rows={meat} setRows={setMeat} onFocusAny={()=>setTab('groups')} />
      </AccordionSection>
      <AccordionSection title="Produce">
        <TableEditor rows={produce} setRows={setProduce} onFocusAny={()=>setTab('groups')} />
      </AccordionSection>
    </div>
  )

  // LEFT tabs (already styled)
  const leftTopTabs = (
    <div className="px-3 bg-white sticky top-0 z-10">
      <nav aria-label="Editor/Design/Media" className="flex border-b border-neutral-200">
        {(['editor','design','media'] as LeftTab[]).map((t, i, arr) => {
          const isActive = leftTab === t
          return (
            <button
              key={t}
              onClick={()=>setLeftTab(t)}
              className={[
                "relative h-10 px-4 text-sm font-medium transition-colors duration-150",
                "rounded-tr-xl",
                i === 0 ? "rounded-tl-md" : "rounded-tl-none",
                isActive ? "text-blue-700 bg-white" : "text-neutral-700 hover:bg-blue-50/40 hover:text-neutral-900",
              ].join(" ")}
            >
              <span className="relative">
                {t[0].toUpperCase()+t.slice(1)}
                <span
                  className={[
                    "pointer-events-none absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600",
                    "transition-all duration-150",
                    isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-75"
                  ].join(" ")}
                  aria-hidden="true"
                />
              </span>
              <span
                className={[
                  "absolute right-0 top-1/2 -translate-y-1/2 h-5 w-px bg-neutral-200",
                  i === arr.length - 1 ? "hidden" : ""
                ].join(" ")}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </nav>
    </div>
  )

  const leftContent = (
    <div className="flex-1 min-h-0 overflow-auto">
      {leftTab==='editor' ? EditorPane : leftTab==='design' ? <DesignPanel theme={theme} setTheme={setTheme} toast={toast} /> : <MediaPanel toast={toast} />}
    </div>
  )

  const left = (<div className="min-h-full flex flex-col">{leftTopTabs}{leftContent}</div>)

  const renderLayer = () => {
    if (tab === 'featured') return <FeaturedLayer items={featured} dateRange={dateRange} theme={theme} />
    if (tab === 'grocery')  return <GroceryLayer rows={grocery} dateRange={dateRange} theme={theme} />
    return <GroupsLayer frozen={frozen} meat={meat} produce={produce} dateRange={dateRange} theme={theme} />
  }

  const right = (
  <div className="flex flex-col h-full">
    {/* RIGHT header — aligned with left: items-end + matching tab height */}
    <div
      ref={headerRef}
      className="border-b px-3 h-10 bg-white sticky top-0 z-10 flex items-center"
    >
      <div className="flex items-center w-full">
        <nav aria-label="Output images" className="flex border-b border-neutral-200">
          {([
            { key: 'featured', label: 'Image 1 – Featured' },
            { key: 'grocery',  label: 'Image 2 – Grocery' },
            { key: 'groups',   label: 'Image 3 – Groups'  },
          ] as const).map((t, i, arr) => {
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                onClick={()=> setTab(t.key as Tab)}
                className={[
                  "relative h-10 px-3 text-xs font-medium transition-colors duration-150",
                  "rounded-tr-xl",
                  i === 0 ? "rounded-tl-md" : "rounded-tl-none",
                  isActive ? "text-blue-700 bg-white" : "text-neutral-700 hover:bg-blue-50/40 hover:text-neutral-900",
                ].join(" ")}
              >
                <span className="relative">
                  {t.label}
                  <span
                    className={[
                      "pointer-events-none absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600",
                      "transition-all duration-150",
                      isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-75"
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={[
                    "absolute right-0 top-1/2 -translate-y-1/2 h-5 w-px bg-neutral-200",
                    i === arr.length - 1 ? "hidden" : ""
                  ].join(" ")}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ZoomBar
            zoom={zoom}
            setZoom={setZoom}
            fitOn={fitOn}
            toggleFit={()=>setFitOn(v=>!v)}
            resetFit={()=>setFitOn(true)}
          />
        </div>
      </div>
    </div>

    {/* Canvas fills all remaining height exactly */}
    <div className="flex-1 min-h-0">
      <FitStage
        designW={CANVAS_W}
        designH={CANVAS_H}
        containerHeight={availableHeight}
        zoom={zoom}
        fitOn={fitOn}
        onFitWidthScale={()=>{}}
        onStageRef={(s)=>{ stageRef.current = s }}
      >
        {renderLayer()}
      </FitStage>
    </div>

    {/* footer */}
    <div
      ref={footerRef}
      className="border-t px-4 py-3 flex items-center gap-2 justify-end bg-white"
    >
      <button onClick={downloadCurrent} className="px-3 py-1 rounded bg-blue-600 text-white">
        Download PNG
      </button>
      <button onClick={downloadAll} className="px-3 py-1 rounded bg-green-600 text-white">
        Download All
      </button>
    </div>
  </div>
)

  return (<>
    <SplitPane left={left} right={right} />
    {toastMsg && <Toast message={toastMsg} onDone={()=>setToastMsg(null)} />}
  </>)
}
