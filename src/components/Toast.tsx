import React, { useEffect, useState } from 'react'
export default function Toast({ message, onDone }:{ message:string; onDone:()=>void }){
  const [show,setShow]=useState(true)
  useEffect(()=>{ const t=setTimeout(()=>setShow(false),1800); const t2=setTimeout(onDone,2000); return ()=>{clearTimeout(t); clearTimeout(t2)} },[onDone])
  if(!show) return null
  return (<div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-3 py-2 rounded shadow toast-enter">
    {message}
  </div>)
}
