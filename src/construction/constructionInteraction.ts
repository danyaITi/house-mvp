export type ConstructionHoverTool='select'|'erase'|'door'|'window'|'foundation'|'build-wall'|'stairs'|'roof'|null

export function shouldHighlightWall({objectDragActive,hasOpening,tool,isHovered}:{objectDragActive:boolean;hasOpening:boolean;tool:ConstructionHoverTool;isHovered:boolean}){
  return !objectDragActive&&!hasOpening&&isHovered&&(tool==='select'||tool==='erase')
}

export function shouldHighlightOpening({objectDragActive,hasOpening,isCoveredSegmentHovered}:{objectDragActive:boolean;hasOpening:boolean;isCoveredSegmentHovered:boolean}){
  return !objectDragActive&&hasOpening&&isCoveredSegmentHovered
}

export function shouldHighlightStandaloneAperture(tool:string|null,kind:'door'|'window',objectDragActive:boolean){
  return !objectDragActive&&(tool==='select'||tool===kind)
}

export function hasPointerDrag(start:{x:number;y:number},current:{x:number;y:number},threshold=6){
  return Math.hypot(current.x-start.x,current.y-start.y)>=threshold
}

export function isBuildToolCancelInput(input:{key?:string;button?:number;editable?:boolean}){
  return !input.editable&&input.key==='Escape'
}

export function constructionPointerPlaneSize(tool:string|null,width:number,depth:number):[number,number]{
  const placementTool=tool==='build-wall'||tool==='door-aperture'||tool==='window-aperture'
  return placementTool?[Math.max(width,depth)*20,Math.max(width,depth)*20]:[width,depth]
}

export function shouldDragSelectedWallsFromOpening({additive,wantsWall,selectionKind,coveredWallKeys,selectedWallKeys}:{additive:boolean;wantsWall:boolean;selectionKind:string|null;coveredWallKeys:readonly string[];selectedWallKeys:readonly string[]}){
  return !additive&&!wantsWall&&selectionKind==='walls'&&coveredWallKeys.some(key=>selectedWallKeys.includes(key))
}

export function selectCoveredWallKeys(current:readonly string[],covered:readonly string[],additive:boolean){
  if(!additive)return [...covered]
  const allSelected=covered.every(key=>current.includes(key))
  return allSelected?current.filter(key=>!covered.includes(key)):[...new Set([...current,...covered])]
}
