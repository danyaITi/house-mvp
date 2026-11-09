import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { addDoor, defaultDoorConfig, hasOpenWall, removeDoor, setWallOpen, updateDoor, type DoorConfig, type DoorInstance, type DoorKind } from './openings/openingModel'
import { cellKey, constructionOpeningSpan, constructionOpeningWidth, generateZones, wallKey, type ConstructionModel } from './construction/constructionModel'
import { historyShortcut } from './history/historyShortcuts'
import {normalizeConstructionModel} from './construction/constructionApertures'
import {planApertureFixtureLine,planApertureLine,stairOpeningsAtLevel} from './construction/constructionPlan'
import './styles.css'

const loadHouse3D=()=>import('./three/House3D').then(module=>({default:module.House3D}))
const House3D=lazy(loadHouse3D)

type Wall = 'aerated' | 'brick' | 'frame' | 'timber' | 'log'
type Roof = 'gable' | 'hip' | 'flat'
type RoomRelation = { a:string; b:string; type:'near'|'away'|'access' }
type RoomPair = { a:string; b:string }
type WindowKind = 'casement'|'fixed'|'panoramic'
type WallSide = 'top'|'bottom'|'left'|'right'
type WindowConfig = { offset:number; width:number; kind:WindowKind; wall?:WallSide }
type AddedRoom = { id:string; name:string; weight:number; floor:1|2; kind:'service'|'extra'|'bedroom' }
type CustomPlan = {rooms:AddedRoom[];layouts:Record<string,RoomPosition>}

type HouseSpec = {
  area: number
  floors: 1 | 2
  bedrooms: number
  wall: Wall
  roof: Roof
  region: string
  wishes: string[]
  roomWindows: Record<string,number>
  roomDoors: Record<string,number>
  roomAreas: Record<string,number>
  roomRelations: RoomRelation[]
  blockedPassages: RoomPair[]
  openWalls: RoomPair[]
  doorConfigs: Record<string,DoorConfig>
  doorInstances: DoorInstance[]
  windowConfigs: Record<string,WindowConfig>
  entranceRoom: string | null
  roomFloors: Record<string,1|2>
  roomLayouts: Record<string,RoomPosition>
  removedRooms: string[]
  addedRooms: AddedRoom[]
  construction: ConstructionModel
  customPlan: CustomPlan | null
}

type Estimate = {
  area: number
  width: number
  length: number
  wallArea: number
  roofArea: number
  foundation: number
  low: number
  high: number
  rooms: number
  openings: number
  costs: Record<'foundation'|'walls'|'roof'|'openings'|'stairs'|'floors'|'engineering',number>
}

type RoomKind = 'living' | 'bedroom' | 'service' | 'circulation' | 'extra'
type PlannedRoom = { id: string; name: string; area: number; floor: 1 | 2; kind: RoomKind }
type CostItem = { id:string; name:string; quantity:number; unit:string; materials:number; labor:number }
type RoomPosition = { x:number; y:number; w:number; h:number }

const DEFAULT_SPEC: HouseSpec = {
  area: 120,
  floors: 1,
  bedrooms: 3,
  wall: 'aerated',
  roof: 'gable',
  region: 'Московская область',
  wishes: [],
  roomWindows: {},
  roomDoors: {},
  roomAreas: {},
  roomRelations: [],
  blockedPassages: [],
  openWalls: [],
  doorConfigs: {},
  doorInstances: [],
  windowConfigs: {},
  entranceRoom: null,
  roomFloors: {},
  roomLayouts: {},
  removedRooms: [],
  addedRooms: [],
  construction: {width:12,depth:10,cells:[],walls:[]},
  customPlan: null,
}

const wallNames: Record<Wall, string> = {
  aerated: 'Газобетон',
  brick: 'Керамический блок',
  frame: 'Каркасная технология',
  timber: 'Клеёный или профилированный брус',
  log: 'Оцилиндрованное бревно',
}

const roofNames: Record<Roof, string> = {
  gable: 'Двускатная',
  hip: 'Вальмовая',
  flat: 'Плоская',
}

const rates: Record<Wall, number> = { aerated: 77000, brick: 92000, frame: 68000, timber: 84000, log: 88000 }

function estimate(spec: HouseSpec): Estimate {
  if(spec.construction){
    const model=spec.construction,cells=model.cells,walls=model.walls,openings=model.openings??[]
    const area=cells.length,baseCells=cells.filter(cell=>(cell.level??1)===1),footprint=baseCells.length
    const xs=baseCells.map(cell=>cell.x),ys=baseCells.map(cell=>cell.y)
    const width=xs.length?Math.max(...xs)-Math.min(...xs)+1:0,length=ys.length?Math.max(...ys)-Math.min(...ys)+1:0
    const openingArea=openings.reduce((sum,opening)=>sum+constructionOpeningWidth(opening)*(opening.kind==='door'?2.05:opening.style==='panoramic'?1.5:.92),0)
    const grossWallArea=walls.length*2.7,wallArea=Math.max(0,grossWallArea-openingArea)
    const highestCells=cells.filter(cell=>(cell.level??1)===(cells.some(item=>(item.level??1)===2)?2:1)).length
    const roofFactor=model.roofStyle==='flat'?1.05:model.roofStyle==='hip'?1.28:1.2
    const roofArea=model.roof?highestCells*roofFactor:0,foundation=footprint*.28
    const wallUnit={aerated:12000,brick:18000,frame:10500,timber:16500} as const
    const wallGrossCost=walls.reduce((sum,wall)=>sum+2.7*wallUnit[wall.material??'aerated'],0)
    const wallCost=grossWallArea?wallGrossCost*(wallArea/grossWallArea):0
    const roofRate=model.roofStyle==='flat'?13000:model.roofStyle==='hip'?16500:14500
    const openingCost=openings.reduce((sum,opening)=>sum+(opening.kind==='door'?(opening.style==='double'?110000:opening.style==='sliding'?95000:65000):(opening.style==='panoramic'?155000:80000)),0)
    const stairCost=(model.stairs??[]).reduce((sum,stair)=>sum+(stair.shape==='spiral'?420000:stair.shape==='u'?360000:stair.shape==='l'?310000:250000),0)
    const costs={foundation:foundation*11500,walls:wallCost,roof:roofArea*roofRate,openings:openingCost,stairs:stairCost,floors:area*12000,engineering:area*18000}
    const base=Object.values(costs).reduce((sum,value)=>sum+value,0)
    return {area,width,length,wallArea,roofArea,foundation,low:base*.92,high:base*1.14,rooms:generateZones(model).length,openings:openings.length,costs}
  }
  const floorArea = spec.area / spec.floors
  const width = Math.sqrt(floorArea * 1.25)
  const length = floorArea / width
  const perimeter = 2 * (width + length)
  const grossWallArea = perimeter * 2.9 * spec.floors
  const windowArea=generateRoomPlan(spec).filter(room=>room.kind!=='circulation').reduce((sum,room)=>{const count=spec.roomWindows[room.id]??1;return sum+Array.from({length:count},(_,index)=>(spec.windowConfigs[`window:${room.id}:${index}`]?.width??1.4)*(spec.windowConfigs[`window:${room.id}:${index}`]?.kind==='panoramic'?2.1:1.35)).reduce((a,b)=>a+b,0)},0)
  const entranceArea=spec.entranceRoom?(spec.doorConfigs[`entrance:${spec.entranceRoom}`]?.width??1)*2.1:0
  const wallArea = Math.max(grossWallArea*.68,grossWallArea-windowArea-entranceArea)
  const roofFactor = spec.roof === 'flat' ? 1.05 : spec.roof === 'hip' ? 1.28 : 1.2
  const roofArea = floorArea * roofFactor
  const foundation = floorArea * 0.28
  const roofRate = spec.roof === 'flat' ? 13000 : spec.roof === 'hip' ? 16500 : 14500
  const base = spec.area * rates[spec.wall] + roofArea * roofRate + foundation * 11500
  const costs={foundation:base*.12,walls:base*.25,roof:base*.14,openings:base*.10,stairs:0,floors:base*.17,engineering:base*.22}
  return {
    area:spec.area,
    width,
    length,
    wallArea,
    roofArea,
    foundation,
    low: base * 0.92,
    high: base * 1.14,
    rooms: spec.bedrooms + 3,
    openings:Math.ceil(spec.area*.16)+(spec.entranceRoom?2:0),
    costs,
  }
}

