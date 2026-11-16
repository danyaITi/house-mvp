import {
  mergeCells,
  mergeWalls,
  constructionOpeningWalls,
  constructionOpeningWidth,
  resizeConstruction,
  supportedWalls,
  wallKey,
  wallSupported,
  type ConstructionModel,
  type ConstructionOpening,
  type ConstructionStair,
  type ConstructionWall,
  type FoundationCell,
} from '@/construction/model/constructionModel'
import { apertureFits, constructionApertureForOpening } from '@/construction/apertures/constructionApertures'
import {
  standaloneApertureFits,
  wallConflictsWithStandaloneAperture,
} from '@/construction/standalone-apertures/standaloneApertures'
import { hasConstructionObjectsAtLevel } from '@/construction/levels/constructionLevels'

/** Допустимые изменения строительной модели с параметрами каждого действия. */
export type ConstructionCommand =
  | { type: 'add-cells'; cells: FoundationCell[] }
  | { type: 'remove-cells'; cells: FoundationCell[] }
  | { type: 'add-walls'; walls: ConstructionWall[] }
  | { type: 'remove-walls'; walls: ConstructionWall[] }
  | { type: 'add-opening'; opening: ConstructionOpening }
  | { type: 'remove-opening'; wall: ConstructionWall }
  | { type: 'move-opening'; from: ConstructionWall; to: ConstructionWall }
  | { type: 'update-opening'; wall: ConstructionWall; change: Partial<ConstructionOpening> }
  | { type: 'add-stair'; stair: ConstructionStair }
  | { type: 'remove-stair'; index: number }
  | { type: 'update-stair'; index: number; change: Partial<ConstructionStair> }
  | {
      type: 'set-roof'
      roof: boolean
      roofStyle?: ConstructionModel['roofStyle']
      roofMaterial?: ConstructionModel['roofMaterial']
    }
  | { type: 'resize'; width: number; depth: number }

/** Собирает ключи сегментов стены, занятых окном или дверью. */
const openingKeys = (opening: ConstructionOpening) => constructionOpeningWalls(opening).map(wallKey)

/** Проверяет опору и свободные сегменты перед установкой окна или двери. */
export function fitConstructionOpening(
  model: ConstructionModel,
  opening: ConstructionOpening,
  ignoreOpening?: ConstructionOpening,
): ConstructionOpening | null {
  // Ключи сегментов стен для проверки занятости.
  const wallKeys = new Set(model.walls.map(wallKey))
  // Объекты или позиции, занимающие проверяемое место.
  const occupied = new Set(
    (model.openings ?? []).filter((item) => item !== ignoreOpening).flatMap(openingKeys),
  )
  // Направления перебора соседних позиций.
  const directions: ReadonlyArray<-1 | 1> =
    constructionOpeningWidth(opening) === 1 ? [1] : opening.spanDirection ? [opening.spanDirection] : [1, -1]
  // Направление протяжённости заполнения от опорной стены.
  for (const spanDirection of directions) {
    // Предлагаемое состояние объекта перед проверкой допустимости.
    const candidate = { ...opening, spanDirection }
    // Ключи элементов для быстрого поиска совпадений.
    const keys = openingKeys(candidate)
    if (
      keys.every((key) => wallKeys.has(key) && !occupied.has(key)) &&
      apertureFits(model, constructionApertureForOpening(candidate), occupied)
    )
      return constructionOpeningWidth(candidate) === 1
        ? { ...candidate, spanDirection: undefined }
        : candidate
  }
  return null
}

