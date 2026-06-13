import type { Bank, ExamConfig, ExamSession, Question } from '@/types'
import { uid } from './id'

/** 多选采用严格判分：选项集合与答案集合完全一致才算对（少选/多选均判错）。 */
export function isCorrect(q: Question, ans: number[] | null): boolean {
  if (!ans || ans.length === 0) return false
  if (q.type === 'multi') {
    if (ans.length !== q.answer.length) return false
    const a = [...ans].sort((x, y) => x - y)
    const b = [...q.answer].sort((x, y) => x - y)
    return a.every((v, i) => v === b[i])
  }
  return ans.length === 1 && ans[0] === q.answer[0]
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 打乱选项并同步重映射答案下标；判断题「对/错」顺序固定不打乱 */
function shuffleOptions(q: Question): Question {
  if (q.type === 'tf') return q
  const order = shuffle(q.options.map((_, i) => i))
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answer: q.answer.map((a) => order.indexOf(a)).sort((x, y) => x - y),
  }
}

function makeSession(
  bankId: string,
  picked: Question[],
  config: ExamConfig,
): ExamSession {
  const questions = config.shuffleOptions ? picked.map(shuffleOptions) : picked
  return {
    id: uid(),
    bankId,
    config,
    questions,
    answers: new Array(questions.length).fill(null),
    flagged: new Array(questions.length).fill(false),
    currentIndex: 0,
    startedAt: Date.now(),
    submittedAt: null,
  }
}

export function buildSession(bank: Bank, config: ExamConfig): ExamSession | null {
  let pool = bank.questions.filter((q) => config.types.includes(q.type))
  if (pool.length === 0) return null
  if (config.shuffleQuestions) pool = shuffle(pool)
  return makeSession(bank.id, pool.slice(0, Math.min(config.count, pool.length)), config)
}

export function buildSessionFromQuestions(
  bankId: string,
  questions: Question[],
  config: ExamConfig,
): ExamSession | null {
  if (questions.length === 0) return null
  const pool = config.shuffleQuestions ? shuffle(questions) : questions
  return makeSession(bankId, pool, config)
}

export function scoreSession(session: ExamSession): number {
  return session.questions.reduce(
    (acc, q, i) => acc + (isCorrect(q, session.answers[i]) ? 1 : 0),
    0,
  )
}
