import { count, eq } from 'drizzle-orm'
import { detailSewa, paketAlat } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()
  const [existing] = await db.select().from(paketAlat).where(eq(paketAlat.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Paket alat tidak ditemukan.' })
  }

  const [refs] = await db.select({ total: count() }).from(detailSewa).where(eq(detailSewa.idPaket, id))
  if (Number(refs?.total ?? 0) > 0) {
    await db.update(paketAlat).set({ statusAktif: false }).where(eq(paketAlat.id, id))
    return {
      ok: true,
      softDisabled: true,
      message: 'Paket terhubung ke riwayat transaksi sewa sehingga dinonaktifkan (tidak dihapus permanen).',
    }
  }

  await db.delete(paketAlat).where(eq(paketAlat.id, id))
  return { ok: true, softDisabled: false }
})

