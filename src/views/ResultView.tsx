import { useMemo, useState } from 'react'
import { RotateCcw, Repeat } from 'lucide-react'
import type { ExamConfig, ExamRecord } from '@/types'
import { isCorrect } from '@/lib/grade'
import { actions } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Button, Card, Toggle } from '@/components/ui'
import { ScoreRing } from '@/components/ScoreRing'
import { QuestionCard } from '@/components/QuestionCard'

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

const REDO_CONFIG: ExamConfig = {
  count: 0,
  types: ['single', 'multi', 'tf'],
  mode: 'practice',
  layout: 'paged',
  shuffleQuestions: false,
  shuffleOptions: false,
}

export function ResultView({ record, onRetake }: { record: ExamRecord; onRetake: () => void }) {
  const [onlyWrong, setOnlyWrong] = useState(false)
  const correctness = useMemo(
    () => record.questions.map((q, i) => isCorrect(q, record.answers[i])),
    [record],
  )
  const wrongCount = correctness.filter((c) => !c).length

  function redoWrong() {
    const qs = record.questions.filter((_, i) => !correctness[i])
    if (qs.length === 0) return toast('全部答对，没有错题', 'ok')
    actions.startQuestions(qs, { ...REDO_CONFIG, count: qs.length })
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col items-center gap-5">
        <ScoreRing percentage={record.percentage} />
        <div className="grid w-full grid-cols-4 gap-3">
          <Stat label="正确" value={String(record.score)} tone="text-ok" />
          <Stat label="错误" value={String(record.total - record.score)} tone="text-bad" />
          <Stat label="用时" value={mmss(record.durationSec)} />
          <Stat label="总题数" value={String(record.total)} />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {wrongCount > 0 && (
            <Button variant="primary" icon={<Repeat size={15} />} onClick={redoWrong}>
              只做错题（{wrongCount}）
            </Button>
          )}
          <Button icon={<RotateCcw size={15} />} onClick={onRetake}>
            重新组卷
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-strong">答题详情</h2>
          <Toggle checked={onlyWrong} onChange={setOnlyWrong} label="只看错题" />
        </div>
        <div className="flex flex-col gap-4">
          {record.questions.map((q, i) =>
            onlyWrong && correctness[i] ? null : (
              <QuestionCard key={q.id + i} question={q} index={i} value={record.answers[i]} reveal />
            ),
          )}
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-card-2 px-2 py-3 text-center">
      <div className={`font-mono text-xl font-semibold ${tone ?? 'text-ink-strong'}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-soft">{label}</div>
    </div>
  )
}
