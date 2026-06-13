import type { Question, QuestionType } from '@/types'
import { contentHash } from './id'

export interface ParseWarning {
  stem: string
  reason: string
}

export interface ParseResult {
  questions: Question[]
  warnings: ParseWarning[]
}

const OPTION_LETTERS = 'ABCDEFGH'

interface RawOption {
  letter: string
  text: string
}

interface RawBlock {
  num: number | null
  typeHint: QuestionType | null
  stem: string
  options: RawOption[]
  inlineAnswer: string | null
}

/** 全角→半角、答案标记统一、选项/答案行内顿号归一等，不动题干正文 */
function normalizeText(text: string): string {
  let t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  t = t.replace(/[Ａ-Ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  t = t.replace(/[ａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  t = t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  t = t.replace(/：/g, ':')
  t = t.replace(/（/g, '(').replace(/）/g, ')')
  t = t.replace(/【/g, '[').replace(/】/g, ']')

  // 各种「答案」写法统一成「答案:」
  t = t.replace(/正确\s*答案\s*[:：]/gi, '答案:')
  t = t.replace(/标准\s*答案\s*[:：]/gi, '答案:')
  t = t.replace(/参考\s*答案\s*[:：]/gi, '答案:')
  t = t.replace(/Answer\s*[:：]/gi, '答案:')

  // 仅在答案行上把「正确/错误」等归一为「对/错」
  t = t.replace(/^(答案\s*:\s*)(正确|true|√|✔|T)\b/gim, '$1对')
  t = t.replace(/^(答案\s*:\s*)(错误|false|×|✘|F)\b/gim, '$1错')
  t = t.replace(/(答案\s*:\s*)(正确|true|√|✔)\b/gi, '$1对')
  t = t.replace(/(答案\s*:\s*)(错误|false|×|✘)\b/gi, '$1错')

  // 选项行 / 答案行内的顿号归一为逗号（题干不动）
  t = t.replace(/^([A-Ha-h]\s*[.、．)][^\n]*)/gm, (m) => m.replace(/、/g, ','))
  t = t.replace(/^(答案\s*:.*)/gm, (m) => m.replace(/、/g, ',').replace(/。/g, '.'))

  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

function splitIntoBlocks(text: string): string[] {
  const patterns = [
    /(?:^|\n)\s*(?:第\s*)?(\d{1,3})\s*[.、．)]\s*/gm,
    /(?:^|\n)\s*\(\s*(\d{1,3})\s*\)\s*/gm,
    /(?:^|\n)\s*第\s*(\d{1,3})\s*题\s*/gm,
    /(?:^|\n)\s*[[(](?:单选|多选|判断|单|多|判)\s*题?[\])]\s*/gm,
  ]

  const markers: number[] = []
  for (const pat of patterns) {
    let m: RegExpExecArray | null
    while ((m = pat.exec(text)) !== null) {
      const idx = m.index + (m[0].length - m[0].trimStart().length)
      if (!markers.find((x) => Math.abs(x - idx) < 3)) markers.push(idx)
    }
  }
  markers.sort((a, b) => a - b)

  if (markers.length === 0) {
    // 无题号：退化为按答案行或空行切分
    const byAnswer = text.split(/\n(?=.*答案\s*:)/)
    if (byAnswer.length > 1) return byAnswer.map((b) => b.trim()).filter((b) => b.length > 5)
    return text
      .split(/\n\n+/)
      .map((b) => b.trim())
      .filter((b) => b.length > 5)
  }

  const filtered = [markers[0]]
  for (let i = 1; i < markers.length; i++) {
    if (markers[i] - filtered[filtered.length - 1] > 3) filtered.push(markers[i])
  }

  const blocks: string[] = []
  for (let i = 0; i < filtered.length; i++) {
    const start = filtered[i]
    const end = i + 1 < filtered.length ? filtered[i + 1] : text.length
    blocks.push(text.slice(start, end).trim())
  }
  return blocks
}

/**
 * 抽取「统一答案块」：支持区间式 `1-5 ABDFA` 与逐题式 `1.B 2.C`。
 * 仅作为题目缺少行内答案时的兜底，按题号映射。
 */
function extractAnswerKey(text: string): Map<number, string> {
  const map = new Map<number, string>()

  const rangeRe = /(\d{1,3})\s*[-—~～到至]\s*(\d{1,3})\s*[:.、)]?\s*([A-Ha-h对错√×]{2,})/g
  let m: RegExpExecArray | null
  while ((m = rangeRe.exec(text)) !== null) {
    const start = parseInt(m[1])
    const end = parseInt(m[2])
    const letters = m[3].toUpperCase().replace(/[^A-H对错√×]/g, '')
    if (end >= start && end - start + 1 === letters.length) {
      for (let i = 0; i < letters.length; i++) map.set(start + i, letters[i])
    }
  }

  const pairRe =
    /(?:^|[\s,;、])(\d{1,3})\s*[.、．:)]\s*([A-Ha-h]{1,8}|对|错|正确|错误|√|×|T|F)(?=$|[\s,;、])/gim
  while ((m = pairRe.exec(text)) !== null) {
    const n = parseInt(m[1])
    if (!map.has(n)) map.set(n, m[2].toUpperCase())
  }
  return map
}

/** 剔除「统一答案块」整行（题号已由 extractAnswerKey 记录），避免污染最后一题题干 */
function stripAnswerKeyLines(text: string): string {
  const headerRe = /^(参考)?答案(如下)?\s*:?\s*$/
  const rangeLineRe = /^\d{1,3}\s*[-—~～到至]\s*\d{1,3}[\s:.、)]*[A-H对错√×,\s]+$/i
  const pairLineRe =
    /^(\s*\d{1,3}\s*[.、．:)]\s*(?:[A-H]{1,8}|对|错|正确|错误|√|×)\s*[,;、]?)+$/i
  return text
    .split('\n')
    .filter((line) => {
      const l = line.trim()
      if (!l) return true
      return !headerRe.test(l) && !rangeLineRe.test(l) && !pairLineRe.test(l)
    })
    .join('\n')
}

