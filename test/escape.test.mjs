import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { createPanel } from '../lib/panel.js'
import { createStore, isInside, PathEscapeError } from '../lib/store.js'
import { createFixture, FIXED_NOW, quietLogger } from './helpers.mjs'

test('assertInside：拒绝 ../ 与绝对路径逃逸，接受根内路径', async (t) => {
  const fixture = createFixture()
  t.after(() => fixture.cleanup())
  const store = createStore({ dataRoot: fixture.root, now: () => new Date(FIXED_NOW), logger: quietLogger() })

  const inside = store.assertInside('concepts.json', 'concepts')
  assert.equal(isInside(store.root, inside), true)

  assert.throws(() => store.assertInside('../escape.json', 'escape'), PathEscapeError)
  assert.throws(() => store.assertInside('..\\escape.json', 'escape'), PathEscapeError)
  assert.throws(() => store.assertInside(path.join(fixture.root, '..', 'escape.json'), 'escape'), PathEscapeError)
  assert.throws(() => store.assertInside('bad\0name', 'nul'), PathEscapeError)
})

test('assertInside：符号链接指向根外时拒绝（无权限建链接则跳过）', async (t) => {
  const fixture = createFixture()
  t.after(() => fixture.cleanup())
  const outside = fs.mkdtempSync(path.join(path.dirname(fixture.root), 'learning-hub-outside-'))
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }))
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret')

  const link = path.join(fixture.root, 'link-out')
  try {
    fs.symlinkSync(outside, link, 'junction')
  } catch (error) {
    t.skip(`当前环境不能创建 junction/symlink：${error.code}`)
    return
  }

  const store = createStore({ dataRoot: fixture.root, now: () => new Date(FIXED_NOW), logger: quietLogger() })
  assert.throws(() => store.assertInside('link-out/secret.txt', 'symlink'), PathEscapeError)
  assert.throws(() => store.assertInside('link-out/new.json', 'symlink'), PathEscapeError)
})

test('panel.resolveAsset：拒绝 ../、编码逃逸、绝对路径与目录', async (t) => {
  const fixture = createFixture()
  t.after(() => fixture.cleanup())
  fs.writeFileSync(path.join(fixture.root, 'secret.txt'), 'outside panel dir')
  fs.mkdirSync(path.join(fixture.panelDir, 'sub'))
  fs.writeFileSync(path.join(fixture.panelDir, 'sub', 'ok.txt'), 'ok')

  const panel = createPanel({ panelDir: fixture.panelDir, packageRoot: fixture.root, logger: quietLogger() })
  assert.equal(panel.resolveAsset('styles.css').contentType, 'text/css; charset=utf-8')
  assert.equal(panel.resolveAsset('sub/ok.txt').file.endsWith('ok.txt'), true)
  assert.equal(panel.resolveAsset('../secret.txt'), null)
  assert.equal(panel.resolveAsset('%2e%2e/secret.txt'), null)
  assert.equal(panel.resolveAsset('..%2fsecret.txt'), null)
  assert.equal(panel.resolveAsset('C:\\Windows\\win.ini'), null)
  assert.equal(panel.resolveAsset('sub'), null)
})

test('panel.loadIndex：panelDir 缺失时返回内置降级页', async (t) => {
  const fixture = createFixture()
  t.after(() => fixture.cleanup())
  const missing = path.join(fixture.root, 'no-such-panel')
  const panel = createPanel({ panelDir: missing, packageRoot: path.join(fixture.root, 'no-package'), logger: quietLogger() })
  const { html, source } = panel.loadIndex()
  assert.equal(source, 'builtin')
  assert.match(html, /学习中枢/)
  assert.match(html, /\/api\/learning-hub\/state/)
  assert.equal(/https?:\/\//.test(html.replace(/fetch\('\/api\/learning-hub\/state'/g, '')), false, '内置页不得依赖 CDN')
})