function buildCostItems(spec:HouseSpec,data:Estimate):CostItem[]{
  const round=(value:number)=>Math.round(value/1000)*1000
  const built=spec.construction.cells.length>0
  const wallMaterials=[...new Set(spec.construction.walls.map(wall=>wall.material??'aerated'))].map(material=>wallNames[material as Wall]).join(', ')
  const definitions:[string,string,number,string,number,number][]=[
    ['foundation','Фундамент',data.foundation,'м³',.12,.62],
    ['walls',`Стены · ${built?(wallMaterials||'не построены'):wallNames[spec.wall]}`,data.wallArea,'м²',.25,.58],
    ['roof',built?(spec.construction.roof?'Кровля':'Кровля не добавлена'):`Кровля · ${roofNames[spec.roof]}`,data.roofArea,'м²',.14,.61],
    ['openings','Окна и двери',data.openings,'шт.',.10,.72],
    ['stairs','Лестницы',(spec.construction.stairs??[]).length,'шт.',0,.58],
    ['floors','Перекрытия и черновые полы',data.area,'м²',.17,.55],
    ['engineering','Черновые инженерные сети',data.area,'м²',.22,.48],
  ]
  return definitions.map(([id,name,quantity,unit,share,materialShare])=>{
    const total=round(built?data.costs[id as keyof Estimate['costs']]:data.low/.92*share)
    const materials=round(total*materialShare)
    return {id,name,quantity,unit,materials,labor:total-materials}
  })
}

function generateRoomPlan(spec: HouseSpec): PlannedRoom[] {
  if(spec.customPlan?.rooms.length)return [...spec.customPlan.rooms,...spec.addedRooms.filter(room=>!spec.customPlan!.rooms.some(item=>item.id===room.id))].filter(room=>!spec.removedRooms.includes(room.id)).map(room=>({id:room.id,name:room.name,area:room.weight,floor:Math.min(spec.floors,spec.roomFloors[room.id]??room.floor) as 1|2,kind:room.kind}))
  const rooms: (Omit<PlannedRoom,'area'> & {weight:number})[] = []
  const add=(id:string,name:string,weight:number,floor:1|2,kind:RoomKind)=>rooms.push({id,name,weight,floor,kind})
  add('living','Кухня-гостиная',34,1,'living')
  for(let index=0;index<spec.bedrooms;index++){
    const floor:1|2=spec.floors===2&&(spec.bedrooms<4||index>0)?2:1
    add(`bedroom-${index+1}`,index===0?'Главная спальня':`Спальня ${index+1}`,index===0?16:13,floor,'bedroom')
  }
  add('bathroom-1','Санузел',6,1,'service')
  if(spec.floors===2||spec.area>=150) add('bathroom-2','Ванная',7,spec.floors===2?2:1,'service')
  add('utility','Техническое помещение',6,1,'service')
  const extras:[string,string,number,1|2][]=[
    ['Кабинет','Кабинет',11,1],['Гараж','Гараж',22,1],['Терраса','Терраса',16,1],
    ['Сауна или баня','Сауна',9,1],['Балкон','Балкон',6,spec.floors===2?2:1],
  ]
  for(const [wish,name,weight,floor] of extras) if(spec.wishes.includes(wish)) add(`extra-${wish}`,name,weight,floor,'extra')
  for(const room of spec.addedRooms) if(room.floor<=spec.floors)add(room.id,room.name,room.weight,room.floor,room.kind)
  const activeRooms=rooms.filter(room=>!spec.removedRooms.includes(room.id)).map(room=>({...room,floor:Math.min(spec.floors,spec.roomFloors[room.id]??room.floor) as 1|2}))
  const targetRoomsArea=spec.area*.86
  const scale=targetRoomsArea/activeRooms.reduce((sum,room)=>sum+room.weight,0)
  const planned:PlannedRoom[]=activeRooms.map(room=>({...room,area:Math.round(room.weight*scale*2)/2}))
  const used=planned.reduce((sum,room)=>sum+room.area,0)
  const circulation=Math.max(5,Math.round((spec.area-used)*2)/2)
  if(spec.floors===1) planned.push({id:'hall-1',name:'Холл и проходы',area:circulation,floor:1,kind:'circulation'})
  else {
    const first=Math.round(circulation*.55*2)/2
    planned.push({id:'hall-1',name:'Холл 1 этажа',area:first,floor:1,kind:'circulation'})
    planned.push({id:'hall-2',name:'Холл 2 этажа',area:Math.max(3,circulation-first),floor:2,kind:'circulation'})
  }
  return planned
}

function applyRoomOverrides(base:PlannedRoom[],overrides:Record<string,number>,_totalArea:number){
  const adjusted=base.map(room=>room.kind==='circulation'?{...room}:{...room,area:overrides[room.id]??room.area})
  return adjusted.map(room=>{
    if(room.kind!=='circulation') return room
    const baseRoomsArea=base.filter(item=>item.floor===room.floor&&item.kind!=='circulation').reduce((sum,item)=>sum+item.area,0)
    const adjustedRoomsArea=adjusted.filter(item=>item.floor===room.floor&&item.kind!=='circulation').reduce((sum,item)=>sum+item.area,0)
    return {...room,area:Math.max(3,Math.round((room.area-(adjustedRoomsArea-baseRoomsArea))*2)/2)}
  })
}

