export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return

  const { fetchMe } = useAdminAuth()
  const user = await fetchMe()

  if (to.path === '/admin/login') {
    if (user) return navigateTo('/admin')
    return
  }

  if (!user) {
    return navigateTo('/admin/login')
  }
})

