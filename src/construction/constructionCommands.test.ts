import {describe,expect,it} from 'vitest'
import {addStairWithUpperFloor,applyConstructionCommand,applyConstructionCommands,duplicateConstructionOpening,duplicateConstructionStair,duplicateConstructionWalls,fitConstructionOpening,moveConstructionWalls,rotateConstructionWalls,transformConstructionWalls,updateWallSelection} from './constructionCommands'
import {constructionOpeningSpan,constructionOpeningWalls,type ConstructionModel,type ConstructionWall} from './constructionModel'

const wall:ConstructionWall={axis:'h',x:1,y:1,level:1}
const base=():ConstructionModel=>({width:12,depth:10,cells:[{x:1,y:1,level:1}],walls:[wall]})

describe('construction commands',()=>{
  it('adds and removes floor cells while cleaning unsupported objects',()=>{
    const withObjects:ConstructionModel={...base(),openings:[{kind:'door',wall}],stairs:[{cell:{x:1,y:1,level:1},shape:'straight'}]}
    const removed=applyConstructionCommand(withObjects,{type:'remove-cells',cells:[{x:1,y:1,level:1}]})
    expect(removed.cells).toEqual([])
    expect(removed.walls).toEqual([])
    expect(removed.openings).toEqual([])
    expect(removed.stairs).toEqual([])
  })

  it('removes unsupported door and window apertures with their fixtures when foundation is deleted',()=>{
    const model:ConstructionModel={
      width:4,
      depth:4,
      cells:[{x:1,y:1,level:1},{x:2,y:1,level:1}],
      walls:[],
      apertures:[
        {id:'door-aperture:1',kind:'door',size:'small',axis:'h',x:1,y:1,level:1,fixture:{style:'swing',material:'wood'}},
        {id:'window-aperture:1',kind:'window',size:'small',axis:'h',x:2,y:1,level:1,fixture:{style:'fixed',material:'pvc'}},
      ],
    }
    const removed=applyConstructionCommand(model,{type:'remove-cells',cells:model.cells})
    expect(removed.apertures).toEqual([])
  })

  it('keeps an aperture when an adjacent foundation cell still supports it',()=>{
    const aperture={id:'door-aperture:1',kind:'door' as const,size:'small' as const,axis:'h' as const,x:1,y:1,level:1}
    const model:ConstructionModel={width:4,depth:4,cells:[{x:1,y:0,level:1},{x:1,y:1,level:1}],walls:[],apertures:[aperture]}
    const removed=applyConstructionCommand(model,{type:'remove-cells',cells:[{x:1,y:1,level:1}]})
    expect(removed.apertures).toEqual([aperture])
  })

  it('adds a wall once and removes its opening together with the wall',()=>{
    const added=applyConstructionCommand({...base(),walls:[]},{type:'add-walls',walls:[wall,wall]})
    expect(added.walls).toHaveLength(1)
    const opened=applyConstructionCommand(added,{type:'add-opening',opening:{kind:'door',wall,style:'swing',material:'wood'}})
    const removed=applyConstructionCommand(opened,{type:'remove-walls',walls:[wall]})
    expect(removed.walls).toEqual([])
    expect(removed.openings).toEqual([])
  })

  it('does not build a wall on a standalone door or window aperture segment',()=>{
    const occupied:ConstructionModel={
      width:4,
      depth:4,
      cells:[{x:1,y:1,level:1},{x:2,y:1,level:1}],
      walls:[],
      apertures:[{id:'door-aperture:1',kind:'door',size:'large',axis:'h',x:1,y:1,level:1}],
    }
    const result=applyConstructionCommand(occupied,{type:'add-walls',walls:[
      {axis:'h',x:1,y:1,level:1},
      {axis:'h',x:2,y:1,level:1},
    ]})
    expect(result.walls).toEqual([])
  })

  it('does not place two openings on one wall and updates the existing opening',()=>{
    const door=applyConstructionCommand(base(),{type:'add-opening',opening:{kind:'door',wall,style:'swing',material:'wood'}})
    const duplicate=applyConstructionCommand(door,{type:'add-opening',opening:{kind:'window',wall}})
    expect(duplicate.openings).toHaveLength(1)
    const adjacent:ConstructionWall={...wall,x:2}
    const updated=applyConstructionCommand({...duplicate,walls:[wall,adjacent]},{type:'update-opening',wall,change:{style:'double',material:'metal'}})
    expect(updated.openings?.[0]).toMatchObject({kind:'door',style:'double',material:'metal'})
  })

  it('adds, rotates and removes a staircase without changing its foundation',()=>{
    const stair={cell:{x:1,y:1,level:1 as const},shape:'l' as const,rotation:0 as const}
    const added=applyConstructionCommand(base(),{type:'add-stair',stair})
    const rotated=applyConstructionCommand(added,{type:'update-stair',index:0,change:{rotation:90}})
    const removed=applyConstructionCommand(rotated,{type:'remove-stair',index:0})
    expect(rotated.stairs?.[0].rotation).toBe(90)
    expect(removed.stairs).toEqual([])
    expect(removed.cells).toEqual(base().cells)
  })

  it('creates the second-floor slab when the first staircase is placed',()=>{
    const model:ConstructionModel={width:4,depth:4,cells:[{x:1,y:1,level:1,material:'concrete'},{x:2,y:1,level:1,material:'wood'}],walls:[]}
    const result=addStairWithUpperFloor(model,{cell:{x:1,y:1,level:1},shape:'straight',rotation:0})
    expect(result.stairs).toHaveLength(1)
    expect(result.cells.filter(cell=>cell.level===2)).toEqual([
      {x:1,y:1,level:2,material:'slab'},
      {x:2,y:1,level:2,material:'slab'},
    ])
  })

  it('does not recreate an existing second floor when another staircase is placed',()=>{
    const model:ConstructionModel={width:4,depth:4,cells:[{x:1,y:1,level:1},{x:1,y:1,level:2,material:'wood'}],walls:[]}
    const result=addStairWithUpperFloor(model,{cell:{x:1,y:1,level:1},shape:'l'})
    expect(result.cells.filter(cell=>cell.level===2)).toEqual([{x:1,y:1,level:2,material:'wood'}])
  })

  it('removes an empty automatically created second floor with the final staircase',()=>{
    const model:ConstructionModel={width:4,depth:4,cells:[{x:1,y:1,level:1},{x:2,y:1,level:1}],walls:[]}
    const withStair=addStairWithUpperFloor(model,{cell:{x:1,y:1,level:1},shape:'straight'})
    const result=applyConstructionCommand(withStair,{type:'remove-stair',index:0})
    expect(result.stairs).toEqual([])
    expect(result.cells.filter(cell=>cell.level===2)).toEqual([])
    expect(result.cells.filter(cell=>(cell.level??1)===1)).toEqual(model.cells)
  })

  it('keeps the second floor when an object has already been built on it',()=>{
    const upperWall:ConstructionWall={axis:'h',x:1,y:1,level:2}
    const model:ConstructionModel={width:4,depth:4,cells:[{x:1,y:1,level:1},{x:1,y:1,level:2,material:'slab'}],walls:[upperWall],stairs:[{cell:{x:1,y:1,level:1},shape:'l'}]}
    const result=applyConstructionCommand(model,{type:'remove-stair',index:0})
    expect(result.stairs).toEqual([])
    expect(result.cells).toContainEqual({x:1,y:1,level:2,material:'slab'})
    expect(result.walls).toContainEqual(upperWall)
  })

  it('keeps the second floor while another staircase remains',()=>{
    const model:ConstructionModel={width:4,depth:4,cells:[{x:1,y:1,level:1},{x:2,y:1,level:1},{x:1,y:1,level:2,material:'slab'}],walls:[],stairs:[{cell:{x:1,y:1,level:1},shape:'straight'},{cell:{x:2,y:1,level:1},shape:'l'}]}
    const result=applyConstructionCommand(model,{type:'remove-stair',index:0})
    expect(result.stairs).toHaveLength(1)
    expect(result.cells.some(cell=>cell.level===2)).toBe(true)
  })

  it('creates a third floor when a staircase is placed on the second floor',()=>{
    const model:ConstructionModel={width:3,depth:3,cells:[{x:0,y:0,level:1},{x:0,y:0,level:2,material:'slab'}],walls:[]}
    const result=addStairWithUpperFloor(model,{cell:{x:0,y:0,level:2},shape:'straight'})
    expect(result.stairs?.[0].cell.level).toBe(2)
    expect(result.cells).toContainEqual({x:0,y:0,level:3,material:'slab'})
  })

  it('removes only an empty third floor when its second-floor staircase is deleted',()=>{
    const model:ConstructionModel={width:3,depth:3,cells:[{x:0,y:0,level:1},{x:0,y:0,level:2,material:'slab'},{x:0,y:0,level:3,material:'slab'}],walls:[],stairs:[{cell:{x:0,y:0,level:1},shape:'straight'},{cell:{x:0,y:0,level:2},shape:'l'}]}
    const result=applyConstructionCommand(model,{type:'remove-stair',index:1})
    expect(result.cells.some(cell=>cell.level===2)).toBe(true)
    expect(result.cells.some(cell=>cell.level===3)).toBe(false)
    expect(result.stairs).toHaveLength(1)
  })

  it('keeps the third floor after deleting its staircase when something is built there',()=>{
    const wallOnThird:ConstructionWall={axis:'h',x:0,y:0,level:3}
    const model:ConstructionModel={width:3,depth:3,cells:[{x:0,y:0,level:2},{x:0,y:0,level:3,material:'slab'}],walls:[wallOnThird],stairs:[{cell:{x:0,y:0,level:2},shape:'u'}]}
    const result=applyConstructionCommand(model,{type:'remove-stair',index:0})
    expect(result.cells.some(cell=>cell.level===3)).toBe(true)
    expect(result.walls).toContainEqual(wallOnThird)
  })

  it('applies a multi-step building operation deterministically',()=>{
    const result=applyConstructionCommands({width:12,depth:10,cells:[],walls:[]},[
      {type:'add-cells',cells:[{x:1,y:1,level:1}]},
      {type:'add-walls',walls:[wall]},
      {type:'add-opening',opening:{kind:'window',wall,style:'casement',material:'pvc'}},
      {type:'set-roof',roof:true,roofStyle:'gable',roofMaterial:'metal'},
    ])
    expect(result).toMatchObject({roof:true,roofStyle:'gable',roofMaterial:'metal'})
    expect(result.cells).toHaveLength(1)
    expect(result.walls).toHaveLength(1)
    expect(result.openings).toHaveLength(1)
  })

  it('resizes within the supported 225 meter limit',()=>{
    const resized=applyConstructionCommand(base(),{type:'resize',width:400,depth:225})
    expect(resized.width).toBe(225)
    expect(resized.depth).toBe(225)
  })

  it('replaces, adds and removes walls in a multi-selection',()=>{
    expect(updateWallSelection(['wall-a'],'wall-b',false)).toEqual(['wall-b'])
    expect(updateWallSelection(['wall-a'],'wall-b',true)).toEqual(['wall-a','wall-b'])
    expect(updateWallSelection(['wall-a','wall-b'],'wall-a',true)).toEqual(['wall-b'])
  })

  it('moves selected walls and their openings together',()=>{
    const model:ConstructionModel={width:4,depth:4,cells:[{x:1,y:1},{x:2,y:1}],walls:[wall],openings:[{kind:'door',wall}]}
    const moved=moveConstructionWalls(model,[wall],1,0)
    expect(moved?.walls[0]).toMatchObject({x:2,y:1})
    expect(moved?.openings?.[0].wall).toMatchObject({x:2,y:1})
  })

  it('moves a selected wall group as one object and keeps every opening attached',()=>{
    const first:ConstructionWall={axis:'h',x:0,y:1,level:1}
    const second:ConstructionWall={axis:'v',x:1,y:1,level:1}
    const untouched:ConstructionWall={axis:'h',x:3,y:2,level:1}
    const model:ConstructionModel={
      width:5,
      depth:4,
      cells:[{x:0,y:1},{x:1,y:1},{x:1,y:2},{x:2,y:1},{x:2,y:2},{x:3,y:2}],
      walls:[first,second,untouched],
      openings:[{kind:'window',wall:first},{kind:'door',wall:second},{kind:'window',wall:untouched}],
    }
    const moved=moveConstructionWalls(model,[first,second],1,0)
    expect(moved?.walls).toEqual(expect.arrayContaining([
      expect.objectContaining({axis:'h',x:1,y:1}),
      expect.objectContaining({axis:'v',x:2,y:1}),
      untouched,
    ]))
    expect(moved?.openings).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:'window',wall:expect.objectContaining({axis:'h',x:1,y:1})}),
      expect.objectContaining({kind:'door',wall:expect.objectContaining({axis:'v',x:2,y:1})}),
      expect.objectContaining({kind:'window',wall:untouched}),
    ]))
  })

  it('rejects a group move when one destination segment is occupied',()=>{
    const first:ConstructionWall={axis:'h',x:0,y:1,level:1}
    const second:ConstructionWall={axis:'h',x:1,y:1,level:1}
    const occupied:ConstructionWall={axis:'h',x:2,y:1,level:1}
    const model:ConstructionModel={width:4,depth:3,cells:[{x:0,y:1},{x:1,y:1},{x:2,y:1}],walls:[first,second,occupied]}
    expect(moveConstructionWalls(model,[first,second],1,0)).toBeNull()
  })

  it('rejects moving or rotating a wall onto a standalone aperture',()=>{
    const source:ConstructionWall={axis:'h',x:0,y:1,level:1}
    const model:ConstructionModel={
      width:4,
      depth:4,
      cells:[{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:0,y:2}],
      walls:[source],
      apertures:[{id:'window-aperture:1',kind:'window',size:'small',axis:'h',x:1,y:1,level:1}],
    }
    expect(moveConstructionWalls(model,[source],1,0)).toBeNull()
    const verticalAperture:ConstructionModel={...model,apertures:[{id:'door-aperture:1',kind:'door',size:'small',axis:'v',x:0,y:1,level:1}]}
    expect(rotateConstructionWalls(verticalAperture,[source],1)).toBeNull()
  })

  it('duplicates a wall group with its materials and openings',()=>{
    const first:ConstructionWall={axis:'h',x:0,y:1,level:1,material:'brick'}
    const second:ConstructionWall={axis:'v',x:1,y:1,level:1,material:'timber'}
    const model:ConstructionModel={width:5,depth:4,cells:[{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:1,y:2},{x:2,y:2}],walls:[first,second],openings:[{kind:'window',wall:first,style:'fixed'},{kind:'door',wall:second,material:'wood'}]}
    const duplicated=duplicateConstructionWalls(model,[first,second])
    expect(duplicated?.walls).toHaveLength(2)
    expect(duplicated?.model.walls).toHaveLength(4)
    expect(duplicated?.model.openings).toHaveLength(4)
    expect(duplicated?.model.openings?.slice(2)).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:'window',style:'fixed'}),
      expect.objectContaining({kind:'door',material:'wood'}),
    ]))
  })

  it('does not duplicate walls when no supported free position exists',()=>{
    const enclosed:ConstructionModel={width:1,depth:1,cells:[{x:0,y:0}],walls:[{axis:'h',x:0,y:0},{axis:'h',x:0,y:1},{axis:'v',x:0,y:0},{axis:'v',x:1,y:0}]}
    expect(duplicateConstructionWalls(enclosed,[enclosed.walls[0]])).toBeNull()
  })

  it('rejects moving walls outside supported floor',()=>{
    expect(moveConstructionWalls(base(),[wall],0,3)).toBeNull()
  })

  it('rotates a selected wall by 90 degrees on the grid',()=>{
    const rotated=rotateConstructionWalls(base(),[wall],1)
    expect(rotated?.walls).toContainEqual(expect.objectContaining({axis:'v',x:1,y:1}))
  })

  it('rotates a wide opening together with both wall segments',()=>{
    const second:ConstructionWall={...wall,x:2}
    const model:ConstructionModel={width:5,depth:5,cells:[{x:1,y:1},{x:1,y:2}],walls:[wall,second],openings:[{kind:'door',style:'double',wall,spanDirection:1}]}
    const rotated=rotateConstructionWalls(model,[wall,second],1)
    expect(rotated?.walls).toEqual(expect.arrayContaining([
      expect.objectContaining({axis:'v',x:1,y:1}),
      expect.objectContaining({axis:'v',x:1,y:2}),
    ]))
    expect(rotated?.openings?.[0]).toMatchObject({wall:{axis:'v',x:1,y:1},spanDirection:1})
  })

  it('does not rotate only one segment of a wide opening',()=>{
    const second:ConstructionWall={...wall,x:2}
    const model:ConstructionModel={width:5,depth:5,cells:[{x:1,y:1},{x:1,y:2}],walls:[wall,second],openings:[{kind:'window',style:'panoramic',wall,spanDirection:1}]}
    expect(rotateConstructionWalls(model,[wall],1)).toBeNull()
  })

  it('applies preview translation and rotation only in the returned model',()=>{
    const model:ConstructionModel={width:6,depth:6,cells:[{x:1,y:1},{x:2,y:1},{x:2,y:2}],walls:[wall]}
    const transformed=transformConstructionWalls(model,[wall],1,0,1)
    expect(model.walls).toEqual([wall])
    expect(transformed?.walls).toEqual([expect.objectContaining({axis:'v',x:2,y:1})])
    expect(transformed?.model.walls).toEqual(expect.arrayContaining(transformed!.walls))
  })

  it('moves an opening to another free wall and preserves its properties',()=>{
    const target:ConstructionWall={axis:'v',x:2,y:1,level:1}
    const model:ConstructionModel={...base(),walls:[wall,target],openings:[{kind:'window',wall,style:'fixed',material:'wood'}]}
    const moved=applyConstructionCommand(model,{type:'move-opening',from:wall,to:target})
    expect(moved.openings?.[0]).toMatchObject({kind:'window',wall:target,style:'fixed',material:'wood'})
  })

  it('moves an opening to a perpendicular wall as a complete segment',()=>{
    const target:ConstructionWall={axis:'v',x:2,y:1,level:1}
    const model:ConstructionModel={...base(),walls:[wall,target],openings:[{kind:'window',wall,style:'casement'}]}
    const moved=applyConstructionCommand(model,{type:'move-opening',from:wall,to:target})
    expect(moved.openings?.[0]).toMatchObject({wall:target})
  })

  it('requires two adjacent wall segments for a wide opening',()=>{
    expect(fitConstructionOpening(base(),{kind:'window',wall,style:'panoramic'})).toBeNull()
    const adjacent:ConstructionWall={...wall,x:2}
    const model={...base(),walls:[wall,adjacent]}
    const opening=fitConstructionOpening(model,{kind:'window',wall,style:'panoramic'})
    expect(opening).toMatchObject({spanDirection:1})
    expect(constructionOpeningWalls(opening!)).toEqual([wall,adjacent])
  })

  it('does not place a wide opening across a perpendicular wall junction',()=>{
    const adjacent:ConstructionWall={...wall,x:2}
    const junction:ConstructionWall={axis:'v',x:2,y:1,level:1}
    const model:ConstructionModel={...base(),walls:[wall,adjacent,junction]}
    expect(fitConstructionOpening(model,{kind:'door',wall,style:'sliding',spanDirection:1})).toBeNull()
  })

  it('uses one or two complete segments for the synchronized plan',()=>{
    expect(constructionOpeningSpan({kind:'door',style:'swing'})).toEqual({start:0,end:1})
    expect(constructionOpeningSpan({kind:'door',style:'sliding'})).toEqual({start:0,end:2})
    expect(constructionOpeningSpan({kind:'window',style:'panoramic',spanDirection:-1})).toEqual({start:-1,end:1})
  })

  it('uses the previous adjacent segment when the next one is unavailable',()=>{
    const previous:ConstructionWall={...wall,x:0}
    const occupiedModel:ConstructionModel={...base(),walls:[previous,wall,{...wall,x:2}],openings:[{kind:'door',wall:{...wall,x:2}}]}
    expect(fitConstructionOpening(occupiedModel,{kind:'door',wall,style:'double'})).toMatchObject({spanDirection:-1})
  })

  it('does not move an opening onto an occupied wall',()=>{
    const target:ConstructionWall={axis:'v',x:2,y:1,level:1}
    const model:ConstructionModel={...base(),walls:[wall,target],openings:[{kind:'window',wall},{kind:'door',wall:target}]}
    expect(applyConstructionCommand(model,{type:'move-opening',from:wall,to:target})).toEqual(model)
  })

  it('duplicates an opening onto the nearest free wall on the same floor',()=>{
    const near:ConstructionWall={axis:'h',x:2,y:1,level:1}
    const far:ConstructionWall={axis:'v',x:4,y:3,level:1}
    const model:ConstructionModel={...base(),walls:[wall,far,near],openings:[{kind:'window',wall,style:'fixed',material:'wood'}]}
    const result=duplicateConstructionOpening(model,wall)
    expect(result?.wall).toEqual(near)
    expect(result?.model.openings).toHaveLength(2)
    expect(result?.model.openings?.[1]).toMatchObject({kind:'window',wall:near,style:'fixed',material:'wood'})
  })

  it('does not duplicate an opening when the floor has no free wall',()=>{
    const model:ConstructionModel={...base(),openings:[{kind:'door',wall}]}
    expect(duplicateConstructionOpening(model,wall)).toBeNull()
  })

  it('duplicates a staircase onto the nearest free foundation cell',()=>{
    const model:ConstructionModel={...base(),cells:[{x:1,y:1},{x:2,y:1},{x:3,y:1}],stairs:[{cell:{x:1,y:1,level:1},shape:'l',rotation:90}]}
    const result=duplicateConstructionStair(model,0)
    expect(result?.index).toBe(1)
    expect(result?.model.stairs).toHaveLength(2)
    expect(result?.model.stairs?.[1]).toMatchObject({cell:{x:2,y:1,level:1},shape:'l',rotation:90})
  })

  it('does not duplicate a staircase without a free foundation cell',()=>{
    const model:ConstructionModel={...base(),stairs:[{cell:{x:1,y:1,level:1},shape:'straight'}]}
    expect(duplicateConstructionStair(model,0)).toBeNull()
  })
})
