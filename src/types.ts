export type QuestionType = 'single' | 'multi' | 'tf'

/**
 * 一道题。答案以「选项下标」存储而非 A/B/C/D 字母——这样打乱选项顺序后
 * 答案依然正确。判断题统一为 options = ['对', '错']。
 */
export interface Question {
  /** 内容 hash，重复导入同一题得到同一 id，错题本/历史引用不会错位 */
  id: string
  type: QuestionType
  stem: string
  /** 选项正文，不含 "A." 前缀；判断题为 ['对','错'] */
  options: string[]
  /** 正确选项的下标；单选长度 1，多选 ≥1，判断题为 [0] 或 [1] */
  answer: number[]
  explanation?: string
}

export interface Bank {
  id: string
  name: string
  questions: Question[]
  createdAt: number
  updatedAt: number
}

/** 错题记录，按题目 id 引用，跨题库版本稳定 */
export interface WrongEntry {
  questionId: string
  bankId: string
  /** 累计答错次数 */
  wrongCount: number
  /** 最近一次答错时间 */
  lastWrongAt: number
}

export type ExamMode = 'practice' | 'exam'
export type LayoutMode = 'paged' | 'scroll'

export interface ExamConfig {
  count: number
  types: QuestionType[]
  mode: ExamMode
  layout: LayoutMode
  shuffleQuestions: boolean
  shuffleOptions: boolean
}

/** 进行中或已交卷的一场考试/练习 */
export interface ExamSession {
  id: string
  bankId: string
  config: ExamConfig
  /** 抽取并（按需）打乱后的题目快照，保证回看一致 */
  questions: Question[]
  /** 每题作答的选项下标；未作答为 null */
  answers: (number[] | null)[]
  flagged: boolean[]
  currentIndex: number
  startedAt: number
  submittedAt: number | null
}

export interface ExamRecord {
  id: string
  bankId: string
  bankName: string
  mode: ExamMode
  date: number
  durationSec: number
  total: number
  score: number
  percentage: number
  /** 复盘所需的题目与作答快照 */
  questions: Question[]
  answers: (number[] | null)[]
}
