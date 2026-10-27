import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { ArrowRight, Zap, Users, TrendingUp } from 'lucide-react'
import { CREW_FACTORY_ABI } from '@/crew-abi'
import { CREW_CONFIG } from '@/crew-config'

import { Card, fadeUp, Btn } from '@/components/ui'

export default function Home() {
  const { data: crewCount } = useReadContract({
    address: CREW_CONFIG.factoryAddress,
    abi: CREW_FACTORY_ABI,
    functionName: 'crewCount',
    chainId: CREW_CONFIG.chainId,
  })

  const steps = [
    {
      icon: <TrendingUp size={22} style={{ color: 'var(--accent)' }} />,
      title: 'Revenue lands at your crew address',
      desc: 'Every invoice, subscription, or API call goes to one deterministic onchain address — your crew.',
    },
    {
      icon: <Zap size={22} style={{ color: 'var(--payroll)' }} />,
      title: 'It splits instantly on arrival',
      desc: 'To-founder, to-tax-reserve, and to-payroll — automatically, in one transaction, with rounding handled.',
    },
    {
      icon: <Users size={22} style={{ color: 'var(--success)' }} />,
      title: 'Agents are paid by the second',
      desc: 'Every member accrues salary continuously. Anyone can claim at any time — it always pays the member.',
    },
  ]

  return (
    <div className="flex flex-col items-center gap-16">
      {/* Hero */}
      <motion.section
        className="text-center pt-12 pb-4 max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--subtle)' }}>
          Treasury for one-person companies
        </p>
        <h1 className="display text-5xl sm:text-6xl font-bold mb-5" style={{ color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1.05 }}>
          Revenue in,<br />crew paid.
        </h1>
        <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--muted)', maxWidth: '48ch', margin: '0 auto 2rem' }}>
          Your AI agents work. Crew handles the money — splitting revenue and streaming salaries onchain, automatically.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/new">
            <Btn size="md">
              Start a crew
              <ArrowRight size={15} />
            </Btn>
          </Link>
          <Link to="/crews">
            <Btn variant="ghost" size="md">My crews</Btn>
          </Link>
        </div>

        {/* Live stat */}
        {crewCount !== undefined && crewCount > 0n && (
          <motion.p {...fadeUp} className="mt-6 text-sm" style={{ color: 'var(--subtle)' }}>
            {crewCount.toString()} crew{crewCount === 1n ? '' : 's'} active on {CREW_CONFIG.chainName}
          </motion.p>
        )}
      </motion.section>

      {/* 3-step visual */}
      <section className="w-full max-w-4xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.08 }}
            >
              <Card hover className="h-full flex flex-col gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-strong)' }}>
                  {step.icon}
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold tabular mt-0.5 w-4 shrink-0" style={{ color: 'var(--subtle)' }}>0{i + 1}</span>
                  <div>
                    <p className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)' }}>{step.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{step.desc}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="w-full max-w-4xl">
        <h2 className="display text-2xl font-bold mb-6" style={{ color: 'var(--ink)' }}>Everything a one-person company needs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: 'Flexible splits', desc: 'Configure any mix of founder, tax reserve, and extra recipients up to 10 addresses with basis-point precision.' },
            { title: 'Per-second payroll', desc: 'Members accrue salary every second with remainder-preserving math. No truncation grief from early claims.' },
            { title: 'Public pay links', desc: 'Share /pay/0x… as an invoice URL. Payers see exactly where their money goes after submission.' },
            { title: 'Emergency controls', desc: 'Change your split even if a recipient is blocklisted — the emergency path skips blocked transfers.' },
            { title: 'No admin key', desc: 'No upgrade proxy, no backdoor. Once deployed, the contract enforces exactly what the owner configured.' },
            { title: 'Mainnet ready', desc: 'The same bytecode runs on Arc Mainnet. Switch VITE_CREW_CHAIN=arc-mainnet and VITE_CREW_FACTORY.' },
          ].map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
              <Card>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)' }}>{f.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="text-center pb-8">
        <p className="text-sm mb-4" style={{ color: 'var(--subtle)' }}>Ready to put your revenue on autopilot?</p>
        <Link to="/new">
          <Btn>
            Create your crew
            <ArrowRight size={15} />
          </Btn>
        </Link>
      </section>
    </div>
  )
}
