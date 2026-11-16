// Палитра подсветки объектов для разных состояний взаимодействия.
export const constructionVisuals = {
  hover: '#6e9ca3',
  hoverEmissive: '#244f56',
  selected: '#8fb9c7',
  selectedBorder: '#24566f',
  selectedEmissive: '#315f70',
  invalidBorder: '#e04f43',
} as const

/** Состояние объекта, определяющее цвет и подсветку. */
export type ConstructionVisualState = 'default' | 'hovered' | 'selected' | 'invalid'

/** Выбирает цвет и подсветку материала по состоянию выделения. */
export function constructionStateColors(state: ConstructionVisualState, base: string) {
  if (state === 'invalid')
    return { color: constructionVisuals.invalidBorder, emissive: '#641d16', emissiveIntensity: 0.45 }
  if (state === 'selected')
    return {
      color: constructionVisuals.selected,
      emissive: constructionVisuals.selectedEmissive,
      emissiveIntensity: 0.25,
    }
  if (state === 'hovered')
    return {
      color: constructionVisuals.hover,
      emissive: constructionVisuals.hoverEmissive,
      emissiveIntensity: 0.18,
    }
  return { color: base, emissive: '#000000', emissiveIntensity: 0 }
}
