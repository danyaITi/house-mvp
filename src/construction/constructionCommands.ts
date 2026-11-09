import {
  mergeCells,
  mergeWalls,
  constructionOpeningWalls,
  constructionOpeningWidth,
  resizeConstruction,
  supportedWalls,
  wallKey,
  wallSupported,
  type ConstructionModel,
  type ConstructionOpening,
  type ConstructionStair,
  type ConstructionWall,
  type FoundationCell,
} from './constructionModel'
import {apertureFits,constructionApertureForOpening} from './constructionApertures'
import {standaloneApertureFits,wallConflictsWithStandaloneAperture} from './standaloneApertures'
import {hasConstructionObjectsAtLevel} from './constructionLevels'

export type ConstructionCommand =
  | {type:'add-cells';cells:FoundationCell[]}
  | {type:'remove-cells';cells:FoundationCell[]}
  | {type:'add-walls';walls:ConstructionWall[]}
  | {type:'remove-walls';walls:ConstructionWall[]}
  | {type:'add-opening';opening:ConstructionOpening}
  | {type:'remove-opening';wall:ConstructionWall}
  | {type:'move-opening';from:ConstructionWall;to:ConstructionWall}
  | {type:'update-opening';wall:ConstructionWall;change:Partial<ConstructionOpening>}
  | {type:'add-stair';stair:ConstructionStair}
  | {type:'remove-stair';index:number}
  | {type:'update-stair';index:number;change:Partial<ConstructionStair>}
  | {type:'set-roof';roof:boolean;roofStyle?:ConstructionModel['roofStyle'];roofMaterial?:ConstructionModel['roofMaterial']}
  | {type:'resize';width:number;depth:number}

const openingKeys=(opening:ConstructionOpening)=>constructionOpeningWalls(opening).map(wallKey)

export function fitConstructionOpening(model:ConstructionModel,opening:ConstructionOpening,ignoreOpening?:ConstructionOpening):ConstructionOpening|null{
  const wallKeys=new Set(model.walls.map(wallKey))
  const occupied=new Set((model.openings??[]).filter(item=>item!==ignoreOpening).flatMap(openingKeys))
  const directions:ReadonlyArray<-1|1>=constructionOpeningWidth(opening)===1?[1]:opening.spanDirection?[opening.spanDirection]:[1,-1]
  for(const spanDirection of directions){
    const candidate={...opening,spanDirection}
    const keys=openingKeys(candidate)
    if(keys.every(key=>wallKeys.has(key)&&!occupied.has(key))&&apertureFits(model,constructionApertureForOpening(candidate),occupied))return constructionOpeningWidth(candidate)===1?{...candidate,spanDirection:undefined}:candidate
  }
  return null
}

