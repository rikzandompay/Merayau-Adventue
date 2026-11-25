export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/admin/')) return
  const session = requireAdminSession(event)
  event.context.admin = session
})

