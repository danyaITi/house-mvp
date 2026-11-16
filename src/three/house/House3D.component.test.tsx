// @vitest-environment jsdom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@react-three/fiber', () => ({
  Canvas: () => React.createElement('div', { 'data-testid': 'three-canvas' }),
}))

vi.mock('@react-three/drei', () => ({
  Grid: () => null,
  Line: () => null,
  OrbitControls: () => null,
}))

import { House3D } from '@/three/house/House3D'

// Текущие параметры дома и строительная модель.
const spec = {
  floors: 1,
  roof: 'gable',
  wall: 'aerated',
  roomWindows: {},
  doorConfigs: {},
  doorInstances: [],
  windowConfigs: {},
  blockedPassages: [],
  openWalls: [],
  entranceRoom: null,
  construction: {
    width: 8,
    depth: 8,
    cells: [{ x: 0, y: 0 }],
    walls: [],
    openings: [],
    apertures: [],
    stairs: [],
    roof: true,
    roofStyle: 'gable',
    roofMaterial: 'metal',
  },
} as const

/** Монтирует 3D-компонент с тестовыми параметрами. */
function renderHouse() {
  return render(<House3D spec={spec as any} rooms={[]} positions={{}} />)
}

/** Открывает каталог и активирует инструмент фундамента. */
function chooseFoundation() {
  fireEvent.click(screen.getByRole('button', { name: /Выбрать объект/ }))
  fireEvent.click(screen.getByRole('button', { name: /Фундамент.*Площадь по клеткам/ }))
}

afterEach(cleanup)

describe('3D construction interface', () => {
  it('не показывает недоступные действия до создания фундамента', () => {
    render(
      <House3D
        spec={{ ...spec, construction: { ...spec.construction, cells: [], roof: false } } as any}
        rooms={[]}
        positions={{}}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Создать план' })).toBeNull()
    expect(screen.queryByLabelText('Строительный этаж')).toBeNull()
    expect(screen.getByRole('button', { name: /Выбрать объект/ })).toBeTruthy()
  })

  it('показывает создание плана после появления фундамента', () => {
    renderHouse()

    expect(screen.getByRole('button', { name: 'Создать план' })).toBeTruthy()
  })

  it('снимает активный строительный инструмент по Escape', () => {
    renderHouse()
    chooseFoundation()
    expect(screen.getByLabelText('Свойства строительного объекта')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByLabelText('Свойства строительного объекта')).toBeNull()
    expect(screen.getByRole('button', { name: /Выбрать объект/ })).toBeTruthy()
  })

  it('не снимает активный инструмент правой кнопкой мыши', () => {
    // Контейнер смонтированного компонента для проверки разметки.
    const { container } = renderHouse()
    chooseFoundation()

    fireEvent.contextMenu(container.firstElementChild!)

    expect(screen.getByLabelText('Свойства строительного объекта')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Фундамент/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('переключает строительство на просмотр с улицы', () => {
    renderHouse()
    fireEvent.click(screen.getByRole('button', { name: 'С улицы' }))

    expect(screen.queryByRole('group', { name: 'Свободное строительство' })).toBeNull()
    expect(screen.getByLabelText('Настройка крыши')).toBeTruthy()
    expect(screen.getByText('Просмотр дома с улицы')).toBeTruthy()
  })

  it('открывает и закрывает справку по клавишам', () => {
    renderHouse()
    fireEvent.click(screen.getByRole('button', { name: 'Клавиши' }))
    expect(screen.getByRole('complementary', { name: 'Инструкция по клавишам' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть инструкцию' }))
    expect(screen.queryByRole('complementary', { name: 'Инструкция по клавишам' })).toBeNull()
  })
})
