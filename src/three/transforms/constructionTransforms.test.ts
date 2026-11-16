import { describe, expect, it } from 'vitest'
import {
  moveStairCandidate,
  rotateQuarter,
  rotateWallPlacement,
} from '@/three/transforms/constructionTransforms'
import type { ConstructionModel } from '@/construction/model/constructionModel'

describe('construction transforms', () => {
  it('rotates placeholders in quarter turns', () => {
    expect(rotateQuarter(270)).toBe(0)
    expect(rotateQuarter(0, -1)).toBe(270)
    expect(rotateWallPlacement(0)).toBe(90)
  })

  it('validates a stair move without changing the model', () => {
    // Строительная модель, над которой выполняется операция.
    const model: ConstructionModel = {
      width: 3,
      depth: 3,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      walls: [],
      stairs: [
        { cell: { x: 0, y: 0 }, shape: 'straight' },
        { cell: { x: 2, y: 0 }, shape: 'l' },
      ],
    }
    expect(moveStairCandidate(model, 0, 1, 0)).toMatchObject({
      valid: true,
      stair: { cell: { x: 1, y: 0, level: 1 } },
    })
    expect(moveStairCandidate(model, 0, 2, 0)).toEqual({ valid: false, reason: 'occupied' })
    expect(moveStairCandidate(model, 0, 0, 1)).toEqual({ valid: false, reason: 'unsupported' })
    expect(model.stairs?.[0].cell).toEqual({ x: 0, y: 0 })
  })
})
