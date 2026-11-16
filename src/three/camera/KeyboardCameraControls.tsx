import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import { Vector3 } from 'three'
import { cameraMovementFromKeys, isCameraMovementKey } from '@/three/camera/cameraKeyboard'

/** Двигает камеру и её цель по зажатым клавишам в каждом кадре. */
export function KeyboardCameraControls({
  controlsRef,
  allowArrows = true,
}: {
  /** Ссылка на управление камерой и точкой её наблюдения. */
  controlsRef: RefObject<any>
  /** Разрешает перемещение камеры стрелками клавиатуры. */
  allowArrows?: boolean
}) {
  // Камера текущей трёхмерной сцены.
  const camera = useThree((state) => state.camera)
  // Зажатые клавиши движения камеры.
  const pressed = useRef(new Set<string>())

  useEffect(() => {
    /** Определяет, находится ли фокус в редактируемом поле. */
    const editable = (target: EventTarget | null) => {
      // Элемент интерфейса для проверки редактируемого ввода.
      const element = target as HTMLElement | null
      return Boolean(
        element && (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable),
      )
    }
    /** Запоминает нажатую клавишу движения, исключая ввод в полях. */
    const down = (event: KeyboardEvent) => {
      if (
        editable(event.target) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !isCameraMovementKey(event.code)
      )
        return
      // При выделении объекта стрелки перемещают его, а клавиши управления камерой продолжают двигать камеру.
      if (!allowArrows && event.code.startsWith('Arrow')) return
      event.preventDefault()
      pressed.current.add(event.code)
    }
    /** Убирает отпущенную клавишу из списка активного движения. */
    const up = (event: KeyboardEvent) => pressed.current.delete(event.code)
    /** Сбрасывает зажатые клавиши при потере фокуса окна. */
    const clear = () => pressed.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [allowArrows])

  useFrame((_, delta) => {
    // Направления движения, рассчитанные по зажатым клавишам.
    const movement = cameraMovementFromKeys(pressed.current, allowArrows)
    if (!movement.forward && !movement.right) return
    // Управление камерой и её точкой наблюдения.
    const controls = controlsRef.current
    // Целевой объект или точка текущего действия.
    const target = controls?.target as Vector3 | undefined
    // Смещение идёт по горизонтальной плоскости относительно взгляда, сохраняя высоту и радиус обзора.
    const forward = new Vector3()
    if (target) forward.subVectors(target, camera.position)
    else camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1)
    forward.normalize()
    // Граница участка либо индекс сравниваемого элемента.
    const right = new Vector3().crossVectors(forward, camera.up).normalize()
    // Расстояние между сравниваемыми положениями.
    const distance = target ? camera.position.distanceTo(target) : 10
    // Скорость перемещения камеры с учётом времени кадра.
    const speed = Math.max(2.5, Math.min(12, distance * 0.55)) * delta
    // Вектор смещения, применяемый к камере и её цели.
    const offset = forward
      .multiplyScalar(movement.forward * speed)
      .add(right.multiplyScalar(movement.right * speed))
    camera.position.add(offset)
    target?.add(offset)
    controls?.update?.()
  })

  return null
}
