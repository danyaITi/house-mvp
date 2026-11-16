/** Конструкция двери: распашная, двойная или раздвижная. */
export type DoorKind = 'swing' | 'double' | 'sliding'
/** Ширина, тип и смещение двери вдоль общей стены. */
export type DoorConfig = { offset: number; width: number; kind: DoorKind }
/** Дверь с идентификатором и парой соединяемых комнат. */
export type DoorInstance = DoorConfig & { id: string; roomA: string; roomB: string }
/** Неупорядоченная пара комнат для общей стены или прохода. */
export type RoomPair = { a: string; b: string }

// Начальные размеры и тип новой двери.
export const defaultDoorConfig: DoorConfig = { offset: 0.5, width: 0.9, kind: 'swing' }
/** Создаёт одинаковый ключ для пары комнат независимо от их порядка. */
export const doorPairKey = (a: string, b: string) => [a, b].sort().join('::')

/** Находит двери между двумя комнатами, включая совместимый старый формат. */
export function doorsForPair(
  instances: DoorInstance[],
  legacy: Record<string, DoorConfig>,
  roomA: string,
  roomB: string,
): DoorInstance[] {
  // Ключ пары комнат с общей стеной.
  const pair = doorPairKey(roomA, roomB)
  // Двери, сохранённые как отдельные экземпляры.
  const explicit = instances.filter((door) => doorPairKey(door.roomA, door.roomB) === pair)
  return explicit.length ? explicit : [{ id: pair, roomA, roomB, ...(legacy[pair] ?? defaultDoorConfig) }]
}

/** Добавляет дверь между комнатами, проверяя доступное место и предел числа дверей. */
export function addDoor(
  instances: DoorInstance[],
  legacy: Record<string, DoorConfig>,
  roomA: string,
  roomB: string,
  config: DoorConfig,
  id: string,
  includeLegacy: boolean,
): DoorInstance[] {
  // Ключ пары комнат с общей стеной.
  const pair = doorPairKey(roomA, roomB)
  // Есть ли сохранённые экземпляры дверей у этой пары комнат.
  const alreadyExplicit = instances.some((door) => doorPairKey(door.roomA, door.roomB) === pair)
  // Двери, преобразованные из старого формата хранения.
  const migrated =
    includeLegacy && !alreadyExplicit
      ? [{ id: `door:legacy:${pair}`, roomA, roomB, ...(legacy[pair] ?? defaultDoorConfig) }]
      : []
  return [...instances, ...migrated, { id, roomA, roomB, ...config }]
}

/** Заменяет конфигурацию двери с указанным идентификатором. */
export function updateDoor(instances: DoorInstance[], id: string, config: DoorConfig): DoorInstance[] {
  return instances.map((door) => (door.id === id ? { ...door, ...config } : door))
}

/** Удаляет дверь из списка по идентификатору. */
export function removeDoor(instances: DoorInstance[], id: string): DoorInstance[] {
  return instances.filter((door) => door.id !== id)
}

/** Проверяет, снята ли общая стена между указанными комнатами. */
export const hasOpenWall = (walls: RoomPair[], roomA: string, roomB: string) =>
  walls.some((wall) => doorPairKey(wall.a, wall.b) === doorPairKey(roomA, roomB))

/** Добавляет или удаляет пару комнат из списка открытых стен. */
export function setWallOpen(walls: RoomPair[], roomA: string, roomB: string, open: boolean): RoomPair[] {
  // Элементы, оставшиеся после удаления обработанных.
  const remaining = walls.filter((wall) => doorPairKey(wall.a, wall.b) !== doorPairKey(roomA, roomB))
  return open ? [...remaining, { a: roomA, b: roomB }] : remaining
}
