import type { HouseSpec, PlannedRoom, RoomKind, RoomPosition, RoomRelation } from '@/domain/house/houseTypes'

/** Создаёт набор комнат и распределяет между ними полезную площадь дома. */
export function generateRoomPlan(spec: HouseSpec): PlannedRoom[] {
  if (spec.customPlan?.rooms.length) {
    return [
      ...spec.customPlan.rooms,
      ...spec.addedRooms.filter((room) => !spec.customPlan!.rooms.some((item) => item.id === room.id)),
    ]
      .filter((room) => !spec.removedRooms.includes(room.id))
      .map((room) => ({
        id: room.id,
        name: room.name,
        area: room.weight,
        floor: Math.min(spec.floors, spec.roomFloors[room.id] ?? room.floor) as 1 | 2,
        kind: room.kind,
      }))
  }

  // Комнаты, участвующие в расчёте планировки.
  const rooms: (Omit<PlannedRoom, 'area'> & { weight: number })[] = []
  /** Добавляет комнату с исходным весом площади в программу дома. */
  const add = (id: string, name: string, weight: number, floor: 1 | 2, kind: RoomKind) =>
    rooms.push({ id, name, weight, floor, kind })

  add('living', 'Кухня-гостиная', 34, 1, 'living')
  // Индекс текущего элемента при обходе коллекции.
  for (let index = 0; index < spec.bedrooms; index += 1) {
    // Этаж, для которого выполняется расчёт.
    const floor: 1 | 2 = spec.floors === 2 && (spec.bedrooms < 4 || index > 0) ? 2 : 1
    add(
      `bedroom-${index + 1}`,
      index === 0 ? 'Главная спальня' : `Спальня ${index + 1}`,
      index === 0 ? 16 : 13,
      floor,
      'bedroom',
    )
  }
  add('bathroom-1', 'Санузел', 6, 1, 'service')
  if (spec.floors === 2 || spec.area >= 150)
    add('bathroom-2', 'Ванная', 7, spec.floors === 2 ? 2 : 1, 'service')
  add('utility', 'Техническое помещение', 6, 1, 'service')

  // Дополнительные комнаты, создаваемые по пожеланиям пользователя.
  const extras: [string, string, number, 1 | 2][] = [
    ['Кабинет', 'Кабинет', 11, 1],
    ['Гараж', 'Гараж', 22, 1],
    ['Терраса', 'Терраса', 16, 1],
    ['Сауна или баня', 'Сауна', 9, 1],
    ['Балкон', 'Балкон', 6, spec.floors === 2 ? 2 : 1],
  ]
  // Пожелание, название, исходная площадь и этаж дополнительной комнаты.
  for (const [wish, name, weight, floor] of extras) {
    if (spec.wishes.includes(wish)) add(`extra-${wish}`, name, weight, floor, 'extra')
  }
  // Комната, параметры которой проверяются или изменяются.
  for (const room of spec.addedRooms) {
    if (room.floor <= spec.floors) add(room.id, room.name, room.weight, room.floor, room.kind)
  }

  // Комнаты, оставшиеся после удаления и переноса по этажам.
  const activeRooms = rooms
    .filter((room) => !spec.removedRooms.includes(room.id))
    .map((room) => ({
      ...room,
      floor: Math.min(spec.floors, spec.roomFloors[room.id] ?? room.floor) as 1 | 2,
    }))

  // Комнатам отводится 86% площади; остаток распределяется между холлами и проходами.
  const targetRoomsArea = spec.area * 0.86
  // Сумма исходных весов площадей активных комнат.
  const sourceWeight = activeRooms.reduce((sum, room) => sum + room.weight, 0)
  // Коэффициент пересчёта исходных площадей в доступную площадь дома.
  const scale = sourceWeight > 0 ? targetRoomsArea / sourceWeight : 0
  // Комнаты с рассчитанными площадями и этажами.
  const planned: PlannedRoom[] = activeRooms.map((room) => ({
    id: room.id,
    name: room.name,
    floor: room.floor,
    kind: room.kind,
    area: Math.round(room.weight * scale * 2) / 2,
  }))
  // Уже занятые или обработанные позиции.
  const used = planned.reduce((sum, room) => sum + room.area, 0)
  // Площадь, оставшаяся для холлов и проходов.
  const circulation = Math.max(5, Math.round((spec.area - used) * 2) / 2)

  if (spec.floors === 1) {
    planned.push({ id: 'hall-1', name: 'Холл и проходы', area: circulation, floor: 1, kind: 'circulation' })
  } else {
    // Первому этажу выделяется большая доля проходов, поскольку здесь находится вход.
    const first = Math.round(circulation * 0.55 * 2) / 2
    planned.push({ id: 'hall-1', name: 'Холл 1 этажа', area: first, floor: 1, kind: 'circulation' })
    planned.push({
      id: 'hall-2',
      name: 'Холл 2 этажа',
      area: Math.max(3, circulation - first),
      floor: 2,
      kind: 'circulation',
    })
  }
  return planned
}

