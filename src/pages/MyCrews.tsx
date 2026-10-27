import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ConnectKitButton } from 'connectkit'
import { ArrowRight, Plus } from 'lucide-react'
import { CREW_FACTORY_ABI, CREW_ABI } from '@/crew-abi'
import { CREW_CONFIG } from '@/crew-config'
import { Card, Btn, fadeUp, Badge } from '@/components/ui'
import { formatUsdc, shortenAddr } from '@/lib/format'

function CrewCard({ crew, ownedByMe }: { crew: `0x${string}`; ownedByMe: boolean }) {
  const opts = { address: crew, abi: CREW_ABI, chainId: CREW_CONFIG.chainId } as const
  const { data: name } = useReadContract({ ...opts, functionName: 'name' })
  const { data: pool } = useReadContract({ ...opts, functionName: 'payrollPool' })
  const { data: burn } = useReadContract({ ...opts, functionName: 'weeklyBurn' })
  const { data: undist } = useReadContract({ ...opts, functionName: 'undistributed' })

  return (
    <Link to={`/crew/${crew}`}>
      <Card hover className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-base" style={{ color: 'var(--ink)' }}>{name ?? '…'}</p>
            <p className="mono text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{shortenAddr(crew)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {ownedByMe && <Badge color="success">Owner</Badge>}
            {!ownedByMe && <Badge color="default">Member</Badge>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Payroll pool</p>
            <p className="tabular text-sm font-semibold" style={{ color: 'var(--payroll)' }}>
              {pool !== undefined ? `$${formatUsdc(pool)}` : '…'}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Weekly burn</p>
            <p className="tabular text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {burn !== undefined ? `$${formatUsdc(burn)}` : '…'}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Undistributed</p>
            <p className="tabular text-sm font-semibold" style={{ color: undist && (undist) > 0n ? 'var(--accent)' : 'var(--subtle)' }}>
              {undist !== undefined ? `$${formatUsdc(undist)}` : '…'}
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            Open dashboard <ArrowRight size={11} />
          </span>
        </div>
      </Card>
    </Link>
  )
}

// Find all crews where wallet is a member by scanning factory's crews
function useMemberCrews(walletAddr: string | undefined) {
  const { data: count } = useReadContract({
    address: CREW_CONFIG.factoryAddress,
    abi: CREW_FACTORY_ABI,
    functionName: 'crewCount',
    chainId: CREW_CONFIG.chainId,
  })

  const n = count ? Number(count) : 0

  // Read all crew addresses
  const { data: allCrews } = useReadContracts({
    contracts: Array.from({ length: Math.min(n, 100) }, (_, i) => ({
      address: CREW_CONFIG.factoryAddress,
      abi: CREW_FACTORY_ABI,
      functionName: 'crewAt' as const,
      args: [BigInt(i)],
      chainId: CREW_CONFIG.chainId,
    })),
    query: { enabled: n > 0 },
  })

  // Read members of each crew
  const addresses = (allCrews ?? []).map(r => r.result).filter(Boolean) as `0x${string}`[]

  const { data: memberResults } = useReadContracts({
    contracts: addresses.map(a => ({
      address: a,
      abi: CREW_ABI,
      functionName: 'getMembers' as const,
      chainId: CREW_CONFIG.chainId,
    })),
    query: { enabled: addresses.length > 0 },
  })

  if (!walletAddr || !memberResults) return []

  const memberCrews: `0x${string}`[] = []
  const lw = walletAddr.toLowerCase()
  for (let i = 0; i < addresses.length; i++) {
    const members = memberResults[i]?.result as Array<{ wallet: string }> | undefined
    if (members?.some(m => m.wallet.toLowerCase() === lw)) {
      memberCrews.push(addresses[i])
    }
  }
  return memberCrews
}

export default function MyCrews() {
  const { address, isConnected } = useAccount()

  const { data: ownedRaw } = useReadContract({
    address: CREW_CONFIG.factoryAddress,
    abi: CREW_FACTORY_ABI,
    functionName: 'crewsOf',
    args: address ? [address] : undefined,
    chainId: CREW_CONFIG.chainId,
    query: { enabled: !!address },
  })

  const owned = (ownedRaw as `0x${string}`[] | undefined) ?? []
  const memberCrews = useMemberCrews(address)
  const ownedSet = new Set(owned.map(a => a.toLowerCase()))
  const memberOnly = memberCrews.filter(a => !ownedSet.has(a.toLowerCase()))

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto text-center pt-16 flex flex-col items-center gap-4">
        <p className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Connect your wallet to see your crews</p>
        <ConnectKitButton />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <motion.div {...fadeUp} className="flex items-center justify-between mb-6">
        <h1 className="display text-3xl font-bold" style={{ color: 'var(--ink)' }}>My Crews</h1>
        <Link to="/new"><Btn size="sm"><Plus size={13} /> New crew</Btn></Link>
      </motion.div>

      {owned.length === 0 && memberOnly.length === 0 ? (
        <motion.div {...fadeUp}>
          <Card className="text-center py-12">
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--ink)' }}>No crews yet</p>
            <p className="text-sm mb-6" style={{ color: 'var(--subtle)' }}>Create your first crew to start routing revenue automatically.</p>
            <Link to="/new"><Btn>Create a crew <ArrowRight size={14} /></Btn></Link>
          </Card>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-8">
          {owned.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>Crews you own</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {owned.map((c, i) => (
                  <motion.div key={c} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <CrewCard crew={c} ownedByMe />
                  </motion.div>
                ))}
              </div>
            </section>
          )}
          {memberOnly.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>Crews you're a member of</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {memberOnly.map((c, i) => (
                  <motion.div key={c} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <CrewCard crew={c} ownedByMe={false} />
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
