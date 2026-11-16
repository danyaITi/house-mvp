import type { ReactNode } from 'react'

/** Показывает SVG-значок действия по имени. */
export function Icon({
  name,
}: {
  /** Имя SVG-значка действия. */
  name: 'home' | 'rotate' | 'undo' | 'redo' | 'reset' | 'info' | 'arrow'
}) {
  // Геометрия значков, выбираемая по имени действия.
  const paths: Record<typeof name, ReactNode> = {
    home: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10M9 20v-6h6v6" />
      </>
    ),
    rotate: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M18.5 16a7 7 0 1 1 .8-7.7L20 12" />
      </>
    ),
    undo: (
      <>
        <path d="m9 7-5 5 5 5" />
        <path d="M20 17a7 7 0 0 0-7-7H4" />
      </>
    ),
    redo: (
      <>
        <path d="m15 7 5 5-5 5" />
        <path d="M4 17a7 7 0 0 1 7-7h9" />
      </>
    ),
    reset: (
      <>
        <path d="M4 4v6h6" />
        <path d="M5.6 15a7 7 0 1 0 .7-7.8L4 10" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.1" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}
