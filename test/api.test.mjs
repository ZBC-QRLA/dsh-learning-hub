import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

import { createRequestHandler } from '../lib/api.js'
import { createPanel } from '../lib/panel.js'
import { createStore } from '../lib/store.js'
import { createFixture, FIXED_NOW, quietLogger } from './helpers.mjs'

function rawRequest(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path, method, headers }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    request.on('error', reject)
    if (body !== undefined) request.write(body)
    request.end()
  })
}

async function startServer(t) {
  const fixture = createFixture()
  const store = createStore({ dataRoot: fixture.root, now: () => new Date(FIXED_NOW), logger: quietLogger() })
  const panel = createPanel({ panelDir: fixture.panelDir, packageRoot: fixture.root, logger: quietLogger() })
  const handler = createRequestHandler({ store, panel, logger: quietLogger() })
  const server = http.createServer((req, res) => {
    handler(req, res).catch((error) => {
      res.writeHead(500)
      res.end(String(error))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  t.after(() => new Promise((resolve) => server.close(resolve)))
  t.after(() => fixture.cleanup())
  return { fixture, store, port }
}

test('GET /api/learning-hub/state：完整 state 形状与 canonical/别名', async (t) => {
  const { port } = await startServer(t)
  const response = await rawRequest(port, '/api/learning-hub/state')
  assert.equal(response.status, 200)
  assert.match(response.headers['content-type'], /application\/json/)
  const state = JSON.parse(response.body)

  for (const key of ['schema', 'seed', 'as_of', 'generated_at', 'profile', 'current_branch', 'branches', 'concepts', 'weak_concepts', 'due_reviews', 'recent_activity']) {
    assert.ok(Object.hasOwn(state, key), `state 缺少 ${key}`)
  }
  assert.equal(state.schema, 'learning-hub.state/v1')
  assert.equal(state.profile.name, 'Demo Learner')
  assert.equal(state.branches.length, 3)
  assert.equal(state.branches[0].masteryAvg !== undefined, true)
  assert.equal(state.branches[0].conceptCount !== undefined, true)
  assert.equal(state.branches[0].dueCount !== undefined, true)
  assert.ok(Array.isArray(state.weak_concepts))
  assert.ok(Array.isArray(state.due_reviews))
  assert.ok(Array.isArray(state.recent_activity))
})

test('GET /learning-hub：302 到 /learning-hub/；面板与静态资源可读', async (t) => {
  const { port } = await startServer(t)

  const redirect = await rawRequest(port, '/learning-hub')
  assert.equal(redirect.status, 302)
  assert.equal(redirect.headers.location, '/learning-hub/')

  const index = await rawRequest(port, '/learning-hub/')
  assert.equal(index.status, 200)
  assert.match(index.body, /panel-marker/)

  const css = await rawRequest(port, '/learning-hub/styles.css')
  assert.equal(css.status, 200)
  assert.match(css.headers['content-type'], /text\/css/)

  const js = await rawRequest(port, '/learning-hub/app.js')
  assert.equal(js.status, 200)
  assert.match(js.headers['content-type'], /javascript/)

  const sample = await rawRequest(port, '/learning-hub/sample-state.json')
  assert.equal(sample.status, 200)
  assert.equal(JSON.parse(sample.body).schema, 'learning-hub.state/v1')
})

test('POST /api/learning-hub/record：接受 panel 的 {branch,unit,action,...} 并返回 {ok,updated,state}', async (t) => {
  const { port } = await startServer(t)
  const response = await rawRequest(port, '/api/learning-hub/record', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ branch: 'cs.c', unit: '指针与数组', action: 'practice', mastery: 3, evidence: '作业4' }),
  })
  assert.equal(response.status, 200)
  const result = JSON.parse(response.body)
  assert.equal(result.ok, true)
  assert.equal(result.updated.conceptId, 'cs.c.pointer')
  assert.equal(result.updated.mastery, 3)
  assert.equal(result.state.schema, 'learning-hub.state/v1')
  assert.equal(result.state.recent_activity[0].branch, 'cs.c')
})

test('POST /api/learning-hub/route：cwd/关键词路由', async (t) => {
  const { port } = await startServer(t)
  const response = await rawRequest(port, '/api/learning-hub/route', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '指针和数组', cwd: '/path/to/learner/courses/c/homework-4' }),
  })
  assert.equal(response.status, 200)
  const result = JSON.parse(response.body)
  assert.equal(result.primary, 'cs.c')
  assert.ok(result.confidence >= 0.6)
  assert.ok(Array.isArray(result.concepts))
})

test('写接口安全：非 JSON 415、坏 JSON 400、cross-site 403、错误方法 405', async (t) => {
  const { port } = await startServer(t)

  const wrongType = await rawRequest(port, '/api/learning-hub/record', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: JSON.stringify({ branch: 'cs.c', unit: '指针' }),
  })
  assert.equal(wrongType.status, 415)

  const badJson = await rawRequest(port, '/api/learning-hub/record', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  })
  assert.equal(badJson.status, 400)

  const crossSite = await rawRequest(port, '/api/learning-hub/state', {
    headers: { 'sec-fetch-site': 'cross-site' },
  })
  assert.equal(crossSite.status, 403)

  const wrongMethod = await rawRequest(port, '/api/learning-hub/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(wrongMethod.status, 405)

  const unknown = await rawRequest(port, '/api/learning-hub/nope')
  assert.equal(unknown.status, 404)
})

test('静态路径逃逸与 HEAD 请求', async (t) => {
  const { port } = await startServer(t)

  const traversal = await rawRequest(port, '/learning-hub/%2e%2e/secret.txt')
  assert.equal(traversal.status, 404)

  const head = await rawRequest(port, '/api/learning-hub/state', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.body, '')
  assert.ok(Number(head.headers['content-length']) > 0)
})
