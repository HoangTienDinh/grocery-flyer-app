import * as XLSX from 'xlsx'
import { normalizePrice } from './format'
export type FeaturedItem = { name:string; size:string; price:string; imageUrl:string }
export type Row = { name:string; size:string; price:string }
export type WorkbookData = { featured:FeaturedItem[]; grocery:Row[]; frozen:Row[]; meat:Row[]; produce:Row[] }
export function parseWorkbook(buf:ArrayBuffer):WorkbookData{
  const wb=XLSX.read(buf,{type:'array'})
  const get=(n:string)=>{ const ws=wb.Sheets[n]; if(!ws) throw new Error('Missing sheet: '+n); return XLSX.utils.sheet_to_json<Record<string,any>>(ws,{defval:''}) }
  const featured=get('Featured Items').map(r=>({ name:String(r['Product Name']??'').trim(), size:String(r['Size']??'').trim(), price:normalizePrice(r['Price']), imageUrl:String(r['Image File']??'').trim() })).slice(0,9)
  const rows=(a:Record<string,any>[])=>a.map(r=>({ name:String(r['Product Name']??'').trim(), size:String(r['Size']??'').trim(), price:normalizePrice(r['Price'])})).filter(r=>r.name)
  return { featured, grocery:rows(get('Grocery')), frozen:rows(get('Frozen Foods')), meat:rows(get('Meat')), produce:rows(get('Produce')) }
}
