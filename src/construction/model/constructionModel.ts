import { openingSegmentCount } from '@/construction/rules/constructionRules'

/** Номер этажа, начиная с единицы. */
export type ConstructionLevel = number
/** Единичная клетка пола с этажом и материалом. */
export type FoundationCell = {
  x: number
  y: number
  level?: ConstructionLevel
  material?: 'concrete' | 'slab' | 'wood'
}
/** Сегмент стены длиной в одну клетку сетки. */
export type ConstructionWall = {
  axis: 'h' | 'v'
  x: number
  y: number
  level?: ConstructionLevel
  material?: 'aerated' | 'brick' | 'frame' | 'timber'
}
/** Окно или дверь, привязанные к сегменту стены. */
export type ConstructionOpening = {
  kind: 'door' | 'window'
  wall: ConstructionWall
  style?: string
  material?: string
  spanDirection?: -1 | 1
}
/** Самостоятельный проём с типом, геометрией и необязательным заполнением. */
export type StandaloneAperture = {
  id: string
  kind: 'door' | 'window'
  size: 'small' | 'large'
  axis: 'h' | 'v'
  x: number
  y: number
  level?: ConstructionLevel
  material?: ConstructionWall['material']
  fixture?: { style: string; material: string }
}
/** Доступные формы лестничного марша. */
export type StairShape = 'straight' | 'l' | 'u' | 'spiral'
/** Лестница с опорной клеткой, формой и поворотом. */
export type ConstructionStair = { cell: FoundationCell; shape: StairShape; rotation?: 0 | 90 | 180 | 270 }
/** Полное состояние построенного дома в координатах сетки. */
export type ConstructionModel = {
  width: number
  depth: number
  cells: FoundationCell[]
  walls: ConstructionWall[]
  openings?: ConstructionOpening[]
  apertures?: StandaloneAperture[]
  stairs?: ConstructionStair[]
  roof?: boolean
  roofStyle?: 'gable' | 'hip' | 'flat'
  roofMaterial?: 'metal' | 'tile' | 'soft'
}
/** Связная область клеток, ограниченная стенами. */
export type GeneratedZone = {
  id: string
  x: number
  y: number
  w: number
  h: number
  cells: number
  floor: ConstructionLevel
}

/** Кодирует этаж и координаты клетки в устойчивый ключ. */
export const cellKey = (cell: FoundationCell) => `${cell.level ?? 1}:${cell.x}:${cell.y}`
/** Кодирует этаж, ось и координаты стены в устойчивый ключ. */
export const wallKey = (wall: ConstructionWall) => `${wall.level ?? 1}:${wall.axis}:${wall.x}:${wall.y}`

/** Возвращает ширину заполнения по его типу. */
export function constructionOpeningWidth(opening: Pick<ConstructionOpening, 'kind' | 'style'>) {
  return openingSegmentCount(opening.kind, opening.style)
}

/** Возвращает сегменты стен, занимаемые окном или дверью. */
export function constructionOpeningWalls(
  opening: Pick<ConstructionOpening, 'kind' | 'style' | 'wall' | 'spanDirection'>,
) {
  if (constructionOpeningWidth(opening) === 1) return [opening.wall]
  // Направление поиска допустимого размещения.
  const direction = opening.spanDirection ?? 1
  return [
    opening.wall,
    opening.wall.axis === 'h'
      ? { ...opening.wall, x: opening.wall.x + direction }
      : { ...opening.wall, y: opening.wall.y + direction },
  ]
}

/** Вычисляет начало и конец заполнения вдоль стены. */
export function constructionOpeningSpan(
  opening: Pick<ConstructionOpening, 'kind' | 'style' | 'spanDirection'>,
) {
  // Размер геометрии по соответствующей оси.
  const width = constructionOpeningWidth(opening)
  return opening.spanDirection === -1 && width === 2 ? { start: -1, end: 1 } : { start: 0, end: width }
}

/** Добавляет клетку пола или удаляет существующую по её ключу. */
export function toggleCell(cells: FoundationCell[], cell: FoundationCell) {
  // Ключ объекта для поиска и сравнения в коллекциях.
  const key = cellKey(cell)
  return cells.some((item) => cellKey(item) === key)
    ? cells.filter((item) => cellKey(item) !== key)
    : [...cells, cell]
}

