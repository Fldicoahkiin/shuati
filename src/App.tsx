import { useEffect, useState } from 'react'
import type { ExamRecord } from '@/types'
import { useStore } from '@/lib/store'
import { useToasts } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { TopBar, type View } from '@/components/TopBar'
import { BankView } from '@/views/BankView'
import { ExamView } from '@/views/ExamView'
import { WrongView } from '@/views/WrongView'
import { HistoryView } from '@/views/HistoryView'
import { ResultView } from '@/views/ResultView'

export default function App() {
  const theme = useStore((s) => s.theme)
  const session = useStore((s) => s.session)
  const [view, setView] = useState<View>(() => (session ? 'exam' : 'bank'))
  const [result, setResult] = useState<ExamRecord | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  function showResult(r: ExamRecord) {
    setResult(r)
    setView('result')
  }
  const goExam = () => setView('exam')

  return (
    <div className="min-h-svh">
      <TopBar view={view} onNavigate={setView} />
      <main className="mx-auto max-w-3xl px-4 py-5">
        {view === 'bank' && <BankView />}
        {view === 'exam' && <ExamView onResult={showResult} />}
        {view === 'wrong' && <WrongView onStart={goExam} />}
        {view === 'history' && <HistoryView onReview={showResult} />}
        {view === 'result' &&
          (result ? (
            <ResultView record={result} onStart={goExam} />
          ) : (
            <HistoryView onReview={showResult} />
          ))}
      </main>
      <Toaster />
    </div>
  )
}

function Toaster() {
  const items = useToasts()
  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-lg',
            t.tone === 'ok' && 'border-ok/30 text-ok',
            t.tone === 'bad' && 'border-bad/30 text-bad',
            t.tone === 'default' && 'border-line text-ink-strong',
          )}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}
