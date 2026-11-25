export default defineEventHandler(async () => {
  const db = useDb()
  const rule = await getDefaultSetting(db)
  if (!rule) {
    throw createError({ statusCode: 404, statusMessage: 'Pengaturan sewa belum tersedia.' })
  }
  return rule
})

