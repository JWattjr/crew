/** Shared primitive UI components */
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { CREW_CONFIG } from '@/crew-config'

export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] },
}

interface CardProps { children: React.ReactNode; className?: string; hover?: boolean; onClick?: () => void }
export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2, scale: 1.005 } : undefined}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onClick={onClick}
      className={clsx('rounded-2xl p-5', onClick && 'cursor-pointer', className)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {children}
    </motion.div>
  )
}

interface BtnProps {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
  size?: 'sm' | 'md'
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}
export function Btn({ variant = 'primary', loading, size = 'md', children, className, disabled, onClick, type = 'button' }: BtnProps) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#0d1b2f' },
    ghost: { background: 'var(--surface-strong)', color: 'var(--ink)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(232,109,122,0.15)', color: 'var(--danger)', border: '1px solid rgba(232,109,122,0.3)' },
  }
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-5 py-2.5 text-sm' }
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      className={clsx('rounded-xl font-semibold flex items-center gap-2 transition-opacity', sizes[size], disabled && 'opacity-50', className)}
      style={styles[variant]}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </motion.button>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: string; error?: string }
export function Input({ label, hint, error, className, ...rest }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{label}</label>}
      <input
        className={clsx('rounded-xl px-4 py-2.5 text-sm outline-none w-full', className)}
        style={{
          background: 'var(--surface-strong)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
          color: 'var(--ink)',
        }}
        {...rest}
      />
      {hint && !error && <p className="text-xs" style={{ color: 'var(--subtle)' }}>{hint}</p>}
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}

export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: 'var(--accent)' }} />
}

export function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: 'default' | 'success' | 'warn' | 'danger' }) {
  const colors = {
    default: { background: 'var(--surface-strong)', color: 'var(--muted)' },
    success: { background: 'rgba(141,216,159,0.12)', color: 'var(--success)' },
    warn: { background: 'rgba(240,192,96,0.12)', color: 'var(--payroll)' },
    danger: { background: 'rgba(232,109,122,0.12)', color: 'var(--danger)' },
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={colors[color]}>
      {children}
    </span>
  )
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>{label}</p>
      <p className="display text-2xl font-bold tabular" style={{ color: 'var(--ink)' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--subtle)' }}>{sub}</p>}
    </div>
  )
}

export function TxStatus({ isPending, isConfirming, isSuccess, error, hash }: {
  isPending: boolean; isConfirming: boolean; isSuccess: boolean
  error: Error | null; hash?: `0x${string}`
}) {
  if (!isPending && !isConfirming && !isSuccess && !error) return null
  const explorerBase = CREW_CONFIG.explorerBase
  return (
    <motion.div {...fadeUp} className="mt-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
      {isPending && <span style={{ color: 'var(--muted)' }}>Confirm in wallet...</span>}
      {isConfirming && <span style={{ color: 'var(--accent)' }}>Confirming on {CREW_CONFIG.chainName}...</span>}
      {isSuccess && (
        <span style={{ color: 'var(--success)' }}>
          Done!{' '}
          {hash && <a href={`${explorerBase}/tx/${hash}`} target="_blank" rel="noopener" className="underline" style={{ color: 'var(--accent)' }}>View tx</a>}
        </span>
      )}
      {error && <span style={{ color: 'var(--danger)' }}>{(error as { shortMessage?: string }).shortMessage ?? error.message}</span>}
    </motion.div>
  )
}
