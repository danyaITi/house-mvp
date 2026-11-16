import styles from '@/components/house-canvas/HouseCanvas.module.css'
import { Suspense, lazy, useMemo } from 'react'
import type { HouseSpec } from '@/domain/house/houseTypes'
import { applyRoomOverrides, buildCoordinateLayout, generateRoomPlan } from '@/domain/room-plan/roomPlan'

/** Загружает трёхмерную сцену при открытии рабочей области. */
export const loadHouse3D = () =>
  import('@/three/house/House3D').then((module) => ({ default: module.House3D }))

// Лениво загружаемый компонент трёхмерной сцены.
const House3D = lazy(loadHouse3D)

/** Готовит геометрию комнат и показывает дом после загрузки трёхмерной сцены. */
export function HouseCanvas({
  spec,
}: {
  /** Параметры дома и текущее состояние строительства. */
  spec: HouseSpec
}) {
  // Комнаты, участвующие в расчёте планировки.
  const rooms = useMemo(() => applyRoomOverrides(generateRoomPlan(spec), spec.roomAreas), [spec])
  // Прямоугольные размещения комнат по идентификаторам.
  const positions = useMemo(() => buildCoordinateLayout(rooms), [rooms])
  // Размещения комнат с применёнными ручными настройками.
  const merged = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(positions).map(([id, p]) => [
          id,
          { ...p, ...spec.customPlan?.layouts[id], ...spec.roomLayouts[id] },
        ]),
      ),
    [positions, spec.customPlan, spec.roomLayouts],
  )
  return (
    <Suspense
      fallback={
        <div className={styles['three-loading']} role="status">
          Строим 3D-модель…
        </div>
      }
    >
      <House3D spec={spec} rooms={rooms} positions={merged} />
    </Suspense>
  )
}
