import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Flag, Send, LogOut } from 'lucide-react'
import type { ExamRecord, ExamSession } from '@/types'
import { actions } from '@/lib/store'
import { Button } from './ui'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'

function mmss(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function answeredFlags(session: ExamSession): boolean[] {
  return session.answers.map((a) => a != null && a.length > 0)
}

export function ExamRunner({
  session,
  onResult,
}: {
  session: ExamSession
  onResult: (r: ExamRecord) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const isPractice = session.config.mode === 'practice'
  const paged = session.config.layout === 'paged'
  const { currentIndex, questions, answers, flagged } = session
  const current = questions[currentIndex]
  const answered = answeredFlags(session)

  // 练习模式的揭晓时机：单选/判断点选即揭晓；多选需点「确认作答」后才揭晓
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  function revealOf(i: number): boolean {
    if (!isPractice) return false
    return questions[i].type === 'multi' ? revealed.has(i) : answered[i]
  }
  function confirmMulti(i: number) {
    setRevealed((s) => new Set(s).add(i))
  }

  function pick(index: number, value: number[] | null) {
    actions.answer(index, value)
  }

  // 逐题模式键盘流：方向键切题、数字键选项、F 标记
  useEffect(() => {
    if (!paged) return
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        actions.goto(Math.max(0, currentIndex - 1))
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        actions.goto(Math.min(questions.length - 1, currentIndex + 1))
      } else if (e.key.toLowerCase() === 'f') {
        actions.toggleFlag(currentIndex)
      } else if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1
        const q = questions[currentIndex]
        if (i >= q.options.length) return
        if (revealOf(currentIndex)) return // 已揭晓则锁定
        if (q.type === 'multi') {
          const cur = answers[currentIndex] ?? []
          const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b)
          pick(currentIndex, next.length ? next : null)
        } else {
          pick(currentIndex, [i])
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [paged, currentIndex, questions, answers, answered, isPractice])

  function submit() {
    const unanswered = answers.filter((a) => a == null || a.length === 0).length
    if (
      !isPractice &&
      unanswered > 0 &&
      !confirm(`还有 ${unanswered} 题未作答，确定交卷？未作答计为错误。`)
    ) {
      return
    }
    const rec = actions.submitSession()
    if (rec) onResult(rec)
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-3">
      <div className="flex items-center gap-4">
        <span className="font-mono text-lg font-semibold text-brand tabular-nums">{mmss(Math.floor((now - session.startedAt) / 1000))}</span>
        <span className="text-sm text-ink-soft">
          {isPractice ? '练习' : '考试'} · {paged ? `第 ${currentIndex + 1}/${questions.length} 题` : `共 ${questions.length} 题`}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          icon={<LogOut size={14} />}
          onClick={() => {
            if (confirm('退出当前练习？进度不会保存到记录。')) actions.abandonSession()
          }}
        >
          退出
        </Button>
        <Button size="sm" variant="primary" icon={<Send size={14} />} onClick={submit}>
          交卷
        </Button>
      </div>
    </div>
  )

  if (paged) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <QuestionCard
          question={current}
          index={currentIndex}
          value={answers[currentIndex]}
          flagged={flagged[currentIndex]}
          reveal={revealOf(currentIndex)}
          onChange={(v) => pick(currentIndex, v)}
          onConfirm={
            isPractice && current.type === 'multi'
              ? () => confirmMulti(currentIndex)
              : undefined
          }
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            icon={<ChevronLeft size={16} />}
            disabled={currentIndex === 0}
            onClick={() => actions.goto(currentIndex - 1)}
          >
            上一题
          </Button>
          <Button
            size="sm"
            variant={flagged[currentIndex] ? 'primary' : 'ghost'}
            icon={<Flag size={14} />}
            onClick={() => actions.toggleFlag(currentIndex)}
          >
            标记
          </Button>
          <Button
            disabled={currentIndex === questions.length - 1}
            onClick={() => actions.goto(currentIndex + 1)}
          >
            下一题
            <ChevronRight size={16} />
          </Button>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <AnswerSheet
            total={questions.length}
            answered={answered}
            flagged={flagged}
            current={currentIndex}
            onJump={(i) => actions.goto(i)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      {questions.map((q, i) => (
        <QuestionCard
          key={q.id + i}
          question={q}
          index={i}
          value={answers[i]}
          flagged={flagged[i]}
          reveal={revealOf(i)}
          onChange={(v) => pick(i, v)}
          onConfirm={isPractice && q.type === 'multi' ? () => confirmMulti(i) : undefined}
        />
      ))}
      <Button variant="primary" className="self-center" icon={<Send size={15} />} onClick={submit}>
        交卷
      </Button>
    </div>
  )
}
