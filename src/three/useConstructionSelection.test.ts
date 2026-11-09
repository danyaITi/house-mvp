import {describe,expect,it} from 'vitest'
import {deriveConstructionSelection} from './useConstructionSelection'
import type {ConstructionModel} from '../construction/constructionModel'

const model:ConstructionModel={
  width:3,depth:3,
  cells:[{x:0,y:0,material:'wood'},{x:1,y:0,material:'wood'}],
  walls:[{axis:'h',x:0,y:0,material:'brick'},{axis:'h',x:1,y:0,material:'brick'}],
  apertures:[{id:'door:1',kind:'door',size:'small',axis:'h',x:0,y:0,fixture:{style:'swing',material:'wood'}}],
  stairs:[{cell:{x:0,y:0},shape:'straight'}],
}

describe('construction selection view',()=>{
  it('derives selected objects without duplicating selection rules in the component',()=>{
    expect(deriveConstructionSelection(model,{kind:'walls',wallKeys:['1:h:0:0','1:h:1:0']})).toMatchObject({walls:model.walls,wallMaterial:'brick'})
    expect(deriveConstructionSelection(model,{kind:'cells',cellKeys:['1:0:0','1:1:0']})).toMatchObject({cells:model.cells,cellMaterial:'wood'})
  })

  it('derives fixtures and stairs from their stable identifiers',()=>{
    expect(deriveConstructionSelection(model,{kind:'fixture',id:'door:1'})).toMatchObject({fixtureIds:['door:1'],fixtureKind:'door',fixtureMaterial:'wood'})
    expect(deriveConstructionSelection(model,{kind:'stair',index:0}).stair).toEqual(model.stairs?.[0])
  })

})
