import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Question, QuestionType } from '@/types'
import { OPTION_LETTERS } from '@/lib/parser'
import { actions } from '@/lib/store'
import { toast } from '@/lib/toast'
import { Button, Modal, Segmented, cn } from './ui'

interface Props {
  bankId: string
  question: Question | null
  onClose: () => void
}

export function EditQuestionModal({ bankId, question, onClose }: Props) {
  const [type, setType] = useState<QuestionType>('single')
  const [stem, setStem] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [correct, setCorrect] = useState<number[]>([])

  useEffect(() => {
    if (!question) return
    setType(question.type)
    setStem(question.stem)
    setOptions(question.type === 'tf' ? ['对', '错'] : [...question.options])
    setCorrect([...question.answer])
  }, [question])

  function toggleCorrect(i: number) {
    if (type === 'multi') {
      setCorrect((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i].sort((a, b) => a - b)))
    } else {
      setCorrect([i])
    }
  }

  function changeType(t: QuestionType) {
    setType(t)
    setCorrect([])
    if (t === 'tf') setOptions(['对', '错'])
    else if (options.length < 2 || (options[0] === '对' && options[1] === '错')) setOptions(['', ''])
  }

  function save() {
    if (!question) return
    const trimmedStem = stem.trim()
    if (!trimmedStem) return toast('题干不能为空', 'bad')

    let finalOptions: string[]
    if (type === 'tf') {
      finalOptions = ['对', '错']
    } else {
      finalOptions = options.map((o) => o.trim()).filter(Boolean)
      if (finalOptions.length < 2) return toast('选择题至少需要 2 个选项', 'bad')
    }
    const answer = correct.filter((i) => i < finalOptions.length).sort((a, b) => a - b)
    if (answer.length === 0) return toast('请标出正确答案', 'bad')
    if (type === 'single' && answer.length > 1) return toast('单选题只能有一个答案', 'bad')

    actions.updateQuestion(bankId, { ...question, type, stem: trimmedStem, options: finalOptions, answer })
    toast('已保存', 'ok')
    onClose()
  }

  return (
    <Modal
      open={question != null}
      onClose={onClose}
      title="编辑题目"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={save}>
            保存
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="题型">
          <Segmented
            value={type}
            onChange={(v) => changeType(v)}
            options={[
              { value: 'single', label: '单选' },
              { value: 'multi', label: '多选' },
              { value: 'tf', label: '判断' },
            ]}
          />
        </Field>

        <Field label="题干">
          <textarea
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-lg border border-line bg-card-2 px-3 py-2 text-sm text-ink-strong outline-none focus:border-brand"
            placeholder="输入题干…"
          />
        </Field>

        <Field
          label={
            type === 'tf' ? '答案' : '选项（勾选左侧标记正确答案）'
          }
        >
          {type === 'tf' ? (
            <div className="flex gap-3">
              {['对', '错'].map((t, i) => (
                <button
                  key={t}
                  onClick={() => setCorrect([i])}
                  className={cn(
                    'flex-1 rounded-xl border-2 py-3 font-semibold transition-colors',
                    correct[0] === i
                      ? 'border-ok bg-ok-soft text-ok'
                      : 'border-transparent bg-card-2 text-ink',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {options.map((opt, i) => {
                const picked = correct.includes(i)
                return (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCorrect(i)}
                      title="标为正确答案"
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors',
                        picked ? 'bg-ok text-white' : 'bg-card-2 text-ink-soft hover:text-ink',
                      )}
                    >
                      {OPTION_LETTERS[i] ?? i + 1}
                    </button>
                    <input
                      value={opt}
                      onChange={(e) =>
                        setOptions((os) => os.map((o, j) => (j === i ? e.target.value : o)))
                      }
                      placeholder={`选项 ${OPTION_LETTERS[i]}`}
                      className="flex-1 rounded-lg border border-line bg-card-2 px-3 py-2 text-sm text-ink-strong outline-none focus:border-brand"
                    />
                    <button
                      onClick={() => {
                        setOptions((os) => os.filter((_, j) => j !== i))
                        setCorrect((c) => c.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)))
                      }}
                      className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-bad-soft hover:text-bad"
                      aria-label="删除选项"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })}
              {options.length < OPTION_LETTERS.length && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus size={15} />}
                  className="self-start"
                  onClick={() => setOptions((os) => [...os, ''])}
                >
                  添加选项
                </Button>
              )}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-ink-soft">{label}</span>
      {children}
    </label>
  )
}
