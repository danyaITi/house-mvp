import { describe, expect, it } from 'vitest'
import type { HouseSpec } from '@/domain/house/houseTypes'
import { estimateHouse } from '@/domain/estimate/houseEstimate'

/** Создаёт параметры дома с заданной строительной моделью для теста. */
const spec = (construction: HouseSpec['construction']): HouseSpec =>
  ({
    area: 120,
    floors: 1,
    bedrooms: 3,
    wall: 'aerated',
    roof: 'gable',
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
    customPlan: null,
    region: 'Москва',
    construction,
  }) as HouseSpec

describe('estimateHouse', () => {
  it('uses the constructed cells as the measured area and footprint', () => {
    // Результат операции, используемый для дальнейшей проверки.
    const result = estimateHouse(
      spec({
        width: 4,
        depth: 4,
        cells: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        walls: [],
      }),
    )

    expect(result.area).toBe(2)
    expect(result.width).toBe(2)
    expect(result.length).toBe(1)
    expect(result.foundation).toBeCloseTo(0.56)
  })

  it('subtracts an opening from the net wall area', () => {
    // Сегмент стены для проверки или изменения.
    const wall = { x: 0, y: 0, axis: 'h' as const }
    // Модель или расчёт стены без заполнения для сравнения.
    const withoutOpening = estimateHouse(spec({ width: 2, depth: 2, cells: [{ x: 0, y: 0 }], walls: [wall] }))
    // Модель или расчёт стены с заполнением для сравнения.
    const withOpening = estimateHouse(
      spec({
        width: 2,
        depth: 2,
        cells: [{ x: 0, y: 0 }],
        walls: [wall],
        openings: [{ wall, kind: 'door', style: 'single' }],
      }),
    )

    expect(withOpening.wallArea).toBeLessThan(withoutOpening.wallArea)
    expect(withOpening.costs.walls).toBeLessThan(withoutOpening.costs.walls)
  })

  it('keeps the displayed range around the base estimate', () => {
    // Результат операции, используемый для дальнейшей проверки.
    const result = estimateHouse(spec({ width: 1, depth: 1, cells: [{ x: 0, y: 0 }], walls: [] }))
    // Исходное значение для дальнейшего расчёта.
    const base = Object.values(result.costs).reduce((sum, value) => sum + value, 0)

    expect(result.low).toBeCloseTo(base * 0.92)
    expect(result.high).toBeCloseTo(base * 1.14)
  })
})