export function applyConstructionCommand(model:ConstructionModel,command:ConstructionCommand):ConstructionModel{
  const openings=model.openings??[],stairs=model.stairs??[]
  switch(command.type){
    case 'add-cells':
      return {...model,cells:mergeCells(model.cells,command.cells)}
    case 'remove-cells':{
      const removed=new Set(command.cells.map(cell=>`${cell.level??1}:${cell.x}:${cell.y}`))
      const cells=model.cells.filter(cell=>!removed.has(`${cell.level??1}:${cell.x}:${cell.y}`))
      const walls=supportedWalls(cells,model.walls),wallKeys=new Set(walls.map(wallKey))
      const apertureSupportModel={...model,cells,walls,apertures:[]}
      const apertures=(model.apertures??[]).filter(aperture=>standaloneApertureFits(apertureSupportModel,aperture))
      return {...model,cells,walls,apertures,openings:openings.filter(opening=>openingKeys(opening).every(key=>wallKeys.has(key))),stairs:stairs.filter(stair=>cells.some(cell=>(cell.level??1)===(stair.cell.level??1)&&cell.x===stair.cell.x&&cell.y===stair.cell.y))}
    }
    case 'add-walls':
      return {...model,walls:mergeWalls(model.walls,command.walls.filter(wall=>!wallConflictsWithStandaloneAperture(model,wall)))}
    case 'remove-walls':{
      const removed=new Set(command.walls.map(wallKey))
      return {...model,walls:model.walls.filter(wall=>!removed.has(wallKey(wall))),openings:openings.filter(opening=>openingKeys(opening).every(key=>!removed.has(key)))}
    }
    case 'add-opening':{
      const opening=fitConstructionOpening(model,command.opening)
      return opening?{...model,openings:[...openings,opening]}:model
    }
    case 'remove-opening':
      return {...model,openings:openings.filter(opening=>!openingKeys(opening).includes(wallKey(command.wall)))}
    case 'move-opening':{
      const source=openings.find(opening=>openingKeys(opening).includes(wallKey(command.from)))
      if(!source)return model
      const moved=fitConstructionOpening(model,{...source,wall:command.to,spanDirection:undefined},source)
      return moved?{...model,openings:openings.map(opening=>opening===source?moved:opening)}:model
    }
    case 'update-opening':{
      const source=openings.find(opening=>openingKeys(opening).includes(wallKey(command.wall)))
      if(!source)return model
      const updated=fitConstructionOpening(model,{...source,...command.change,wall:source.wall,spanDirection:command.change.style?undefined:source.spanDirection},source)
      return updated?{...model,openings:openings.map(opening=>opening===source?updated:opening)}:model
    }
    case 'add-stair':
      return stairs.some(stair=>(stair.cell.level??1)===(command.stair.cell.level??1)&&stair.cell.x===command.stair.cell.x&&stair.cell.y===command.stair.cell.y)?model:{...model,stairs:[...stairs,command.stair]}
    case 'remove-stair':{
      const removed=stairs[command.index]
      const nextStairs=stairs.filter((_,index)=>index!==command.index)
      if(!removed)return model
      const upperLevel=(removed.cell.level??1)+1
      const anotherAccess=nextStairs.some(stair=>(stair.cell.level??1)===(removed.cell.level??1))
      if(anotherAccess||hasConstructionObjectsAtLevel(model,upperLevel,nextStairs))return {...model,stairs:nextStairs}
      return {
        ...model,
        stairs:nextStairs,
        cells:model.cells.filter(cell=>(cell.level??1)!==upperLevel),
        walls:model.walls.filter(wall=>(wall.level??1)!==upperLevel),
        openings:openings.filter(opening=>(opening.wall.level??1)!==upperLevel),
        apertures:(model.apertures??[]).filter(aperture=>(aperture.level??1)!==upperLevel),
      }
    }
    case 'update-stair':
      return {...model,stairs:stairs.map((stair,index)=>index===command.index?{...stair,...command.change}:stair)}
    case 'set-roof':
      return {...model,roof:command.roof,...(command.roofStyle?{roofStyle:command.roofStyle}:{}),...(command.roofMaterial?{roofMaterial:command.roofMaterial}:{})}
    case 'resize':
      return resizeConstruction(model,command.width,command.depth)
  }
}

export function applyConstructionCommands(model:ConstructionModel,commands:ConstructionCommand[]){
  return commands.reduce(applyConstructionCommand,model)
}

export function addStairWithUpperFloor(model:ConstructionModel,stair:ConstructionStair):ConstructionModel{
  const withStair=applyConstructionCommand(model,{type:'add-stair',stair})
  const sourceLevel=stair.cell.level??1,upperLevel=sourceLevel+1
  if(withStair===model||withStair.cells.some(cell=>(cell.level??1)===upperLevel))return withStair
  const upperFloor=withStair.cells
    .filter(cell=>(cell.level??1)===sourceLevel)
    .map(cell=>({...cell,level:upperLevel,material:'slab' as const}))
  return applyConstructionCommand(withStair,{type:'add-cells',cells:upperFloor})
}

export function updateWallSelection(current:string[],wallKey:string,additive:boolean){
  if(!additive)return [wallKey]
  return current.includes(wallKey)?current.filter(key=>key!==wallKey):[...current,wallKey]
}

export function duplicateConstructionOpening(model:ConstructionModel,sourceWall:ConstructionWall):{model:ConstructionModel;wall:ConstructionWall}|null{
  const source=(model.openings??[]).find(opening=>openingKeys(opening).includes(wallKey(sourceWall)))
  if(!source)return null
  const occupied=new Set((model.openings??[]).flatMap(openingKeys))
  const center=(wall:ConstructionWall)=>({x:wall.x+(wall.axis==='h'?.5:0),y:wall.y+(wall.axis==='v'?.5:0)})
  const origin=center(source.wall)
  const target=model.walls
    .filter(wall=>(wall.level??1)===(source.wall.level??1)&&!occupied.has(wallKey(wall))&&Boolean(fitConstructionOpening(model,{...source,wall,spanDirection:undefined})))
    .map(wall=>{const point=center(wall);return {wall,score:Math.abs(point.x-origin.x)+Math.abs(point.y-origin.y)+(wall.axis===source.wall.axis?0:.25)}})
    .sort((a,b)=>a.score-b.score||wallKey(a.wall).localeCompare(wallKey(b.wall)))[0]?.wall
  if(!target)return null
  return {model:applyConstructionCommand(model,{type:'add-opening',opening:{...source,wall:target,spanDirection:undefined}}),wall:target}
}

