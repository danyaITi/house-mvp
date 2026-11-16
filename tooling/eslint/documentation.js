/** Требует содержательные описания функций, переменных, компонентов, типов и их параметров. */
export const documentationRule = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      missing: 'Добавьте краткий JSDoc: назначение и принцип работы {{name}}.',
      variable: 'Добавьте комментарий: что хранит и для чего используется {{name}}.',
      vague: 'Замените шаблонный комментарий конкретным объяснением {{name}}.',
      language: 'Пишите пояснения в комментариях на русском языке.',
    },
  },
  create(context) {
    const source = context.sourceCode
    const check = (node, name) => {
      const target = node.parent?.type === 'ExportNamedDeclaration' ? node.parent : node
      const comment = source.getCommentsBefore(target).at(-1)
      if (
        !comment ||
        comment.type !== 'Block' ||
        !comment.value.startsWith('*') ||
        !/[\p{L}]/u.test(comment.value)
      ) {
        context.report({ node, messageId: 'missing', data: { name } })
      } else if (
        /Выполняет операцию|для операции|Возвращает результат|Отрисовывает компонент|Проверяет условие|Обрабатывает пользовательское действие/.test(
          comment.value,
        )
      ) {
        context.report({ node, messageId: 'vague', data: { name } })
      }
    }
    return {
      Program() {
        for (const comment of source.getAllComments()) {
          const text = comment.value.replace(/^\*\s?/, '').trim()
          // Служебные директивы обрабатываются инструментами и не переводятся.
          if (/^(?:@|\/\s*<reference|eslint|prettier|istanbul|v8\s)/.test(text)) continue
          if (/[a-z]/i.test(text) && !/[а-яё]/i.test(text)) {
            context.report({ loc: comment.loc, messageId: 'language' })
          }
        }
      },
      FunctionDeclaration(node) {
        check(node, node.id?.name ?? 'функции')
      },
      VariableDeclaration(node) {
        const functions = node.declarations.filter((declaration) =>
          ['ArrowFunctionExpression', 'FunctionExpression'].includes(declaration.init?.type),
        )
        for (const declaration of functions) {
          check(node, declaration.id.name ?? 'функции')
        }
        if (functions.length === node.declarations.length) return
        // Для цикла описание ставится перед самим циклом, для экспорта — перед export.
        const target = [
          'ExportNamedDeclaration',
          'ForStatement',
          'ForOfStatement',
          'ForInStatement',
        ].includes(node.parent?.type)
          ? node.parent
          : node
        const comment = source.getCommentsBefore(target).at(-1)
        const adjacent = comment && source.getLoc(target).start.line - comment.loc.end.line <= 1
        if (!adjacent || !/[а-яё]/i.test(comment.value)) {
          const name = node.declarations.map((declaration) => source.getText(declaration.id)).join(', ')
          context.report({ node: target, messageId: 'variable', data: { name } })
        }
      },
      TSTypeAliasDeclaration(node) {
        check(node, node.id.name)
      },
      TSInterfaceDeclaration(node) {
        check(node, node.id.name)
      },
      TSPropertySignature(node) {
        const ancestors = source.getAncestors(node)
        const props = ancestors.some(
          (ancestor) =>
            (['TSTypeAliasDeclaration', 'TSInterfaceDeclaration'].includes(ancestor.type) &&
              /Props$/.test(ancestor.id.name)) ||
            (ancestor.type === 'ObjectPattern' && ancestor.typeAnnotation),
        )
        if (props) check(node, `props.${node.key.name ?? node.key.value}`)
      },
    }
  },
}
