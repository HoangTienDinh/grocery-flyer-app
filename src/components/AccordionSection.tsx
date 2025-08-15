import React, { useState } from 'react'
export default function AccordionSection({title,children,defaultOpen=false}:{title:string;children:React.ReactNode;defaultOpen?:boolean}){
  const [isOpen,setIsOpen]=useState(defaultOpen)
  return (<div className="mb-3">
    <div onClick={()=>setIsOpen(!isOpen)} className="flex justify-between cursor-pointer bg-neutral-100 px-3 py-2 font-semibold rounded">
      <span>{title}</span>
      <span className="transition-transform" style={{transform:isOpen?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
    </div>
    {isOpen && <div className="p-3 border border-t-0 bg-white rounded-b">{children}</div>}
  </div>)
}
