import {describe,expect,it} from 'vitest'
import {generateZones,lineWalls,mergeCells,rectangleCells,resizeConstruction,supportedWalls,toggleCell,toggleConstructionWall,wallSupported} from './constructionModel'

describe('free construction model',()=>{
  it('adds and removes foundation cells',()=>{
    const added=toggleCell([],{x:2,y:3})
    expect(added).toEqual([{x:2,y:3}])
    expect(toggleCell(added,{x:2,y:3})).toEqual([])
  })

  it('splits a foundation into rooms using walls',()=>{
    const cells=[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}]
    const walls=[{axis:'v' as const,x:1,y:0},{axis:'v' as const,x:1,y:1}]
    expect(generateZones({width:12,depth:10,cells,walls}).map(zone=>zone.cells)).toEqual([2,2])
  })

  it('toggles one wall without changing the others',()=>{
    const first={axis:'h' as const,x:0,y:1},second={axis:'v' as const,x:2,y:0}
    expect(toggleConstructionWall([first,second],first)).toEqual([second])
  })

  it('draws a rectangular foundation without duplicate cells',()=>{
    const drawn=rectangleCells({x:1,y:1},{x:3,y:2})
    expect(drawn).toHaveLength(6)
    expect(mergeCells([{x:1,y:1}],drawn)).toHaveLength(6)
  })

  it('draws a continuous straight wall',()=>{
    expect(lineWalls({axis:'h',x:2,y:3},{axis:'h',x:5,y:7})).toEqual([
      {axis:'h',x:2,y:3},{axis:'h',x:3,y:3},{axis:'h',x:4,y:3},{axis:'h',x:5,y:3},
    ])
  })

  it('allows walls only beside a foundation cell',()=>{
    const cells=[{x:2,y:2}]
    expect(wallSupported(cells,{axis:'h',x:2,y:2})).toBe(true)
    expect(wallSupported(cells,{axis:'v',x:3,y:2})).toBe(true)
    expect(wallSupported(cells,{axis:'h',x:7,y:7})).toBe(false)
  })

  it('removes unsupported walls after foundation deletion',()=>{
    expect(supportedWalls([],[{axis:'h',x:2,y:2},{axis:'v',x:3,y:2}])).toEqual([])
  })

  it('crops construction when the working area gets smaller',()=>{
    const model={width:12,depth:10,cells:[{x:2,y:2},{x:10,y:8}],walls:[{axis:'h' as const,x:2,y:2},{axis:'h' as const,x:10,y:8}]}
    expect(resizeConstruction(model,8,7)).toEqual({width:8,depth:7,cells:[{x:2,y:2}],walls:[{axis:'h',x:2,y:2}]})
  })

  it('supports a working area up to 225 by 225 one-meter cells',()=>{
    const resized=resizeConstruction({width:12,depth:10,cells:[],walls:[]},225,225)
    expect(resized.width).toBe(225)
    expect(resized.depth).toBe(225)
  })

  it('keeps openings only on walls that remain inside the resized area',()=>{
    const inside={axis:'h' as const,x:2,y:2},outside={axis:'h' as const,x:10,y:8}
    const model={width:12,depth:10,cells:[{x:2,y:2},{x:10,y:8}],walls:[inside,outside],openings:[{kind:'door' as const,wall:inside},{kind:'window' as const,wall:outside}],roof:true}
    expect(resizeConstruction(model,8,7)).toEqual({width:8,depth:7,cells:[{x:2,y:2}],walls:[inside],openings:[{kind:'door',wall:inside}],roof:true})
  })

  it('keeps floors separate when generating rooms',()=>{
    const cells=[{x:1,y:1,level:1 as const},{x:1,y:1,level:2 as const}]
    const zones=generateZones({width:12,depth:10,cells,walls:[]})
    expect(zones.map(zone=>zone.floor)).toEqual([1,2])
    expect(zones).toHaveLength(2)
  })

  it('removes a staircase when its supporting first-floor cell is cropped',()=>{
    const model={width:12,depth:10,cells:[{x:10,y:8,level:1 as const}],walls:[],stairs:[{cell:{x:10,y:8,level:1 as const},shape:'l' as const}]}
    expect(resizeConstruction(model,8,7).stairs).toEqual([])
  })
})
