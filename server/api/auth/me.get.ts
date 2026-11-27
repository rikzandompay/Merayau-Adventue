export default defineEventHandler(async (event) => {
  const session = await getVerifiedAdminSession(event)
  return {
    authenticated: Boolean(session),
    user: session
      ? {
          id: session.id,
          email: session.email,
          nama: session.nama,
          role: session.role,
        }
      : null,
  }
})
