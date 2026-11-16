import styles from '@/components/workspace/Workspace.module.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoor,
  hasOpenWall,
  removeDoor,
  setWallOpen,
  updateDoor,
  type DoorConfig,
  type DoorInstance,
  type DoorKind,
} from '@/openings/openingModel'
import { generateZones, type ConstructionModel } from '@/construction/model/constructionModel'
import { historyShortcut } from '@/history/historyShortcuts'
import { ConstructionPlan } from '@/components/construction-plan/ConstructionPlan'
import { HouseCanvas, loadHouse3D } from '@/components/house-canvas/HouseCanvas'
import { Icon } from '@/components/icon/Icon'
import { buildCostItems, estimateHouse } from '@/domain/estimate/houseEstimate'
import type {
  AddedRoom,
  HouseSpec,
  RoomPair,
  RoomPosition,
  WallSide,
  WindowConfig,
  WindowKind,
} from '@/domain/house/houseTypes'
import {
  applyRoomOverrides,
  arrangeRoomsByRelations,
  buildCoordinateLayout,
  generateRoomPlan,
  rectanglesOverlap,
  roomsShareWall,
} from '@/domain/room-plan/roomPlan'

import { DEFAULT_SPEC } from '@/domain/house/defaultSpec'

/** Сравнивает пару комнат независимо от порядка их идентификаторов. */
const samePair = (pair: RoomPair, a: string, b: string) =>
  (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a)

/** Строит устойчивый ключ прохода из отсортированных идентификаторов комнат. */
const doorKey = (a: string, b: string) => [a, b].sort().join('::')

/** Находит стороны комнаты, совпадающие с внешней границей плана 12×10. */
const exteriorSides = (position: RoomPosition): WallSide[] => [
  ...(Math.abs(position.y) < 0.02 ? ['top' as const] : []),
  ...(Math.abs(position.x) < 0.02 ? ['left' as const] : []),
  ...(Math.abs(position.x + position.w - 12) < 0.02 ? ['right' as const] : []),
  ...(Math.abs(position.y + position.h - 10) < 0.02 ? ['bottom' as const] : []),
]

/** Выбирает первую наружную сторону комнаты для размещения нового заполнения. */
const defaultExteriorSide = (position: RoomPosition): WallSide => exteriorSides(position)[0] ?? 'top'

/** Форматирует сумму в рублях без копеек. */
const money = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)

/** Параметры отображения строительного плана. */
type FloorPlanProps = {
  /** Параметры дома и текущее состояние строительства. */
  spec: HouseSpec
  /** Сохраняет число окон комнаты. */
  onRoomWindowChange: (id: string, count: number) => void
  /** Сохраняет конфигурацию выбранной двери. */
  onDoorConfig: (key: string, config: DoorConfig) => void
  /** Назначает комнату с наружным входом. */
  onEntranceChange: (roomId: string | null) => void
} & Record<string, any>
/** Показывает строительную модель как план без редактирования. */
function FloorPlan(props: FloorPlanProps) {
  return <ConstructionPlan model={props.spec.construction} />
}

