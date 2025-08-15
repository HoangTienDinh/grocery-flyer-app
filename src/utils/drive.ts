export function extractDriveId(url:string):string|null{
  if(!url) return null
  try{ const u=new URL(url); const m=u.pathname.match(/\/file\/d\/([^/]+)/); if(m?.[1]) return m[1]
    const id=u.searchParams.get('id'); if(id) return id; if(/^[A-Za-z0-9_-]{20,}$/.test(url)) return url; return null
  }catch{ return null }
}
export function driveImageCandidates(raw:string):string[]{
  const id=extractDriveId(raw); if(!id) return [raw]
  return [
    `https://drive.google.com/uc?export=download&id=${id}`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w2000`,
    `https://lh3.googleusercontent.com/d/${id}=s2048`,
  ]
}
