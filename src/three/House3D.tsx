import { Canvas } from '@react-three/fiber'
import { Grid, Line, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { MOUSE, Plane, Vector3 } from 'three'
import { type DoorConfig, type DoorInstance } from '../openings/openingModel'
import { cellKey, constructionOpeningWalls, constructionOpeningWidth, lineWalls, rectangleCells, wallKey, wallSupported, wallsInRectangle, type ConstructionModel, type ConstructionOpening, type ConstructionWall, type FoundationCell, type StairShape, type StandaloneAperture } from '../construction/constructionModel'
import {addStairWithUpperFloor,applyConstructionCommand,applyConstructionCommands,duplicateConstructionOpening,duplicateConstructionStair,duplicateConstructionWalls,fitConstructionOpening,moveConstructionWalls,rotateConstructionWalls,transformConstructionWalls,updateWallSelection} from '../construction/constructionCommands'
import {canExtendSelection,openingClickTarget,SAME_KIND_SELECTION_MESSAGE,selectKey,selectSameKind,singleSelection} from '../construction/constructionSelection'
import {constructionPointerPlaneSize,hasPointerDrag,isBuildToolCancelInput,selectCoveredWallKeys,shouldDragSelectedWallsFromOpening,shouldHighlightOpening,shouldHighlightStandaloneAperture,shouldHighlightWall} from '../construction/constructionInteraction'
import {addStandaloneAperture,duplicateStandaloneApertures,installApertureFixture,nextStandaloneApertureId,standaloneApertureAcceptsFixture,standaloneApertureFits,standaloneApertureFixtureGeometry,transformStandaloneApertures,updateStandaloneFixtureMaterial,wallConflictsWithStandaloneAperture} from '../construction/standaloneApertures'
import {ConstructionToolIcon,constructionToolGroups,constructionToolLabel,constructionTools,type BuildTool,type CatalogTool} from '../construction/constructionCatalog'
import {getActiveConstructionLevel,getConstructionGrid,getConstructionLevels,getExteriorLevels} from '../construction/constructionLevels'
import {constructionVisuals} from './constructionVisuals'
import {moveStairCandidate,rotateQuarter,rotateWallPlacement} from './constructionTransforms'
import {useConstructionSelection,type BuildSelection} from './useConstructionSelection'
import {ApertureFrame,ConstructionRoof,FoundationSlab,OpeningPanel,StairOpening,StairSteps,WallWithOpenings} from './ConstructionMeshes'
import {KeyboardCameraControls} from './KeyboardCameraControls'

type Room = {id:string;name:string;floor:1|2;kind:string;area:number}
type Position = {x:number;y:number;w:number;h:number}
type WindowKind='casement'|'fixed'|'panoramic'
type WallSide='top'|'bottom'|'left'|'right'
type WindowConfig = {offset:number;width:number;kind:WindowKind;wall?:WallSide}
type Pair = {a:string;b:string}
type Spec = {
  floors:1|2
  roof:'gable'|'hip'|'flat'
  wall:string
  roomWindows:Record<string,number>
  doorConfigs:Record<string,DoorConfig>
  doorInstances:DoorInstance[]
  windowConfigs:Record<string,WindowConfig>
  blockedPassages:Pair[]
  openWalls:Pair[]
  entranceRoom:string|null
  construction:ConstructionModel
}

const objectHoverColor=constructionVisuals.hover
const objectHoverEmissive=constructionVisuals.hoverEmissive
const objectStateBlue=constructionVisuals.selected
const objectStateBlueBorder=constructionVisuals.selectedBorder
const objectStateBlueEmissive=constructionVisuals.selectedEmissive
const objectStateInvalidBorder=constructionVisuals.invalidBorder
const constructionStoreyHeight=2.7

type EraseSelection={wallKeys:string[];cellKeys:string[];openingKeys:string[];stairIndexes:number[];roof:boolean}
const emptyEraseSelection=():EraseSelection=>({wallKeys:[],cellKeys:[],openingKeys:[],stairIndexes:[],roof:false})

function ConstructionScene({model,tool,level,showRoof,floorMaterial,wallMaterial,wallRotation,openingStyle,openingMaterial,stairShape,stairRotation,selection,movingOpening,onStartMovingOpening,onMoveOpening,onChange,onMessage,onSelect}:{model:ConstructionModel;tool:BuildTool|null;level:number;showRoof:boolean;floorMaterial:'concrete'|'slab'|'wood';wallMaterial:'aerated'|'brick'|'frame'|'timber';wallRotation:0|90;openingStyle:string;openingMaterial:string;stairShape:StairShape;stairRotation:0|90|180|270;selection:BuildSelection|null;movingOpening:boolean;onStartMovingOpening:(wall:ConstructionWall)=>void;onMoveOpening:(wall:ConstructionWall)=>void;onChange:(next:ConstructionModel,message:string)=>void;onMessage:(message:string)=>void;onSelect:(selection:BuildSelection|null)=>void}){
  const width=model.width||12,depth=model.depth||10
  const interactionPlaneSize=Math.max(width,depth)*20
  const pointerPlaneSize=constructionPointerPlaneSize(tool,width,depth)
  const openings=model.openings??[]
  const stairs=model.stairs??[]
  const apertures=(model.apertures??[]).filter(aperture=>(aperture.level??1)===level)
  const movingSourceOpening=selection?.kind==='opening'?openings.find(opening=>wallKey(opening.wall)===selection.wallKey):null
  const activeSelectionKind=selection?.kind==='walls'?'wall':selection?.kind==='cells'?'foundation':selection?.kind==='stair'||selection?.kind==='stairs'?'stair':selection?.kind==='roof'?'roof':selection?.kind==='fixture'?(apertures.find(item=>item.id===selection.id)?.kind??'fixture'):selection?.kind==='fixtures'?(apertures.find(item=>selection.ids.includes(item.id))?.kind??'fixture'):selection?.kind==='aperture'?(apertures.find(item=>item.id===selection.id)?.kind??'aperture'):selection?.kind==='apertures'?(apertures.find(item=>selection.ids.includes(item.id))?.kind??'aperture'):selection?.kind==='opening'?(openings.find(opening=>wallKey(opening.wall)===selection.wallKey)?.kind??'opening'):selection?.kind==='openings'?(openings.find(opening=>selection.wallKeys.includes(wallKey(opening.wall)))?.kind??'opening'):null
  const visibleCells=model.cells.filter(cell=>(cell.level??1)===level)
  const visibleWalls=model.walls.filter(wall=>(wall.level??1)===level)
  const [drag,setDrag]=useState<{cell:FoundationCell;current:FoundationCell;wall:ConstructionWall;currentWall:ConstructionWall;additive:boolean}|null>(null)
  const [hoveredWall,setHoveredWall]=useState<string|null>(null)
  const [hoveredStair,setHoveredStair]=useState<number|null>(null)
  const [hoveredCell,setHoveredCell]=useState<string|null>(null)
  const [hoveredRoof,setHoveredRoof]=useState(false)
  const [hoveredBuildWall,setHoveredBuildWall]=useState<ConstructionWall|null>(null)
  const [hoveredAperture,setHoveredAperture]=useState<string|null>(null)
  const [hoveredFixture,setHoveredFixture]=useState<string|null>(null)
  const [placementHover,setPlacementHover]=useState<FoundationCell|null>(null)
  const wallSelectionPaint=useRef<'add'|'remove'|null>(null)
  const wallPaintKeys=useRef<string[]>([])
  const selectionDragKind=useRef<'cells'|'walls'>('walls')
  const [openingDropPreview,setOpeningDropPreview]=useState<{wallKey:string;opening:ConstructionOpening|null}|null>(null)
  const [stairDropPreview,setStairDropPreview]=useState<{index:number;x:number;y:number;valid:boolean;rotation:0|90|180|270}|null>(null)
  const [wallDropPreview,setWallDropPreview]=useState<{pointerId:number;wallKeys:string[];startX:number;startY:number;dx:number;dy:number;quarterTurns:number;valid:boolean}|null>(null)
  const [apertureDropPreview,setApertureDropPreview]=useState<{pointerId:number;ids:string[];startX:number;startY:number;clientX:number;clientY:number;dx:number;dy:number;quarterTurns:number;valid:boolean}|null>(null)
  const aperturePress=useRef<{id:string;clientX:number;clientY:number;x:number;y:number}|null>(null)
  const objectDragActive=tool===null||Boolean(wallDropPreview||stairDropPreview||apertureDropPreview||movingOpening)
  const [eraseSelection,setEraseSelection]=useState<EraseSelection>(emptyEraseSelection)
  const openingPress=useRef<{wall:ConstructionWall;clientX:number;clientY:number}|null>(null)
  const openingDragStarted=useRef(false)
  const stairPress=useRef<{index:number;clientX:number;clientY:number}|null>(null)
  const stairDragPlane=useMemo(()=>new Plane(new Vector3(0,1,0),0),[])
  const wallDragPlane=useMemo(()=>new Plane(new Vector3(0,1,0),-1.35),[])
  useEffect(()=>{setDrag(null);setHoveredWall(null);setHoveredStair(null);setHoveredCell(null);setHoveredRoof(false);setHoveredBuildWall(null);setHoveredAperture(null);setHoveredFixture(null);setPlacementHover(null);wallSelectionPaint.current=null;wallPaintKeys.current=[];setStairDropPreview(null);setWallDropPreview(null);setApertureDropPreview(null);setEraseSelection(emptyEraseSelection());openingPress.current=null;openingDragStarted.current=false;stairPress.current=null;aperturePress.current=null},[tool,level])
  useEffect(()=>{if(!movingOpening)setOpeningDropPreview(null)},[movingOpening])
  useEffect(()=>{setHoveredBuildWall(current=>current?{...current,axis:wallRotation===0?'h':'v'}:current)},[wallRotation])
  useEffect(()=>{const clear=()=>{setEraseSelection(emptyEraseSelection());setDrag(null);setWallDropPreview(null);setStairDropPreview(null)};window.addEventListener('domovid-clear-construction-selection',clear);return()=>window.removeEventListener('domovid-clear-construction-selection',clear)},[])
  useEffect(()=>{const finish=()=>{wallSelectionPaint.current=null};window.addEventListener('pointerup',finish);return()=>window.removeEventListener('pointerup',finish)},[])
  useEffect(()=>{const handle=(event:KeyboardEvent)=>{
    if(!wallDropPreview&&!stairDropPreview&&!apertureDropPreview)return
    const target=event.target as HTMLElement
    if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)return
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setWallDropPreview(null);setStairDropPreview(null);stairPress.current=null;onMessage('Перенос отменён. Исходный объект не изменён.');return}
    if(event.code!=='KeyR'&&event.key.toLowerCase()!=='r'&&event.key.toLowerCase()!=='к')return
    event.preventDefault();event.stopImmediatePropagation()
    if(wallDropPreview){const quarterTurns=(wallDropPreview.quarterTurns+1)%4,selectedWalls=model.walls.filter(wall=>wallDropPreview.wallKeys.includes(wallKey(wall))),valid=Boolean(transformConstructionWalls(model,selectedWalls,wallDropPreview.dx,wallDropPreview.dy,quarterTurns));setWallDropPreview({...wallDropPreview,quarterTurns,valid});onMessage(`Placeholder стен повёрнут на ${quarterTurns*90}°. Изменение применится после установки.`);return}
    if(apertureDropPreview){const quarterTurns=(apertureDropPreview.quarterTurns+1)%4,valid=Boolean(transformStandaloneApertures(model,apertureDropPreview.ids,apertureDropPreview.dx,apertureDropPreview.dy,quarterTurns));setApertureDropPreview({...apertureDropPreview,quarterTurns,valid});onMessage(`Placeholder проёма повёрнут на ${quarterTurns*90}°. Изменение применится после установки.`);return}
    if(stairDropPreview){const rotation=((((stairDropPreview.rotation+90)%360) as 0|90|180|270));setStairDropPreview({...stairDropPreview,rotation});onMessage(`Placeholder лестницы повёрнут на ${rotation}°. Изменение применится после установки.`)}
  };window.addEventListener('keydown',handle,true);return()=>window.removeEventListener('keydown',handle,true)},[wallDropPreview,stairDropPreview,apertureDropPreview,model,onMessage])
  const chooseWall=(x:number,y:number,fx:number,fy:number):ConstructionWall=>{
    const distances=[{d:fx,wall:{axis:'v' as const,x,y,level}},{d:1-fx,wall:{axis:'v' as const,x:x+1,y,level}},{d:fy,wall:{axis:'h' as const,x,y,level}},{d:1-fy,wall:{axis:'h' as const,x,y:y+1,level}}]
    return distances.sort((a,b)=>a.d-b.d)[0].wall
  }
  const point=(event:any)=>{const rawX=Math.max(.001,Math.min(width-.001,event.point.x+width/2)),rawY=Math.max(.001,Math.min(depth-.001,event.point.z+depth/2)),cell={x:Math.floor(rawX),y:Math.floor(rawY),level};return {cell,wall:chooseWall(cell.x,cell.y,rawX-cell.x,rawY-cell.y)}}
  const buildWallPoint=(event:any)=>{const target=point(event),axis=wallRotation===0?'h' as const:'v' as const;return {...target,wall:target.wall.axis===axis?target.wall:{axis,x:target.cell.x,y:target.cell.y,level}}}
  const groundPoint=(event:any)=>{const hit=event.ray?.intersectPlane(stairDragPlane,new Vector3());return hit?point({...event,point:hit}):point(event)}
  const usesGroundPlane=tool==='foundation'||tool==='stairs'||tool==='erase'
  const interactionPoint=(event:any)=>usesGroundPlane?groundPoint(event):point(event)
  const begin=(event:any)=>{if(!tool||tool==='door'||tool==='window'||tool==='roof'||event.button!==0)return;event.stopPropagation();const additive=Boolean(event.shiftKey||event.nativeEvent?.shiftKey);const target=(tool==='build-wall'||tool==='door-aperture'||tool==='window-aperture')?buildWallPoint(event):interactionPoint(event);if(tool==='door-aperture'||tool==='window-aperture'){const aperture:StandaloneAperture={id:nextStandaloneApertureId(model,tool==='door-aperture'?'door':'window'),kind:tool==='door-aperture'?'door':'window',size:openingStyle==='aperture-large'?'large':'small',axis:target.wall.axis,x:target.wall.x,y:target.wall.y,level,material:wallMaterial};if(!standaloneApertureFits(model,aperture)){onMessage('Проём нельзя поставить здесь: проверьте границы, фундамент и свободное место.');return}onChange(addStandaloneAperture(model,aperture),`${aperture.kind==='door'?'Дверной':'Оконный'} проём добавлен. Теперь установите в него ${aperture.kind==='door'?'дверь':'окно'}.`);return}if(tool==='select'){const cellsSelected=visibleCells.some(cell=>cell.x===target.cell.x&&cell.y===target.cell.y),candidate=cellsSelected?'foundation':'wall';if(additive&&!canExtendSelection(activeSelectionKind,candidate)){onMessage(SAME_KIND_SELECTION_MESSAGE);return}selectionDragKind.current=cellsSelected?'cells':'walls'}if(tool==='stairs'){const supported=model.cells.some(cell=>(cell.level??1)===level&&cell.x===target.cell.x&&cell.y===target.cell.y);if(!supported){onMessage(`Лестницу можно поставить только на пол ${level} этажа.`);return}const exists=stairs.some(stair=>(stair.cell.level??1)===level&&stair.cell.x===target.cell.x&&stair.cell.y===target.cell.y);if(exists){onMessage('Нажмите на саму лестницу, чтобы повернуть её.');return}onChange(addStairWithUpperFloor(model,{cell:{x:target.cell.x,y:target.cell.y,level},shape:stairShape,rotation:stairRotation}),`Лестница добавлена. Создан ${level+1} этаж по контуру ${level} этажа.`);return}(event.nativeEvent.target as Element).setPointerCapture?.(event.pointerId);setDrag({cell:target.cell,current:target.cell,wall:target.wall,currentWall:target.wall,additive})}
  const move=(event:any)=>{if(!drag){if(tool==='build-wall'||tool==='door-aperture'||tool==='window-aperture'||tool==='door'||tool==='window')setHoveredBuildWall(buildWallPoint(event).wall);if(tool==='foundation'||tool==='stairs')setPlacementHover(groundPoint(event).cell);return}event.stopPropagation();const target=interactionPoint(event),currentWall=drag.wall.axis==='h'?{axis:'h' as const,x:target.cell.x,y:drag.wall.y}:{axis:'v' as const,x:drag.wall.x,y:target.cell.y};setDrag({...drag,current:target.cell,currentWall})}
  const finish=(event:any)=>{
    if(!drag)return
    event.stopPropagation()
    const finalTarget=interactionPoint(event)
    const finalWall=drag.wall.axis==='h'?{axis:'h' as const,x:finalTarget.cell.x,y:drag.wall.y}:{axis:'v' as const,x:drag.wall.x,y:finalTarget.cell.y}
    const cells=rectangleCells(drag.cell,finalTarget.cell).map(cell=>({...cell,level})),walls=lineWalls(drag.wall,finalWall)
    if(tool==='select'){
      const isClick=drag.cell.x===finalTarget.cell.x&&drag.cell.y===finalTarget.cell.y
      if(isClick){
        if(selection&&selection.kind!=='cells'){
          onSelect(null)
          onMessage('Выделение объекта снято.')
          setDrag(null)
          return
        }
        const cell=visibleCells.find(item=>item.x===drag.cell.x&&item.y===drag.cell.y)
        if(!cell){onSelect(null);onMessage('Выделение снято.');setDrag(null);return}
        const key=cellKey(cell),current=selection?.kind==='cells'?selection.cellKeys:[]
        const cellKeys=drag.additive?(current.includes(key)?current.filter(item=>item!==key):[...current,key]):[key]
        onSelect(cellKeys.length?{kind:'cells',cellKeys}:null)
        onMessage(cellKeys.length?`Выбрано пола: ${cellKeys.length} м². Shift добавляет или убирает клетку.`:'Выделение пола снято.')
        setDrag(null)
        return
      }
      if(selectionDragKind.current==='cells'||selection?.kind==='cells'){
        const areaKeys=new Set(cells.map(cellKey))
        const rangeKeys=visibleCells.filter(cell=>areaKeys.has(cellKey(cell))).map(cellKey)
        const current=selection?.kind==='cells'?selection.cellKeys:[]
        const cellKeys=drag.additive?[...new Set([...current,...rangeKeys])]:rangeKeys
        onSelect(cellKeys.length?{kind:'cells',cellKeys}:null)
        onMessage(cellKeys.length?`Рамкой выбрано пола: ${cellKeys.length} м². Shift добавляет следующую область.`:'В этой области нет построенного пола.')
        setDrag(null)
        return
      }
      const selected=wallsInRectangle(visibleWalls,drag.cell,finalTarget.cell)
      const selectedKeys=selected.map(wallKey)
      const currentWallKeys=selection?.kind==='walls'?selection.wallKeys:[]
      const wallKeys=drag.additive?[...new Set([...currentWallKeys,...selectedKeys])]:selectedKeys
      onSelect(wallKeys.length?{kind:'walls',wallKeys}:null)
      onMessage(wallKeys.length?`Рамкой выбрано стен: ${wallKeys.length}.${drag.additive?' Shift добавил стены к текущему выделению.':''}`:'В этой области стен нет.')
      setDrag(null)
      return
    }
    if(tool==='erase'){
      const areaKeys=new Set(cells.map(cellKey))
      const selectedWalls=wallsInRectangle(visibleWalls,drag.cell,finalTarget.cell).map(wallKey)
      const selectedOpenings=openings.filter(opening=>selectedWalls.includes(wallKey(opening.wall))).map(opening=>wallKey(opening.wall))
      const selectedStairs=stairs.flatMap((stair,index)=>areaKeys.has(cellKey({...stair.cell,level}))?[index]:[])
      const hasStructures=selectedWalls.length>0||selectedStairs.length>0
      const selectedCells=hasStructures?[]:visibleCells.filter(cell=>areaKeys.has(cellKey(cell))).map(cellKey)
      const rectangleKeys=new Set(cells.map(cell=>`${cell.x}:${cell.y}`))
      const roofSelected=Boolean(model.roof&&visibleCells.length&&visibleCells.every(cell=>rectangleKeys.has(`${cell.x}:${cell.y}`)))
      const next={...eraseSelection,cellKeys:[...new Set([...eraseSelection.cellKeys,...selectedCells])],wallKeys:[...new Set([...eraseSelection.wallKeys,...selectedWalls])],openingKeys:[...new Set([...eraseSelection.openingKeys,...selectedOpenings])],stairIndexes:[...new Set([...eraseSelection.stairIndexes,...selectedStairs])],roof:eraseSelection.roof||roofSelected}
      setEraseSelection(next)
      const count=next.wallKeys.length+next.cellKeys.length+next.openingKeys.length+next.stairIndexes.length+(next.roof?1:0)
      onMessage(count?`Рамкой выделено объектов: ${count}. Нажмите на любой красный объект, чтобы удалить всю группу.`:'В этой области нет построенных объектов.')
      setDrag(null)
      return
    }
    if(tool==='foundation'){
      const prepared=cells.map(cell=>({...cell,level,material:floorMaterial}))
      const valid=level===1?prepared:prepared.filter(cell=>model.cells.some(base=>(base.level??1)===level-1&&base.x===cell.x&&base.y===cell.y))
      if(!valid.length)onMessage('Пол второго этажа можно строить только над фундаментом первого этажа.')
      else onChange(applyConstructionCommand(model,{type:'add-cells',cells:valid}),valid.length<prepared.length?'Часть пола не построена: снизу нет опоры.':level===1?'Фундамент добавлен':`Пол ${level} этажа добавлен`)
    }
    else if(tool==='build-wall'){
      const prepared=walls.map(wall=>({...wall,level,material:wallMaterial})),valid=prepared.filter(wall=>wallSupported(model.cells,wall)&&!wallConflictsWithStandaloneAperture(model,wall))
      if(!valid.length)onMessage('Сначала постройте фундамент под стеной.')
      else onChange(applyConstructionCommand(model,{type:'add-walls',walls:valid}),valid.length<walls.length?'Часть стены не построена: сегмент занят проёмом или под ним нет фундамента.':valid.length===1?'Сегмент стены добавлен':`Стена: ${valid.length} сегментов`)
    }else onChange(applyConstructionCommands(model,[{type:'remove-walls',walls},{type:'remove-cells',cells}]),'Выбранная область очищена')
    setDrag(null)
  }
  const selectingFloor=tool==='select'&&(selection?.kind==='cells'||Boolean(drag&&selectionDragKind.current==='cells'))
  const dragAreaCells=drag?rectangleCells(drag.cell,drag.current):[]
  const dragAreaKeys=new Set(dragAreaCells.map(cellKey))
  const erasePreviewWalls=drag&&tool==='erase'?wallsInRectangle(visibleWalls,drag.cell,drag.current):[]
  const erasePreviewHasStairs=Boolean(drag&&tool==='erase'&&stairs.some(stair=>dragAreaKeys.has(cellKey({...stair.cell,level}))))
  const erasePreviewHasStructures=erasePreviewWalls.length>0||erasePreviewHasStairs
  const previewCells=drag&&(tool==='foundation'||selectingFloor||(tool==='erase'&&!erasePreviewHasStructures))?dragAreaCells:[]
  const previewWalls=drag&&tool==='build-wall'?lineWalls(drag.wall,drag.currentWall):tool==='build-wall'&&hoveredBuildWall?[hoveredBuildWall]:[]
  const aperturePlacement=hoveredBuildWall&&(tool==='door-aperture'||tool==='window-aperture')?{id:'preview',kind:tool==='door-aperture'?'door' as const:'window' as const,size:openingStyle==='aperture-large'?'large' as const:'small' as const,axis:hoveredBuildWall.axis,x:hoveredBuildWall.x,y:hoveredBuildWall.y,level}:null
  const aperturePlacementValid=aperturePlacement?standaloneApertureFits(model,aperturePlacement):false
  const fixtureCursorPreview=hoveredBuildWall&&(tool==='door'||tool==='window')?{id:'fixture-preview',kind:tool,size:(tool==='door'?(openingStyle==='double'||openingStyle==='sliding'):(openingStyle==='panoramic'))?'large' as const:'small' as const,axis:hoveredBuildWall.axis,x:hoveredBuildWall.x,y:hoveredBuildWall.y,level}:null
  const aperturePreviewResult=apertureDropPreview?transformStandaloneApertures(model,apertureDropPreview.ids,apertureDropPreview.dx,apertureDropPreview.dy,apertureDropPreview.quarterTurns):null
  const interactApertureFrame=(event:any,aperture:StandaloneAperture)=>{if(event.button!==0)return;event.stopPropagation();if(tool==='door'||tool==='window'){if(aperture.kind!==tool){onMessage(`Сначала выберите ${tool==='door'?'дверной':'оконный'} проём.`);return}const next=installApertureFixture(model,aperture.id,tool,openingStyle,openingMaterial);if(next===model){onMessage('Размер выбранного объекта не соответствует размеру проёма.');return}onChange(next,tool==='door'?'Дверь установлена в дверной проём.':'Окно установлено в оконный проём.');return}if(tool!=='select')return;const additive=Boolean(event.shiftKey||event.nativeEvent?.shiftKey);if(additive&&!canExtendSelection(activeSelectionKind,aperture.kind)){onMessage(SAME_KIND_SELECTION_MESSAGE);return}const current=selection?.kind==='apertures'?selection.ids:selection?.kind==='aperture'?[selection.id]:[],ids=selectKey(current,aperture.id,additive),single=singleSelection(ids);onSelect(!ids.length?null:single!==null?{kind:'aperture',id:single}:{kind:'apertures',ids});if(!additive){const start=wallDragCell(event);if(start){aperturePress.current={id:aperture.id,clientX:event.clientX,clientY:event.clientY,x:start.x,y:start.y};event.target?.setPointerCapture?.(event.pointerId)}}onMessage(`Выбран ${aperture.kind==='door'?'дверной':'оконный'} проём целиком${aperture.fixture?' вместе с установленным объектом':''}.`)}
  const previewSelectionWalls=drag&&tool==='select'&&!selectingFloor?wallsInRectangle(visibleWalls,drag.cell,drag.current):[]
  const placementOccupied=placementHover?model.cells.some(cell=>(cell.level??1)===level&&cell.x===placementHover.x&&cell.y===placementHover.y):false
  const selectCell=(event:any,cell:FoundationCell)=>{
    if(tool!=='select'||event.button!==0)return
    const additive=Boolean(event.shiftKey||event.nativeEvent?.shiftKey)
    if(additive&&!canExtendSelection(activeSelectionKind,'foundation')){event.stopPropagation();onMessage(SAME_KIND_SELECTION_MESSAGE);return}
    if(additive)return
    event.stopPropagation()
    const key=cellKey(cell)
    onSelect({kind:'cells',cellKeys:[key]})
    onMessage('Выбрано фундамента: 1 м². Shift + протягивание выделяет всю область, Delete — удалить.')
  }
  const placementSupported=placementHover?model.cells.some(cell=>(cell.level??1)===level&&cell.x===placementHover.x&&cell.y===placementHover.y):false
  const placementValid=tool==='foundation'?(level===1?!placementOccupied:model.cells.some(cell=>(cell.level??1)===level-1&&cell.x===placementHover?.x&&cell.y===placementHover?.y)&&!placementOccupied):tool==='stairs'?placementSupported&&!stairs.some(stair=>(stair.cell.level??1)===level&&stair.cell.x===placementHover?.x&&stair.cell.y===placementHover?.y):false
  const bounds=visibleCells.length?{minX:Math.min(...visibleCells.map(cell=>cell.x)),maxX:Math.max(...visibleCells.map(cell=>cell.x)),minY:Math.min(...visibleCells.map(cell=>cell.y)),maxY:Math.max(...visibleCells.map(cell=>cell.y))}:null
  const eraseSelectionCount=eraseSelection.wallKeys.length+eraseSelection.cellKeys.length+eraseSelection.openingKeys.length+eraseSelection.stairIndexes.length+(eraseSelection.roof?1:0)
  useEffect(()=>{window.dispatchEvent(new CustomEvent('domovid-erase-selection',{detail:{count:eraseSelectionCount}}))},[eraseSelectionCount])
  const toggleEraseItem=(kind:'wall'|'cell'|'opening'|'stair'|'roof',id:string|number)=>{
    const next={...eraseSelection,wallKeys:[...eraseSelection.wallKeys],cellKeys:[...eraseSelection.cellKeys],openingKeys:[...eraseSelection.openingKeys],stairIndexes:[...eraseSelection.stairIndexes]}
    if(kind==='roof')next.roof=!next.roof
    else{
      const field=kind==='wall'?'wallKeys':kind==='cell'?'cellKeys':kind==='opening'?'openingKeys':'stairIndexes'
      const list=next[field] as (string|number)[],index=list.indexOf(id)
      if(index>=0)list.splice(index,1);else list.push(id)
    }
    setEraseSelection(next)
    const count=next.wallKeys.length+next.cellKeys.length+next.openingKeys.length+next.stairIndexes.length+(next.roof?1:0)
    onMessage(count?`Выбрано для удаления: ${count}. Кликайте по другим объектам или нажмите Delete.`:'Выбор объектов для удаления снят.')
  }
  const commitEraseSelection=()=>{
    if(!eraseSelectionCount)return false
    let next=model
    for(const key of eraseSelection.openingKeys)if(!eraseSelection.wallKeys.includes(key)){const opening=next.openings?.find(item=>wallKey(item.wall)===key);if(opening)next=applyConstructionCommand(next,{type:'remove-opening',wall:opening.wall})}
    const walls=next.walls.filter(wall=>eraseSelection.wallKeys.includes(wallKey(wall)))
    if(walls.length)next=applyConstructionCommand(next,{type:'remove-walls',walls})
    const cells=next.cells.filter(cell=>eraseSelection.cellKeys.includes(cellKey(cell)))
    if(cells.length)next=applyConstructionCommand(next,{type:'remove-cells',cells})
    for(const index of [...eraseSelection.stairIndexes].sort((a,b)=>b-a))next=applyConstructionCommand(next,{type:'remove-stair',index})
    if(eraseSelection.roof)next=applyConstructionCommand(next,{type:'set-roof',roof:false})
    onSelect(null);onChange(next,`Удалено выбранных объектов: ${eraseSelectionCount}.`);setEraseSelection(emptyEraseSelection())
    return true
  }
  const eraseClick=(event:any,kind:'wall'|'cell'|'opening'|'stair'|'roof',id:string|number,_single:()=>void)=>{
    event.stopPropagation()
    toggleEraseItem(kind,id)
  }
  useEffect(()=>{
    const handleEraseKeys=(event:KeyboardEvent)=>{
      if(tool!=='erase'||!eraseSelectionCount)return
      const target=event.target as HTMLElement|null
      if(target?.closest('input, textarea, select, [contenteditable="true"]'))return
      if(event.key==='Delete'||event.key==='Backspace'){
        event.preventDefault();event.stopImmediatePropagation();commitEraseSelection()
      }else if(event.key==='Escape'){
        event.preventDefault();setEraseSelection(emptyEraseSelection())
      }
    }
    window.addEventListener('keydown',handleEraseKeys,true)
    const commit=()=>commitEraseSelection()
    window.addEventListener('domovid-commit-erase',commit)
    return()=>{window.removeEventListener('keydown',handleEraseKeys,true);window.removeEventListener('domovid-commit-erase',commit)}
  },[tool,eraseSelectionCount,eraseSelection,model])
  const stairTarget=(event:any,index:number)=>{const hit=event.ray?.intersectPlane(stairDragPlane,new Vector3()),stair=stairs[index],stairLevel=stair.cell.level??1;if(!hit)return {x:stair.cell.x,y:stair.cell.y,valid:false,supported:false,occupied:false};const rawX=Math.max(.001,Math.min(width-.001,hit.x+width/2)),rawY=Math.max(.001,Math.min(depth-.001,hit.z+depth/2)),x=Math.floor(rawX),y=Math.floor(rawY),supported=model.cells.some(cell=>(cell.level??1)===stairLevel&&cell.x===x&&cell.y===y),occupied=stairs.some((item,itemIndex)=>itemIndex!==index&&(item.cell.level??1)===stairLevel&&item.cell.x===x&&item.cell.y===y);return {x,y,valid:supported&&!occupied,supported,occupied}}
  const interactStair=(event:any,index:number)=>{if(event.button!==0)return;if(tool==='erase'){eraseClick(event,'stair',index,()=>onChange(applyConstructionCommand(model,{type:'remove-stair',index}),'Лестница удалена, фундамент сохранён.'))}else if(tool==='stairs'){event.stopPropagation();onChange(applyConstructionCommand(model,{type:'update-stair',index,change:{rotation:((((stairs[index].rotation??0)+90)%360) as 0|90|180|270)}}),'Лестница повёрнута на 90°.')}else if(tool==='select'){event.stopPropagation();const additive=Boolean(event.shiftKey||event.nativeEvent?.shiftKey);if(additive){if(!canExtendSelection(activeSelectionKind,'stair')){onMessage(SAME_KIND_SELECTION_MESSAGE);return}const current=selection?.kind==='stairs'?selection.indexes:selection?.kind==='stair'?[selection.index]:[],indexes=selectKey(current,index,true),single=singleSelection(indexes);onSelect(!indexes.length?null:single!==null?{kind:'stair',index:single}:{kind:'stairs',indexes});onMessage(indexes.length?`Выбрано лестниц: ${indexes.length}. Shift + клик добавляет или убирает, Delete — удалить.`:'Выделение лестниц снято.');return}event.target?.setPointerCapture?.(event.pointerId);setHoveredCell(null);setHoveredWall(null);setHoveredRoof(false);setHoveredBuildWall(null);setPlacementHover(null);onSelect({kind:'stair',index});stairPress.current={index,clientX:event.clientX,clientY:event.clientY};const shape=stairs[index].shape;onMessage(`Выбрана лестница: ${shape==='straight'?'прямая':shape==='l'?'Г-образная':shape==='u'?'П-образная':'винтовая'}. Перетащите для перемещения.`)}}
  const dragStair=(event:any,index:number)=>{if(tool!=='select')return;const press=stairPress.current;if(stairDropPreview?.index!==index){if(!press||press.index!==index||!hasPointerDrag({x:press.clientX,y:press.clientY},{x:event.clientX,y:event.clientY}))return;setHoveredStair(null)}event.stopPropagation();const target=stairTarget(event,index);setStairDropPreview({index,x:target.x,y:target.y,valid:target.valid,rotation:stairDropPreview?.rotation??stairs[index].rotation??0})}
  const finishStairMove=(event:any,index:number)=>{if(tool!=='select'||stairPress.current?.index!==index)return;event.stopPropagation();event.target?.releasePointerCapture?.(event.pointerId);stairPress.current=null;if(stairDropPreview?.index!==index){setStairDropPreview(null);return}const preview=stairDropPreview,target=stairTarget(event,index),stair=stairs[index],stairLevel=stair.cell.level??1;setStairDropPreview(null);if(!target.valid){onMessage(target.occupied?'Эта клетка уже занята другой лестницей.':`Лестницу можно поставить только на пол ${stairLevel} этажа.`);return}if(stair.cell.x===target.x&&stair.cell.y===target.y&&(stair.rotation??0)===preview.rotation)return;onChange(applyConstructionCommand(model,{type:'update-stair',index,change:{cell:{x:target.x,y:target.y,level:stairLevel},rotation:preview.rotation}}),`Лестница перемещена: x ${target.x+1}, y ${target.y+1}, поворот ${preview.rotation}°.`)}
  const wallDragCell=(event:any)=>{const hit=event.ray?.intersectPlane(wallDragPlane,new Vector3());if(!hit)return null;return {x:Math.floor(Math.max(.001,Math.min(width-.001,hit.x+width/2))),y:Math.floor(Math.max(.001,Math.min(depth-.001,hit.z+depth/2)))}}
  const beginWallMove=(event:any,wallKeys:string[])=>{const start=wallDragCell(event);if(!start||!wallKeys.length)return;event.target?.setPointerCapture?.(event.pointerId);setHoveredCell(null);setHoveredWall(null);setHoveredStair(null);setHoveredRoof(false);setHoveredBuildWall(null);setPlacementHover(null);setWallDropPreview({pointerId:event.pointerId,wallKeys,startX:start.x,startY:start.y,dx:0,dy:0,quarterTurns:0,valid:true})}
  const dragSelectedWalls=(event:any)=>{if(!wallDropPreview||event.pointerId!==wallDropPreview.pointerId)return false;event.stopPropagation();const target=wallDragCell(event);if(!target)return true;const dx=target.x-wallDropPreview.startX,dy=target.y-wallDropPreview.startY,selectedWalls=model.walls.filter(wall=>wallDropPreview.wallKeys.includes(wallKey(wall))),valid=Boolean(transformConstructionWalls(model,selectedWalls,dx,dy,wallDropPreview.quarterTurns));setWallDropPreview({...wallDropPreview,dx,dy,valid});return true}
  const finishWallMove=(event:any)=>{if(!wallDropPreview||event.pointerId!==wallDropPreview.pointerId)return false;event.stopPropagation();event.target?.releasePointerCapture?.(event.pointerId);const preview=wallDropPreview,target=wallDragCell(event),dx=target?target.x-preview.startX:preview.dx,dy=target?target.y-preview.startY:preview.dy,selectedWalls=model.walls.filter(wall=>preview.wallKeys.includes(wallKey(wall)));wallSelectionPaint.current=null;setWallDropPreview(null);if(!dx&&!dy&&!preview.quarterTurns)return true;const result=transformConstructionWalls(model,selectedWalls,dx,dy,preview.quarterTurns);if(!result){onMessage('Стены нельзя поставить сюда: нет опоры, место занято или поворот выходит за границы.');return true}onSelect({kind:'walls',wallKeys:result.walls.map(wallKey)});onChange(result.model,`Перемещено стен: ${selectedWalls.length}. Поворот placeholder: ${preview.quarterTurns*90}°. Окна и двери перемещены вместе с ними.`);return true}
  const dragApertureFrame=(event:any)=>{const press=aperturePress.current;if(!press||tool!=='select'||!hasPointerDrag({x:press.clientX,y:press.clientY},{x:event.clientX,y:event.clientY}))return;event.stopPropagation();const target=wallDragCell(event);if(!target)return;const ids=selection?.kind==='apertures'&&selection.ids.includes(press.id)?selection.ids:[press.id],dx=target.x-press.x,dy=target.y-press.y,quarterTurns=apertureDropPreview?.quarterTurns??0,valid=Boolean(transformStandaloneApertures(model,ids,dx,dy,quarterTurns));setApertureDropPreview({pointerId:event.pointerId,ids,startX:press.x,startY:press.y,clientX:event.clientX,clientY:event.clientY,dx,dy,quarterTurns,valid})}
  const finishApertureFrameDrag=(event:any)=>{if(!aperturePress.current)return;event.stopPropagation();event.target?.releasePointerCapture?.(event.pointerId);if(apertureDropPreview){const result=transformStandaloneApertures(model,apertureDropPreview.ids,apertureDropPreview.dx,apertureDropPreview.dy,apertureDropPreview.quarterTurns);if(result){onChange(result.model,'Проём перемещён.');onSelect(result.apertures.length===1?{kind:'aperture',id:result.apertures[0].id}:{kind:'apertures',ids:result.apertures.map(item=>item.id)})}else onMessage('Проём нельзя установить в выбранном месте.')}aperturePress.current=null;setApertureDropPreview(null)}
  const wallPreviewTransform=wallDropPreview?transformConstructionWalls(model,model.walls.filter(wall=>wallDropPreview.wallKeys.includes(wallKey(wall))),wallDropPreview.dx,wallDropPreview.dy,wallDropPreview.quarterTurns):null
  const wallPreviewKeys=new Set((wallPreviewTransform?.walls??[]).map(wallKey))
  const wallPreviewOpenings=(wallPreviewTransform?.model.openings??[]).filter(opening=>constructionOpeningWalls(opening).every(wall=>wallPreviewKeys.has(wallKey(wall))))
  return <group>
    {level>1&&model.cells.filter(cell=>(cell.level??1)===level-1).map(cell=><mesh key={`limit:${cell.x}:${cell.y}`} position={[cell.x-width/2+.5,.015,cell.y-depth/2+.5]}><boxGeometry args={[.92,.025,.92]}/><meshBasicMaterial color="#c8bca9" transparent opacity={.2}/></mesh>)}
    {visibleCells.filter(cell=>!stairs.some(stair=>(stair.cell.level??1)===level-1&&stair.cell.x===cell.x&&stair.cell.y===cell.y)).map(cell=>{
      const key=cellKey(cell),selected=selection?.kind==='cells'&&selection.cellKeys.includes(key),hovered=tool==='select'&&!objectDragActive&&hoveredCell===key
      return <mesh key={key} position={[cell.x-width/2+.5,.08,cell.y-depth/2+.5]} receiveShadow onPointerDown={event=>selectCell(event,cell)} onPointerOver={event=>{if(tool==='select'&&!objectDragActive){if(!drag)event.stopPropagation();setHoveredCell(key)}}} onPointerOut={()=>setHoveredCell(current=>current===key?null:current)}>
        <FoundationSlab selected={selected} hovered={hovered} material={cell.material}/>
        {selected&&<group position={[0,.105,0]}>
          <Line points={[[2e-2,0,2e-2],[.98,0,2e-2],[.98,0,.98],[2e-2,0,.98],[2e-2,0,2e-2]]} position={[-.5,0,-.5]} color={objectStateBlueBorder} lineWidth={1.6} depthTest={false}/>
          <Line points={[[-.46,0,-.46],[.46,0,.46]]} color={objectStateBlueBorder} lineWidth={1.15} depthTest={false}/>
          <Line points={[[-.46,0,.46],[.46,0,-.46]]} color={objectStateBlueBorder} lineWidth={1.15} depthTest={false}/>
        </group>}
      </mesh>
    })}
    {stairs.map((stair,index)=>{
      const stairLevel=stair.cell.level??1,x=stair.cell.x-width/2+.5,z=stair.cell.y-depth/2+.5,rotation=(stair.rotation??0)*Math.PI/180
      if(level===stairLevel+1)return <group key={`stair-opening:${index}`} position={[x,.12,z]} rotation={[0,rotation,0]}><StairOpening/></group>
      if(level!==stairLevel)return null
      const active=(selection?.kind==='stair'&&selection.index===index)||(selection?.kind==='stairs'&&selection.indexes.includes(index)),eraseActive=tool==='erase'&&eraseSelection.stairIndexes.includes(index),hovered=!objectDragActive&&(tool==='select'||tool==='erase')&&hoveredStair===index,eraseHovered=tool==='erase'&&hovered
      return <group key={`stair:${index}`} position={[x,.12,z]} rotation={[0,rotation,0]} onPointerOver={event=>{if(!objectDragActive&&(tool==='select'||tool==='erase')){event.stopPropagation();setHoveredStair(index);if(tool==='erase')setPlacementHover(null)}}} onPointerOut={()=>setHoveredStair(current=>current===index?null:current)} onPointerDown={event=>interactStair(event,index)} onPointerMove={event=>dragStair(event,index)} onPointerUp={event=>finishStairMove(event,index)} onPointerCancel={()=>{stairPress.current=null;setStairDropPreview(null)}}><StairSteps shape={stair.shape} color={eraseActive?'#a33b3b':active?objectStateBlue:eraseHovered?'#b86a58':hovered?objectHoverColor:'#8d6847'} emissive={eraseActive?'#641d16':active?objectStateBlueEmissive:eraseHovered?'#5a2219':hovered?objectHoverEmissive:'#000000'} emissiveIntensity={eraseActive?.45:active?.35:hovered?.22:0}/></group>
    })}
    {stairDropPreview&&<group position={[stairDropPreview.x-width/2+.5,.16,stairDropPreview.y-depth/2+.5]} rotation={[0,stairDropPreview.rotation*Math.PI/180,0]}><mesh><boxGeometry args={[.86,.86,.86]}/><meshBasicMaterial color={stairDropPreview.valid?objectStateBlueBorder:objectStateInvalidBorder} wireframe transparent opacity={.96} depthTest={false}/></mesh></group>}
    {apertures.map(aperture=>{const geometry=standaloneApertureFixtureGeometry(aperture),span=geometry.span,placementPreview=!aperture.fixture&&(tool==='door'||tool==='window')&&standaloneApertureAcceptsFixture(aperture,tool,openingStyle)&&hoveredAperture===aperture.id,height=aperture.fixture||placementPreview?geometry.height:0,bottom=geometry.bottom,x=aperture.axis==='h'?aperture.x-width/2+span/2:aperture.x-width/2,z=aperture.axis==='h'?aperture.y-depth/2:aperture.y-depth/2+span/2,selected=(selection?.kind==='fixture'&&selection.id===aperture.id)||(selection?.kind==='fixtures'&&selection.ids.includes(aperture.id)),hovered=shouldHighlightStandaloneAperture(tool,aperture.kind,objectDragActive)&&hoveredFixture===aperture.id,color=selected?'#2c6570':hovered?objectHoverColor:aperture.kind==='door'?'#bb6b3f':'#3a8fa3';const act=(event:any)=>{if(event.button!==0)return;event.stopPropagation();if(tool==='door'||tool==='window'){if(aperture.kind!==tool){onMessage(`Сначала выберите ${tool==='door'?'дверной':'оконный'} проём.`);return}const next=installApertureFixture(model,aperture.id,tool,openingStyle,openingMaterial);onChange(next,tool==='door'?'Дверь установлена в дверной проём.':'Окно установлено в оконный проём.');return}if(tool!=='select')return;const additive=Boolean(event.shiftKey||event.nativeEvent?.shiftKey);if(additive&&!canExtendSelection(activeSelectionKind,aperture.kind)){onMessage(SAME_KIND_SELECTION_MESSAGE);return}const current=selection?.kind==='apertures'?selection.ids:selection?.kind==='aperture'?[selection.id]:[],ids=selectKey(current,aperture.id,additive),single=singleSelection(ids);onSelect(!ids.length?null:single!==null?{kind:'aperture',id:single}:{kind:'apertures',ids});if(!additive){const p=groundPoint(event);aperturePress.current={id:aperture.id,clientX:event.clientX,clientY:event.clientY,x:p.cell.x,y:p.cell.y};event.target?.setPointerCapture?.(event.pointerId)}onMessage(`Выбрано проёмов: ${ids.length}. Shift + клик добавляет проёмы того же вида.`)};const dragMove=(event:any)=>{const press=aperturePress.current;if(!press||tool!=='select'||!hasPointerDrag({x:press.clientX,y:press.clientY},{x:event.clientX,y:event.clientY}))return;event.stopPropagation();const p=groundPoint(event),ids=selection?.kind==='apertures'&&selection.ids.includes(press.id)?selection.ids:[press.id],dx=p.cell.x-press.x,dy=p.cell.y-press.y,quarterTurns=apertureDropPreview?.quarterTurns??0,valid=Boolean(transformStandaloneApertures(model,ids,dx,dy,quarterTurns));setApertureDropPreview({pointerId:event.pointerId,ids,startX:press.x,startY:press.y,clientX:event.clientX,clientY:event.clientY,dx,dy,quarterTurns,valid})};const dragEnd=(event:any)=>{if(!aperturePress.current)return;event.stopPropagation();if(apertureDropPreview){const result=transformStandaloneApertures(model,apertureDropPreview.ids,apertureDropPreview.dx,apertureDropPreview.dy,apertureDropPreview.quarterTurns);if(result){onChange(result.model,'Проём перемещён.');onSelect(result.apertures.length===1?{kind:'aperture',id:result.apertures[0].id}:{kind:'apertures',ids:result.apertures.map(item=>item.id)})}else onMessage('Проём нельзя установить в выбранном месте.')}aperturePress.current=null;setApertureDropPreview(null)};return <group key={aperture.id} position={[x,bottom+height/2,z]} onPointerOver={event=>{if(placementPreview){event.stopPropagation();setHoveredFixture(null);setHoveredAperture(aperture.id)}else if(aperture.fixture&&shouldHighlightStandaloneAperture(tool,aperture.kind,objectDragActive)){event.stopPropagation();setHoveredAperture(null);setHoveredFixture(aperture.id)}else setHoveredFixture(null)}} onPointerOut={()=>{setHoveredFixture(current=>current===aperture.id?null:current);if(placementPreview)setHoveredAperture(current=>current===aperture.id?null:current)}} onPointerDown={act} onPointerMove={dragMove} onPointerUp={dragEnd}><mesh><boxGeometry args={aperture.axis==='h'?[geometry.width,height,geometry.depth]:[geometry.depth,height,geometry.width]}/>{aperture.fixture?<meshStandardMaterial color={selected?objectStateBlue:hovered?objectHoverColor:aperture.kind==='door'?(aperture.fixture.material==='metal'?'#6e7478':aperture.fixture.material==='glass'?'#76a9b5':'#8a4b32'):(aperture.fixture.material==='metal'?'#78929b':aperture.fixture.material==='wood'?'#8d6847':'#6ca9bb')} transparent={aperture.kind==='window'||aperture.fixture.material==='glass'} opacity={aperture.kind==='window'||aperture.fixture.material==='glass'?.68:1}/>:placementPreview?<meshBasicMaterial color={objectStateBlue} transparent opacity={.58} depthTest={false}/>:<meshBasicMaterial color={color} wireframe transparent opacity={0}/>}</mesh></group>})}
    {apertures.map(aperture=>{const span=aperture.size==='large'?2:1,panoramic=aperture.fixture?.style==='panoramic'||aperture.size==='large',cutHeight=aperture.kind==='door'?2.05:panoramic?2.5:.92,cutBottom=aperture.kind==='door'?0:panoramic?.11:.9,x=aperture.axis==='h'?aperture.x-width/2+span/2:aperture.x-width/2,z=aperture.axis==='h'?aperture.y-depth/2:aperture.y-depth/2+span/2,fixturePreviewAllowed=(tool==='door'||tool==='window')&&standaloneApertureAcceptsFixture(aperture,tool,openingStyle),selected=(selection?.kind==='aperture'&&selection.id===aperture.id)||(selection?.kind==='apertures'&&selection.ids.includes(aperture.id)),hovered=tool==='select'&&!objectDragActive&&hoveredAperture===aperture.id,wallLikeColor=aperture.material==='brick'?'#a95f45':aperture.material==='frame'?'#b79768':aperture.material==='timber'?'#a87549':'#d6c7ad';return <group key={`aperture-frame:${aperture.id}`} position={[x,1.35,z]} onPointerDown={event=>interactApertureFrame(event,aperture)} onPointerMove={dragApertureFrame} onPointerUp={finishApertureFrameDrag} onPointerCancel={()=>{aperturePress.current=null;setApertureDropPreview(null)}} onPointerOver={event=>{if((tool==='select'&&!objectDragActive)||fixturePreviewAllowed){event.stopPropagation();setHoveredBuildWall(null);setHoveredFixture(null);setHoveredAperture(aperture.id)}else setHoveredAperture(null)}} onPointerOut={()=>setHoveredAperture(current=>current===aperture.id?null:current)}><ApertureFrame axis={aperture.axis} span={span} cutHeight={cutHeight} cutBottom={cutBottom} kind={aperture.kind} filled={Boolean(aperture.fixture)} color={selected?objectStateBlue:hovered?objectHoverColor:wallLikeColor}/>{selected&&<ApertureFrame axis={aperture.axis} span={span} cutHeight={cutHeight} cutBottom={cutBottom} kind={aperture.kind} color={objectStateBlueBorder} outlineOnly/>}</group>})}
    {apertures.filter(aperture=>aperture.fixture).map(aperture=>{const geometry=standaloneApertureFixtureGeometry(aperture),span=geometry.span,x=aperture.axis==='h'?aperture.x-width/2+span/2:aperture.x-width/2,z=aperture.axis==='h'?aperture.y-depth/2:aperture.y-depth/2+span/2,selected=(selection?.kind==='fixture'&&selection.id===aperture.id)||(selection?.kind==='fixtures'&&selection.ids.includes(aperture.id));return <mesh key={`fixture-hit:${aperture.id}`} position={[x,geometry.bottom+geometry.height/2,z]} onPointerOver={event=>{if(shouldHighlightStandaloneAperture(tool,aperture.kind,objectDragActive)){event.stopPropagation();setHoveredAperture(null);setHoveredFixture(aperture.id)}else setHoveredFixture(null)}} onPointerOut={()=>setHoveredFixture(current=>current===aperture.id?null:current)} onPointerDown={event=>{if(tool!=='select'||event.button!==0)return;event.stopPropagation();const additive=Boolean(event.shiftKey||event.nativeEvent?.shiftKey);if(additive&&!canExtendSelection(activeSelectionKind,aperture.kind)){onMessage(SAME_KIND_SELECTION_MESSAGE);return}const current=selection?.kind==='fixtures'?selection.ids:selection?.kind==='fixture'?[selection.id]:[],ids=selectKey(current,aperture.id,additive),single=singleSelection(ids);onSelect(!ids.length?null:single!==null?{kind:'fixture',id:single}:{kind:'fixtures',ids});onMessage(`${aperture.kind==='door'?'Дверь':'Окно'} выбрано отдельно от проёма. Delete удалит только ${aperture.kind==='door'?'дверь':'окно'}.`)}}><boxGeometry args={aperture.axis==='h'?[geometry.width,geometry.height,.1]:[.1,geometry.height,geometry.width]}/><meshBasicMaterial color="#8ed5df" wireframe={selected} transparent opacity={selected?.48:0} depthWrite={false}/></mesh>})}
    {aperturePreviewResult?.apertures.map(aperture=>{const span=aperture.size==='large'?2:1,cutHeight=aperture.kind==='door'?2.05:aperture.size==='large'?2.5:.92,cutBottom=aperture.kind==='door'?0:aperture.size==='large'?.11:.9,x=aperture.axis==='h'?aperture.x-width/2+span/2:aperture.x-width/2,z=aperture.axis==='h'?aperture.y-depth/2:aperture.y-depth/2+span/2;return <group key={`aperture-preview:${aperture.id}`} position={[x,1.35,z]}><ApertureFrame axis={aperture.axis} span={span} cutHeight={cutHeight} cutBottom={cutBottom} kind={aperture.kind} outlineOnly color={apertureDropPreview?.valid?objectStateBlueBorder:objectStateInvalidBorder}/></group>})}
    {visibleWalls.map(wall=>{
      const key=wallKey(wall),opening=openings.find(item=>wallKey(item.wall)===key),coveringOpening=openings.find(item=>constructionOpeningWalls(item).some(segment=>wallKey(segment)===key)),coveringOpeningKey=coveringOpening?wallKey(coveringOpening.wall):null
      const isSelectedWall=selection?.kind==='walls'&&selection.wallKeys.includes(key),isSelectedOpening=(selection?.kind==='opening'&&selection.wallKey===key)||(selection?.kind==='openings'&&selection.wallKeys.includes(key))
      const wallHighlighted=shouldHighlightWall({objectDragActive,hasOpening:Boolean(coveringOpening),tool:tool==='door-aperture'||tool==='window-aperture'?null:tool,isHovered:hoveredWall===key})
      const openingHighlighted=shouldHighlightOpening({objectDragActive,hasOpening:Boolean(coveringOpening),isCoveredSegmentHovered:Boolean(coveringOpening&&constructionOpeningWalls(coveringOpening).some(segment=>wallKey(segment)===hoveredWall))})
      const position=wall.axis==='h'?[wall.x-width/2+.5,0,wall.y-depth/2] as const:[wall.x-width/2,0,wall.y-depth/2+.5] as const
      const materialColor=wall.material==='brick'?'#a95f45':wall.material==='frame'?'#b79768':wall.material==='timber'?'#a87549':'#d6c7ad'
      const selectWallsUnderOpening=(target:ConstructionOpening,additive:boolean)=>{
        if(additive&&!canExtendSelection(activeSelectionKind,'wall')){onMessage(SAME_KIND_SELECTION_MESSAGE);return}
        const coveredKeys=constructionOpeningWalls(target).map(wallKey)
        const current=selection?.kind==='walls'?selection.wallKeys:[]
        const wallKeys=selectCoveredWallKeys(current,coveredKeys,additive)
        wallPaintKeys.current=wallKeys
        onSelect(wallKeys.length?{kind:'walls',wallKeys}:null)
        onMessage(wallKeys.length?`Выбрано стен под проёмом: ${coveredKeys.length}.`:'Выделение стен снято.')
      }
      const act=(event:any)=>{
        if(event.button!==0||!tool)return
        if(tool==='select'){
          event.stopPropagation()
          if(movingOpening){onMoveOpening(wall);return}
          const additive=Boolean(event.shiftKey||event.nativeEvent?.shiftKey)
          const wantsWall=Boolean(event.altKey||event.nativeEvent?.altKey)
          const selectedWallKeys=selection?.kind==='walls'?selection.wallKeys:[]
          if(shouldDragSelectedWallsFromOpening({additive,wantsWall,selectionKind:selection?.kind??null,coveredWallKeys:[key],selectedWallKeys})){
            beginWallMove(event,selectedWallKeys)
            onMessage(`Перемещение выбранных стен: ${selectedWallKeys.length}. Двери и окна останутся на стенах.`)
            return
          }
          if(coveringOpening&&wantsWall){selectWallsUnderOpening(coveringOpening,additive);return}
          if(coveringOpening&&!wantsWall&&coveringOpeningKey){
            if(additive){
              if(!canExtendSelection(activeSelectionKind,coveringOpening.kind)){onMessage(SAME_KIND_SELECTION_MESSAGE);return}
              const current=selection?.kind==='openings'?selection.wallKeys:selection?.kind==='opening'?[selection.wallKey]:[]
              const result=selectSameKind(current,coveringOpeningKey,true,item=>openings.find(candidate=>wallKey(candidate.wall)===item)?.kind)
              if(!result.accepted){onMessage(SAME_KIND_SELECTION_MESSAGE);return}
              const wallKeys=result.keys,single=singleSelection(wallKeys)
              onSelect(!wallKeys.length?null:single!==null?{kind:'opening',wallKey:single}:{kind:'openings',wallKeys})
              onMessage(wallKeys.length?`Выбрано ${coveringOpening.kind==='door'?'дверей':'окон'}: ${wallKeys.length}.`:'Выделение снято.')
            }else{
              onSelect({kind:'opening',wallKey:coveringOpeningKey})
              onMessage(`${coveringOpening.kind==='door'?'Дверь':'Окно'} выбрано. Alt + клик выбирает стену под проёмом.`)
            }
            return
          }
          if(additive&&!canExtendSelection(activeSelectionKind,'wall')){onMessage(SAME_KIND_SELECTION_MESSAGE);return}
          const current=selection?.kind==='walls'?selection.wallKeys:[]
          if(opening&&!additive&&!current.includes(key)){onSelect({kind:'opening',wallKey:key});onMessage(opening.kind==='door'?'Дверь выбрана. Delete — удалить.':'Окно выбрано. Delete — удалить.')}
          else{
            wallSelectionPaint.current=additive&&current.includes(key)?'remove':'add'
            const wallKeys=!additive&&current.includes(key)?current:updateWallSelection(current,key,additive)
            wallPaintKeys.current=wallKeys
            onSelect(wallKeys.length?{kind:'walls',wallKeys}:null)
            if(!additive&&wallKeys.length)beginWallMove(event,wallKeys)
            onMessage(wallKeys.length?`Выбрано стен: ${wallKeys.length}. Shift + клик — добавить или убрать, Delete — удалить.`:'Выделение стен снято.')
          }
          return
        }
        if(tool==='door'||tool==='window'){event.stopPropagation();onMessage(tool==='door'?'Сначала поставьте дверной проём, затем нажмите на него инструментом «Дверь».':'Сначала поставьте оконный проём, затем нажмите на него инструментом «Окно».');return}
        if(tool==='erase')eraseClick(event,'wall',key,()=>{onChange(applyConstructionCommand(model,{type:'remove-walls',walls:[wall]}),'Стена и её проёмы удалены');setHoveredWall(null)})
      }
      const paintSelection=(event:any)=>{
        if(tool!=='select'||!wallSelectionPaint.current)return
        event.stopPropagation()
        const current=wallPaintKeys.current
        const isSelected=current.includes(key)
        if((wallSelectionPaint.current==='add'&&isSelected)||(wallSelectionPaint.current==='remove'&&!isSelected))return
        const wallKeys=updateWallSelection(current,key,true)
        wallPaintKeys.current=wallKeys
        onSelect(wallKeys.length?{kind:'walls',wallKeys}:null)
        onMessage(wallKeys.length?`Выбрано стен: ${wallKeys.length}. Протяните дальше или отпустите кнопку мыши.`:'Выделение стен снято.')
      }
      const openingWidth=opening?constructionOpeningWidth(opening):1
      const openingHeight=opening?.kind==='door'?2.05:(opening?.style==='panoramic'||opening?.style==='aperture-large'?1.5:.92),openingBottom=opening?.kind==='door'?0:(opening?.style==='panoramic'||opening?.style==='aperture-large'?.35:.82)
      const openingCenter=opening&&openingWidth===2?(opening.spanDirection??1)*.5:0
      const openingPosition=wall.axis==='h'?[position[0]+openingCenter,openingBottom+openingHeight/2,position[2]] as const:[position[0],openingBottom+openingHeight/2,position[2]+openingCenter] as const
      const coveringHeight=coveringOpening?.kind==='door'?2.05:(coveringOpening?.style==='panoramic'||coveringOpening?.style==='aperture-large'?1.5:.92),coveringBottom=coveringOpening?.kind==='door'?0:(coveringOpening?.style==='panoramic'||coveringOpening?.style==='aperture-large'?.35:.82)
      const cut=coveringOpening?[{center:0,width:1,bottom:coveringBottom,height:coveringHeight}]:[]
      const movingWidth=movingSourceOpening?constructionOpeningWidth(movingSourceOpening):1
      const movingHeight=movingSourceOpening?.kind==='door'?2.05:(movingSourceOpening?.style==='panoramic'||movingSourceOpening?.style==='aperture-large'?1.5:.92),movingBottom=movingSourceOpening?.kind==='door'?0:(movingSourceOpening?.style==='panoramic'||movingSourceOpening?.style==='aperture-large'?.35:.82)
      const previewOpening=openingDropPreview?.opening,previewCenter=previewOpening&&movingWidth===2?(previewOpening.spanDirection??1)*.5:0
      const previewPosition=wall.axis==='h'?[position[0]+previewCenter,movingBottom+movingHeight/2,position[2]] as const:[position[0],movingBottom+movingHeight/2,position[2]+previewCenter] as const
      const previewCandidate=movingSourceOpening?fitConstructionOpening(model,{...movingSourceOpening,wall,spanDirection:undefined},movingSourceOpening):null
      const showDropPreview=Boolean(movingOpening&&movingSourceOpening&&openingDropPreview?.wallKey===key)
      const updateDropPreview=(event:any)=>{let dragging=movingOpening;const press=openingPress.current;if(press&&!dragging&&hasPointerDrag({x:press.clientX,y:press.clientY},{x:event.clientX,y:event.clientY})){setHoveredCell(null);setHoveredWall(null);setHoveredStair(null);setHoveredRoof(false);setHoveredBuildWall(null);setPlacementHover(null);onStartMovingOpening(press.wall);openingPress.current=null;openingDragStarted.current=true;dragging=true}if(!dragging)return;event.stopPropagation();setOpeningDropPreview({wallKey:key,opening:previewCandidate})}
      const interactOpening=(event:any)=>{
        if(!opening||event.button!==0)return
        if(tool==='select'&&movingOpening){event.stopPropagation();onMoveOpening(wall);return}
        if(tool==='select'){
          event.stopPropagation()
          const additive=Boolean(event.shiftKey||event.nativeEvent?.shiftKey)
          const wantsWall=Boolean(event.altKey||event.nativeEvent?.altKey)
          const coveredWallKeys=constructionOpeningWalls(opening).map(wallKey)
          const selectedWallKeys=selection?.kind==='walls'?selection.wallKeys:[]
          if(shouldDragSelectedWallsFromOpening({additive,wantsWall,selectionKind:selection?.kind??null,coveredWallKeys,selectedWallKeys})){
            beginWallMove(event,selectedWallKeys)
            onMessage(`Перемещение выбранных стен: ${selectedWallKeys.length}. Проём переместится вместе со стеной.`)
            return
          }
          if(openingClickTarget(wantsWall)==='wall'){
            selectWallsUnderOpening(opening,additive)
            return
          }
          if(additive){
            if(!canExtendSelection(activeSelectionKind,opening.kind)){onMessage(SAME_KIND_SELECTION_MESSAGE);return}
            const current=selection?.kind==='openings'?selection.wallKeys:selection?.kind==='opening'?[selection.wallKey]:[]
            const result=selectSameKind(current,key,true,item=>openings.find(candidate=>wallKey(candidate.wall)===item)?.kind)
            if(!result.accepted){onMessage(SAME_KIND_SELECTION_MESSAGE);return}
            const wallKeys=result.keys,single=singleSelection(wallKeys)
            onSelect(!wallKeys.length?null:single!==null?{kind:'opening',wallKey:single}:{kind:'openings',wallKeys})
            onMessage(wallKeys.length?`Выбрано ${opening.kind==='door'?'дверей':'окон'}: ${wallKeys.length}. Shift + клик добавляет или убирает, Delete — удалить.`:'Выделение снято.')
            return
          }
          onSelect({kind:'opening',wallKey:key});openingPress.current={wall,clientX:event.clientX,clientY:event.clientY};openingDragStarted.current=false;onMessage(`${opening.kind==='door'?'Дверь':'Окно'} выбрано. Shift + клик добавляет проёмы, Alt + клик выбирает стену.`);return
        }
        if(tool!=='erase')return
        eraseClick(event,'opening',key,()=>onChange(applyConstructionCommand(model,{type:'remove-opening',wall}),opening.kind==='door'?'Дверь удалена':'Окно удалено'))
      }
      return <group key={key} onPointerOver={event=>{if(!objectDragActive&&tool==='select'&&!movingOpening){if(!drag)event.stopPropagation();setHoveredWall(key);if(!drag)paintSelection(event)}if(movingOpening)updateDropPreview(event);else if(!objectDragActive&&(tool==='erase'||tool==='door'||tool==='window')){event.stopPropagation();setHoveredWall(key);if(tool==='erase')setPlacementHover(null)}}} onPointerMove={event=>{if(!dragSelectedWalls(event))updateDropPreview(event)}} onPointerOut={()=>{if(!objectDragActive)setHoveredWall(null);if(openingDropPreview?.wallKey===key)setOpeningDropPreview(null)}} onPointerDown={act} onPointerUp={event=>{if(finishWallMove(event))return;if(tool!=='select'||event.button!==0)return;if(openingPress.current){event.stopPropagation();openingPress.current=null;return}if(movingOpening||openingDragStarted.current){event.stopPropagation();openingDragStarted.current=false;onMoveOpening(wall)}}} onPointerCancel={event=>{if(wallDropPreview?.pointerId===event.pointerId)setWallDropPreview(null)}}>
        <WallWithOpenings length={1} height={2.7} base={0} x={position[0]} z={position[2]} vertical={wall.axis==='v'} color={eraseSelection.wallKeys.includes(key)?'#a33b3b':isSelectedWall?objectStateBlue:wallHighlighted?objectHoverColor:materialColor} cuts={cut}/>
        {(isSelectedWall||eraseSelection.wallKeys.includes(key))&&<mesh position={[position[0],1.35,position[2]]}><boxGeometry args={wall.axis==='h'?[1.06,2.76,.19]:[.19,2.76,1.06]}/><meshBasicMaterial color={eraseSelection.wallKeys.includes(key)?objectStateInvalidBorder:objectStateBlueBorder} wireframe transparent opacity={.9} depthTest={false}/></mesh>}
        {opening&&<group position={openingPosition} onPointerDown={interactOpening}>
          <OpeningPanel axis={wall.axis} width={openingWidth} height={openingHeight} color={opening.style?.startsWith('aperture-')?(isSelectedOpening?'#2c6570':opening.kind==='door'?'#d8894d':'#358fa5'):(eraseSelection.openingKeys.includes(key)?'#a33b3b':isSelectedOpening?'#2c6570':openingHighlighted?objectHoverColor:opening.material==='metal'?'#68747a':opening.material==='glass'?'#75a9b5':opening.material==='wood'?'#8e4c36':'#e2e1dc')} emissive={eraseSelection.openingKeys.includes(key)?'#641d16':isSelectedOpening?'#173d43':openingHighlighted?objectHoverEmissive:'#000000'} emissiveIntensity={eraseSelection.openingKeys.includes(key)?.45:isSelectedOpening?.45:openingHighlighted?.2:0} transparent={opening.style?.startsWith('aperture-')||opening.kind==='window'||opening.material==='glass'} opacity={opening.style?.startsWith('aperture-')?.95:opening.kind==='window'||opening.material==='glass'?.62:1} wireframe={opening.style?.startsWith('aperture-')} metalness={opening.material==='metal'?.45:.08}/>
          <mesh>
            <boxGeometry args={wall.axis==='h'?[openingWidth+.28,openingHeight+.2,.5]:[.5,openingHeight+.2,openingWidth+.28]}/>
            <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
          </mesh>
        </group>}
        {showDropPreview&&<mesh position={previewPosition}><boxGeometry args={wall.axis==='h'?[movingWidth,movingHeight,.22]:[.22,movingHeight,movingWidth]}/><meshBasicMaterial color={previewOpening?objectStateBlueBorder:objectStateInvalidBorder} wireframe transparent opacity={.96} depthTest={false}/></mesh>}
      </group>
    })}
    {wallDropPreview&&(wallPreviewTransform?.walls??model.walls.filter(wall=>wallDropPreview.wallKeys.includes(wallKey(wall))).map(wall=>({...wall,x:wall.x+wallDropPreview.dx,y:wall.y+wallDropPreview.dy}))).map(wall=>{const position=wall.axis==='h'?[wall.x-width/2+.5,1.35,wall.y-depth/2] as const:[wall.x-width/2,1.35,wall.y-depth/2+.5] as const;return <mesh key={`wall-move-preview:${wallKey(wall)}`} position={position}><boxGeometry args={wall.axis==='h'?[1.04,2.74,.2]:[.2,2.74,1.04]}/><meshBasicMaterial color={wallPreviewTransform?objectStateBlueBorder:objectStateInvalidBorder} transparent opacity={.96} wireframe depthTest={false}/></mesh>})}
    {wallPreviewOpenings.map(opening=>{const openingWidth=constructionOpeningWidth(opening),openingHeight=opening.kind==='door'?2.05:(opening.style==='panoramic'||opening.style==='aperture-large'?1.5:.92),openingBottom=opening.kind==='door'?0:(opening.style==='panoramic'||opening.style==='aperture-large'?.35:.82),openingCenter=openingWidth===2?(opening.spanDirection??1)*.5:0,position=opening.wall.axis==='h'?[opening.wall.x-width/2+.5+openingCenter,openingBottom+openingHeight/2,opening.wall.y-depth/2] as const:[opening.wall.x-width/2,openingBottom+openingHeight/2,opening.wall.y-depth/2+.5+openingCenter] as const;return <mesh key={`opening-move-preview:${wallKey(opening.wall)}`} position={position}><boxGeometry args={opening.wall.axis==='h'?[openingWidth,openingHeight,.24]:[.24,openingHeight,openingWidth]}/><meshBasicMaterial color="#d8eeee" wireframe transparent opacity={.95} depthTest={false}/></mesh>})}
    {showRoof&&model.roof&&bounds&&<group position={[(bounds.minX+bounds.maxX+1)/2-width/2,0,(bounds.minY+bounds.maxY+1)/2-depth/2]}><ConstructionRoof style={model.roofStyle??'gable'} material={model.roofMaterial??'metal'} width={bounds.maxX-bounds.minX+1} depth={bounds.maxY-bounds.minY+1} color={eraseSelection.roof?'#a33b3b':selection?.kind==='roof'?'#2c6570':!objectDragActive&&hoveredRoof?objectHoverColor:model.roofMaterial==='metal'?'#59636a':model.roofMaterial==='tile'?'#914c38':'#6d554c'} emissive={eraseSelection.roof?'#641d16':selection?.kind==='roof'?'#173d43':!objectDragActive&&hoveredRoof?objectHoverEmissive:'#000000'} emissiveIntensity={eraseSelection.roof?.4:selection?.kind==='roof'?.3:!objectDragActive&&hoveredRoof?.18:0} onPointerOver={event=>{if(!objectDragActive&&(tool==='select'||tool==='erase')){event.stopPropagation();setHoveredRoof(true)}}} onPointerOut={()=>setHoveredRoof(false)} onPointerDown={event=>{if(event.button!==0)return;if(tool==='select'){event.stopPropagation();onSelect({kind:'roof'});onMessage('Крыша выбрана. Можно изменить форму, материал или удалить её.')}else if(tool==='erase')eraseClick(event,'roof','roof',()=>onChange(applyConstructionCommand(model,{type:'set-roof',roof:false}),'Крыша удалена.'))}}/></group>}
    {previewCells.map(cell=><mesh key={`preview:${cellKey(cell)}`} position={[cell.x-width/2+.5,.19,cell.y-depth/2+.5]}><boxGeometry args={[.92,.05,.92]}/><meshBasicMaterial color={tool==='erase'?objectStateInvalidBorder:objectStateBlue} transparent opacity={.58}/></mesh>)}
    {previewWalls.map(wall=>{const candidate={...wall,level},valid=wallSupported(model.cells,candidate)&&!wallConflictsWithStandaloneAperture(model,candidate)&&!model.walls.some(existing=>wallKey(existing)===wallKey(candidate));return <mesh key={`preview:${wallKey(wall)}`} position={wall.axis==='h'?[wall.x-width/2+.5,1.35,wall.y-depth/2]:[wall.x-width/2,1.35,wall.y-depth/2+.5]}><boxGeometry args={wall.axis==='h'?[1.02,2.7,.11]:[.11,2.7,1.02]}/><meshBasicMaterial color={valid?objectStateBlue:objectStateInvalidBorder} transparent opacity={.58} depthTest={false}/></mesh>})}
    {fixtureCursorPreview&&(()=>{const geometry=standaloneApertureFixtureGeometry(fixtureCursorPreview),x=fixtureCursorPreview.axis==='h'?fixtureCursorPreview.x-width/2+geometry.span/2:fixtureCursorPreview.x-width/2,z=fixtureCursorPreview.axis==='h'?fixtureCursorPreview.y-depth/2:fixtureCursorPreview.y-depth/2+geometry.span/2;return <mesh position={[x,geometry.bottom+geometry.height/2,z]}><boxGeometry args={fixtureCursorPreview.axis==='h'?[geometry.width,geometry.height,geometry.depth]:[geometry.depth,geometry.height,geometry.width]}/><meshBasicMaterial color={objectStateInvalidBorder} transparent opacity={.58} depthTest={false}/></mesh>})()}
    {aperturePlacement&&(()=>{const span=aperturePlacement.size==='large'?2:1,cutHeight=aperturePlacement.kind==='door'?2.05:aperturePlacement.size==='large'?2.5:.92,cutBottom=aperturePlacement.kind==='door'?0:aperturePlacement.size==='large'?.11:.9,x=aperturePlacement.axis==='h'?aperturePlacement.x-width/2+span/2:aperturePlacement.x-width/2,z=aperturePlacement.axis==='h'?aperturePlacement.y-depth/2:aperturePlacement.y-depth/2+span/2;return <group position={[x,1.35,z]}><ApertureFrame axis={aperturePlacement.axis} span={span} cutHeight={cutHeight} cutBottom={cutBottom} kind={aperturePlacement.kind} color={aperturePlacementValid?objectStateBlue:objectStateInvalidBorder}/></group>})()}
    {erasePreviewWalls.map(wall=><mesh key={`erase-preview:${wallKey(wall)}`} position={wall.axis==='h'?[wall.x-width/2+.5,1.36,wall.y-depth/2]:[wall.x-width/2,1.36,wall.y-depth/2+.5]}><boxGeometry args={wall.axis==='h'?[1.06,2.76,.19]:[.19,2.76,1.06]}/><meshBasicMaterial color="#ef8c7b" wireframe transparent opacity={.95} depthTest={false}/></mesh>)}
    {previewSelectionWalls.map(wall=><mesh key={`selection-preview:${wallKey(wall)}`} position={wall.axis==='h'?[wall.x-width/2+.5,1.36,wall.y-depth/2]:[wall.x-width/2,1.36,wall.y-depth/2+.5]}><boxGeometry args={wall.axis==='h'?[1.06,2.76,.19]:[.19,2.76,1.06]}/><meshBasicMaterial color="#79b7c0" wireframe transparent opacity={.95} depthTest={false}/></mesh>)}
    {placementHover&&!drag&&tool==='foundation'&&<mesh position={[placementHover.x-width/2+.5,.21,placementHover.y-depth/2+.5]}><boxGeometry args={[.92,.08,.92]}/><meshBasicMaterial color={placementValid?objectStateBlue:objectStateInvalidBorder} transparent opacity={.54} depthTest={false}/></mesh>}
    {placementHover&&!drag&&tool==='stairs'&&<group position={[placementHover.x-width/2+.5,.18,placementHover.y-depth/2+.5]} rotation={[0,stairRotation*Math.PI/180,0]}><StairSteps shape={stairShape} color={placementValid?objectStateBlue:objectStateInvalidBorder}/></group>}
    {(tool==='foundation'||tool==='stairs')&&<mesh position={[0,3.2,0]} rotation={[-Math.PI/2,0,0]} onPointerDown={begin} onPointerMove={move} onPointerOut={()=>setPlacementHover(null)} onPointerUp={finish} onPointerCancel={()=>setDrag(null)}><planeGeometry args={[interactionPlaneSize,interactionPlaneSize]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>}
    <mesh position={[0,.01,0]} rotation={[-Math.PI/2,0,0]} onPointerDown={begin} onPointerMove={move} onPointerOut={()=>setHoveredBuildWall(null)} onPointerUp={finish} onPointerCancel={()=>setDrag(null)}><planeGeometry args={pointerPlaneSize}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
  </group>
}

