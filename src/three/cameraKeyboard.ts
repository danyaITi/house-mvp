export type CameraMove={forward:number;right:number}

export function cameraMovementFromKeys(keys:ReadonlySet<string>,allowArrows=true):CameraMove{
  const forward=(keys.has('KeyW')||allowArrows&&keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||allowArrows&&keys.has('ArrowDown')?1:0)
  const right=(keys.has('KeyD')||allowArrows&&keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||allowArrows&&keys.has('ArrowLeft')?1:0)
  return {forward,right}
}

export function isCameraMovementKey(code:string){
  return ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code)
}
