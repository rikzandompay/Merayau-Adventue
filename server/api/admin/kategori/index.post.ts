import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { kategoriAlat } from '../../../database/schema'

const schema = z.object({
  namaKategori: z.string().trim().min(2, 'Minimal 2 karakter.').max(80),
})

export default defineEventHandler(async (event) => {
  const body = await parseValidatedBody(event, schema)
  const db = useDb()
  try {
    const [res] = await db.insert(kategoriAlat).values({ namaKategori: body.namaKategori })
    const [created] = await db
      .select()
      .from(kategoriAlat)
      .where(eq(kategoriAlat.id, Number(res.insertId)))
      .limit(1)
    setResponseStatus(event, 201)
    return created
  } catch (err) {
    rethrowDbConflict(err, 'Kategori dengan nama tersebut sudah ada.')
  }
})

