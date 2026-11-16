import { describe, expect, it } from 'vitest'
import {
  constructionToolGroups,
  constructionToolLabel,
  constructionTools,
} from '@/construction/catalog/constructionCatalog'

describe('construction catalog', () => {
  it('contains every buildable object exactly once', () => {
    expect(constructionTools.map((item) => item.tool)).toEqual([
      'foundation',
      'build-wall',
      'door-aperture',
      'window-aperture',
      'door',
      'window',
      'stairs',
      'roof',
    ])
    expect(new Set(constructionTools.map((item) => item.tool)).size).toBe(constructionTools.length)
  })

  it('keeps catalog groups in the intended order', () => {
    expect(constructionToolGroups).toEqual(['Основа', 'Проёмы', 'Этажи'])
    expect(constructionTools.every((item) => constructionToolGroups.includes(item.group))).toBe(true)
  })

  it('renames the foundation tool to floor above the first level', () => {
    expect(constructionToolLabel('foundation', 1)).toBe('Фундамент')
    expect(constructionToolLabel('foundation', 2)).toBe('Пол')
    expect(constructionToolLabel('window', 2)).toBe('Окно')
  })
})
