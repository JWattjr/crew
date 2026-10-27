export function parseOnchainError(err: unknown): string {
  const msg = (err as { message?: string; shortMessage?: string })?.shortMessage
    ?? (err as { message?: string })?.message
    ?? String(err)
  const low = msg.toLowerCase()

  if (low.includes('user rejected') || low.includes('user denied') || (err as { code?: number })?.code === 4001)
    return 'Transaction cancelled.'
  if (low.includes('insufficient funds') || low.includes('exceeds balance'))
    return 'Insufficient USDC balance.'
  if (low.includes('notowner') || low.includes('not owner'))
    return 'Only the crew owner can do this.'
  if (low.includes('invalidspli') || low.includes('invalidspli'))
    return 'Split percentages must add up to 100%.'
  if (low.includes('salariesearned'))
    return 'Cannot withdraw — some payroll is already earned by members.'
  if (low.includes('memberalreadyexists'))
    return 'That wallet is already a member.'
  if (low.includes('membernotfound'))
    return 'Member not found.'
  if (low.includes('toomanyrecipients'))
    return 'Too many recipients (max 10).'
  if (low.includes('toomanymembers'))
    return 'Too many members (max 20).'
  if (low.includes('reverted'))
    return 'Transaction failed. Check your inputs and try again.'
  if (low.includes('network') || low.includes('timeout') || low.includes('fetch'))
    return 'Network error. Check your connection and retry.'
  return 'Something went wrong. Please try again.'
}
