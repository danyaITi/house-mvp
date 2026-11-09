export const CONSTRUCTION_RULES={
  foundation:{foundationCells:1,description:'Одна клетка фундамента занимает 1 м².'},
  floor:{foundationCells:1,description:'Одна секция пола занимает 1 клетку.'},
  wall:{foundationCells:1,wallSegments:1,description:'Одна стеновая секция занимает 1 сегмент и требует опору минимум на одной клетке.'},
  stairs:{foundationCells:1,description:'Одна лестница занимает 1 клетку фундамента и создаёт проход на следующем этаже.'},
  door:{
    swing:{wallSegments:1,description:'Распашная дверь занимает 1 сегмент стены.'},
    double:{wallSegments:2,description:'Двойная дверь занимает 2 соседних сегмента стены.'},
    sliding:{wallSegments:2,description:'Раздвижная дверь занимает 2 соседних сегмента стены.'},
  },
  window:{
    casement:{wallSegments:1,description:'Открывающееся окно занимает 1 сегмент стены.'},
    fixed:{wallSegments:1,description:'Глухое окно занимает 1 сегмент стены.'},
    panoramic:{wallSegments:2,description:'Панорамное окно занимает 2 соседних сегмента стены.'},
  },
  roof:{description:'Крыша занимает габариты всех построенных клеток верхнего этажа.'},
} as const

export type DoorRuleStyle=keyof typeof CONSTRUCTION_RULES.door
export type WindowRuleStyle=keyof typeof CONSTRUCTION_RULES.window

export function openingSegmentCount(kind:'door'|'window',style?:string):1|2{
  if(style==='aperture-large')return 2
  if(style==='aperture-small')return 1
  if(kind==='door')return style==='double'||style==='sliding'?CONSTRUCTION_RULES.door.double.wallSegments:CONSTRUCTION_RULES.door.swing.wallSegments
  return style==='panoramic'?CONSTRUCTION_RULES.window.panoramic.wallSegments:CONSTRUCTION_RULES.window.casement.wallSegments
}

export function constructionRuleSummary(){
  return [CONSTRUCTION_RULES.foundation.description,CONSTRUCTION_RULES.floor.description,CONSTRUCTION_RULES.wall.description,CONSTRUCTION_RULES.stairs.description,...Object.values(CONSTRUCTION_RULES.door).map(rule=>rule.description),...Object.values(CONSTRUCTION_RULES.window).map(rule=>rule.description),CONSTRUCTION_RULES.roof.description]
}
