import { describe, expect, it } from 'vitest'
import type { HouseSpec, PlannedRoom } from '@/domain/house/houseTypes'
import {
  applyRoomOverrides,
  arrangeRoomsByRelations,
  buildCoordinateLayout,
  generateRoomPlan,
  rectanglesOverlap,
  relationScore,
} from '@/domain/room-plan/roomPlan'

// Исходные параметры дома для сценариев расчёта.
const baseSpec = {
  area: 100,
  floors: 1,
  bedrooms: 2,
  wishes: [],
  roomFloors: {},
  removedRooms: [],
  addedRooms: [],
  customPlan: null,
} as unknown as HouseSpec

describe('room plan calculations', () => {
  it('reserves circulation space and keeps the total close to the requested area', () => {
    // Комнаты, участвующие в расчёте планировки.
    const rooms = generateRoomPlan(baseSpec)
    expect(rooms.some((room) => room.kind === 'circulation')).toBe(true)
    expect(rooms.reduce((sum, room) => sum + room.area, 0)).toBeCloseTo(100, 0)
  })

  it('compensates a room override from the hall on the same floor', () => {
    // Комнаты, участвующие в расчёте планировки.
    const rooms: PlannedRoom[] = [
      { id: 'room', name: 'Room', area: 20, floor: 1, kind: 'bedroom' },
      { id: 'hall', name: 'Hall', area: 10, floor: 1, kind: 'circulation' },
    ]
    // Результат применения ручных настроек.
    const adjusted = applyRoomOverrides(rooms, { room: 24 })
    expect(adjusted.find((room) => room.id === 'hall')?.area).toBe(6)
  })

  it('produces non-overlapping rows that fill the plan height', () => {
    // Прямоугольные размещения комнат по идентификаторам.
    const positions = buildCoordinateLayout(generateRoomPlan(baseSpec))
    expect(Math.max(...Object.values(positions).map((position) => position.y + position.h))).toBeCloseTo(10)
    // Прямоугольники комнат для проверки взаимных пересечений.
    const rectangles = Object.values(positions)
    // Индекс текущего элемента при обходе коллекции.
    for (let i = 0; i < rectangles.length; i += 1) {
      // Индекс текущего элемента при обходе коллекции.
      for (let j = i + 1; j < rectangles.length; j += 1) {
        expect(rectanglesOverlap(rectangles[i], rectangles[j])).toBe(false)
      }
    }
  })

  it('improves an adjacency request without changing the room set', () => {
    // Комнаты, участвующие в расчёте планировки.
    const rooms = generateRoomPlan(baseSpec)
    // Комнаты после оптимизации их порядка.
    const arranged = arrangeRoomsByRelations(rooms, [{ a: 'living', b: 'bedroom-1', type: 'near' }])
    expect(new Set(arranged.map((room) => room.id))).toEqual(new Set(rooms.map((room) => room.id)))
    // Пожелания о близости и проходах между комнатами.
    const relations = [{ a: 'living', b: 'bedroom-1', type: 'near' as const }]
    expect(relationScore(arranged, relations)).toBeLessThanOrEqual(relationScore(rooms, relations))
  })
})
