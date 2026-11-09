import {describe,expect,it} from 'vitest'
import {historyShortcut} from './historyShortcuts'

const key=(change:Partial<Parameters<typeof historyShortcut>[0]>)=>historyShortcut({ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,code:'',key:'',...change})

describe('history shortcuts',()=>{
  it('поддерживает Alt + Z и Alt + Y',()=>{
    expect(key({altKey:true,code:'KeyZ',key:'z'})).toBe('undo')
    expect(key({altKey:true,code:'KeyY',key:'y'})).toBe('redo')
  })

  it('сохраняет стандартные Ctrl-сочетания',()=>{
    expect(key({ctrlKey:true,code:'KeyZ',key:'z'})).toBe('undo')
    expect(key({ctrlKey:true,shiftKey:true,code:'KeyZ',key:'z'})).toBe('redo')
    expect(key({ctrlKey:true,code:'KeyY',key:'y'})).toBe('redo')
  })

  it('не перехватывает Z и Y без модификатора',()=>{
    expect(key({code:'KeyZ',key:'z'})).toBeNull()
    expect(key({code:'KeyY',key:'y'})).toBeNull()
  })
})
