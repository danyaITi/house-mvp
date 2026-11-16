import styles from '@/components/construction-plan/ConstructionPlan.module.css'
import { useEffect, useState } from 'react'
import {
  cellKey,
  constructionOpeningSpan,
  wallKey,
  type ConstructionModel,
} from '@/construction/model/constructionModel'
import {
  planApertureFixtureLine,
  planApertureLine,
  stairOpeningsAtLevel,
} from '@/construction/plan/constructionPlan'

/** Рисует клетки, стены, проёмы и лестницы выбранного этажа в SVG. */
export function ConstructionPlan({
  model,
}: {
  /** Строительная модель, из которой берётся геометрия объектов. */
  model: ConstructionModel
}) {
  // Этажи, на которых есть строительные объекты.
  const levels = [
    ...new Set([
      ...model.cells.map((cell) => cell.level ?? 1),
      ...model.walls.map((wall) => wall.level ?? 1),
      ...(model.apertures ?? []).map((aperture) => aperture.level ?? 1),
      ...(model.stairs ?? []).map((stair) => stair.cell.level ?? 1),
    ]),
  ].sort((a, b) => a - b)
  // Этаж, для которого выполняется расчёт.
  const [level, setLevel] = useState(levels[0] ?? 1)
  useEffect(() => {
    if (!levels.includes(level)) setLevel(levels[0] ?? 1)
  }, [levels.join(':'), level])
  // Клетки пола, участвующие в текущей операции.
  const cells = model.cells.filter((cell) => (cell.level ?? 1) === level)
  // Сегменты стен, участвующие в текущей операции.
  const walls = model.walls.filter((wall) => (wall.level ?? 1) === level)
  // Заполнения стен, участвующие в текущей операции.
  const openings = (model.openings ?? []).filter((opening) => (opening.wall.level ?? 1) === level)
  // Отдельные проёмы, участвующие в текущей операции.
  const apertures = (model.apertures ?? []).filter((aperture) => (aperture.level ?? 1) === level)
  // Лестницы выбранного этажа с индексами в модели.
  const levelStairs = (model.stairs ?? [])
    .map((stair, index) => ({ stair, index }))
    .filter(({ stair }) => (stair.cell.level ?? 1) === level)
  // Лестницы снизу, требующие вырезов в текущем перекрытии.
  const stairOpenings = stairOpeningsAtLevel(model, level)

  return (
    <section
      className={[styles['construction-plan'], styles['is-display-only']].filter(Boolean).join(' ')}
      aria-label="План построенного дома"
    >
      <header>
        <div>
          <h3>План дома</h3>
          <p>План синхронизирован с 3D-моделью.</p>
        </div>
        <div className={styles['construction-plan-header-actions']}>
          <strong>{cells.length} м²</strong>
        </div>
      </header>
      {levels.length > 1 && (
        <div className={styles['construction-plan-levels']} role="group" aria-label="Этаж плана">
          {levels.map((item) => (
            <button type="button" key={item} aria-pressed={level === item} onClick={() => setLevel(item)}>
              {item} этаж
            </button>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${model.width} ${model.depth}`}
        role="img"
        aria-label={`План ${level} этажа`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect width={model.width} height={model.depth} className={styles['construction-plan-ground']} />
        {cells.map((cell) => (
          <rect
            key={cellKey(cell)}
            x={cell.x + 0.04}
            y={cell.y + 0.04}
            width=".92"
            height=".92"
            className={`${styles['construction-plan-cell']} ${styles[`material-${cell.material ?? 'concrete'}`] ?? ''}`}
          />
        ))}
        {walls.map((wall) => {
          // Ключ объекта для поиска и сравнения в коллекциях. Координата конца отрезка в плоскости строительной сетки.
          const key = wallKey(wall),
            x2 = wall.axis === 'h' ? wall.x + 1 : wall.x,
            y2 = wall.axis === 'h' ? wall.y : wall.y + 1
          return (
            <line
              key={key}
              x1={wall.x}
              y1={wall.y}
              x2={x2}
              y2={y2}
              className={`${styles['construction-plan-wall']} ${styles[`material-${wall.material ?? 'aerated'}`] ?? ''}`}
            />
          )
        })}
        {openings.map((opening) => {
          // Пролёт заполнения, ключ опорной стены и концы его линии на плане.
          const span = constructionOpeningSpan(opening),
            key = wallKey(opening.wall),
            x1 = opening.wall.axis === 'h' ? opening.wall.x + span.start : opening.wall.x,
            y1 = opening.wall.axis === 'h' ? opening.wall.y : opening.wall.y + span.start,
            x2 = opening.wall.axis === 'h' ? opening.wall.x + span.end : opening.wall.x,
            y2 = opening.wall.axis === 'h' ? opening.wall.y : opening.wall.y + span.end
          return (
            <line
              key={key}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={`${styles['construction-plan-opening']} ${styles[`is-${opening.kind}`]}`}
            />
          )
        })}
        {apertures.map((aperture) => {
          // Линия проёма на плане и геометрия установленного заполнения.
          const { x1, y1, x2, y2 } = planApertureLine(aperture),
            fixture = planApertureFixtureLine(aperture)
          return (
            <g
              key={aperture.id}
              className={`${styles['construction-plan-standalone-aperture']} ${styles[`is-${aperture.kind}`]}`}
            >
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles['construction-plan-aperture-frame']} />
              {fixture && <line {...fixture} className={styles['construction-plan-fixture-line']} />}
            </g>
          )
        })}
        {stairOpenings.map(({ stair, index }) => (
          <g
            key={`stair-opening:${index}`}
            className={styles['construction-plan-stair-opening']}
            transform={`rotate(${stair.rotation ?? 0} ${stair.cell.x + 0.5} ${stair.cell.y + 0.5})`}
          >
            <rect x={stair.cell.x + 0.12} y={stair.cell.y + 0.12} width=".76" height=".76" rx=".06" />
            <path
              d={`M ${stair.cell.x + 0.22} ${stair.cell.y + 0.22} L ${stair.cell.x + 0.78} ${stair.cell.y + 0.78} M ${stair.cell.x + 0.78} ${stair.cell.y + 0.22} L ${stair.cell.x + 0.22} ${stair.cell.y + 0.78}`}
            />
          </g>
        ))}
        {levelStairs.map(({ stair, index }) => (
          <g
            key={`stair:${index}`}
            className={styles['construction-plan-stair']}
            transform={`rotate(${stair.rotation ?? 0} ${stair.cell.x + 0.5} ${stair.cell.y + 0.5})`}
          >
            <rect x={stair.cell.x + 0.14} y={stair.cell.y + 0.14} width=".72" height=".72" rx=".08" />
            <path
              d={`M ${stair.cell.x + 0.28} ${stair.cell.y + 0.72} L ${stair.cell.x + 0.72} ${stair.cell.y + 0.28} M ${stair.cell.x + 0.48} ${stair.cell.y + 0.72} L ${stair.cell.x + 0.72} ${stair.cell.y + 0.48}`}
            />
          </g>
        ))}
      </svg>
      {!cells.length && (
        <div className={styles['construction-plan-empty']}>
          <strong>На этом этаже пока нет пола</strong>
        </div>
      )}
      <div className={styles['construction-plan-legend']}>
        <span>
          <i className={styles['is-wall']} />
          Стена
        </span>
        <span>
          <i className={styles['is-door']} />
          Дверь
        </span>
        <span>
          <i className={styles['is-window']} />
          Окно
        </span>
        <span>
          <i className={styles['is-stair']} />
          Лестница
        </span>
        <span>
          <i className={styles['is-stair-opening']} />
          Проём лестницы
        </span>
      </div>
    </section>
  )
}
