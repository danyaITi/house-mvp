import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.PORT || 4173)
const distRoot = resolve(dirname(fileURLToPath(import.meta.url)), 'dist')
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

async function serveStatic(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const relative = normalize(pathname).replace(/^[/\\]+/, '')
  let filePath = resolve(join(distRoot, relative || 'index.html'))
  if (!filePath.startsWith(distRoot)) return sendJson(response, 403, { message: 'Доступ запрещён' })

  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    filePath = join(distRoot, 'index.html')
  }

  try {
    const file = await readFile(filePath)
    response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' })
    response.end(request.method === 'HEAD' ? undefined : file)
  } catch {
    sendJson(response, 404, { message: 'Сначала выполните npm run build' })
  }
}

createServer(async (request, response) => {
  if (request.method === 'GET' || request.method === 'HEAD') return serveStatic(request, response)
  sendJson(response, 405, { message: 'Метод не поддерживается' })
}).listen(port, '127.0.0.1', () => console.log(`Домовид: http://127.0.0.1:${port}`))
