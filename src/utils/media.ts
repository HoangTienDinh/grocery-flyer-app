import { get, set, del } from 'idb-keyval'
import JSZip from 'jszip'

export type MediaItem = { id:string; name:string; type:string; size:number; createdAt:number }
const INDEX_KEY='media:index'
const ITEM_KEY=(id:string)=>`media:item:${id}`

export async function listMedia():Promise<MediaItem[]>{
  const idx = await get(INDEX_KEY) as MediaItem[] | undefined
  return idx || []
}

export async function addFiles(files: FileList | File[]):Promise<MediaItem[]>{
  const arr = Array.from(files)
  const idx = await listMedia()
  const added: MediaItem[] = []
  for(const f of arr){
    const id = crypto.randomUUID()
    const item: MediaItem = { id, name: f.name, type: f.type, size: f.size, createdAt: Date.now() }
    await set(ITEM_KEY(id), f)
    idx.push(item)
    added.push(item)
  }
  await set(INDEX_KEY, idx)
  return added
}

export async function getBlob(id:string):Promise<Blob|null>{
  const b = await get(ITEM_KEY(id)) as Blob | undefined
  return b || null
}

export async function removeMedia(id:string){
  const idx = await listMedia()
  const next = idx.filter(i => i.id !== id)
  await set(INDEX_KEY, next)
  await del(ITEM_KEY(id))
}

export async function renameMedia(id:string, name:string){
  const idx = await listMedia()
  const it = idx.find(i => i.id === id); if(!it) return
  it.name = name
  await set(INDEX_KEY, idx)
}

export function tokenFor(id:string){ return `media://${id}` }
export function tokenToId(token:string){ return token.replace(/^media:\/\//,'') }

export async function resolveTokenToObjectUrl(token:string):Promise<string|null>{
  const id = tokenToId(token)
  const b = await getBlob(id)
  if(!b) return null
  return URL.createObjectURL(b)
}

export async function exportZip(selectedIds?:string[]):Promise<Blob>{
  const idx = await listMedia()
  const chosen = selectedIds?.length ? idx.filter(i=>selectedIds.includes(i.id)) : idx
  const zip = new JSZip()
  const index = []
  for(const it of chosen){
    const blob = await getBlob(it.id)
    if(!blob) continue
    zip.file(`media/${it.id}-${it.name}`, blob)
    index.push(it)
  }
  zip.file('index.json', JSON.stringify(index, null, 2))
  return await zip.generateAsync({ type: 'blob' })
}

export async function importZip(file:File):Promise<number>{
  const zip = await JSZip.loadAsync(file)
  const files = Object.values(zip.files)
  let count = 0
  const idx = await listMedia()
  for(const f of files){
    if(f.name === 'index.json') continue
    if(!f.name.startsWith('media/')) continue
    const blob = await f.async('blob')
    const [folder, base] = f.name.split('/',2)
    const dash = base.indexOf('-')
    const id = crypto.randomUUID()
    const name = dash>0 ? base.slice(dash+1) : base
    await set(ITEM_KEY(id), blob)
    idx.push({ id, name, type: blob.type || 'image/*', size: blob.size, createdAt: Date.now() })
    count++
  }
  await set(INDEX_KEY, idx)
  return count
}
