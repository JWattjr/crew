import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAccount, useReadContract, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi'
import { erc20Abi, isAddress } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Copy, ExternalLink, Share2, Plus, Trash2, Pencil, DollarSign } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { CREW_ABI } from '@/crew-abi'
import { CREW_CONFIG, USDC_ADDRESS } from '@/crew-config'
import { Card, Btn, Input, fadeUp, Spinner, Stat, Badge } from '@/components/ui'
import SplitDonut from '@/components/SplitDonut'
import { formatUsdc, parseUsdc, shortenAddr, formatDays } from '@/lib/format'
import { parseOnchainError } from '@/lib/errors'
import { buildShareLink } from '@/lib/share'

const EXPLORER = CREW_CONFIG.explorerBase
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

// ─── Salary ticker ─────────────────────────────────────────────────────────────
// Correct formula (mirrors the contract's getMembers / totalAccruedNow):
//   displayed = owed + accruedNow + weeklyRate * (now - snapshotMs) / ONE_WEEK
//
// snapshotMs is the JS timestamp at which getMembers returned — NOT component-mount
// time — so the ticker extends the on-chain snapshot forward in real time without
// double-counting it.  On every refetch, snapshotMs advances to the new result
// timestamp, accruedNow is updated, and the interval resets cleanly.

interface MemberSnapshot {
  wallet:     `0x${string}`
  label:      string
  weeklyRate: bigint
  owed:       bigint
  accruedNow: bigint
  active:     boolean
  snapshotMs: number   // JS Date.now() when this result was received
}

interface MemberRowProps {
  member:      MemberSnapshot
  crewAddress: `0x${string}`
  isOwner:     boolean
  onRefresh:   () => void | Promise<void>
}

