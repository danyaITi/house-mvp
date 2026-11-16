import {
  cellKey,
  type ConstructionModel,
  type StandaloneAperture,
  type ConstructionWall,
} from '@/construction/model/constructionModel'

/** Возвращает ключ расположения проёма с учётом этажа и оси. */
export const standaloneApertureKey = (aperture: Pick<StandaloneAperture, 'id'>) => aperture.id

/** Разбивает пролёт проёма на единичные сегменты сетки. */
export function standaloneApertureSegments(aperture: StandaloneAperture) {
  // Количество элементов, которое требуется обработать или создать.
  const count = aperture.size === 'large' ? 2 : 1
  return Array.from({ length: count }, (_, offset) =>
    aperture.axis === 'h'
      ? { axis: 'h' as const, x: aperture.x + offset, y: aperture.y, level: aperture.level ?? 1 }
      : { axis: 'v' as const, x: aperture.x, y: aperture.y + offset, level: aperture.level ?? 1 },
  )
}

/** Отрезок сетки с осью и этажом для проверки пересечений. */
type GridLine = { axis: 'h' | 'v'; start: number; end: number; fixed: number; level: number }

/** Преобразует проём в отрезок для проверки пересечений. */
function apertureLine(aperture: StandaloneAperture): GridLine {
  // Границы заполнения вдоль сегмента стены.
  const span = aperture.size === 'large' ? 2 : 1
  return aperture.axis === 'h'
    ? { axis: 'h', start: aperture.x, end: aperture.x + span, fixed: aperture.y, level: aperture.level ?? 1 }
    : { axis: 'v', start: aperture.y, end: aperture.y + span, fixed: aperture.x, level: aperture.level ?? 1 }
}

/** Преобразует стену в отрезок для проверки пересечений. */
function wallLine(wall: ConstructionWall): GridLine {
  return wall.axis === 'h'
    ? { axis: 'h', start: wall.x, end: wall.x + 1, fixed: wall.y, level: wall.level ?? 1 }
    : { axis: 'v', start: wall.y, end: wall.y + 1, fixed: wall.x, level: wall.level ?? 1 }
}

/** Проверяет наложения и поперечные пересечения отрезков на одном этаже. */
function gridLinesConflict(first: GridLine, second: GridLine) {
  if (first.level !== second.level) return false
  if (first.axis === second.axis) {
    if (first.fixed !== second.fixed) return false
    return Math.min(first.end, second.end) > Math.max(first.start, second.start)
  }
  // Отрезок соответствующей ориентации для проверки пересечения.
  const horizontal = first.axis === 'h' ? first : second
  // Отрезок соответствующей ориентации для проверки пересечения.
  const vertical = first.axis === 'v' ? first : second
  // Пересекаются ли рассматриваемые отрезки сетки.
  const intersects =
    vertical.fixed >= horizontal.start &&
    vertical.fixed <= horizontal.end &&
    horizontal.fixed >= vertical.start &&
    horizontal.fixed <= vertical.end
  if (!intersects) return false
  // Находится ли пересечение на конце соответствующего отрезка.
  const horizontalEndpoint = vertical.fixed === horizontal.start || vertical.fixed === horizontal.end
  // Находится ли пересечение на конце соответствующего отрезка.
  const verticalEndpoint = horizontal.fixed === vertical.start || horizontal.fixed === vertical.end
  return !(horizontalEndpoint && verticalEndpoint)
}

/** Вычисляет размеры заполнения, полностью помещающегося в вырез. */
export function standaloneApertureFixtureGeometry(aperture: StandaloneAperture) {
  // Границы заполнения вдоль сегмента стены.
  const span = aperture.size === 'large' ? 2 : 1
  // Высота прозрачного выреза для заполнения.
  const cutHeight = aperture.kind === 'door' ? 2.05 : aperture.size === 'large' ? 2.5 : 0.92
  // Высота нижней границы выреза относительно пола.
  const cutBottom = aperture.kind === 'door' ? 0 : aperture.size === 'large' ? 0.11 : 0.9
  // Зазор между заполнением и границами проёма.
  const clearance = 0.02
  // Ширина боковой стойки проёма.
  const framePostWidth = 0.12
  return {
    span,
    cutHeight,
    cutBottom,
    width: span - framePostWidth * 2,
    height: cutHeight - clearance * 2,
    bottom: cutBottom + clearance,
    depth: 0.08,
  }
}