export function duplicateConstructionStair(model:ConstructionModel,sourceIndex:number):{model:ConstructionModel;index:number}|null{
  const stairs=model.stairs??[],source=stairs[sourceIndex]
  if(!source)return null
  const occupied=new Set(stairs.filter(stair=>(stair.cell.level??1)===(source.cell.level??1)).map(stair=>`${stair.cell.x}:${stair.cell.y}`))
  const target=model.cells
    .filter(cell=>(cell.level??1)===(source.cell.level??1)&&!occupied.has(`${cell.x}:${cell.y}`))
    .sort((a,b)=>{
      const distanceA=Math.abs(a.x-source.cell.x)+Math.abs(a.y-source.cell.y)
      const distanceB=Math.abs(b.x-source.cell.x)+Math.abs(b.y-source.cell.y)
      return distanceA-distanceB||a.y-b.y||a.x-b.x
    })[0]
  if(!target)return null
  const stair:ConstructionStair={...source,cell:{x:target.x,y:target.y,level:source.cell.level??1}}
  return {model:applyConstructionCommand(model,{type:'add-stair',stair}),index:stairs.length}
}

export function duplicateConstructionWalls(model:ConstructionModel,walls:ConstructionWall[]):{model:ConstructionModel;walls:ConstructionWall[]}|null{
  if(!walls.length)return null
  const selectedKeys=new Set(walls.map(wallKey))
  const withoutSelection:ConstructionModel={
    ...model,
    walls:model.walls.filter(wall=>!selectedKeys.has(wallKey(wall))),
    openings:(model.openings??[]).filter(opening=>!constructionOpeningWalls(opening).some(wall=>selectedKeys.has(wallKey(wall)))),
  }
  const limit=Math.max(model.width,model.depth)
  const offsets:Array<{dx:number;dy:number}>=[]
  for(let distance=1;distance<=limit*2;distance++){
    for(let dx=-distance;dx<=distance;dx++){
      const dy=distance-Math.abs(dx)
      offsets.push({dx,dy})
      if(dy)offsets.push({dx,dy:-dy})
    }
  }
  offsets.sort((a,b)=>(Math.abs(a.dx)+Math.abs(a.dy))-(Math.abs(b.dx)+Math.abs(b.dy))||(b.dx-a.dx)||(b.dy-a.dy))
  for(const {dx,dy} of offsets){
    if(!moveConstructionWalls(withoutSelection,walls,dx,dy))continue
    const copies=walls.map(wall=>({...wall,x:wall.x+dx,y:wall.y+dy}))
    const copiedBySource=new Map(walls.map((wall,index)=>[wallKey(wall),copies[index]]))
    const copiedOpenings=(model.openings??[]).flatMap(opening=>{
      if(!constructionOpeningWalls(opening).every(wall=>copiedBySource.has(wallKey(wall))))return []
      const copiedWall=copiedBySource.get(wallKey(opening.wall))
      return copiedWall?[{...opening,wall:copiedWall}]:[]
    })
    return {model:{...model,walls:[...model.walls,...copies],openings:[...(model.openings??[]),...copiedOpenings]},walls:copies}
  }
  return null
}

export function moveConstructionWalls(model:ConstructionModel,walls:ConstructionWall[],dx:number,dy:number):ConstructionModel|null{
  if(!walls.length||(!dx&&!dy))return model
  const selectedKeys=new Set(walls.map(wallKey))
  if((model.openings??[]).some(opening=>{const keys=openingKeys(opening),selected=keys.filter(key=>selectedKeys.has(key)).length;return selected>0&&selected<keys.length}))return null
  const moved=walls.map(wall=>({...wall,x:wall.x+dx,y:wall.y+dy}))
  const inside=moved.every(wall=>wall.axis==='h'
    ?wall.x>=0&&wall.x<model.width&&wall.y>=0&&wall.y<=model.depth
    :wall.x>=0&&wall.x<=model.width&&wall.y>=0&&wall.y<model.depth)
  if(!inside||moved.some(wall=>!wallSupported(model.cells,wall)||wallConflictsWithStandaloneAperture(model,wall)))return null
  const stationary=model.walls.filter(wall=>!selectedKeys.has(wallKey(wall)))
  const stationaryKeys=new Set(stationary.map(wallKey))
  if(moved.some(wall=>stationaryKeys.has(wallKey(wall))))return null
  const movedByOldKey=new Map(walls.map((wall,index)=>[wallKey(wall),moved[index]]))
  return {...model,walls:[...stationary,...moved],openings:(model.openings??[]).map(opening=>{
    const nextWall=movedByOldKey.get(wallKey(opening.wall))
    return nextWall?{...opening,wall:nextWall}:opening
  })}
}

