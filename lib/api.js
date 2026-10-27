/**
 * 学习中枢 HTTP 层：可挂到宿主 ctx.webServer，也可被独立 node:http 端口复用。
 *
 * 路由（SPEC 2）：
 *   GET  /learning-hub            → 302 /learning-hub/
 *   GET  /learning-hub/           → panelDir/index.html（缺失时内置降级页）
 *   GET  /learning-hub/<asset>    → panelDir 内静态文件（styles.css / app.js / sample-state.json …）
 *   GET  /api/learning-hub/state  → 状态 JSON
 *   POST /api/learning-hub/record → 记录一条进度
 *   POST /api/learning-hub/route  → 路由打分
 *
 * 安全：只接受回环客户端；拒绝 cross-site 与跨源 Origin；写请求限 JSON、
 * 体积上限 64 KiB。所有文件路径由 store/panel 做 realpath 包含校验。
 */

import fs from 'node:fs'

import { PANEL_BASE } from './panel.js'
import { MAX_BODY_BYTES, PathEscapeError, ValidationError } from './store.js'

const API_PREFIX = '/api/learning-hub/'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'none'",
].join('; ')

function isLoopbackAddress(address) {
  if (typeof address !== 'string' || address === '') return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isLoopbackAddress(normalized.slice(7))
  return /^127\./.test(normalized)
}

function assertTrustedRequest(req) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) {
    throw new ApiError(403, 'LOOPBACK_ONLY', 'learning hub 只接受本机回环请求')
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw new ApiError(403, 'CROSS_SITE', '拒绝 cross-site 请求')
  }
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
    let originHost
    try {
      originHost = new URL(origin).host
    } catch {
      throw new ApiError(403, 'BAD_ORIGIN', 'Origin 无法解析')
    }
    if (originHost !== req.headers.host) throw new ApiError(403, 'BAD_ORIGIN', 'Origin 与 Host 不一致')
  }
}

async function readJsonBody(req) {
  const contentType = req.headers['content-type']
  if (typeof contentType === 'string' && contentType !== '' && !/^application\/json\b/i.test(contentType)) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', '请求体必须是 application/json')
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      req.destroy()
      throw new ApiError(413, 'BODY_TOO_LARGE', `请求体超过 ${MAX_BODY_BYTES} 字节`)
    }
    chunks.push(chunk)
  }
  if (size === 0) throw new ApiError(400, 'EMPTY_BODY', '请求体为空')
  let parsed
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new ApiError(400, 'INVALID_JSON', '请求体不是合法 JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(400, 'INVALID_BODY', '请求体必须是 JSON 对象')
  }
  return parsed
}

function baseHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
  }
}

function send(req, res, status, headers, body) {
  const buffer = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8')
  res.writeHead(status, {
    ...baseHeaders(),
    ...(buffer === null ? {} : { 'content-length': String(buffer.length) }),
    ...headers,
  })
  if (buffer === null || req.method === 'HEAD') res.end()
  else res.end(buffer)
}

function sendJson(req, res, status, value, extraHeaders = {}) {
  send(req, res, status, { 'content-type': 'application/json; charset=utf-8', ...extraHeaders }, JSON.stringify(value))
}

function sendHtml(req, res, status, html) {
  send(req, res, status, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': CONTENT_SECURITY_POLICY,
  }, html)
}

function sendText(req, res, status, text) {
  send(req, res, status, { 'content-type': 'text/plain; charset=utf-8' }, text)
}

function methodNotAllowed(req, res, allowed) {
  sendText(req, res, 405, `405 Method Not Allowed（允许：${allowed.join(', ')}）`)
}

/**
 * @param {{store: ReturnType<import('./store.js').createStore>, panel: ReturnType<import('./panel.js').createPanel>, logger?: Console}} options
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createRequestHandler(options) {
  const store = options.store
  const panel = options.panel
  const logger = options.logger ?? console
  const authHandler = options.authHandler

  async function handleApi(req, res, name) {
    if (name === 'state') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(req, res, ['GET', 'HEAD'])
      return sendJson(req, res, 200, await store.buildState())
    }
    if (name === 'record') {
      if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST'])
      const body = await readJsonBody(req)
      const result = await store.record({
        branch: body.branch,
        unit: body.unit,
        event: body.event ?? body.action,
        mastery: body.mastery,
        evidence: body.evidence,
        note: body.note,
        concept: body.concept,
        session: body.session,
      })
      return sendJson(req, res, 200, result)
    }
    if (name === 'route') {
      if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST'])
      const body = await readJsonBody(req)
      return sendJson(req, res, 200, await store.route({ text: body.text, cwd: body.cwd }))
    }
    return sendJson(req, res, 404, { error: { code: 'NOT_FOUND', message: `unknown endpoint: ${name}` } })
  }

  async function dispatch(req, res) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const pathname = url.pathname

    if (pathname !== '/learning-hub' && !pathname.startsWith(PANEL_BASE) && !pathname.startsWith(API_PREFIX)) {
      return sendJson(req, res, 404, { error: { code: 'NOT_FOUND', message: 'not a learning-hub route' } })
    }

    assertTrustedRequest(req)

    if (pathname === '/learning-hub/auth') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(req, res, ['GET', 'HEAD'])
      if (typeof authHandler !== 'function') {
        return sendJson(req, res, 503, {
          error: { code: 'AUTH_BRIDGE_UNAVAILABLE', message: '学习中枢未加载认证跳转处理器' },
        })
      }
      return authHandler(req, res)
    }

    if (pathname === '/learning-hub') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(req, res, ['GET', 'HEAD'])
      return send(req, res, 302, { location: PANEL_BASE }, '')
    }

    if (pathname.startsWith(API_PREFIX)) {
      return handleApi(req, res, pathname.slice(API_PREFIX.length))
    }

    // /learning-hub/…
    if (pathname === PANEL_BASE) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(req, res, ['GET', 'HEAD'])
      const { html } = panel.loadIndex()
      return sendHtml(req, res, 200, html)
    }

    const relative = pathname.slice(PANEL_BASE.length)
    if (relative.startsWith('api/learning-hub/')) {
      return handleApi(req, res, relative.slice('api/learning-hub/'.length))
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(req, res, ['GET', 'HEAD'])
    const asset = panel.resolveAsset(relative)
    if (asset === null) return sendText(req, res, 404, `404 Not Found: ${relative}`)
    let body
    try {
      body = fs.readFileSync(asset.file)
    } catch (error) {
      logger.warn?.(`[learning-hub] 读取面板资源失败 ${asset.file}: ${error.message}`)
      return sendText(req, res, 404, '404 Not Found')
    }
    return send(req, res, 200, { 'content-type': asset.contentType }, body)
  }

  return async function handle(req, res) {
    try {
      await dispatch(req, res)
    } catch (error) {
      if (res.headersSent) {
        res.destroy?.()
        return
      }
      if (error instanceof ApiError) {
        sendJson(req, res, error.status, { error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof ValidationError) {
        sendJson(req, res, 400, { error: { code: error.code, message: error.message } })
        return
      }
      if (error instanceof PathEscapeError) {
        sendJson(req, res, 403, { error: { code: error.code, message: 'path escapes the data root' } })
        return
      }
      logger.error?.('[learning-hub] 请求处理失败', error)
      sendJson(req, res, 500, { error: { code: 'INTERNAL', message: 'internal error' } })
    }
  }
}
