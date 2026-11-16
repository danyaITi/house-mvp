import type { ConstructionModel, ConstructionStair } from '@/construction/model/constructionModel'

/** Возвращает этаж объекта, считая отсутствующее значение первым этажом. */
const levelOf = (item: { level?: number }) => item.level ?? 1

/** Собирает и сортирует этажи, представленные в модели. */
export function getConstructionLevels(model: ConstructionModel) {
  return [...new Set(model.cells.map(levelOf))].sort((a, b) => a - b)
}

/** Определяет этажи для показа дома с улицы. */
export function getExteriorLevels(model: ConstructionModel) {
  // Этажи, на которых есть строительные объекты.
  const levels = [...new Set(model.walls.map(levelOf))].sort((a, b) => a - b)
  if (!levels.includes(1)) levels.unshift(1)
  return levels
}

/** Выбирает существующий этаж, ближайший к запрошенному. */
export function getActiveConstructionLevel(model: ConstructionModel, currentLevel: number) {
  // Этажи, на которых есть строительные объекты.
  const levels = getConstructionLevels(model)
  return levels.includes(currentLevel) ? currentLevel : (levels[0] ?? 1)
}

/** Проверяет наличие объектов на этаже перед его автоматическим удалением. */
export function hasConstructionObjectsAtLevel(
  model: ConstructionModel,
  level: number,
  stairs: ConstructionStair[] = model.stairs ?? [],
) {
  return (
    model.walls.some((wall) => levelOf(wall) === level) ||
    (model.openings ?? []).some((opening) => levelOf(opening.wall) === level) ||
    (model.apertures ?? []).some((aperture) => levelOf(aperture) === level) ||
    stairs.some((stair) => levelOf(stair.cell) === level)
  )
}

/** Строит представление сетки для активного этажа. */
export function getConstructionGrid(model: ConstructionModel, level: number) {
  // Размер геометрии по соответствующей оси.
  const width = model.width || 12,
    depth = model.depth || 10
  if (level <= 1) return { width, depth, x: 0, z: 0 }
  // Есть ли у объекта требуемая опора на пол.
  const support = model.cells.filter((cell) => levelOf(cell) === level - 1)
  if (!support.length) return { width, depth, x: 0, z: 0 }
  // Граница обрабатываемой области по оси сетки.
  const minX = Math.min(...support.map((cell) => cell.x)),
    maxX = Math.max(...support.map((cell) => cell.x))
  // Граница обрабатываемой области по оси сетки.
  const minY = Math.min(...support.map((cell) => cell.y)),
    maxY = Math.max(...support.map((cell) => cell.y))
  return {
    width: maxX - minX + 1,
    depth: maxY - minY + 1,
    x: (minX + maxX + 1) / 2 - width / 2,
    z: (minY + maxY + 1) / 2 - depth / 2,
  }
}
