import { useState } from 'react'
import { getTheme, setTheme } from '../lib/theme'

type Theme = 'light' | 'dark' | 'system'
const cycle: Theme[] = ['light', 'dark', 'system']
const labels: Record<Theme, string> = { light: '☀️', dark: '🌙', system: '💻' }

export function ThemeToggle() {
  const [current, setCurrent] = useState<Theme>(getTheme() as Theme)
  const next = () => {
    const t = cycle[(cycle.indexOf(current) + 1) % cycle.length]
    setTheme(t); setCurrent(t)
  }
  return (
    <button onClick={next} title={`Theme: ${current}`}
      className="w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors"
      style={{ color: 'var(--tx-3)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ui)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {labels[current]}
    </button>
  )
}
