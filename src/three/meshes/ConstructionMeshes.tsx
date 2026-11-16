import type { StairShape } from '@/construction/model/constructionModel'

/** Рисует плиту пола с материалом и подсветкой выделения. */
export function FoundationSlab({
  selected,
  hovered,
  material,
}: {
  /** Включает оформление выбранного объекта. */
  selected: boolean
  /** Включает подсветку под указателем. */
  hovered: boolean
  /** Материал поверхности объекта. */
  material?: 'concrete' | 'slab' | 'wood'
}) {
  // Цвет материала с учётом текущего состояния объекта.
  const color = selected
    ? '#8fb9c7'
    : hovered
      ? '#6e9ca3'
      : material === 'wood'
        ? '#9a744f'
        : material === 'slab'
          ? '#aaa69e'
          : '#b9ad9a'
  return (
    <>
      <boxGeometry
        args={[
          selected || hovered ? 1 : 0.96,
          selected ? 0.2 : hovered ? 0.19 : 0.16,
          selected || hovered ? 1 : 0.96,
        ]}
      />
      <meshStandardMaterial
        color={color}
        emissive={selected ? '#315f70' : hovered ? '#244f56' : '#000000'}
        emissiveIntensity={selected ? 0.25 : hovered ? 0.18 : 0}
        roughness={0.9}
      />
    </>
  )
}

/** Строит ступени заданной формы в локальных координатах лестницы. */
export function StairSteps({
  shape,
  color,
  emissive = '#000000',
  emissiveIntensity = 0,
}: {
  /** Форма лестничного марша. */
  shape: StairShape
  /** Основной цвет поверхности. */
  color: string
  /** Цвет дополнительного свечения материала. */
  emissive?: string
  /** Интенсивность свечения для подсветки. */
  emissiveIntensity?: number
}) {
  // Количество ступеней лестничного марша.
  const steps = shape === 'spiral' ? 6 : 5
  return (
    <>
      {Array.from({ length: steps }, (_, step) => {
        // Доля пройденного участка при построении геометрии. Угол поворота или уклона геометрии. Координата ступени в локальной плоскости лестницы.
        const t = step / (steps - 1),
          angle = shape === 'spiral' ? t * Math.PI * 1.5 : 0,
          px =
            shape === 'spiral'
              ? Math.cos(angle) * 0.25
              : shape === 'l' && step > 2
                ? (step - 2) * 0.15 - 0.15
                : 0,
          pz =
            shape === 'spiral'
              ? Math.sin(angle) * 0.25
              : shape === 'u' && step > 2
                ? 0.28 - t * 0.22
                : -0.34 + t * 0.68
        return (
          <mesh
            key={step}
            position={[px, 0.1 + step * 0.12, pz]}
            rotation={[0, shape === 'spiral' ? -angle : shape === 'l' && step > 2 ? Math.PI / 2 : 0, 0]}
          >
            <boxGeometry args={[0.58, 0.12, 0.18]} />
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
              roughness={0.7}
            />
          </mesh>
        )
      })}
    </>
  )
}

/** Рисует границу выреза в перекрытии над лестницей. */
export function StairOpening() {
  return (
    <>
      {[
        [-0.43, 0, 0.05, 0.86],
        [0.43, 0, 0.05, 0.86],
        [0, -0.43, 0.86, 0.05],
        [0, 0.43, 0.86, 0.05],
      ].map(([px, pz, sx, sz], part) => (
        <mesh key={part} position={[px, 0.03, pz]}>
          <boxGeometry args={[sx, 0.08, sz]} />
          <meshStandardMaterial color="#5b5146" />
        </mesh>
      ))}
    </>
  )
}

/** Рисует панель окна или двери вдоль выбранной оси стены. */
export function OpeningPanel({
  axis,
  width,
  height,
  color,
  emissive = '#000000',
  emissiveIntensity = 0,
  wireframe = false,
  transparent = false,
  opacity = 1,
  metalness = 0.08,
}: {
  /** Направление объекта вдоль горизонтальной или вертикальной линии сетки. */
  axis: 'h' | 'v'
  /** Ширина геометрии в единицах сцены. */
  width: number
  /** Высота геометрии в единицах сцены. */
  height: number
  /** Основной цвет поверхности. */
  color: string
  /** Цвет дополнительного свечения материала. */
  emissive?: string
  /** Интенсивность свечения для подсветки. */
  emissiveIntensity?: number
  /** Показывает рёбра вместо сплошной поверхности. */
  wireframe?: boolean
  /** Включает прозрачность материала. */
  transparent?: boolean
  /** Непрозрачность материала от нуля до единицы. */
  opacity?: number
  /** Доля металлического отражения материала. */
  metalness?: number
}) {
  return (
    <mesh>
      <boxGeometry
        args={axis === 'h' ? [width - 0.04, height - 0.05, 0.15] : [0.15, height - 0.05, width - 0.04]}
      />
      {wireframe ? (
        <meshBasicMaterial color={color} wireframe transparent opacity={opacity} depthTest={false} />
      ) : (
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent={transparent}
          opacity={opacity}
          metalness={metalness}
          roughness={0.35}
        />
      )}
    </mesh>
  )
}

