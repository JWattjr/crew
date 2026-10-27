import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi'
import { parseEventLogs } from 'viem'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowRight, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { CREW_FACTORY_ABI, CREW_ABI } from '@/crew-abi'
import { CREW_CONFIG, USDC_DECIMALS } from '@/crew-config'
import { Card, Btn, Input, fadeUp, Spinner } from '@/components/ui'
import SplitDonut from '@/components/SplitDonut'
import { parseOnchainError } from '@/lib/errors'

interface Recipient { label: string; address: string; pct: string }
interface MemberRow { label: string; wallet: string; weeklyRate: string }

export default function NewCrew() {
  const navigate = useNavigate()
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = isConnected && chainId !== CREW_CONFIG.chainId

  // Form state
  const [crewName, setCrewName] = useState('')
  const [founderPct, setFounderPct] = useState('50')
  const [taxAddr, setTaxAddr] = useState('')
  const [taxPct, setTaxPct] = useState('20')
  const [extras, setExtras] = useState<Recipient[]>([])
  const [payrollPct, setPayrollPct] = useState('30')
  const [members, setMembers] = useState<MemberRow[]>([])

  // Tx state
  const [step, setStep] = useState<'form' | 'creating' | 'adding-members' | 'done'>('form')
  const [memberIdx, setMemberIdx] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: CREW_CONFIG.chainId })

  // Compute total
  const total = Number(founderPct || 0) + (taxAddr ? Number(taxPct || 0) : 0) +
    extras.reduce((s, e) => s + Number(e.pct || 0), 0) + Number(payrollPct || 0)

  function buildSplitArgs(): { recipients: `0x${string}`[]; bps: number[]; payrollBps: number } | null {
    const recips: `0x${string}`[] = []
    const bps: number[] = []

    const fPct = Math.round(Number(founderPct || 0) * 100)
    if (!address) return null
    recips.push(address)
    bps.push(fPct)

    if (taxAddr.trim()) {
      const tPct = Math.round(Number(taxPct || 0) * 100)
      recips.push(taxAddr.trim() as `0x${string}`)
      bps.push(tPct)
    }

    for (const e of extras) {
      if (e.address.trim()) {
        recips.push(e.address.trim() as `0x${string}`)
        bps.push(Math.round(Number(e.pct || 0) * 100))
      }
    }

    const payBps = Math.round(Number(payrollPct || 0) * 100)
    const sumBps = bps.reduce((a, b) => a + b, 0) + payBps
    if (sumBps !== 10000) return null

    return { recipients: recips, bps, payrollBps: payBps }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!crewName.trim()) errs.name = 'Name is required'
    if (!address) errs.wallet = 'Connect your wallet first'
    if (total !== 100) errs.total = `Split must total 100% (currently ${total}%)`
    if (taxAddr && !/^0x[0-9a-fA-F]{40}$/.test(taxAddr.trim())) errs.taxAddr = 'Invalid address'
    for (const e of extras) {
      if (e.address && !/^0x[0-9a-fA-F]{40}$/.test(e.address.trim()))
        errs[`extra-${e.label}`] = 'Invalid address'
    }
    for (const m of members) {
      if (m.wallet && !/^0x[0-9a-fA-F]{40}$/.test(m.wallet.trim()))
        errs[`mem-${m.label}`] = 'Invalid wallet'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleCreate() {
    if (wrongChain) { switchChain({ chainId: CREW_CONFIG.chainId }); return }
    if (!validate()) return
    const args = buildSplitArgs()
    if (!args) { toast.error('Invalid split'); return }

    setStep('creating')
    try {
      const hash = await writeContractAsync({
        address: CREW_CONFIG.factoryAddress,
        abi: CREW_FACTORY_ABI,
        functionName: 'createCrew',
        args: [crewName.trim(), args.recipients, args.bps.map(b => b as unknown as never), args.payrollBps as unknown as never],
        chainId: CREW_CONFIG.chainId,
      })
      // Wait for receipt and parse CrewCreated event to get the crew address
      const receipt = await publicClient!.waitForTransactionReceipt({ hash })
      const logs = parseEventLogs({ abi: CREW_FACTORY_ABI, eventName: 'CrewCreated', logs: receipt.logs })
      const crew = logs[0]?.args?.crew as `0x${string}` | undefined
      if (!crew) { toast.error('Could not find crew address'); setStep('form'); return }

      // Add members sequentially
      const validMembers = members.filter(m => m.label.trim() && m.wallet.trim())
      if (validMembers.length === 0) {
        setStep('done')
        setTimeout(() => { void navigate(`/crew/${crew}`) }, 1200)
        return
      }

      setStep('adding-members')
      for (let i = 0; i < validMembers.length; i++) {
        setMemberIdx(i)
        const m = validMembers[i]
        const weeklyRaw = BigInt(Math.round(Number(m.weeklyRate || '0') * 10 ** USDC_DECIMALS))
        const mhash = await writeContractAsync({
          address: crew,
          abi: CREW_ABI,
          functionName: 'addMember',
          args: [m.wallet.trim() as `0x${string}`, m.label.trim(), weeklyRaw],
          chainId: CREW_CONFIG.chainId,
        })
        await publicClient!.waitForTransactionReceipt({ hash: mhash })
      }

      setStep('done')
      setTimeout(() => { void navigate(`/crew/${crew}`) }, 1200)
    } catch (err) {
      toast.error(parseOnchainError(err))
      setStep('form')
    }
  }

  const recipientsForDonut = [
    { label: 'Founder', pct: Number(founderPct || 0) },
    ...(taxAddr ? [{ label: 'Tax reserve', pct: Number(taxPct || 0) }] : []),
    ...extras.map(e => ({ label: e.label || 'Recipient', pct: Number(e.pct || 0) })),
  ]

  if (step === 'done') {
    return (
      <div className="max-w-md mx-auto text-center pt-16">
        <motion.div {...fadeUp} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(141,216,159,0.15)' }}>
          <Check size={32} style={{ color: 'var(--success)' }} />
        </motion.div>
        <motion.h2 {...fadeUp} className="display text-3xl font-bold mb-2" style={{ color: 'var(--ink)' }}>Crew created!</motion.h2>
        <motion.p {...fadeUp} className="text-sm" style={{ color: 'var(--subtle)' }}>Taking you to your dashboard...</motion.p>
      </div>
    )
  }

  if (step === 'creating' || step === 'adding-members') {
    return (
      <div className="max-w-md mx-auto text-center pt-16">
        <Spinner size={36} />
        <p className="mt-4 font-semibold" style={{ color: 'var(--ink)' }}>
          {step === 'creating' ? 'Creating your crew...' : `Adding member ${memberIdx + 1} of ${members.filter(m => m.label && m.wallet).length}...`}
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--subtle)' }}>Confirm in your wallet</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div {...fadeUp}>
        <h1 className="display text-3xl font-bold mb-1" style={{ color: 'var(--ink)' }}>Create a crew</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--subtle)' }}>Configure your treasury split and add your first members.</p>

        <div className="flex flex-col gap-6">
          {/* Name */}
          <Card>
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--muted)' }}>CREW NAME</h2>
            <Input
              label="Name"
              value={crewName}
              onChange={e => setCrewName(e.target.value)}
              placeholder="Acme AI Labs"
              error={errors.name}
            />
          </Card>

          {/* Split editor */}
          <Card>
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--muted)' }}>REVENUE SPLIT</h2>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1 flex flex-col gap-4">
                {/* Founder */}
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label="Founder (you)"
                      type="number"
                      min={0} max={100} step={1}
                      value={founderPct}
                      onChange={e => setFounderPct(e.target.value)}
                      placeholder="50"
                    />
                  </div>
                  <span className="pb-2.5 text-sm" style={{ color: 'var(--subtle)' }}>%</span>
                </div>
                {/* Tax */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Input
                        label="Tax reserve %"
                        type="number" min={0} max={100} step={1}
                        value={taxPct}
                        onChange={e => setTaxPct(e.target.value)}
                        placeholder="20"
                      />
                    </div>
                    <span className="pb-2.5 text-sm" style={{ color: 'var(--subtle)' }}>%</span>
                  </div>
                  <Input
                    label="Tax reserve address"
                    value={taxAddr}
                    onChange={e => setTaxAddr(e.target.value)}
                    placeholder="0x…"
                    error={errors.taxAddr}
                    hint="Wallet that holds your tax reserve"
                  />
                </div>
                {/* Extras */}
                {extras.map((e, i) => (
                  <div key={i} className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-end gap-2">
                      <div className="flex-1"><Input label="Label" value={e.label} onChange={ev => { const n = [...extras]; n[i].label = ev.target.value; setExtras(n) }} placeholder="Partner" /></div>
                      <div className="w-20"><Input label="%" type="number" min={0} max={100} value={e.pct} onChange={ev => { const n = [...extras]; n[i].pct = ev.target.value; setExtras(n) }} /></div>
                      <button onClick={() => setExtras(extras.filter((_, j) => j !== i))} className="pb-2.5" style={{ color: 'var(--subtle)' }}><Trash2 size={14} /></button>
                    </div>
                    <Input label="Address" value={e.address} onChange={ev => { const n = [...extras]; n[i].address = ev.target.value; setExtras(n) }} placeholder="0x…" error={errors[`extra-${e.label}`]} />
                  </div>
                ))}
                {extras.length < 8 && (
                  <button onClick={() => setExtras([...extras, { label: '', address: '', pct: '0' }])} className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                    <Plus size={12} /> Add recipient
                  </button>
                )}
                {/* Payroll */}
                <div className="flex items-end gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex-1">
                    <Input label="Payroll pool %" type="number" min={0} max={100} step={1} value={payrollPct} onChange={e => setPayrollPct(e.target.value)} placeholder="30" />
                  </div>
                  <span className="pb-2.5 text-sm" style={{ color: 'var(--subtle)' }}>%</span>
                </div>
                {/* Total indicator */}
                <div className="flex items-center justify-between text-sm pt-1">
                  <span style={{ color: 'var(--subtle)' }}>Total</span>
                  <span className="font-bold tabular" style={{ color: total === 100 ? 'var(--success)' : 'var(--danger)' }}>{total}%</span>
                </div>
                {errors.total && <p className="text-xs" style={{ color: 'var(--danger)' }}>{errors.total}</p>}
              </div>
              {/* Donut */}
              <div className="flex items-start justify-center sm:pt-4">
                <SplitDonut payrollPct={Number(payrollPct || 0)} recipients={recipientsForDonut} />
              </div>
            </div>
          </Card>

          {/* Members */}
          <Card>
            <h2 className="font-semibold text-sm mb-1" style={{ color: 'var(--muted)' }}>MEMBERS (OPTIONAL)</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--subtle)' }}>Add AI agents or contractors. You can also do this later from the dashboard.</p>
            <div className="flex flex-col gap-4">
              {members.map((m, i) => (
                <div key={i} className="flex flex-col gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Member {i + 1}</span>
                    <button onClick={() => setMembers(members.filter((_, j) => j !== i))} style={{ color: 'var(--subtle)' }}><Trash2 size={13} /></button>
                  </div>
                  <Input label="Label (e.g. Research agent)" value={m.label} onChange={ev => { const n = [...members]; n[i].label = ev.target.value; setMembers(n) }} placeholder="Research agent" />
                  <Input label="Wallet" value={m.wallet} onChange={ev => { const n = [...members]; n[i].wallet = ev.target.value; setMembers(n) }} placeholder="0x…" error={errors[`mem-${m.label}`]} />
                  <Input label="Weekly rate (USDC)" type="number" min={0} step={0.01} value={m.weeklyRate} onChange={ev => { const n = [...members]; n[i].weeklyRate = ev.target.value; setMembers(n) }} placeholder="100" hint="Per week in USDC" />
                </div>
              ))}
              {members.length < 20 && (
                <button onClick={() => setMembers([...members, { label: '', wallet: '', weeklyRate: '' }])} className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--accent)' }}>
                  <Plus size={12} /> Add member
                </button>
              )}
            </div>
          </Card>

          {/* Submit */}
          {!isConnected ? (
            <div className="text-center py-4">
              <p className="text-sm mb-3" style={{ color: 'var(--subtle)' }}>Connect your wallet to create a crew</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Btn onClick={() => { void handleCreate() }} disabled={total !== 100}>
                {wrongChain ? `Switch to ${CREW_CONFIG.chainName}` : 'Create crew'}
                <ArrowRight size={15} />
              </Btn>
              {errors.wallet && <p className="text-xs" style={{ color: 'var(--danger)' }}>{errors.wallet}</p>}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
