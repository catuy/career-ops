import { NavLink, Outlet } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/evaluate', label: 'Activity' },
  { to: '/applications', label: 'Applications' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/pdfs', label: 'PDFs' },
  { to: '/config', label: 'Config' },
]

export function Layout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={{ borderBottom: '1px solid var(--ui)', background: 'var(--bg)' }} className="sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center gap-6">
          <span style={{ color: 'var(--tx-h)' }} className="font-bold tracking-tight text-sm">career-ops</span>
          <div className="flex gap-0.5 flex-1">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'}
                className="px-3 py-1 rounded text-sm transition-colors"
                style={({ isActive }) => ({
                  background: isActive ? 'var(--ui)' : 'transparent',
                  color: isActive ? 'var(--tx-h)' : 'var(--tx-3)',
                  fontWeight: isActive ? 600 : 400,
                })}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <ThemeToggle />
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
