import { describe, it, expect } from 'vitest'
import { parseBank } from './parser'
import { SAMPLE_BANK_TEXT } from './sample'

describe('parseBank · 示例题库', () => {
  const { questions, warnings } = parseBank(SAMPLE_BANK_TEXT)

  it('解析出 15 题且无警告', () => {
    expect(questions).toHaveLength(15)
    expect(warnings).toHaveLength(0)
  })

  it('题型分布正确（8 单选 / 3 多选 / 4 判断）', () => {
    const count = (t: string) => questions.filter((q) => q.type === t).length
    expect(count('single')).toBe(8)
    expect(count('multi')).toBe(3)
    expect(count('tf')).toBe(4)
  })

  it('单选答案转成选项下标', () => {
    const q = questions[0]
    expect(q.stem).toContain('首都')
    expect(q.options).toEqual(['上海', '北京', '广州', '深圳'])
    expect(q.answer).toEqual([1]) // B = 北京
  })

  it('多选答案转成多个下标', () => {
    const q = questions.find((x) => x.stem.includes('四大发明'))!
    expect(q.type).toBe('multi')
    expect(q.answer).toEqual([0, 1, 3]) // A,B,D
  })

  it('判断题统一为 [对, 错] 两项', () => {
    const t = questions.find((x) => x.stem.includes('365天'))!
    expect(t.type).toBe('tf')
    expect(t.options).toEqual(['对', '错'])
    expect(t.answer).toEqual([0])
    const f = questions.find((x) => x.stem.includes('月球'))!
    expect(f.answer).toEqual([1])
  })
})

describe('parseBank · 稳定 ID', () => {
  it('同一题库两次解析得到相同 id', () => {
    const a = parseBank(SAMPLE_BANK_TEXT).questions.map((q) => q.id)
    const b = parseBank(SAMPLE_BANK_TEXT).questions.map((q) => q.id)
    expect(a).toEqual(b)
  })

  it('内容相同的题去重', () => {
    const dup = SAMPLE_BANK_TEXT + '\n\n' + SAMPLE_BANK_TEXT
    expect(parseBank(dup).questions).toHaveLength(15)
  })
})

describe('parseBank · 自动识别题型', () => {
  it('无标记，按答案字母数判定多选', () => {
    const txt = `1. 下列哪些是颜色？
A. 红
B. 桌子
C. 蓝
D. 跑步
答案：A,C`
    const q = parseBank(txt).questions[0]
    expect(q.type).toBe('multi')
    expect(q.answer).toEqual([0, 2])
  })

  it('无选项、答案为对/错时判定判断题', () => {
    const txt = `1. 地球是圆的。
答案：对`
    const q = parseBank(txt).questions[0]
    expect(q.type).toBe('tf')
    expect(q.options).toEqual(['对', '错'])
    expect(q.answer).toEqual([0])
  })

  it('A.对 B.错 形式且答案为字母时换算成对/错', () => {
    const txt = `1. 太阳从东边升起。
A. 对
B. 错
答案：A`
    const q = parseBank(txt).questions[0]
    expect(q.type).toBe('tf')
    expect(q.answer).toEqual([0])
  })
})

describe('parseBank · 统一答案块', () => {
  it('区间式 1-3 BCA 按题号回填，且不污染最后一题题干', () => {
    const txt = `1. 中国的首都？
A. 上海
B. 北京
C. 广州

2. 最大的行星？
A. 地球
B. 木星
C. 火星

3. 最长的河流？
A. 长江
B. 尼罗河
C. 黄河

参考答案
1-3 BBB`
    const { questions } = parseBank(txt)
    expect(questions).toHaveLength(3)
    expect(questions.every((q) => q.answer[0] === 1)).toBe(true)
    expect(questions[2].stem).toBe('最长的河流？')
    expect(questions[2].options).toEqual(['长江', '尼罗河', '黄河'])
  })

  it('逐题式 1.B 2.A 回填', () => {
    const txt = `1. 甲？
A. x
B. y

2. 乙？
A. m
B. n

答案
1.B 2.A`
    const { questions } = parseBank(txt)
    expect(questions[0].answer).toEqual([1])
    expect(questions[1].answer).toEqual([0])
  })
})

describe('parseBank · 容错', () => {
  it('全角字母/数字/标点归一化', () => {
    const txt = `１． 全角测试？
Ａ． 选项一
Ｂ． 选项二
答案：Ｂ`
    const q = parseBank(txt).questions[0]
    expect(q.options).toEqual(['选项一', '选项二'])
    expect(q.answer).toEqual([1])
  })

  it('同一行内联多个选项', () => {
    const txt = `1. 最大的行星？ A. 地球 B. 火星 C. 木星 D. 土星
答案：C`
    const q = parseBank(txt).questions[0]
    expect(q.options).toEqual(['地球', '火星', '木星', '土星'])
    expect(q.answer).toEqual([2])
    expect(q.stem).toBe('最大的行星？')
  })

  it('缺少答案的题进入警告而非静默丢弃', () => {
    const txt = `1. 没有答案的题？
A. 甲
B. 乙`
    const { questions, warnings } = parseBank(txt)
    expect(questions).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].reason).toContain('答案')
  })

  it('答案字母超出选项范围进入警告', () => {
    const txt = `1. 只有两个选项？
A. 甲
B. 乙
答案：D`
    const { warnings } = parseBank(txt)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].reason).toContain('范围')
  })
})
