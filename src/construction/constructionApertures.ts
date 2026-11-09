import {constructionOpeningWalls,constructionOpeningWidth,wallKey,type ConstructionModel,type ConstructionOpening,type ConstructionWall} from './constructionModel'

export type ConstructionAperture={
  kind:'door-aperture'|'window-aperture'
  size:'small'|'large'
  wall:ConstructionWall
  walls:ConstructionWall[]
  spanDirection?:-1|1
}

export function constructionApertureForOpening(opening:ConstructionOpening):ConstructionAperture{
  const large=constructionOpeningWidth(opening)===2
  return {
    kind:opening.kind==='door'?'door-aperture':'window-aperture',
    size:large?'large':'small',
    wall:opening.wall,
    walls:constructionOpeningWalls(opening),
    ...(large?{spanDirection:opening.spanDirection??1}:{}),
  }
}

export function apertureCrossesWallJunction(model:ConstructionModel,aperture:ConstructionAperture){
  if(aperture.size==='small')return false
  const direction=aperture.spanDirection??1
  const level=aperture.wall.level??1
  const junctionWalls=aperture.wall.axis==='h'
    ?[
      {axis:'v' as const,x:aperture.wall.x+(direction===1?1:0),y:aperture.wall.y-1,level},
      {axis:'v' as const,x:aperture.wall.x+(direction===1?1:0),y:aperture.wall.y,level},
    ]
    :[
      {axis:'h' as const,x:aperture.wall.x-1,y:aperture.wall.y+(direction===1?1:0),level},
      {axis:'h' as const,x:aperture.wall.x,y:aperture.wall.y+(direction===1?1:0),level},
    ]
  const wallKeys=new Set(model.walls.map(wallKey))
  return junctionWalls.some(wall=>wallKeys.has(wallKey(wall)))
}

export function apertureFits(model:ConstructionModel,aperture:ConstructionAperture,occupied=new Set<string>()){
  const walls=new Set(model.walls.map(wallKey))
  return aperture.walls.every(wall=>walls.has(wallKey(wall))&&!occupied.has(wallKey(wall)))&&!apertureCrossesWallJunction(model,aperture)
}

export function normalizeConstructionModel(model:ConstructionModel):ConstructionModel{
  const occupied=new Set<string>()
  const openings=(model.openings??[]).filter(opening=>{
    const aperture=constructionApertureForOpening(opening)
    if(!apertureFits(model,aperture,occupied))return false
    aperture.walls.forEach(wall=>occupied.add(wallKey(wall)))
    return true
  })
  return openings.length===(model.openings??[]).length?model:{...model,openings}
}