/** Применяет заданные площади комнат, компенсируя разницу площадью холла того же этажа. */
export function applyRoomOverrides(base: PlannedRoom[], overrides: Record<string, number>): PlannedRoom[] {
  // Результат применения ручных настроек.
  const adjusted = base.map((room) =>
    room.kind === 'circulation' ? { ...room } : { ...room, area: overrides[room.id] ?? room.area },
  )
  return adjusted.map((room) => {
    if (room.kind !== 'circulation') return room
    /** Суммирует площади жилых и служебных комнат на текущем этаже. */
    const sumNamed = (items: PlannedRoom[]) =>
      items
        .filter((item) => item.floor === room.floor && item.kind !== 'circulation')
        .reduce((sum, item) => sum + item.area, 0)
    // При росте комнаты холл уменьшается на ту же площадь, но не ниже 3 м².
    return {
      ...room,
      area: Math.max(3, Math.round((room.area - (sumNamed(adjusted) - sumNamed(base))) * 2) / 2),
    }
  })
}

/** Размещает комнаты рядами в координатах 12×10 для плана и трёхмерной сцены. */
export function buildCoordinateLayout(rooms: PlannedRoom[]): Record<string, RoomPosition> {
  // Прямоугольные размещения комнат по идентификаторам.
  const positions: Record<string, RoomPosition> = {}
  // Этаж, для которого выполняется расчёт.
  for (const floor of [1, 2] as const) {
    // Комнаты текущего этажа.
    const floorRooms = rooms.filter((item) => item.floor === floor)
    // Суммарная площадь клеток или комнат рассматриваемого этажа.
    const floorArea = floorRooms.reduce((sum, room) => sum + room.area, 0)
    if (floorArea <= 0) continue
    // Комнаты, сгруппированные по рядам планировки.
    const rows: PlannedRoom[][] = [[]]
    // Накопленная оценка ширины текущего ряда.
    let rowWeight = 0
    // Комната, параметры которой проверяются или изменяются.
    for (const room of floorRooms) {
      // Корень из доли площади даёт оценку ширины; нижний предел не позволяет чрезмерно сузить комнату.
      const weight = Math.max(2.2, Math.sqrt((room.area / floorArea) * 120 * 1.35))
      if (rowWeight + weight > 12 && rows.at(-1)!.length) {
        rows.push([])
        rowWeight = 0
      }
      rows.at(-1)!.push(room)
      rowWeight += weight
    }
    // Координата объекта по соответствующей оси.
    let y = 0
    // Комнаты в текущем ряду планировки.
    for (const row of rows) {
      // Сумма площадей комнат текущего ряда.
      const rowArea = row.reduce((sum, room) => sum + room.area, 0)
      // Размер геометрии по соответствующей оси.
      const height = (10 * rowArea) / floorArea
      // Координата объекта по соответствующей оси.
      let x = 0
      // Комната, параметры которой проверяются или изменяются.
      for (const room of row) {
        // Размер геометрии по соответствующей оси.
        const width = (12 * room.area) / rowArea
        positions[room.id] = { x, y, w: width, h: height }
        x += width
      }
      y += height
    }
  }
  return positions
}

