import type { ConstructionModel, ConstructionStair } from '@/construction/model/constructionModel'

/** Поворот с шагом 90° для привязки объектов к сетке. */
export type QuarterRotation = 0 | 90 | 180 | 270

/** Нормализует поворот с шагом 90° в диапазон 0–270°. */
export function rotateQuarter(rotation: number, direction: -1 | 1 = 1): QuarterRotation {
  return ((rotation + direction * 90 + 360) % 360) as QuarterRotation
}

/** Меняет ось размещения стены при повороте на четверть оборота. */
export function rotateWallPlacement(rotation: 0 | 90): 0 | 90 {
  return rotation === 0 ? 90 : 0
}

/** Смещает копию лестницы, сохраняя её этаж и ориентацию. */
export function moveStairCandidate(
  model: ConstructionModel,
  index: number,
  dx: number,
  dy: number,
):
  | { stair: ConstructionStair; valid: true }
  | { valid: false; reason: 'missing' | 'unsupported' | 'occupied' } {
  // Лестницы, участвующие в текущей операции. Исходный объект перед преобразованием.
  const stairs = model.stairs ?? [],
    source = stairs[index]
  if (!source) return { valid: false, reason: 'missing' }
  // Этаж, для которого выполняется расчёт. Клетка строительной сетки для текущей проверки.
  const level = source.cell.level ?? 1,
    cell = { ...source.cell, x: source.cell.x + dx, y: source.cell.y + dy, level }
  if (!model.cells.some((item) => (item.level ?? 1) === level && item.x === cell.x && item.y === cell.y))
    return { valid: false, reason: 'unsupported' }
  if (
    stairs.some(
      (item, itemIndex) =>
        itemIndex !== index &&
        (item.cell.level ?? 1) === level &&
        item.cell.x === cell.x &&
        item.cell.y === cell.y,
    )
  )
    return { valid: false, reason: 'occupied' }
  return { valid: true, stair: { ...source, cell } }
}
