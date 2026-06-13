import { useMemo, useState } from 'react'
import { Play, BookOpen, PencilLine } from 'lucide-react'
import type { ExamConfig, ExamRecord, QuestionType } from '@/types'
import { actions, useStore, activeBank } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Button, Card, EmptyState, Segmented, Toggle, cn } from '@/components/ui'
import { ExamRunner } from '@/components/ExamRunner'

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'single', label: '单选题' },
  { value: 'multi', label: '多选题' },
  { value: 'tf', label: '判断题' },
]

export function ExamView({ onResult }: { onResult: (r: ExamRecord) => void }) {
  const session = useStore((s) => s.session)
  const bank = useStore(activeBank)

  if (session) return <ExamRunner key={session.id} session={session} onResult={onResult} />

  return <ExamConfigForm hasBank={!!bank && bank.questions.length > 0} bankQuestions={bank?.questions ?? []} />
}

function ExamConfigForm({
  hasBank,
  bankQuestions,
}: {
  hasBank: boolean
  bankQuestions: { type: QuestionType }[]
}) {
  const [mode, setMode] = useState<'practice' | 'exam'>('practice')
  const [types, setTypes] = useState<QuestionType[]>(['single', 'multi', 'tf'])
  const [count, setCount] = useState(20)
  const [layout, setLayout] = useState<'paged' | 'scroll'>('paged')
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(false)

  const available = useMemo(
    () => bankQuestions.filter((q) => types.includes(q.type)).length,
    [bankQuestions, types],
  )

  if (!hasBank) {
    return (
      <Card>
        <EmptyState
          icon={<BookOpen size={40} strokeWidth={1.5} />}
          title="先导入一个题库"
          hint="到「题库」页粘贴或上传题目，再回来组卷练习。"
        />
      </Card>
    )
  }

  function toggleType(t: QuestionType) {
    setTypes((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
  }

  function start() {
    if (types.length === 0) return toast('至少选择一种题型', 'bad')
    const config: ExamConfig = {
      count: Math.max(1, Math.min(count, available)),
      types,
      mode,
      layout,
      shuffleQuestions,
      shuffleOptions,
    }
    const s = actions.startSession(config)
    if (!s) toast('没有符合条件的题目', 'bad')
  }

  return (
    <Card className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-ink-strong">组卷设置</h2>
        <p className="text-sm text-ink-soft">题库共 {bankQuestions.length} 题，当前可抽 {available} 题</p>
      </div>

      <Field label="模式">
        <Segmented<'practice' | 'exam'>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'practice', label: <span className="flex items-center gap-1.5"><BookOpen size={14} />练习 · 即时对错</span> },
            { value: 'exam', label: <span className="flex items-center gap-1.5"><PencilLine size={14} />考试 · 交卷判分</span> },
          ]}
        />
      </Field>

      <Field label="题型">
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((t) => {
            const on = types.includes(t.value)
            return (
              <button
                key={t.value}
                onClick={() => toggleType(t.value)}
                className={cn(
                  'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                  on
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-line bg-card-2 text-ink-soft hover:text-ink',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="题量">
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={Math.max(1, available)}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            className="w-28 rounded-lg border border-line bg-card-2 px-3 py-2 text-sm text-ink-strong outline-none focus:border-brand"
          />
          <button
            onClick={() => setCount(available)}
            className="text-xs text-brand hover:underline"
          >
            全部 {available} 题
          </button>
        </div>
      </Field>

      <Field label="布局">
        <Segmented<'paged' | 'scroll'>
          value={layout}
          onChange={setLayout}
          options={[
            { value: 'paged', label: '逐题翻页' },
            { value: 'scroll', label: '整卷滚动' },
          ]}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <Toggle checked={shuffleQuestions} onChange={setShuffleQuestions} label="打乱题目顺序" />
        <Toggle checked={shuffleOptions} onChange={setShuffleOptions} label="打乱选项顺序" />
      </div>

      <Button variant="primary" size="md" icon={<Play size={16} />} onClick={start} className="self-start">
        开始{mode === 'practice' ? '练习' : '考试'}
      </Button>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-ink-soft">{label}</span>
      {children}
    </div>
  )
}
