import React, { useEffect, useRef, useState } from 'react'
import { Stage } from 'react-konva'
export default function FitStage({designW,designH,containerHeight,zoom,fitOn,onFitWidthScale,onStageRef,children}:{designW:number;designH:number;containerHeight:number;zoom:number;fitOn:boolean;onFitWidthScale?:(s:number)=>void;onStageRef?:(s:any)=>void;children:React.ReactNode}){
  const hostRef=useRef<HTMLDivElement|null>(null)
  const [size,setSize]=useState({w:designW,h:designH})
  const scaleRef=useRef(1)
  useEffect(()=>{
    if(!hostRef.current) return
    const el=hostRef.current
    const resize=()=>{
      const availW=Math.max(200, el.clientWidth-24)
      const fitScale=availW/designW; scaleRef.current=fitScale; onFitWidthScale?.(fitScale)
      const s=fitOn?fitScale:zoom; setSize({w:designW*s,h:designH*s})
    }
    const ro=new ResizeObserver(resize); ro.observe(el); resize(); return ()=>ro.disconnect()
  },[designW,designH,zoom,fitOn,onFitWidthScale])
  useEffect(()=>{ const s=fitOn?scaleRef.current:zoom; setSize({w:designW*s,h:designH*s}) },[fitOn,zoom,designW,designH])
  return (<div ref={hostRef} style={{height:containerHeight}} className="overflow-auto">
    <div className="flex items-center justify-center">
      <Stage width={size.w} height={size.h} scaleX={fitOn?scaleRef.current:zoom} scaleY={fitOn?scaleRef.current:zoom} ref={onStageRef as any}>
        {children}
      </Stage>
    </div>
  </div>)
}
