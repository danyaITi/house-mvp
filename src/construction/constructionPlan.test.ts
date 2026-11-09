import {describe,expect,it} from 'vitest'
import {planApertureFixtureLine,planApertureLine,stairOpeningsAtLevel} from './constructionPlan'
import type {ConstructionModel,StandaloneAperture} from './constructionModel'

const door:StandaloneAperture={id:'door:1',kind:'door',size:'large',axis:'h',x:1,y:2,level:1}
const windowAperture:StandaloneAperture={id:'window:1',kind:'window',size:'small',axis:'v',x:4,y:1,level:1}

describe('2D construction plan rules',()=>{
  it('draws one- and two-segment apertures on their exact grid lines',()=>{
    expect(planApertureLine(door)).toEqual({x1:1,y1:2,x2:3,y2:2})
    expect(planApertureLine(windowAperture)).toEqual({x1:4,y1:1,x2:4,y2:2})
  })

  it('draws a door or window inside its aperture and leaves an empty aperture unfilled',()=>{
    expect(planApertureFixtureLine(door)).toBeNull()
    expect(planApertureFixtureLine({...windowAperture,fixture:{style:'fixed',material:'pvc'}})).toEqual({x1:4,y1:1.06,x2:4,y2:1.94})
  })

  it('shows a stair opening only on the floor directly above its staircase',()=>{
    const model:ConstructionModel={width:3,depth:3,cells:[],walls:[],stairs:[{cell:{x:0,y:0,level:1},shape:'straight'},{cell:{x:1,y:1,level:2},shape:'l'}]}
    expect(stairOpeningsAtLevel(model,1)).toEqual([])
    expect(stairOpeningsAtLevel(model,2).map(item=>item.index)).toEqual([0])
    expect(stairOpeningsAtLevel(model,3).map(item=>item.index)).toEqual([1])
  })
})