function buildCoordinateLayout(rooms:PlannedRoom[]){
  const positions:Record<string,RoomPosition>={}
  for(const floor of [1,2] as const){
    const floorRooms=rooms.filter(item=>item.floor===floor)
    const floorArea=floorRooms.reduce((sum,room)=>sum+room.area,0)
    const rows:PlannedRoom[][]=[[]]
    let rowWeight=0
    for(const room of floorRooms){
      const weight=Math.max(2.2,Math.sqrt(room.area/floorArea*120*1.35))
      if(rowWeight+weight>12&&rows.at(-1)!.length){rows.push([]);rowWeight=0}
      rows.at(-1)!.push(room)
      rowWeight+=weight
    }
    let y=0
    for(const row of rows){
      const rowArea=row.reduce((sum,room)=>sum+room.area,0)
      const h=10*rowArea/floorArea
      let x=0
      for(const room of row){
        const w=12*room.area/rowArea
        positions[room.id]={x,y,w,h}
        x+=w
      }
      y+=h
    }
  }
  return positions
}

function rectanglesOverlap(a:RoomPosition,b:RoomPosition){
  return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y
}

function roomsShareWall(a:RoomPosition,b:RoomPosition){
  const tolerance=.02
  const vertical=(Math.abs(a.x+a.w-b.x)<tolerance||Math.abs(b.x+b.w-a.x)<tolerance)&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.55
  const horizontal=(Math.abs(a.y+a.h-b.y)<tolerance||Math.abs(b.y+b.h-a.y)<tolerance)&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.55
  return vertical||horizontal
}

const samePair=(pair:RoomPair,a:string,b:string)=>(pair.a===a&&pair.b===b)||(pair.a===b&&pair.b===a)
const doorKey=(a:string,b:string)=>[a,b].sort().join('::')
const exteriorSides=(position:RoomPosition):WallSide[]=>[
  ...(Math.abs(position.y)<.02?['top' as const]:[]),
  ...(Math.abs(position.x)<.02?['left' as const]:[]),
  ...(Math.abs(position.x+position.w-12)<.02?['right' as const]:[]),
  ...(Math.abs(position.y+position.h-10)<.02?['bottom' as const]:[]),
]
const defaultExteriorSide=(position:RoomPosition):WallSide=>exteriorSides(position)[0]??'top'

function relationScore(rooms:PlannedRoom[],relations:RoomRelation[]){
  const positions=buildCoordinateLayout(rooms)
  const byId=new Map(rooms.map(room=>[room.id,room]))
  return relations.reduce((score,relation)=>{
    const a=byId.get(relation.a),b=byId.get(relation.b)
    if(!a||!b)return score
    if(a.floor!==b.floor)return score+(relation.type==='away'?0:100)
    const pa=positions[a.id],pb=positions[b.id],shared=roomsShareWall(pa,pb)
    const distance=Math.hypot(pa.x+pa.w/2-pb.x-pb.w/2,pa.y+pa.h/2-pb.y-pb.h/2)
    return score+(relation.type==='away'?(shared?30:1/Math.max(1,distance)):(shared?0:10+distance))
  },0)
}

function arrangeRoomsByRelations(source:PlannedRoom[],relations:RoomRelation[]){
  let rooms=[...source]
  if(!relations.length)return rooms
  for(let pass=0;pass<4;pass++){
    let best=relationScore(rooms,relations),bestRooms=rooms
    for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
      if(rooms[i].floor!==rooms[j].floor)continue
      const candidate=[...rooms];[candidate[i],candidate[j]]=[candidate[j],candidate[i]]
      const score=relationScore(candidate,relations)
      if(score<best-.001){best=score;bestRooms=candidate}
    }
    if(bestRooms===rooms)break
    rooms=bestRooms
  }
  return rooms
}

const money = (value: number) => new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
}).format(value)

