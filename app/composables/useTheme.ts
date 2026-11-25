export type ThemeMode = 'light' | 'dark'

export function useTheme() {
  const theme = useState<ThemeMode>('merayau-theme', () => 'light')

  function applyTheme(next: ThemeMode) {
    theme.value = next
    if (import.meta.client) {
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem('merayau-theme', next)
      } catch {
        // Ignore storage write errors in restricted browser contexts.
      }
    }
  }

  onMounted(() => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    theme.value = current
  })

  return {
    theme,
    setTheme: applyTheme,
  }
}

