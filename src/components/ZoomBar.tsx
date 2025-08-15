import React from 'react'
export default function ZoomBar({ zoom,setZoom,fitOn,toggleFit,resetFit }:{ zoom:number; setZoom:(z:number)=>void; fitOn:boolean; toggleFit:()=>void; resetFit:()=>void }){
  return (<div className="flex items-center gap-2">
    <button onClick={toggleFit} className={`px-3 py-1 border rounded text-xs ${fitOn?'bg-neutral-200':''}`}>Fit width</button>
    {!fitOn && <button onClick={resetFit} className="px-3 py-1 border rounded text-xs">Reset to Fit</button>}
    <button onClick={()=>setZoom(Math.max(0.1,zoom-0.1))} className="px-2 py-1 border rounded" disabled={fitOn}>–</button>
    <span className="text-sm w-12 text-center">{Math.round(zoom*100)}%</span>
    <button onClick={()=>setZoom(zoom+0.1)} className="px-2 py-1 border rounded" disabled={fitOn}>+</button>
  </div>)
}