function Icon({ name }: { name: 'home' | 'rotate' | 'undo' | 'redo' | 'reset' | 'info' | 'arrow' }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/></>,
    rotate: <><path d="M20 7v5h-5"/><path d="M18.5 16a7 7 0 1 1 .8-7.7L20 12"/></>,
    undo: <><path d="m9 7-5 5 5 5"/><path d="M20 17a7 7 0 0 0-7-7H4"/></>,
    redo: <><path d="m15 7 5 5-5 5"/><path d="M4 17a7 7 0 0 1 7-7h9"/></>,
    reset: <><path d="M4 4v6h6"/><path d="M5.6 15a7 7 0 1 0 .7-7.8L4 10"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function HouseCanvas({spec}:{spec:HouseSpec}){
  const rooms=useMemo(()=>applyRoomOverrides(generateRoomPlan(spec),spec.roomAreas,spec.area),[spec])
  const positions=useMemo(()=>buildCoordinateLayout(rooms),[rooms])
  const merged=useMemo(()=>Object.fromEntries(Object.entries(positions).map(([id,p])=>[id,{...p,...spec.customPlan?.layouts[id],...spec.roomLayouts[id]}])),[positions,spec.customPlan,spec.roomLayouts])
  return <Suspense fallback={<div className="three-loading" role="status">Строим 3D-модель…</div>}><House3D spec={spec} rooms={rooms} positions={merged}/></Suspense>
}

function ConstructionPlan({model}:{model:ConstructionModel}){
  const levels=[...new Set([
    ...model.cells.map(cell=>cell.level??1),
    ...model.walls.map(wall=>wall.level??1),
    ...(model.apertures??[]).map(aperture=>aperture.level??1),
    ...(model.stairs??[]).map(stair=>stair.cell.level??1),
  ])].sort((a,b)=>a-b)
  const [level,setLevel]=useState(levels[0]??1)
  useEffect(()=>{if(!levels.includes(level))setLevel(levels[0]??1)},[levels.join(':'),level])
  const cells=model.cells.filter(cell=>(cell.level??1)===level)
  const walls=model.walls.filter(wall=>(wall.level??1)===level)
  const openings=(model.openings??[]).filter(opening=>(opening.wall.level??1)===level)
  const apertures=(model.apertures??[]).filter(aperture=>(aperture.level??1)===level)
  const levelStairs=(model.stairs??[]).map((stair,index)=>({stair,index})).filter(({stair})=>(stair.cell.level??1)===level)
  const stairOpenings=stairOpeningsAtLevel(model,level)

  return <section className="construction-plan is-display-only" aria-label="План построенного дома">
    <header><div><h3>План дома</h3><p>План синхронизирован с 3D-моделью.</p></div><div className="construction-plan-header-actions"><strong>{cells.length} м²</strong></div></header>
    {levels.length>1&&<div className="construction-plan-levels" role="group" aria-label="Этаж плана">{levels.map(item=><button type="button" key={item} aria-pressed={level===item} onClick={()=>setLevel(item)}>{item} этаж</button>)}</div>}
    <svg viewBox={`0 0 ${model.width} ${model.depth}`} role="img" aria-label={`План ${level} этажа`} preserveAspectRatio="xMidYMid meet">
      <rect width={model.width} height={model.depth} className="construction-plan-ground"/>
      {cells.map(cell=><rect key={cellKey(cell)} x={cell.x+.04} y={cell.y+.04} width=".92" height=".92" className={`construction-plan-cell material-${cell.material??'concrete'}`}/>)}
      {walls.map(wall=>{const key=wallKey(wall),x2=wall.axis==='h'?wall.x+1:wall.x,y2=wall.axis==='h'?wall.y:wall.y+1;return <line key={key} x1={wall.x} y1={wall.y} x2={x2} y2={y2} className={`construction-plan-wall material-${wall.material??'aerated'}`}/>} )}
      {openings.map(opening=>{const span=constructionOpeningSpan(opening),key=wallKey(opening.wall),x1=opening.wall.axis==='h'?opening.wall.x+span.start:opening.wall.x,y1=opening.wall.axis==='h'?opening.wall.y:opening.wall.y+span.start,x2=opening.wall.axis==='h'?opening.wall.x+span.end:opening.wall.x,y2=opening.wall.axis==='h'?opening.wall.y:opening.wall.y+span.end;return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} className={`construction-plan-opening is-${opening.kind}`}/>} )}
      {apertures.map(aperture=>{const {x1,y1,x2,y2}=planApertureLine(aperture),fixture=planApertureFixtureLine(aperture);return <g key={aperture.id} className={`construction-plan-standalone-aperture is-${aperture.kind}`}><line x1={x1} y1={y1} x2={x2} y2={y2} className="construction-plan-aperture-frame"/>{fixture&&<line {...fixture} className="construction-plan-fixture-line"/>}</g>})}
      {stairOpenings.map(({stair,index})=><g key={`stair-opening:${index}`} className="construction-plan-stair-opening" transform={`rotate(${stair.rotation??0} ${stair.cell.x+.5} ${stair.cell.y+.5})`}><rect x={stair.cell.x+.12} y={stair.cell.y+.12} width=".76" height=".76" rx=".06"/><path d={`M ${stair.cell.x+.22} ${stair.cell.y+.22} L ${stair.cell.x+.78} ${stair.cell.y+.78} M ${stair.cell.x+.78} ${stair.cell.y+.22} L ${stair.cell.x+.22} ${stair.cell.y+.78}`}/></g>)}
      {levelStairs.map(({stair,index})=><g key={`stair:${index}`} className="construction-plan-stair" transform={`rotate(${stair.rotation??0} ${stair.cell.x+.5} ${stair.cell.y+.5})`}><rect x={stair.cell.x+.14} y={stair.cell.y+.14} width=".72" height=".72" rx=".08"/><path d={`M ${stair.cell.x+.28} ${stair.cell.y+.72} L ${stair.cell.x+.72} ${stair.cell.y+.28} M ${stair.cell.x+.48} ${stair.cell.y+.72} L ${stair.cell.x+.72} ${stair.cell.y+.48}`}/></g>)}
    </svg>
    {!cells.length&&<div className="construction-plan-empty"><strong>На этом этаже пока нет пола</strong></div>}
    <div className="construction-plan-legend"><span><i className="is-wall"/>Стена</span><span><i className="is-door"/>Дверь</span><span><i className="is-window"/>Окно</span><span><i className="is-stair"/>Лестница</span><span><i className="is-stair-opening"/>Проём лестницы</span></div>
  </section>
}
type FloorPlanProps={
  spec:HouseSpec
  onRoomWindowChange:(id:string,count:number)=>void
  onDoorConfig:(key:string,config:DoorConfig)=>void
  onEntranceChange:(roomId:string|null)=>void
}&Record<string,any>
function FloorPlan(props:FloorPlanProps){return <ConstructionPlan model={props.spec.construction}/>} 

