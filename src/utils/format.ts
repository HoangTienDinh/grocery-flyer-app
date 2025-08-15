export function normalizePrice(p:any):string{
  const s=String(p??'').trim(); const n=parseFloat(s.replace(/[^0-9.\-]/g,''))
  if (isNaN(n)) return '$0.00'; return `$${n.toFixed(2)}`
}
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
export function maskCurrencyFromDigits(input:string):string{
  const digits=(input.match(/\d+/g)||[]).join('')
  if(!digits) return ''
  const cents=parseInt(digits,10)
  const dollars=Math.floor(cents/100)
  const c=(cents%100).toString().padStart(2,'0')
  return `$${dollars}.${c}`
}
