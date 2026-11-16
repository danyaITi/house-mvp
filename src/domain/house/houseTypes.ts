import type { ConstructionModel } from '@/construction/model/constructionModel'
import type { DoorConfig, DoorInstance } from '@/openings/openingModel'

/** Материал стен, используемый в параметрах дома и смете. */
export type Wall = 'aerated' | 'brick' | 'frame' | 'timber' | 'log'
/** Форма кровли, определяющая геометрию и коэффициент площади. */
export type Roof = 'gable' | 'hip' | 'flat'
/** Пожелание о близости, удалённости или проходе между комнатами. */
export type RoomRelation = { a: string; b: string; type: 'near' | 'away' | 'access' }
/** Неупорядоченная пара комнат для общей стены или прохода. */
export type RoomPair = { a: string; b: string }
/** Тип окна, определяющий вид и размеры заполнения. */
export type WindowKind = 'casement' | 'fixed' | 'panoramic'
/** Сторона прямоугольной комнаты в координатах плана. */
export type WallSide = 'top' | 'bottom' | 'left' | 'right'
/** Размер и положение окна вдоль выбранной стены. */
export type WindowConfig = { offset: number; width: number; kind: WindowKind; wall?: WallSide }
/** Назначение комнаты для распределения площади и отображения. */
export type RoomKind = 'living' | 'bedroom' | 'service' | 'circulation' | 'extra'
/** Прямоугольник комнаты в координатах плана 12×10. */
export type RoomPosition = { x: number; y: number; w: number; h: number }

/** Пользовательская комната с базовой площадью и этажом. */
export type AddedRoom = {
  id: string
  name: string
  weight: number
  floor: 1 | 2
  kind: 'service' | 'extra' | 'bedroom'
}

/** Пользовательский набор комнат и их прямоугольных размещений. */
export type CustomPlan = { rooms: AddedRoom[]; layouts: Record<string, RoomPosition> }

/** Параметры дома, ручные настройки комнат и строительная модель. */
export type HouseSpec = {
  area: number
  floors: 1 | 2
  bedrooms: number
  wall: Wall
  roof: Roof
  region: string
  wishes: string[]
  roomWindows: Record<string, number>
  roomDoors: Record<string, number>
  roomAreas: Record<string, number>
  roomRelations: RoomRelation[]
  blockedPassages: RoomPair[]
  openWalls: RoomPair[]
  doorConfigs: Record<string, DoorConfig>
  doorInstances: DoorInstance[]
  windowConfigs: Record<string, WindowConfig>
  entranceRoom: string | null
  roomFloors: Record<string, 1 | 2>
  roomLayouts: Record<string, RoomPosition>
  removedRooms: string[]
  addedRooms: AddedRoom[]
  construction: ConstructionModel
  customPlan: CustomPlan | null
}

/** Комната с рассчитанной площадью, назначением и этажом. */
export type PlannedRoom = { id: string; name: string; area: number; floor: 1 | 2; kind: RoomKind }

/** Измеренные объёмы работ и ориентировочный диапазон стоимости. */
export type Estimate = {
  area: number
  width: number
  length: number
  wallArea: number
  roofArea: number
  foundation: number
  low: number
  high: number
  rooms: number
  openings: number
  costs: Record<'foundation' | 'walls' | 'roof' | 'openings' | 'stairs' | 'floors' | 'engineering', number>
}

/** Строка сметы с количеством и разделением материалов и работ. */
export type CostItem = {
  id: string
  name: string
  quantity: number
  unit: string
  materials: number
  labor: number
}