/** Собирает модель проёма из панелей вокруг прозрачного выреза. */
export function ApertureFrame({
  axis,
  span,
  cutHeight,
  cutBottom,
  color,
  outlineOnly = false,
}: {
  /** Направление объекта вдоль горизонтальной или вертикальной линии сетки. */
  axis: 'h' | 'v'
  /** Длина проёма вдоль стены. */
  span: number
  /** Высота прозрачного выреза в проёме. */
  cutHeight: number
  /** Высота нижней границы выреза от пола. */
  cutBottom: number
  /** Тип проёма: оконный или дверной. */
  kind: 'door' | 'window'
  /** Основной цвет поверхности. */
  color: string
  /** Признак установленного заполнения. */
  filled?: boolean
  /** Показывает только контур предварительной модели. */
  outlineOnly?: boolean
}) {
  /** Вычисляет размеры панели вдоль выбранной оси стены. */
  const fullHeight = 2.7,
    horizontal = axis === 'h',
    thickness = 0.12,
    depth = 0.11,
    jambSize = horizontal
      ? ([thickness, fullHeight, depth] as const)
      : ([depth, fullHeight, thickness] as const),
    panelSize = (height: number) =>
      horizontal ? ([span, height, depth] as const) : ([depth, height, span] as const)
  /** Преобразует продольную координату панели в координаты сцены. */
  const along = (offset: number) => (horizontal ? ([offset, 0, 0] as const) : ([0, 0, offset] as const))
  return (
    <group>
      <mesh position={along(-span / 2 + thickness / 2)} castShadow>
        <boxGeometry args={jambSize} />
        {outlineOnly ? (
          <meshBasicMaterial color={color} wireframe depthTest={false} />
        ) : (
          <meshStandardMaterial color={color} roughness={0.56} />
        )}
      </mesh>
      <mesh position={along(span / 2 - thickness / 2)} castShadow>
        <boxGeometry args={jambSize} />
        {outlineOnly ? (
          <meshBasicMaterial color={color} wireframe depthTest={false} />
        ) : (
          <meshStandardMaterial color={color} roughness={0.56} />
        )}
      </mesh>
      {fullHeight - cutBottom - cutHeight > 0 && (
        <mesh
          position={[0, cutBottom + cutHeight + (fullHeight - cutBottom - cutHeight) / 2 - fullHeight / 2, 0]}
          castShadow
        >
          <boxGeometry args={panelSize(fullHeight - cutBottom - cutHeight)} />
          {outlineOnly ? (
            <meshBasicMaterial color={color} wireframe depthTest={false} />
          ) : (
            <meshStandardMaterial color={color} roughness={0.64} />
          )}
        </mesh>
      )}
      {cutBottom > 0 && (
        <mesh position={[0, cutBottom / 2 - fullHeight / 2, 0]} castShadow>
          <boxGeometry args={panelSize(cutBottom)} />
          {outlineOnly ? (
            <meshBasicMaterial color={color} wireframe depthTest={false} />
          ) : (
            <meshStandardMaterial color={color} roughness={0.64} />
          )}
        </mesh>
      )}
      <mesh position={[0, cutBottom + cutHeight / 2 - fullHeight / 2, 0]}>
        <boxGeometry args={horizontal ? [span - 0.08, cutHeight, 0.08] : [0.08, cutHeight, span - 0.08]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Прямоугольный вырез в локальных координатах стены. */
export type WallCut = { center: number; width: number; bottom: number; height: number }

/** Разбивает стену на сплошные участки вокруг оконных и дверных вырезов. */
export function WallWithOpenings({
  length,
  height,
  base,
  x,
  z,
  vertical,
  color,
  cuts,
}: {
  /** Длина стены вдоль её локальной оси. */
  length: number
  /** Высота геометрии в единицах сцены. */
  height: number
  /** Отметка основания стены по высоте. */
  base: number
  /** Положение объекта по оси X сцены. */
  x: number
  /** Положение объекта по оси Z сцены. */
  z: number
  /** Размещает стену вдоль вертикальной линии плана. */
  vertical: boolean
  /** Основной цвет поверхности. */
  color: string
  /** Прямоугольные вырезы, исключаемые из сплошной стены. */
  cuts: WallCut[]
}) {
  // Сплошные части стены, оставшиеся вокруг вырезов.
  const pieces: { center: number; width: number; bottom: number; height: number }[] = []
  // Текущая позиция вдоль стены при последовательном размещении.
  let cursor = -length / 2
  // Прямоугольный вырез, исключаемый из геометрии стены.
  for (const cut of [...cuts].sort((a, b) => a.center - b.center)) {
    // Граница участка либо индекс сравниваемого элемента.
    const left = Math.max(-length / 2, cut.center - cut.width / 2),
      right = Math.min(length / 2, cut.center + cut.width / 2)
    if (left > cursor + 0.03)
      pieces.push({ center: (cursor + left) / 2, width: left - cursor, bottom: 0, height })
    if (cut.bottom > 0.03)
      pieces.push({ center: (left + right) / 2, width: right - left, bottom: 0, height: cut.bottom })
    // Верхняя отметка части стены относительно пола.
    const top = cut.bottom + cut.height
    if (top < height - 0.03)
      pieces.push({ center: (left + right) / 2, width: right - left, bottom: top, height: height - top })
    cursor = Math.max(cursor, right)
  }
  if (cursor < length / 2 - 0.03)
    pieces.push({ center: (cursor + length / 2) / 2, width: length / 2 - cursor, bottom: 0, height })
  return (
    <>
      {pieces.map((piece, index) => (
        <mesh
          key={index}
          position={
            vertical
              ? [x, base + piece.bottom + piece.height / 2, z + piece.center]
              : [x + piece.center, base + piece.bottom + piece.height / 2, z]
          }
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={vertical ? [0.11, piece.height, piece.width] : [piece.width, piece.height, 0.11]}
          />
          <meshStandardMaterial color={color} roughness={0.82} />
        </mesh>
      ))}
    </>
  )
}

/** Строит плоскую или скатную кровлю по габаритам верхнего этажа. */
export function ConstructionRoof({
  style,
  material,
  width,
  depth,
  color,
  emissive,
  emissiveIntensity,
  onPointerOver,
  onPointerOut,
  onPointerDown,
}: {
  /** Форма кровли. */
  style: 'gable' | 'hip' | 'flat'
  /** Материал поверхности объекта. */
  material: 'metal' | 'tile' | 'soft'
  /** Ширина геометрии в единицах сцены. */
  width: number
  /** Глубина геометрии в единицах сцены. */
  depth: number
  /** Основной цвет поверхности. */
  color: string
  /** Цвет дополнительного свечения материала. */
  emissive: string
  /** Интенсивность свечения для подсветки. */
  emissiveIntensity: number
  /** Обрабатывает наведение указателя на объект. */
  onPointerOver: (event: any) => void
  /** Снимает состояние наведения при уходе указателя. */
  onPointerOut: () => void
  /** Начинает взаимодействие с объектом при нажатии. */
  onPointerDown: (event: any) => void
}) {
  // Габарит кровли с учётом свесов. Высотная отметка основания геометрии.
  const roofWidth = width + 0.5,
    roofDepth = depth + 0.5,
    baseY = 2.76
  /** Создаёт поверхность ската по вершинам и назначает материал кровли. */
  const surface = (shade = color) => (
    <meshStandardMaterial
      color={shade}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      metalness={material === 'metal' ? 0.24 : 0.02}
      roughness={material === 'soft' ? 0.9 : 0.72}
    />
  )
  if (style === 'flat')
    return (
      <mesh
        position={[0, baseY + 0.09, 0]}
        castShadow
        receiveShadow
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
      >
        <boxGeometry args={[roofWidth, 0.18, roofDepth]} />
        {surface()}
      </mesh>
    )
  if (style === 'hip')
    return (
      <mesh
        position={[0, baseY + 0.48, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[roofWidth / Math.SQRT2, 1, roofDepth / Math.SQRT2]}
        castShadow
        receiveShadow
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
      >
        <coneGeometry args={[1, 0.96, 4]} />
        {surface()}
      </mesh>
    )
  // Горизонтальный пролёт ската кровли. Подъём ската от карниза до конька. Угол поворота или уклона геометрии. Длина наклонной поверхности ската.
  const run = roofWidth / 2,
    rise = Math.min(1.25, Math.max(0.65, run * 0.28)),
    angle = Math.atan2(rise, run),
    slope = Math.hypot(run, rise)
  return (
    <group onPointerOver={onPointerOver} onPointerOut={onPointerOut} onPointerDown={onPointerDown}>
      <mesh position={[-run / 2, baseY + rise / 2, 0]} rotation={[0, 0, angle]} castShadow receiveShadow>
        <boxGeometry args={[slope, 0.16, roofDepth]} />
        {surface()}
      </mesh>
      <mesh position={[run / 2, baseY + rise / 2, 0]} rotation={[0, 0, -angle]} castShadow receiveShadow>
        <boxGeometry args={[slope, 0.16, roofDepth]} />
        {surface()}
      </mesh>
    </group>
  )
}
