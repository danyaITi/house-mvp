import {describe,expect,it} from 'vitest'
import {CONSTRUCTION_RULES,constructionRuleSummary,openingSegmentCount} from './constructionRules'

describe('construction occupancy rules',()=>{
  it('задаёт размер базовых строительных объектов',()=>{
    expect(CONSTRUCTION_RULES.foundation.foundationCells).toBe(1)
    expect(CONSTRUCTION_RULES.floor.foundationCells).toBe(1)
    expect(CONSTRUCTION_RULES.wall).toMatchObject({foundationCells:1,wallSegments:1})
    expect(CONSTRUCTION_RULES.stairs.foundationCells).toBe(1)
  })
  it('задаёт ширину всех типов дверей',()=>{
    expect(openingSegmentCount('door','swing')).toBe(1)
    expect(openingSegmentCount('door','double')).toBe(2)
    expect(openingSegmentCount('door','sliding')).toBe(2)
  })
  it('задаёт ширину всех типов окон',()=>{
    expect(openingSegmentCount('window','casement')).toBe(1)
    expect(openingSegmentCount('window','fixed')).toBe(1)
    expect(openingSegmentCount('window','panoramic')).toBe(2)
  })
  it('безопасно применяет размер по умолчанию',()=>{
    expect(openingSegmentCount('door')).toBe(1)
    expect(openingSegmentCount('window','unknown')).toBe(1)
  })
  it('содержит описание каждого правила',()=>{
    expect(constructionRuleSummary()).toHaveLength(11)
    expect(constructionRuleSummary().every(Boolean)).toBe(true)
  })
  it('задаёт ширину пустых дверных и оконных проёмов',()=>{
    expect(openingSegmentCount('door','aperture-small')).toBe(1)
    expect(openingSegmentCount('door','aperture-large')).toBe(2)
    expect(openingSegmentCount('window','aperture-small')).toBe(1)
    expect(openingSegmentCount('window','aperture-large')).toBe(2)
  })
})
