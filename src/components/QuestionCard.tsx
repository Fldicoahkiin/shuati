import type { Question } from '@/types'
import { Check, X, Flag } from 'lucide-react'
import { Button, cn, TypeTag } from './ui'
import { OPTION_LETTERS } from '@/lib/parser'

type OptState = 'idle' | 'picked' | 'correct' | 'wrong' | 'missed'

const TYPE_NAME: Record<Question['type'], string> = {
  single: '单选题',
  multi: '多选题 · 可多选',
  tf: '判断题',
}

interface Props {
  question: Question
  index: number
  value: number[] | null
  onChange?: (v: number[] | null) => void
  /** 多选练习模式：选完后点「确认作答」才揭晓判分 */
  onConfirm?: () => void
  reveal?: boolean
  flagged?: boolean
  id?: string
}

export function QuestionCard({
  question,
  index,
  value,
  onChange,
  onConfirm,
  reveal,
  flagged,
  id,
}: Props) {
  const locked = reveal || !onChange
  const showConfirm = !!onConfirm && !reveal && question.type === 'multi'

  function pick(i: number) {
    if (locked || !onChange) return
    if (question.type === 'multi') {
      const cur = value ?? []
      const next = cur.includes(i)
        ? cur.filter((x) => x !== i)
        : [...cur, i].sort((a, b) => a - b)
      onChange(next.length ? next : null)
    } else {
      onChange([i])
    }
  }

  function stateOf(i: number): OptState {
    const isAnswer = question.answer.includes(i)
    const isPicked = value?.includes(i) ?? false
    if (!reveal) return isPicked ? 'picked' : 'idle'
    if (isAnswer && isPicked) return 'correct'
    if (isAnswer) return 'missed'
    if (isPicked) return 'wrong'
    return 'idle'
  }

  return (
    <div id={id} className="rounded-2xl border border-line bg-card p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-xs text-ink-soft">
        <TypeTag type={question.type} />
        <span>第 {index + 1} 题 · {TYPE_NAME[question.type]}</span>
        {flagged && <Flag size={13} className="text-warn" fill="currentColor" />}
      </div>

      <p className="mb-5 text-[17px] leading-relaxed font-medium text-ink-strong">
        {question.stem}
      </p>

      <div className={cn(question.type === 'tf' ? 'flex gap-3' : 'flex flex-col gap-2.5')}>
        {question.options.map((opt, i) => {
          const st = stateOf(i)
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={locked}
              className={cn(
                'group flex items-center gap-3 rounded-xl border-2 px-4 text-left transition-colors',
                question.type === 'tf' ? 'flex-1 justify-center py-4 text-base font-semibold' : 'py-3.5',
                !locked && 'cursor-pointer',
                st === 'idle' && 'border-transparent bg-card-2 hover:border-line-strong',
                st === 'picked' && 'border-brand bg-brand-soft',
                st === 'correct' && 'border-ok bg-ok-soft',
                st === 'wrong' && 'border-bad bg-bad-soft',
                st === 'missed' && 'border-ok/60 bg-ok-soft/40',
              )}
            >
              {question.type !== 'tf' && (
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold',
                    st === 'idle' && 'bg-black/5 text-ink dark:bg-white/10',
                    st === 'picked' && 'bg-brand text-on-brand',
                    st === 'correct' && 'bg-ok text-white',
                    st === 'wrong' && 'bg-bad text-white',
                    st === 'missed' && 'bg-ok/70 text-white',
                  )}
                >
                  {OPTION_LETTERS[i] ?? i + 1}
                </span>
              )}
              <span className="flex-1 text-ink-strong">{opt}</span>
              {st === 'correct' && <Check size={18} className="text-ok" />}
              {st === 'wrong' && <X size={18} className="text-bad" />}
              {st === 'missed' && <Check size={16} className="text-ok/70" />}
            </button>
          )
        })}
      </div>

      {showConfirm && (
        <Button
          variant="primary"
          size="sm"
          className="mt-4"
          disabled={!value || value.length === 0}
          onClick={onConfirm}
        >
          确认作答
        </Button>
      )}
    </div>
  )
}