/**
 * 兜底选项解析：用于「A 文本 B 文本 C 文本」这类仅空格分隔、无 .／顿号 的选项。
 * 要求字母从 A 起连续（A,B,C…），避免把题干里散落的字母误当选项。
 */
function looseParseOptions(text: string): { options: RawOption[]; stem: string } | null {
  const re = /(?:^|[\s，,；;])([A-H])(?=[\s.、．)，,])/g
  const marks: { letter: string; at: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    marks.push({ letter: m[1], at: m.index + m[0].length - 1 })
  }
  const startIdx = marks.findIndex((x) => x.letter === 'A')
  if (startIdx < 0) return null
  const seq = [marks[startIdx]]
  for (let i = startIdx + 1; i < marks.length; i++) {
    if (marks[i].letter === String.fromCharCode(65 + seq.length)) seq.push(marks[i])
  }
  if (seq.length < 2) return null

  const options: RawOption[] = seq.map((mark, i) => {
    const from = mark.at + 1
    const to = i + 1 < seq.length ? seq[i + 1].at : text.length
    const optText = text.slice(from, to).replace(/^[\s.、．)，,]+/, '').trim()
    return { letter: mark.letter, text: optText }
  })
  return { options, stem: text.slice(0, seq[0].at).trim() }
}

function parseBlock(block: string): RawBlock | null {
  if (!block || block.length < 3) return null

  let typeHint: QuestionType | null = null
  if (/\[多选\]|\(多选\)|\[多选题\]|\(多选题\)/i.test(block)) typeHint = 'multi'
  else if (/\[判断\]|\(判断\)|\[判断题\]|\(判断题\)|\[判\]/i.test(block)) typeHint = 'tf'
  else if (/\[单选\]|\(单选\)|\[单选题\]|\(单选题\)/i.test(block)) typeHint = 'single'

  let content = block.replace(/^\s*[[(](?:单选|多选|判断|单|多|判)\s*题?[\])]\s*/i, '')

  let num: number | null = null
  const numMatch =
    content.match(/^\s*(?:第\s*)?(\d{1,3})\s*[.、．)]/) ||
    content.match(/^\s*\(\s*(\d{1,3})\s*\)/) ||
    content.match(/^\s*第\s*(\d{1,3})\s*题/)
  if (numMatch) num = parseInt(numMatch[1])

  content = content
    .replace(/^\s*(?:第\s*)?\d{1,3}\s*[.、．)]\s*/, '')
    .replace(/^\s*\(\d{1,3}\)\s*/, '')
    .replace(/^\s*第\s*\d{1,3}\s*题\s*/, '')

  // 行内答案
  let inlineAnswer: string | null = null
  const answerPatterns = [/答案\s*:\s*(.+?)(?:\n|$)/i, /\[答案\]\s*(.+?)(?:\n|$)/i]
  for (const pat of answerPatterns) {
    const am = content.match(pat)
    if (am) {
      let a = am[1].trim()
      a = a.replace(/[。.．)]+\s*$/g, '').trim()
      a = a.replace(/\s*[(][^)]*[)]\s*$/g, '').trim()
      inlineAnswer = a || am[1].trim()
      content = content.replace(am[0], '\n')
      break
    }
  }

  // 答案嵌在题干括号里：「…体现了（ B ）特征」「（ ABC ）」「（对）」
  // 仅当括号内是纯字母/对错时才视为答案，避免误吃「（自然界）」等正文括号
  if (!inlineAnswer) {
    const pm = content.match(/\(\s*([A-Ha-h](?:[A-Ha-h\s]{0,10})|对|错|正确|错误|√|×)\s*\)/)
    if (pm) {
      inlineAnswer = pm[1].replace(/\s+/g, '').trim()
      content = content.replace(pm[0], '（ ）') // 抹成空括号，避免题干泄题
    }
  }

  // 逐行拆出选项与题干
  let options: RawOption[] = []
  const stemParts: string[] = []
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      stemParts.push('')
      continue
    }
    const positions: { letter: string; start: number; end: number }[] = []
    const markerRe = /([A-Ha-h])\s*[.、．)]/g
    let mm: RegExpExecArray | null
    while ((mm = markerRe.exec(line)) !== null) {
      positions.push({
        letter: mm[1].toUpperCase(),
        start: mm.index,
        end: mm.index + mm[0].length,
      })
    }
    if (positions.length === 0) {
      stemParts.push(rawLine)
      continue
    }
    if (positions[0].start > 0) {
      const prefix = line.slice(0, positions[0].start).trim()
      if (prefix) stemParts.push(prefix)
    }
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
      const nextStart = i + 1 < positions.length ? positions[i + 1].start : line.length
      const optText = line.slice(pos.end, nextStart).trim()
      if (!options.find((o) => o.letter === pos.letter)) {
        options.push({ letter: pos.letter, text: optText })
      }
    }
  }

  // 严格规则没找到足够选项时，尝试「空格分隔」的兜底解析
  if (options.length < 2) {
    const loose = looseParseOptions(content)
    if (loose) {
      options = loose.options
      stemParts.length = 0
      stemParts.push(loose.stem)
    }
  }

  let stem = stemParts.join('\n').replace(/\n+/g, ' ').trim()
  stem = stem
    .replace(/解析\s*:.*$/i, '')
    .replace(/来源\s*:.*$/i, '')
    // 去掉粘连到题干末尾的章节/题型小标题（如「… 三、判断题」「第二章」）
    .replace(/\s*第\s*[一二三四五六七八九十百零\d]+\s*[章节]\s*$/, '')
    .replace(
      /\s*[一二三四五六七八九十]\s*[、.．]?\s*(?:单项选择|多项选择|判断)题?\s*[:：]?\s*$/,
      '',
    )
    .trim()

  if (!stem) return null
  return { num, typeHint, stem, options, inlineAnswer }
}

