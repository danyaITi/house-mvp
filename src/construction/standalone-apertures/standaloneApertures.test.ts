import { describe, expect, it } from 'vitest'
import {
  addStandaloneAperture,
  duplicateStandaloneApertures,
  duplicateStandaloneFixtures,
  installApertureFixture,
  moveStandaloneFixtures,
  standaloneApertureAcceptsFixture,
  standaloneApertureFits,
  standaloneApertureFixtureGeometry,
  standaloneApertureSegments,
  transformStandaloneApertures,
  updateStandaloneFixtureMaterial,
} from '@/construction/standalone-apertures/standaloneApertures'
import type { ConstructionModel, StandaloneAperture } from '@/construction/model/constructionModel'

// Строительная модель, над которой выполняется операция.
const model: ConstructionModel = {
  width: 6,
  depth: 6,
  cells: Array.from({ length: 16 }, (_, index) => ({ x: index % 4, y: Math.floor(index / 4) })),
  walls: [],
}
// Отдельный проём для проверки или изменения.
const aperture: StandaloneAperture = {
  id: 'door-aperture:1',
  kind: 'door',
  size: 'large',
  axis: 'h',
  x: 1,
  y: 1,
}

describe('standalone apertures', () => {
  it('keeps every fixture completely inside its aperture', () => {
    // Дверной проём проверяемого размера.
    const smallDoor = standaloneApertureFixtureGeometry({ ...aperture, size: 'small' })
    // Дверной проём проверяемого размера.
    const largeDoor = standaloneApertureFixtureGeometry(aperture)
    // Оконный проём проверяемого размера.
    const smallWindow = standaloneApertureFixtureGeometry({ ...aperture, kind: 'window', size: 'small' })
    // Оконный проём проверяемого размера.
    const panoramicWindow = standaloneApertureFixtureGeometry({ ...aperture, kind: 'window', size: 'large' })
    // Габариты и положение геометрии объекта.
    for (const geometry of [smallDoor, largeDoor, smallWindow, panoramicWindow]) {
      expect(geometry.width).toBeLessThan(geometry.span)
      expect(geometry.height).toBeLessThan(geometry.cutHeight)
      expect(geometry.bottom).toBeGreaterThan(geometry.cutBottom)
      expect(geometry.depth).toBeLessThanOrEqual(0.11)
    }
    expect(panoramicWindow.height).toBeCloseTo(2.46)
  })

  it('shows a fixture placeholder only in a matching aperture kind and size', () => {
    expect(standaloneApertureAcceptsFixture({ ...aperture, size: 'small' }, 'door', 'swing')).toBe(true)
    expect(standaloneApertureAcceptsFixture(aperture, 'door', 'double')).toBe(true)
    expect(standaloneApertureAcceptsFixture(aperture, 'window', 'panoramic')).toBe(false)
    expect(standaloneApertureAcceptsFixture({ ...aperture, kind: 'window' }, 'window', 'panoramic')).toBe(
      true,
    )
    expect(standaloneApertureAcceptsFixture({ ...aperture, kind: 'window' }, 'window', 'fixed')).toBe(false)
  })
  it('occupies one or two independent grid segments', () => {
    expect(standaloneApertureSegments({ ...aperture, size: 'small' })).toHaveLength(1)
    expect(standaloneApertureSegments(aperture)).toHaveLength(2)
  })
  it('does not require a wall for placement', () => {
    expect(model.walls).toEqual([])
    expect(standaloneApertureFits(model, aperture)).toBe(true)
    expect(addStandaloneAperture(model, aperture).apertures).toEqual([aperture])
  })
  it('moves and rotates copies without mutating the source model', () => {
    // Модель с отдельно установленным проёмом.
    const withAperture = addStandaloneAperture(model, aperture)
    // Модель после совместного переноса и поворота.
    const transformed = transformStandaloneApertures(withAperture, [aperture.id], 1, 0, 1)
    expect(withAperture.apertures?.[0]).toEqual(aperture)
    expect(transformed?.apertures[0]).toMatchObject({ axis: 'v', x: 2, y: 1 })
  })
  it('duplicates one aperture with its installed fixture to the nearest free position', () => {
    // Модель после установки заполнения в проём.
    const installed = installApertureFixture(
      addStandaloneAperture(model, aperture),
      aperture.id,
      'door',
      'double',
      'wood',
    )
    // Модель с созданной копией выбранного объекта.
    const duplicated = duplicateStandaloneApertures(installed, [aperture.id])
    expect(duplicated?.apertures).toHaveLength(1)
    expect(duplicated?.apertures[0]).toMatchObject({
      kind: 'door',
      size: 'large',
      fixture: { style: 'double', material: 'wood' },
    })
    expect(duplicated?.apertures[0].id).not.toBe(aperture.id)
  })
  it('duplicates a selected aperture group while preserving its layout', () => {
    // Один из двух объектов, участвующих в проверке.
    const second: StandaloneAperture = {
      ...aperture,
      id: 'window-aperture:1',
      kind: 'window',
      size: 'small',
      x: 3,
    }
    // Объекты, подготовленные для групповой операции.
    const grouped = { ...model, apertures: [aperture, second] }
    // Модель с созданной копией выбранного объекта.
    const duplicated = duplicateStandaloneApertures(grouped, [aperture.id, second.id])
    expect(duplicated?.apertures).toHaveLength(2)
    // Копии двух проёмов для проверки группового дублирования.
    const [firstCopy, secondCopy] = duplicated!.apertures
    expect(secondCopy.x - firstCopy.x).toBe(second.x - aperture.x)
    expect(secondCopy.y - firstCopy.y).toBe(second.y - aperture.y)
  })
  it('rejects overlap with another independent aperture', () => {
    // Модель с отдельно установленным проёмом.
    const withAperture = addStandaloneAperture(model, aperture)
    expect(
      standaloneApertureFits(withAperture, { ...aperture, id: 'window-aperture:1', kind: 'window' }),
    ).toBe(false)
  })
  it('rejects perpendicular door and window apertures crossing through each other', () => {
    // Модель с дверью для проверки связанных объектов.
    const withDoor = addStandaloneAperture(model, aperture)
    // Объект, пересекающий проверяемый проём.
    const crossingWindow: StandaloneAperture = {
      id: 'window-aperture:1',
      kind: 'window',
      size: 'small',
      axis: 'v',
      x: 2,
      y: 1,
    }
    expect(standaloneApertureFits(withDoor, crossingWindow)).toBe(false)
    // Модель с окном для проверки связанных объектов.
    const withWindow = addStandaloneAperture(model, { ...aperture, id: 'window-aperture:1', kind: 'window' })
    expect(
      standaloneApertureFits(withWindow, { ...crossingWindow, id: 'door-aperture:2', kind: 'door' }),
    ).toBe(false)
  })
  it('rejects a perpendicular wall entering the middle of a wide aperture but allows a shared corner', () => {
    // Объект, пересекающий проверяемый проём.
    const crossingWall = { axis: 'v' as const, x: 2, y: 1, level: 1 as const }
    expect(standaloneApertureFits({ ...model, walls: [crossingWall] }, aperture)).toBe(false)
    // Стена у угла для проверки допустимости примыкания.
    const cornerWall = { axis: 'v' as const, x: 3, y: 1, level: 1 as const }
    expect(standaloneApertureFits({ ...model, walls: [cornerWall] }, aperture)).toBe(true)
  })
  it('rejects placement on an existing wall segment', () => {
    // Модель со стеной для проверки опоры и пересечений.
    const withWall = { ...model, walls: [{ axis: 'h' as const, x: 1, y: 1, level: 1 as const }] }
    expect(standaloneApertureFits(withWall, aperture)).toBe(false)
    expect(standaloneApertureFits(withWall, { ...aperture, x: 2, size: 'small' })).toBe(true)
  })
  it('installs only a matching fixture into an existing aperture', () => {
    // Модель с отдельно установленным проёмом.
    const withAperture = addStandaloneAperture(model, aperture)
    expect(installApertureFixture(withAperture, aperture.id, 'window', 'fixed', 'pvc')).toBe(withAperture)
    expect(installApertureFixture(withAperture, aperture.id, 'door', 'swing', 'wood')).toBe(withAperture)
    expect(
      installApertureFixture(withAperture, aperture.id, 'door', 'double', 'wood').apertures?.[0].fixture,
    ).toEqual({ style: 'double', material: 'wood' })
  })
  it('changes material of selected installed doors or windows without changing their apertures', () => {
    // Модель после установки заполнения в проём.
    const installed = installApertureFixture(
      addStandaloneAperture(model, aperture),
      aperture.id,
      'door',
      'double',
      'wood',
    )
    // Состояние после изменения параметров объекта.
    const updated = updateStandaloneFixtureMaterial(installed, [aperture.id], 'metal')
    expect(updated.apertures?.[0]).toMatchObject({
      kind: 'door',
      size: 'large',
      fixture: { style: 'double', material: 'metal' },
    })
  })
  it('moves only the fixture into a matching empty aperture', () => {
    // Целевой объект или точка текущего действия.
    const target: StandaloneAperture = { ...aperture, id: 'door-aperture:2', x: 3 }
    // Модель после установки заполнения в проём.
    const installed = installApertureFixture(
      { ...model, apertures: [aperture, target] },
      aperture.id,
      'door',
      'double',
      'wood',
    )
    // Состояние объекта после переноса.
    const moved = moveStandaloneFixtures(installed, [aperture.id], 2, 0)
    expect(moved?.apertures?.find((item) => item.id === aperture.id)?.fixture).toBeUndefined()
    expect(moved?.apertures?.find((item) => item.id === target.id)?.fixture).toEqual({
      style: 'double',
      material: 'wood',
    })
  })
  it('duplicates fixtures only into empty apertures of the same kind and size', () => {
    // Целевой объект или точка текущего действия.
    const target: StandaloneAperture = { ...aperture, id: 'door-aperture:2', x: 3 }
    // Модель после установки заполнения в проём.
    const installed = installApertureFixture(
      { ...model, apertures: [aperture, target] },
      aperture.id,
      'door',
      'double',
      'wood',
    )
    expect(
      duplicateStandaloneFixtures(installed, [aperture.id])?.apertures?.find((item) => item.id === target.id)
        ?.fixture,
    ).toEqual({ style: 'double', material: 'wood' })
  })
})
