/**
 * dsh-learning-hub 宿主插件入口（DSH 0.2.1-rc.3，Cordis 插件行 `learning-hub`）。
 *
 * 职责：
 *  1. 注册唯一工具 `learning_hub`（status/route/record/link/search/review）；
 *  2. 注册 `/learning-hub` 面板与 `/api/learning-hub/*` 接口到宿主 ctx.webServer；
 *  3. 可选：在 127.0.0.1:<port> 再起一个仅本机的只读/记录 HTTP 端口（默认关闭）。
 *
 * 不依赖 client 半部；面板是 panelDir 里的纯静态文件，缺失时返回内置降级页。
 */

import http from 'node:http'
import { fileURLToPath } from 'node:url'

import { defineTool } from '@deepseek-ai/dsh-tools'

import { createRequestHandler } from './api.js'
import { createAuthHandler } from './auth.js'
import { normalizeConfig } from './config.js'
import { createPanel, PANEL_BASE } from './panel.js'
import { createStore } from './store.js'

export const name = 'learning-hub'
export const inject = ['tools', 'webServer']

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

const TOOL_DESCRIPTION = [
  '学习中枢：读写 _learner 数据（profile / branches / concepts / progress / errors）。',
  'action=status 看全局状态；route 按 cwd 与首条消息判断属于哪门课；',
  'record 记录一条学习进度（可更新掌握度与下次复习）；link 连接概念；',
  'search 搜概念/错题/材料；review 看到期复习。一次调用只做一个 action。',
].join('')

const PARAMETERS = {
  action: {
    type: 'string',
    required: true,
    enum: ['status', 'route', 'record', 'link', 'search', 'review'],
    description: '操作名。',
  },
  branch: { type: 'string', description: '分支 id（如 math.calculus / cs.c）。record 必填；search 可选过滤。' },
  unit: { type: 'string', description: 'record 必填：本次学习单元、作业或章节名。' },
  event: {
    type: 'string',
    enum: ['study', 'practice', 'exam', 'review', 'misconception'],
    description: 'record 的进度事件类型，默认 study。注意与顶层 action（操作名）区分。',
  },
  mastery: { type: 'number', description: 'record 可选：0–5 掌握度。' },
  evidence: { type: 'string', description: 'record 必填：真实、可追溯证据（作业题号/文件路径/会话 id）；不接受 seed/待补充/示例 占位。' },
  note: { type: 'string', description: 'record 可选：备注；event=misconception 时写明误区。' },
  concept: { type: 'string', description: 'record/link 可选：概念 id。record 不填时按 unit 匹配概念名。' },
  text: { type: 'string', description: 'route：用户首条消息或主题文本。' },
  cwd: { type: 'string', description: 'route：当前工作目录。' },
  from: { type: 'string', description: 'link：起点概念 id（relation=prereq 时它是先修）。' },
  to: { type: 'string', description: 'link：终点概念 id。' },
  relation: { type: 'string', enum: ['prereq', 'related'], description: 'link：prereq=from 是 to 的先修；related=相关（双向）。' },
  query: { type: 'string', description: 'search：关键词。' },
  withinDays: { type: 'number', description: 'review：未来天数窗口，默认 7。' },
  log: { type: 'boolean', description: 'route：是否把本次路由写入 sessions.jsonl，默认 false。' },
}

function stateText(state) {
  const names = new Map(state.concepts.map((concept) => [concept.id, concept.name]))
  const lines = [
    `学习中枢 ${state.as_of} · ${state.branches.length} 分支 / ${state.concepts.length} 概念 / 到期 ${state.due_reviews.length} / 薄弱 ${state.weak_concepts.length}`,
  ]
  if (state.seed) lines.push('数据根为空：请先准备 profile.md / branches.json / concepts.json。')
  for (const branch of state.branches) {
    lines.push(`- ${branch.name}（${branch.id}）掌握度 ${branch.mastery} · ${branch.concept_count} 概念 · 到期 ${branch.due_count} · 下一步：${branch.next || '—'}`)
  }
  if (state.due_reviews.length > 0) {
    lines.push(`到期：${state.due_reviews.slice(0, 8).map((row) => `${names.get(row.concept) ?? row.concept}(${row.due})`).join('、')}`)
  }
  if (state.weak_concepts.length > 0) {
    lines.push(`薄弱：${state.weak_concepts.slice(0, 8).map((row) => `${names.get(row.concept) ?? row.concept}(${row.mastery})`).join('、')}`)
  }
  if (state.recent_activity.length > 0) {
    const latest = state.recent_activity[0]
    lines.push(`最近：${latest.ts} ${latest.branch} ${latest.unit} ${latest.action}`)
  }
  return lines.join('\n')
}