export function rotateConstructionWalls(model:ConstructionModel,walls:ConstructionWall[],direction:-1|1):ConstructionModel|null{
  if(!walls.length)return null
  const selectedKeys=new Set(walls.map(wallKey))
  if((model.openings??[]).some(opening=>{const keys=openingKeys(opening),selected=keys.filter(key=>selectedKeys.has(key)).length;return selected>0&&selected<keys.length}))return null
  const endpoints=(wall:ConstructionWall)=>wall.axis==='h'
    ?[{x:wall.x,y:wall.y},{x:wall.x+1,y:wall.y}]
    :[{x:wall.x,y:wall.y},{x:wall.x,y:wall.y+1}]
  const points=walls.flatMap(endpoints),originMinX=Math.min(...points.map(point=>point.x)),originMinY=Math.min(...points.map(point=>point.y))
  const rotatedRaw=walls.map(wall=>endpoints(wall).map(point=>direction===1?{x:-point.y,y:point.x}:{x:point.y,y:-point.x}))
  const rotatedPoints=rotatedRaw.flat(),shiftX=originMinX-Math.min(...rotatedPoints.map(point=>point.x)),shiftY=originMinY-Math.min(...rotatedPoints.map(point=>point.y))
  const rotated=rotatedRaw.map((pair,index)=>{
    const [first,second]=pair.map(point=>({x:point.x+shiftX,y:point.y+shiftY}))
    return first.y===second.y
      ?{...walls[index],axis:'h' as const,x:Math.min(first.x,second.x),y:first.y}
      :{...walls[index],axis:'v' as const,x:first.x,y:Math.min(first.y,second.y)}
  })
  const inside=rotated.every(wall=>wall.axis==='h'
    ?wall.x>=0&&wall.x<model.width&&wall.y>=0&&wall.y<=model.depth
    :wall.x>=0&&wall.x<=model.width&&wall.y>=0&&wall.y<model.depth)
  if(!inside||rotated.some(wall=>!wallSupported(model.cells,wall)||wallConflictsWithStandaloneAperture(model,wall)))return null
  const stationary=model.walls.filter(wall=>!selectedKeys.has(wallKey(wall))),stationaryKeys=new Set(stationary.map(wallKey))
  if(rotated.some(wall=>stationaryKeys.has(wallKey(wall)))||new Set(rotated.map(wallKey)).size!==rotated.length)return null
  const rotatedByOldKey=new Map(walls.map((wall,index)=>[wallKey(wall),rotated[index]]))
  const openings=(model.openings??[]).map(opening=>{
    const nextWall=rotatedByOldKey.get(wallKey(opening.wall))
    if(!nextWall)return opening
    if(constructionOpeningWidth(opening)===1)return {...opening,wall:nextWall,spanDirection:undefined}
    const companion=constructionOpeningWalls(opening)[1],nextCompanion=rotatedByOldKey.get(wallKey(companion))
    if(!nextCompanion)return opening
    const spanDirection=(nextWall.axis==='h'?nextCompanion.x-nextWall.x:nextCompanion.y-nextWall.y) as -1|1
    return {...opening,wall:nextWall,spanDirection}
  })
  return {...model,walls:[...stationary,...rotated],openings}
}

export function transformConstructionWalls(model:ConstructionModel,walls:ConstructionWall[],dx:number,dy:number,quarterTurns:number):{model:ConstructionModel;walls:ConstructionWall[]}|null{
  let next=moveConstructionWalls(model,walls,dx,dy)
  if(!next)return null
  let transformed=walls.map(wall=>({...wall,x:wall.x+dx,y:wall.y+dy}))
  const turns=((quarterTurns%4)+4)%4
  for(let turn=0;turn<turns;turn++){
    const rotated=rotateConstructionWalls(next,transformed,1)
    if(!rotated)return null
    const previousKeys=new Set(next.walls.filter(wall=>!transformed.some(item=>wallKey(item)===wallKey(wall))).map(wallKey))
    transformed=rotated.walls.filter(wall=>!previousKeys.has(wallKey(wall)))
    next=rotated
  }
  return {model:next,walls:transformed}
}
