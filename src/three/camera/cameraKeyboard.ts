/** Направление перемещения камеры относительно её взгляда. */
export type CameraMove = { forward: number; right: number }

/** Суммирует WASD и стрелки в направления движения камеры. */
export function cameraMovementFromKeys(keys: ReadonlySet<string>, allowArrows = true): CameraMove {
  // Направление камеры в горизонтальной плоскости.
  const forward =
    (keys.has('KeyW') || (allowArrows && keys.has('ArrowUp')) ? 1 : 0) -
    (keys.has('KeyS') || (allowArrows && keys.has('ArrowDown')) ? 1 : 0)
  // Граница участка либо индекс сравниваемого элемента.
  const right =
    (keys.has('KeyD') || (allowArrows && keys.has('ArrowRight')) ? 1 : 0) -
    (keys.has('KeyA') || (allowArrows && keys.has('ArrowLeft')) ? 1 : 0)
  return { forward, right }
}

/** Распознаёт клавиши WASD и разрешённые стрелки для движения камеры. */
export function isCameraMovementKey(code: string) {
  return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)
}
