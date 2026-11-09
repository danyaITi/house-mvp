import type {StairShape} from '../construction/constructionModel'

export function FoundationSlab({selected,hovered,material}:{selected:boolean;hovered:boolean;material?:'concrete'|'slab'|'wood'}){
  const color=selected?'#8fb9c7':hovered?'#6e9ca3':material==='wood'?'#9a744f':material==='slab'?'#aaa69e':'#b9ad9a'
  return <><boxGeometry args={[selected||hovered?1:.96,selected?.2:hovered?.19:.16,selected||hovered?1:.96]}/><meshStandardMaterial color={color} emissive={selected?'#315f70':hovered?'#244f56':'#000000'} emissiveIntensity={selected?.25:hovered?.18:0} roughness={.9}/></>
}

export function StairSteps({shape,color,emissive='#000000',emissiveIntensity=0}:{shape:StairShape;color:string;emissive?:string;emissiveIntensity?:number}){
  const steps=shape==='spiral'?6:5
  return <>{Array.from({length:steps},(_,step)=>{const t=step/(steps-1),angle=shape==='spiral'?t*Math.PI*1.5:0,px=shape==='spiral'?Math.cos(angle)*.25:shape==='l'&&step>2?(step-2)*.15-.15:0,pz=shape==='spiral'?Math.sin(angle)*.25:shape==='u'&&step>2?.28-t*.22:-.34+t*.68;return <mesh key={step} position={[px,.1+step*.12,pz]} rotation={[0,shape==='spiral'?-angle:shape==='l'&&step>2?Math.PI/2:0,0]}><boxGeometry args={[.58,.12,.18]}/><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={.7}/></mesh>})}</>
}

export function StairOpening(){
  return <>{[[-.43,0,.05,.86],[.43,0,.05,.86],[0,-.43,.86,.05],[0,.43,.86,.05]].map(([px,pz,sx,sz],part)=><mesh key={part} position={[px,.03,pz]}><boxGeometry args={[sx,.08,sz]}/><meshStandardMaterial color="#5b5146"/></mesh>)}</>
}

export function OpeningPanel({axis,width,height,color,emissive='#000000',emissiveIntensity=0,wireframe=false,transparent=false,opacity=1,metalness=.08}:{axis:'h'|'v';width:number;height:number;color:string;emissive?:string;emissiveIntensity?:number;wireframe?:boolean;transparent?:boolean;opacity?:number;metalness?:number}){
  return <mesh><boxGeometry args={axis==='h'?[width-.04,height-.05,.15]:[.15,height-.05,width-.04]}/>{wireframe?<meshBasicMaterial color={color} wireframe transparent opacity={opacity} depthTest={false}/>:<meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} transparent={transparent} opacity={opacity} metalness={metalness} roughness={.35}/>}</mesh>
}

