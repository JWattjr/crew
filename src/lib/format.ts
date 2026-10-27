import { USDC_DECIMALS } from '@/crew-config'

/** Format a raw uint256 USDC amount (6 dec) to a display string like "123.45" */
export function formatUsdc(raw: bigint, decimals = 2): string {
  const divisor = 10n ** BigInt(USDC_DECIMALS)
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').slice(0, decimals)
  return `${whole.toString()}.${fracStr}`
}

/** Parse a display string like "123.45" to raw bigint */
export function parseUsdc(display: string): bigint {
  const [whole, frac = ''] = display.split('.')
  const fracPadded = frac.padEnd(USDC_DECIMALS, '0').slice(0, USDC_DECIMALS)
  return BigInt(whole || '0') * 10n ** BigInt(USDC_DECIMALS) + BigInt(fracPadded || '0')
}

export function shortenAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function formatDays(seconds: bigint): string {
  if (seconds >= BigInt(Number.MAX_SAFE_INTEGER)) return '∞'
  const n = Number(seconds)
  const days = Math.floor(n / 86400)
  if (days >= 365) return `${Math.floor(days / 365)}y`
  if (days >= 30) return `${Math.floor(days / 30)}mo`
  if (days >= 1) return `${days}d`
  const hrs = Math.floor(n / 3600)
  if (hrs >= 1) return `${hrs}h`
  return `${Math.floor(n / 60)}m`
}

/** Compute live accrued amount from member state, per-second */
export function liveAccrued(
  weeklyRateRaw: bigint,
  lastAccrualTs: number,    // unix seconds
  owedRaw: bigint,
  remainderRaw: bigint,
  nowTs: number             // unix seconds
): bigint {
  const ONE_WEEK = 604800n
  const elapsed = BigInt(Math.max(0, nowTs - lastAccrualTs))
  const rateSeconds = weeklyRateRaw * elapsed + remainderRaw
  const accrued = rateSeconds / ONE_WEEK
  return owedRaw + accrued
}
