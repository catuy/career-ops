type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'career-ops-theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getTheme(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system'
}

export function getResolvedTheme(): 'light' | 'dark' {
  const theme = getTheme()
  return theme === 'system' ? getSystemTheme() : theme
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme()
}

export function applyTheme() {
  const resolved = getResolvedTheme()
  document.documentElement.setAttribute('data-theme', resolved)
}

// Init on load
applyTheme()

// Listen for system changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getTheme() === 'system') applyTheme()
})
