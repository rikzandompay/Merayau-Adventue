export interface AdminUser {
  id: number
  email: string
  nama: string
  role: string
}

export function useAdminAuth() {
  const user = useState<AdminUser | null>('admin-user', () => null)
  const checked = useState<boolean>('admin-auth-checked', () => false)

  async function fetchMe(force = false): Promise<AdminUser | null> {
    if (checked.value && !force) return user.value
    try {
      const requestFetch = useRequestFetch()
      const res = await requestFetch<{ authenticated: boolean; user: AdminUser | null }>('/api/auth/me')
      user.value = res.authenticated ? res.user : null
    } catch {
      user.value = null
    } finally {
      checked.value = true
    }
    return user.value
  }

  async function login(email: string, password: string): Promise<AdminUser> {
    const res = await $fetch<{ ok: boolean; user: AdminUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = res.user
    checked.value = true
    return res.user
  }

  async function logout(): Promise<void> {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    checked.value = true
    await navigateTo('/admin/login')
  }

  return { user, checked, fetchMe, login, logout }
}

