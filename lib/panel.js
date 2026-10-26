/**
 * 学习中枢面板服务：从 panelDir 读取静态 HTML/CSS/JS。
 *
 * - 找不到 panelDir/index.html 时返回内置最小页（无 CDN、无外部字体）。
 * - panelDir 可回落包内 ./public（相对包根）。
 * - 所有静态路径先解码再做 realpath 包含校验，禁止 ../ 与绝对路径逃逸。
 */

import fs from 'node:fs'
import path from 'node:path'

import { isInside, realpathLoose } from './store.js'

export const PANEL_BASE = '/learning-hub/'

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

export function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

const FALLBACK_STYLE = `
:root{color-scheme:light dark;--bg:#f7f7f5;--fg:#1d1d1f;--muted:#6b6b70;--line:#dcdcd6;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#171719;--fg:#ececec;--muted:#9a9aa0;--line:#333338;--card:#202024}}
*{box-sizing:border-box}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font:14px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
header{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:baseline;margin-bottom:20px}
h1{font-size:20px;margin:0}
h2{font-size:15px;margin:0 0 8px}
main{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
ul{margin:0;padding-left:18px}
li{margin:4px 0}
.muted{color:var(--muted)}
.error{color:#c0392b;white-space:pre-wrap}
`

const FALLBACK_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>学习中枢</title>
<style>${FALLBACK_STYLE}</style>
</head>
<body>
<header>
  <h1>学习中枢</h1>
  <span id="meta" class="muted">加载中…</span>
</header>
<p id="error" class="error" hidden></p>
<main>
  <section><h2>分叉</h2><ul id="branches"><li class="muted">—</li></ul></section>
  <section><h2>到期复习</h2><ul id="due"><li class="muted">—</li></ul></section>
  <section><h2>薄弱概念</h2><ul id="weak"><li class="muted">—</li></ul></section>
  <section><h2>最近活动</h2><ul id="activity"><li class="muted">—</li></ul></section>
</main>
<script>
(function () {
  var meta = document.getElementById('meta')
  var errorBox = document.getElementById('error')
  var lists = {
    branches: document.getElementById('branches'),
    due: document.getElementById('due'),
    weak: document.getElementById('weak'),
    activity: document.getElementById('activity')
  }
  function fill(key, items, format) {
    var list = lists[key]
    list.textContent = ''
    if (!items || items.length === 0) {
      var empty = document.createElement('li')
      empty.className = 'muted'
      empty.textContent = '—'
      list.appendChild(empty)
      return
    }
    items.forEach(function (item) {
      var li = document.createElement('li')
      li.textContent = format(item)
      list.appendChild(li)
    })
  }
  fetch('/api/learning-hub/state', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status)
      return response.json()
    })
    .then(function (state) {
      var concepts = {}
      ;(state.concepts || []).forEach(function (concept) { concepts[concept.id] = concept })
      meta.textContent = [state.profile && state.profile.name, state.profile && state.profile.stage, state.generated_at || state.generatedAt]
        .filter(Boolean).join(' · ')
      fill('branches', state.branches, function (branch) {
        var mastery = branch.masteryAvg != null ? branch.masteryAvg : branch.mastery
        var count = branch.conceptCount != null ? branch.conceptCount : branch.concept_count
        var due = branch.dueCount != null ? branch.dueCount : branch.due_count
        return branch.name + ' · 掌握度 ' + mastery + ' · 概念 ' + count + ' · 到期 ' + due
      })
      fill('due', state.due_reviews || state.dueReviews, function (row) {
        var concept = concepts[row.concept] || {}
        return (concept.name || row.concept) + ' · ' + (row.due || '')
      })
      fill('weak', state.weak_concepts || state.weakConcepts, function (row) {
        var concept = concepts[row.concept] || {}
        return (concept.name || row.concept) + ' · mastery ' + row.mastery
      })
      fill('activity', state.recent_activity || state.recentActivity, function (row) {
        return (row.ts || '') + ' · ' + (row.branch || '') + ' · ' + (row.unit || '') + ' · ' + (row.action || '')
      })
    })
    .catch(function (error) {
      errorBox.hidden = false
      errorBox.textContent = '无法读取状态：' + error.message + '\\n（这是插件内置的降级页，说明 panelDir 里没有 index.html）'
      meta.textContent = ''
    })
})()
</script>
</body>
</html>
`

/**
 * @param {{panelDir?: string, packageRoot: string, logger?: Console}} options
 */
export function createPanel(options = {}) {
  const logger = options.logger ?? console
  const candidates = []
  if (typeof options.panelDir === 'string' && options.panelDir.trim() !== '') {
    candidates.push(path.resolve(options.panelDir))
  }
  if (typeof options.packageRoot === 'string' && options.packageRoot !== '') {
    candidates.push(path.join(options.packageRoot, 'public'))
  }

  let warned = false

  function findPanelDir() {
    for (const candidate of candidates) {
      try {
        const stat = fs.statSync(path.join(candidate, 'index.html'))
        if (stat.isFile()) return candidate
      } catch {
        // 继续尝试下一个候选目录。
      }
    }
    return null
  }

  function loadIndex() {
    const directory = findPanelDir()
    if (directory === null) {
      if (!warned) {
        warned = true
        logger.warn?.(`[learning-hub] 未找到面板 index.html（候选：${candidates.join(' | ')}），返回内置降级页`)
      }
      return { html: FALLBACK_HTML, source: 'builtin' }
    }
    try {
      return { html: fs.readFileSync(path.join(directory, 'index.html'), 'utf8'), source: directory }
    } catch (error) {
      logger.warn?.(`[learning-hub] 读取面板 index.html 失败，使用内置降级页：${error.message}`)
      return { html: FALLBACK_HTML, source: 'builtin' }
    }
  }

  /**
   * 解析 panelDir 内的一个静态相对路径。
   * @returns {{file: string, contentType: string} | null} null = 不存在或越界
   */
  function resolveAsset(relative) {
    const directory = findPanelDir()
    if (directory === null) return null
    let decoded
    try {
      decoded = decodeURIComponent(relative)
    } catch {
      return null
    }
    if (decoded.includes('\0')) return null
    const normalized = decoded.replace(/\\/g, '/')
    if (normalized === '' || normalized === 'index.html') {
      const index = path.join(directory, 'index.html')
      return fs.existsSync(index) ? { file: index, contentType: contentTypeFor(index) } : null
    }
    if (normalized.startsWith('/') || normalized.split('/').includes('..')) return null

    const rootReal = realpathLoose(directory)
    const target = path.resolve(rootReal, normalized)
    const real = realpathLoose(target)
    if (!isInside(rootReal, real)) return null
    try {
      const stat = fs.statSync(real)
      if (!stat.isFile()) return null
    } catch {
      return null
    }
    return { file: real, contentType: contentTypeFor(real) }
  }

  return {
    panelDir: findPanelDir,
    loadIndex,
    resolveAsset,
    fallbackHtml: FALLBACK_HTML,
  }
}
