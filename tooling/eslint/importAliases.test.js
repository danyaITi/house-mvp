import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/** Проверяет импорты на реальной конфигурации ESLint для исходников проекта. */
const lintImports = async (code) => {
  const [result] = await new ESLint().lintText(code, { filePath: 'src/alias-example.ts' })
  return result.messages
}

describe('import aliases', () => {
  it('accepts aliases and package imports', async () => {
    expect(await lintImports("import '@/styles.css'; import 'react'")).toHaveLength(0)
    expect(await lintImports("import('@/three/house/House3D')")).toHaveLength(0)
  })

  it('rejects relative static imports, re-exports and dynamic imports', async () => {
    expect((await lintImports("import './styles.css'"))[0].ruleId).toBe('no-restricted-imports')
    expect((await lintImports("export { value } from '../module'"))[0].ruleId).toBe('no-restricted-imports')
    expect((await lintImports("import('./module')"))[0].ruleId).toBe('no-restricted-syntax')
  })
})