function Workspace({spec,setSpec,onReset,onClear}:{spec:HouseSpec;setSpec:(s:HouseSpec)=>void;onReset:()=>void;onClear:()=>void}){
  const data=useMemo(()=>estimate(spec),[spec])
  const costItems=useMemo(()=>buildCostItems(spec,data),[spec,data])
  const materialTotal=costItems.reduce((sum,item)=>sum+item.materials,0)
  const laborTotal=costItems.reduce((sum,item)=>sum+item.labor,0)
  const baseRooms=useMemo(()=>generateRoomPlan(spec),[spec])
  const planKey=`${spec.area}:${spec.floors}:${spec.bedrooms}:${spec.wishes.join('|')}:${spec.removedRooms.join('|')}:${spec.addedRooms.map(item=>`${item.id}-${item.floor}`).join('|')}:${Object.entries(spec.roomFloors).join('|')}:${Object.entries(spec.roomLayouts).map(([id,p])=>`${id}-${p.x}-${p.y}-${p.w}-${p.h}`).join('|')}:${spec.roomRelations.map(item=>`${item.a}-${item.b}-${item.type}`).join('|')}:${spec.blockedPassages.map(item=>`${item.a}-${item.b}`).join('|')}:${spec.openWalls.map(item=>`${item.a}-${item.b}`).join('|')}:${spec.entranceRoom??''}`
  const [positionEdit,setPositionEdit]=useState<{key:string;values:Record<string,{x:number;y:number}>}>({key:planKey,values:{}})
  const [orderEdit,setOrderEdit]=useState<{key:string;values:string[]}>({key:planKey,values:[]})
  const adjustedRooms=useMemo(()=>applyRoomOverrides(baseRooms,spec.roomAreas,spec.area),[baseRooms,spec.roomAreas,spec.area])
  const relationArrangedRooms=useMemo(()=>arrangeRoomsByRelations(adjustedRooms,spec.roomRelations),[adjustedRooms,spec.roomRelations])
  const roomOrder=orderEdit.key===planKey&&orderEdit.values.length?orderEdit.values:relationArrangedRooms.map(room=>room.id)
  const rooms=useMemo(()=>{
    const order=new Map(roomOrder.map((id,index)=>[id,index]))
    return [...adjustedRooms].sort((a,b)=>(order.get(a.id)??999)-(order.get(b.id)??999))
  },[adjustedRooms,roomOrder])
  const basePositions=useMemo(()=>buildCoordinateLayout(rooms),[rooms])
  const positionOverrides=positionEdit.key===planKey?positionEdit.values:{}
  const positions=useMemo(()=>Object.fromEntries(Object.entries(basePositions).map(([id,position])=>[id,{...position,...spec.customPlan?.layouts[id],...spec.roomLayouts[id],...positionOverrides[id]}])),[basePositions,spec.customPlan,spec.roomLayouts,positionOverrides]) as Record<string,RoomPosition>
  const [tab,setTab]=useState<'params'|'model'|'estimate'>('model')
  const [modelView,setModelView]=useState<'volume'|'plan'>(()=>localStorage.getItem('domovid-model-view')==='volume'?'volume':'plan')
  useEffect(()=>localStorage.setItem('domovid-model-view',modelView),[modelView])
  const [detail,setDetail]=useState(false)
  const [history,setHistory]=useState<HouseSpec[]>([])
  const [future,setFuture]=useState<HouseSpec[]>([])
  const [saveStatus,setSaveStatus]=useState('Сохранено')
  const saveTimer=useRef<number | undefined>(undefined)
  useEffect(()=>()=>window.clearTimeout(saveTimer.current),[])
  const update=(next:HouseSpec)=>{
    setHistory(h=>[...h.slice(-49),spec])
    setFuture([])
    setSaveStatus('Сохраняем…')
    setSpec(next)
    window.clearTimeout(saveTimer.current)
    saveTimer.current=window.setTimeout(()=>setSaveStatus('Сохранено'),350)
  }
  useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent<{kind:'door'|'window';key:string;config:DoorConfig|WindowConfig}>).detail;if(!detail?.key)return;if(detail.kind==='window')update({...spec,windowConfigs:{...spec.windowConfigs,[detail.key]:detail.config as WindowConfig}});else if(spec.doorInstances.some(item=>item.id===detail.key))update({...spec,doorInstances:updateDoor(spec.doorInstances,detail.key,detail.config as DoorConfig)});else update({...spec,doorConfigs:{...spec.doorConfigs,[detail.key]:detail.config as DoorConfig}})};window.addEventListener('domovid-opening-change',receive);return()=>window.removeEventListener('domovid-opening-change',receive)},[spec])
  useEffect(()=>{const receive=(event:Event)=>{
    const detail=(event as CustomEvent<{action:'change'|'create-plan';construction:ConstructionModel}>).detail
    if(!detail)return
    if(detail.action==='change'){update({...spec,construction:detail.construction});return}
    const zones=generateZones(detail.construction)
    if(!zones.length)return
    const rooms:AddedRoom[]=zones.map((zone,index)=>({id:zone.id,name:zones.length===1?'Большая комната':`Помещение ${index+1}`,weight:zone.cells,floor:Math.min(2,zone.floor) as 1|2,kind:'extra'}))
    const width=detail.construction.width||12,depth=detail.construction.depth||10
    const layouts=Object.fromEntries(zones.map(zone=>[zone.id,{x:zone.x/width*12,y:zone.y/depth*10,w:zone.w/width*12,h:zone.h/depth*10}]))
    const area=rooms.reduce((sum,room)=>sum+room.weight,0)
    update({...spec,area:Math.max(4,area),floors:rooms.some(room=>room.floor===2)?2:1,construction:detail.construction,customPlan:{rooms,layouts},roomAreas:Object.fromEntries(rooms.map(room=>[room.id,room.weight])),roomLayouts:{},roomWindows:Object.fromEntries(rooms.map(room=>[room.id,0])),roomDoors:{},doorConfigs:{},doorInstances:[],windowConfigs:{},entranceRoom:null,roomRelations:[],blockedPassages:[],openWalls:[],roomFloors:{},removedRooms:[],addedRooms:[]})
    setModelView('plan')
  };window.addEventListener('domovid-construction',receive);return()=>window.removeEventListener('domovid-construction',receive)},[spec])
  useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent<{action:string;roomId:string;otherId?:string;offset?:number;wall?:WallSide;key?:string;respond?:(result:{success:boolean;message:string})=>void}>).detail;if(!detail)return
    const respond=(success:boolean,message:string)=>detail.respond?.({success,message})
    if(detail.action==='toggle-wall'&&detail.otherId){
      const open=hasOpenWall(spec.openWalls,detail.roomId,detail.otherId)
      const nextWalls=setWallOpen(spec.openWalls,detail.roomId,detail.otherId,!open)
      const nextDoors=open?spec.doorInstances:spec.doorInstances.filter(door=>!samePair({a:door.roomA,b:door.roomB},detail.roomId,detail.otherId!))
      update({...spec,openWalls:nextWalls,doorInstances:nextDoors,blockedPassages:spec.blockedPassages.filter(pair=>!samePair(pair,detail.roomId,detail.otherId!)),roomRelations:[...spec.roomRelations.filter(item=>!samePair(item,detail.roomId,detail.otherId!)),{a:detail.roomId,b:detail.otherId,type:'access'}]})
      respond(true,open?'Стена восстановлена. Между помещениями оставлен проход.':'Стена убрана — помещения объединены.')
      return
    }
    if(detail.action==='add-window'){
      const room=rooms.find(item=>item.id===detail.roomId),position=positions[detail.roomId],count=Math.min(4,spec.roomWindows[detail.roomId]??1)
      if(!room||!position||!detail.wall||!exteriorSides(position).includes(detail.wall)){respond(false,'Окно можно поставить только на наружной стене.');return}
      if(count>=4){respond(false,'В этой комнате уже максимальное количество окон — четыре.');return}
      const key=`window:${detail.roomId}:${count}`,config:WindowConfig={offset:detail.offset??.5,width:1.4,kind:'casement',wall:detail.wall}
      const sameWall=Array.from({length:count},(_,index)=>spec.windowConfigs[`window:${detail.roomId}:${index}`]??{offset:(index+1)/(count+1),width:1.4,kind:'casement' as WindowKind,wall:defaultExteriorSide(position)}).filter(item=>(item.wall??defaultExteriorSide(position))===detail.wall)
      const wallLength=detail.wall==='top'||detail.wall==='bottom'?position.w:position.h
      if(sameWall.some(item=>Math.abs(item.offset-config.offset)*wallLength<(item.width+config.width)/2+.25)){respond(false,'Здесь недостаточно места. Выберите свободный участок стены.');return}
      update({...spec,roomWindows:{...spec.roomWindows,[detail.roomId]:count+1},windowConfigs:{...spec.windowConfigs,[key]:config}});respond(true,'Окно добавлено на выбранную стену.');return
    }
    if(detail.action==='add-door'&&detail.otherId){
      const pair=doorKey(detail.roomId,detail.otherId),existing=spec.doorInstances.filter(item=>doorKey(item.roomA,item.roomB)===pair),wasBlocked=spec.blockedPassages.some(item=>samePair(item,detail.roomId,detail.otherId!))
      const nextDoor:DoorInstance={id:`door:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,7)}`,roomA:detail.roomId,roomB:detail.otherId,offset:detail.offset??.5,width:.9,kind:'swing'}
      update({...spec,openWalls:setWallOpen(spec.openWalls,detail.roomId,detail.otherId,false),doorInstances:addDoor(spec.doorInstances,spec.doorConfigs,detail.roomId,detail.otherId,nextDoor,nextDoor.id,!wasBlocked),blockedPassages:spec.blockedPassages.filter(item=>!samePair(item,detail.roomId,detail.otherId!)),roomRelations:[...spec.roomRelations.filter(item=>!samePair(item,detail.roomId,detail.otherId!)),{a:detail.roomId,b:detail.otherId,type:'access'}]});respond(true,existing.length||!wasBlocked?'Добавлена ещё одна дверь на общей стене.':'Стена восстановлена, дверь добавлена между комнатами.');return
    }
    if(detail.action==='remove-window'&&detail.key){const index=Number(detail.key.split(':').at(-1)),count=spec.roomWindows[detail.roomId]??1;if(count<=0){respond(false,'Это окно уже удалено.');return}const configs={...spec.windowConfigs};delete configs[detail.key];for(let cursor=index+1;cursor<count;cursor++){const from=`window:${detail.roomId}:${cursor}`,to=`window:${detail.roomId}:${cursor-1}`;if(configs[from]){configs[to]=configs[from];delete configs[from]}}update({...spec,roomWindows:{...spec.roomWindows,[detail.roomId]:Math.max(0,count-1)},windowConfigs:configs});respond(true,'Окно удалено.');return}
    if(detail.action==='remove-door'&&detail.key){if(detail.key.startsWith('entrance:')){update({...spec,entranceRoom:null});respond(true,'Входная дверь удалена.');return}const instance=spec.doorInstances.find(item=>item.id===detail.key);if(instance){const remaining=removeDoor(spec.doorInstances,detail.key),pairRemaining=remaining.some(item=>samePair({a:item.roomA,b:item.roomB},instance.roomA,instance.roomB)),blocked=pairRemaining?spec.blockedPassages:[...spec.blockedPassages.filter(pair=>!samePair(pair,instance.roomA,instance.roomB)),{a:instance.roomA,b:instance.roomB}];update({...spec,doorInstances:remaining,blockedPassages:blocked});respond(true,'Дверь удалена.');return}const [a,b]=detail.key.split('::');if(!rooms.some(room=>room.id===a)||!rooms.some(room=>room.id===b)){respond(false,'Не удалось найти комнаты для этой двери.');return}const blocked=[...spec.blockedPassages.filter(pair=>!samePair(pair,a,b)),{a,b}],relations=spec.roomRelations.filter(item=>!(item.type==='access'&&samePair(item,a,b)));update({...spec,blockedPassages:blocked,roomRelations:relations});respond(true,'Дверь удалена. Помещение может остаться без прохода.');return}
    respond(false,'Не удалось выполнить изменение проёма.')
  };window.addEventListener('domovid-opening-action',receive);return()=>window.removeEventListener('domovid-opening-action',receive)},[spec,rooms,positions])
  const changeRoomArea=(id:string,area:number)=>{
    update({...spec,roomAreas:{...spec.roomAreas,[id]:area}})
    setPositionEdit({key:planKey,values:{}})
  }
  const changePassage=(a:string,b:string,enabled:boolean)=>{
    if(enabled){
      update({...spec,openWalls:setWallOpen(spec.openWalls,a,b,false),blockedPassages:spec.blockedPassages.filter(pair=>!samePair(pair,a,b)),roomRelations:[...spec.roomRelations.filter(item=>!samePair(item,a,b)),{a,b,type:'access'}]})
      return true
    }
    const first=rooms.find(room=>room.id===a),second=rooms.find(room=>room.id===b)
    if(!first||!second||first.floor!==second.floor)return false
    const blocked=[...spec.blockedPassages.filter(pair=>!samePair(pair,a,b)),{a,b}]
    const relations=spec.roomRelations.filter(item=>!(item.type==='access'&&samePair(item,a,b)))
    update({...spec,blockedPassages:blocked,roomRelations:relations,doorInstances:spec.doorInstances.filter(door=>!samePair({a:door.roomA,b:door.roomB},a,b))})
    return true
  }
  const changeRoomDoors=(id:string,count:number)=>{
    const room=rooms.find(item=>item.id===id)
    if(!room)return
    const adjacent=rooms.filter(other=>other.id!==id&&other.floor===room.floor&&roomsShareWall(positions[id],positions[other.id]))
    let blocked=[...spec.blockedPassages],relations=[...spec.roomRelations],doorInstances=[...spec.doorInstances]
    if(count===0){
      doorInstances=doorInstances.filter(door=>door.roomA!==id&&door.roomB!==id)
      for(const other of adjacent)if(!blocked.some(pair=>samePair(pair,id,other.id)))blocked.push({a:id,b:other.id})
      relations=relations.filter(item=>!(item.type==='access'&&(item.a===id||item.b===id)))
    }else if((spec.roomDoors[id]??1)===0){
      for(const other of adjacent.slice(0,count))blocked=blocked.filter(pair=>!samePair(pair,id,other.id))
    }
    update({...spec,roomDoors:{...spec.roomDoors,[id]:count},blockedPassages:blocked,roomRelations:relations,doorInstances})
  }
  const changeWindowConfig=(key:string,config:WindowConfig)=>{
    const [,roomId,indexText]=key.split(':'),room=rooms.find(item=>item.id===roomId),position=positions[roomId]
    if(!room||!position||config.offset<.1||config.offset>.9)return false
    const wall=config.wall??defaultExteriorSide(position),wallLength=wall==='top'||wall==='bottom'?position.w:position.h
    const count=spec.roomWindows[roomId]??1
    for(let index=0;index<count;index++){
      if(index===Number(indexText))continue
      const other=spec.windowConfigs[`window:${roomId}:${index}`]??{offset:(index+1)/(count+1),width:1.4,kind:'casement' as WindowKind,wall:defaultExteriorSide(position)}
      if((other.wall??defaultExteriorSide(position))!==wall)continue
      if(Math.abs(other.offset-config.offset)*wallLength<(other.width+config.width)/2+.25)return false
    }
    if(spec.entranceRoom===roomId&&wall===defaultExteriorSide(position)){const entrance=spec.doorConfigs[`entrance:${roomId}`]??{offset:.5,width:1,kind:'swing' as DoorKind};if(Math.abs(entrance.offset-config.offset)*wallLength<(entrance.width+config.width)/2+.25)return false}
    update({...spec,windowConfigs:{...spec.windowConfigs,[key]:config}})
    return true
  }
  const addRoomManually=(name:string,kind:AddedRoom['kind'],floor:1|2,area:number)=>{
    const id=`manual-${Date.now()}`
    update({...spec,addedRooms:[...spec.addedRooms,{id,name,kind,floor,weight:area}],roomAreas:{...spec.roomAreas,[id]:area}})
    setPositionEdit({key:planKey,values:{}})
  }
  const deleteRoomManually=(id:string)=>{
    const isAdded=spec.addedRooms.some(room=>room.id===id)
    const roomAreas={...spec.roomAreas},roomWindows={...spec.roomWindows},roomDoors={...spec.roomDoors},roomFloors={...spec.roomFloors},roomLayouts={...spec.roomLayouts}
    delete roomAreas[id];delete roomWindows[id];delete roomDoors[id];delete roomFloors[id];delete roomLayouts[id]
    update({...spec,addedRooms:isAdded?spec.addedRooms.filter(room=>room.id!==id):spec.addedRooms,removedRooms:isAdded?spec.removedRooms:[...new Set([...spec.removedRooms,id])],roomAreas,roomWindows,roomDoors,roomFloors,roomLayouts,roomRelations:spec.roomRelations.filter(item=>item.a!==id&&item.b!==id),blockedPassages:spec.blockedPassages.filter(item=>item.a!==id&&item.b!==id),openWalls:spec.openWalls.filter(item=>item.a!==id&&item.b!==id),doorInstances:spec.doorInstances.filter(item=>item.roomA!==id&&item.roomB!==id),entranceRoom:spec.entranceRoom===id?null:spec.entranceRoom})
    setPositionEdit({key:planKey,values:{}})
  }
  const moveRoomFloorManually=(id:string,floor:1|2)=>{
    const roomLayouts={...spec.roomLayouts};delete roomLayouts[id]
    update({...spec,roomLayouts,roomFloors:{...spec.roomFloors,[id]:floor},roomRelations:spec.roomRelations.filter(item=>item.a!==id&&item.b!==id),blockedPassages:spec.blockedPassages.filter(item=>item.a!==id&&item.b!==id),openWalls:spec.openWalls.filter(item=>item.a!==id&&item.b!==id),doorInstances:spec.doorInstances.filter(item=>item.roomA!==id&&item.roomB!==id)})
    setPositionEdit({key:planKey,values:{}})
  }
  const positionRoomManually=(id:string,x:number,y:number,maxRows=10)=>{
    const room=rooms.find(item=>item.id===id),position=positions[id]
    if(!room||!position)return false
    const target=rooms.find(other=>other.id!==id&&other.floor===room.floor&&x>=positions[other.id].x&&x<positions[other.id].x+positions[other.id].w&&y>=positions[other.id].y&&y<positions[other.id].y+positions[other.id].h)
    if(target){
      const targetPosition=positions[target.id]
      update({...spec,roomLayouts:{...spec.roomLayouts,[id]:{...position,x:targetPosition.x,y:targetPosition.y},[target.id]:{...targetPosition,x:position.x,y:position.y}}})
      return true
    }
    const candidate={...position,x:Math.max(0,Math.min(12-position.w,x)),y:Math.max(0,Math.min(maxRows-position.h,y))}
    if(rooms.some(other=>other.id!==id&&other.floor===room.floor&&rectanglesOverlap(candidate,positions[other.id])))return false
    update({...spec,roomLayouts:{...spec.roomLayouts,[id]:candidate}})
    return true
  }
  const resizeRoomManually=(id:string,dw:number,dh:number)=>{
    const room=rooms.find(item=>item.id===id),position=positions[id]
    if(!room||!position)return false
    const candidate={...position,w:Math.max(1.5,Math.round((position.w+dw)*2)/2),h:Math.max(1.5,Math.round((position.h+dh)*2)/2)}
    const layouts={...Object.fromEntries(rooms.map(item=>[item.id,{...positions[item.id]}])),...spec.roomLayouts,[id]:candidate},areas={...spec.roomAreas,[id]:Math.max(3,Math.round(room.area*(candidate.w*candidate.h)/(position.w*position.h)*2)/2)}
    const rightNeighbors=dw!==0?rooms.filter(other=>{if(other.id===id||other.floor!==room.floor)return false;const q=positions[other.id];return Math.abs(q.x-position.x-position.w)<.03&&Math.min(position.y+position.h,q.y+q.h)-Math.max(position.y,q.y)>.55}):[]
    const bottomNeighbors=dh!==0?rooms.filter(other=>{if(other.id===id||other.floor!==room.floor)return false;const q=positions[other.id];return Math.abs(q.y-position.y-position.h)<.03&&Math.min(position.x+position.w,q.x+q.w)-Math.max(position.x,q.x)>.55}):[]
    for(const neighbor of rightNeighbors){const q=positions[neighbor.id],next={...q,x:q.x+dw,w:q.w-dw};if(next.w<1.5||next.x<0||next.x+next.w>12)return false;layouts[neighbor.id]=next;areas[neighbor.id]=Math.max(3,Math.round(neighbor.area*(next.w*next.h)/(q.w*q.h)*2)/2)}
    for(const neighbor of bottomNeighbors){const q=positions[neighbor.id],next={...q,y:q.y+dh,h:q.h-dh};if(next.h<1.5||next.y<0||next.y+next.h>10)return false;layouts[neighbor.id]=next;areas[neighbor.id]=Math.max(3,Math.round(neighbor.area*(next.w*next.h)/(q.w*q.h)*2)/2)}
    if(candidate.x+candidate.w>12||candidate.y+candidate.h>10)return false
    if(!rightNeighbors.length&&!bottomNeighbors.length&&(dw>0||dh>0)&&rooms.some(other=>other.id!==id&&other.floor===room.floor&&rectanglesOverlap(candidate,positions[other.id])))return false
    update({...spec,roomLayouts:layouts,roomAreas:areas})
    return true
  }
  const markHistorySaved=()=>{setSaveStatus('Сохраняем…');window.clearTimeout(saveTimer.current);saveTimer.current=window.setTimeout(()=>setSaveStatus('Сохранено'),350)}
  const undo=()=>{const prev=history.at(-1);if(!prev)return;setFuture(items=>[spec,...items].slice(0,50));setHistory(items=>items.slice(0,-1));setSpec(prev);markHistorySaved();window.dispatchEvent(new CustomEvent('domovid-history',{detail:{message:'Последнее изменение отменено.'}}))}
  const redo=()=>{const next=future[0];if(!next)return;setHistory(items=>[...items.slice(-49),spec]);setFuture(items=>items.slice(1));setSpec(next);markHistorySaved();window.dispatchEvent(new CustomEvent('domovid-history',{detail:{message:'Изменение возвращено.'}}))}
  useEffect(()=>{const handle=(event:KeyboardEvent)=>{const target=event.target as HTMLElement;if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)return;const action=historyShortcut(event);if(!action)return;event.preventDefault();if(action==='undo')undo();else redo()};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle)},[history,future,spec])
  const delta=Math.round((data.high-data.low)/2/100000)*100000
  return <main className="workspace">
    <header className="workspace-header"><button className="brand compact" onClick={onReset}><span className="brand-mark"><Icon name="home"/></span><span>Домовид</span></button><div className="project-title"><strong>Дом {data.area} м²</strong><span aria-live="polite">{saveStatus} в браузере</span></div><div className="header-actions"><button className="ghost-button reset-button" onClick={onClear} aria-label="Сбросить проект"><Icon name="reset"/><span>Сбросить</span></button><button className="ghost-button" onClick={undo} disabled={!history.length} title="Отменить · Alt+Z / Ctrl+Z"><Icon name="undo"/><span>Отменить</span></button><button className="ghost-button" onClick={redo} disabled={!future.length} title="Вернуть · Alt+Y / Ctrl+Y"><Icon name="redo"/><span>Вернуть</span></button></div></header>
    <nav className="mobile-tabs" aria-label="Разделы проекта">{([['params','Параметры'],['model','Модель'],['estimate','Расчёт']] as const).map(([id,label])=><button aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)} key={id}>{label}</button>)}</nav>
    <div className="workspace-grid">
      <aside className={`settings-panel ${tab==='params'?'mobile-active':''}`}>
        <div><span className="panel-label">Настройте дом</span><h2>Объём и планировка</h2><p>Меняйте основные параметры. Модель и расчёт обновятся вместе.</p></div>
        <div className="change-note"><span>Последнее изменение</span><strong>Расчёт обновлён · запас диапазона {money(delta)}</strong>{spec.wishes.length>0&&<em>Пожелания: {spec.wishes.join(', ')}</em>}</div>
      </aside>
      <section className={`model-panel ${tab==='model'?'mobile-active':''}`}>
        <div className="model-toolbar"><div><strong>{modelView==='volume'?'Объём дома':'Планировка'}</strong><span>{modelView==='volume'?'Концептуальная 3D-модель':'Автоматическое распределение площади'}</span></div><div className="view-switch" role="group" aria-label="Вид проекта"><button type="button" aria-pressed={modelView==='volume'} onPointerEnter={()=>void loadHouse3D()} onFocus={()=>void loadHouse3D()} onClick={()=>setModelView('volume')}>3D</button><button type="button" aria-pressed={modelView==='plan'} onClick={()=>setModelView('plan')}>План</button></div></div>
        {modelView==='volume'?<HouseCanvas spec={spec}/>:<FloorPlan spec={spec} rooms={rooms} positions={positions} hasEdits={Boolean(spec.customPlan)||Object.keys(spec.roomAreas).length>0||Object.keys(positionOverrides).length>0||Boolean(orderEdit.key===planKey&&orderEdit.values.length)||Object.keys(spec.roomWindows).length>0||Object.keys(spec.roomDoors).length>0||Object.keys(spec.doorConfigs).length>0||spec.doorInstances.length>0||Object.keys(spec.windowConfigs).length>0||Boolean(spec.entranceRoom)||spec.roomRelations.length>0||spec.blockedPassages.length>0||spec.openWalls.length>0||Object.keys(spec.roomLayouts).length>0||Object.keys(spec.roomFloors).length>0||spec.removedRooms.length>0||spec.addedRooms.length>0} onAddRoom={addRoomManually} onDeleteRoom={deleteRoomManually} onMoveRoomFloor={moveRoomFloorManually} onReset={()=>{setPositionEdit({key:planKey,values:{}});setOrderEdit({key:planKey,values:[]});update({...DEFAULT_SPEC,wall:spec.wall,roof:spec.roof,region:spec.region,construction:spec.construction})}} onRoomAreaChange={changeRoomArea} onRoomWindowChange={(id,count)=>update({...spec,roomWindows:{...spec.roomWindows,[id]:count}})} onRoomDoorChange={changeRoomDoors} onPassageChange={changePassage} onDoorConfig={(key,config)=>spec.doorInstances.some(door=>door.id===key)?update({...spec,doorInstances:spec.doorInstances.map(door=>door.id===key?{...door,...config}:door)}):update({...spec,doorConfigs:{...spec.doorConfigs,[key]:config}})} onWindowConfig={changeWindowConfig} onEntranceChange={roomId=>update({...spec,entranceRoom:roomId})} onPositionRoom={positionRoomManually} onResizeRoom={resizeRoomManually}/>}<div className="model-facts" aria-label="Параметры модели"><span><b>{data.width.toFixed(1)} × {data.length.toFixed(1)} м</b> габариты</span><span><b>{data.rooms}</b> помещений</span><span><b>{spec.construction.walls.length}</b> сегментов стен</span></div>
      </section>
      <aside className={`estimate-panel ${tab==='estimate'?'mobile-active':''}`}>
        <div className="estimate-heading"><span className="panel-label">Предварительный расчёт</span><h2>{money(data.low)}<br/><span>— {money(data.high)}</span></h2><p>{spec.region} · локальные коэффициенты MVP</p></div>
        <dl className="key-values"><div><dt>Площадь построенных этажей</dt><dd>{data.area} м²</dd></div><div><dt>Площадь стен</dt><dd>{Math.round(data.wallArea)} м²</dd></div><div><dt>Кровля</dt><dd>{Math.round(data.roofArea)} м²</dd></div><div><dt>Фундамент</dt><dd>{data.foundation.toFixed(1)} м³</dd></div></dl>
        <button className="calculation-button" onClick={()=>setDetail(!detail)} aria-expanded={detail}>{detail?'Скрыть состав':'Как рассчитано'} <Icon name="arrow"/></button>
        {detail&&<div className="estimate-breakdown">
          <div className="breakdown-head"><strong>Состав базовой стоимости</strong><span>Материалы и работа</span></div>
          <div className="cost-items">{costItems.map(item=><article className="cost-item" key={item.id}><header><div><strong>{item.name}</strong><span>{item.quantity.toFixed(item.unit==='м³'?1:0)} {item.unit}</span></div><b>{money(item.materials+item.labor)}</b></header><dl><div><dt>Материалы</dt><dd>{money(item.materials)}</dd></div><div><dt>Работа</dt><dd>{money(item.labor)}</dd></div></dl></article>)}</div>
          <dl className="cost-summary"><div><dt>Материалы</dt><dd>{money(materialTotal)}</dd></div><div><dt>Работы</dt><dd>{money(laborTotal)}</dd></div><div><dt>Базовая стоимость</dt><dd>{money(materialTotal+laborTotal)}</dd></div></dl>
          <div className="assumptions"><h3>Пока не включено</h3><ul><li>участок, геология и разрешения;</li><li>подключение внешних коммуникаций;</li><li>чистовая отделка, мебель и благоустройство.</li></ul></div>
        </div>}
        <div className="trust-note"><Icon name="info"/><p><strong>Это концепция, не строительный проект.</strong> Итоговая стоимость определяется после инженерных расчётов и предложений подрядчиков.</p></div>
      </aside>
    </div>
  </main>
}

function App(){
  const saved=localStorage.getItem('domovid-spec')
  const [spec,setSpecState]=useState<HouseSpec>(()=>{if(!saved)return DEFAULT_SPEC;const parsed=JSON.parse(saved);return {...DEFAULT_SPEC,...parsed,construction:normalizeConstructionModel(parsed.construction??DEFAULT_SPEC.construction),doorConfigs:parsed.doorConfigs??{},doorInstances:parsed.doorInstances??[],openWalls:parsed.openWalls??[],windowConfigs:parsed.windowConfigs??{},roomLayouts:parsed.roomLayouts??{}}})
  const setSpec=(next:HouseSpec)=>{setSpecState(next);localStorage.setItem('domovid-spec',JSON.stringify(next))}
  const clear=()=>{localStorage.removeItem('domovid-spec');setSpecState(DEFAULT_SPEC)}
  return <Workspace spec={spec} setSpec={setSpec} onReset={()=>{}} onClear={clear}/>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
