import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { put } from '@vercel/blob'

const MAX_FILE_BYTES = 2 * 1024 * 1024
const ALLOWED_FOLDERS = new Set(['alat', 'paket', 'trip'])
const MIME_BY_EXT: Record<'jpg' | 'png' | 'webp', string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function detectImageExt(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png'
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp'
  }
  return null
}

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: 'File upload tidak ditemukan.' })
  }

  const folderPart = parts.find((p) => p.name === 'folder')?.data.toString('utf8').trim() || 'alat'
  const folder = ALLOWED_FOLDERS.has(folderPart) ? folderPart : 'alat'
  const filePart = parts.find((p) => p.name === 'file' && p.filename)

  if (!filePart?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Lampiran gambar wajib diisi.' })
  }
  if (filePart.data.length > MAX_FILE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Ukuran gambar maksimal 2 MB.' })
  }

  const ext = detectImageExt(filePart.data)
  if (!ext) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Format file harus JPG, PNG, atau WEBP yang valid.',
    })
  }

  const filename = `${randomUUID()}.${ext}`
  const config = useRuntimeConfig()
  const blobToken = String(config.blobReadWriteToken || process.env.BLOB_READ_WRITE_TOKEN || '').trim()

  if (blobToken) {
    const blob = await put(`uploads/${folder}/${filename}`, filePart.data, {
      access: 'public',
      contentType: MIME_BY_EXT[ext],
      token: blobToken,
    })
    return {
      url: blob.url,
      filename: filePart.filename || filename,
      sizeBytes: filePart.data.length,
    }
  }

  if (process.env.VERCEL) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Vercel Blob belum dikonfigurasi (BLOB_READ_WRITE_TOKEN kosong).',
    })
  }

  const targetDir = resolve(process.cwd(), 'public', 'uploads', folder)
  await mkdir(targetDir, { recursive: true })
  await writeFile(resolve(targetDir, filename), filePart.data)

  return {
    url: `/uploads/${folder}/${filename}`,
    filename: filePart.filename || filename,
    sizeBytes: filePart.data.length,
  }
})