export function ApertureFrame({axis,span,cutHeight,cutBottom,color,outlineOnly=false}:{axis:'h'|'v';span:number;cutHeight:number;cutBottom:number;kind:'door'|'window';color:string;filled?:boolean;outlineOnly?:boolean}){
  const fullHeight=2.7,horizontal=axis==='h',thickness=.12,depth=.11,jambSize=horizontal?[thickness,fullHeight,depth] as const:[depth,fullHeight,thickness] as const,panelSize=(height:number)=>horizontal?[span,height,depth] as const:[depth,height,span] as const
  const along=(offset:number)=>horizontal?[offset,0,0] as const:[0,0,offset] as const
  return <group>
    <mesh position={along(-span/2+thickness/2)} castShadow><boxGeometry args={jambSize}/>{outlineOnly?<meshBasicMaterial color={color} wireframe depthTest={false}/>:<meshStandardMaterial color={color} roughness={.56}/>}</mesh>
    <mesh position={along(span/2-thickness/2)} castShadow><boxGeometry args={jambSize}/>{outlineOnly?<meshBasicMaterial color={color} wireframe depthTest={false}/>:<meshStandardMaterial color={color} roughness={.56}/>}</mesh>
    {fullHeight-cutBottom-cutHeight>0&&<mesh position={[0,(cutBottom+cutHeight+(fullHeight-cutBottom-cutHeight)/2)-fullHeight/2,0]} castShadow><boxGeometry args={panelSize(fullHeight-cutBottom-cutHeight)}/>{outlineOnly?<meshBasicMaterial color={color} wireframe depthTest={false}/>:<meshStandardMaterial color={color} roughness={.64}/>}</mesh>}
    {cutBottom>0&&<mesh position={[0,cutBottom/2-fullHeight/2,0]} castShadow><boxGeometry args={panelSize(cutBottom)}/>{outlineOnly?<meshBasicMaterial color={color} wireframe depthTest={false}/>:<meshStandardMaterial color={color} roughness={.64}/>}</mesh>}
    <mesh position={[0,cutBottom+cutHeight/2-fullHeight/2,0]}><boxGeometry args={horizontal?[span-.08,cutHeight,.08]:[.08,cutHeight,span-.08]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
  </group>
}

export type WallCut={center:number;width:number;bottom:number;height:number}

export function WallWithOpenings({length,height,base,x,z,vertical,color,cuts}:{length:number;height:number;base:number;x:number;z:number;vertical:boolean;color:string;cuts:WallCut[]}){
  const pieces:{center:number;width:number;bottom:number;height:number}[]=[]
  let cursor=-length/2
  for(const cut of [...cuts].sort((a,b)=>a.center-b.center)){
    const left=Math.max(-length/2,cut.center-cut.width/2),right=Math.min(length/2,cut.center+cut.width/2)
    if(left>cursor+.03)pieces.push({center:(cursor+left)/2,width:left-cursor,bottom:0,height})
    if(cut.bottom>.03)pieces.push({center:(left+right)/2,width:right-left,bottom:0,height:cut.bottom})
    const top=cut.bottom+cut.height
    if(top<height-.03)pieces.push({center:(left+right)/2,width:right-left,bottom:top,height:height-top})
    cursor=Math.max(cursor,right)
  }
  if(cursor<length/2-.03)pieces.push({center:(cursor+length/2)/2,width:length/2-cursor,bottom:0,height})
  return <>{pieces.map((piece,index)=><mesh key={index} position={vertical?[x,base+piece.bottom+piece.height/2,z+piece.center]:[x+piece.center,base+piece.bottom+piece.height/2,z]} castShadow receiveShadow><boxGeometry args={vertical?[.11,piece.height,piece.width]:[piece.width,piece.height,.11]}/><meshStandardMaterial color={color} roughness={.82}/></mesh>)}</>
}

export function ConstructionRoof({style,material,width,depth,color,emissive,emissiveIntensity,onPointerOver,onPointerOut,onPointerDown}:{style:'gable'|'hip'|'flat';material:'metal'|'tile'|'soft';width:number;depth:number;color:string;emissive:string;emissiveIntensity:number;onPointerOver:(event:any)=>void;onPointerOut:()=>void;onPointerDown:(event:any)=>void}){
  const roofWidth=width+.5,roofDepth=depth+.5,baseY=2.76
  const surface=(shade=color)=><meshStandardMaterial color={shade} emissive={emissive} emissiveIntensity={emissiveIntensity} metalness={material==='metal'?.24:.02} roughness={material==='soft'?.9:.72}/>
  if(style==='flat')return <mesh position={[0,baseY+.09,0]} castShadow receiveShadow onPointerOver={onPointerOver} onPointerOut={onPointerOut} onPointerDown={onPointerDown}><boxGeometry args={[roofWidth,.18,roofDepth]}/>{surface()}</mesh>
  if(style==='hip')return <mesh position={[0,baseY+.48,0]} rotation={[0,Math.PI/4,0]} scale={[roofWidth/Math.SQRT2,1,roofDepth/Math.SQRT2]} castShadow receiveShadow onPointerOver={onPointerOver} onPointerOut={onPointerOut} onPointerDown={onPointerDown}><coneGeometry args={[1,.96,4]}/>{surface()}</mesh>
  const run=roofWidth/2,rise=Math.min(1.25,Math.max(.65,run*.28)),angle=Math.atan2(rise,run),slope=Math.hypot(run,rise)
  return <group onPointerOver={onPointerOver} onPointerOut={onPointerOut} onPointerDown={onPointerDown}>
    <mesh position={[-run/2,baseY+rise/2,0]} rotation={[0,0,angle]} castShadow receiveShadow><boxGeometry args={[slope,.16,roofDepth]}/>{surface()}</mesh>
    <mesh position={[run/2,baseY+rise/2,0]} rotation={[0,0,-angle]} castShadow receiveShadow><boxGeometry args={[slope,.16,roofDepth]}/>{surface()}</mesh>
  </group>
}
