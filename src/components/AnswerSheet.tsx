import { cn } from './ui'

interface Props {
  total: number
  answered: boolean[]
  flagged?: boolean[]
  current?: number
  correctness?: (boolean | null)[]
  onJump?: (i: number) => void
}

export function AnswerSheet({ total, answered, flagged, current, correctness, onJump }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const review = correctness != null
        const ok = correctness?.[i]
        return (
          <button
            key={i}
            onClick={() => onJump?.(i)}
            disabled={!onJump}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-colors',
              onJump && 'cursor-pointer',
              // 复盘态：对/错配色
              review && ok === true && 'bg-ok text-white',
              review && ok === false && 'bg-bad text-white',
              review && ok == null && 'bg-card-2 text-ink-soft',
              // 答题态：已答高亮
              !review && answered[i] && 'bg-brand text-on-brand',
              !review && !answered[i] && 'bg-card-2 text-ink-soft hover:text-ink',
              // 当前题、标记
              current === i && 'ring-2 ring-brand ring-offset-2 ring-offset-card',
              flagged?.[i] && !review && 'ring-2 ring-warn ring-offset-2 ring-offset-card',
            )}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
