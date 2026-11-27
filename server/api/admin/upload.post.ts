import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { put } from '@vercel/blob'

const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_MULTIPART_BYTES = Math.ceil(MAX_FILE_BYTES * 1.25)
const MAX_DIMENSION_PX = 8192
const ALLOWED_FOLDERS = new Set(['alat', 'paket', 'trip'])
const MIME_BY_EXT: Record<'jpg' | 'png' | 'webp', string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function sanitizeAndValidateJpeg(buf: Buffer): Buffer | null {
  if (buf.length < 20 || buf[0] !== 0xff || buf[1] !== 0xd8) return null

  const kept: Buffer[] = [buf.subarray(0, 2)]
  let offset = 2
  let foundSof = false

  while (offset < buf.length) {
    if (buf[offset] !== 0xff) return null
    while (offset < buf.length && buf[offset] === 0xff) offset++
    if (offset >= buf.length) return null

    const marker = buf[offset]!
    offset++

    if (marker === 0xd9) {
      kept.push(Buffer.from([0xff, 0xd9]))
      break
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(Buffer.from([0xff, marker]))
      continue
    }

    if (offset + 2 > buf.length) return null
    const segLen = buf.readUInt16BE(offset)
    if (segLen < 2 || offset + segLen > buf.length) return null

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (segLen < 7) return null
      const height = buf.readUInt16BE(offset + 3)
      const width = buf.readUInt16BE(offset + 5)
      if (width < 1 || height < 1 || width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
        return null
      }
      foundSof = true
    }

    if (marker === 0xda) {
      if (!foundSof) return null
      kept.push(Buffer.from([0xff, marker]))
      kept.push(buf.subarray(offset))
      return Buffer.concat(kept)
    }

    // Strip EXIF/XMP metadata (APP1..APP13, APP15) and raw JPEG comments (COM) while keeping APP0/APP14/ICC(APP2).
    const shouldStrip =
      marker === 0xe1 ||
      (marker >= 0xe3 && marker <= 0xed) ||
      marker === 0xef ||
      marker === 0xfe

    if (!shouldStrip) {
      kept.push(Buffer.from([0xff, marker]))
      kept.push(buf.subarray(offset, offset + segLen))
    }

    offset += segLen
  }

  return foundSof ? Buffer.concat(kept) : null
}

function validateAndSanitizePng(buf: Buffer): Buffer | null {
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (buf.length < 33 || !buf.subarray(0, 8).equals(pngSig)) return null
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null

  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  if (width < 1 || height < 1 || width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
    return null
  }

  const kept: Buffer[] = [buf.subarray(0, 8)]
  let offset = 8
  const stripChunks = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt'])

  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset)
    const totalChunkBytes = 12 + length
    if (offset + totalChunkBytes > buf.length) return null
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii')
    if (!stripChunks.has(type)) {
      kept.push(buf.subarray(offset, offset + totalChunkBytes))
    }
    offset += totalChunkBytes
    if (type === 'IEND') {
      return Buffer.concat(kept)
    }
  }

  return null
}

function validateWebp(buf: Buffer): Buffer | null {
  if (buf.length < 30) return null
  if (
    buf.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    buf.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    return null
  }
  const chunk = buf.subarray(12, 16).toString('ascii')
  if (chunk !== 'VP8 ' && chunk !== 'VP8L' && chunk !== 'VP8X') return null
  return buf
}

function inspectAndSanitizeImage(
  buf: Buffer,
): { ext: 'jpg' | 'png' | 'webp'; cleanData: Buffer } | null {
  if (buf.length < 16) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    const cleanData = sanitizeAndValidateJpeg(buf)
    return cleanData ? { ext: 'jpg', cleanData } : null
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const cleanData = validateAndSanitizePng(buf)
    return cleanData ? { ext: 'png', cleanData } : null
  }
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    const cleanData = validateWebp(buf)
    return cleanData ? { ext: 'webp', cleanData } : null
  }
  return null
}

export default defineEventHandler(async (event) => {
  const adminId = event.context.admin?.id as number
  const ip = getClientIp(event)

  enforceRateLimit(event, {
    namespace: 'admin-upload',
    key: `${adminId}:${ip}`,
    max: 30,
    windowSec: 10 * 60,
    message: 'Batas unggah gambar tercapai. Tunggu beberapa menit sebelum mengunggah lagi.',
  })

  const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (contentLength > MAX_MULTIPART_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Ukuran unggahan melebihi batas maksimal 2 MB.',
    })
  }

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

  const inspected = inspectAndSanitizeImage(filePart.data)
  if (!inspected) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Format file harus JPG, PNG, atau WEBP yang valid dan utuh.',
    })
  }

  const { ext, cleanData } = inspected
  const filename = `${randomUUID()}.${ext}`
  const safeOriginalName = (filePart.filename || filename)
    .replace(/[^\w.\- ()]/g, '_')
    .slice(0, 120)
  const config = useRuntimeConfig()
  const blobToken = String(config.blobReadWriteToken || process.env.BLOB_READ_WRITE_TOKEN || '').trim()

  if (blobToken) {
    const blob = await put(`uploads/${folder}/${filename}`, cleanData, {
      access: 'public',
      contentType: MIME_BY_EXT[ext],
      token: blobToken,
    })

    await recordSecurityAudit(event, {
      eventType: 'admin.upload_created',
      severity: 'info',
      targetType: folder,
      targetId: filename,
      metadata: { storage: 'vercel_blob', sizeBytes: cleanData.length },
    })

    return {
      url: blob.url,
      filename: safeOriginalName,
      sizeBytes: cleanData.length,
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
  await writeFile(resolve(targetDir, filename), cleanData)

  await recordSecurityAudit(event, {
    eventType: 'admin.upload_created',
    severity: 'info',
    targetType: folder,
    targetId: filename,
    metadata: { storage: 'local_disk', sizeBytes: cleanData.length },
  })

  return {
    url: `/uploads/${folder}/${filename}`,
    filename: safeOriginalName,
    sizeBytes: cleanData.length,
  }
})
