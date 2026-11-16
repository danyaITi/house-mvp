import type { ConstructionModel, StandaloneAperture } from '@/construction/model/constructionModel'

/** Проецирует пролёт отдельного проёма на отрезок 2D-плана. */
export function planApertureLine(aperture: StandaloneAperture, dx = 0, dy = 0) {
  // Границы заполнения вдоль сегмента стены. Координата конца отрезка в плоскости строительной сетки.
  const span = aperture.size === 'large' ? 2 : 1,
    x1 = aperture.x + dx,
    y1 = aperture.y + dy
  return { x1, y1, x2: aperture.axis === 'h' ? x1 + span : x1, y2: aperture.axis === 'v' ? y1 + span : y1 }
}

/** Проецирует установленное заполнение на линию внутри проёма. */
export function planApertureFixtureLine(aperture: StandaloneAperture, inset = 0.06) {
  if (!aperture.fixture) return null
  // Конечные точки линии проёма на двумерном плане.
  const { x1, y1, x2, y2 } = planApertureLine(aperture)
  return {
    x1: x1 + (aperture.axis === 'h' ? inset : 0),
    y1: y1 + (aperture.axis === 'v' ? inset : 0),
    x2: x2 - (aperture.axis === 'h' ? inset : 0),
    y2: y2 - (aperture.axis === 'v' ? inset : 0),
  }
}

/** Находит лестницы нижнего этажа, создающие вырезы в текущем перекрытии. */
export function stairOpeningsAtLevel(model: ConstructionModel, level: number) {
  return (model.stairs ?? [])
    .map((stair, index) => ({ stair, index }))
    .filter(({ stair }) => (stair.cell.level ?? 1) + 1 === level)
}