/** Добавляет или удаляет единичный сегмент стены. */
export function toggleConstructionWall(walls: ConstructionWall[], wall: ConstructionWall) {
  // Ключ объекта для поиска и сравнения в коллекциях.
  const key = wallKey(wall)
  return walls.some((item) => wallKey(item) === key)
    ? walls.filter((item) => wallKey(item) !== key)
    : [...walls, wall]
}

/** Перечисляет клетки внутри прямоугольника между двумя точками. */
export function rectangleCells(a: FoundationCell, b: FoundationCell): FoundationCell[] {
  // Клетки пола, участвующие в текущей операции.
  const cells: FoundationCell[] = []
  // Координата объекта по соответствующей оси.
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++)
    // Координата объекта по соответствующей оси.
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) cells.push({ x, y })
  return cells
}

/** Объединяет клетки по ключам, исключая дубликаты. */
export function mergeCells(cells: FoundationCell[], added: FoundationCell[]) {
  return [...new Map([...cells, ...added].map((cell) => [cellKey(cell), cell])).values()]
}

/** Строит последовательность сегментов стены между точками сетки. */
export function lineWalls(start: ConstructionWall, end: ConstructionWall): ConstructionWall[] {
  // Сегменты стен, участвующие в текущей операции.
  const walls: ConstructionWall[] = []
  if (start.axis === 'h')
    // Координата объекта по соответствующей оси.
    for (let x = Math.min(start.x, end.x); x <= Math.max(start.x, end.x); x++)
      walls.push({
        axis: 'h',
        x,
        y: start.y,
        ...(start.level ? { level: start.level } : {}),
        ...(start.material ? { material: start.material } : {}),
      })
  else
    // Координата объекта по соответствующей оси.
    for (let y = Math.min(start.y, end.y); y <= Math.max(start.y, end.y); y++)
      walls.push({
        axis: 'v',
        x: start.x,
        y,
        ...(start.level ? { level: start.level } : {}),
        ...(start.material ? { material: start.material } : {}),
      })
  return walls
}

/** Объединяет сегменты стен по ключам, исключая дубликаты. */
export function mergeWalls(walls: ConstructionWall[], added: ConstructionWall[]) {
  return [...new Map([...walls, ...added].map((wall) => [wallKey(wall), wall])).values()]
}

/** Проверяет наличие пола хотя бы с одной стороны стены. */
export function wallSupported(cells: FoundationCell[], wall: ConstructionWall) {
  // Ключи элементов для быстрого поиска совпадений.
  const keys = new Set(cells.map(cellKey))
  // Этаж, для которого выполняется расчёт.
  const level = wall.level ?? 1
  return wall.axis === 'h'
    ? keys.has(`${level}:${wall.x}:${wall.y - 1}`) || keys.has(`${level}:${wall.x}:${wall.y}`)
    : keys.has(`${level}:${wall.x - 1}:${wall.y}`) || keys.has(`${level}:${wall.x}:${wall.y}`)
}

/** Оставляет стены, имеющие опору на клетки пола. */
export function supportedWalls(cells: FoundationCell[], walls: ConstructionWall[]) {
  return walls.filter((wall) => wallSupported(cells, wall))
}

/** Находит сегменты стен внутри прямоугольной области. */
export function wallsInRectangle(walls: ConstructionWall[], a: FoundationCell, b: FoundationCell) {
  // Граница обрабатываемой области по оси сетки.
  const minX = Math.min(a.x, b.x),
    maxX = Math.max(a.x, b.x),
    minY = Math.min(a.y, b.y),
    maxY = Math.max(a.y, b.y)
  // Этаж, для которого выполняется расчёт.
  const level = a.level ?? 1
  return walls.filter((wall) => {
    if ((wall.level ?? 1) !== level) return false
    return wall.axis === 'h'
      ? wall.x >= minX && wall.x <= maxX && wall.y >= minY && wall.y <= maxY + 1
      : wall.x >= minX && wall.x <= maxX + 1 && wall.y >= minY && wall.y <= maxY
  })
}