/** Проверяет пересечение стены с отдельно установленными проёмами. */
export function wallConflictsWithStandaloneAperture(model: ConstructionModel, wall: ConstructionWall) {
  return (model.apertures ?? []).some((aperture) => gridLinesConflict(wallLine(wall), apertureLine(aperture)))
}

/** Проверяет наличие пола рядом с сегментом на его этаже. */
function segmentSupported(
  cells: Set<string>,
  segment: ReturnType<typeof standaloneApertureSegments>[number],
) {
  // Этаж, для которого выполняется расчёт.
  const level = segment.level ?? 1
  return segment.axis === 'h'
    ? cells.has(`${level}:${segment.x}:${segment.y - 1}`) || cells.has(`${level}:${segment.x}:${segment.y}`)
    : cells.has(`${level}:${segment.x - 1}:${segment.y}`) || cells.has(`${level}:${segment.x}:${segment.y}`)
}

/** Проверяет опору всех сегментов и отсутствие пересечений со стенами и проёмами. */
export function standaloneApertureFits(
  model: ConstructionModel,
  aperture: StandaloneAperture,
  ignoreIds = new Set<string>(),
) {
  // Единичные сегменты, занимаемые объектом.
  const segments = standaloneApertureSegments(aperture)
  // Находится ли объект внутри проверяемой области.
  const inside = segments.every((segment) =>
    segment.axis === 'h'
      ? segment.x >= 0 && segment.x < model.width && segment.y >= 0 && segment.y <= model.depth
      : segment.x >= 0 && segment.x <= model.width && segment.y >= 0 && segment.y < model.depth,
  )
  if (!inside) return false
  // Клетки пола, участвующие в текущей операции.
  const cells = new Set(model.cells.map(cellKey))
  if (!segments.every((segment) => segmentSupported(cells, segment))) return false
  if (model.walls.some((wall) => gridLinesConflict(wallLine(wall), apertureLine(aperture)))) return false
  return !(model.apertures ?? [])
    .filter((item) => !ignoreIds.has(item.id))
    .some((item) => gridLinesConflict(apertureLine(item), apertureLine(aperture)))
}

/** Добавляет отдельный проём, если весь его пролёт допустим. */
export function addStandaloneAperture(model: ConstructionModel, aperture: StandaloneAperture) {
  return standaloneApertureFits(model, aperture)
    ? { ...model, apertures: [...(model.apertures ?? []), aperture] }
    : model
}

/** Проверяет соответствие типа и размера заполнения выбранному проёму. */
export function standaloneApertureAcceptsFixture(
  aperture: StandaloneAperture,
  kind: StandaloneAperture['kind'],
  style: string,
) {
  // Размер проёма, необходимый выбранному заполнению.
  const requiredSize: StandaloneAperture['size'] =
    kind === 'door'
      ? style === 'double' || style === 'sliding'
        ? 'large'
        : 'small'
      : style === 'panoramic'
        ? 'large'
        : 'small'
  return aperture.kind === kind && aperture.size === requiredSize
}

/** Устанавливает окно или дверь в совместимый свободный проём. */
export function installApertureFixture(
  model: ConstructionModel,
  id: string,
  kind: StandaloneAperture['kind'],
  style: string,
  material: string,
) {
  // Отдельный проём для проверки или изменения.
  const aperture = (model.apertures ?? []).find((item) => item.id === id)
  if (!aperture || !standaloneApertureAcceptsFixture(aperture, kind, style)) return model
  return {
    ...model,
    apertures: (model.apertures ?? []).map((item) =>
      item.id === id ? { ...item, fixture: { style, material } } : item,
    ),
  }
}

