export default defineEventHandler((event) => {
  const user = getAdminSession(event)
  return { authenticated: Boolean(user), user }
})