/** Меняет размер рабочей области и удаляет объекты за её границами. */
export function resizeConstruction(
  model: ConstructionModel,
  width: number,
  depth: number,
): ConstructionModel {
  // Размер рабочей области после изменения.
  const nextWidth = Math.max(6, Math.min(225, Math.round(width))),
    nextDepth = Math.max(6, Math.min(225, Math.round(depth)))
  // Клетки пола, участвующие в текущей операции.
  const cells = model.cells.filter(
    (cell) => cell.x >= 0 && cell.x < nextWidth && cell.y >= 0 && cell.y < nextDepth,
  )
  // Сегменты стен, участвующие в текущей операции.
  const walls = supportedWalls(
    cells,
    model.walls.filter((wall) => wall.x >= 0 && wall.x <= nextWidth && wall.y >= 0 && wall.y <= nextDepth),
  )
  // Модель после изменения размеров рабочей области.
  const resized: ConstructionModel = { ...model, width: nextWidth, depth: nextDepth, cells, walls }
  if (model.openings) {
    // Ключи элементов для быстрого поиска совпадений.
    const keys = new Set(walls.map(wallKey))
    resized.openings = model.openings.filter((opening) =>
      constructionOpeningWalls(opening).every((wall) => keys.has(wallKey(wall))),
    )
  }
  if (model.stairs) {
    // Ключи клеток основания для проверки связности.
    const baseKeys = new Set(
      cells.filter((cell) => (cell.level ?? 1) === 1).map((cell) => `${cell.x}:${cell.y}`),
    )
    resized.stairs = model.stairs.filter((stair) => baseKeys.has(`${stair.cell.x}:${stair.cell.y}`))
  }
  return resized
}

/** Определяет стену между двумя соседними клетками. */
function separatingWall(a: FoundationCell, b: FoundationCell): ConstructionWall {
  if (a.x !== b.x) return { axis: 'v', x: Math.max(a.x, b.x), y: a.y, level: a.level }
  return { axis: 'h', x: a.x, y: Math.max(a.y, b.y), level: a.level }
}

/** Обходит соседние клетки без разделяющих стен и объединяет их в комнаты. */
export function generateZones(model: ConstructionModel): GeneratedZone[] {
  // Элементы, оставшиеся после удаления обработанных.
  const remaining = new Map(model.cells.map((cell) => [cellKey(cell), cell]))
  // Сегменты стен, участвующие в текущей операции.
  const walls = new Set(model.walls.map(wallKey))
  // Связные области пола, образующие комнаты.
  const zones: GeneratedZone[] = []
  while (remaining.size) {
    // Начальная клетка обхода связной области.
    const start = remaining.values().next().value as FoundationCell
    // Очередь клеток, ожидающих обхода. Клетки текущей связной области.
    const queue = [start],
      component: FoundationCell[] = []
    remaining.delete(cellKey(start))
    while (queue.length) {
      // Клетка строительной сетки для текущей проверки.
      const cell = queue.shift()!
      component.push(cell)
      // Следующее состояние после применения изменения.
      for (const next of [
        { x: cell.x - 1, y: cell.y, level: cell.level },
        { x: cell.x + 1, y: cell.y, level: cell.level },
        { x: cell.x, y: cell.y - 1, level: cell.level },
        { x: cell.x, y: cell.y + 1, level: cell.level },
      ]) {
        // Ключ объекта для поиска и сравнения в коллекциях.
        const key = cellKey(next)
        if (!remaining.has(key) || walls.has(wallKey(separatingWall(cell, next)))) continue
        remaining.delete(key)
        queue.push(next)
      }
    }
    // Координаты клеток для вычисления габаритов.
    const xs = component.map((cell) => cell.x),
      ys = component.map((cell) => cell.y)
    // Координата объекта по соответствующей оси.
    const x = Math.min(...xs),
      y = Math.min(...ys)
    // Этаж, для которого выполняется расчёт.
    const floor = (start.level ?? 1) as ConstructionLevel
    zones.push({
      id: `built-room-${floor}-${zones.length + 1}`,
      x,
      y,
      w: Math.max(...xs) - x + 1,
      h: Math.max(...ys) - y + 1,
      cells: component.length,
      floor,
    })
  }
  return zones
}