function resolveTf(answer: string): 0 | 1 | null {
  const a = answer.trim()
  if (/^(对|正确|是|true|t|√|✔|yes|y)$/i.test(a)) return 0
  if (/^(错|错误|否|false|f|×|✘|no|n)$/i.test(a)) return 1
  if (/对|正确|√|✔/.test(a)) return 0
  if (/错|×|✘/.test(a)) return 1
  return null
}

function lettersToIndices(answer: string, options: RawOption[]): number[] {
  const letters = [...new Set(answer.toUpperCase().replace(/[^A-H]/g, '').split(''))]
  const optLetters = options.map((o) => o.letter)
  return letters.map((l) => optLetters.indexOf(l)).filter((i) => i >= 0)
}

const TF_TRUE = ['对', '正确', '是', 't']

/** 把一段题库文本解析成题目数组，并返回无法解析的可疑条目供用户修正 */
export function parseBank(rawText: string): ParseResult {
  const text = normalizeText(rawText)
  const questions: Question[] = []
  const warnings: ParseWarning[] = []
  if (!text) return { questions, warnings }

  const key = extractAnswerKey(text)
  const blocks = splitIntoBlocks(stripAnswerKeyLines(text))
  const seen = new Set<string>()

  for (const block of blocks) {
    const raw = parseBlock(block)
    if (!raw) continue

    const short = raw.stem.slice(0, 40)
    let answerText = raw.inlineAnswer
    if (!answerText && raw.num != null && key.has(raw.num)) answerText = key.get(raw.num)!
    if (!answerText) {
      warnings.push({ stem: short, reason: '未找到答案' })
      continue
    }

    // 题型判定：显式标记 > 由选项推断（对/错二选）> 由答案推断
    let type: QuestionType = raw.typeHint ?? 'single'
    const optTexts = raw.options.map((o) => o.text.replace(/[.。,，\s]/g, ''))
    const looksTf =
      raw.options.length === 2 &&
      ((optTexts.includes('对') && optTexts.includes('错')) ||
        (optTexts.includes('正确') && optTexts.includes('错误')) ||
        (optTexts.includes('是') && optTexts.includes('否')))

    if (!raw.typeHint) {
      if (looksTf) type = 'tf'
      else if (resolveTf(answerText) !== null && raw.options.length === 0) type = 'tf'
      else if (lettersToIndices(answerText, raw.options).length >= 2) type = 'multi'
      else type = 'single'
    }

    if (type === 'tf') {
      // 若原文是 A.对 B.错 形式，答案可能是字母，换算成 对/错
      let normalized = answerText
      const asLetter = answerText.toUpperCase().replace(/[^A-H]/g, '')
      if (asLetter.length === 1) {
        const opt = raw.options.find((o) => o.letter === asLetter)
        if (opt) {
          const t = opt.text.replace(/[.。,，\s]/g, '')
          normalized = TF_TRUE.includes(t.toLowerCase()) || TF_TRUE.includes(t) ? '对' : '错'
        }
      }
      const idx = resolveTf(normalized)
      if (idx === null) {
        warnings.push({ stem: short, reason: `判断题答案无法识别：${answerText}` })
        continue
      }
      pushQuestion(questions, seen, { type, stem: raw.stem, options: ['对', '错'], answer: [idx] })
      continue
    }

    if (raw.options.length < 2) {
      warnings.push({ stem: short, reason: '选项不足两项' })
      continue
    }
    const indices = lettersToIndices(answerText, raw.options)
    if (indices.length === 0) {
      warnings.push({ stem: short, reason: `答案字母不在选项范围：${answerText}` })
      continue
    }
    if (type === 'single' && indices.length > 1) type = 'multi'

    pushQuestion(questions, seen, {
      type,
      stem: raw.stem,
      options: raw.options.map((o) => o.text),
      answer: indices.sort((a, b) => a - b),
    })
  }

  return { questions, warnings }
}

function pushQuestion(
  list: Question[],
  seen: Set<string>,
  q: Omit<Question, 'id'>,
): void {
  const id = contentHash(q.type, q.stem, q.options.join(''))
  if (seen.has(id)) return // 同一题库内去重
  seen.add(id)
  list.push({ id, ...q })
}

export { OPTION_LETTERS }
