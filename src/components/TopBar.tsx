import { useEffect, useRef, useState } from 'react'
import {
  Library,
  PenLine,
  BookmarkX,
  History,
  Sun,
  Moon,
  ChevronDown,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react'
import { actions, useStore } from '@/lib/store'
import { cn } from './ui'

export type View = 'bank' | 'exam' | 'wrong' | 'history' | 'result'

const NAV: { key: View; label: string; icon: typeof Library }[] = [
  { key: 'bank', label: '题库', icon: Library },
  { key: 'exam', label: '练习', icon: PenLine },
  { key: 'wrong', label: '错题本', icon: BookmarkX },
  { key: 'history', label: '记录', icon: History },
]

export function TopBar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const theme = useStore((s) => s.theme)
  const wrongCount = useStore((s) => s.wrong.length)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <button
          onClick={() => onNavigate('bank')}
          className="flex items-center gap-2 font-semibold text-ink-strong"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
            刷
          </span>
          <span className="text-[15px]">刷题</span>
          <span className="hidden text-xs font-normal text-ink-soft sm:inline">选择判断题练习</span>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <BankSwitcher />
          <button
            onClick={() => actions.toggleTheme()}
            className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-card-2 hover:text-ink-strong"
            aria-label="切换主题"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <nav className="flex w-full gap-1 sm:w-auto">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = view === key || (view === 'result' && key === 'history')
            return (
              <button
                key={key}
                onClick={() => onNavigate(key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors sm:flex-none',
                  active ? 'bg-card-2 text-ink-strong' : 'text-ink-soft hover:text-ink',
                )}
              >
                <Icon size={15} />
                {label}
                {key === 'wrong' && wrongCount > 0 && (
                  <span className="rounded-full bg-bad px-1.5 text-[10px] font-semibold text-white">
                    {wrongCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

function BankSwitcher() {
  const banks = useStore((s) => s.banks)
  const activeId = useStore((s) => s.activeBankId)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (banks.length === 0) return null
  const active = banks.find((b) => b.id === activeId)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[160px] items-center gap-1.5 rounded-lg border border-line bg-card-2 px-2.5 py-1.5 text-[13px] text-ink-strong"
      >
        <span className="truncate">{active?.name ?? '选择题库'}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-soft" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-60 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-xl">
          {banks.map((b) => (
            <div
              key={b.id}
              className="group flex items-center gap-2 px-3 py-2 hover:bg-card-2"
            >
              <button
                onClick={() => {
                  actions.setActiveBank(b.id)
                  setOpen(false)
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Check
                  size={14}
                  className={cn('shrink-0', b.id === activeId ? 'text-brand' : 'text-transparent')}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink-strong">{b.name}</span>
                  <span className="block text-[11px] text-ink-soft">{b.questions.length} 题</span>
                </span>
              </button>
              <button
                onClick={() => {
                  const name = prompt('重命名题库', b.name)
                  if (name != null) actions.renameBank(b.id, name)
                }}
                className="rounded p-1 text-ink-soft opacity-0 hover:text-brand group-hover:opacity-100"
                aria-label="重命名"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`删除题库「${b.name}」及其题目？`)) actions.deleteBank(b.id)
                }}
                className="rounded p-1 text-ink-soft opacity-0 hover:text-bad group-hover:opacity-100"
                aria-label="删除"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
