import type {ConstructionModel,StandaloneAperture} from './constructionModel'

export function planApertureLine(aperture:StandaloneAperture,dx=0,dy=0){
  const span=aperture.size==='large'?2:1,x1=aperture.x+dx,y1=aperture.y+dy
  return {x1,y1,x2:aperture.axis==='h'?x1+span:x1,y2:aperture.axis==='v'?y1+span:y1}
}

export function planApertureFixtureLine(aperture:StandaloneAperture,inset=.06){
  if(!aperture.fixture)return null
  const {x1,y1,x2,y2}=planApertureLine(aperture)
  return {
    x1:x1+(aperture.axis==='h'?inset:0),
    y1:y1+(aperture.axis==='v'?inset:0),
    x2:x2-(aperture.axis==='h'?inset:0),
    y2:y2-(aperture.axis==='v'?inset:0),
  }
}

export function stairOpeningsAtLevel(model:ConstructionModel,level:number){
  return (model.stairs??[]).map((stair,index)=>({stair,index})).filter(({stair})=>(stair.cell.level??1)+1===level)
}
