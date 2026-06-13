import { useSyncExternalStore } from 'react'
import type {
  Bank,
  ExamConfig,
  ExamRecord,
  Question,
  WrongEntry,
} from '@/types'
import { uid } from './id'
import {
  buildSession,
  buildSessionFromQuestions,
  isCorrect,
  scoreSession,
} from './grade'
import type { ExamSession } from '@/types'

const KEY = 'shuati:v1'
const MAX_HISTORY = 100

export interface AppState {
  banks: Bank[]
  activeBankId: string | null
  history: ExamRecord[]
  wrong: WrongEntry[]
  session: ExamSession | null
  theme: 'light' | 'dark'
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function load(): AppState {
  const base: AppState = {
    banks: [],
    activeBankId: null,
    history: [],
    wrong: [],
    session: null,
    theme: systemTheme(),
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const p = JSON.parse(raw) as Partial<AppState>
    const banks = p.banks ?? []
    return {
      banks,
      activeBankId: p.activeBankId ?? banks[0]?.id ?? null,
      history: p.history ?? [],
      wrong: p.wrong ?? [],
      session: p.session ?? null,
      theme: p.theme ?? base.theme,
    }
  } catch {
    return base
  }
}

let state = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    // 存储超限等：保留内存态，提示而非静默
    console.warn('[shuati] 本地存储写入失败，数据可能未持久化', err)
  }
}

function set(next: Partial<AppState>) {
  state = { ...state, ...next }
  persist()
  listeners.forEach((l) => l())
}

export function getState(): AppState {
  return state
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}

export function activeBank(s: AppState): Bank | null {
  return s.banks.find((b) => b.id === s.activeBankId) ?? null
}

/** 合并题目并按 id 去重（保留已有的） */
function mergeQuestions(existing: Question[], incoming: Question[]): Question[] {
  const seen = new Set(existing.map((q) => q.id))
  const merged = [...existing]
  for (const q of incoming) {
    if (!seen.has(q.id)) {
      seen.add(q.id)
      merged.push(q)
    }
  }
  return merged
}

function bumpWrong(
  wrong: WrongEntry[],
  session: ExamSession,
): WrongEntry[] {
  const map = new Map(wrong.map((w) => [w.questionId, { ...w }]))
  session.questions.forEach((q, i) => {
    const ok = isCorrect(q, session.answers[i])
    if (ok) {
      // 答对即移出错题本，形成「掌握即清除」的循环
      map.delete(q.id)
    } else {
      const prev = map.get(q.id)
      map.set(q.id, {
        questionId: q.id,
        bankId: session.bankId,
        wrongCount: (prev?.wrongCount ?? 0) + 1,
        lastWrongAt: Date.now(),
      })
    }
  })
  return [...map.values()]
}

export const actions = {
  setTheme(theme: 'light' | 'dark') {
    set({ theme })
  },
  toggleTheme() {
    set({ theme: state.theme === 'dark' ? 'light' : 'dark' })
  },

  createBank(name: string, questions: Question[]): string {
    const bank: Bank = {
      id: uid(),
      name: name.trim() || '未命名题库',
      questions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set({ banks: [bank, ...state.banks], activeBankId: bank.id })
    return bank.id
  },

  appendToBank(bankId: string, questions: Question[]) {
    set({
      banks: state.banks.map((b) =>
        b.id === bankId
          ? {
              ...b,
              questions: mergeQuestions(b.questions, questions),
              updatedAt: Date.now(),
            }
          : b,
      ),
    })
  },

  setActiveBank(id: string) {
    set({ activeBankId: id })
  },

  renameBank(id: string, name: string) {
    set({
      banks: state.banks.map((b) =>
        b.id === id ? { ...b, name: name.trim() || b.name, updatedAt: Date.now() } : b,
      ),
    })
  },

  deleteBank(id: string) {
    const banks = state.banks.filter((b) => b.id !== id)
    set({
      banks,
      activeBankId: state.activeBankId === id ? (banks[0]?.id ?? null) : state.activeBankId,
    })
  },

  updateQuestion(bankId: string, q: Question) {
    set({
      banks: state.banks.map((b) =>
        b.id === bankId
          ? {
              ...b,
              questions: b.questions.map((x) => (x.id === q.id ? q : x)),
              updatedAt: Date.now(),
            }
          : b,
      ),
    })
  },

  deleteQuestion(bankId: string, qid: string) {
    set({
      banks: state.banks.map((b) =>
        b.id === bankId
          ? { ...b, questions: b.questions.filter((q) => q.id !== qid), updatedAt: Date.now() }
          : b,
      ),
      wrong: state.wrong.filter((w) => w.questionId !== qid),
    })
  },

  startSession(config: ExamConfig): ExamSession | null {
    const bank = activeBank(state)
    if (!bank) return null
    const session = buildSession(bank, config)
    if (session) set({ session })
    return session
  },

  startQuestions(questions: Question[], config: ExamConfig): ExamSession | null {
    const session = buildSessionFromQuestions(state.activeBankId ?? '', questions, config)
    if (session) set({ session })
    return session
  },

  startWrongSession(config: Omit<ExamConfig, 'count'>): ExamSession | null {
    const ids = new Set(state.wrong.map((w) => w.questionId))
    const questions = state.banks
      .flatMap((b) => b.questions)
      .filter((q) => ids.has(q.id) && config.types.includes(q.type))
    const session = buildSessionFromQuestions(state.activeBankId ?? '', questions, {
      ...config,
      count: questions.length,
    })
    if (session) set({ session })
    return session
  },

  answer(index: number, value: number[] | null) {
    if (!state.session) return
    const answers = state.session.answers.slice()
    answers[index] = value
    set({ session: { ...state.session, answers } })
  },

  toggleFlag(index: number) {
    if (!state.session) return
    const flagged = state.session.flagged.slice()
    flagged[index] = !flagged[index]
    set({ session: { ...state.session, flagged } })
  },

  goto(index: number) {
    if (!state.session) return
    set({ session: { ...state.session, currentIndex: index } })
  },

  submitSession(): ExamRecord | null {
    const s = state.session
    if (!s) return null
    const score = scoreSession(s)
    const bank = state.banks.find((b) => b.id === s.bankId)
    const record: ExamRecord = {
      id: uid(),
      bankId: s.bankId,
      bankName: bank?.name ?? '错题重练',
      mode: s.config.mode,
      date: Date.now(),
      durationSec: Math.max(1, Math.floor((Date.now() - s.startedAt) / 1000)),
      total: s.questions.length,
      score,
      percentage: Math.round((score / s.questions.length) * 100),
      questions: s.questions,
      answers: s.answers,
    }
    set({
      session: null,
      history: [record, ...state.history].slice(0, MAX_HISTORY),
      wrong: bumpWrong(state.wrong, s),
    })
    return record
  },

  abandonSession() {
    set({ session: null })
  },

  removeWrong(qid: string) {
    set({ wrong: state.wrong.filter((w) => w.questionId !== qid) })
  },

  clearWrong() {
    set({ wrong: [] })
  },

  clearHistory() {
    set({ history: [] })
  },
}
