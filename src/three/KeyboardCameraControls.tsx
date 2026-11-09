import {useFrame, useThree} from '@react-three/fiber'
import {useEffect, useRef, type RefObject} from 'react'
import {Vector3} from 'three'
import {cameraMovementFromKeys,isCameraMovementKey} from './cameraKeyboard'

export function KeyboardCameraControls({controlsRef,allowArrows=true}:{controlsRef:RefObject<any>;allowArrows?:boolean}){
  const camera=useThree(state=>state.camera)
  const pressed=useRef(new Set<string>())

  useEffect(()=>{
    const editable=(target:EventTarget|null)=>{const element=target as HTMLElement|null;return Boolean(element&&(['INPUT','TEXTAREA','SELECT'].includes(element.tagName)||element.isContentEditable))}
    const down=(event:KeyboardEvent)=>{
      if(editable(event.target)||event.ctrlKey||event.metaKey||event.altKey||!isCameraMovementKey(event.code))return
      if(!allowArrows&&event.code.startsWith('Arrow'))return
      event.preventDefault()
      pressed.current.add(event.code)
    }
    const up=(event:KeyboardEvent)=>pressed.current.delete(event.code)
    const clear=()=>pressed.current.clear()
    window.addEventListener('keydown',down)
    window.addEventListener('keyup',up)
    window.addEventListener('blur',clear)
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear)}
  },[allowArrows])

  useFrame((_,delta)=>{
    const movement=cameraMovementFromKeys(pressed.current,allowArrows)
    if(!movement.forward&&!movement.right)return
    const controls=controlsRef.current
    const target=controls?.target as Vector3|undefined
    const forward=new Vector3()
    if(target)forward.subVectors(target,camera.position)
    else camera.getWorldDirection(forward)
    forward.y=0
    if(forward.lengthSq()<1e-6)forward.set(0,0,-1)
    forward.normalize()
    const right=new Vector3().crossVectors(forward,camera.up).normalize()
    const distance=target?camera.position.distanceTo(target):10
    const speed=Math.max(2.5,Math.min(12,distance*.55))*delta
    const offset=forward.multiplyScalar(movement.forward*speed).add(right.multiplyScalar(movement.right*speed))
    camera.position.add(offset)
    target?.add(offset)
    controls?.update?.()
  })

  return null
}
