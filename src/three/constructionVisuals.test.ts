import {describe,expect,it} from 'vitest'
import {constructionStateColors,constructionVisuals} from './constructionVisuals'

describe('construction visual states',()=>{
  it('uses one hover color for every construction object',()=>{
    expect(constructionStateColors('hovered','#fff')).toMatchObject({color:constructionVisuals.hover,emissive:constructionVisuals.hoverEmissive})
  })

  it('keeps invalid and selected states visually distinct',()=>{
    expect(constructionStateColors('invalid','#fff').color).toBe(constructionVisuals.invalidBorder)
    expect(constructionStateColors('selected','#fff').color).toBe(constructionVisuals.selected)
  })
})