function toolText(args, value) {
  switch (args.action) {
    case 'status':
      return stateText(value)
    case 'route': {
      if (value.primary === null) return `未匹配到分支：${value.reason}`
      const concepts = value.concepts.map((concept) => `${concept.name}(${concept.mastery})`).join('、') || '—'
      return `主分支：${value.primary}（置信度 ${value.confidence}）\n次分支：${value.secondary.join('、') || '—'}\n理由：${value.reason}\n相关概念：${concepts}`
    }
    case 'record': {
      const updated = value.updated.conceptId
        ? `；概念 ${value.updated.conceptId} 掌握度 → ${value.updated.mastery}`
        : ''
      return `已记录${updated}。当前分支状态见 status。`
    }
    case 'link':
      return value.changed ? `已建立 ${value.from} --${value.relation}--> ${value.to}` : `关系已存在：${value.from} --${value.relation}--> ${value.to}`
    case 'search': {
      if (value.matches.length === 0) return `没有找到与「${value.query}」匹配的概念/错题/材料。`
      return value.matches.slice(0, 10).map((match) => `[${match.type}] ${match.name}${match.branch ? ` · ${match.branch}` : ''}`).join('\n')
    }
    case 'review': {
      if (value.due.length === 0) return `${value.withinDays} 天内没有到期复习。`
      return value.due.slice(0, 12).map((row) => `${row.name}（${row.due}${row.overdue_days > 0 ? `，逾期 ${row.overdue_days} 天` : ''}）`).join('\n')
    }
    default:
      return JSON.stringify(value, null, 2)
  }
}

function renderToolResult(args, value) {
  let text
  try {
    text = toolText(args, value)
  } catch {
    text = JSON.stringify(value, null, 2)
  }
  return [{ type: 'text', text }]
}

function startStandalone(ctx, port, handler, logger) {
  const server = http.createServer((req, res) => {
    handler(req, res).catch((error) => {
      logger.error?.(`[learning-hub] 独立端口请求失败：${error?.stack ?? error}`)
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('500 Internal Server Error')
      }
    })
  })
  server.on('error', (error) => {
    logger.warn?.(`[learning-hub] 独立端口 127.0.0.1:${port} 启动失败：${error.message}`)
  })
  server.listen(port, '127.0.0.1', () => {
    logger.info?.(`[learning-hub] 独立端口已启动：http://127.0.0.1:${port}${PANEL_BASE}`)
  })
  ctx.effect(() => () => {
    try {
      server.closeAllConnections?.()
      server.close()
    } catch {
      // 端口已被关闭。
    }
  }, 'learning-hub: standalone port')
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {object} config - Loader 行 config（dataRoot / panelDir / port）。
 */
export function apply(ctx, config) {
  const logger = ctx.logger ?? console
  const settings = normalizeConfig(config)
  if (settings.portInvalid) {
    logger.warn?.('[learning-hub] config.port 不是 1–65535 的整数，已忽略（独立端口默认关闭）')
  }

  const store = createStore({
    dataRoot: settings.dataRoot,
    backupKeep: settings.backupKeep,
    logger,
  })
  const panel = createPanel({
    panelDir: settings.panelDir,
    packageRoot: PACKAGE_ROOT,
    logger,
  })
  const handler = createRequestHandler({
    store,
    panel,
    logger,
    authHandler: createAuthHandler(ctx, logger),
  })

  const routes = [
    { kind: 'exact', path: '/learning-hub' },
    { kind: 'exact', path: '/learning-hub/auth' },
    // Prefix without the trailing slash: the host matcher matches `${prefix}/...`,
    // so a `/learning-hub/` prefix would not serve `/learning-hub/styles.css`.
    { kind: 'prefix', path: '/learning-hub' },
    { kind: 'exact', path: '/api/learning-hub/state' },
    { kind: 'exact', path: '/api/learning-hub/record' },
    { kind: 'exact', path: '/api/learning-hub/route' },
  ]
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register({ ...route, handler }))
    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          // 卸载顺序由宿主决定；重复 dispose 不应中断清理。
        }
      }
    }
  }, 'learning-hub: http routes')

  ctx.tools.register(defineTool({
    name: 'learning_hub',
    description: TOOL_DESCRIPTION,
    parameters: PARAMETERS,
    output: {
      schema: { type: 'json' },
      render: renderToolResult,
    },
    async execute(args, exec) {
      exec?.signal?.throwIfAborted?.()
      const action = String(args.action ?? '').trim()
      switch (action) {
        case 'status':
          return store.buildState()
        case 'route': {
          const result = await store.route({ text: args.text, cwd: args.cwd })
          if (args.log === true) {
            await store.appendSession({
              cwd: args.cwd,
              primary: result.primary,
              secondary: result.secondary,
              confidence: result.confidence,
              reason: result.reason,
            })
          }
          return result
        }
        case 'record':
          return store.record({
            branch: args.branch,
            unit: args.unit,
            event: args.event,
            mastery: args.mastery,
            evidence: args.evidence,
            note: args.note,
            concept: args.concept,
          })
        case 'link':
          return store.link({ from: args.from, to: args.to, relation: args.relation })
        case 'search':
          return store.search({ query: args.query, branch: args.branch })
        case 'review':
          return store.review({ withinDays: args.withinDays })
        default:
          throw new Error(`learning_hub: unknown action "${action}"（允许：status/route/record/link/search/review）`)
      }
    },
  }))

  if (settings.port > 0) startStandalone(ctx, settings.port, handler, logger)

  logger.info?.(
    `[learning-hub] 已加载：dataRoot=${settings.dataRoot}；面板=${panel.panelDir() ?? '内置降级页'}；入口 http://127.0.0.1:${ctx.webServer?.port ?? '?'}/learning-hub/`,
  )
}
