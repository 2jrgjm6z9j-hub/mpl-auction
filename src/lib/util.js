import { supabase } from '../supabase'

// Supabase returns max 1000 rows per request. This loads everything.
export async function fetchAll(build) {
  let all = []
  let from = 0
  for (;;) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    all = all.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return all
}

export function nextCodes(existing, count, prefix = 'MPL') {
  let max = 0
  existing.forEach((c) => {
    const m = /(\d+)$/.exec(c || '')
    if (m) max = Math.max(max, +m[1])
  })
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + i + 1).padStart(3, '0')}`)
}

export function friendlyError(e) {
  const m = e?.message || String(e)
  if (e?.code === '23505') return 'That name or ID already exists. Please use a different one.'
  if (e?.code === '23503') return 'This item is in use (e.g. a sold player or a team with purchases) so it cannot be deleted.'
  if (m.includes('row-level security')) return 'Permission denied. Are you logged in as Admin? (See Step 3 of the setup guide.)'
  return m
}

export async function compressImage(file, max = 800) {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85))
    return { blob, ext: 'jpg', type: 'image/jpeg' }
  } catch {
    return { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), type: file.type }
  }
}

export async function uploadImage(bucket, file) {
  const { blob, ext, type } = await compressImage(file)
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: type })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
