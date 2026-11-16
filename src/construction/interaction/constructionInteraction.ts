/** Инструменты, влияющие на подсветку объектов под указателем. */
export type ConstructionHoverTool =
  'select' | 'erase' | 'door' | 'window' | 'foundation' | 'build-wall' | 'stairs' | 'roof' | null

/** Разрешает подсветку при наведении стены с учётом инструмента, заполнения и переноса. */
export function shouldHighlightWall({
  objectDragActive,
  hasOpening,
  tool,
  isHovered,
}: {
  /** Признак переноса объекта, временно отключающий подсветку при наведении. */
  objectDragActive: boolean
  /** Признак установленного заполнения на сегменте. */
  hasOpening: boolean
  /** Активный инструмент, определяющий реакцию на указатель. */
  tool: ConstructionHoverTool
  /** Находится ли указатель над объектом. */
  isHovered: boolean
}) {
  return !objectDragActive && !hasOpening && isHovered && (tool === 'select' || tool === 'erase')
}

/** Разрешает подсветку заполнения, исключая одновременный подсветку при наведении стены. */
export function shouldHighlightOpening({
  objectDragActive,
  hasOpening,
  isCoveredSegmentHovered,
}: {
  /** Признак переноса объекта, временно отключающий подсветку при наведении. */
  objectDragActive: boolean
  /** Признак установленного заполнения на сегменте. */
  hasOpening: boolean
  /** Наводится ли указатель на сегмент под заполнением. */
  isCoveredSegmentHovered: boolean
}) {
  return !objectDragActive && hasOpening && isCoveredSegmentHovered
}

/** Разрешает подсветку при наведении проёма только в подходящем режиме взаимодействия. */
export function shouldHighlightStandaloneAperture(
  tool: string | null,
  kind: 'door' | 'window',
  objectDragActive: boolean,
) {
  return !objectDragActive && (tool === 'select' || tool === kind)
}

/** Отличает перенос от клика по расстоянию между началом и концом жеста. */
export function hasPointerDrag(
  start: { x: number; y: number },
  current: { x: number; y: number },
  threshold = 6,
) {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold
}

/** Распознаёт Escape вне редактируемых полей для отмены инструмента. */
export function isBuildToolCancelInput(input: { key?: string; button?: number; editable?: boolean }) {
  return !input.editable && input.key === 'Escape'
}

/** Расширяет плоскость указателя относительно рабочей сетки для построения стен. */
export function constructionPointerPlaneSize(
  tool: string | null,
  width: number,
  depth: number,
): [number, number] {
  // Построение может начинаться вне плиты, но выделение разрешено только в области объектов.
  const placementTool = tool === 'build-wall' || tool === 'door-aperture' || tool === 'window-aperture'
  return placementTool ? [Math.max(width, depth) * 20, Math.max(width, depth) * 20] : [width, depth]
}

/** Определяет, нужно ли начать перенос выбранных стен через их заполнение. */
export function shouldDragSelectedWallsFromOpening({
  additive,
  wantsWall,
  selectionKind,
  coveredWallKeys,
  selectedWallKeys,
}: {
  /** Добавлять объект к выделению вместо замены выделения. */
  additive: boolean
  /** Выбирать стену вместо её заполнения. */
  wantsWall: boolean
  /** Тип объектов в текущем выделении. */
  selectionKind: string | null
  /** Ключи стен, занимаемых заполнением. */
  coveredWallKeys: readonly string[]
  /** Ключи выделенных стен. */
  selectedWallKeys: readonly string[]
}) {
  return (
    !additive &&
    !wantsWall &&
    selectionKind === 'walls' &&
    coveredWallKeys.some((key) => selectedWallKeys.includes(key))
  )
}

/** Объединяет ключи стен под заполнением с текущим выделением. */
export function selectCoveredWallKeys(
  current: readonly string[],
  covered: readonly string[],
  additive: boolean,
) {
  if (!additive) return [...covered]
  // Включает ли выделение все сегменты, необходимые для операции.
  const allSelected = covered.every((key) => current.includes(key))
  return allSelected
    ? current.filter((key) => !covered.includes(key))
    : [...new Set([...current, ...covered])]
}
