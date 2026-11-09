import {useMemo,useState} from 'react'
import {cellKey,wallKey,type ConstructionModel} from '../construction/constructionModel'

export type BuildSelection=
  |{kind:'stair';index:number}|{kind:'stairs';indexes:number[]}
  |{kind:'aperture';id:string}|{kind:'apertures';ids:string[]}
  |{kind:'fixture';id:string}|{kind:'fixtures';ids:string[]}
  |{kind:'opening';wallKey:string}|{kind:'openings';wallKeys:string[]}
  |{kind:'walls';wallKeys:string[]}|{kind:'cells';cellKeys:string[]}|{kind:'roof'}

export function deriveConstructionSelection(model:ConstructionModel,selection:BuildSelection|null){
  const stairIndexes=selection?.kind==='stairs'?selection.indexes:selection?.kind==='stair'?[selection.index]:[]
  const openingKeys=selection?.kind==='openings'?selection.wallKeys:selection?.kind==='opening'?[selection.wallKey]:[]
  const apertureIds=selection?.kind==='apertures'?selection.ids:selection?.kind==='aperture'?[selection.id]:[]
  const fixtureIds=selection?.kind==='fixtures'?selection.ids:selection?.kind==='fixture'?[selection.id]:[]
  const walls=selection?.kind==='walls'?model.walls.filter(wall=>selection.wallKeys.includes(wallKey(wall))):[]
  const cells=selection?.kind==='cells'?model.cells.filter(cell=>selection.cellKeys.includes(cellKey(cell))):[]
  const apertures=(model.apertures??[]).filter(aperture=>apertureIds.includes(aperture.id))
  const fixtures=(model.apertures??[]).filter(aperture=>fixtureIds.includes(aperture.id)&&aperture.fixture)
  const opening=selection?.kind==='opening'?(model.openings??[]).find(item=>wallKey(item.wall)===selection.wallKey)??null:null
  const stair=selection?.kind==='stair'?(model.stairs??[])[selection.index]??null:null
  return {
    stair,stairIndexes,opening,openingKeys,apertureIds,apertures,fixtureIds,fixtures,walls,cells,
    fixtureKind:fixtures[0]?.kind,
    fixtureMaterial:fixtures.length&&fixtures.every(item=>item.fixture?.material===fixtures[0].fixture?.material)?fixtures[0].fixture?.material??'':'',
    wallMaterial:walls.length&&walls.every(wall=>(wall.material??'aerated')===(walls[0].material??'aerated'))?(walls[0].material??'aerated'):'',
    cellMaterial:cells.length&&cells.every(cell=>(cell.material??'concrete')===(cells[0].material??'concrete'))?(cells[0].material??'concrete'):'',
  }
}

export function useConstructionSelection(model:ConstructionModel){
  const [selection,setSelection]=useState<BuildSelection|null>(null)
  const derived=useMemo(()=>deriveConstructionSelection(model,selection),[model,selection])
  return {selection,setSelection,...derived}
}
