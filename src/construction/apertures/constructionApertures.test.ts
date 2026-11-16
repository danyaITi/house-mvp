import { describe, expect, it } from 'vitest'
import {
  apertureFits,
  constructionApertureForOpening,
  normalizeConstructionModel,
} from '@/construction/apertures/constructionApertures'
import type { ConstructionModel, ConstructionWall } from '@/construction/model/constructionModel'

// Один из двух объектов, участвующих в проверке.
const first: ConstructionWall = { axis: 'h', x: 1, y: 1, level: 1 }
// Один из двух объектов, участвующих в проверке.
const second: ConstructionWall = { axis: 'h', x: 2, y: 1, level: 1 }
/** Создаёт исходную строительную модель для тестового сценария. */
const base = (walls = [first, second]): ConstructionModel => ({
  width: 5,
  depth: 5,
  cells: [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  walls,
})

describe('construction apertures', () => {
  it('creates separate small door and window apertures', () => {
    expect(constructionApertureForOpening({ kind: 'door', wall: first, style: 'swing' })).toMatchObject({
      kind: 'door-aperture',
      size: 'small',
      walls: [first],
    })
    expect(constructionApertureForOpening({ kind: 'window', wall: first, style: 'fixed' })).toMatchObject({
      kind: 'window-aperture',
      size: 'small',
      walls: [first],
    })
  })

  it('creates large apertures across two collinear segments', () => {
    expect(
      constructionApertureForOpening({ kind: 'door', wall: first, style: 'sliding', spanDirection: 1 }),
    ).toMatchObject({ kind: 'door-aperture', size: 'large', walls: [first, second] })
    expect(
      constructionApertureForOpening({ kind: 'window', wall: first, style: 'panoramic', spanDirection: 1 }),
    ).toMatchObject({ kind: 'window-aperture', size: 'large', walls: [first, second] })
  })

  it('rejects a large aperture split by a perpendicular wall', () => {
    // Поперечная стена в месте стыка сегментов.
    const junction: ConstructionWall = { axis: 'v', x: 2, y: 1, level: 1 }
    // Строительная модель, над которой выполняется операция.
    const model = base([first, second, junction])
    expect(
      apertureFits(
        model,
        constructionApertureForOpening({ kind: 'door', wall: first, style: 'double', spanDirection: 1 }),
      ),
    ).toBe(false)
  })

  it('removes a legacy invalid opening during model migration', () => {
    // Поперечная стена в месте стыка сегментов.
    const junction: ConstructionWall = { axis: 'v', x: 2, y: 1, level: 1 }
    // Строительная модель, над которой выполняется операция.
    const model = {
      ...base([first, second, junction]),
      openings: [{ kind: 'window' as const, wall: first, style: 'panoramic', spanDirection: 1 as const }],
    }
    expect(normalizeConstructionModel(model).openings).toEqual([])
  })
})