export function House3D({spec}:{spec:Spec;rooms:Room[];positions:Record<string,Position>}){
  const orbitControlsRef=useRef<any>(null)
  const [mode,setMode]=useState<'exterior'|'build'>('build')
  const [buildLevel,setBuildLevel]=useState(1)
  const [floorMaterial,setFloorMaterial]=useState<'concrete'|'slab'|'wood'>('concrete')
  const [buildWallMaterial,setBuildWallMaterial]=useState<'aerated'|'brick'|'frame'|'timber'>('aerated')
  const [wallPlacementRotation,setWallPlacementRotation]=useState<0|90>(0)
  const [doorStyle,setDoorStyle]=useState('swing')
  const [doorMaterial,setDoorMaterial]=useState('wood')
  const [windowStyle,setWindowStyle]=useState('casement')
  const [apertureSize,setApertureSize]=useState<'small'|'large'>('small')
  const [windowMaterial,setWindowMaterial]=useState('pvc')
  const [stairShape,setStairShape]=useState<StairShape>('straight')
  const [stairPlacementRotation,setStairPlacementRotation]=useState<0|90|180|270>(0)
  const [roofStyle,setRoofStyle]=useState<'gable'|'hip'|'flat'>(spec.construction.roofStyle??'gable')
  const [roofMaterial,setRoofMaterial]=useState<'metal'|'tile'|'soft'>(spec.construction.roofMaterial??'metal')
  const [roofVisible,setRoofVisible]=useState(true)
  const {selection:buildSelection,setSelection:setBuildSelection,stair:selectedBuildStair,stairIndexes:selectedBuildStairIndexes,opening:selectedBuildOpening,openingKeys:selectedBuildOpeningKeys,apertureIds:selectedBuildApertureIds,apertures:selectedBuildApertures,fixtureIds:selectedBuildFixtureIds,fixtures:selectedBuildFixtures,fixtureKind:selectedFixtureKind,fixtureMaterial:selectedFixtureMaterial,walls:selectedBuildWalls,wallMaterial:selectedWallMaterial,cells:selectedBuildCells,cellMaterial:selectedCellMaterial}=useConstructionSelection(spec.construction)
  const [movingBuildOpening,setMovingBuildOpening]=useState(false)
  const [tool,setTool]=useState<'window'|'door'|'wall'|BuildTool|null>(null)
  const [toolMessage,setToolMessage]=useState('')
  const [toolCatalogPinned,setToolCatalogPinned]=useState(false)
  const [toolCatalogHovered,setToolCatalogHovered]=useState(false)
  const toolCatalogRef=useRef<HTMLDivElement>(null)
  const toolCatalogTriggerRef=useRef<HTMLButtonElement>(null)
  const toolCatalogHoverTimer=useRef<number|null>(null)
  const toolCatalogOpen=toolCatalogPinned||toolCatalogHovered
  useEffect(()=>()=>{if(toolCatalogHoverTimer.current!==null)window.clearTimeout(toolCatalogHoverTimer.current)},[])
  useEffect(()=>{if(!toolCatalogOpen)return;const close=(event:PointerEvent)=>{if(!toolCatalogRef.current?.contains(event.target as Node)){setToolCatalogPinned(false);setToolCatalogHovered(false)}};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setToolCatalogPinned(false);setToolCatalogHovered(false);toolCatalogTriggerRef.current?.focus()}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape)}},[toolCatalogOpen])
  useEffect(()=>{const handle=(event:Event)=>{setBuildSelection(null);setMovingBuildOpening(false);window.dispatchEvent(new Event('domovid-clear-construction-selection'));setToolMessage((event as CustomEvent<{message?:string}>).detail?.message??'История проекта обновлена. Выделение снято.')};window.addEventListener('domovid-history',handle);return()=>window.removeEventListener('domovid-history',handle)},[])
  const [showKeyboardHelp,setShowKeyboardHelp]=useState(false)
  const constructionWidth=spec.construction.width||12,constructionDepth=spec.construction.depth||10
  const constructionLevels=getConstructionLevels(spec.construction)
  const exteriorLevels=getExteriorLevels(spec.construction)
  const exteriorTopLevel=Math.max(...exteriorLevels)
  const levelGrid=mode==='build'?getConstructionGrid(spec.construction,buildLevel):{width:constructionWidth,depth:constructionDepth,x:0,z:0}
  const {width:gridWidth,depth:gridDepth,x:gridX,z:gridZ}=levelGrid
  const [widthDraft,setWidthDraft]=useState(()=>String(constructionWidth))
  const [depthDraft,setDepthDraft]=useState(()=>String(constructionDepth))
  useEffect(()=>{setWidthDraft(String(constructionWidth));setDepthDraft(String(constructionDepth))},[constructionWidth,constructionDepth])
  useEffect(()=>{const next=getActiveConstructionLevel(spec.construction,buildLevel);if(next!==buildLevel)setBuildLevel(next)},[constructionLevels.join(':'),buildLevel])
  const cancelBuildTool=()=>{setTool(null);setBuildSelection(null);setMovingBuildOpening(false);setToolMessage('')}
  useEffect(()=>{const handle=(event:KeyboardEvent)=>{const target=event.target as HTMLElement,editable=['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable;if(mode!=='build'||event.ctrlKey||event.metaKey||event.altKey)return;if(isBuildToolCancelInput({key:event.key,editable})){event.preventDefault();cancelBuildTool();return}if(editable)return;if(event.code==='KeyH'){event.preventDefault();setTool('select');setMovingBuildOpening(false);setToolMessage('Выбор включён: кликните объект или используйте Shift + протягивание для группы. Delete — удалить.')}else if(event.code==='KeyV'){event.preventDefault();cancelBuildTool();setToolMessage('Камера включена · H — выбор объектов')}};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle)},[mode])
  const changeConstruction=(construction:ConstructionModel,message:string)=>{setToolMessage(message);window.dispatchEvent(new CustomEvent('domovid-construction',{detail:{action:'change',construction}}))}
  const changeSelectedStair=(change:Partial<NonNullable<ConstructionModel['stairs']>[number]>,message:string)=>{if(buildSelection?.kind!=='stair'||!selectedBuildStair)return;changeConstruction(applyConstructionCommand(spec.construction,{type:'update-stair',index:buildSelection.index,change}),message)}
  const rotateSelectedStair=(direction:-1|1)=>{if(!selectedBuildStair)return;const rotation=rotateQuarter(selectedBuildStair.rotation??0,direction);changeSelectedStair({rotation},`Лестница повёрнута на ${direction>0?'90° вправо':'90° влево'}.`)}
  const rotateStairPlaceholder=(direction:-1|1)=>{setStairPlacementRotation(current=>rotateQuarter(current,direction));setToolMessage(`Placeholder лестницы повёрнут на 90° ${direction>0?'вправо':'влево'}.`)}
  const rotateWallPlaceholder=()=>{setWallPlacementRotation(rotateWallPlacement);setToolMessage('Placeholder стены повёрнут на 90°.')}
  const moveSelectedBuildStair=(dx:number,dy:number)=>{if(!selectedBuildStair||buildSelection?.kind!=='stair')return;const result=moveStairCandidate(spec.construction,buildSelection.index,dx,dy);if(!result.valid){setToolMessage(result.reason==='occupied'?'Эта клетка уже занята другой лестницей.':`Лестница должна находиться на полу ${selectedBuildStair.cell.level??1} этажа.`);return}changeSelectedStair({cell:result.stair.cell},`Лестница перемещена: x ${result.stair.cell.x+1}, y ${result.stair.cell.y+1}.`)}
  const changeSelectedBuildOpening=(change:Partial<ConstructionOpening>,message:string)=>{if(buildSelection?.kind!=='opening'||!selectedBuildOpening)return;const next=applyConstructionCommand(spec.construction,{type:'update-opening',wall:selectedBuildOpening.wall,change});if(next===spec.construction){setToolMessage('Для выбранного типа проёма недостаточно свободных соседних сегментов стены.');return}changeConstruction(next,message)}
  const duplicateSelectedBuildOpening=()=>{if(!selectedBuildOpening)return;const result=duplicateConstructionOpening(spec.construction,selectedBuildOpening.wall);if(!result){setToolMessage('Нет свободной стены на этом этаже. Постройте новую стену или освободите существующую.');return}changeConstruction(result.model,`${selectedBuildOpening.kind==='door'?'Дверь':'Окно'} продублировано на ближайшую свободную стену.`);setBuildSelection({kind:'opening',wallKey:wallKey(result.wall)})}
  const duplicateSelectedBuildStair=()=>{if(buildSelection?.kind!=='stair')return;const result=duplicateConstructionStair(spec.construction,buildSelection.index);if(!result){setToolMessage('Нет свободной клетки фундамента для копии лестницы.');return}changeConstruction(result.model,'Лестница продублирована на ближайшую свободную клетку.');setBuildSelection({kind:'stair',index:result.index})}
  const duplicateSelectedBuildWalls=()=>{if(!selectedBuildWalls.length)return;const result=duplicateConstructionWalls(spec.construction,selectedBuildWalls);if(!result){setToolMessage('Для копии группы стен нет свободного места с опорой.');return}changeConstruction(result.model,`Создана копия стен: ${result.walls.length}. Окна и двери скопированы вместе с ними.`);setBuildSelection({kind:'walls',wallKeys:result.walls.map(wallKey)})}
  const duplicateSelectedBuildApertures=()=>{if(!selectedBuildApertureIds.length)return;const result=duplicateStandaloneApertures(spec.construction,selectedBuildApertureIds);if(!result){setToolMessage('Для копии проёма нет свободного места с опорой.');return}changeConstruction(result.model,`Создана копия проёмов: ${result.apertures.length}. Установленные двери и окна скопированы вместе с ними.`);setBuildSelection(result.apertures.length===1?{kind:'aperture',id:result.apertures[0].id}:{kind:'apertures',ids:result.apertures.map(item=>item.id)})}
  const moveSelectedBuildOpening=(targetWall:ConstructionWall)=>{if(!movingBuildOpening||!selectedBuildOpening)return;const sourceKey=wallKey(selectedBuildOpening.wall),targetKey=wallKey(targetWall);if(sourceKey===targetKey){setMovingBuildOpening(false);setToolMessage('Проём уже расположен на этом сегменте.');return}const candidate=fitConstructionOpening(spec.construction,{...selectedBuildOpening,wall:targetWall,spanDirection:undefined},selectedBuildOpening);if(!candidate){setToolMessage('Перенос невозможен: для этого проёма нужны свободные соседние сегменты стены.');return}const next=applyConstructionCommand(spec.construction,{type:'move-opening',from:selectedBuildOpening.wall,to:targetWall});if(next===spec.construction){setToolMessage('Перенос невозможен: выбранные сегменты заняты.');return}const turned=selectedBuildOpening.wall.axis!==targetWall.axis;changeConstruction(next,`${selectedBuildOpening.kind==='door'?'Дверь':'Окно'} перенесено${turned?' и повёрнуто по направлению новой стены':''}.`);setBuildSelection({kind:'opening',wallKey:targetKey});setMovingBuildOpening(false)}
  const selectWallWithOpening=()=>{if(!selectedBuildOpening)return;const wallKeys=constructionOpeningWalls(selectedBuildOpening).map(wallKey);setBuildSelection({kind:'walls',wallKeys});setToolMessage(`Выбрано сегментов стены под проёмом: ${wallKeys.length}.`)}
  const changeSelectedBuildWall=(material:NonNullable<ConstructionWall['material']>)=>{if(!selectedBuildWalls.length)return;const selectedKeys=new Set(selectedBuildWalls.map(wallKey));changeConstruction({...spec.construction,walls:spec.construction.walls.map(wall=>selectedKeys.has(wallKey(wall))?{...wall,material}:wall)},`Материал изменён у стен: ${selectedBuildWalls.length}.`)}
  const changeSelectedBuildCells=(material:NonNullable<FoundationCell['material']>)=>{if(!selectedBuildCells.length)return;const selectedKeys=new Set(selectedBuildCells.map(cellKey));changeConstruction({...spec.construction,cells:spec.construction.cells.map(cell=>selectedKeys.has(cellKey(cell))?{...cell,material}:cell)},`Материал изменён для ${selectedBuildCells.length} м² пола.`)}
  const changeSelectedBuildFixtureMaterial=(material:string)=>{if(!selectedBuildFixtureIds.length)return;changeConstruction(updateStandaloneFixtureMaterial(spec.construction,selectedBuildFixtureIds,material),`Материал изменён у выбранных ${selectedFixtureKind==='door'?'дверей':'окон'}: ${selectedBuildFixtureIds.length}.`)}
  const moveSelectedBuildWalls=(dx:number,dy:number)=>{const next=moveConstructionWalls(spec.construction,selectedBuildWalls,dx,dy);if(!next){setToolMessage('Не удалось переместить: под стенами должен быть пол, а новое место должно быть свободно.');return}const movedKeys=selectedBuildWalls.map(wall=>wallKey({...wall,x:wall.x+dx,y:wall.y+dy}));changeConstruction(next,`Перемещено стен: ${selectedBuildWalls.length}. Двери и окна перемещены вместе с ними.`);setBuildSelection({kind:'walls',wallKeys:movedKeys})}
  const rotateSelectedBuildWalls=(direction:-1|1)=>{const next=rotateConstructionWalls(spec.construction,selectedBuildWalls,direction);if(!next){setToolMessage('Не удалось повернуть стены: проверьте фундамент, границы и свободное место. Широкий проём требует выделения обеих стен.');return}const wallKeys=next.walls.slice(-selectedBuildWalls.length).map(wallKey);changeConstruction(next,`Стены повёрнуты на 90° ${direction>0?'вправо':'влево'}. Двери и окна повёрнуты вместе с ними.`);setBuildSelection({kind:'walls',wallKeys})}
  const transformSelectedBuildApertures=(dx:number,dy:number,quarterTurns:number)=>{if(!selectedBuildApertureIds.length)return;const result=transformStandaloneApertures(spec.construction,selectedBuildApertureIds,dx,dy,quarterTurns);if(!result){setToolMessage('Проём нельзя переместить или повернуть: проверьте фундамент, границы и свободное место.');return}changeConstruction(result.model,quarterTurns?'Проём повёрнут на 90°.':'Проём перемещён на 1 метр.');setBuildSelection(result.apertures.length===1?{kind:'aperture',id:result.apertures[0].id}:{kind:'apertures',ids:result.apertures.map(item=>item.id)})}
  const removeSelectedBuildObject=()=>{
    if(!buildSelection)return
    if(buildSelection.kind==='stair')changeConstruction(applyConstructionCommand(spec.construction,{type:'remove-stair',index:buildSelection.index}),'Лестница удалена. Пустой второй этаж удаляется автоматически.')
    else if(buildSelection.kind==='stairs'){const indexes=[...new Set(buildSelection.indexes)].sort((a,b)=>b-a);const next=indexes.reduce((model,index)=>applyConstructionCommand(model,{type:'remove-stair',index}),spec.construction);changeConstruction(next,`Удалено лестниц: ${indexes.length}. Пустой второй этаж удаляется автоматически.`)}
    else if(buildSelection.kind==='fixture'||buildSelection.kind==='fixtures'){const ids=new Set(selectedBuildFixtureIds);changeConstruction({...spec.construction,apertures:(spec.construction.apertures??[]).map(aperture=>ids.has(aperture.id)?{...aperture,fixture:undefined}:aperture)},`Удалено дверей или окон: ${ids.size}. Проёмы сохранены.`)}
    else if(buildSelection.kind==='aperture'||buildSelection.kind==='apertures'){const ids=new Set(selectedBuildApertureIds);changeConstruction({...spec.construction,apertures:(spec.construction.apertures??[]).filter(aperture=>!ids.has(aperture.id))},`Удалено проёмов: ${ids.size}.`)}
    else if(buildSelection.kind==='opening'&&selectedBuildOpening)changeConstruction(applyConstructionCommand(spec.construction,{type:'remove-opening',wall:selectedBuildOpening.wall}),selectedBuildOpening.kind==='door'?'Дверь удалена.':'Окно удалено.')
    else if(buildSelection.kind==='openings'){const keys=new Set(buildSelection.wallKeys);changeConstruction({...spec.construction,openings:(spec.construction.openings??[]).filter(opening=>!keys.has(wallKey(opening.wall)))},`Удалено дверей и окон: ${keys.size}. Стены сохранены.`)}
    else if(buildSelection.kind==='walls'&&selectedBuildWalls.length)changeConstruction(applyConstructionCommand(spec.construction,{type:'remove-walls',walls:selectedBuildWalls}),`Удалено стен: ${selectedBuildWalls.length}. Проёмы в них также удалены.`)
    else if(buildSelection.kind==='cells'&&selectedBuildCells.length)changeConstruction(applyConstructionCommand(spec.construction,{type:'remove-cells',cells:selectedBuildCells}),`Удалено пола: ${selectedBuildCells.length} м². Стены без опоры также удалены.`)
    else if(buildSelection.kind==='roof')changeConstruction(applyConstructionCommand(spec.construction,{type:'set-roof',roof:false}),'Крыша удалена.')
    setBuildSelection(null)
  }
  useEffect(()=>{const handle=(event:KeyboardEvent)=>{
    if(mode!=='build')return
    const target=event.target as HTMLElement
    const rotationKey=event.code==='KeyR'||event.key.toLowerCase()==='r'||event.key.toLowerCase()==='к'
    if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable){if(target.tagName!=='SELECT'||!rotationKey)return}
    if(event.key==='Escape'&&movingBuildOpening){event.preventDefault();setMovingBuildOpening(false);setToolMessage('Перенос проёма отменён.');return}
    if(event.key==='Escape'&&buildSelection){event.preventDefault();setBuildSelection(null);setMovingBuildOpening(false);window.dispatchEvent(new Event('domovid-clear-construction-selection'));setToolMessage('Выделение снято. Активный инструмент сохранён.');return}
    if(tool==='stairs'&&(event.code==='KeyR'||event.key.toLowerCase()==='r'||event.key.toLowerCase()==='к')){event.preventDefault();rotateStairPlaceholder(1);return}
    if(tool==='build-wall'&&(event.code==='KeyR'||event.key.toLowerCase()==='r'||event.key.toLowerCase()==='к')){event.preventDefault();rotateWallPlaceholder();return}
    if((tool==='door-aperture'||tool==='window-aperture')&&(event.code==='KeyR'||event.key.toLowerCase()==='r'||event.key.toLowerCase()==='к')){event.preventDefault();rotateWallPlaceholder();return}
    if(!buildSelection)return
    if((event.ctrlKey||event.metaKey)&&(event.code==='KeyD'||event.key.toLowerCase()==='d'||event.key.toLowerCase()==='в')&&(buildSelection.kind==='opening'||buildSelection.kind==='stair'||buildSelection.kind==='walls'||buildSelection.kind==='aperture'||buildSelection.kind==='apertures')){event.preventDefault();if(buildSelection.kind==='opening')duplicateSelectedBuildOpening();else if(buildSelection.kind==='walls')duplicateSelectedBuildWalls();else if(buildSelection.kind==='aperture'||buildSelection.kind==='apertures')duplicateSelectedBuildApertures();else duplicateSelectedBuildStair();return}
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();removeSelectedBuildObject();return}
    if((buildSelection.kind==='aperture'||buildSelection.kind==='apertures')&&selectedBuildApertures.length){if(event.code==='KeyR'||event.key.toLowerCase()==='r'||event.key.toLowerCase()==='к'){event.preventDefault();transformSelectedBuildApertures(0,0,1);return}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();if(event.key==='ArrowLeft')transformSelectedBuildApertures(-1,0,0);if(event.key==='ArrowRight')transformSelectedBuildApertures(1,0,0);if(event.key==='ArrowUp')transformSelectedBuildApertures(0,-1,0);if(event.key==='ArrowDown')transformSelectedBuildApertures(0,1,0);return}
    if(buildSelection.kind==='stair'&&selectedBuildStair){
      if(event.code==='KeyR'||event.key.toLowerCase()==='r'||event.key.toLowerCase()==='к'){event.preventDefault();rotateSelectedStair(1);return}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return
      event.preventDefault()
      if(event.key==='ArrowLeft')moveSelectedBuildStair(-1,0)
      if(event.key==='ArrowRight')moveSelectedBuildStair(1,0)
      if(event.key==='ArrowUp')moveSelectedBuildStair(0,-1)
      if(event.key==='ArrowDown')moveSelectedBuildStair(0,1)
      return
    }
    if(buildSelection.kind==='walls'&&selectedBuildWalls.length){
      if(event.code==='KeyR'||event.key.toLowerCase()==='r'||event.key.toLowerCase()==='к'){event.preventDefault();rotateSelectedBuildWalls(1);return}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return
      event.preventDefault()
      if(event.key==='ArrowLeft')moveSelectedBuildWalls(-1,0)
      if(event.key==='ArrowRight')moveSelectedBuildWalls(1,0)
      if(event.key==='ArrowUp')moveSelectedBuildWalls(0,-1)
      if(event.key==='ArrowDown')moveSelectedBuildWalls(0,1)
      return
    }
  };window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle)},[mode,tool,buildSelection,movingBuildOpening,selectedBuildOpening,selectedBuildStair,selectedBuildWalls,spec.construction])
  const changeConstructionSize=(width:number,depth:number)=>{const next=applyConstructionCommand({...spec.construction,width:constructionWidth,depth:constructionDepth},{type:'resize',width,depth}),removed=next.cells.length<spec.construction.cells.length||next.walls.length<spec.construction.walls.length;changeConstruction(next,removed?'Рабочая область изменена. Объекты за границей удалены.':'Рабочая область изменена.')}
  const toggleBuildTool=(next:BuildTool,message:string)=>{const disabled=tool===next;setTool(disabled?null:next);setBuildSelection(null);setMovingBuildOpening(false);setToolMessage(disabled?'Инструмент отключён':message)}
  const chooseCatalogTool=(next:CatalogTool)=>{
    if(next==='roof'){
      if(!spec.construction.roof&&!spec.construction.cells.length){setToolMessage('Сначала постройте фундамент.');setToolCatalogPinned(false);setToolCatalogHovered(false);queueMicrotask(()=>toolCatalogTriggerRef.current?.focus());return}
      setRoofVisible(true);setTool('roof');setBuildSelection(null);setMovingBuildOpening(false)
      if(!spec.construction.roof){setRoofVisible(true);changeConstruction(applyConstructionCommand(spec.construction,{type:'set-roof',roof:true,roofStyle,roofMaterial}),'Крыша добавлена')}
      else setToolMessage('Крыша выбрана. Измените форму и материал слева.')
      setToolCatalogPinned(false);setToolCatalogHovered(false);queueMicrotask(()=>toolCatalogTriggerRef.current?.focus());return
    }
    if(next==='door-aperture'||next==='window-aperture'){
      const active=tool===next
      setDoorStyle(`aperture-${apertureSize}`);setWindowStyle(`aperture-${apertureSize}`);setTool(active?null:next);setBuildSelection(null);setMovingBuildOpening(false)
      setToolMessage(active?'Инструмент отключён':next==='door-aperture'?'Поставьте самостоятельный дверной проём на свободный сегмент':'Поставьте самостоятельный оконный проём на свободный сегмент')
      setToolCatalogPinned(false);setToolCatalogHovered(false);queueMicrotask(()=>toolCatalogTriggerRef.current?.focus());return
    }
    const messages:Record<Exclude<CatalogTool,'roof'|'door-aperture'|'window-aperture'>,string>={foundation:buildLevel===1?'Протяните прямоугольник фундамента по сетке':'Протяните пол второго этажа над фундаментом','build-wall':'Протяните непрерывную стену по полу',door:'Выберите готовый дверной проём для установки двери',window:'Выберите готовый оконный проём для установки окна',stairs:'Выберите место лестницы внутри площади первого этажа'}
    toggleBuildTool(next,messages[next]);setToolCatalogPinned(false);setToolCatalogHovered(false);queueMicrotask(()=>toolCatalogTriggerRef.current?.focus())
  }
  const commitConstructionSize=(axis:'width'|'depth')=>{
    const draft=axis==='width'?widthDraft:depthDraft,value=Number(draft)
    if(!Number.isFinite(value)){if(axis==='width')setWidthDraft(String(constructionWidth));else setDepthDraft(String(constructionDepth));return}
    const cells=Math.max(6,Math.min(225,Math.round(value)))
    if(axis==='width'){setWidthDraft(String(cells));if(cells!==constructionWidth)changeConstructionSize(cells,constructionDepth)}
    else{setDepthDraft(String(cells));if(cells!==constructionDepth)changeConstructionSize(constructionWidth,cells)}
  }
  const areaInputKeyDown=(event:ReactKeyboardEvent<HTMLInputElement>,axis:'width'|'depth')=>{if(event.key==='Enter')event.currentTarget.blur();else if(event.key==='Escape'){if(axis==='width')setWidthDraft(String(constructionWidth));else setDepthDraft(String(constructionDepth))}}
  const selectBuildLevel=(next:number)=>{if(!constructionLevels.includes(next)){setToolMessage(`${next} этаж появится после установки лестницы на ${next-1} этаже.`);return}setBuildLevel(next);setTool(null);setBuildSelection(null);setToolMessage(`${next} этаж выбран`)}
  const createPlan=()=>{if(!spec.construction.cells.length){setToolMessage('Сначала добавьте фундамент.');return}window.dispatchEvent(new CustomEvent('domovid-construction',{detail:{action:'create-plan',construction:spec.construction}}));setToolMessage('План создан из построенной модели.')}
  return <div className="three-shell" onContextMenu={event=>event.preventDefault()}>
    <div className="three-controls" role="group" aria-label="Режим 3D"><button aria-pressed={mode==='build'} onClick={()=>{setMode('build');setTool(null);setBuildSelection(null);setToolMessage('Режим строительства. Крыша скрыта, чтобы не мешать работе.')}}>Строить</button><button aria-pressed={mode==='exterior'} onClick={()=>{setMode('exterior');setTool(null);setBuildSelection(null);setRoofVisible(true);setToolMessage('Просмотр дома с улицы. Здесь можно настроить крышу.')}}>С улицы</button>{mode==='build'&&constructionLevels.length>1&&<select aria-label="Строительный этаж" value={buildLevel} onChange={event=>selectBuildLevel(Number(event.target.value))}>{constructionLevels.map(level=><option key={level} value={level}>{level} этаж</option>)}</select>}<button aria-expanded={showKeyboardHelp} aria-controls="three-keyboard-help" onClick={()=>setShowKeyboardHelp(value=>!value)}>Клавиши</button></div>
    {showKeyboardHelp&&<aside id="three-keyboard-help" className="keyboard-help" aria-label="Инструкция по клавишам"><header><strong>Управление</strong><button type="button" aria-label="Закрыть инструкцию" onClick={()=>setShowKeyboardHelp(false)}>Закрыть</button></header><dl><div><dt><kbd>H</kbd></dt><dd>Выбор объектов и фундамента</dd></div><div><dt><kbd>Shift</kbd> + клик</dt><dd>Добавить объект того же вида</dd></div><div><dt><kbd>Shift</kbd> + протягивание</dt><dd>Выделить стены или фундамент</dd></div><div><dt><kbd>V</kbd></dt><dd>Управление камерой</dd></div><div><dt><kbd>W A S D</kbd></dt><dd>Перемещать камеру относительно направления взгляда</dd></div><div><dt><kbd>← ↑ → ↓</kbd></dt><dd>Перемещать камеру, когда строительный объект не выделен</dd></div><div><dt><kbd>Alt+Z</kbd> / <kbd>Ctrl+Z</kbd></dt><dd>Отменить последнее изменение</dd></div><div><dt><kbd>Alt+Y</kbd> / <kbd>Ctrl+Y</kbd></dt><dd>Вернуть отменённое изменение</dd></div><div><dt><kbd>← ↑ → ↓</kbd></dt><dd>Переместить выбранный объект</dd></div><div><dt><kbd>R / К</kbd></dt><dd>Повернуть лестницу или стены</dd></div><div><dt><kbd>Ctrl</kbd> + <kbd>D / В</kbd></dt><dd>Дублировать выбранный объект</dd></div><div><dt><kbd>Delete</kbd></dt><dd>Удалить выбранное</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Снять выделение</dd></div></dl><p>ЛКМ перемещает камеру, ПКМ вращает, колесо меняет масштаб.</p></aside>}
    {mode==='build'?<div className="three-edit-tools construction-tools" role="group" aria-label="Свободное строительство">
      <div ref={toolCatalogRef} className={`construction-tool-picker${toolCatalogOpen?' is-open':''}`} onPointerEnter={event=>{if(event.pointerType==='touch')return;if(toolCatalogHoverTimer.current!==null)window.clearTimeout(toolCatalogHoverTimer.current);toolCatalogHoverTimer.current=window.setTimeout(()=>setToolCatalogHovered(true),180)}} onPointerLeave={()=>{if(toolCatalogHoverTimer.current!==null)window.clearTimeout(toolCatalogHoverTimer.current);toolCatalogHoverTimer.current=null;if(!toolCatalogPinned)setToolCatalogHovered(false)}}>
        <button ref={toolCatalogTriggerRef} type="button" className="construction-tool-trigger" aria-haspopup="dialog" aria-expanded={toolCatalogOpen} aria-controls="construction-tool-menu" onClick={()=>{if(toolCatalogPinned){setToolCatalogPinned(false);setToolCatalogHovered(false)}else setToolCatalogPinned(true)}}>
          <span className="construction-tool-trigger-icon">{constructionTools.some(item=>item.tool===tool)?<ConstructionToolIcon tool={tool as CatalogTool}/>:<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><rect x="5" y="5" width="10" height="10" rx="2"/><rect x="21" y="5" width="10" height="10" rx="2"/><rect x="5" y="21" width="10" height="10" rx="2"/><rect x="21" y="21" width="10" height="10" rx="2"/></svg>}</span><strong>{constructionTools.some(item=>item.tool===tool)?constructionToolLabel(tool as CatalogTool,buildLevel):'Выбрать объект'}</strong><i aria-hidden="true"/>
        </button>
        <div id="construction-tool-menu" className="construction-tool-menu" role="dialog" aria-label="Объекты строительства" hidden={!toolCatalogOpen}>
          <header><strong>Что строим?</strong><span>Выберите объект — его параметры появятся слева</span></header>
          {constructionToolGroups.map(group=><section className="construction-tool-group" key={group} aria-labelledby={`construction-group-${group}`}><h4 id={`construction-group-${group}`}>{group}</h4><div className="construction-tool-grid">{constructionTools.filter(item=>item.group===group).map(item=>{const active=tool===item.tool;const hint=item.tool==='roof'&&spec.construction.roof?'Добавлена · открыть настройки':item.hint;return <button key={item.tool} type="button" aria-pressed={active} className="construction-tool-option" onClick={()=>chooseCatalogTool(item.tool)}><span className="construction-tool-art"><ConstructionToolIcon tool={item.tool}/></span><span><strong>{constructionToolLabel(item.tool,buildLevel)}</strong><small>{hint}</small></span><i aria-hidden="true"/></button>})}</div></section>)}
        </div>
      </div>
      {spec.construction.cells.length>0&&<button className="create-plan-button" onClick={createPlan}>Создать план</button>}
    </div>:null}
    {mode==='build'&&<div className="construction-area-editor" aria-label="Размер рабочей области"><span>Рабочая область</span><label>Ширина, м<input aria-label="Ширина рабочей области в метрах" type="number" min="6" max="225" step="1" value={widthDraft} onChange={event=>setWidthDraft(event.target.value)} onBlur={()=>commitConstructionSize('width')} onKeyDown={event=>areaInputKeyDown(event,'width')} onWheel={event=>event.currentTarget.blur()}/></label><b>×</b><label>Глубина, м<input aria-label="Глубина рабочей области в метрах" type="number" min="6" max="225" step="1" value={depthDraft} onChange={event=>setDepthDraft(event.target.value)} onBlur={()=>commitConstructionSize('depth')} onKeyDown={event=>areaInputKeyDown(event,'depth')} onWheel={event=>event.currentTarget.blur()}/></label><small>{constructionWidth} × {constructionDepth} м участка · клетка 1 м²</small></div>}
    {mode==='exterior'&&<div className="construction-properties exterior-roof-properties" aria-label="Настройка крыши">{spec.construction.roof?<><strong>Крыша дома</strong><label><span>Форма крыши</span><select value={spec.construction.roofStyle??'gable'} onChange={event=>{const value=event.target.value as typeof roofStyle;setRoofStyle(value);changeConstruction(applyConstructionCommand(spec.construction,{type:'set-roof',roof:true,roofStyle:value,roofMaterial:spec.construction.roofMaterial??roofMaterial}),'Форма крыши изменена.')}}><option value="gable">Двускатная</option><option value="hip">Вальмовая</option><option value="flat">Плоская</option></select></label><label><span>Материал</span><select value={spec.construction.roofMaterial??'metal'} onChange={event=>{const value=event.target.value as typeof roofMaterial;setRoofMaterial(value);changeConstruction(applyConstructionCommand(spec.construction,{type:'set-roof',roof:true,roofStyle:spec.construction.roofStyle??roofStyle,roofMaterial:value}),'Материал крыши изменён.')}}><option value="metal">Металл</option><option value="tile">Черепица</option><option value="soft">Мягкая кровля</option></select></label><div className="construction-property-actions"><button type="button" aria-pressed={!roofVisible} onClick={()=>{setRoofVisible(value=>!value);setToolMessage(roofVisible?'Крыша скрыта. Теперь видно внутреннее устройство дома.':'Крыша снова показана.')}}>{roofVisible?'Скрыть крышу':'Показать крышу'}</button></div></>:<><strong>У дома пока нет крыши</strong><small>Добавьте крышу и настройте её форму и материал.</small><div className="construction-property-actions"><button type="button" onClick={()=>{setRoofVisible(true);changeConstruction(applyConstructionCommand(spec.construction,{type:'set-roof',roof:true,roofStyle,roofMaterial}),'Крыша добавлена.')}}>Добавить крышу</button></div></>}</div>}
    {mode==='build'&&tool&&<div className="construction-properties" aria-label="Свойства строительного объекта">{tool==='foundation'&&<label><span>{buildLevel===1?'Материал фундамента':'Материал пола'}</span><select value={floorMaterial} onChange={event=>setFloorMaterial(event.target.value as typeof floorMaterial)}><option value="concrete">Монолит</option><option value="slab">Плиты</option><option value="wood">Дерево</option></select></label>}{tool==='build-wall'&&<><label><span>Материал стены</span><select value={buildWallMaterial} onChange={event=>setBuildWallMaterial(event.target.value as typeof buildWallMaterial)}><option value="aerated">Газобетон</option><option value="brick">Кирпич</option><option value="frame">Каркас</option><option value="timber">Брус</option></select></label><span>Направление: {wallPlacementRotation===0?'горизонтальное':'вертикальное'}</span><small>R или К поворачивает placeholder стены до установки.</small><div className="construction-property-actions"><button type="button" onClick={rotateWallPlaceholder}>Повернуть на 90°</button></div></>}{tool==='door'&&<><label><span>Тип двери</span><select value={doorStyle} onChange={event=>setDoorStyle(event.target.value)}><option value="swing">Распашная</option><option value="double">Двойная</option><option value="sliding">Раздвижная</option></select></label><label><span>Материал</span><select value={doorMaterial} onChange={event=>setDoorMaterial(event.target.value)}><option value="wood">Дерево</option><option value="metal">Металл</option><option value="glass">Стекло</option></select></label></>}{tool==='window'&&<><label><span>Тип окна</span><select value={windowStyle} onChange={event=>setWindowStyle(event.target.value)}><option value="casement">Открывающееся</option><option value="fixed">Глухое</option><option value="panoramic">Панорамное</option></select></label><label><span>Материал</span><select value={windowMaterial} onChange={event=>setWindowMaterial(event.target.value)}><option value="pvc">ПВХ</option><option value="wood">Дерево</option><option value="metal">Алюминий</option></select></label></>}{tool==='roof'&&spec.construction.roof&&<><label><span>Форма крыши</span><select value={roofStyle} onChange={event=>{const value=event.target.value as typeof roofStyle;setRoofStyle(value);changeConstruction(applyConstructionCommand(spec.construction,{type:'set-roof',roof:true,roofStyle:value,roofMaterial}),'Форма крыши изменена')}}><option value="gable">Двускатная</option><option value="hip">Вальмовая</option><option value="flat">Плоская</option></select></label><label><span>Материал крыши</span><select value={roofMaterial} onChange={event=>{const value=event.target.value as typeof roofMaterial;setRoofMaterial(value);changeConstruction(applyConstructionCommand(spec.construction,{type:'set-roof',roof:true,roofStyle,roofMaterial:value}),'Материал крыши изменён')}}><option value="metal">Металл</option><option value="tile">Черепица</option><option value="soft">Мягкая кровля</option></select></label></>}</div>}
    {mode==='build'&&(tool==='door-aperture'||tool==='window-aperture')&&<div className="construction-properties" aria-label={tool==='door-aperture'?'Параметры дверного проёма':'Параметры оконного проёма'}><label><span>Размер проёма</span><select value={apertureSize} onChange={event=>{const size=event.target.value as typeof apertureSize;setApertureSize(size);setDoorStyle(`aperture-${size}`);setWindowStyle(`aperture-${size}`)}}><option value="small">Малый · 1 сегмент</option><option value="large">Большой · 2 сегмента</option></select></label><span>Направление: {wallPlacementRotation===0?'горизонтальное':'вертикальное'}</span><small>Проём ставится только на свободный сегмент без стены. R или К поворачивает его до установки.</small><div className="construction-property-actions"><button type="button" onClick={rotateWallPlaceholder}>Повернуть на 90°</button></div></div>}
    {mode==='build'&&tool==='stairs'&&<div className="construction-properties" aria-label="Форма лестницы"><label><span>Форма лестницы</span><select value={stairShape} onChange={event=>{setStairShape(event.target.value as StairShape);event.currentTarget.blur()}}><option value="straight">Прямая</option><option value="l">Г-образная</option><option value="u">П-образная</option><option value="spiral">Винтовая</option></select></label><span>Поворот placeholder: {stairPlacementRotation}°</span><small>R или К поворачивает лестницу перед установкой. Лестница создаёт проход в полу второго этажа.</small><div className="construction-property-actions"><button type="button" onClick={()=>rotateStairPlaceholder(-1)}>↶ Повернуть влево</button><button type="button" onClick={()=>rotateStairPlaceholder(1)}>Повернуть вправо ↷</button></div></div>}
    {mode==='build'&&tool==='select'&&selectedBuildStair&&<div className="construction-properties" aria-label="Свойства выбранной лестницы"><label><span>Форма лестницы</span><select value={selectedBuildStair.shape} onChange={event=>{changeSelectedStair({shape:event.target.value as StairShape},'Форма лестницы изменена.');event.currentTarget.blur()}}><option value="straight">Прямая</option><option value="l">Г-образная</option><option value="u">П-образная</option><option value="spiral">Винтовая</option></select></label><span>Поворот: {selectedBuildStair.rotation??0}° · клетка {selectedBuildStair.cell.x+1} × {selectedBuildStair.cell.y+1}</span><small>Стрелки перемещают лестницу на 1 метр. R или К поворачивает её вправо.</small><div className="construction-property-actions"><button type="button" aria-label="Переместить лестницу влево" onClick={()=>moveSelectedBuildStair(-1,0)}>←</button><button type="button" aria-label="Переместить лестницу вверх" onClick={()=>moveSelectedBuildStair(0,-1)}>↑</button><button type="button" aria-label="Переместить лестницу вниз" onClick={()=>moveSelectedBuildStair(0,1)}>↓</button><button type="button" aria-label="Переместить лестницу вправо" onClick={()=>moveSelectedBuildStair(1,0)}>→</button></div><div className="construction-property-actions"><button type="button" onClick={()=>rotateSelectedStair(-1)}>↶ Повернуть влево</button><button type="button" onClick={()=>rotateSelectedStair(1)}>Повернуть вправо ↷</button><button type="button" onClick={duplicateSelectedBuildStair} title="Ctrl+D / Ctrl+В">Дублировать</button><button type="button" className="danger-action" onClick={removeSelectedBuildObject}>Удалить</button></div></div>}
    {mode==='build'&&tool==='select'&&buildSelection?.kind==='stairs'&&<div className="construction-properties" aria-label="Выбранные лестницы"><strong>Выбрано лестниц: {selectedBuildStairIndexes.length}</strong><small>Shift + клик добавляет лестницу в группу или убирает её. Delete или Backspace удаляет всю выбранную группу.</small><div className="construction-property-actions"><button type="button" onClick={()=>{setBuildSelection(null);setToolMessage('Выделение лестниц снято.')}}>Снять выделение</button><button type="button" className="danger-action" onClick={removeSelectedBuildObject}>Удалить выбранные</button></div></div>}
    {mode==='build'&&tool==='select'&&(buildSelection?.kind==='fixture'||buildSelection?.kind==='fixtures')&&<div className="construction-properties" aria-label="Выбранные двери или окна"><strong>{selectedBuildFixtures.length===1?(selectedBuildFixtures[0].kind==='door'?'Выбрана дверь':'Выбрано окно'):`Выбрано ${selectedFixtureKind==='door'?'дверей':'окон'}: ${selectedBuildFixtures.length}`}</strong><label><span>Материал {selectedFixtureKind==='door'?'двери':'окна'}</span><select value={selectedFixtureMaterial} onChange={event=>changeSelectedBuildFixtureMaterial(event.target.value)}>{!selectedFixtureMaterial&&<option value="" disabled>Разные материалы</option>}{selectedFixtureKind==='door'?<><option value="wood">Дерево</option><option value="metal">Металл</option><option value="glass">Стекло</option></>:<><option value="pvc">ПВХ</option><option value="wood">Дерево</option><option value="metal">Алюминий</option></>}</select></label><small>Материал меняется сразу. Проём останется на месте. Shift + клик добавляет объекты того же вида, Delete удаляет только дверь или окно.</small><div className="construction-property-actions"><button type="button" onClick={()=>{setBuildSelection(null);setToolMessage('Выделение снято.')}}>Снять выделение</button><button type="button" className="danger-action" onClick={removeSelectedBuildObject}>Удалить заполнение</button></div></div>}
    {mode==='build'&&tool==='select'&&(buildSelection?.kind==='aperture'||buildSelection?.kind==='apertures')&&<div className="construction-properties" aria-label="Выбранные проёмы"><strong>{selectedBuildApertures.length===1?(selectedBuildApertures[0].kind==='door'?'Дверной проём целиком':'Оконный проём целиком'):`Выбрано проёмов: ${selectedBuildApertures.length}`}</strong><small>Выбран весь проём вместе с установленной дверью или окном. Стрелки перемещают, R или К поворачивает, Delete удаляет всё.</small><div className="construction-property-actions"><button type="button" onClick={()=>transformSelectedBuildApertures(0,0,1)}>Повернуть ↷</button><button type="button" onClick={()=>{setBuildSelection(null);setToolMessage('Выделение проёмов снято.')}}>Снять выделение</button><button type="button" className="danger-action" onClick={removeSelectedBuildObject}>Удалить проём целиком</button></div></div>}
    {mode==='build'&&tool==='select'&&selectedBuildOpening&&<div className="construction-properties" aria-label={selectedBuildOpening.kind==='door'?'Свойства выбранной двери':'Свойства выбранного окна'}><label><span>{selectedBuildOpening.kind==='door'?'Тип двери':'Тип окна'}</span><select value={selectedBuildOpening.style??(selectedBuildOpening.kind==='door'?'swing':'casement')} onChange={event=>changeSelectedBuildOpening({style:event.target.value},selectedBuildOpening.kind==='door'?'Тип двери изменён.':'Тип окна изменён.')}>{selectedBuildOpening.kind==='door'?<><option value="swing">Распашная · 1 сегмент</option><option value="double">Двойная · 2 сегмента</option><option value="sliding">Раздвижная · 2 сегмента</option></>:<><option value="casement">Открывающееся · 1 сегмент</option><option value="fixed">Глухое · 1 сегмент</option><option value="panoramic">Панорамное · 2 сегмента</option></>}</select></label><label><span>Материал</span><select value={selectedBuildOpening.material??(selectedBuildOpening.kind==='door'?'wood':'pvc')} onChange={event=>changeSelectedBuildOpening({material:event.target.value},'Материал проёма изменён.')}>{selectedBuildOpening.kind==='door'?<><option value="wood">Дерево</option><option value="metal">Металл</option><option value="glass">Стекло</option></>:<><option value="pvc">ПВХ</option><option value="wood">Дерево</option><option value="metal">Алюминий</option></>}</select></label><small>{movingBuildOpening?'Выберите новый свободный сегмент стены. Для широкого проёма требуются два соседних сегмента. Escape отменяет перенос.':`Проём занимает ${constructionOpeningWidth(selectedBuildOpening)} ${constructionOpeningWidth(selectedBuildOpening)===1?'сегмент':'сегмента'} стены. Перетаскивайте его целиком; Delete удаляет проём.`}</small><div className="construction-property-actions"><button type="button" aria-pressed={movingBuildOpening} onClick={()=>{setMovingBuildOpening(value=>!value);setToolMessage(movingBuildOpening?'Перенос проёма отменён.':'Выберите свободную стену для переноса проёма.')}}>{movingBuildOpening?'Отменить перенос':'Перенести проём'}</button><button type="button" onClick={duplicateSelectedBuildOpening} title="Ctrl+D / Ctrl+В">Дублировать</button><button type="button" onClick={selectWallWithOpening}>Выбрать стену</button><button type="button" className="danger-action" onClick={removeSelectedBuildObject}>Удалить проём</button></div></div>}
    {mode==='build'&&tool==='select'&&buildSelection?.kind==='openings'&&<div className="construction-properties" aria-label="Выбранные двери и окна"><strong>Выбрано дверей и окон: {selectedBuildOpeningKeys.length}</strong><small>Shift + клик добавляет проём в группу или убирает его. Delete или Backspace удаляет всю группу, сохраняя стены.</small><div className="construction-property-actions"><button type="button" onClick={()=>{setBuildSelection(null);setToolMessage('Выделение дверей и окон снято.')}}>Снять выделение</button><button type="button" className="danger-action" onClick={removeSelectedBuildObject}>Удалить выбранные</button></div></div>}
    {mode==='build'&&tool==='select'&&buildSelection?.kind==='roof'&&spec.construction.roof&&<div className="construction-properties" aria-label="Свойства выбранной крыши"><strong>Крыша выбрана</strong><label><span>Форма крыши</span><select value={spec.construction.roofStyle??'gable'} onChange={event=>{const value=event.target.value as typeof roofStyle;setRoofStyle(value);changeConstruction(applyConstructionCommand(spec.construction,{type:'set-roof',roof:true,roofStyle:value,roofMaterial:spec.construction.roofMaterial??roofMaterial}),'Форма крыши изменена.')}}><option value="gable">Двускатная</option><option value="hip">Вальмовая</option><option value="flat">Плоская</option></select></label><label><span>Материал крыши</span><select value={spec.construction.roofMaterial??'metal'} onChange={event=>{const value=event.target.value as typeof roofMaterial;setRoofMaterial(value);changeConstruction(applyConstructionCommand(spec.construction,{type:'set-roof',roof:true,roofStyle:spec.construction.roofStyle??roofStyle,roofMaterial:value}),'Материал крыши изменён.')}}><option value="metal">Металл</option><option value="tile">Черепица</option><option value="soft">Мягкая кровля</option></select></label><small>Delete или Backspace удаляет крышу.</small><div className="construction-property-actions"><button type="button" onClick={()=>{setBuildSelection(null);setToolMessage('Выделение снято.')}}>Снять выделение</button><button type="button" className="danger-action" onClick={removeSelectedBuildObject}>Удалить крышу</button></div></div>}
    {mode==='build'&&tool==='select'&&selectedBuildCells.length>0&&<div className="construction-properties" aria-label="Свойства выбранного пола"><strong>{selectedBuildCells.length===1?'Выбран 1 м² пола':`Выбрано пола: ${selectedBuildCells.length} м²`}</strong><label><span>Материал пола</span><select value={selectedCellMaterial} onChange={event=>changeSelectedBuildCells(event.target.value as NonNullable<FoundationCell['material']>)}>{!selectedCellMaterial&&<option value="" disabled>Разные материалы</option>}<option value="concrete">Монолит</option><option value="slab">Плиты</option><option value="wood">Дерево</option></select></label><small>Протяните рамку для выбора области. Shift или Ctrl добавляет клетки к выделению.</small><div className="construction-property-actions"><button type="button" onClick={()=>{setBuildSelection(null);setToolMessage('Выделение снято.')}}>Снять выделение</button><button type="button" className="danger-action" onClick={removeSelectedBuildObject}>Удалить пол</button></div></div>}
    {mode==='build'&&tool==='select'&&(!buildSelection||buildSelection.kind==='walls')&&<div className="construction-properties" aria-label="Выбор стен"><strong>{selectedBuildWalls.length>0?`Выбрано стен: ${selectedBuildWalls.length}`:'Выберите стену или клетку пола'}</strong><small>Клик выбирает объект, Shift + клик добавляет его. Стрелки сдвигают стены, R или К поворачивает их вправо.</small>{selectedBuildWalls.length>0&&<><label><span>Материал выбранных стен</span><select value={selectedWallMaterial} onChange={event=>changeSelectedBuildWall(event.target.value as NonNullable<ConstructionWall['material']>)}>{!selectedWallMaterial&&<option value="" disabled>Разные материалы</option>}<option value="aerated">Газобетон</option><option value="brick">Кирпич</option><option value="frame">Каркас</option><option value="timber">Брус</option></select></label><span>Сдвинуть на 1 метр</span><div className="construction-property-actions"><button type="button" aria-label="Сдвинуть стены влево" onClick={()=>moveSelectedBuildWalls(-1,0)}>←</button><button type="button" aria-label="Сдвинуть стены вверх" onClick={()=>moveSelectedBuildWalls(0,-1)}>↑</button><button type="button" aria-label="Сдвинуть стены вниз" onClick={()=>moveSelectedBuildWalls(0,1)}>↓</button><button type="button" aria-label="Сдвинуть стены вправо" onClick={()=>moveSelectedBuildWalls(1,0)}>→</button></div><div className="construction-property-actions"><button type="button" onClick={()=>rotateSelectedBuildWalls(-1)}>↶ Повернуть влево</button><button type="button" onClick={()=>rotateSelectedBuildWalls(1)}>Повернуть вправо ↷</button></div><div className="construction-property-actions"><button type="button" onClick={duplicateSelectedBuildWalls} title="Ctrl+D / Ctrl+В">Дублировать</button><button type="button" onClick={()=>{setBuildSelection(null);setToolMessage('Выделение снято.')}}>Снять выделение</button><button type="button" className="danger-action" onClick={removeSelectedBuildObject}>Удалить выбранные</button></div></>}</div>}
    <Canvas shadows camera={{position:[15,13,18],fov:48}} onPointerMissed={()=>{if(mode==='build'){setBuildSelection(null);setMovingBuildOpening(false);window.dispatchEvent(new Event('domovid-clear-construction-selection'));setToolMessage('Выделение снято. Активный инструмент сохранён.')}}}>
      <color attach="background" args={['#e7dfd1']}/><ambientLight intensity={1.25}/><directionalLight castShadow position={[7,12,8]} intensity={1.8} shadow-mapSize={[1024,1024]}/>
      {mode==='build'?<ConstructionScene model={spec.construction} tool={tool as BuildTool|null} level={buildLevel} showRoof={false} floorMaterial={floorMaterial} wallMaterial={buildWallMaterial} wallRotation={wallPlacementRotation} openingStyle={tool==='door'?doorStyle:windowStyle} openingMaterial={tool==='door'?doorMaterial:windowMaterial} stairShape={stairShape} stairRotation={stairPlacementRotation} selection={buildSelection} movingOpening={movingBuildOpening} onStartMovingOpening={()=>setMovingBuildOpening(true)} onMoveOpening={moveSelectedBuildOpening} onChange={changeConstruction} onMessage={setToolMessage} onSelect={setBuildSelection}/>:<group>{exteriorLevels.map(level=><group key={level} position={[0,(level-1)*constructionStoreyHeight,0]}><ConstructionScene model={spec.construction} tool={null} level={level} showRoof={roofVisible&&level===exteriorTopLevel} floorMaterial={floorMaterial} wallMaterial={buildWallMaterial} wallRotation={0} openingStyle="" openingMaterial="" stairShape={stairShape} stairRotation={0} selection={null} movingOpening={false} onStartMovingOpening={()=>{}} onMoveOpening={()=>{}} onChange={changeConstruction} onMessage={setToolMessage} onSelect={setBuildSelection}/></group>)}</group>}
      <Grid args={[gridWidth,gridDepth]} position={[gridX,-.02,gridZ]} cellSize={1} cellThickness={.8} cellColor="#b3a897" sectionSize={5} sectionThickness={1.25} sectionColor="#8f8170" fadeDistance={Math.max(28,constructionWidth*1.4)} fadeStrength={1} infiniteGrid={false}/><OrbitControls ref={orbitControlsRef} makeDefault mouseButtons={{LEFT:mode==='build'&&tool&&tool!=='roof'?undefined:MOUSE.PAN,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.ROTATE}} minDistance={7} maxDistance={Math.max(34,constructionWidth*2)} maxPolarAngle={Math.PI/2.05} target={[0,2.6,0]}/><KeyboardCameraControls controlsRef={orbitControlsRef} allowArrows={!(mode==='build'&&tool==='select'&&Boolean(buildSelection))}/>
    </Canvas>
    {toolMessage&&<div className="three-tool-message" role="status">{toolMessage}</div>}
    <div className="model-caption"><span>{mode==='build'?(tool?`${spec.construction.cells.length} участков · ${spec.construction.cells.length} м² · область ${constructionWidth} × ${constructionDepth} м · ПКМ — вращение`:'Левая кнопка — перемещение · правая — вращение · колесо — масштаб'):`Область ${constructionWidth} × ${constructionDepth} м · левая кнопка — перемещение · правая — вращение`}</span></div>
    <span className="concept-label">{mode==='build'?'Свободное строительство':'Просмотр дома с улицы'}</span>
  </div>
}
