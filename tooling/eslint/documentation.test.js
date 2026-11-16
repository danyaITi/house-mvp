import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { documentationRule } from './documentation.js'

/** Запускает правило комментариев на отдельном примере кода. */
const lint = (code) =>
  new Linter().verify(
    code,
    [
      {
        files: ['**/*.tsx'],
        languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { documentation: { rules: { description: documentationRule } } },
        rules: { 'documentation/description': 'error' },
      },
    ],
    { filename: 'example.tsx' },
  )

describe('documentation rule', () => {
  it('requires descriptions on functions, arrow components and types', () => {
    expect(lint('function calculate() {}')).toHaveLength(1)
    expect(lint('const Card = () => null')).toHaveLength(1)
    expect(lint('type Amount = number')).toHaveLength(1)
  })

  it('accepts documented exported declarations', () => {
    expect(lint('/** Переводит метры в сантиметры. */ export function convert() {}')).toHaveLength(0)
    expect(lint('/** Сумма в рублях. */ export type Amount = number')).toHaveLength(0)
  })

  it('requires descriptions on named and inline props', () => {
    expect(lint('/** Параметры карточки. */ interface CardProps { title: string }')).toHaveLength(1)
    expect(lint('/** Показывает карточку. */ function Card({title}: {title: string}) {}')).toHaveLength(1)
    expect(
      lint(
        '/** Параметры карточки. */ type CardProps = { /** Отображаемый заголовок карточки. */ title: string }',
      ),
    ).toHaveLength(0)
  })

  it('rejects empty and placeholder descriptions', () => {
    expect(lint('/** */ function calculate() {}')).toHaveLength(1)
    expect(lint('/** Выполняет операцию «calculate». */ function calculate() {}')[0].messageId).toBe('vague')
  })

  it('requires Russian explanations while allowing tool directives', () => {
    expect(lint('/** Calculates total cost. */ function total() {}')[0].messageId).toBe('language')
    expect(lint('// @vitest-environment jsdom')).toHaveLength(0)
  })

  it('requires descriptions for constants, local variables and React state', () => {
    expect(lint('const amount = 10')[0].messageId).toBe('variable')
    expect(lint('/** Вычисляет сумму. */ function total() { let result = 0 }')[0].messageId).toBe('variable')
    expect(lint('const [count, setCount] = useState(0)')[0].messageId).toBe('variable')
    expect(lint('// Количество выбранных объектов.\nconst [count, setCount] = useState(0)')).toHaveLength(0)
  })

  it('accepts a shared description for a declaration group and exported constant', () => {
    expect(lint('// Границы участка по горизонтали.\nconst left = 0, right = 10')).toHaveLength(0)
    expect(lint('/** Высота этажа в метрах. */ export const height = 2.7')).toHaveLength(0)
  })

  it('requires a description before a loop and ignores distant comments', () => {
    expect(lint('for (const item of items) {}')[0].messageId).toBe('variable')
    expect(
      lint('// Элементы выбранной группы для проверки опоры.\nfor (const item of items) {}'),
    ).toHaveLength(0)
    expect(lint('// Высота объекта.\n\nconst height = 2.7')[0].messageId).toBe('variable')
  })
})