/** Связывает параметры дома, историю изменений, 3D-сцену и смету. */
export function Workspace({
  spec,
  setSpec,
  onReset,
  onClear,
}: {
  /** Параметры дома и текущее состояние строительства. */
  spec: HouseSpec
  /** Сохраняет новое состояние дома. */
  setSpec: (s: HouseSpec) => void
  /** Восстанавливает начальные параметры дома. */
  onReset: () => void
  /** Очищает построенные объекты. */
  onClear: () => void
}) {
  // Расчёт объёмов работ и ориентировочной стоимости.
  const data = useMemo(() => estimateHouse(spec), [spec])
  // Разделы сметы с количеством, материалами и работами.
  const costItems = useMemo(() => buildCostItems(spec, data), [spec, data])
  // Суммарная стоимость материалов по разделам сметы.
  const materialTotal = costItems.reduce((sum, item) => sum + item.materials, 0)
  // Суммарная стоимость работ по разделам сметы.
  const laborTotal = costItems.reduce((sum, item) => sum + item.labor, 0)
  // Комнаты до применения ручных площадей и порядка.
  const baseRooms = useMemo(() => generateRoomPlan(spec), [spec])
  // Ключ состава плана для сброса устаревших ручных настроек.
  const planKey = `${spec.area}:${spec.floors}:${spec.bedrooms}:${spec.wishes.join('|')}:${spec.removedRooms.join('|')}:${spec.addedRooms.map((item) => `${item.id}-${item.floor}`).join('|')}:${Object.entries(spec.roomFloors).join('|')}:${Object.entries(
    spec.roomLayouts,
  )
    .map(([id, p]) => `${id}-${p.x}-${p.y}-${p.w}-${p.h}`)
    .join(
      '|',
    )}:${spec.roomRelations.map((item) => `${item.a}-${item.b}-${item.type}`).join('|')}:${spec.blockedPassages.map((item) => `${item.a}-${item.b}`).join('|')}:${spec.openWalls.map((item) => `${item.a}-${item.b}`).join('|')}:${spec.entranceRoom ?? ''}`
  // Ручные позиции комнат и ключ плана, к которому они относятся.
  const [positionEdit, setPositionEdit] = useState<{
    key: string
    values: Record<string, { x: number; y: number }>
  }>({ key: planKey, values: {} })
  // Ручной порядок комнат и ключ соответствующего плана.
  const [orderEdit, setOrderEdit] = useState<{ key: string; values: string[] }>({ key: planKey, values: [] })
  // Комнаты с применёнными пользовательскими площадями.
  const adjustedRooms = useMemo(
    () => applyRoomOverrides(baseRooms, spec.roomAreas),
    [baseRooms, spec.roomAreas, spec.area],
  )
  // Комнаты в порядке, улучшенном с учётом связей.
  const relationArrangedRooms = useMemo(
    () => arrangeRoomsByRelations(adjustedRooms, spec.roomRelations),
    [adjustedRooms, spec.roomRelations],
  )
  // Идентификаторы комнат в выбранном порядке.
  const roomOrder =
    orderEdit.key === planKey && orderEdit.values.length
      ? orderEdit.values
      : relationArrangedRooms.map((room) => room.id)
  // Комнаты, участвующие в расчёте планировки.
  const rooms = useMemo(() => {
    // Порядок элементов для построения текущего представления.
    const order = new Map(roomOrder.map((id, index) => [id, index]))
    return [...adjustedRooms].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
  }, [adjustedRooms, roomOrder])
  // Автоматические позиции комнат до ручных изменений.
  const basePositions = useMemo(() => buildCoordinateLayout(rooms), [rooms])
  // Сохранённые пользовательские позиции комнат.
  const positionOverrides = positionEdit.key === planKey ? positionEdit.values : {}
  // Прямоугольные размещения комнат по идентификаторам.
  const positions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(basePositions).map(([id, position]) => [
          id,
          { ...position, ...spec.customPlan?.layouts[id], ...spec.roomLayouts[id], ...positionOverrides[id] },
        ]),
      ),
    [basePositions, spec.customPlan, spec.roomLayouts, positionOverrides],
  ) as Record<string, RoomPosition>
  // Активный раздел рабочей области.
  const [tab, setTab] = useState<'params' | 'model' | 'estimate'>('model')
  // Режим отображения модели: план или трёхмерная сцена.
  const [modelView, setModelView] = useState<'volume' | 'plan'>(() =>
    localStorage.getItem('domovid-model-view') === 'volume' ? 'volume' : 'plan',
  )
  useEffect(() => localStorage.setItem('domovid-model-view', modelView), [modelView])
  // Параметры объекта и действия, полученные из события сцены.
  const [detail, setDetail] = useState(false)
  // Предыдущие снимки проекта для отмены изменений.
  const [history, setHistory] = useState<HouseSpec[]>([])
  // Отменённые снимки проекта для повтора изменений.
  const [future, setFuture] = useState<HouseSpec[]>([])
  // Состояние сохранения проекта для сообщения пользователю.
  const [saveStatus, setSaveStatus] = useState('Сохранено')
  // Таймер отложенного обновления состояния сохранения.
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(saveTimer.current), [])
  /** Объединяет изменения параметров дома с текущим состоянием. */
  const update = (next: HouseSpec) => {
    setHistory((h) => [...h.slice(-49), spec])
    setFuture([])
    setSaveStatus('Сохраняем…')
    setSpec(next)
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => setSaveStatus('Сохранено'), 350)
  }
  useEffect(() => {
    /** Принимает запрос изменения параметров окна и обновляет состояние дома. */
    const receive = (event: Event) => {
      // Параметры объекта и действия, полученные из события сцены.
      const detail = (
        event as CustomEvent<{ kind: 'door' | 'window'; key: string; config: DoorConfig | WindowConfig }>
      ).detail
      if (!detail?.key) return
      if (detail.kind === 'window')
        update({
          ...spec,
          windowConfigs: { ...spec.windowConfigs, [detail.key]: detail.config as WindowConfig },
        })
      else if (spec.doorInstances.some((item) => item.id === detail.key))
        update({
          ...spec,
          doorInstances: updateDoor(spec.doorInstances, detail.key, detail.config as DoorConfig),
        })
      else
        update({ ...spec, doorConfigs: { ...spec.doorConfigs, [detail.key]: detail.config as DoorConfig } })
    }
    window.addEventListener('domovid-opening-change', receive)
    return () => window.removeEventListener('domovid-opening-change', receive)
  }, [spec])
  useEffect(() => {
    /** Сохраняет построенную модель и синхронизирует комнаты с её зонами. */
    const receive = (event: Event) => {
      // Параметры объекта и действия, полученные из события сцены.
      const detail = (
        event as CustomEvent<{ action: 'change' | 'create-plan'; construction: ConstructionModel }>
      ).detail
      if (!detail) return
      if (detail.action === 'change') {
        update({ ...spec, construction: detail.construction })
        return
      }
      // Связные области пола, образующие комнаты.
      const zones = generateZones(detail.construction)
      if (!zones.length) return
      // Комнаты, участвующие в расчёте планировки.
      const rooms: AddedRoom[] = zones.map((zone, index) => ({
        id: zone.id,
        name: zones.length === 1 ? 'Большая комната' : `Помещение ${index + 1}`,
        weight: zone.cells,
        floor: Math.min(2, zone.floor) as 1 | 2,
        kind: 'extra',
      }))
      // Размер геометрии по соответствующей оси.
      const width = detail.construction.width || 12,
        depth = detail.construction.depth || 10
      // Размещения комнат после применения текущего изменения.
      const layouts = Object.fromEntries(
        zones.map((zone) => [
          zone.id,
          {
            x: (zone.x / width) * 12,
            y: (zone.y / depth) * 10,
            w: (zone.w / width) * 12,
            h: (zone.h / depth) * 10,
          },
        ]),
      )
      // Площадь, вычисленная по количеству или размерам элементов.
      const area = rooms.reduce((sum, room) => sum + room.weight, 0)
      update({
        ...spec,
        area: Math.max(4, area),
        floors: rooms.some((room) => room.floor === 2) ? 2 : 1,
        construction: detail.construction,
        customPlan: { rooms, layouts },
        roomAreas: Object.fromEntries(rooms.map((room) => [room.id, room.weight])),
        roomLayouts: {},
        roomWindows: Object.fromEntries(rooms.map((room) => [room.id, 0])),
        roomDoors: {},
        doorConfigs: {},
        doorInstances: [],
        windowConfigs: {},
        entranceRoom: null,
        roomRelations: [],
        blockedPassages: [],
        openWalls: [],
        roomFloors: {},
        removedRooms: [],
        addedRooms: [],
      })
      setModelView('plan')
    }
    window.addEventListener('domovid-construction', receive)
    return () => window.removeEventListener('domovid-construction', receive)
  }, [spec])
  useEffect(() => {
    /** Обрабатывает запрос изменения комнаты, двери или прохода из 3D-сцены. */
    const receive = (event: Event) => {
      // Параметры объекта и действия, полученные из события сцены.
      const detail = (
        event as CustomEvent<{
          action: string
          roomId: string
          otherId?: string
          offset?: number
          wall?: WallSide
          key?: string
          respond?: (result: { success: boolean; message: string }) => void
        }>
      ).detail
      if (!detail) return
      /** Отправляет результат проверки действия обратно в 3D-сцену. */
      const respond = (success: boolean, message: string) => detail.respond?.({ success, message })
      if (detail.action === 'toggle-wall' && detail.otherId) {
        // Требуется ли открыть общую стену между комнатами.
        const open = hasOpenWall(spec.openWalls, detail.roomId, detail.otherId)
        // Стены после применения текущего изменения.
        const nextWalls = setWallOpen(spec.openWalls, detail.roomId, detail.otherId, !open)
        // Двери после применения текущего изменения.
        const nextDoors = open
          ? spec.doorInstances
          : spec.doorInstances.filter(
              (door) => !samePair({ a: door.roomA, b: door.roomB }, detail.roomId, detail.otherId!),
            )
        update({
          ...spec,
          openWalls: nextWalls,
          doorInstances: nextDoors,
          blockedPassages: spec.blockedPassages.filter(
            (pair) => !samePair(pair, detail.roomId, detail.otherId!),
          ),
          roomRelations: [
            ...spec.roomRelations.filter((item) => !samePair(item, detail.roomId, detail.otherId!)),
            { a: detail.roomId, b: detail.otherId, type: 'access' },
          ],
        })
        respond(
          true,
          open
            ? 'Стена восстановлена. Между помещениями оставлен проход.'
            : 'Стена убрана — помещения объединены.',
        )
        return
      }
      if (detail.action === 'add-window') {
        // Комната, параметры которой проверяются или изменяются. Положение объекта в координатах плана или сцены. Количество элементов, которое требуется обработать или создать.
        const room = rooms.find((item) => item.id === detail.roomId),
          position = positions[detail.roomId],
          count = Math.min(4, spec.roomWindows[detail.roomId] ?? 1)
        if (!room || !position || !detail.wall || !exteriorSides(position).includes(detail.wall)) {
          respond(false, 'Окно можно поставить только на наружной стене.')
          return
        }
        if (count >= 4) {
          respond(false, 'В этой комнате уже максимальное количество окон — четыре.')
          return
        }
        // Ключ объекта для поиска и сравнения в коллекциях. Параметры выбранного окна или двери.
        const key = `window:${detail.roomId}:${count}`,
          config: WindowConfig = {
            offset: detail.offset ?? 0.5,
            width: 1.4,
            kind: 'casement',
            wall: detail.wall,
          }
        // Заполнения на той же стороне комнаты.
        const sameWall = Array.from(
          { length: count },
          (_, index) =>
            spec.windowConfigs[`window:${detail.roomId}:${index}`] ?? {
              offset: (index + 1) / (count + 1),
              width: 1.4,
              kind: 'casement' as WindowKind,
              wall: defaultExteriorSide(position),
            },
        ).filter((item) => (item.wall ?? defaultExteriorSide(position)) === detail.wall)
        // Доступная длина стены для размещения заполнений.
        const wallLength = detail.wall === 'top' || detail.wall === 'bottom' ? position.w : position.h
        if (
          sameWall.some(
            (item) =>
              Math.abs(item.offset - config.offset) * wallLength < (item.width + config.width) / 2 + 0.25,
          )
        ) {
          respond(false, 'Здесь недостаточно места. Выберите свободный участок стены.')
          return
        }
        update({
          ...spec,
          roomWindows: { ...spec.roomWindows, [detail.roomId]: count + 1 },
          windowConfigs: { ...spec.windowConfigs, [key]: config },
        })
        respond(true, 'Окно добавлено на выбранную стену.')
        return
      }
      if (detail.action === 'add-door' && detail.otherId) {
        // Ключ пары комнат с общей стеной. Уже существующие элементы, влияющие на допустимость изменения. Был ли проход между комнатами закрыт до изменения.
        const pair = doorKey(detail.roomId, detail.otherId),
          existing = spec.doorInstances.filter((item) => doorKey(item.roomA, item.roomB) === pair),
          wasBlocked = spec.blockedPassages.some((item) => samePair(item, detail.roomId, detail.otherId!))
        // Конфигурация двери после применения запрошенных параметров.
        const nextDoor: DoorInstance = {
          id: `door:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`,
          roomA: detail.roomId,
          roomB: detail.otherId,
          offset: detail.offset ?? 0.5,
          width: 0.9,
          kind: 'swing',
        }
        update({
          ...spec,
          openWalls: setWallOpen(spec.openWalls, detail.roomId, detail.otherId, false),
          doorInstances: addDoor(
            spec.doorInstances,
            spec.doorConfigs,
            detail.roomId,
            detail.otherId,
            nextDoor,
            nextDoor.id,
            !wasBlocked,
          ),
          blockedPassages: spec.blockedPassages.filter(
            (item) => !samePair(item, detail.roomId, detail.otherId!),
          ),
          roomRelations: [
            ...spec.roomRelations.filter((item) => !samePair(item, detail.roomId, detail.otherId!)),
            { a: detail.roomId, b: detail.otherId, type: 'access' },
          ],
        })
        respond(
          true,
          existing.length || !wasBlocked
            ? 'Добавлена ещё одна дверь на общей стене.'
            : 'Стена восстановлена, дверь добавлена между комнатами.',
        )
        return
      }
      if (detail.action === 'remove-window' && detail.key) {
        // Индекс текущего элемента при обходе коллекции. Количество элементов, которое требуется обработать или создать.
        const index = Number(detail.key.split(':').at(-1)),
          count = spec.roomWindows[detail.roomId] ?? 1
        if (count <= 0) {
          respond(false, 'Это окно уже удалено.')
          return
        }
        // Конфигурации заполнений, подготовленные для сохранения.
        const configs = { ...spec.windowConfigs }
        delete configs[detail.key]
        // Текущая позиция вдоль стены при последовательном размещении.
        for (let cursor = index + 1; cursor < count; cursor++) {
          // Граница интервала размещения вдоль стены.
          const from = `window:${detail.roomId}:${cursor}`,
            to = `window:${detail.roomId}:${cursor - 1}`
          if (configs[from]) {
            configs[to] = configs[from]
            delete configs[from]
          }
        }
        update({
          ...spec,
          roomWindows: { ...spec.roomWindows, [detail.roomId]: Math.max(0, count - 1) },
          windowConfigs: configs,
        })
        respond(true, 'Окно удалено.')
        return
      }
      if (detail.action === 'remove-door' && detail.key) {
        if (detail.key.startsWith('entrance:')) {
          update({ ...spec, entranceRoom: null })
          respond(true, 'Входная дверь удалена.')
          return
        }
        // Экземпляр двери, к которому относится действие.
        const instance = spec.doorInstances.find((item) => item.id === detail.key)
        if (instance) {
          // Элементы, оставшиеся после удаления обработанных. Двери, оставшиеся между рассматриваемыми комнатами. Пары комнат с закрытыми проходами.
          const remaining = removeDoor(spec.doorInstances, detail.key),
            pairRemaining = remaining.some((item) =>
              samePair({ a: item.roomA, b: item.roomB }, instance.roomA, instance.roomB),
            ),
            blocked = pairRemaining
              ? spec.blockedPassages
              : [
                  ...spec.blockedPassages.filter((pair) => !samePair(pair, instance.roomA, instance.roomB)),
                  { a: instance.roomA, b: instance.roomB },
                ]
          update({ ...spec, doorInstances: remaining, blockedPassages: blocked })
          respond(true, 'Дверь удалена.')
          return
        }
        // Идентификаторы двух комнат, между которыми изменяется проход.
        const [a, b] = detail.key.split('::')
        if (!rooms.some((room) => room.id === a) || !rooms.some((room) => room.id === b)) {
          respond(false, 'Не удалось найти комнаты для этой двери.')
          return
        }
        // Пары комнат с закрытыми проходами. Пожелания о близости и проходах между комнатами.
        const blocked = [...spec.blockedPassages.filter((pair) => !samePair(pair, a, b)), { a, b }],
          relations = spec.roomRelations.filter((item) => !(item.type === 'access' && samePair(item, a, b)))
        update({ ...spec, blockedPassages: blocked, roomRelations: relations })
        respond(true, 'Дверь удалена. Помещение может остаться без прохода.')
        return
      }
      respond(false, 'Не удалось выполнить изменение проёма.')
    }
    window.addEventListener('domovid-opening-action', receive)
    return () => window.removeEventListener('domovid-opening-action', receive)
  }, [spec, rooms, positions])
  /** Сохраняет площадь комнаты и компенсирует изменение площадью холла. */
  const changeRoomArea = (id: string, area: number) => {
    update({ ...spec, roomAreas: { ...spec.roomAreas, [id]: area } })
    setPositionEdit({ key: planKey, values: {} })
  }
  /** Открывает или закрывает проход между выбранными комнатами. */
  const changePassage = (a: string, b: string, enabled: boolean) => {
    if (enabled) {
      update({
        ...spec,
        openWalls: setWallOpen(spec.openWalls, a, b, false),
        blockedPassages: spec.blockedPassages.filter((pair) => !samePair(pair, a, b)),
        roomRelations: [
          ...spec.roomRelations.filter((item) => !samePair(item, a, b)),
          { a, b, type: 'access' },
        ],
      })
      return true
    }
    // Один из двух объектов, участвующих в проверке.
    const first = rooms.find((room) => room.id === a),
      second = rooms.find((room) => room.id === b)
    if (!first || !second || first.floor !== second.floor) return false
    // Пары комнат с закрытыми проходами.
    const blocked = [...spec.blockedPassages.filter((pair) => !samePair(pair, a, b)), { a, b }]
    // Пожелания о близости и проходах между комнатами.
    const relations = spec.roomRelations.filter((item) => !(item.type === 'access' && samePair(item, a, b)))
    update({
      ...spec,
      blockedPassages: blocked,
      roomRelations: relations,
      doorInstances: spec.doorInstances.filter((door) => !samePair({ a: door.roomA, b: door.roomB }, a, b)),
    })
    return true
  }
  /** Обновляет число дверей комнаты и связанные проходы. */
  const changeRoomDoors = (id: string, count: number) => {
    // Комната, параметры которой проверяются или изменяются.
    const room = rooms.find((item) => item.id === id)
    if (!room) return
    // Соседний объект с общей границей.
    const adjacent = rooms.filter(
      (other) =>
        other.id !== id && other.floor === room.floor && roomsShareWall(positions[id], positions[other.id]),
    )
    // Пары комнат с закрытыми проходами. Пожелания о близости и проходах между комнатами. Двери между комнатами с сохранёнными идентификаторами.
    let blocked = [...spec.blockedPassages],
      relations = [...spec.roomRelations],
      doorInstances = [...spec.doorInstances]
    if (count === 0) {
      doorInstances = doorInstances.filter((door) => door.roomA !== id && door.roomB !== id)
      // Другой элемент коллекции для проверки связи или пересечения.
      for (const other of adjacent)
        if (!blocked.some((pair) => samePair(pair, id, other.id))) blocked.push({ a: id, b: other.id })
      relations = relations.filter((item) => !(item.type === 'access' && (item.a === id || item.b === id)))
    } else if ((spec.roomDoors[id] ?? 1) === 0) {
      // Другой элемент коллекции для проверки связи или пересечения.
      for (const other of adjacent.slice(0, count))
        blocked = blocked.filter((pair) => !samePair(pair, id, other.id))
    }
    update({
      ...spec,
      roomDoors: { ...spec.roomDoors, [id]: count },
      blockedPassages: blocked,
      roomRelations: relations,
      doorInstances,
    })
  }
  /** Проверяет размеры окна и сохраняет его размещение на наружной стене. */
  const changeWindowConfig = (key: string, config: WindowConfig) => {
    // Идентификатор и индекс заполнения из ключа, соответствующая комната и её позиция.
    const [, roomId, indexText] = key.split(':'),
      room = rooms.find((item) => item.id === roomId),
      position = positions[roomId]
    if (!room || !position || config.offset < 0.1 || config.offset > 0.9) return false
    // Сегмент стены для проверки или изменения. Доступная длина стены для размещения заполнений.
    const wall = config.wall ?? defaultExteriorSide(position),
      wallLength = wall === 'top' || wall === 'bottom' ? position.w : position.h
    // Количество элементов, которое требуется обработать или создать.
    const count = spec.roomWindows[roomId] ?? 1
    // Индекс текущего элемента при обходе коллекции.
    for (let index = 0; index < count; index++) {
      if (index === Number(indexText)) continue
      // Другой элемент коллекции для проверки связи или пересечения.
      const other = spec.windowConfigs[`window:${roomId}:${index}`] ?? {
        offset: (index + 1) / (count + 1),
        width: 1.4,
        kind: 'casement' as WindowKind,
        wall: defaultExteriorSide(position),
      }
      if ((other.wall ?? defaultExteriorSide(position)) !== wall) continue
      if (Math.abs(other.offset - config.offset) * wallLength < (other.width + config.width) / 2 + 0.25)
        return false
    }
    if (spec.entranceRoom === roomId && wall === defaultExteriorSide(position)) {
      // Положение наружного входа на стене комнаты.
      const entrance = spec.doorConfigs[`entrance:${roomId}`] ?? {
        offset: 0.5,
        width: 1,
        kind: 'swing' as DoorKind,
      }
      if (Math.abs(entrance.offset - config.offset) * wallLength < (entrance.width + config.width) / 2 + 0.25)
        return false
    }
    update({ ...spec, windowConfigs: { ...spec.windowConfigs, [key]: config } })
    return true
  }
  /** Добавляет комнату с новым идентификатором и начальными параметрами. */
  const addRoomManually = (name: string, kind: AddedRoom['kind'], floor: 1 | 2, area: number) => {
    // Идентификатор объекта для поиска и обновления.
    const id = `manual-${Date.now()}`
    update({
      ...spec,
      addedRooms: [...spec.addedRooms, { id, name, kind, floor, weight: area }],
      roomAreas: { ...spec.roomAreas, [id]: area },
    })
    setPositionEdit({ key: planKey, values: {} })
  }
  /** Удаляет комнату и связанные с ней окна, двери и связи. */
  const deleteRoomManually = (id: string) => {
    // Была ли комната добавлена пользователем.
    const isAdded = spec.addedRooms.some((room) => room.id === id)
    // Настройки комнат, очищаемые при удалении выбранной комнаты.
    const roomAreas = { ...spec.roomAreas },
      roomWindows = { ...spec.roomWindows },
      roomDoors = { ...spec.roomDoors },
      roomFloors = { ...spec.roomFloors },
      roomLayouts = { ...spec.roomLayouts }
    delete roomAreas[id]
    delete roomWindows[id]
    delete roomDoors[id]
    delete roomFloors[id]
    delete roomLayouts[id]
    update({
      ...spec,
      addedRooms: isAdded ? spec.addedRooms.filter((room) => room.id !== id) : spec.addedRooms,
      removedRooms: isAdded ? spec.removedRooms : [...new Set([...spec.removedRooms, id])],
      roomAreas,
      roomWindows,
      roomDoors,
      roomFloors,
      roomLayouts,
      roomRelations: spec.roomRelations.filter((item) => item.a !== id && item.b !== id),
      blockedPassages: spec.blockedPassages.filter((item) => item.a !== id && item.b !== id),
      openWalls: spec.openWalls.filter((item) => item.a !== id && item.b !== id),
      doorInstances: spec.doorInstances.filter((item) => item.roomA !== id && item.roomB !== id),
      entranceRoom: spec.entranceRoom === id ? null : spec.entranceRoom,
    })
    setPositionEdit({ key: planKey, values: {} })
  }
  /** Переносит комнату на другой этаж, очищая несовместимые связи. */
  const moveRoomFloorManually = (id: string, floor: 1 | 2) => {
    // Ручные позиции и размеры комнат после изменения.
    const roomLayouts = { ...spec.roomLayouts }
    delete roomLayouts[id]
    update({
      ...spec,
      roomLayouts,
      roomFloors: { ...spec.roomFloors, [id]: floor },
      roomRelations: spec.roomRelations.filter((item) => item.a !== id && item.b !== id),
      blockedPassages: spec.blockedPassages.filter((item) => item.a !== id && item.b !== id),
      openWalls: spec.openWalls.filter((item) => item.a !== id && item.b !== id),
      doorInstances: spec.doorInstances.filter((item) => item.roomA !== id && item.roomB !== id),
    })
    setPositionEdit({ key: planKey, values: {} })
  }
  /** Проверяет границы и пересечения перед сохранением положения комнаты. */
  const positionRoomManually = (id: string, x: number, y: number, maxRows = 10) => {
    // Комната, параметры которой проверяются или изменяются. Положение объекта в координатах плана или сцены.
    const room = rooms.find((item) => item.id === id),
      position = positions[id]
    if (!room || !position) return false
    // Целевой объект или точка текущего действия.
    const target = rooms.find(
      (other) =>
        other.id !== id &&
        other.floor === room.floor &&
        x >= positions[other.id].x &&
        x < positions[other.id].x + positions[other.id].w &&
        y >= positions[other.id].y &&
        y < positions[other.id].y + positions[other.id].h,
    )
    if (target) {
      // Размещение, к которому требуется привести объект.
      const targetPosition = positions[target.id]
      update({
        ...spec,
        roomLayouts: {
          ...spec.roomLayouts,
          [id]: { ...position, x: targetPosition.x, y: targetPosition.y },
          [target.id]: { ...targetPosition, x: position.x, y: position.y },
        },
      })
      return true
    }
    // Предлагаемое состояние объекта перед проверкой допустимости.
    const candidate = {
      ...position,
      x: Math.max(0, Math.min(12 - position.w, x)),
      y: Math.max(0, Math.min(maxRows - position.h, y)),
    }
    if (
      rooms.some(
        (other) =>
          other.id !== id && other.floor === room.floor && rectanglesOverlap(candidate, positions[other.id]),
      )
    )
      return false
    update({ ...spec, roomLayouts: { ...spec.roomLayouts, [id]: candidate } })
    return true
  }
  /** Меняет размеры комнаты при отсутствии пересечений и выхода за границы. */
  const resizeRoomManually = (id: string, dw: number, dh: number) => {
    // Комната, параметры которой проверяются или изменяются. Положение объекта в координатах плана или сцены.
    const room = rooms.find((item) => item.id === id),
      position = positions[id]
    if (!room || !position) return false
    // Предлагаемое состояние объекта перед проверкой допустимости.
    const candidate = {
      ...position,
      w: Math.max(1.5, Math.round((position.w + dw) * 2) / 2),
      h: Math.max(1.5, Math.round((position.h + dh) * 2) / 2),
    }
    // Размещения комнат после применения текущего изменения. Площади комнат, согласованные с их размерами.
    const layouts = {
        ...Object.fromEntries(rooms.map((item) => [item.id, { ...positions[item.id] }])),
        ...spec.roomLayouts,
        [id]: candidate,
      },
      areas = {
        ...spec.roomAreas,
        [id]: Math.max(
          3,
          Math.round(((room.area * (candidate.w * candidate.h)) / (position.w * position.h)) * 2) / 2,
        ),
      }
    // Комнаты у правой границы изменяемой комнаты.
    const rightNeighbors =
      dw !== 0
        ? rooms.filter((other) => {
            if (other.id === id || other.floor !== room.floor) return false
            // Положение соседней комнаты для проверки общей границы.
            const q = positions[other.id]
            return (
              Math.abs(q.x - position.x - position.w) < 0.03 &&
              Math.min(position.y + position.h, q.y + q.h) - Math.max(position.y, q.y) > 0.55
            )
          })
        : []
    // Комнаты у нижней границы изменяемой комнаты.
    const bottomNeighbors =
      dh !== 0
        ? rooms.filter((other) => {
            if (other.id === id || other.floor !== room.floor) return false
            // Положение соседней комнаты для проверки общей границы.
            const q = positions[other.id]
            return (
              Math.abs(q.y - position.y - position.h) < 0.03 &&
              Math.min(position.x + position.w, q.x + q.w) - Math.max(position.x, q.x) > 0.55
            )
          })
        : []
    // Соседний объект, на который может повлиять изменение.
    for (const neighbor of rightNeighbors) {
      // Положение соседней комнаты для проверки общей границы. Следующее состояние после применения изменения.
      const q = positions[neighbor.id],
        next = { ...q, x: q.x + dw, w: q.w - dw }
      if (next.w < 1.5 || next.x < 0 || next.x + next.w > 12) return false
      layouts[neighbor.id] = next
      areas[neighbor.id] = Math.max(
        3,
        Math.round(((neighbor.area * (next.w * next.h)) / (q.w * q.h)) * 2) / 2,
      )
    }
    // Соседний объект, на который может повлиять изменение.
    for (const neighbor of bottomNeighbors) {
      // Положение соседней комнаты для проверки общей границы. Следующее состояние после применения изменения.
      const q = positions[neighbor.id],
        next = { ...q, y: q.y + dh, h: q.h - dh }
      if (next.h < 1.5 || next.y < 0 || next.y + next.h > 10) return false
      layouts[neighbor.id] = next
      areas[neighbor.id] = Math.max(
        3,
        Math.round(((neighbor.area * (next.w * next.h)) / (q.w * q.h)) * 2) / 2,
      )
    }
    if (candidate.x + candidate.w > 12 || candidate.y + candidate.h > 10) return false
    if (
      !rightNeighbors.length &&
      !bottomNeighbors.length &&
      (dw > 0 || dh > 0) &&
      rooms.some(
        (other) =>
          other.id !== id && other.floor === room.floor && rectanglesOverlap(candidate, positions[other.id]),
      )
    )
      return false
    update({ ...spec, roomLayouts: layouts, roomAreas: areas })
    return true
  }
  /** Обновляет сохранённое состояние для следующего шага истории. */
  const markHistorySaved = () => {
    setSaveStatus('Сохраняем…')
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => setSaveStatus('Сохранено'), 350)
  }
  /** Восстанавливает предыдущий снимок и переносит текущий в историю повтора. */
  const undo = () => {
    // Предыдущее состояние для отмены или сравнения.
    const prev = history.at(-1)
    if (!prev) return
    setFuture((items) => [spec, ...items].slice(0, 50))
    setHistory((items) => items.slice(0, -1))
    setSpec(prev)
    markHistorySaved()
    window.dispatchEvent(
      new CustomEvent('domovid-history', { detail: { message: 'Последнее изменение отменено.' } }),
    )
  }
  /** Восстанавливает следующий снимок из истории повтора. */
  const redo = () => {
    // Следующее состояние после применения изменения.
    const next = future[0]
    if (!next) return
    setHistory((items) => [...items.slice(-49), spec])
    setFuture((items) => items.slice(1))
    setSpec(next)
    markHistorySaved()
    window.dispatchEvent(new CustomEvent('domovid-history', { detail: { message: 'Изменение возвращено.' } }))
  }
  useEffect(() => {
    /** Выполняет отмену или повтор по горячим клавишам вне полей ввода. */
    const handle = (event: KeyboardEvent) => {
      // Целевой объект или точка текущего действия.
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
      // Команда, распознанная по пользовательскому вводу.
      const action = historyShortcut(event)
      if (!action) return
      event.preventDefault()
      if (action === 'undo') undo()
      else redo()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [history, future, spec])
  // Разница значений до и после изменения.
  const delta = Math.round((data.high - data.low) / 2 / 100000) * 100000
  return (
    <main className={styles['workspace']}>
      <header className={styles['workspace-header']}>
        <button className={[styles['brand'], styles['compact']].filter(Boolean).join(' ')} onClick={onReset}>
          <span className={styles['brand-mark']}>
            <Icon name="home" />
          </span>
          <span>Домовид</span>
        </button>
        <div className={styles['project-title']}>
          <strong>Дом {data.area} м²</strong>
          <span aria-live="polite">{saveStatus} в браузере</span>
        </div>
        <div className={styles['header-actions']}>
          <button
            className={[styles['ghost-button'], styles['reset-button']].filter(Boolean).join(' ')}
            onClick={onClear}
            aria-label="Сбросить проект"
          >
            <Icon name="reset" />
            <span>Сбросить</span>
          </button>
          <button
            className={styles['ghost-button']}
            onClick={undo}
            disabled={!history.length}
            title="Отменить · Alt+Z / Ctrl+Z"
          >
            <Icon name="undo" />
            <span>Отменить</span>
          </button>
          <button
            className={styles['ghost-button']}
            onClick={redo}
            disabled={!future.length}
            title="Вернуть · Alt+Y / Ctrl+Y"
          >
            <Icon name="redo" />
            <span>Вернуть</span>
          </button>
        </div>
      </header>
      <nav className={styles['mobile-tabs']} aria-label="Разделы проекта">
        {(
          [
            ['params', 'Параметры'],
            ['model', 'Модель'],
            ['estimate', 'Расчёт'],
          ] as const
        ).map(([id, label]) => (
          <button aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} key={id}>
            {label}
          </button>
        ))}
      </nav>
      <div className={styles['workspace-grid']}>
        <aside className={`${styles['settings-panel']} ${tab === 'params' ? styles['mobile-active'] : ''}`}>
          <div>
            <span className={styles['panel-label']}>Настройте дом</span>
            <h2>Объём и планировка</h2>
            <p>Меняйте основные параметры. Модель и расчёт обновятся вместе.</p>
          </div>
          <div className={styles['change-note']}>
            <span>Последнее изменение</span>
            <strong>Расчёт обновлён · запас диапазона {money(delta)}</strong>
            {spec.wishes.length > 0 && <em>Пожелания: {spec.wishes.join(', ')}</em>}
          </div>
        </aside>
        <section className={`${styles['model-panel']} ${tab === 'model' ? styles['mobile-active'] : ''}`}>
          <div className={styles['model-toolbar']}>
            <div>
              <strong>{modelView === 'volume' ? 'Объём дома' : 'Планировка'}</strong>
              <span>
                {modelView === 'volume' ? 'Концептуальная 3D-модель' : 'Автоматическое распределение площади'}
              </span>
            </div>
            <div className={styles['view-switch']} role="group" aria-label="Вид проекта">
              <button
                type="button"
                aria-pressed={modelView === 'volume'}
                onPointerEnter={() => void loadHouse3D()}
                onFocus={() => void loadHouse3D()}
                onClick={() => setModelView('volume')}
              >
                3D
              </button>
              <button type="button" aria-pressed={modelView === 'plan'} onClick={() => setModelView('plan')}>
                План
              </button>
            </div>
          </div>
          {modelView === 'volume' ? (
            <HouseCanvas spec={spec} />
          ) : (
            <FloorPlan
              spec={spec}
              rooms={rooms}
              positions={positions}
              hasEdits={
                Boolean(spec.customPlan) ||
                Object.keys(spec.roomAreas).length > 0 ||
                Object.keys(positionOverrides).length > 0 ||
                Boolean(orderEdit.key === planKey && orderEdit.values.length) ||
                Object.keys(spec.roomWindows).length > 0 ||
                Object.keys(spec.roomDoors).length > 0 ||
                Object.keys(spec.doorConfigs).length > 0 ||
                spec.doorInstances.length > 0 ||
                Object.keys(spec.windowConfigs).length > 0 ||
                Boolean(spec.entranceRoom) ||
                spec.roomRelations.length > 0 ||
                spec.blockedPassages.length > 0 ||
                spec.openWalls.length > 0 ||
                Object.keys(spec.roomLayouts).length > 0 ||
                Object.keys(spec.roomFloors).length > 0 ||
                spec.removedRooms.length > 0 ||
                spec.addedRooms.length > 0
              }
              onAddRoom={addRoomManually}
              onDeleteRoom={deleteRoomManually}
              onMoveRoomFloor={moveRoomFloorManually}
              onReset={() => {
                setPositionEdit({ key: planKey, values: {} })
                setOrderEdit({ key: planKey, values: [] })
                update({
                  ...DEFAULT_SPEC,
                  wall: spec.wall,
                  roof: spec.roof,
                  region: spec.region,
                  construction: spec.construction,
                })
              }}
              onRoomAreaChange={changeRoomArea}
              onRoomWindowChange={(id, count) =>
                update({ ...spec, roomWindows: { ...spec.roomWindows, [id]: count } })
              }
              onRoomDoorChange={changeRoomDoors}
              onPassageChange={changePassage}
              onDoorConfig={(key, config) =>
                spec.doorInstances.some((door) => door.id === key)
                  ? update({
                      ...spec,
                      doorInstances: spec.doorInstances.map((door) =>
                        door.id === key ? { ...door, ...config } : door,
                      ),
                    })
                  : update({ ...spec, doorConfigs: { ...spec.doorConfigs, [key]: config } })
              }
              onWindowConfig={changeWindowConfig}
              onEntranceChange={(roomId) => update({ ...spec, entranceRoom: roomId })}
              onPositionRoom={positionRoomManually}
              onResizeRoom={resizeRoomManually}
            />
          )}
          <div className={styles['model-facts']} aria-label="Параметры модели">
            <span>
              <b>
                {data.width.toFixed(1)} × {data.length.toFixed(1)} м
              </b>{' '}
              габариты
            </span>
            <span>
              <b>{data.rooms}</b> помещений
            </span>
            <span>
              <b>{spec.construction.walls.length}</b> сегментов стен
            </span>
          </div>
        </section>
        <aside className={`${styles['estimate-panel']} ${tab === 'estimate' ? styles['mobile-active'] : ''}`}>
          <div className={styles['estimate-heading']}>
            <span className={styles['panel-label']}>Предварительный расчёт</span>
            <h2>
              {money(data.low)}
              <br />
              <span>— {money(data.high)}</span>
            </h2>
            <p>{spec.region} · локальные коэффициенты MVP</p>
          </div>
          <dl className={styles['key-values']}>
            <div>
              <dt>Площадь построенных этажей</dt>
              <dd>{data.area} м²</dd>
            </div>
            <div>
              <dt>Площадь стен</dt>
              <dd>{Math.round(data.wallArea)} м²</dd>
            </div>
            <div>
              <dt>Кровля</dt>
              <dd>{Math.round(data.roofArea)} м²</dd>
            </div>
            <div>
              <dt>Фундамент</dt>
              <dd>{data.foundation.toFixed(1)} м³</dd>
            </div>
          </dl>
          <button
            className={styles['calculation-button']}
            onClick={() => setDetail(!detail)}
            aria-expanded={detail}
          >
            {detail ? 'Скрыть состав' : 'Как рассчитано'} <Icon name="arrow" />
          </button>
          {detail && (
            <div className={styles['estimate-breakdown']}>
              <div className={styles['breakdown-head']}>
                <strong>Состав базовой стоимости</strong>
                <span>Материалы и работа</span>
              </div>
              <div className={styles['cost-items']}>
                {costItems.map((item) => (
                  <article className={styles['cost-item']} key={item.id}>
                    <header>
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.quantity.toFixed(item.unit === 'м³' ? 1 : 0)} {item.unit}
                        </span>
                      </div>
                      <b>{money(item.materials + item.labor)}</b>
                    </header>
                    <dl>
                      <div>
                        <dt>Материалы</dt>
                        <dd>{money(item.materials)}</dd>
                      </div>
                      <div>
                        <dt>Работа</dt>
                        <dd>{money(item.labor)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <dl className={styles['cost-summary']}>
                <div>
                  <dt>Материалы</dt>
                  <dd>{money(materialTotal)}</dd>
                </div>
                <div>
                  <dt>Работы</dt>
                  <dd>{money(laborTotal)}</dd>
                </div>
                <div>
                  <dt>Базовая стоимость</dt>
                  <dd>{money(materialTotal + laborTotal)}</dd>
                </div>
              </dl>
              <div className={styles['assumptions']}>
                <h3>Пока не включено</h3>
                <ul>
                  <li>участок, геология и разрешения;</li>
                  <li>подключение внешних коммуникаций;</li>
                  <li>чистовая отделка, мебель и благоустройство.</li>
                </ul>
              </div>
            </div>
          )}
          <div className={styles['trust-note']}>
            <Icon name="info" />
            <p>
              <strong>Это концепция, не строительный проект.</strong> Итоговая стоимость определяется после
              инженерных расчётов и предложений подрядчиков.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
