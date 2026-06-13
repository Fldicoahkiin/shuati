interface Props {
  percentage: number
  size?: number
}

function color(pct: number): string {
  if (pct >= 80) return 'var(--color-ok)'
  if (pct >= 60) return 'var(--color-warn)'
  return 'var(--color-bad)'
}

export function ScoreRing({ percentage, size = 148 }: Props) {
  const r = size / 2 - 9
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, Math.max(0, percentage)) / 100)
  const stroke = color(percentage)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-card-2)"
          strokeWidth={9}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-light" style={{ color: stroke }}>
          {percentage}
        </span>
        <span className="text-xs text-ink-soft">分</span>
      </div>
    </div>
  )
}
