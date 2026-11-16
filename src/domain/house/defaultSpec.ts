import type { HouseSpec } from '@/domain/house/houseTypes'

// Начальные параметры дома и пустая строительная модель.
export const DEFAULT_SPEC: HouseSpec = {
  area: 120,
  floors: 1,
  bedrooms: 3,
  wall: 'aerated',
  roof: 'gable',
  region: 'Московская область',
  wishes: [],
  roomWindows: {},
  roomDoors: {},
  roomAreas: {},
  roomRelations: [],
  blockedPassages: [],
  openWalls: [],
  doorConfigs: {},
  doorInstances: [],
  windowConfigs: {},
  entranceRoom: null,
  roomFloors: {},
  roomLayouts: {},
  removedRooms: [],
  addedRooms: [],
  construction: { width: 12, depth: 10, cells: [], walls: [] },
  customPlan: null,
}