/** Меняет материал заполнения, сохраняя геометрию проёма. */
export function updateStandaloneFixtureMaterial(model: ConstructionModel, ids: string[], material: string) {
  // Объекты или признак объекта в текущем выделении.
  const selected = new Set(ids)
  return {
    ...model,
    apertures: (model.apertures ?? []).map((item) =>
      selected.has(item.id) && item.fixture ? { ...item, fixture: { ...item.fixture, material } } : item,
    ),
  }
}

/** Переносит заполнения между совместимыми проёмами. */
export function moveStandaloneFixtures(model: ConstructionModel, ids: string[], dx: number, dy: number) {
  // Объекты или признак объекта в текущем выделении. Отдельные проёмы, участвующие в текущей операции. Исходные объекты выбранной группы.
  const selected = new Set(ids),
    apertures = model.apertures ?? [],
    sources = apertures.filter((item) => selected.has(item.id) && item.fixture)
  if (!sources.length || (!dx && !dy)) return null
  // Позиции, зарезервированные другими перемещаемыми объектами.
  const reserved = new Set<string>()
  // Подготовленные перемещения объектов после проверки.
  const moves = sources.map((source) => {
    // Целевой объект или точка текущего действия.
    const target = apertures.find(
      (item) =>
        !selected.has(item.id) &&
        !item.fixture &&
        !reserved.has(item.id) &&
        item.kind === source.kind &&
        item.size === source.size &&
        item.axis === source.axis &&
        item.x === source.x + dx &&
        item.y === source.y + dy,
    )
    if (target) reserved.add(target.id)
    return target ? { source, target } : null
  })
  if (moves.some((move) => !move)) return null
  // Идентификаторы исходных объектов группы. Соответствие объектов целевым позициям.
  const sourceIds = new Set(sources.map((item) => item.id)),
    byTarget = new Map(moves.map((move) => [move!.target.id, move!.source.fixture!]))
  return {
    ...model,
    apertures: apertures.map((item) =>
      sourceIds.has(item.id)
        ? { ...item, fixture: undefined }
        : byTarget.has(item.id)
          ? { ...item, fixture: byTarget.get(item.id) }
          : item,
    ),
  }
}

/** Ищет свободные совместимые проёмы для копий заполнений. */
export function duplicateStandaloneFixtures(model: ConstructionModel, ids: string[]) {
  // Исходные объекты выбранной группы.
  const sources = (model.apertures ?? []).filter((item) => ids.includes(item.id) && item.fixture)
  if (!sources.length) return null
  // Подходящие целевые объекты для переноса.
  const targets = (model.apertures ?? []).filter((item) => !item.fixture)
  // Уже занятые или обработанные позиции. Назначения исходных объектов целевым проёмам.
  const used = new Set<string>(),
    assignments = sources.map((source) => {
      // Целевой объект или точка текущего действия.
      const target = targets
        .filter((item) => !used.has(item.id) && item.kind === source.kind && item.size === source.size)
        .sort(
          (a, b) =>
            Math.abs(a.x - source.x) +
            Math.abs(a.y - source.y) -
            Math.abs(b.x - source.x) -
            Math.abs(b.y - source.y),
        )[0]
      if (target) used.add(target.id)
      return target ? { source, target } : null
    })
  if (assignments.some((item) => !item)) return null
  return {
    ...model,
    apertures: (model.apertures ?? []).map((item) => {
      // Назначение текущего заполнения целевому проёму.
      const assignment = assignments.find((entry) => entry?.target.id === item.id)
      return assignment ? { ...item, fixture: { ...assignment.source.fixture! } } : item
    }),
  }
}

