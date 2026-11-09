import {openingSegmentCount} from './constructionRules'

export type ConstructionLevel=number
export type FoundationCell={x:number;y:number;level?:ConstructionLevel;material?:'concrete'|'slab'|'wood'}
export type ConstructionWall={axis:'h'|'v';x:number;y:number;level?:ConstructionLevel;material?:'aerated'|'brick'|'frame'|'timber'}
export type ConstructionOpening={kind:'door'|'window';wall:ConstructionWall;style?:string;material?:string;spanDirection?:-1|1}
export type StandaloneAperture={id:string;kind:'door'|'window';size:'small'|'large';axis:'h'|'v';x:number;y:number;level?:ConstructionLevel;material?:ConstructionWall['material'];fixture?:{style:string;material:string}}
export type StairShape='straight'|'l'|'u'|'spiral'
export type ConstructionStair={cell:FoundationCell;shape:StairShape;rotation?:0|90|180|270}
export type ConstructionModel={width:number;depth:number;cells:FoundationCell[];walls:ConstructionWall[];openings?:ConstructionOpening[];apertures?:StandaloneAperture[];stairs?:ConstructionStair[];roof?:boolean;roofStyle?:'gable'|'hip'|'flat';roofMaterial?:'metal'|'tile'|'soft'}
export type GeneratedZone={id:string;x:number;y:number;w:number;h:number;cells:number;floor:ConstructionLevel}

export const cellKey=(cell:FoundationCell)=>`${cell.level??1}:${cell.x}:${cell.y}`
export const wallKey=(wall:ConstructionWall)=>`${wall.level??1}:${wall.axis}:${wall.x}:${wall.y}`

export function constructionOpeningWidth(opening:Pick<ConstructionOpening,'kind'|'style'>){
  return openingSegmentCount(opening.kind,opening.style)
}

export function constructionOpeningWalls(opening:Pick<ConstructionOpening,'kind'|'style'|'wall'|'spanDirection'>){
  if(constructionOpeningWidth(opening)===1)return [opening.wall]
  const direction=opening.spanDirection??1
  return [opening.wall,opening.wall.axis==='h'?{...opening.wall,x:opening.wall.x+direction}:{...opening.wall,y:opening.wall.y+direction}]
}

export function constructionOpeningSpan(opening:Pick<ConstructionOpening,'kind'|'style'|'spanDirection'>){
  const width=constructionOpeningWidth(opening)
  return opening.spanDirection===-1&&width===2?{start:-1,end:1}:{start:0,end:width}
}

export function toggleCell(cells:FoundationCell[],cell:FoundationCell){
  const key=cellKey(cell)
  return cells.some(item=>cellKey(item)===key)?cells.filter(item=>cellKey(item)!==key):[...cells,cell]
}

export function toggleConstructionWall(walls:ConstructionWall[],wall:ConstructionWall){
  const key=wallKey(wall)
  return walls.some(item=>wallKey(item)===key)?walls.filter(item=>wallKey(item)!==key):[...walls,wall]
}

export function rectangleCells(a:FoundationCell,b:FoundationCell):FoundationCell[]{
  const cells:FoundationCell[]=[]
  for(let y=Math.min(a.y,b.y);y<=Math.max(a.y,b.y);y++)for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++)cells.push({x,y})
  return cells
}

export function mergeCells(cells:FoundationCell[],added:FoundationCell[]){
  return [...new Map([...cells,...added].map(cell=>[cellKey(cell),cell])).values()]
}

export function lineWalls(start:ConstructionWall,end:ConstructionWall):ConstructionWall[]{
  const walls:ConstructionWall[]=[]
  if(start.axis==='h')for(let x=Math.min(start.x,end.x);x<=Math.max(start.x,end.x);x++)walls.push({axis:'h',x,y:start.y,...(start.level?{level:start.level}:{}),...(start.material?{material:start.material}:{})})
  else for(let y=Math.min(start.y,end.y);y<=Math.max(start.y,end.y);y++)walls.push({axis:'v',x:start.x,y,...(start.level?{level:start.level}:{}),...(start.material?{material:start.material}:{})})
  return walls
}

