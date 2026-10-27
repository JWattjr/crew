/** Animated SVG donut showing the revenue split */
import { motion } from 'framer-motion'

interface Slice { label: string; pct: number; color: string }

interface Props {
  payrollPct: number
  recipients: { label: string; pct: number }[]
  size?: number
}

const PALETTE = ['var(--founder)', 'var(--tax)', 'var(--accent)', 'var(--success)', '#c084fc', '#fb923c']

export default function SplitDonut({ payrollPct, recipients, size = 160 }: Props) {
  const r = size / 2
  const radius = r * 0.7
  const cx = r
  const cy = r
  const stroke = radius * 0.45
  const circumference = 2 * Math.PI * radius

  const slices: Slice[] = [
    ...recipients.map((rec, i) => ({
      label: rec.label,
      pct: rec.pct,
      color: PALETTE[i % PALETTE.length],
    })),
  ]
  if (payrollPct > 0) {
    slices.push({ label: 'Payroll', pct: payrollPct, color: 'var(--payroll)' })
  }

  // Compute dash offsets
  let cumulative = 0
  const arcs = slices.map((s) => {
    const dashOffset = circumference - (circumference * s.pct) / 100
    const rotation = (cumulative / 100) * 360 - 90
    cumulative += s.pct
    return { ...s, dashOffset, rotation }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((arc, i) => (
          <motion.circle
            key={arc.label + i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: arc.dashOffset }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              transform: `rotate(${arc.rotation}deg)`,
              strokeLinecap: 'butt',
            }}
          />
        ))}
        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={12} fill="var(--subtle)" fontFamily="DM Sans, sans-serif">split</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="var(--muted)" fontFamily="DM Sans, sans-serif">
          {slices.length} ways
        </text>
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: arc.color }} />
            {arc.label}
            <span className="tabular font-semibold" style={{ color: 'var(--ink)' }}>{arc.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
