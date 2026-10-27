/**
 * 本机认证跳转：把浏览器带到 DSH 的 `/?token=…` 入口，换一个 30 天的
 * HttpOnly cookie，之后面板同源 `/api/session/*` RPC 就能复用该会话。
 *
 * 安全边界：
 *  - 只接受 Host 为 127.0.0.1 / localhost / [::1] 且端口等于当前 webServer；
 *  - 拒绝任何 forwarded / cloudflare 头，避免 tunnel 后的请求拿到 launch token；
 *  - 路由本身不返回 token，只返回 302；token 由 DSH connection 自己签发 cookie。
 */

const FORWARD_HEADERS = [
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'cf-connecting-ip',
  'cf-ray',
  'true-client-ip',
]

export function isLocalAuthority(req, port) {
  if (!req || !Number.isInteger(port) || port <= 0) return false
  const host = typeof req.headers?.host === 'string' ? req.headers.host.toLowerCase() : ''
  if (host === '') return false
  const allowed = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]
  if (!allowed.includes(host)) return false
  for (const header of FORWARD_HEADERS) {
    if (req.headers[header] !== undefined) return false
  }
  return true
}

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
  })
  res.end(body)
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Console} [logger]
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createAuthHandler(ctx, logger = console) {
  return async function handleAuth(req, res) {
    const port = ctx.webServer?.port
    if (!isLocalAuthority(req, Number(port))) {
      sendJson(res, 403, { error: { code: 'LOCAL_ONLY', message: '认证跳转只接受本机 127.0.0.1 访问' } })
      return
    }
    let connection
    try {
      connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
    } catch (error) {
      logger.warn?.(`[learning-hub] 读取 connection 服务失败：${error.message}`)
    }
    const browserAuth = connection?.browserAuth
    if (browserAuth === undefined || typeof browserAuth.authenticatedUrl !== 'function') {
      sendJson(res, 503, {
        error: {
          code: 'AUTH_BRIDGE_UNAVAILABLE',
          message: '当前 DSH 未提供 connection.browserAuth；请升级 DSH 或从 DSH 主界面打开面板。',
        },
      })
      return
    }
    let target
    try {
      // 保留请求自己的 authority：127.0.0.1 与 localhost 的 cookie 不共享。
      const host = String(req.headers.host).toLowerCase()
      target = browserAuth.authenticatedUrl(`http://${host}/`)
    } catch (error) {
      logger.warn?.(`[learning-hub] 生成认证 URL 失败：${error.message}`)
      sendJson(res, 500, { error: { code: 'AUTH_URL_FAILED', message: '无法生成 DSH 认证地址' } })
      return
    }
    res.writeHead(302, {
      location: target,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    })
    res.end()
  }
}
