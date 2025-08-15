import React, { useCallback, useEffect, useRef, useState } from 'react'
type Props={initialLeft?:number; minLeft?:number; maxLeft?:number; left:React.ReactNode; right:React.ReactNode; header?:React.ReactNode}
export default function SplitPane({initialLeft=520,minLeft=380,maxLeft=800,left,right,header}:Props){
  const [leftW,setLeftW]=useState(initialLeft); const dragRef=useRef(false)
  const onMouseMove=useCallback((e:MouseEvent)=>{ if(!dragRef.current) return; const x=Math.max(minLeft,Math.min(maxLeft,e.clientX)); setLeftW(x)},[minLeft,maxLeft])
  const stopDrag=useCallback(()=>{dragRef.current=false},[])
  useEffect(()=>{ window.addEventListener('mousemove',onMouseMove); window.addEventListener('mouseup',stopDrag); return ()=>{ window.removeEventListener('mousemove',onMouseMove); window.removeEventListener('mouseup',stopDrag) } },[onMouseMove,stopDrag])
  return (<div className="w-full h-screen flex flex-col">
    <div className="flex-1 flex min-h-0">
      <aside className="h-full overflow-auto border-r bg-white" style={{width:leftW}}>{left}</aside>
      <div role="separator" aria-orientation="vertical" onMouseDown={()=>{dragRef.current=true}} className="w-2 cursor-col-resize bg-transparent relative">
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center"><div className="h-28 w-1.5 rounded bg-neutral-300"/></div>
      </div>
      <main className="flex-1 h-full overflow-hidden bg-white">{right}</main>
    </div>
  </div>)
}
