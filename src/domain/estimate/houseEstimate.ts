import { constructionOpeningWidth, generateZones } from '@/construction/model/constructionModel'
import type { CostItem, Estimate, HouseSpec, Roof, Wall } from '@/domain/house/houseTypes'
import { generateRoomPlan } from '@/domain/room-plan/roomPlan'

// Названия материалов стен для интерфейса и сметы.
export const wallNames: Record<Wall, string> = {
  aerated: 'Газобетон',
  brick: 'Керамический блок',
  frame: 'Каркасная технология',
  timber: 'Клеёный или профилированный брус',
  log: 'Оцилиндрованное бревно',
}

// Названия форм кровли для интерфейса и сметы.
export const roofNames: Record<Roof, string> = { gable: 'Двускатная', hip: 'Вальмовая', flat: 'Плоская' }

// Базовые ставки стоимости квадратного метра для материалов стен.
const areaRates: Record<Wall, number> = {
  aerated: 77000,
  brick: 92000,
  frame: 68000,
  timber: 84000,
  log: 88000,
}

/** Рассчитывает объёмы работ и диапазон стоимости по модели или исходным параметрам дома. */
export function estimateHouse(spec: HouseSpec): Estimate {
  // Строительная модель, над которой выполняется операция.
  const model = spec.construction
  if (model) {
    // Клетки пола, участвующие в текущей операции.
    const cells = model.cells
    // Сегменты стен, участвующие в текущей операции.
    const walls = model.walls
    // Заполнения стен, участвующие в текущей операции.
    const openings = model.openings ?? []
    // Площадь, вычисленная по количеству или размерам элементов.
    const area = cells.length
    // Клетки первого этажа для расчёта основания дома.
    const baseCells = cells.filter((cell) => (cell.level ?? 1) === 1)
    // Площадь основания по числу клеток первого этажа.
    const footprint = baseCells.length
    // Координаты клеток для вычисления габаритов.
    const xs = baseCells.map((cell) => cell.x)
    // Координаты клеток для вычисления габаритов.
    const ys = baseCells.map((cell) => cell.y)
    // Размер геометрии по соответствующей оси.
    const width = xs.length ? Math.max(...xs) - Math.min(...xs) + 1 : 0
    // Размер геометрии по соответствующей оси.
    const length = ys.length ? Math.max(...ys) - Math.min(...ys) + 1 : 0

    // Площадь заполнений вычитается из площади стен; высоты соответствуют пропорциям моделей.
    const openingArea = openings.reduce(
      (sum, opening) =>
        sum +
        constructionOpeningWidth(opening) *
          (opening.kind === 'door' ? 2.05 : opening.style === 'panoramic' ? 1.5 : 0.92),
      0,
    )
    // Площадь стен до вычета оконных и дверных заполнений.
    const grossWallArea = walls.length * 2.7
    // Площадь стен после вычета заполнений.
    const wallArea = Math.max(0, grossWallArea - openingArea)
    // Верхний этаж, используемый для расчёта площади кровли.
    const topLevel = cells.some((cell) => (cell.level ?? 1) === 2) ? 2 : 1
    // Количество клеток выбранного верхнего этажа.
    const highestCells = cells.filter((cell) => (cell.level ?? 1) === topLevel).length
    // Коэффициент учитывает уклон и свесы относительно площади верхнего этажа.
    const roofFactor = model.roofStyle === 'flat' ? 1.05 : model.roofStyle === 'hip' ? 1.28 : 1.2
    // Площадь кровли с учётом коэффициента уклона и свесов.
    const roofArea = model.roof ? highestCells * roofFactor : 0
    // На каждую клетку основания принимается 0,28 м³ бетона для плиты.
    const foundation = footprint * 0.28
    // Стоимость единицы площади стены для каждого материала.
    const wallUnit = { aerated: 12000, brick: 18000, frame: 10500, timber: 16500 } as const
    // Стоимость сплошных стен до вычета заполнений.
    const wallGrossCost = walls.reduce((sum, wall) => sum + 2.7 * wallUnit[wall.material ?? 'aerated'], 0)
    // Стоимость стен с учётом уменьшения площади на заполнения.
    const wallCost = grossWallArea ? wallGrossCost * (wallArea / grossWallArea) : 0
    // Стоимость квадратного метра выбранной кровли.
    const roofRate = model.roofStyle === 'flat' ? 13000 : model.roofStyle === 'hip' ? 16500 : 14500
    // Суммарная стоимость окон и дверей.
    const openingCost = openings.reduce(
      (sum, opening) =>
        sum +
        (opening.kind === 'door'
          ? opening.style === 'double'
            ? 110000
            : opening.style === 'sliding'
              ? 95000
              : 65000
          : opening.style === 'panoramic'
            ? 155000
            : 80000),
      0,
    )
    // Суммарная стоимость установленных лестниц.
    const stairCost = (model.stairs ?? []).reduce(
      (sum, stair) =>
        sum +
        (stair.shape === 'spiral'
          ? 420000
          : stair.shape === 'u'
            ? 360000
            : stair.shape === 'l'
              ? 310000
              : 250000),
      0,
    )
    // Стоимость каждого раздела строительства.
    const costs = {
      foundation: foundation * 11500,
      walls: wallCost,
      roof: roofArea * roofRate,
      openings: openingCost,
      stairs: stairCost,
      floors: area * 12000,
      engineering: area * 18000,
    }
    // Исходное значение для дальнейшего расчёта.
    const base = Object.values(costs).reduce((sum, value) => sum + value, 0)
    return {
      area,
      width,
      length,
      wallArea,
      roofArea,
      foundation,
      low: base * 0.92,
      high: base * 1.14,
      rooms: generateZones(model).length,
      openings: openings.length,
      costs,
    }
  }

  // Суммарная площадь клеток или комнат рассматриваемого этажа.
  const floorArea = spec.area / spec.floors
  // До создания плана основание считается прямоугольником с соотношением сторон 1,25.
  const width = Math.sqrt(floorArea * 1.25)
  // Размер геометрии по соответствующей оси.
  const length = floorArea / width
  // Длина внешнего контура прямоугольного основания.
  const perimeter = 2 * (width + length)
  // Площадь стен до вычета оконных и дверных заполнений.
  const grossWallArea = perimeter * 2.9 * spec.floors
  // Площадь окон для вычета из площади стен.
  const windowArea = generateRoomPlan(spec)
    .filter((room) => room.kind !== 'circulation')
    .reduce((sum, room) => {
      // Количество элементов, которое требуется обработать или создать.
      const count = spec.roomWindows[room.id] ?? 1
      return (
        sum +
        Array.from({ length: count }, (_, index) => {
          // Конфигурация окна, участвующего в расчёте.
          const window = spec.windowConfigs[`window:${room.id}:${index}`]
          return (window?.width ?? 1.4) * (window?.kind === 'panoramic' ? 2.1 : 1.35)
        }).reduce((subtotal, value) => subtotal + value, 0)
      )
    }, 0)
  // Площадь входной двери для вычета из площади стен.
  const entranceArea = spec.entranceRoom
    ? (spec.doorConfigs[`entrance:${spec.entranceRoom}`]?.width ?? 1) * 2.1
    : 0
  // Площадь стен ограничена снизу 68%: избыточное число окон не должно обнулять ограждение.
  const wallArea = Math.max(grossWallArea * 0.68, grossWallArea - windowArea - entranceArea)
  // Коэффициент уклона и свесов выбранной кровли.
  const roofFactor = spec.roof === 'flat' ? 1.05 : spec.roof === 'hip' ? 1.28 : 1.2
  // Площадь кровли с учётом коэффициента уклона и свесов.
  const roofArea = floorArea * roofFactor
  // Объём бетонного основания по площади первого этажа.
  const foundation = floorArea * 0.28
  // Стоимость квадратного метра выбранной кровли.
  const roofRate = spec.roof === 'flat' ? 13000 : spec.roof === 'hip' ? 16500 : 14500
  // Исходное значение для дальнейшего расчёта.
  const base = spec.area * areaRates[spec.wall] + roofArea * roofRate + foundation * 11500
  // Стоимость каждого раздела строительства.
  const costs = {
    foundation: base * 0.12,
    walls: base * 0.25,
    roof: base * 0.14,
    openings: base * 0.1,
    stairs: 0,
    floors: base * 0.17,
    engineering: base * 0.22,
  }
  return {
    area: spec.area,
    width,
    length,
    wallArea,
    roofArea,
    foundation,
    low: base * 0.92,
    high: base * 1.14,
    rooms: spec.bedrooms + 3,
    openings: Math.ceil(spec.area * 0.16) + (spec.entranceRoom ? 2 : 0),
    costs,
  }
}

