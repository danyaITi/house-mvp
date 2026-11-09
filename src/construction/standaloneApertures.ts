import {cellKey,type ConstructionModel,type StandaloneAperture,type ConstructionWall} from './constructionModel'

export const standaloneApertureKey=(aperture:Pick<StandaloneAperture,'id'>)=>aperture.id

export function standaloneApertureSegments(aperture:StandaloneAperture){
  const count=aperture.size==='large'?2:1
  return Array.from({length:count},(_,offset)=>aperture.axis==='h'
    ?{axis:'h' as const,x:aperture.x+offset,y:aperture.y,level:aperture.level??1}
    :{axis:'v' as const,x:aperture.x,y:aperture.y+offset,level:aperture.level??1})
}

type GridLine={axis:'h'|'v';start:number;end:number;fixed:number;level:number}

function apertureLine(aperture:StandaloneAperture):GridLine{
  const span=aperture.size==='large'?2:1
  return aperture.axis==='h'
    ?{axis:'h',start:aperture.x,end:aperture.x+span,fixed:aperture.y,level:aperture.level??1}
    :{axis:'v',start:aperture.y,end:aperture.y+span,fixed:aperture.x,level:aperture.level??1}
}

function wallLine(wall:ConstructionWall):GridLine{
  return wall.axis==='h'
    ?{axis:'h',start:wall.x,end:wall.x+1,fixed:wall.y,level:wall.level??1}
    :{axis:'v',start:wall.y,end:wall.y+1,fixed:wall.x,level:wall.level??1}
}

function gridLinesConflict(first:GridLine,second:GridLine){
  if(first.level!==second.level)return false
  if(first.axis===second.axis){
    if(first.fixed!==second.fixed)return false
    return Math.min(first.end,second.end)>Math.max(first.start,second.start)
  }
  const horizontal=first.axis==='h'?first:second
  const vertical=first.axis==='v'?first:second
  const intersects=vertical.fixed>=horizontal.start&&vertical.fixed<=horizontal.end&&horizontal.fixed>=vertical.start&&horizontal.fixed<=vertical.end
  if(!intersects)return false
  const horizontalEndpoint=vertical.fixed===horizontal.start||vertical.fixed===horizontal.end
  const verticalEndpoint=horizontal.fixed===vertical.start||horizontal.fixed===vertical.end
  return !(horizontalEndpoint&&verticalEndpoint)
}

export function standaloneApertureFixtureGeometry(aperture:StandaloneAperture){
  const span=aperture.size==='large'?2:1
  const cutHeight=aperture.kind==='door'?2.05:aperture.size==='large'?2.5:.92
  const cutBottom=aperture.kind==='door'?0:aperture.size==='large'?.11:.9
  const clearance=.02
  const framePostWidth=.12
  return {
    span,
    cutHeight,
    cutBottom,
    width:span-framePostWidth*2,
    height:cutHeight-clearance*2,
    bottom:cutBottom+clearance,
    depth:.08,
  }
}

export function wallConflictsWithStandaloneAperture(model:ConstructionModel,wall:ConstructionWall){
  return (model.apertures??[]).some(aperture=>gridLinesConflict(wallLine(wall),apertureLine(aperture)))
}

function segmentSupported(cells:Set<string>,segment:ReturnType<typeof standaloneApertureSegments>[number]){
  const level=segment.level??1
  return segment.axis==='h'
    ?cells.has(`${level}:${segment.x}:${segment.y-1}`)||cells.has(`${level}:${segment.x}:${segment.y}`)
    :cells.has(`${level}:${segment.x-1}:${segment.y}`)||cells.has(`${level}:${segment.x}:${segment.y}`)
}

export function standaloneApertureFits(model:ConstructionModel,aperture:StandaloneAperture,ignoreIds=new Set<string>()){
  const segments=standaloneApertureSegments(aperture)
  const inside=segments.every(segment=>segment.axis==='h'
    ?segment.x>=0&&segment.x<model.width&&segment.y>=0&&segment.y<=model.depth
    :segment.x>=0&&segment.x<=model.width&&segment.y>=0&&segment.y<model.depth)
  if(!inside)return false
  const cells=new Set(model.cells.map(cellKey))
  if(!segments.every(segment=>segmentSupported(cells,segment)))return false
  if(model.walls.some(wall=>gridLinesConflict(wallLine(wall),apertureLine(aperture))))return false
  return !(model.apertures??[]).filter(item=>!ignoreIds.has(item.id)).some(item=>gridLinesConflict(apertureLine(item),apertureLine(aperture)))
}

export function addStandaloneAperture(model:ConstructionModel,aperture:StandaloneAperture){
  return standaloneApertureFits(model,aperture)?{...model,apertures:[...(model.apertures??[]),aperture]}:model
}

export function standaloneApertureAcceptsFixture(aperture:StandaloneAperture,kind:StandaloneAperture['kind'],style:string){
  const requiredSize:StandaloneAperture['size']=kind==='door'?(style==='double'||style==='sliding'?'large':'small'):(style==='panoramic'?'large':'small')
  return aperture.kind===kind&&aperture.size===requiredSize
}