/** Переносит и поворачивает проёмы вместе с заполнениями после проверки коллизий. */
export function transformStandaloneApertures(
  model: ConstructionModel,
  ids: string[],
  dx: number,
  dy: number,
  quarterTurns: number,
) {
  // Объекты или признак объекта в текущем выделении. Исходный объект перед преобразованием.
  const selected = new Set(ids),
    source = (model.apertures ?? []).filter((item) => selected.has(item.id))
  if (!source.length) return null
  // Граница обрабатываемой области по оси сетки.
  const minX = Math.min(...source.map((item) => item.x)),
    minY = Math.min(...source.map((item) => item.y))
  // Модель после совместного переноса и поворота.
  let transformed = source.map((item) => ({ ...item, x: item.x + dx, y: item.y + dy }))
  // Количество поворотов на четверть оборота.
  for (let turn = 0; turn < ((quarterTurns % 4) + 4) % 4; turn++)
    transformed = transformed.map((item) => {
      // Координата объекта относительно начала преобразуемой группы.
      const localX = item.x - (minX + dx),
        localY = item.y - (minY + dy)
      return {
        ...item,
        axis: item.axis === 'h' ? ('v' as const) : ('h' as const),
        x: minX + dx - localY,
        y: minY + dy + localX,
      }
    })
  // Модель без исходных объектов для проверки новых позиций.
  const without = { ...model, apertures: (model.apertures ?? []).filter((item) => !selected.has(item.id)) }
  if (!transformed.every((item) => standaloneApertureFits(without, item, new Set(ids)))) return null
  return {
    model: { ...model, apertures: [...(without.apertures ?? []), ...transformed] },
    apertures: transformed,
  }
}

/** Создаёт копии проёмов с новыми идентификаторами на допустимом месте. */
export function duplicateStandaloneApertures(model: ConstructionModel, ids: string[]) {
  // Объекты или признак объекта в текущем выделении. Исходный объект перед преобразованием.
  const selected = new Set(ids),
    source = (model.apertures ?? []).filter((item) => selected.has(item.id))
  if (!source.length) return null
  // Предел поиска свободной позиции в пределах рабочей области.
  const limit = Math.max(model.width, model.depth)
  // Смещения, перебираемые при поиске места для копии.
  const offsets: Array<{ dx: number; dy: number }> = []
  // Расстояние между сравниваемыми положениями.
  for (let distance = 1; distance <= limit * 2; distance++)
    // Смещение относительно исходной позиции по оси сетки.
    for (let dx = -distance; dx <= distance; dx++) {
      // Смещение относительно исходной позиции по оси сетки.
      const dy = distance - Math.abs(dx)
      offsets.push({ dx, dy })
      if (dy) offsets.push({ dx, dy: -dy })
    }
  offsets.sort(
    (a, b) =>
      Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)) || b.dx - a.dx || b.dy - a.dy,
  )
  // Смещение группы по двум осям строительной сетки.
  for (const { dx, dy } of offsets) {
    // Промежуточная модель при последовательном применении изменений.
    let working = model
    // Копии выбранных объектов, подготовленные для добавления.
    const copies: StandaloneAperture[] = []
    // Проходит ли предлагаемое размещение проверки ограничений.
    let valid = true
    // Элемент коллекции, обрабатываемый на текущем шаге.
    for (const item of source) {
      // Независимая копия объекта с новым размещением.
      const copy = {
        ...item,
        id: nextStandaloneApertureId(working, item.kind),
        x: item.x + dx,
        y: item.y + dy,
      }
      if (!standaloneApertureFits(working, copy)) {
        valid = false
        break
      }
      copies.push(copy)
      working = { ...working, apertures: [...(working.apertures ?? []), copy] }
    }
    if (valid) return { model: working, apertures: copies }
  }
  return null
}

/** Находит следующий свободный идентификатор отдельного проёма. */
export function nextStandaloneApertureId(model: ConstructionModel, kind: StandaloneAperture['kind']) {
  // Индекс текущего элемента при обходе коллекции.
  let index = 1
  // Уже занятые или обработанные позиции.
  const used = new Set((model.apertures ?? []).map((item) => item.id))
  while (used.has(`${kind}-aperture:${index}`)) index += 1
  return `${kind}-aperture:${index}`
}
