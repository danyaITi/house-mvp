import { describe, expect, it } from 'vitest'
import {
  getActiveConstructionLevel,
  getConstructionGrid,
  getConstructionLevels,
  getExteriorLevels,
  hasConstructionObjectsAtLevel,
} from '@/construction/levels/constructionLevels'
import type { ConstructionModel } from '@/construction/model/constructionModel'

/** Создаёт модель с параметрами тестового сценария. */
const model = (change: Partial<ConstructionModel> = {}): ConstructionModel => ({
  width: 8,
  depth: 6,
  cells: [],
  walls: [],
  ...change,
})

describe('construction levels', () => {
  it('orders available floor levels and falls back to the first existing level', () => {
    // Значение, проверяемое перед применением.
    const value = model({
      cells: [
        { x: 0, y: 0, level: 3 },
        { x: 0, y: 0, level: 1 },
        { x: 0, y: 0, level: 2 },
      ],
    })
    expect(getConstructionLevels(value)).toEqual([1, 2, 3])
    expect(getActiveConstructionLevel(value, 3)).toBe(3)
    expect(getActiveConstructionLevel(value, 4)).toBe(1)
    expect(getActiveConstructionLevel(model(), 4)).toBe(1)
  })

  it('always keeps the first level in the exterior view', () => {
    expect(getExteriorLevels(model({ walls: [{ axis: 'h', x: 0, y: 0, level: 3 }] }))).toEqual([1, 3])
  })

  it('distinguishes an automatically copied slab from objects built on that floor', () => {
    // Плита основания, используемая для проверки опоры.
    const slab = model({ cells: [{ x: 0, y: 0, level: 2, material: 'slab' }] })
    expect(hasConstructionObjectsAtLevel(slab, 2)).toBe(false)
    expect(hasConstructionObjectsAtLevel({ ...slab, walls: [{ axis: 'h', x: 0, y: 0, level: 2 }] }, 2)).toBe(
      true,
    )
    expect(
      hasConstructionObjectsAtLevel(
        {
          ...slab,
          apertures: [{ id: 'window:1', kind: 'window', size: 'small', axis: 'h', x: 0, y: 0, level: 2 }],
        },
        2,
      ),
    ).toBe(true)
    expect(
      hasConstructionObjectsAtLevel(
        { ...slab, stairs: [{ cell: { x: 0, y: 0, level: 2 }, shape: 'straight' }] },
        2,
      ),
    ).toBe(true)
  })

  it('sizes an upper-floor grid from the supporting floor footprint', () => {
    // Значение, проверяемое перед применением.
    const value = model({
      cells: [
        { x: 2, y: 1, level: 1 },
        { x: 3, y: 1, level: 1 },
        { x: 2, y: 2, level: 1 },
        { x: 3, y: 2, level: 1 },
      ],
    })
    expect(getConstructionGrid(value, 1)).toEqual({ width: 8, depth: 6, x: 0, z: 0 })
    expect(getConstructionGrid(value, 2)).toEqual({ width: 2, depth: 2, x: -1, z: -1 })
  })
})
