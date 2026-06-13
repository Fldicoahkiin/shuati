import { useSyncExternalStore } from 'react'

export interface ToastItem {
  id: number
  msg: string
  tone: 'default' | 'ok' | 'bad'
}

let items: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function toast(msg: string, tone: ToastItem['tone'] = 'default', ms = 2400) {
  const id = ++seq
  items = [...items, { id, msg, tone }]
  emit()
  setTimeout(() => {
    items = items.filter((t) => t.id !== id)
    emit()
  }, ms)
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => items,
  )
}
