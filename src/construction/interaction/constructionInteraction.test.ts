import { describe, expect, it } from 'vitest'
import {
  constructionPointerPlaneSize,
  hasPointerDrag,
  isBuildToolCancelInput,
  selectCoveredWallKeys,
  shouldDragSelectedWallsFromOpening,
  shouldHighlightOpening,
  shouldHighlightStandaloneAperture,
  shouldHighlightWall,
} from '@/construction/interaction/constructionInteraction'

describe('construction interaction invariants', () => {
  it('подсвечивает только свободную стену в режиме выбора или удаления', () => {
    expect(
      shouldHighlightWall({ objectDragActive: false, hasOpening: false, tool: 'select', isHovered: true }),
    ).toBe(true)
    expect(
      shouldHighlightWall({ objectDragActive: false, hasOpening: true, tool: 'select', isHovered: true }),
    ).toBe(false)
    expect(
      shouldHighlightWall({ objectDragActive: false, hasOpening: false, tool: 'door', isHovered: true }),
    ).toBe(false)
    expect(
      shouldHighlightWall({ objectDragActive: true, hasOpening: false, tool: 'select', isHovered: true }),
    ).toBe(false)
  })

  it('подсвечивает проём на любом занятом им сегменте', () => {
    expect(
      shouldHighlightOpening({ objectDragActive: false, hasOpening: true, isCoveredSegmentHovered: true }),
    ).toBe(true)
    expect(
      shouldHighlightOpening({ objectDragActive: true, hasOpening: true, isCoveredSegmentHovered: true }),
    ).toBe(false)
    expect(
      shouldHighlightOpening({ objectDragActive: false, hasOpening: false, isCoveredSegmentHovered: true }),
    ).toBe(false)
  })

  it('показывает placeholder двери и окна только на проёме того же вида', () => {
    expect(shouldHighlightStandaloneAperture('window', 'window', false)).toBe(true)
    expect(shouldHighlightStandaloneAperture('window', 'door', false)).toBe(false)
    expect(shouldHighlightStandaloneAperture('door', 'door', false)).toBe(true)
    expect(shouldHighlightStandaloneAperture('door', 'window', false)).toBe(false)
    expect(shouldHighlightStandaloneAperture('select', 'window', false)).toBe(true)
    expect(shouldHighlightStandaloneAperture(null, 'window', false)).toBe(false)
  })

  it('не считает обычный клик перетаскиванием', () => {
    expect(hasPointerDrag({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe(false)
    expect(hasPointerDrag({ x: 10, y: 10 }, { x: 16, y: 10 })).toBe(true)
  })

  it('отключает строительный инструмент только по Escape', () => {
    expect(isBuildToolCancelInput({ key: 'Escape' })).toBe(true)
    expect(isBuildToolCancelInput({ button: 2 })).toBe(false)
    expect(isBuildToolCancelInput({ key: 'Escape', editable: true })).toBe(false)
    expect(isBuildToolCancelInput({ button: 0 })).toBe(false)
  })

  it('не расширяет область выбора за границы рабочей сетки', () => {
    expect(constructionPointerPlaneSize('select', 12, 10)).toEqual([12, 10])
    expect(constructionPointerPlaneSize('erase', 12, 10)).toEqual([12, 10])
    expect(constructionPointerPlaneSize('build-wall', 12, 10)).toEqual([240, 240])
    expect(constructionPointerPlaneSize('door-aperture', 12, 10)).toEqual([240, 240])
  })

  it('перетаскивает проём как часть уже выбранной стены', () => {
    expect(
      shouldDragSelectedWallsFromOpening({
        additive: false,
        wantsWall: false,
        selectionKind: 'walls',
        coveredWallKeys: ['a', 'b'],
        selectedWallKeys: ['b'],
      }),
    ).toBe(true)
    expect(
      shouldDragSelectedWallsFromOpening({
        additive: true,
        wantsWall: false,
        selectionKind: 'walls',
        coveredWallKeys: ['a'],
        selectedWallKeys: ['a'],
      }),
    ).toBe(false)
    expect(
      shouldDragSelectedWallsFromOpening({
        additive: false,
        wantsWall: true,
        selectionKind: 'walls',
        coveredWallKeys: ['a'],
        selectedWallKeys: ['a'],
      }),
    ).toBe(false)
  })

  it('Alt + клик выбирает все сегменты под широким проёмом', () => {
    expect(selectCoveredWallKeys([], ['a', 'b'], false)).toEqual(['a', 'b'])
    expect(selectCoveredWallKeys(['x'], ['a', 'b'], true)).toEqual(['x', 'a', 'b'])
    expect(selectCoveredWallKeys(['x', 'a', 'b'], ['a', 'b'], true)).toEqual(['x'])
  })
})
