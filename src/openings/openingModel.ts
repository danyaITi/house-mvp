export type DoorKind = 'swing' | 'double' | 'sliding'
export type DoorConfig = {offset:number;width:number;kind:DoorKind}
export type DoorInstance = DoorConfig & {id:string;roomA:string;roomB:string}
export type RoomPair = {a:string;b:string}

export const defaultDoorConfig:DoorConfig={offset:.5,width:.9,kind:'swing'}
export const doorPairKey=(a:string,b:string)=>[a,b].sort().join('::')

export function doorsForPair(instances:DoorInstance[],legacy:Record<string,DoorConfig>,roomA:string,roomB:string):DoorInstance[]{
  const pair=doorPairKey(roomA,roomB)
  const explicit=instances.filter(door=>doorPairKey(door.roomA,door.roomB)===pair)
  return explicit.length?explicit:[{id:pair,roomA,roomB,...(legacy[pair]??defaultDoorConfig)}]
}

export function addDoor(instances:DoorInstance[],legacy:Record<string,DoorConfig>,roomA:string,roomB:string,config:DoorConfig,id:string,includeLegacy:boolean):DoorInstance[]{
  const pair=doorPairKey(roomA,roomB)
  const alreadyExplicit=instances.some(door=>doorPairKey(door.roomA,door.roomB)===pair)
  const migrated=includeLegacy&&!alreadyExplicit?[{id:`door:legacy:${pair}`,roomA,roomB,...(legacy[pair]??defaultDoorConfig)}]:[]
  return [...instances,...migrated,{id,roomA,roomB,...config}]
}

export function updateDoor(instances:DoorInstance[],id:string,config:DoorConfig):DoorInstance[]{
  return instances.map(door=>door.id===id?{...door,...config}:door)
}

export function removeDoor(instances:DoorInstance[],id:string):DoorInstance[]{
  return instances.filter(door=>door.id!==id)
}

export const hasOpenWall=(walls:RoomPair[],roomA:string,roomB:string)=>walls.some(wall=>doorPairKey(wall.a,wall.b)===doorPairKey(roomA,roomB))

export function setWallOpen(walls:RoomPair[],roomA:string,roomB:string,open:boolean):RoomPair[]{
  const remaining=walls.filter(wall=>doorPairKey(wall.a,wall.b)!==doorPairKey(roomA,roomB))
  return open?[...remaining,{a:roomA,b:roomB}]:remaining
}