/** Применяет одну команду строительства, проверяя ограничения модели. */
export function applyConstructionCommand(
  model: ConstructionModel,
  command: ConstructionCommand,
): ConstructionModel {
  // Заполнения стен, участвующие в текущей операции. Лестницы, участвующие в текущей операции.
  const openings = model.openings ?? [],
    stairs = model.stairs ?? []
  switch (command.type) {
    case 'add-cells':
      return { ...model, cells: mergeCells(model.cells, command.cells) }
    case 'remove-cells': {
      // Результат удаления объекта из модели.
      const removed = new Set(command.cells.map((cell) => `${cell.level ?? 1}:${cell.x}:${cell.y}`))
      // Клетки пола, участвующие в текущей операции.
      const cells = model.cells.filter((cell) => !removed.has(`${cell.level ?? 1}:${cell.x}:${cell.y}`))
      // Сегменты стен, участвующие в текущей операции. Ключи сегментов стен для проверки занятости.
      const walls = supportedWalls(cells, model.walls),
        wallKeys = new Set(walls.map(wallKey))
      // Отдельные проёмы не принадлежат стенам, поэтому их опору нужно проверять отдельно.
      const apertureSupportModel = { ...model, cells, walls, apertures: [] }
      // Отдельные проёмы, участвующие в текущей операции.
      const apertures = (model.apertures ?? []).filter((aperture) =>
        standaloneApertureFits(apertureSupportModel, aperture),
      )
      return {
        ...model,
        cells,
        walls,
        apertures,
        openings: openings.filter((opening) => openingKeys(opening).every((key) => wallKeys.has(key))),
        stairs: stairs.filter((stair) =>
          cells.some(
            (cell) =>
              (cell.level ?? 1) === (stair.cell.level ?? 1) &&
              cell.x === stair.cell.x &&
              cell.y === stair.cell.y,
          ),
        ),
      }
    }
    case 'add-walls':
      return {
        ...model,
        walls: mergeWalls(
          model.walls,
          command.walls.filter((wall) => !wallConflictsWithStandaloneAperture(model, wall)),
        ),
      }
    case 'remove-walls': {
      // Результат удаления объекта из модели.
      const removed = new Set(command.walls.map(wallKey))
      return {
        ...model,
        walls: model.walls.filter((wall) => !removed.has(wallKey(wall))),
        openings: openings.filter((opening) => openingKeys(opening).every((key) => !removed.has(key))),
      }
    }
    case 'add-opening': {
      // Окно или дверь, участвующие в текущем действии.
      const opening = fitConstructionOpening(model, command.opening)
      return opening ? { ...model, openings: [...openings, opening] } : model
    }
    case 'remove-opening':
      return {
        ...model,
        openings: openings.filter((opening) => !openingKeys(opening).includes(wallKey(command.wall))),
      }
    case 'move-opening': {
      // Исходный объект перед преобразованием.
      const source = openings.find((opening) => openingKeys(opening).includes(wallKey(command.from)))
      if (!source) return model
      // Состояние объекта после переноса.
      const moved = fitConstructionOpening(
        model,
        { ...source, wall: command.to, spanDirection: undefined },
        source,
      )
      return moved
        ? { ...model, openings: openings.map((opening) => (opening === source ? moved : opening)) }
        : model
    }
    case 'update-opening': {
      // Исходный объект перед преобразованием.
      const source = openings.find((opening) => openingKeys(opening).includes(wallKey(command.wall)))
      if (!source) return model
      // Состояние после изменения параметров объекта.
      const updated = fitConstructionOpening(
        model,
        {
          ...source,
          ...command.change,
          wall: source.wall,
          spanDirection: command.change.style ? undefined : source.spanDirection,
        },
        source,
      )
      return updated
        ? { ...model, openings: openings.map((opening) => (opening === source ? updated : opening)) }
        : model
    }
    case 'add-stair':
      return stairs.some(
        (stair) =>
          (stair.cell.level ?? 1) === (command.stair.cell.level ?? 1) &&
          stair.cell.x === command.stair.cell.x &&
          stair.cell.y === command.stair.cell.y,
      )
        ? model
        : { ...model, stairs: [...stairs, command.stair] }
    case 'remove-stair': {
      // Результат удаления объекта из модели.
      const removed = stairs[command.index]
      // Лестницы после применения изменения.
      const nextStairs = stairs.filter((_, index) => index !== command.index)
      if (!removed) return model
      // Этаж, расположенный непосредственно над лестницей.
      const upperLevel = (removed.cell.level ?? 1) + 1
      // Есть ли другая лестница, ведущая на верхний этаж.
      const anotherAccess = nextStairs.some((stair) => (stair.cell.level ?? 1) === (removed.cell.level ?? 1))
      if (anotherAccess || hasConstructionObjectsAtLevel(model, upperLevel, nextStairs))
        return { ...model, stairs: nextStairs }
      return {
        ...model,
        stairs: nextStairs,
        cells: model.cells.filter((cell) => (cell.level ?? 1) !== upperLevel),
        walls: model.walls.filter((wall) => (wall.level ?? 1) !== upperLevel),
        openings: openings.filter((opening) => (opening.wall.level ?? 1) !== upperLevel),
        apertures: (model.apertures ?? []).filter((aperture) => (aperture.level ?? 1) !== upperLevel),
      }
    }
    case 'update-stair':
      return {
        ...model,
        stairs: stairs.map((stair, index) =>
          index === command.index ? { ...stair, ...command.change } : stair,
        ),
      }
    case 'set-roof':
      return {
        ...model,
        roof: command.roof,
        ...(command.roofStyle ? { roofStyle: command.roofStyle } : {}),
        ...(command.roofMaterial ? { roofMaterial: command.roofMaterial } : {}),
      }
    case 'resize':
      return resizeConstruction(model, command.width, command.depth)
  }
}

