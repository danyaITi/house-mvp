/** Действие истории, распознанное по клавиатурному сочетанию. */
export type HistoryShortcut = 'undo' | 'redo' | null

/** Определяет отмену или повтор по Alt+Z и Alt+Y, игнорируя ввод в полях. */
export function historyShortcut(event: {
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  code: string
  key: string
}): HistoryShortcut {
  if (!event.ctrlKey && !event.metaKey && !event.altKey) return null
  // Код клавиши для распознавания команды.
  const code = event.code || `Key${event.key.toUpperCase()}`
  if (code === 'KeyZ') return (event.ctrlKey || event.metaKey) && event.shiftKey ? 'redo' : 'undo'
  if (code === 'KeyY') return 'redo'
  return null
}
