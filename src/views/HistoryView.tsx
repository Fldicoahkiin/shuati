import { useMemo } from 'react'
import { ChevronRight, History } from 'lucide-react'
import type { ExamRecord } from '@/types'
import { actions, useStore } from '@/lib/store'
import { Button, Card, EmptyState, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'

function fmtDate(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function badgeTone(pct: number): string {
  if (pct >= 80) return 'bg-ok-soft text-ok'
  if (pct >= 60) return 'bg-warn-soft text-warn'
  return 'bg-bad-soft text-bad'
}

export function HistoryView({ onReview }: { onReview: (r: ExamRecord) => void }) {
  const history = useStore((s) => s.history)

  const stats = useMemo(() => {
    if (history.length === 0) return null
    const avg = Math.round(history.reduce((a, r) => a + r.percentage, 0) / history.length)
    const best = Math.max(...history.map((r) => r.percentage))
    const trend = [...history].slice(0, 12).reverse()
    return { avg, best, trend, count: history.length }
  }, [history])

  if (!stats) {
    return (
      <Card>
        <EmptyState
          icon={<History size={40} strokeWidth={1.5} />}
          title="还没有练习记录"
          hint="完成一次练习或考试后，成绩会记录在这里。"
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="累计次数" value={String(stats.count)} />
          <Stat label="平均分" value={String(stats.avg)} />
          <Stat label="最高分" value={String(stats.best)} />
        </div>
        <div className="mt-5 flex h-20 items-end gap-1.5">
          {stats.trend.map((r) => (
            <div key={r.id} className="group flex flex-1 flex-col items-center gap-1">
              <div
                className={cn('w-full rounded-t', r.percentage >= 60 ? 'bg-brand/70' : 'bg-bad/70')}
                style={{ height: `${Math.max(6, r.percentage)}%` }}
                title={`${r.percentage} 分`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-ink-soft">最近 {stats.trend.length} 次得分趋势</p>
      </Card>

      <Card>
        <SectionTitle
          title="历史记录"
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm('清空全部历史记录？')) actions.clearHistory()
              }}
            >
              清空
            </Button>
          }
        />
        <ul className="flex flex-col gap-2">
          {history.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onReview(r)}
                className="flex w-full items-center gap-3.5 rounded-xl border border-line bg-card-2 p-3 text-left transition-colors hover:border-line-strong"
              >
                <span
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold',
                    badgeTone(r.percentage),
                  )}
                >
                  {r.percentage}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-strong">{fmtDate(r.date)}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {r.bankName} · {r.mode === 'practice' ? '练习' : '考试'} · {r.score}/{r.total} 正确 · {Math.floor(r.durationSec / 60)}:{String(r.durationSec % 60).padStart(2, '0')}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-ink-soft" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card-2 px-2 py-3 text-center">
      <div className="font-mono text-xl font-semibold text-ink-strong">{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-soft">{label}</div>
    </div>
  )
}