/** Последовательно применяет команды к результату предыдущего шага. */
export function applyConstructionCommands(model: ConstructionModel, commands: ConstructionCommand[]) {
  return commands.reduce(applyConstructionCommand, model)
}

/** Добавляет лестницу и создаёт пол следующего этажа. */
export function addStairWithUpperFloor(
  model: ConstructionModel,
  stair: ConstructionStair,
): ConstructionModel {
  // Модель с лестницей для проверки связанных этажей.
  const withStair = applyConstructionCommand(model, { type: 'add-stair', stair })
  // Этаж исходного объекта до преобразования. Этаж, расположенный непосредственно над лестницей.
  const sourceLevel = stair.cell.level ?? 1,
    upperLevel = sourceLevel + 1
  if (withStair === model || withStair.cells.some((cell) => (cell.level ?? 1) === upperLevel))
    return withStair
  // Клетки перекрытия, создаваемые над лестницей.
  const upperFloor = withStair.cells
    .filter((cell) => (cell.level ?? 1) === sourceLevel)
    .map((cell) => ({ ...cell, level: upperLevel, material: 'slab' as const }))
  return applyConstructionCommand(withStair, { type: 'add-cells', cells: upperFloor })
}

/** Сопоставляет старое выделение стен с ключами после преобразования. */
export function updateWallSelection(current: string[], wallKey: string, additive: boolean) {
  if (!additive) return [wallKey]
  return current.includes(wallKey) ? current.filter((key) => key !== wallKey) : [...current, wallKey]
}

/** Ищет свободное место для копии окна или двери рядом с исходным. */
export function duplicateConstructionOpening(
  model: ConstructionModel,
  sourceWall: ConstructionWall,
): { model: ConstructionModel; wall: ConstructionWall } | null {
  // Исходный объект перед преобразованием.
  const source = (model.openings ?? []).find((opening) => openingKeys(opening).includes(wallKey(sourceWall)))
  if (!source) return null
  // Объекты или позиции, занимающие проверяемое место.
  const occupied = new Set((model.openings ?? []).flatMap(openingKeys))
  /** Вычисляет середину сегмента для сравнения расстояний до кандидатов. */
  const center = (wall: ConstructionWall) => ({
    x: wall.x + (wall.axis === 'h' ? 0.5 : 0),
    y: wall.y + (wall.axis === 'v' ? 0.5 : 0),
  })
  // Исходная точка, относительно которой вычисляется преобразование.
  const origin = center(source.wall)
  // Целевой объект или точка текущего действия.
  const target = model.walls
    .filter(
      (wall) =>
        (wall.level ?? 1) === (source.wall.level ?? 1) &&
        !occupied.has(wallKey(wall)) &&
        Boolean(fitConstructionOpening(model, { ...source, wall, spanDirection: undefined })),
    )
    .map((wall) => {
      // Точка в локальных координатах рабочей плоскости.
      const point = center(wall)
      return {
        wall,
        score:
          Math.abs(point.x - origin.x) +
          Math.abs(point.y - origin.y) +
          (wall.axis === source.wall.axis ? 0 : 0.25),
      }
    })
    .sort((a, b) => a.score - b.score || wallKey(a.wall).localeCompare(wallKey(b.wall)))[0]?.wall
  if (!target) return null
  return {
    model: applyConstructionCommand(model, {
      type: 'add-opening',
      opening: { ...source, wall: target, spanDirection: undefined },
    }),
    wall: target,
  }
}

