import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAccount, useWriteContract, useSwitchChain, useReadContract, usePublicClient } from 'wagmi'
import { erc20Abi, isAddress, parseEventLogs } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowRight, Check, ExternalLink } from 'lucide-react'
import { CREW_ABI } from '@/crew-abi'
import { CREW_CONFIG, USDC_ADDRESS } from '@/crew-config'
import { Card, Btn, Input, fadeUp, Spinner } from '@/components/ui'
import { formatUsdc, parseUsdc, shortenAddr } from '@/lib/format'
import { parseOnchainError } from '@/lib/errors'

const EXPLORER = CREW_CONFIG.explorerBase

export default function PayPage() {
  const { address: crewAddr } = useParams<{ address: string }>()
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: CREW_CONFIG.chainId })

  const crew = (crewAddr ?? '') as `0x${string}`
  const isValidAddr = isAddress(crew)
  const wrongChain = isConnected && chainId !== CREW_CONFIG.chainId

  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [step, setStep] = useState<'form' | 'approving' | 'paying' | 'done'>('form')
  const [txHash, setTxHash] = useState<string>('')
  const [breakdown, setBreakdown] = useState<{ recipient: string; amount: bigint }[]>([])
  const [payrollToPayroll, setPayrollToPayroll] = useState(0n)

  const { data: crewName } = useReadContract({ address: crew, abi: CREW_ABI, functionName: 'name', chainId: CREW_CONFIG.chainId })
  const { data: splitData } = useReadContract({ address: crew, abi: CREW_ABI, functionName: 'getSplit', chainId: CREW_CONFIG.chainId })

  const [splitRecips, splitBps, splitPayrollBps] = (splitData as [`0x${string}`[], number[], number] | undefined) ?? [[], [], 0]

  const amountRaw = amount ? parseUsdc(amount) : 0n

  // Preview splits
  const previewSplits: { label: string; addr: string; amount: bigint }[] = []
  if (amountRaw > 0n && splitRecips.length > 0) {
    const payrollAmt = amountRaw * BigInt(splitPayrollBps) / 10000n
    const toSplit = amountRaw - payrollAmt
    let paid = 0n
    for (let i = 1; i < splitRecips.length; i++) {
      const a = toSplit * BigInt((splitBps)[i]) / 10000n
      paid += a
      previewSplits.push({ label: i === 1 ? 'Tax reserve' : shortenAddr(splitRecips[i]), addr: splitRecips[i], amount: a })
    }
    if (splitRecips.length > 0) {
      previewSplits.unshift({ label: 'Founder', addr: splitRecips[0], amount: toSplit - paid + (splitRecips.length === 1 ? 0n : 0n) })
    }
    if (payrollAmt > 0n) previewSplits.push({ label: 'Payroll pool', addr: '', amount: payrollAmt })
  }

  async function handlePay() {
    if (wrongChain) { switchChain({ chainId: CREW_CONFIG.chainId }); return }
    if (!amount || amountRaw === 0n) { toast.error('Enter an amount'); return }
    if (!isAddress(crew)) { toast.error('Invalid crew address'); return }

    setStep('approving')
    try {
      const h1 = await writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [crew, amountRaw], chainId: CREW_CONFIG.chainId })
      await publicClient!.waitForTransactionReceipt({ hash: h1 })

      setStep('paying')
      const h2 = await writeContractAsync({ address: crew, abi: CREW_ABI, functionName: 'pay', args: [amountRaw, memo], chainId: CREW_CONFIG.chainId })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: h2 })
      setTxHash(h2)

      // Parse Paid events from receipt to show actual breakdown
      const paidLogs = parseEventLogs({ abi: CREW_ABI, eventName: 'Paid', logs: receipt.logs })
      const dist = paidLogs.map(l => ({ recipient: l.args.recipient as string, amount: l.args.amount }))
      setBreakdown(dist)

      const distLogs = parseEventLogs({ abi: CREW_ABI, eventName: 'Distributed', logs: receipt.logs })
      if (distLogs[0]) setPayrollToPayroll(distLogs[0].args.toPayroll)

      setStep('done')
    } catch (e) {
      toast.error(parseOnchainError(e))
      setStep('form')
    }
  }

  if (!isValidAddr) {
    return <div className="text-center py-16" style={{ color: 'var(--subtle)' }}>Invalid crew address.</div>
  }

  return (
    <div className="max-w-lg mx-auto">
      <AnimatePresence mode="wait">
        {step === 'done' ? (
          <motion.div key="done" {...fadeUp} className="flex flex-col gap-6">
            <div className="text-center pt-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(141,216,159,0.15)' }}>
                <Check size={32} style={{ color: 'var(--success)' }} />
              </div>
              <h1 className="display text-3xl font-bold mb-1" style={{ color: 'var(--ink)' }}>Payment sent!</h1>
              <p className="text-sm mb-2" style={{ color: 'var(--subtle)' }}>{amount} USDC to {crewName ?? shortenAddr(crew)}</p>
              <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noopener" className="text-xs flex items-center justify-center gap-1" style={{ color: 'var(--accent)' }}>
                <ExternalLink size={11} /> View on explorer
              </a>
            </div>
            {/* Breakdown */}
            <Card>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--subtle)' }}>Where the money went</p>
              <div className="flex flex-col gap-3">
                {breakdown.map((b, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        {i === 0 ? 'Founder' : i === 1 && breakdown.length > 2 ? 'Tax reserve' : shortenAddr(b.recipient)}
                      </p>
                      <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>{shortenAddr(b.recipient)}</p>
                    </div>
                    <p className="tabular font-semibold" style={{ color: 'var(--accent)' }}>${formatUsdc(b.amount)}</p>
                  </motion.div>
                ))}
                {payrollToPayroll > 0n && (
                  <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: breakdown.length * 0.07 }} className="flex items-center justify-between">
                    <p className="text-sm font-medium" style={{ color: 'var(--payroll)' }}>Payroll pool</p>
                    <p className="tabular font-semibold" style={{ color: 'var(--payroll)' }}>${formatUsdc(payrollToPayroll)}</p>
                  </motion.div>
                )}
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="form" {...fadeUp} className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--subtle)' }}>Pay</p>
              <h1 className="display text-3xl font-bold" style={{ color: 'var(--ink)' }}>{crewName ?? shortenAddr(crew)}</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--subtle)' }}>USDC · {CREW_CONFIG.chainName}</p>
            </div>

            <Card>
              <div className="flex flex-col gap-4">
                <Input
                  label="Amount (USDC)"
                  type="number"
                  min={0}
                  step={0.01}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="10.00"
                />
                <Input
                  label="Memo (optional)"
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="Invoice #42"
                />
              </div>
            </Card>

            {/* Live preview */}
            <AnimatePresence>
              {previewSplits.length > 0 && amountRaw > 0n && (
                <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                  <Card>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>Where this goes</p>
                    <div className="flex flex-col gap-2">
                      {previewSplits.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span style={{ color: 'var(--muted)' }}>{s.label}</span>
                          <span className="tabular font-medium" style={{ color: 'var(--ink)' }}>${formatUsdc(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {step === 'approving' || step === 'paying' ? (
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                <Spinner size={18} />
                {step === 'approving' ? 'Approving USDC spend...' : 'Sending payment...'}
              </div>
            ) : (
              <Btn onClick={() => { void handlePay() }} disabled={!isConnected || !amount}>
                {!isConnected ? 'Connect wallet' : wrongChain ? `Switch to ${CREW_CONFIG.chainName}` : 'Pay'}
                <ArrowRight size={15} />
              </Btn>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
