import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Workspace } from '@/components/workspace/Workspace'
import { DEFAULT_SPEC } from '@/domain/house/defaultSpec'
import type { HouseSpec } from '@/domain/house/houseTypes'
import { normalizeConstructionModel } from '@/construction/apertures/constructionApertures'
import '@/styles.css'

/** Хранит параметры дома и монтирует рабочую область. */
function App() {
  // Сохранённый снимок проекта из локального хранилища.
  const saved = localStorage.getItem('domovid-spec')
  // Текущие параметры дома и строительная модель.
  const [spec, setSpecState] = useState<HouseSpec>(() => {
    if (!saved) return DEFAULT_SPEC
    // Восстановленные из сохранённой строки параметры проекта.
    const parsed = JSON.parse(saved)
    return {
      ...DEFAULT_SPEC,
      ...parsed,
      construction: normalizeConstructionModel(parsed.construction ?? DEFAULT_SPEC.construction),
      doorConfigs: parsed.doorConfigs ?? {},
      doorInstances: parsed.doorInstances ?? [],
      openWalls: parsed.openWalls ?? [],
      windowConfigs: parsed.windowConfigs ?? {},
      roomLayouts: parsed.roomLayouts ?? {},
    }
  })
  /** Обновляет параметры дома и сохраняет снимок в localStorage. */
  const setSpec = (next: HouseSpec) => {
    setSpecState(next)
    localStorage.setItem('domovid-spec', JSON.stringify(next))
  }
  /** Очищает строительную модель и связанные настройки комнат. */
  const clear = () => {
    localStorage.removeItem('domovid-spec')
    setSpecState(DEFAULT_SPEC)
  }
  return <Workspace spec={spec} setSpec={setSpec} onReset={() => {}} onClear={clear} />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
