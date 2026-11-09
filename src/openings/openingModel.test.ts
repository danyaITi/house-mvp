import {describe,expect,it} from 'vitest'
import {addDoor,defaultDoorConfig,doorsForPair,hasOpenWall,removeDoor,setWallOpen,updateDoor} from './openingModel'

describe('door objects',()=>{
  it('keeps a legacy door visible before migration',()=>{
    const doors=doorsForPair([],{},'kitchen','hall')
    expect(doors).toEqual([{id:'hall::kitchen',roomA:'kitchen',roomB:'hall',...defaultDoorConfig}])
  })

  it('migrates the legacy door and adds a second independent door',()=>{
    const doors=addDoor([],{},'kitchen','hall',{offset:.75,width:1.2,kind:'double'},'door:new',true)
    expect(doors).toHaveLength(2)
    expect(doors.map(door=>door.id)).toEqual(['door:legacy:hall::kitchen','door:new'])
  })

  it('moves only the selected door',()=>{
    const doors=addDoor([],{},'kitchen','hall',{offset:.75,width:.9,kind:'swing'},'door:new',true)
    const moved=updateDoor(doors,'door:new',{offset:.2,width:.9,kind:'swing'})
    expect(moved[0].offset).toBe(.5)
    expect(moved[1].offset).toBe(.2)
  })

  it('removes only the selected door',()=>{
    const doors=addDoor([],{},'kitchen','hall',{offset:.75,width:.9,kind:'swing'},'door:new',true)
    expect(removeDoor(doors,'door:new').map(door=>door.id)).toEqual(['door:legacy:hall::kitchen'])
  })

  it('removes and restores one shared wall without changing other walls',()=>{
    const opened=setWallOpen([{a:'bedroom',b:'hall'}],'kitchen','living',true)
    expect(hasOpenWall(opened,'living','kitchen')).toBe(true)
    expect(hasOpenWall(opened,'bedroom','hall')).toBe(true)
    expect(setWallOpen(opened,'living','kitchen',false)).toEqual([{a:'bedroom',b:'hall'}])
  })
})
