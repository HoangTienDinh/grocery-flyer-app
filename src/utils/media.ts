import { get, set, del } from 'idb-keyval'

export type MediaItem = { id: string; name: string; type: string; size: number; createdAt: number }

const INDEX_KEY = 'media:index'
const ITEM_KEY = (id: string) => `media:item:${id}`

const ASSET_MANIFEST: Record<string, string> =
  import.meta.glob('../assets/*.{png,jpg,jpeg,webp,gif,svg}', { eager: true, as: 'url' }) as any

function assetNameFromPath(p: string): string {
  const seg = p.split('/').pop()
  return seg || p
}

function assetUrlForName(name: string): string | undefined {
  const key = Object.keys(ASSET_MANIFEST).find(p => p.endsWith('/' + name))
  return key ? ASSET_MANIFEST[key] : undefined
}

export function listBundledAssets(): MediaItem[] {
  const now = 0
  return Object.keys(ASSET_MANIFEST).map((path) => {
    const name = assetNameFromPath(path)
    return {
      id: `asset:${name}`,
      name,
      type: 'asset/image',
      size: 0,
      createdAt: now,
    }
  })
}

export async function listMedia(): Promise<MediaItem[]> {
  const idx = (await get(INDEX_KEY)) as MediaItem[] | undefined
  return idx || []
}

export async function addFiles(files: FileList | File[]): Promise<MediaItem[]> {
  const arr = Array.from(files)
  const idx = await listMedia()
  const added: MediaItem[] = []
  for (const f of arr) {
    const id = crypto.randomUUID()
    const item: MediaItem = { id, name: f.name, type: f.type, size: f.size, createdAt: Date.now() }
    await set(ITEM_KEY(id), f)
    idx.push(item)
    added.push(item)
  }
  await set(INDEX_KEY, idx)
  return added
}

export async function getBlob(id: string): Promise<Blob | null> {
  // Bundled assets do not live in IndexedDB
  if (id.startsWith('asset:')) return null
  const b = (await get(ITEM_KEY(id))) as Blob | undefined
  return b || null
}

export async function removeMedia(id: string) {
  if (id.startsWith('asset:')) return // ignore deletes for bundled assets
  const idx = await listMedia()
  const next = idx.filter(i => i.id !== id)
  await set(INDEX_KEY, next)
  await del(ITEM_KEY(id))
}

export async function renameMedia(id: string, name: string) {
  if (id.startsWith('asset:')) return // assets are read-only
  const idx = await listMedia()
  const it = idx.find(i => i.id === id); if (!it) return
  it.name = name
  await set(INDEX_KEY, idx)
}

/* ============================================================
   Tokens
   - media://<id>    → IndexedDB item
   - asset://<name>  → src/assets/<name>
============================================================ */
export function tokenFor(id: string) {
  if (id.startsWith('asset:')) return `asset://${id.slice(6)}`
  return `media://${id}`
}

export function tokenToId(token: string) {
  if (token.startsWith('asset://')) return `asset:${token.slice('asset://'.length)}`
  return token.replace(/^media:\/\//, '')
}

/** Resolve either token to a URL usable by <img> or Konva Image. */
export async function resolveTokenToObjectUrl(token: string): Promise<string | null> {
  // Assets: return their built, cacheable URL (no objectURL needed)
  if (token.startsWith('asset://')) {
    const name = token.slice('asset://'.length)
    const url = assetUrlForName(name)
    return url || null
  }

  // IndexedDB-backed media
  const id = tokenToId(token)
  const b = await getBlob(id)
  if (!b) return null
  return URL.createObjectURL(b)
}
