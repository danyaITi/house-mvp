import {describe,expect,it} from 'vitest'
import {canExtendSelection,openingClickTarget,SAME_KIND_SELECTION_MESSAGE,selectKey,selectSameKind,singleSelection} from './constructionSelection'

describe('construction selection',()=>{
  it('обычный клик заменяет текущее выделение',()=>{
    expect(selectKey(['wall-a','wall-b'],'opening-c',false)).toEqual(['opening-c'])
  })

  it('Shift + клик добавляет и повторным кликом убирает объект',()=>{
    const selected=selectKey(['door-a'],'window-b',true)
    expect(selected).toEqual(['door-a','window-b'])
    expect(selectKey(selected,'door-a',true)).toEqual(['window-b'])
  })

  it('одиночный редактор доступен только для одного объекта',()=>{
    expect(singleSelection(['stair-a'])).toBe('stair-a')
    expect(singleSelection(['stair-a','stair-b'])).toBeNull()
    expect(singleSelection([])).toBeNull()
  })

  it('Alt + клик по проёму адресуется стене',()=>{
    expect(openingClickTarget(false)).toBe('opening')
    expect(openingClickTarget(true)).toBe('wall')
  })

  it('не смешивает двери и окна в одном выделении',()=>{
    const kinds:Record<string,'door'|'window'>={'door-a':'door','door-b':'door','window-a':'window'}
    expect(selectSameKind(['door-a'],'door-b',true,key=>kinds[key])).toEqual({keys:['door-a','door-b'],accepted:true})
    expect(selectSameKind(['door-a'],'window-a',true,key=>kinds[key])).toEqual({keys:['door-a'],accepted:false})
  })

  it('не разрешает расширять выделение объектом другого вида',()=>{
    expect(canExtendSelection('wall','wall')).toBe(true)
    expect(canExtendSelection(null,'stair')).toBe(true)
    expect(canExtendSelection('wall','foundation')).toBe(false)
    expect(canExtendSelection('stair','door')).toBe(false)
  })

  it('использует единое сообщение для всех конфликтов выбора',()=>{
    expect(SAME_KIND_SELECTION_MESSAGE).toBe('Можно одновременно выбирать только объекты одного вида. Сначала снимите текущее выделение.')
  })
})
