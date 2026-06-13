import { useMemo } from 'react'
import { Repeat, X, BookmarkX } from 'lucide-react'
import type { Question } from '@/types'
import { actions, useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Button, Card, EmptyState, SectionTitle, TypeTag } from '@/components/ui'

export function WrongView() {
  const wrong = useStore((s) => s.wrong)
  const banks = useStore((s) => s.banks)

  const items = useMemo(() => {
    const index = new Map<string, { q: Question; bankName: string }>()
    for (const b of banks) for (const q of b.questions) index.set(q.id, { q, bankName: b.name })
    return [...wrong]
      .sort((a, b) => b.lastWrongAt - a.lastWrongAt)
      .map((w) => ({ ...w, ...index.get(w.questionId) }))
      .filter((x): x is typeof x & { q: Question; bankName: string } => x.q != null)
  }, [wrong, banks])

  function retry() {
    const s = actions.startWrongSession({
      types: ['single', 'multi', 'tf'],
      mode: 'practice',
      layout: 'paged',
      shuffleQuestions: true,
      shuffleOptions: false,
    })
    if (!s) toast('没有可重练的错题', 'bad')
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<BookmarkX size={40} strokeWidth={1.5} />}
          title="错题本是空的"
          hint="练习或考试中答错的题会自动收进这里，答对一次后自动移出。"
        />
      </Card>
    )
  }

  return (
    <Card>
      <SectionTitle
        title="错题本"
        meta={`${items.length} 题`}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="primary" icon={<Repeat size={14} />} onClick={retry}>
              重练全部
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm('清空整个错题本？')) actions.clearWrong()
              }}
            >
              清空
            </Button>
          </div>
        }
      />
      <ul className="flex flex-col gap-2.5">
        {items.map((it) => (
          <li
            key={it.questionId}
            className="flex items-start gap-3 rounded-xl border border-line bg-card-2 p-3.5"
          >
            <TypeTag type={it.q.type} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-strong">{it.q.stem}</p>
              <p className="mt-1 text-xs text-ink-soft">
                正确答案
                <span className="ml-1 font-mono text-ok">
                  {it.q.answer
                    .map((a) => (it.q.type === 'tf' ? it.q.options[a] : String.fromCharCode(65 + a)))
                    .join('')}
                </span>
                <span className="mx-2 text-line-strong">·</span>
                答错 {it.wrongCount} 次
                <span className="mx-2 text-line-strong">·</span>
                {it.bankName}
              </p>
            </div>
            <button
              onClick={() => actions.removeWrong(it.questionId)}
              className="rounded-md p-1.5 text-ink-soft transition-colors hover:bg-bad-soft hover:text-bad"
              aria-label="移出错题本"
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