/** Ищет допустимую клетку для копии лестницы и создаёт верхний этаж. */
export function duplicateConstructionStair(
  model: ConstructionModel,
  sourceIndex: number,
): { model: ConstructionModel; index: number } | null {
  // Лестницы, участвующие в текущей операции. Исходный объект перед преобразованием.
  const stairs = model.stairs ?? [],
    source = stairs[sourceIndex]
  if (!source) return null
  // Объекты или позиции, занимающие проверяемое место.
  const occupied = new Set(
    stairs
      .filter((stair) => (stair.cell.level ?? 1) === (source.cell.level ?? 1))
      .map((stair) => `${stair.cell.x}:${stair.cell.y}`),
  )
  // Целевой объект или точка текущего действия.
  const target = model.cells
    .filter((cell) => (cell.level ?? 1) === (source.cell.level ?? 1) && !occupied.has(`${cell.x}:${cell.y}`))
    .sort((a, b) => {
      // Расстояние до одного из кандидатов для выбора ближайшего.
      const distanceA = Math.abs(a.x - source.cell.x) + Math.abs(a.y - source.cell.y)
      // Расстояние до одного из кандидатов для выбора ближайшего.
      const distanceB = Math.abs(b.x - source.cell.x) + Math.abs(b.y - source.cell.y)
      return distanceA - distanceB || a.y - b.y || a.x - b.x
    })[0]
  if (!target) return null
  // Лестница, участвующая в текущей операции.
  const stair: ConstructionStair = {
    ...source,
    cell: { x: target.x, y: target.y, level: source.cell.level ?? 1 },
  }
  return { model: applyConstructionCommand(model, { type: 'add-stair', stair }), index: stairs.length }
}

/** Ищет допустимое смещение для копии стен вместе с заполнениями. */
export function duplicateConstructionWalls(
  model: ConstructionModel,
  walls: ConstructionWall[],
): { model: ConstructionModel; walls: ConstructionWall[] } | null {
  if (!walls.length) return null
  // Ключи объектов, входящих в текущее выделение.
  const selectedKeys = new Set(walls.map(wallKey))
  // Модель без выбранной группы для проверки её нового размещения.
  const withoutSelection: ConstructionModel = {
    ...model,
    walls: model.walls.filter((wall) => !selectedKeys.has(wallKey(wall))),
    openings: (model.openings ?? []).filter(
      (opening) => !constructionOpeningWalls(opening).some((wall) => selectedKeys.has(wallKey(wall))),
    ),
  }
  // Предел поиска свободной позиции в пределах рабочей области.
  const limit = Math.max(model.width, model.depth)
  // Смещения, перебираемые при поиске места для копии.
  const offsets: Array<{ dx: number; dy: number }> = []
  // Расстояние между сравниваемыми положениями.
  for (let distance = 1; distance <= limit * 2; distance++) {
    // Смещение относительно исходной позиции по оси сетки.
    for (let dx = -distance; dx <= distance; dx++) {
      // Смещение относительно исходной позиции по оси сетки.
      const dy = distance - Math.abs(dx)
      offsets.push({ dx, dy })
      if (dy) offsets.push({ dx, dy: -dy })
    }
  }
  offsets.sort(
    (a, b) =>
      Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)) || b.dx - a.dx || b.dy - a.dy,
  )
  // Смещение группы по двум осям строительной сетки.
  for (const { dx, dy } of offsets) {
    if (!moveConstructionWalls(withoutSelection, walls, dx, dy)) continue
    // Копии выбранных объектов, подготовленные для добавления.
    const copies = walls.map((wall) => ({ ...wall, x: wall.x + dx, y: wall.y + dy }))
    // Соответствие исходных объектов созданным копиям.
    const copiedBySource = new Map(walls.map((wall, index) => [wallKey(wall), copies[index]]))
    // Заполнения, скопированные вместе со стенами.
    const copiedOpenings = (model.openings ?? []).flatMap((opening) => {
      if (!constructionOpeningWalls(opening).every((wall) => copiedBySource.has(wallKey(wall)))) return []
      // Копия стены, к которой привязывается заполнение.
      const copiedWall = copiedBySource.get(wallKey(opening.wall))
      return copiedWall ? [{ ...opening, wall: copiedWall }] : []
    })
    return {
      model: {
        ...model,
        walls: [...model.walls, ...copies],
        openings: [...(model.openings ?? []), ...copiedOpenings],
      },
      walls: copies,
    }
  }
  return null
}

