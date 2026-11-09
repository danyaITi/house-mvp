export type BuildTool='select'|'foundation'|'build-wall'|'door'|'window'|'door-aperture'|'window-aperture'|'stairs'|'roof'|'erase'
export type CatalogTool=Exclude<BuildTool,'select'|'erase'>
export type ConstructionToolGroup='Основа'|'Проёмы'|'Этажи'

export const constructionTools:{tool:CatalogTool;label:string;hint:string;group:ConstructionToolGroup}[]=[
  {tool:'foundation',label:'Фундамент',hint:'Площадь по клеткам',group:'Основа'},
  {tool:'build-wall',label:'Стена',hint:'Сегмент 1 метр',group:'Основа'},
  {tool:'door-aperture',label:'Дверной проём',hint:'На 1 или 2 сегмента',group:'Проёмы'},
  {tool:'window-aperture',label:'Оконный проём',hint:'На 1 или 2 сегмента',group:'Проёмы'},
  {tool:'door',label:'Дверь',hint:'В готовый проём',group:'Проёмы'},
  {tool:'window',label:'Окно',hint:'В готовый проём',group:'Проёмы'},
  {tool:'stairs',label:'Лестница',hint:'Проход между этажами',group:'Этажи'},
  {tool:'roof',label:'Крыша',hint:'Форма и материал',group:'Этажи'},
]

export const constructionToolGroups:ConstructionToolGroup[]=['Основа','Проёмы','Этажи']

export function constructionToolLabel(tool:CatalogTool,level:number){
  return tool==='foundation'&&level>1?'Пол':constructionTools.find(item=>item.tool===tool)?.label??''
}

export function ConstructionToolIcon({tool}:{tool:CatalogTool}){
  const common={fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round' as const,strokeLinejoin:'round' as const}
  return <svg viewBox="0 0 48 36" aria-hidden="true" focusable="false">
    {tool==='foundation'&&<><path {...common} d="M7 13 23 6l18 8-17 9z"/><path {...common} d="m7 13 .2 9 17 8 16.8-9v-7M15 9.5l17.5 8.2M15.5 26l16.8-9"/></>}
    {tool==='build-wall'&&<><path {...common} d="M8 29V8h32v21"/><path {...common} d="M8 15h32M8 22h32M18 8v7m12 0v7m-12 0v7m12-7v7"/></>}
    {tool==='door'&&<><path {...common} d="M11 30V6h25v24M17 30V11h14v19"/><path {...common} d="M18 29c8 0 13-5 13-13M27 20h.1"/></>}
    {tool==='window'&&<><rect {...common} x="8" y="6" width="32" height="24" rx="1"/><path {...common} d="M24 6v24M8 18h32M11 27 21 19m16 8-10-8"/></>}
    {tool==='door-aperture'&&<><path {...common} d="M7 30V6h34v24M12 30V11h24v19"/><path {...common} d="M12 11h24" strokeDasharray="2.5 2.5"/></>}
    {tool==='window-aperture'&&<><path {...common} d="M7 30V6h34v24M12 26V11h24v15M12 26h24"/><path {...common} d="M12 11h24" strokeDasharray="2.5 2.5"/></>}
    {tool==='stairs'&&<><path {...common} d="M7 29h7v-5h7v-5h7v-5h7V9h7"/><path {...common} d="M9 25 34 7m0 0h-7m7 0v7"/></>}
    {tool==='roof'&&<><path {...common} d="m5 20 19-13 19 13M10 18v12h28V18M24 7v23"/><path {...common} d="m16 14 8 6 8-6"/></>}
  </svg>
}