function MemberRow({ member, crewAddress, isOwner, onRefresh }: MemberRowProps) {
  const [displayed, setDisplayed] = useState(member.owed + member.accruedNow)

  // Recompute live from the latest snapshot.  useRef avoids stale-closure reads
  // inside the interval without triggering a new interval on every render.
  const snapRef = useRef(member)
  useEffect(() => { snapRef.current = member }, [member])

  useEffect(() => {
    // Inactive members or rate-0 members never tick — just show owed.
    if (!member.active || member.weeklyRate === 0n) {
      setDisplayed(member.owed + member.accruedNow)
      return
    }

    // Tick every second, applying the same formula as the contract.
    const id = setInterval(() => {
      const s     = snapRef.current
      const elMs  = Date.now() - s.snapshotMs
      const extra = (s.weeklyRate * BigInt(Math.floor(elMs))) / BigInt(ONE_WEEK_MS)
      setDisplayed(s.owed + s.accruedNow + extra)
    }, 1000)

    return () => clearInterval(id)
    // Only restart when the member identity changes (new snapshot resets automatically
    // because snapRef is updated above without triggering this effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.wallet])

  const publicClient = usePublicClient({ chainId: CREW_CONFIG.chainId })
  const { writeContractAsync } = useWriteContract()
  const [claiming, setClaiming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newRate, setNewRate] = useState(formatUsdc(member.weeklyRate))

  async function waitFor(hash: `0x${string}`) {
    await publicClient?.waitForTransactionReceipt({ hash })
  }

  async function handleClaim() {
    setClaiming(true)
    try {
      const h = await writeContractAsync({ address: crewAddress, abi: CREW_ABI, functionName: 'claim', args: [member.wallet], chainId: CREW_CONFIG.chainId })
      await waitFor(h)
      toast.success(`Claimed for ${member.label || shortenAddr(member.wallet)}`)
      void onRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
    setClaiming(false)
  }

  async function handleSetRate() {
    try {
      const raw = parseUsdc(newRate)
      const h = await writeContractAsync({ address: crewAddress, abi: CREW_ABI, functionName: 'setRate', args: [member.wallet, raw], chainId: CREW_CONFIG.chainId })
      await waitFor(h)
      toast.success('Rate updated')
      setEditing(false)
      void onRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${member.label || shortenAddr(member.wallet)}? They can still claim earned salary.`)) return
    try {
      const h = await writeContractAsync({ address: crewAddress, abi: CREW_ABI, functionName: 'removeMember', args: [member.wallet], chainId: CREW_CONFIG.chainId })
      await waitFor(h)
      toast.success('Member removed')
      void onRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
  }

  return (
    <motion.tr layout className="border-b" style={{ borderColor: 'var(--border)' }}>
      <td className="py-3 pr-3">
        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{member.label || '—'}</p>
        <a href={`${EXPLORER}/address/${member.wallet}`} target="_blank" rel="noopener" className="text-xs mono flex items-center gap-1" style={{ color: 'var(--subtle)' }}>
          {shortenAddr(member.wallet)} <ExternalLink size={10} />
        </a>
      </td>
      <td className="py-3 pr-3 tabular text-sm" style={{ color: 'var(--muted)' }}>
        {editing ? (
          <div className="flex items-center gap-1">
            <input value={newRate} onChange={e => setNewRate(e.target.value)} className="w-24 rounded-lg px-2 py-1 text-sm" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
            <button onClick={() => { void handleSetRate() }} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--accent)', color: '#0d1b2f' }}>OK</button>
            <button onClick={() => setEditing(false)} className="text-xs" style={{ color: 'var(--subtle)' }}>✕</button>
          </div>
        ) : (
          <span>{formatUsdc(member.weeklyRate)} USDC/wk {isOwner && member.active && <button onClick={() => setEditing(true)} className="ml-1" style={{ color: 'var(--subtle)' }}><Pencil size={11} /></button>}</span>
        )}
      </td>
      <td className="py-3 pr-3 tabular text-sm font-medium" style={{ color: 'var(--payroll)' }}>
        {formatUsdc(displayed)} USDC
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="ghost" onClick={() => { void handleClaim() }} loading={claiming} disabled={displayed === 0n}>
            Claim
          </Btn>
          {isOwner && member.active && (
            <button onClick={() => { void handleRemove() }} style={{ color: 'var(--subtle)' }}><Trash2 size={13} /></button>
          )}
        </div>
      </td>
    </motion.tr>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export default function CrewDashboard() {
  const { address: crewAddr } = useParams<{ address: string }>()
  const { address: walletAddr, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = isConnected && chainId !== CREW_CONFIG.chainId
  const publicClient = usePublicClient({ chainId: CREW_CONFIG.chainId })
  const { writeContractAsync } = useWriteContract()

  const crew = (crewAddr ?? '') as `0x${string}`
  const isValidAddr = isAddress(crew)

  const [payUrl, setPayUrl] = useState('')
  const [crewShareUrl, setCrewShareUrl] = useState('')

  useEffect(() => {
    void buildShareLink(`/pay/${crew}`).then(setPayUrl)
    void buildShareLink(`/crew/${crew}`).then(setCrewShareUrl)
  }, [crew])

  // Contract reads — refetch every 30 s
  const opts = { address: crew, abi: CREW_ABI, chainId: CREW_CONFIG.chainId } as const
  const refetchInterval = 30_000
  const { data: crewName } = useReadContract({ ...opts, functionName: 'name' })
  const { data: owner } = useReadContract({ ...opts, functionName: 'owner' })
  const { data: payrollPool, refetch: refetchPool } = useReadContract({ ...opts, functionName: 'payrollPool', query: { refetchInterval } })
  const { data: weeklyBurn } = useReadContract({ ...opts, functionName: 'weeklyBurn', query: { refetchInterval } })
  const { data: runway } = useReadContract({ ...opts, functionName: 'runwaySeconds', query: { refetchInterval } })
  const { data: undist, refetch: refetchUndist } = useReadContract({ ...opts, functionName: 'undistributed', query: { refetchInterval } })
  const { data: splitData } = useReadContract({ ...opts, functionName: 'getSplit' })

  // getMembers — dataUpdatedAt (ms) is wagmi's timestamp of when this result
  // was last fetched successfully. We use it directly as the snapshot time so
  // MemberRow can extend the on-chain accruedNow value forward without needing
  // any setState inside a useEffect.
  const { data: membersRaw, dataUpdatedAt: membersUpdatedAt, refetch: refetchMembersRaw } = useReadContract({
    ...opts,
    functionName: 'getMembers',
    query: { refetchInterval },
  })

  // Derived during render — no state, no effect.
  const members: MemberSnapshot[] = membersRaw
    ? (membersRaw as Array<{ wallet: `0x${string}`; label: string; weeklyRate: bigint; owed: bigint; accruedNow: bigint; active: boolean }>)
        .map(m => ({ ...m, snapshotMs: membersUpdatedAt }))
    : []

  const isOwner = !!(walletAddr && owner && walletAddr.toLowerCase() === (owner as string).toLowerCase())

  async function waitFor(hash: `0x${string}`) {
    await publicClient?.waitForTransactionReceipt({ hash })
  }

  async function handleRefresh() {
    await Promise.all([refetchPool(), refetchUndist(), refetchMembersRaw()])
  }

  // Distribute
  const [distributing, setDistributing] = useState(false)
  async function handleDistribute() {
    if (wrongChain) { switchChain({ chainId: CREW_CONFIG.chainId }); return }
    setDistributing(true)
    try {
      const h = await writeContractAsync({ address: crew, abi: CREW_ABI, functionName: 'distribute', chainId: CREW_CONFIG.chainId })
      await waitFor(h)
      toast.success('Revenue distributed')
      void handleRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
    setDistributing(false)
  }

  // Add member panel
  const [addOpen, setAddOpen] = useState(false)
  const [newMemberLabel, setNewMemberLabel] = useState('')
  const [newMemberWallet, setNewMemberWallet] = useState('')
  const [newMemberRate, setNewMemberRate] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  async function handleAddMember() {
    if (!isAddress(newMemberWallet)) { toast.error('Invalid wallet'); return }
    setAddingMember(true)
    try {
      const raw = parseUsdc(newMemberRate || '0')
      const h = await writeContractAsync({ address: crew, abi: CREW_ABI, functionName: 'addMember', args: [newMemberWallet, newMemberLabel, raw], chainId: CREW_CONFIG.chainId })
      await waitFor(h)
      toast.success('Member added')
      setNewMemberLabel(''); setNewMemberWallet(''); setNewMemberRate(''); setAddOpen(false)
      void handleRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
    setAddingMember(false)
  }

  // Fund payroll panel
  const [fundOpen, setFundOpen] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [funding, setFunding] = useState(false)
  async function handleFund() {
    setFunding(true)
    try {
      const raw = parseUsdc(fundAmount)
      const h1 = await writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [crew, raw], chainId: CREW_CONFIG.chainId })
      await waitFor(h1)
      const h2 = await writeContractAsync({ address: crew, abi: CREW_ABI, functionName: 'fundPayroll', args: [raw], chainId: CREW_CONFIG.chainId })
      await waitFor(h2)
      toast.success(`Funded payroll with ${fundAmount} USDC`)
      setFundAmount(''); setFundOpen(false)
      void handleRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
    setFunding(false)
  }

  // Withdraw unearned payroll panel
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawTo, setWithdrawTo] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  async function handleWithdraw() {
    if (!isAddress(withdrawTo)) { toast.error('Invalid address'); return }
    setWithdrawing(true)
    try {
      const raw = parseUsdc(withdrawAmount)
      const h = await writeContractAsync({ address: crew, abi: CREW_ABI, functionName: 'withdrawPayroll', args: [raw, withdrawTo], chainId: CREW_CONFIG.chainId })
      await waitFor(h)
      toast.success(`Withdrew ${withdrawAmount} USDC from payroll`)
      setWithdrawAmount(''); setWithdrawTo(''); setWithdrawOpen(false)
      void handleRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
    setWithdrawing(false)
  }

  // Set split panel
  const [splitOpen, setSplitOpen] = useState(false)
  const [newSplitInput, setNewSplitInput] = useState('')
  const [newSplitBpsInput, setNewSplitBpsInput] = useState('')
  const [newPayrollBpsInput, setNewPayrollBpsInput] = useState('')
  const [splitting, setSplitting] = useState(false)
  async function handleSetSplit() {
    setSplitting(true)
    try {
      const addrs = newSplitInput.split(',').map(s => s.trim()) as `0x${string}`[]
      const bpsArr = newSplitBpsInput.split(',').map(s => Number(s.trim()) * 100)
      const payBps = Number(newPayrollBpsInput.trim()) * 100
      const h = await writeContractAsync({ address: crew, abi: CREW_ABI, functionName: 'setSplit', args: [addrs, bpsArr, payBps], chainId: CREW_CONFIG.chainId })
      await waitFor(h)
      toast.success('Split updated')
      setSplitOpen(false)
      void handleRefresh()
    } catch (e) { toast.error(parseOnchainError(e)) }
    setSplitting(false)
  }

  if (!isValidAddr) {
    return <div className="text-center py-16" style={{ color: 'var(--subtle)' }}>Invalid crew address.</div>
  }

  const [splitRecips, splitBps, splitPayrollBps] = (splitData as [`0x${string}`[], number[], number] | undefined) ?? [[], [], 0]
  const recipientsForDonut = (splitRecips).map((r, i) => ({
    label: i === 0 ? 'Founder' : i === 1 ? 'Tax' : shortenAddr(r),
    pct: Math.round(Number((splitBps)[i]) / 100),
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--subtle)' }}>Crew</p>
          <h1 className="display text-3xl font-bold" style={{ color: 'var(--ink)' }}>{crewName ?? '…'}</h1>
          {isOwner && <Badge color="success">Owner</Badge>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="ghost" size="sm" onClick={() => { void navigator.clipboard.writeText(crew).then(() => toast.success('Address copied')) }}>
            <Copy size={13} /> Copy address
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => { void navigator.clipboard.writeText(payUrl || crew).then(() => toast.success('Pay link copied')) }}>
            <Share2 size={13} /> Share pay link
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => { void navigator.clipboard.writeText(crewShareUrl || crew).then(() => toast.success('Crew link copied')) }}>
            <Copy size={13} /> Copy link
          </Btn>
          <a href={`${EXPLORER}/address/${crew}`} target="_blank" rel="noopener">
            <Btn variant="ghost" size="sm"><ExternalLink size={13} /> Explorer</Btn>
          </a>
        </div>
      </motion.div>

      {/* Revenue address + QR */}
      <motion.div {...fadeUp} transition={{ delay: 0.06 }}>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>Revenue address</p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="mono text-sm break-all font-medium" style={{ color: 'var(--ink)' }}>{crew}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>Send USDC here or use the pay link — both trigger automatic splitting.</p>
            </div>
            {payUrl && (
              <div className="shrink-0 rounded-xl overflow-hidden p-2" style={{ background: 'white' }}>
                <QRCodeSVG value={payUrl} size={80} level="M" />
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Stats row */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <Stat
            label="Undistributed"
            value={undist !== undefined ? `$${formatUsdc(undist)}` : '…'}
            sub="USDC ready to split"
          />
          {undist !== undefined && (undist) > 0n && (
            <Btn size="sm" className="mt-3" onClick={() => { void handleDistribute() }} loading={distributing}>
              Distribute
            </Btn>
          )}
        </Card>
        <Card>
          <Stat
            label="Payroll pool"
            value={payrollPool !== undefined ? `$${formatUsdc(payrollPool)}` : '…'}
            sub="USDC reserved for salaries"
          />
        </Card>
        <Card>
          <Stat
            label="Weekly burn"
            value={weeklyBurn !== undefined ? `$${formatUsdc(weeklyBurn)}` : '…'}
            sub="Total salary per week"
          />
        </Card>
        <Card>
          <Stat
            label="Runway"
            value={runway !== undefined ? formatDays(runway) : '…'}
            sub="At current weekly burn"
          />
        </Card>
      </motion.div>

      {/* Split + Members */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Donut */}
        <motion.div {...fadeUp} transition={{ delay: 0.14 }}>
          <Card className="h-full flex flex-col items-center justify-center">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4 self-start" style={{ color: 'var(--subtle)' }}>Revenue split</p>
            {splitData ? (
              <SplitDonut
                payrollPct={Math.round(Number(splitPayrollBps) / 100)}
                recipients={recipientsForDonut}
              />
            ) : <Spinner />}
          </Card>
        </motion.div>

        {/* Members table */}
        <motion.div {...fadeUp} transition={{ delay: 0.16 }}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Members</p>
              {isOwner && (
                <button onClick={() => setAddOpen(!addOpen)} className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  <Plus size={12} /> Add member
                </button>
              )}
            </div>
            {/* Add member form */}
            <AnimatePresence>
              {addOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex flex-col gap-2 pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                    <Input label="Label" value={newMemberLabel} onChange={e => setNewMemberLabel(e.target.value)} placeholder="Research agent" />
                    <Input label="Wallet" value={newMemberWallet} onChange={e => setNewMemberWallet(e.target.value)} placeholder="0x…" />
                    <Input label="Weekly rate (USDC)" type="number" value={newMemberRate} onChange={e => setNewMemberRate(e.target.value)} placeholder="100" />
                    <Btn size="sm" onClick={() => { void handleAddMember() }} loading={addingMember}>Add</Btn>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Table */}
            {members.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
                      <th className="text-left pb-2">Member</th>
                      <th className="text-left pb-2">Rate</th>
                      <th className="text-left pb-2">Earned</th>
                      <th className="text-left pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <MemberRow key={m.wallet} member={m} crewAddress={crew} isOwner={isOwner} onRefresh={handleRefresh} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-center py-4" style={{ color: 'var(--subtle)' }}>No members yet.</p>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Owner controls */}
      {isOwner && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--subtle)' }}>Owner controls</p>
            <div className="flex flex-wrap gap-2">
              <Btn variant="ghost" size="sm" onClick={() => { setFundOpen(!fundOpen); setWithdrawOpen(false); setSplitOpen(false) }}>
                <DollarSign size={13} /> Fund payroll
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => { setWithdrawOpen(!withdrawOpen); setFundOpen(false); setSplitOpen(false) }}>
                <DollarSign size={13} /> Withdraw payroll
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => { setSplitOpen(!splitOpen); setFundOpen(false); setWithdrawOpen(false) }}>
                <Pencil size={13} /> Change split
              </Btn>
            </div>

            {/* Fund payroll */}
            <AnimatePresence>
              {fundOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-4">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1"><Input label="Amount (USDC)" type="number" value={fundAmount} onChange={e => setFundAmount(e.target.value)} placeholder="500" /></div>
                    <Btn size="sm" onClick={() => { void handleFund() }} loading={funding}>Fund</Btn>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Withdraw unearned payroll */}
            <AnimatePresence>
              {withdrawOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-4">
                  <p className="text-xs mb-2" style={{ color: 'var(--subtle)' }}>Only unearned payroll (pool minus total accrued now) can be withdrawn.</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1"><Input label="Amount (USDC)" type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="100" /></div>
                    </div>
                    <Input label="Recipient address" value={withdrawTo} onChange={e => setWithdrawTo(e.target.value)} placeholder="0x…" />
                    <Btn size="sm" onClick={() => { void handleWithdraw() }} loading={withdrawing} variant="danger">Withdraw</Btn>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Change split */}
            <AnimatePresence>
              {splitOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-4">
                  <p className="text-xs mb-3" style={{ color: 'var(--subtle)' }}>Enter comma-separated values. Percentages ×100 = basis points (50% = 5000 bps). Total must equal 100%.</p>
                  <div className="flex flex-col gap-2">
                    <Input label="Recipient addresses (comma-separated)" value={newSplitInput} onChange={e => setNewSplitInput(e.target.value)} placeholder="0xFounder,0xTax" />
                    <Input label="Recipient percentages (comma-separated, must sum with payroll to 100)" value={newSplitBpsInput} onChange={e => setNewSplitBpsInput(e.target.value)} placeholder="50,20" />
                    <Input label="Payroll %" value={newPayrollBpsInput} onChange={e => setNewPayrollBpsInput(e.target.value)} placeholder="30" />
                    <Btn size="sm" onClick={() => { void handleSetSplit() }} loading={splitting}>Update split</Btn>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