/** Смещает стены и их окна и двери, отклоняя конфликтующее размещение. */
export function moveConstructionWalls(
  model: ConstructionModel,
  walls: ConstructionWall[],
  dx: number,
  dy: number,
): ConstructionModel | null {
  if (!walls.length || (!dx && !dy)) return model
  // Ключи объектов, входящих в текущее выделение.
  const selectedKeys = new Set(walls.map(wallKey))
  if (
    (model.openings ?? []).some((opening) => {
      // Ключи элементов для быстрого поиска совпадений. Объекты или признак объекта в текущем выделении.
      const keys = openingKeys(opening),
        selected = keys.filter((key) => selectedKeys.has(key)).length
      return selected > 0 && selected < keys.length
    })
  )
    return null
  // Состояние объекта после переноса.
  const moved = walls.map((wall) => ({ ...wall, x: wall.x + dx, y: wall.y + dy }))
  // Находится ли объект внутри проверяемой области.
  const inside = moved.every((wall) =>
    wall.axis === 'h'
      ? wall.x >= 0 && wall.x < model.width && wall.y >= 0 && wall.y <= model.depth
      : wall.x >= 0 && wall.x <= model.width && wall.y >= 0 && wall.y < model.depth,
  )
  if (
    !inside ||
    moved.some(
      (wall) => !wallSupported(model.cells, wall) || wallConflictsWithStandaloneAperture(model, wall),
    )
  )
    return null
  // Объекты, не участвующие в переносе.
  const stationary = model.walls.filter((wall) => !selectedKeys.has(wallKey(wall)))
  // Ключи неподвижных объектов для проверки коллизий.
  const stationaryKeys = new Set(stationary.map(wallKey))
  if (moved.some((wall) => stationaryKeys.has(wallKey(wall)))) return null
  // Соответствие старых ключей стен новым сегментам после переноса.
  const movedByOldKey = new Map(walls.map((wall, index) => [wallKey(wall), moved[index]]))
  return {
    ...model,
    walls: [...stationary, ...moved],
    openings: (model.openings ?? []).map((opening) => {
      // Сегмент стены после преобразования.
      const nextWall = movedByOldKey.get(wallKey(opening.wall))
      return nextWall ? { ...opening, wall: nextWall } : opening
    }),
  }
}

