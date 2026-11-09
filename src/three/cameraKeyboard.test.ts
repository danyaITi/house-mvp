import {describe,expect,it} from 'vitest'
import {cameraMovementFromKeys,isCameraMovementKey} from './cameraKeyboard'

describe('keyboard camera movement',()=>{
  it('maps WASD and arrow keys to the same directions',()=>{
    expect(cameraMovementFromKeys(new Set(['KeyW','KeyD']))).toEqual({forward:1,right:1})
    expect(cameraMovementFromKeys(new Set(['ArrowUp','ArrowRight']))).toEqual({forward:1,right:1})
  })

  it('can reserve arrow keys for selected construction objects',()=>{
    expect(cameraMovementFromKeys(new Set(['ArrowLeft']),false)).toEqual({forward:0,right:0})
    expect(cameraMovementFromKeys(new Set(['KeyA']),false)).toEqual({forward:0,right:-1})
    expect(isCameraMovementKey('KeyR')).toBe(false)
  })
})
