import {
  constructionOpeningWalls,
  constructionOpeningWidth,
  wallKey,
  type ConstructionModel,
  type ConstructionOpening,
  type ConstructionWall,
} from '@/construction/model/constructionModel'

/** Геометрия выреза в стене для окна или двери. */
export type ConstructionAperture = {
  kind: 'door-aperture' | 'window-aperture'
  size: 'small' | 'large'
  wall: ConstructionWall
  walls: ConstructionWall[]
  spanDirection?: -1 | 1
}

/** Вычисляет сегменты и размеры выреза для выбранного заполнения. */
export function constructionApertureForOpening(opening: ConstructionOpening): ConstructionAperture {
  // Вариант объекта, занимающий несколько сегментов.
  const large = constructionOpeningWidth(opening) === 2
  return {
    kind: opening.kind === 'door' ? 'door-aperture' : 'window-aperture',
    size: large ? 'large' : 'small',
    wall: opening.wall,
    walls: constructionOpeningWalls(opening),
    ...(large ? { spanDirection: opening.spanDirection ?? 1 } : {}),
  }
}

/** Проверяет, пересекает ли вырез стык поперечных стен. */
export function apertureCrossesWallJunction(model: ConstructionModel, aperture: ConstructionAperture) {
  if (aperture.size === 'small') return false
  // Направление поиска допустимого размещения.
  const direction = aperture.spanDirection ?? 1
  // Этаж, для которого выполняется расчёт.
  const level = aperture.wall.level ?? 1
  // Стены, примыкающие к рассматриваемому стыку.
  const junctionWalls =
    aperture.wall.axis === 'h'
      ? [
          {
            axis: 'v' as const,
            x: aperture.wall.x + (direction === 1 ? 1 : 0),
            y: aperture.wall.y - 1,
            level,
          },
          { axis: 'v' as const, x: aperture.wall.x + (direction === 1 ? 1 : 0), y: aperture.wall.y, level },
        ]
      : [
          {
            axis: 'h' as const,
            x: aperture.wall.x - 1,
            y: aperture.wall.y + (direction === 1 ? 1 : 0),
            level,
          },
          { axis: 'h' as const, x: aperture.wall.x, y: aperture.wall.y + (direction === 1 ? 1 : 0), level },
        ]
  // Ключи сегментов стен для проверки занятости.
  const wallKeys = new Set(model.walls.map(wallKey))
  return junctionWalls.some((wall) => wallKeys.has(wallKey(wall)))
}

/** Проверяет наличие стен и отсутствие конфликтов на всём пролёте выреза. */
export function apertureFits(
  model: ConstructionModel,
  aperture: ConstructionAperture,
  occupied = new Set<string>(),
) {
  // Сегменты стен, участвующие в текущей операции.
  const walls = new Set(model.walls.map(wallKey))
  return (
    aperture.walls.every((wall) => walls.has(wallKey(wall)) && !occupied.has(wallKey(wall))) &&
    !apertureCrossesWallJunction(model, aperture)
  )
}

/** Удаляет объекты без опоры и приводит связанные проёмы к согласованному состоянию. */
export function normalizeConstructionModel(model: ConstructionModel): ConstructionModel {
  // Объекты или позиции, занимающие проверяемое место.
  const occupied = new Set<string>()
  // Заполнения стен, участвующие в текущей операции.
  const openings = (model.openings ?? []).filter((opening) => {
    // Отдельный проём для проверки или изменения.
    const aperture = constructionApertureForOpening(opening)
    if (!apertureFits(model, aperture, occupied)) return false
    aperture.walls.forEach((wall) => occupied.add(wallKey(wall)))
    return true
  })
  return openings.length === (model.openings ?? []).length ? model : { ...model, openings }
}
