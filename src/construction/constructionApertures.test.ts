import {describe,expect,it} from 'vitest'
import {apertureFits,constructionApertureForOpening,normalizeConstructionModel} from './constructionApertures'
import type {ConstructionModel,ConstructionWall} from './constructionModel'

const first:ConstructionWall={axis:'h',x:1,y:1,level:1}
const second:ConstructionWall={axis:'h',x:2,y:1,level:1}
const base=(walls=[first,second]):ConstructionModel=>({width:5,depth:5,cells:[{x:1,y:1},{x:2,y:1}],walls})

describe('construction apertures',()=>{
  it('creates separate small door and window apertures',()=>{
    expect(constructionApertureForOpening({kind:'door',wall:first,style:'swing'})).toMatchObject({kind:'door-aperture',size:'small',walls:[first]})
    expect(constructionApertureForOpening({kind:'window',wall:first,style:'fixed'})).toMatchObject({kind:'window-aperture',size:'small',walls:[first]})
  })

  it('creates large apertures across two collinear segments',()=>{
    expect(constructionApertureForOpening({kind:'door',wall:first,style:'sliding',spanDirection:1})).toMatchObject({kind:'door-aperture',size:'large',walls:[first,second]})
    expect(constructionApertureForOpening({kind:'window',wall:first,style:'panoramic',spanDirection:1})).toMatchObject({kind:'window-aperture',size:'large',walls:[first,second]})
  })

  it('rejects a large aperture split by a perpendicular wall',()=>{
    const junction:ConstructionWall={axis:'v',x:2,y:1,level:1}
    const model=base([first,second,junction])
    expect(apertureFits(model,constructionApertureForOpening({kind:'door',wall:first,style:'double',spanDirection:1}))).toBe(false)
  })

  it('removes a legacy invalid opening during model migration',()=>{
    const junction:ConstructionWall={axis:'v',x:2,y:1,level:1}
    const model={...base([first,second,junction]),openings:[{kind:'window' as const,wall:first,style:'panoramic',spanDirection:1 as const}]}
    expect(normalizeConstructionModel(model).openings).toEqual([])
  })
})