/** Разделяет стоимость разделов сметы на материалы и работы для таблицы. */
export function buildCostItems(spec: HouseSpec, data: Estimate): CostItem[] {
  /** Округляет стоимость до ближайшей тысячи рублей. */
  const roundThousands = (value: number) => Math.round(value / 1000) * 1000
  // Есть ли построенные клетки пола для расчёта фактической сметы.
  const built = spec.construction.cells.length > 0
  // Названия материалов, использованных в построенных стенах.
  const wallMaterials = [...new Set(spec.construction.walls.map((wall) => wall.material ?? 'aerated'))]
    .map((material) => wallNames[material as Wall])
    .join(', ')
  // Разделы сметы с единицами измерения и долями материалов.
  const definitions: [keyof Estimate['costs'], string, number, string, number, number][] = [
    ['foundation', 'Фундамент', data.foundation, 'м³', 0.12, 0.62],
    [
      'walls',
      `Стены · ${built ? wallMaterials || 'не построены' : wallNames[spec.wall]}`,
      data.wallArea,
      'м²',
      0.25,
      0.58,
    ],
    [
      'roof',
      built
        ? spec.construction.roof
          ? 'Кровля'
          : 'Кровля не добавлена'
        : `Кровля · ${roofNames[spec.roof]}`,
      data.roofArea,
      'м²',
      0.14,
      0.61,
    ],
    ['openings', 'Окна и двери', data.openings, 'шт.', 0.1, 0.72],
    ['stairs', 'Лестницы', (spec.construction.stairs ?? []).length, 'шт.', 0, 0.58],
    ['floors', 'Перекрытия и черновые полы', data.area, 'м²', 0.17, 0.55],
    ['engineering', 'Черновые инженерные сети', data.area, 'м²', 0.22, 0.48],
  ]
  return definitions.map(([id, name, quantity, unit, fallbackShare, materialShare]) => {
    // Полная стоимость рассматриваемого раздела.
    const total = roundThousands(built ? data.costs[id] : (data.low / 0.92) * fallbackShare)
    // Стоимость материалов в рассматриваемом разделе.
    const materials = roundThousands(total * materialShare)
    return { id, name, quantity, unit, materials, labor: total - materials }
  })
}