/** Поворачивает группу стен вокруг общего центра с привязкой к сетке. */
export function rotateConstructionWalls(
  model: ConstructionModel,
  walls: ConstructionWall[],
  direction: -1 | 1,
): ConstructionModel | null {
  if (!walls.length) return null
  // Ключи объектов, входящих в текущее выделение.
  const selectedKeys = new Set(walls.map(wallKey))
  if (
    (model.openings ?? []).some((opening) => {
      // Ключи элементов для быстрого поиска совпадений. Объекты или признак объекта в текущем выделении.
      const keys = openingKeys(opening),
        selected = keys.filter((key) => selectedKeys.has(key)).length
      return selected > 0 && selected < keys.length
    })
  )
    return null
  /** Возвращает обе конечные точки сегмента стены для поворота. */
  const endpoints = (wall: ConstructionWall) =>
    wall.axis === 'h'
      ? [
          { x: wall.x, y: wall.y },
          { x: wall.x + 1, y: wall.y },
        ]
      : [
          { x: wall.x, y: wall.y },
          { x: wall.x, y: wall.y + 1 },
        ]
  // Точки границ группы для расчёта общего преобразования. Минимальная координата исходной группы по оси сетки.
  const points = walls.flatMap(endpoints),
    originMinX = Math.min(...points.map((point) => point.x)),
    originMinY = Math.min(...points.map((point) => point.y))
  // Поворот группы до выравнивания по целевой точке.
  const rotatedRaw = walls.map((wall) =>
    endpoints(wall).map((point) =>
      direction === 1 ? { x: -point.y, y: point.x } : { x: point.y, y: -point.x },
    ),
  )
  // Конечные точки повёрнутых сегментов. Сдвиг повёрнутой группы к целевой точке сетки.
  const rotatedPoints = rotatedRaw.flat(),
    shiftX = originMinX - Math.min(...rotatedPoints.map((point) => point.x)),
    shiftY = originMinY - Math.min(...rotatedPoints.map((point) => point.y))
  // Состояние объекта после поворота.
  const rotated = rotatedRaw.map((pair, index) => {
    // Конечные точки сегмента стены для расчёта поворота.
    const [first, second] = pair.map((point) => ({ x: point.x + shiftX, y: point.y + shiftY }))
    return first.y === second.y
      ? { ...walls[index], axis: 'h' as const, x: Math.min(first.x, second.x), y: first.y }
      : { ...walls[index], axis: 'v' as const, x: first.x, y: Math.min(first.y, second.y) }
  })
  // Находится ли объект внутри проверяемой области.
  const inside = rotated.every((wall) =>
    wall.axis === 'h'
      ? wall.x >= 0 && wall.x < model.width && wall.y >= 0 && wall.y <= model.depth
      : wall.x >= 0 && wall.x <= model.width && wall.y >= 0 && wall.y < model.depth,
  )
  if (
    !inside ||
    rotated.some(
      (wall) => !wallSupported(model.cells, wall) || wallConflictsWithStandaloneAperture(model, wall),
    )
  )
    return null
  // Объекты, не участвующие в переносе. Ключи неподвижных объектов для проверки коллизий.
  const stationary = model.walls.filter((wall) => !selectedKeys.has(wallKey(wall))),
    stationaryKeys = new Set(stationary.map(wallKey))
  if (
    rotated.some((wall) => stationaryKeys.has(wallKey(wall))) ||
    new Set(rotated.map(wallKey)).size !== rotated.length
  )
    return null
  // Соответствие исходных стен повёрнутым сегментам.
  const rotatedByOldKey = new Map(walls.map((wall, index) => [wallKey(wall), rotated[index]]))
  // Заполнения стен, участвующие в текущей операции.
  const openings = (model.openings ?? []).map((opening) => {
    // Сегмент стены после преобразования.
    const nextWall = rotatedByOldKey.get(wallKey(opening.wall))
    if (!nextWall) return opening
    if (constructionOpeningWidth(opening) === 1)
      return { ...opening, wall: nextWall, spanDirection: undefined }
    // Связанный сегмент стены до или после преобразования.
    const companion = constructionOpeningWalls(opening)[1],
      nextCompanion = rotatedByOldKey.get(wallKey(companion))
    if (!nextCompanion) return opening
    // Направление протяжённости заполнения от опорной стены.
    const spanDirection = (
      nextWall.axis === 'h' ? nextCompanion.x - nextWall.x : nextCompanion.y - nextWall.y
    ) as -1 | 1
    return { ...opening, wall: nextWall, spanDirection }
  })
  return { ...model, walls: [...stationary, ...rotated], openings }
}

/** Применяет перенос и поворот стен как единое проверяемое изменение. */
export function transformConstructionWalls(
  model: ConstructionModel,
  walls: ConstructionWall[],
  dx: number,
  dy: number,
  quarterTurns: number,
): { model: ConstructionModel; walls: ConstructionWall[] } | null {
  // Следующее состояние после применения изменения.
  let next = moveConstructionWalls(model, walls, dx, dy)
  if (!next) return null
  // Модель после совместного переноса и поворота.
  let transformed = walls.map((wall) => ({ ...wall, x: wall.x + dx, y: wall.y + dy }))
  // Количество поворотов на четверть оборота.
  const turns = ((quarterTurns % 4) + 4) % 4
  // Количество поворотов на четверть оборота.
  for (let turn = 0; turn < turns; turn++) {
    // Состояние объекта после поворота.
    const rotated = rotateConstructionWalls(next, transformed, 1)
    if (!rotated) return null
    // Ключи объектов перед преобразованием.
    const previousKeys = new Set(
      next.walls.filter((wall) => !transformed.some((item) => wallKey(item) === wallKey(wall))).map(wallKey),
    )
    transformed = rotated.walls.filter((wall) => !previousKeys.has(wallKey(wall)))
    next = rotated
  }
  return { model: next, walls: transformed }
}