export function mergeWalls(walls:ConstructionWall[],added:ConstructionWall[]){
  return [...new Map([...walls,...added].map(wall=>[wallKey(wall),wall])).values()]
}

export function wallSupported(cells:FoundationCell[],wall:ConstructionWall){
  const keys=new Set(cells.map(cellKey))
  const level=wall.level??1
  return wall.axis==='h'
    ?keys.has(`${level}:${wall.x}:${wall.y-1}`)||keys.has(`${level}:${wall.x}:${wall.y}`)
    :keys.has(`${level}:${wall.x-1}:${wall.y}`)||keys.has(`${level}:${wall.x}:${wall.y}`)
}

export function supportedWalls(cells:FoundationCell[],walls:ConstructionWall[]){
  return walls.filter(wall=>wallSupported(cells,wall))
}

export function wallsInRectangle(walls:ConstructionWall[],a:FoundationCell,b:FoundationCell){
  const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y)
  const level=a.level??1
  return walls.filter(wall=>{
    if((wall.level??1)!==level)return false
    return wall.axis==='h'
      ?wall.x>=minX&&wall.x<=maxX&&wall.y>=minY&&wall.y<=maxY+1
      :wall.x>=minX&&wall.x<=maxX+1&&wall.y>=minY&&wall.y<=maxY
  })
}

export function resizeConstruction(model:ConstructionModel,width:number,depth:number):ConstructionModel{
  const nextWidth=Math.max(6,Math.min(225,Math.round(width))),nextDepth=Math.max(6,Math.min(225,Math.round(depth)))
  const cells=model.cells.filter(cell=>cell.x>=0&&cell.x<nextWidth&&cell.y>=0&&cell.y<nextDepth)
  const walls=supportedWalls(cells,model.walls.filter(wall=>wall.x>=0&&wall.x<=nextWidth&&wall.y>=0&&wall.y<=nextDepth))
  const resized:ConstructionModel={...model,width:nextWidth,depth:nextDepth,cells,walls}
  if(model.openings){const keys=new Set(walls.map(wallKey));resized.openings=model.openings.filter(opening=>constructionOpeningWalls(opening).every(wall=>keys.has(wallKey(wall))))}
  if(model.stairs){const baseKeys=new Set(cells.filter(cell=>(cell.level??1)===1).map(cell=>`${cell.x}:${cell.y}`));resized.stairs=model.stairs.filter(stair=>baseKeys.has(`${stair.cell.x}:${stair.cell.y}`))}
  return resized
}

function separatingWall(a:FoundationCell,b:FoundationCell):ConstructionWall{
  if(a.x!==b.x)return {axis:'v',x:Math.max(a.x,b.x),y:a.y,level:a.level}
  return {axis:'h',x:a.x,y:Math.max(a.y,b.y),level:a.level}
}

export function generateZones(model:ConstructionModel):GeneratedZone[]{
  const remaining=new Map(model.cells.map(cell=>[cellKey(cell),cell]))
  const walls=new Set(model.walls.map(wallKey))
  const zones:GeneratedZone[]=[]
  while(remaining.size){
    const start=remaining.values().next().value as FoundationCell
    const queue=[start],component:FoundationCell[]=[]
    remaining.delete(cellKey(start))
    while(queue.length){
      const cell=queue.shift()!
      component.push(cell)
      for(const next of [{x:cell.x-1,y:cell.y,level:cell.level},{x:cell.x+1,y:cell.y,level:cell.level},{x:cell.x,y:cell.y-1,level:cell.level},{x:cell.x,y:cell.y+1,level:cell.level}]){
        const key=cellKey(next)
        if(!remaining.has(key)||walls.has(wallKey(separatingWall(cell,next))))continue
        remaining.delete(key);queue.push(next)
      }
    }
    const xs=component.map(cell=>cell.x),ys=component.map(cell=>cell.y)
    const x=Math.min(...xs),y=Math.min(...ys)
    const floor=(start.level??1) as ConstructionLevel
    zones.push({id:`built-room-${floor}-${zones.length+1}`,x,y,w:Math.max(...xs)-x+1,h:Math.max(...ys)-y+1,cells:component.length,floor})
  }
  return zones
}
