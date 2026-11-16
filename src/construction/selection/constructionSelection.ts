/** Ключ или индекс объекта, используемый при выделении. */
export type SelectionKey = string | number
// Сообщение о запрете совместного выбора разных типов объектов.
export const SAME_KIND_SELECTION_MESSAGE =
  'Можно одновременно выбирать только объекты одного вида. Сначала снимите текущее выделение.'

/** Переключает ключ в выделении, учитывая добавочный выбор. */
export function selectKey<T extends SelectionKey>(current: readonly T[], key: T, additive: boolean): T[] {
  if (!additive) return [key]
  return current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
}

/** Возвращает единственный выбранный ключ либо пустое значение. */
export function singleSelection<T extends SelectionKey>(keys: readonly T[]): T | null {
  return keys.length === 1 ? keys[0] : null
}

/** Сохраняет выделение объектов одного типа при добавочном выборе. */
export function selectSameKind<T extends SelectionKey, K>(
  current: readonly T[],
  key: T,
  additive: boolean,
  kindOf: (key: T) => K | undefined,
): { keys: T[]; accepted: boolean } {
  if (!additive) return { keys: [key], accepted: true }
  if (current.length && kindOf(current[0]) !== kindOf(key)) return { keys: [...current], accepted: false }
  return { keys: selectKey(current, key, true), accepted: true }
}

/** Разрешает добавочный выбор объектов совместимого типа. */
export function canExtendSelection(activeKind: string | null, candidateKind: string): boolean {
  return activeKind === null || activeKind === candidateKind
}

/** Определяет, следует выбрать заполнение или содержащий его объект. */
export function openingClickTarget(altKey: boolean): 'opening' | 'wall' {
  return altKey ? 'wall' : 'opening'
}
