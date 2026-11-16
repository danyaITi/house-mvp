import { useMemo, useState } from 'react'
import { cellKey, wallKey, type ConstructionModel } from '@/construction/model/constructionModel'

/** Выделенные объекты одного типа и ключи их элементов. */
export type BuildSelection =
  | { kind: 'stair'; index: number }
  | { kind: 'stairs'; indexes: number[] }
  | { kind: 'aperture'; id: string }
  | { kind: 'apertures'; ids: string[] }
  | { kind: 'fixture'; id: string }
  | { kind: 'fixtures'; ids: string[] }
  | { kind: 'opening'; wallKey: string }
  | { kind: 'openings'; wallKeys: string[] }
  | { kind: 'walls'; wallKeys: string[] }
  | { kind: 'cells'; cellKeys: string[] }
  | { kind: 'roof' }

/** Находит объекты модели по ключам выделения и вычисляет доступные действия. */
export function deriveConstructionSelection(model: ConstructionModel, selection: BuildSelection | null) {
  // Индексы лестниц, входящих в выделение.
  const stairIndexes =
    selection?.kind === 'stairs' ? selection.indexes : selection?.kind === 'stair' ? [selection.index] : []
  // Ключи заполнений, входящих в выделение.
  const openingKeys =
    selection?.kind === 'openings'
      ? selection.wallKeys
      : selection?.kind === 'opening'
        ? [selection.wallKey]
        : []
  // Идентификаторы выбранных отдельных проёмов.
  const apertureIds =
    selection?.kind === 'apertures' ? selection.ids : selection?.kind === 'aperture' ? [selection.id] : []
  // Идентификаторы выбранных заполнений отдельных проёмов.
  const fixtureIds =
    selection?.kind === 'fixtures' ? selection.ids : selection?.kind === 'fixture' ? [selection.id] : []
  // Сегменты стен, участвующие в текущей операции.
  const walls =
    selection?.kind === 'walls'
      ? model.walls.filter((wall) => selection.wallKeys.includes(wallKey(wall)))
      : []
  // Клетки пола, участвующие в текущей операции.
  const cells =
    selection?.kind === 'cells'
      ? model.cells.filter((cell) => selection.cellKeys.includes(cellKey(cell)))
      : []
  // Отдельные проёмы, участвующие в текущей операции.
  const apertures = (model.apertures ?? []).filter((aperture) => apertureIds.includes(aperture.id))
  // Заполнения отдельных проёмов, входящие в выделение.
  const fixtures = (model.apertures ?? []).filter(
    (aperture) => fixtureIds.includes(aperture.id) && aperture.fixture,
  )
  // Окно или дверь, участвующие в текущем действии.
  const opening =
    selection?.kind === 'opening'
      ? ((model.openings ?? []).find((item) => wallKey(item.wall) === selection.wallKey) ?? null)
      : null
  // Лестница, участвующая в текущей операции.
  const stair = selection?.kind === 'stair' ? ((model.stairs ?? [])[selection.index] ?? null) : null
  return {
    stair,
    stairIndexes,
    opening,
    openingKeys,
    apertureIds,
    apertures,
    fixtureIds,
    fixtures,
    walls,
    cells,
    fixtureKind: fixtures[0]?.kind,
    fixtureMaterial:
      fixtures.length && fixtures.every((item) => item.fixture?.material === fixtures[0].fixture?.material)
        ? (fixtures[0].fixture?.material ?? '')
        : '',
    wallMaterial:
      walls.length && walls.every((wall) => (wall.material ?? 'aerated') === (walls[0].material ?? 'aerated'))
        ? (walls[0].material ?? 'aerated')
        : '',
    cellMaterial:
      cells.length &&
      cells.every((cell) => (cell.material ?? 'concrete') === (cells[0].material ?? 'concrete'))
        ? (cells[0].material ?? 'concrete')
        : '',
  }
}

/** Хранит выделение объектов и предоставляет операции его изменения. */
export function useConstructionSelection(model: ConstructionModel) {
  // Состояние выделения строительных объектов.
  const [selection, setSelection] = useState<BuildSelection | null>(null)
  // Выделенные объекты, найденные в модели по сохранённым ключам.
  const derived = useMemo(() => deriveConstructionSelection(model, selection), [model, selection])
  return { selection, setSelection, ...derived }
}
