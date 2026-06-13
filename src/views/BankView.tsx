import { useRef, useState } from 'react'
import {
  Upload,
  FileText,
  Sparkles,
  Download,
  FolderInput,
  Trash2,
  Pencil,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import type { Bank, Question } from '@/types'
import { parseBank, type ParseResult } from '@/lib/parser'
import { extractText } from '@/lib/fileImport'
import { SAMPLE_BANK_TEXT } from '@/lib/sample'
import { actions, useStore, activeBank } from '@/lib/store'
import { toast } from '@/lib/toast'
import { contentHash } from '@/lib/id'
import { Button, Card, EmptyState, Modal, SectionTitle, TypeTag, cn } from '@/components/ui'
import { EditQuestionModal } from '@/components/EditQuestionModal'

function typeBreakdown(qs: { type: string }[]) {
  const c = (t: string) => qs.filter((q) => q.type === t).length
  return `单选 ${c('single')} · 多选 ${c('multi')} · 判断 ${c('tf')}`
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function BankView() {
  const bank = useStore(activeBank)
  const banks = useStore((s) => s.banks)

  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [naming, setNaming] = useState<Question[] | null>(null)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Question | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)

  function runParse(raw: string) {
    const r = parseBank(raw)
    setPreview(r)
    if (r.questions.length === 0) toast('未能识别出题目，请检查格式', 'bad')
  }

  async function onFile(file: File) {
    setBusy(true)
    try {
      const extracted = await extractText(file)
      setText(extracted)
      runParse(extracted)
      const fallbackName = file.name.replace(/\.[^.]+$/, '')
      if (!name) setName(fallbackName)
    } catch (e) {
      toast(e instanceof Error ? e.message : '文件处理失败', 'bad')
    } finally {
      setBusy(false)
    }
  }

  function commit(mode: 'new' | 'append') {
    if (!preview || preview.questions.length === 0) return
    if (mode === 'append' && bank) {
      actions.appendToBank(bank.id, preview.questions)
      toast(`已追加 ${preview.questions.length} 题`, 'ok')
      reset()
    } else {
      setNaming(preview.questions)
      setName(name || `题库 ${banks.length + 1}`)
    }
  }

  function confirmNew() {
    if (!naming) return
    actions.createBank(name, naming)
    toast(`已创建题库「${name || '未命名'}」`, 'ok')
    setNaming(null)
    reset()
  }

  function reset() {
    setText('')
    setPreview(null)
    setName('')
  }

  function loadSample() {
    actions.createBank('示例题库', parseBank(SAMPLE_BANK_TEXT).questions)
    toast('已加载示例题库', 'ok')
  }

  function exportJSON() {
    if (!bank) return
    download(`${bank.name}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bank.questions, null, 2))
  }

  function importJSON(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Question[]
        if (!Array.isArray(data)) throw new Error('不是题目数组')
        const valid = data
          .filter((q) => q.stem && q.type && Array.isArray(q.options) && Array.isArray(q.answer))
          .map((q) => ({ ...q, id: q.id || contentHash(q.type, q.stem, q.options.join('')) }))
        if (valid.length === 0) throw new Error('没有有效题目')
        actions.createBank(file.name.replace(/\.json$/i, ''), valid)
        toast(`导入 ${valid.length} 题`, 'ok')
      } catch (e) {
        toast('导入失败：' + (e instanceof Error ? e.message : ''), 'bad')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 导入区 */}
      <Card>
        <SectionTitle title="导入题目" meta="文本 / Word / PDF" />
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files[0]
            if (f) onFile(f)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragOver ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong',
          )}
        >
          {busy ? (
            <Loader2 size={26} className="animate-spin text-brand" />
          ) : (
            <Upload size={26} className="text-ink-soft" />
          )}
          <p className="text-sm text-ink">{busy ? '正在解析文件…' : '把题库文件拖到这里，或点击选择'}</p>
          <p className="text-xs text-ink-soft">支持 .txt / .docx / .pdf</p>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.docx,.pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onFile(f)
            }}
          />
        </div>

        <div className="my-3 text-center text-xs text-ink-soft">或粘贴文本</div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={'在此粘贴题库文本。支持 [单选]/[多选]/[判断] 标记、题号、行内或末尾「答案」、以及结尾「1-5 ABDFA」式统一答案。'}
          className="w-full resize-y rounded-xl border border-line bg-card-2 p-3 font-mono text-[13px] leading-relaxed text-ink-strong outline-none focus:border-brand"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => runParse(text)} disabled={!text.trim()}>
            解析预览
          </Button>
          <Button icon={<Sparkles size={15} />} onClick={loadSample}>
            加载示例
          </Button>
        </div>

        {/* 解析预览 */}
        {preview && preview.questions.length > 0 && (
          <div className="mt-4 rounded-xl border border-line bg-card-2 p-4">
            <p className="text-sm text-ink-strong">
              识别到 <span className="font-semibold text-brand">{preview.questions.length}</span> 题
              <span className="text-ink-soft"> · {typeBreakdown(preview.questions)}</span>
            </p>
            {preview.warnings.length > 0 && (
              <div className="mt-3 rounded-lg bg-warn-soft p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-warn">
                  <AlertTriangle size={14} />
                  {preview.warnings.length} 条未能识别，已跳过：
                </p>
                <ul className="space-y-1 text-xs text-ink-soft">
                  {preview.warnings.slice(0, 5).map((w, i) => (
                    <li key={i} className="truncate">
                      · {w.stem || '（空题干）'} —— {w.reason}
                    </li>
                  ))}
                  {preview.warnings.length > 5 && <li>· 还有 {preview.warnings.length - 5} 条…</li>}
                </ul>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => commit('new')}>
                建为新题库
              </Button>
              {bank && (
                <Button onClick={() => commit('append')}>追加到「{bank.name}」</Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 当前题库 */}
      <Card>
        <SectionTitle
          title={bank ? bank.name : '当前题库'}
          meta={bank ? `${bank.questions.length} 题 · ${typeBreakdown(bank.questions)}` : undefined}
          action={
            <div className="flex gap-2">
              <input ref={jsonRef} type="file" accept=".json" hidden onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) importJSON(f)
              }} />
              <Button size="sm" variant="ghost" icon={<FolderInput size={15} />} onClick={() => jsonRef.current?.click()}>
                导入 JSON
              </Button>
              {bank && bank.questions.length > 0 && (
                <Button size="sm" variant="ghost" icon={<Download size={15} />} onClick={exportJSON}>
                  导出
                </Button>
              )}
            </div>
          }
        />
        {!bank || bank.questions.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} strokeWidth={1.5} />}
            title="题库还是空的"
            hint="拖入文件或粘贴文本，解析后建立你的第一个题库。"
          />
        ) : (
          <QuestionList bank={bank} onEdit={setEditing} />
        )}
      </Card>

      <EditQuestionModal
        bankId={bank?.id ?? ''}
        question={editing}
        onClose={() => setEditing(null)}
      />

      {/* 命名新题库 */}
      <Modal
        open={naming != null}
        onClose={() => setNaming(null)}
        title="新建题库"
        footer={
          <>
            <Button onClick={() => setNaming(null)}>取消</Button>
            <Button variant="primary" onClick={confirmNew}>
              创建（{naming?.length ?? 0} 题）
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">题库名称</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmNew()}
            className="rounded-lg border border-line bg-card-2 px-3 py-2 text-sm text-ink-strong outline-none focus:border-brand"
          />
        </label>
      </Modal>
    </div>
  )
}

function QuestionList({ bank, onEdit }: { bank: Bank; onEdit: (q: Question) => void }) {
  return (
    <ul className="max-h-[460px] divide-y divide-line overflow-y-auto">
      {bank.questions.map((q, i) => (
        <li key={q.id} className="group flex items-center gap-3 py-2.5 pr-1">
          <span className="w-6 shrink-0 text-right text-xs text-ink-soft">{i + 1}</span>
          <TypeTag type={q.type} />
          <span className="flex-1 truncate text-sm text-ink-strong">{q.stem}</span>
          <span className="hidden shrink-0 font-mono text-xs text-ok sm:inline">
            {q.answer.map((a) => (q.type === 'tf' ? q.options[a] : String.fromCharCode(65 + a))).join('')}
          </span>
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => onEdit(q)}
              className="rounded-md p-1.5 text-ink-soft hover:bg-brand-soft hover:text-brand"
              aria-label="编辑"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => {
                if (confirm(`删除这道题？\n\n${q.stem.slice(0, 60)}`)) actions.deleteQuestion(bank.id, q.id)
              }}
              className="rounded-md p-1.5 text-ink-soft hover:bg-bad-soft hover:text-bad"
              aria-label="删除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
