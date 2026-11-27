import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { infoTrip } from '../../../../database/schema'

const updateGallerySchema = z.object({
  foto: safeOptionalImageUrlSchema(500),
  galleryItems: z.array(tripGalleryItemSchema).max(5),
})

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const body = await parseValidatedBody(event, updateGallerySchema)
  const db = useDb()

  const cleanItems = body.galleryItems
    .map((item) => ({
      src: item.src.trim(),
      label: item.label.trim(),
      tag: item.tag.trim(),
    }))
    .filter((item) => item.src.length > 0)
    .slice(0, 5)

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(infoTrip).where(eq(infoTrip.id, id)).limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Data trip tidak ditemukan.' })
    }

    const detail = parseTripDetail(existing.detailJson)
    const nextDetail: TripDetailData = {
      ...detail,
      gallery: cleanItems.map((item) => item.src),
      galleryItems: cleanItems,
    }

    await tx
      .update(infoTrip)
      .set({
        foto: body.foto === undefined ? existing.foto : body.foto,
        detailJson: JSON.stringify(nextDetail),
      })
      .where(eq(infoTrip.id, id))

    const [row] = await tx.select().from(infoTrip).where(eq(infoTrip.id, id)).limit(1)
    return {
      ...row,
      detail: parseTripDetail(row?.detailJson),
    }
  })

  invalidateChatbotSnapshotCache()
  return updated
})