export function installApertureFixture(model:ConstructionModel,id:string,kind:StandaloneAperture['kind'],style:string,material:string){
  const aperture=(model.apertures??[]).find(item=>item.id===id)
  if(!aperture||!standaloneApertureAcceptsFixture(aperture,kind,style))return model
  return {...model,apertures:(model.apertures??[]).map(item=>item.id===id?{...item,fixture:{style,material}}:item)}
}

export function updateStandaloneFixtureMaterial(model:ConstructionModel,ids:string[],material:string){
  const selected=new Set(ids)
  return {...model,apertures:(model.apertures??[]).map(item=>selected.has(item.id)&&item.fixture?{...item,fixture:{...item.fixture,material}}:item)}
}

export function moveStandaloneFixtures(model:ConstructionModel,ids:string[],dx:number,dy:number){
  const selected=new Set(ids),apertures=model.apertures??[],sources=apertures.filter(item=>selected.has(item.id)&&item.fixture)
  if(!sources.length||(!dx&&!dy))return null
  const reserved=new Set<string>()
  const moves=sources.map(source=>{
    const target=apertures.find(item=>!selected.has(item.id)&&!item.fixture&&!reserved.has(item.id)&&item.kind===source.kind&&item.size===source.size&&item.axis===source.axis&&item.x===source.x+dx&&item.y===source.y+dy)
    if(target)reserved.add(target.id)
    return target?{source,target}:null
  })
  if(moves.some(move=>!move))return null
  const sourceIds=new Set(sources.map(item=>item.id)),byTarget=new Map(moves.map(move=>[move!.target.id,move!.source.fixture!]))
  return {...model,apertures:apertures.map(item=>sourceIds.has(item.id)?{...item,fixture:undefined}:byTarget.has(item.id)?{...item,fixture:byTarget.get(item.id)}:item)}
}

export function duplicateStandaloneFixtures(model:ConstructionModel,ids:string[]){
  const sources=(model.apertures??[]).filter(item=>ids.includes(item.id)&&item.fixture)
  if(!sources.length)return null
  const targets=(model.apertures??[]).filter(item=>!item.fixture)
  const used=new Set<string>(),assignments=sources.map(source=>{
    const target=targets.filter(item=>!used.has(item.id)&&item.kind===source.kind&&item.size===source.size).sort((a,b)=>Math.abs(a.x-source.x)+Math.abs(a.y-source.y)-Math.abs(b.x-source.x)-Math.abs(b.y-source.y))[0]
    if(target)used.add(target.id)
    return target?{source,target}:null
  })
  if(assignments.some(item=>!item))return null
  return {...model,apertures:(model.apertures??[]).map(item=>{const assignment=assignments.find(entry=>entry?.target.id===item.id);return assignment?{...item,fixture:{...assignment.source.fixture!}}:item})}
}

export function transformStandaloneApertures(model:ConstructionModel,ids:string[],dx:number,dy:number,quarterTurns:number){
  const selected=new Set(ids),source=(model.apertures??[]).filter(item=>selected.has(item.id))
  if(!source.length)return null
  const minX=Math.min(...source.map(item=>item.x)),minY=Math.min(...source.map(item=>item.y))
  let transformed=source.map(item=>({...item,x:item.x+dx,y:item.y+dy}))
  for(let turn=0;turn<((quarterTurns%4)+4)%4;turn++)transformed=transformed.map(item=>{
    const localX=item.x-(minX+dx),localY=item.y-(minY+dy)
    return {...item,axis:item.axis==='h'?'v' as const:'h' as const,x:minX+dx-localY,y:minY+dy+localX}
  })
  const without={...model,apertures:(model.apertures??[]).filter(item=>!selected.has(item.id))}
  if(!transformed.every(item=>standaloneApertureFits(without,item,new Set(ids))))return null
  return {model:{...model,apertures:[...(without.apertures??[]),...transformed]},apertures:transformed}
}

export function duplicateStandaloneApertures(model:ConstructionModel,ids:string[]){
  const selected=new Set(ids),source=(model.apertures??[]).filter(item=>selected.has(item.id))
  if(!source.length)return null
  const limit=Math.max(model.width,model.depth)
  const offsets:Array<{dx:number;dy:number}>=[]
  for(let distance=1;distance<=limit*2;distance++)for(let dx=-distance;dx<=distance;dx++){
    const dy=distance-Math.abs(dx)
    offsets.push({dx,dy})
    if(dy)offsets.push({dx,dy:-dy})
  }
  offsets.sort((a,b)=>(Math.abs(a.dx)+Math.abs(a.dy))-(Math.abs(b.dx)+Math.abs(b.dy))||(b.dx-a.dx)||(b.dy-a.dy))
  for(const {dx,dy} of offsets){
    let working=model
    const copies:StandaloneAperture[]=[]
    let valid=true
    for(const item of source){
      const copy={...item,id:nextStandaloneApertureId(working,item.kind),x:item.x+dx,y:item.y+dy}
      if(!standaloneApertureFits(working,copy)){valid=false;break}
      copies.push(copy)
      working={...working,apertures:[...(working.apertures??[]),copy]}
    }
    if(valid)return {model:working,apertures:copies}
  }
  return null
}

export function nextStandaloneApertureId(model:ConstructionModel,kind:StandaloneAperture['kind']){
  let index=1,id=''
  const used=new Set((model.apertures??[]).map(item=>item.id))
  do{id=`${kind}-aperture:${index++}`}while(used.has(id))
  return id
}

