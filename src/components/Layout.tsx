import { Link, useLocation } from 'react-router-dom'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { Users, Plus, Wallet } from 'lucide-react'
import { CREW_CONFIG } from '@/crew-config'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const loc = useLocation()
  const wrongChain = isConnected && chainId !== CREW_CONFIG.chainId

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b" style={{ background: 'rgba(13,27,47,0.88)', backdropFilter: 'blur(16px)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="display font-bold text-lg tracking-tight" style={{ color: 'var(--ink)' }}>
            crew
          </Link>
          <nav className="hidden sm:flex items-center gap-1 ml-2">
            <NavItem to="/crews" active={loc.pathname === '/crews'}>
              <Users size={14} />
              My Crews
            </NavItem>
            <NavItem to="/new" active={loc.pathname === '/new'}>
              <Plus size={14} />
              New Crew
            </NavItem>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {wrongChain && (
              <button
                onClick={() => switchChain({ chainId: CREW_CONFIG.chainId })}
                className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: 'rgba(232,109,122,0.15)', color: 'var(--danger)', border: '1px solid rgba(232,109,122,0.3)' }}
              >
                Switch to {CREW_CONFIG.chainName}
              </button>
            )}
            <ConnectKitButton />
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="sm:hidden flex items-center gap-1 px-4 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(13,27,47,0.6)' }}>
        <NavItem to="/crews" active={loc.pathname === '/crews'}>
          <Users size={13} />
          My Crews
        </NavItem>
        <NavItem to="/new" active={loc.pathname === '/new'}>
          <Plus size={13} />
          New Crew
        </NavItem>
        {!isConnected && (
          <div className="ml-auto flex items-center gap-1">
            <Wallet size={13} style={{ color: 'var(--subtle)' }} />
          </div>
        )}
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <footer className="text-center py-6 text-xs" style={{ color: 'var(--subtle)' }}>
        Crew — Treasury for AI Companies &middot; {CREW_CONFIG.chainName}
      </footer>
    </div>
  )
}

function NavItem({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
      style={{
        color: active ? 'var(--ink)' : 'var(--subtle)',
        background: active ? 'var(--surface-strong)' : 'transparent',
      }}
    >
      {children}
    </Link>
  )
}
