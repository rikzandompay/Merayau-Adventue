import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const UPLOAD_ROOT = resolve(process.cwd(), 'public', 'uploads')
const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export default defineEventHandler(async (event) => {
  const rel = getRouterParam(event, 'path') || ''
  const target = resolve(UPLOAD_ROOT, rel)
  if (!target.startsWith(`${UPLOAD_ROOT}${sep}`)) {
    throw createError({ statusCode: 400, statusMessage: 'Path berkas tidak valid.' })
  }

  const mime = MIME_BY_EXT[extname(target).toLowerCase()]
  if (!mime) {
    throw createError({ statusCode: 404, statusMessage: 'Gambar tidak ditemukan.' })
  }

  try {
    const data = await readFile(target)
    setHeader(event, 'Content-Type', mime)
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Content-Security-Policy', "default-src 'none'; sandbox")
    setHeader(event, 'Cross-Origin-Resource-Policy', 'same-origin')
    setHeader(event, 'Cache-Control', 'public, max-age=3600')
    return data
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Gambar tidak ditemukan.' })
  }
})