/** Проверяет пересечение площадей двух комнат; касание границ не считается пересечением. */
export function rectanglesOverlap(a: RoomPosition, b: RoomPosition): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Находит общую границу комнат достаточной длины для прохода. */
export function roomsShareWall(a: RoomPosition, b: RoomPosition): boolean {
  // Допуск сравнения границ с учётом погрешности вычислений.
  const tolerance = 0.02
  // Отрезок соответствующей ориентации для проверки пересечения.
  const vertical =
    (Math.abs(a.x + a.w - b.x) < tolerance || Math.abs(b.x + b.w - a.x) < tolerance) &&
    Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.55
  // Отрезок соответствующей ориентации для проверки пересечения.
  const horizontal =
    (Math.abs(a.y + a.h - b.y) < tolerance || Math.abs(b.y + b.h - a.y) < tolerance) &&
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.55
  return vertical || horizontal
}

/** Вычисляет штраф за нарушение связей между комнатами: меньший штраф означает лучший план. */
export function relationScore(rooms: PlannedRoom[], relations: RoomRelation[]): number {
  // Прямоугольные размещения комнат по идентификаторам.
  const positions = buildCoordinateLayout(rooms)
  // Комнаты по идентификаторам для поиска участников связи.
  const byId = new Map(rooms.map((room) => [room.id, room]))
  return relations.reduce((score, relation) => {
    // Один из двух элементов, сравниваемых в текущем расчёте.
    const a = byId.get(relation.a)
    // Один из двух элементов, сравниваемых в текущем расчёте.
    const b = byId.get(relation.b)
    if (!a || !b) return score
    if (a.floor !== b.floor) return score + (relation.type === 'away' ? 0 : 100)
    // Прямоугольник одного из участников проверяемой связи.
    const pa = positions[a.id]
    // Прямоугольник одного из участников проверяемой связи.
    const pb = positions[b.id]
    // Есть ли общая стена между рассматриваемыми комнатами.
    const shared = roomsShareWall(pa, pb)
    // Расстояние между сравниваемыми положениями.
    const distance = Math.hypot(pa.x + pa.w / 2 - pb.x - pb.w / 2, pa.y + pa.h / 2 - pb.y - pb.h / 2)
    // Для близости и прохода выгодна общая стена; для удалённости она увеличивает штраф.
    return (
      score +
      (relation.type === 'away' ? (shared ? 30 : 1 / Math.max(1, distance)) : shared ? 0 : 10 + distance)
    )
  }, 0)
}

/** Улучшает порядок комнат за четыре прохода парных перестановок по убыванию штрафа связей. */
export function arrangeRoomsByRelations(source: PlannedRoom[], relations: RoomRelation[]): PlannedRoom[] {
  // Комнаты, участвующие в расчёте планировки.
  let rooms = [...source]
  if (!relations.length) return rooms
  // Номер прохода оптимизации порядка комнат.
  for (let pass = 0; pass < 4; pass += 1) {
    // Наименьший найденный штраф размещения.
    let best = relationScore(rooms, relations)
    // Порядок комнат с наименьшим найденным штрафом.
    let bestRooms = rooms
    // Граница участка либо индекс сравниваемого элемента.
    for (let left = 0; left < rooms.length; left += 1) {
      // Граница участка либо индекс сравниваемого элемента.
      for (let right = left + 1; right < rooms.length; right += 1) {
        if (rooms[left].floor !== rooms[right].floor) continue
        // Предлагаемое состояние объекта перед проверкой допустимости.
        const candidate = [...rooms]
        ;[candidate[left], candidate[right]] = [candidate[right], candidate[left]]
        // Штраф за нарушение пожеланий о связях между комнатами.
        const score = relationScore(candidate, relations)
        if (score < best - 0.001) {
          best = score
          bestRooms = candidate
        }
      }
    }
    if (bestRooms === rooms) break
    rooms = bestRooms
  }
  return rooms
}
