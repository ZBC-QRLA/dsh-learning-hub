import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuthHandler, isLocalAuthority } from '../lib/auth.js'
import { createRequestHandler } from '../lib/api.js'

function fakeResponse() {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.status = status
      this.headers = headers
    },
    end(body = '') {
      this.body = String(body)
    },
  }
}

test('isLocalAuthority：接受本机三种 authority', () => {
  for (const host of ['127.0.0.1:10724', 'localhost:10724', '[::1]:10724']) {
    assert.equal(isLocalAuthority({ headers: { host } }, 10724), true, host)
  }
})

test('isLocalAuthority：拒绝公网 Host、错误端口与 forwarded 头', () => {
  assert.equal(isLocalAuthority({ headers: { host: '10aa44cdcfe3923d.dsh-market.com' } }, 10724), false)
  assert.equal(isLocalAuthority({ headers: { host: '127.0.0.1:9999' } }, 10724), false)
  assert.equal(isLocalAuthority({ headers: { host: '127.0.0.1:10724', 'x-forwarded-for': '1.2.3.4' } }, 10724), false)
  assert.equal(isLocalAuthority({ headers: { host: '127.0.0.1:10724', 'cf-connecting-ip': '1.2.3.4' } }, 10724), false)
})

test('createAuthHandler：本机请求 302 到带 token 的 DSH 根地址', async () => {
  const ctx = {
    webServer: { port: 10724 },
    get(name) {
      if (name !== 'connection') return undefined
      return { browserAuth: { authenticatedUrl: (base) => base + '?token=test-token' } }
    },
  }
  const res = fakeResponse()
  await createAuthHandler(ctx)({ method: 'GET', headers: { host: '127.0.0.1:10724' } }, res)
  assert.equal(res.status, 302)
  assert.equal(res.headers.location, 'http://127.0.0.1:10724/?token=test-token')
  assert.equal(res.headers['cache-control'], 'no-store')
})

test('createAuthHandler：公网 Host 或 forwarded 头返回 403，不泄露 token', async () => {
  const ctx = {
    webServer: { port: 10724 },
    get() { return { browserAuth: { authenticatedUrl: () => 'http://leak.invalid/?token=secret' } } },
  }
  const handler = createAuthHandler(ctx)
  for (const headers of [
    { host: '10aa44cdcfe3923d.dsh-market.com' },
    { host: '127.0.0.1:10724', 'x-forwarded-for': '1.2.3.4' },
  ]) {
    const res = fakeResponse()
    await handler({ method: 'GET', headers }, res)
    assert.equal(res.status, 403)
    assert.equal(res.body.includes('secret'), false)
  }
})

test('createAuthHandler：没有 connection 服务时 503，不抛错', async () => {
  const ctx = { webServer: { port: 10724 }, get() { return undefined } }
  const res = fakeResponse()
  await createAuthHandler(ctx)({ method: 'GET', headers: { host: '127.0.0.1:10724' } }, res)
  assert.equal(res.status, 503)
  assert.match(res.body, /AUTH_BRIDGE_UNAVAILABLE/)
})

test('api：/learning-hub/auth 交给 authHandler，而不是静态文件', async () => {
  let called = 0
  const handler = createRequestHandler({
    store: {},
    panel: { loadIndex: () => ({ html: 'index' }), resolveAsset: () => null },
    logger: { warn() {}, error() {} },
    authHandler(req, res) {
      called += 1
      res.writeHead(302, { location: 'http://127.0.0.1:10724/?token=t' })
      res.end()
    },
  })
  const req = {
    method: 'GET',
    url: '/learning-hub/auth',
    headers: { host: '127.0.0.1:10724' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  const res = fakeResponse()
  await handler(req, res)
  assert.equal(called, 1)
  assert.equal(res.status, 302)
})

test('api：/learning-hub/auth 非 GET 返回 405', async () => {
  const handler = createRequestHandler({
    store: {},
    panel: { loadIndex: () => ({ html: 'index' }), resolveAsset: () => null },
    logger: { warn() {}, error() {} },
    authHandler() { throw new Error('should not run') },
  })
  const req = {
    method: 'POST',
    url: '/learning-hub/auth',
    headers: { host: '127.0.0.1:10724' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  const res = fakeResponse()
  await handler(req, res)
  assert.equal(res.status, 405)
})
