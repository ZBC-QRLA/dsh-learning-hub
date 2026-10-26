/**
 * learning-hub 数据层：_learner 文件的读取、校验、备份与原子写。
 *
 * 安全边界（SPEC 0/2）：
 *  - 所有读写都限制在 dataRoot 内，写入前对目标做 realpath 包含校验；
 *  - 覆盖写前备份到 dataRoot/.backups/，JSON 用「同目录临时文件 + rename」原子替换；
 *  - 不读取任何凭据文件；只碰下方固定文件名。
 *
 * 纯 Node 内置模块，零外部依赖，便于单测。
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

import { scoreBranches } from './router.js'

export const STATE_SCHEMA = 'learning-hub.state/v1'

export const FILE_NAMES = Object.freeze({
  profile: 'profile.md',
  branches: 'branches.json',
  concepts: 'concepts.json',
  progress: 'progress.jsonl',
  errors: 'errors.json',
  materials: 'materials/index.md',
  sessions: 'sessions.jsonl',
  reviews: 'reviews.json',
})

export const BACKUP_DIR = '.backups'
export const MAX_JSONL_BACKUP_BYTES = 4 * 1024 * 1024
export const MAX_BODY_BYTES = 64 * 1024

export const PROGRESS_EVENTS = Object.freeze(['study', 'practice', 'exam', 'review', 'misconception'])
export const LINK_RELATIONS = Object.freeze(['prereq', 'related'])

export class PathEscapeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PathEscapeError'
    this.code = 'PATH_ESCAPE'
  }
}

export class ValidationError extends Error {
  constructor(message, code = 'INVALID_ARGUMENT') {
    super(message)
    this.name = 'ValidationError'
    this.code = code
  }
}

// ── 路径安全 ─────────────────────────────────────────────────────────────

/** realpath 最近的存在祖先，再把不存在的尾巴拼回去（用于预写校验）。 */
export function realpathLoose(target) {
  const resolved = path.resolve(target)
  const missing = []
  let current = resolved
  for (;;) {
    try {
      const real = fs.realpathSync.native(current)
      return missing.length === 0 ? real : path.join(real, ...missing.reverse())
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
      const parent = path.dirname(current)
      if (parent === current) return resolved
      missing.push(path.basename(current))
      current = parent
    }
  }
}

/** candidate 是否在 root（两者都应是 realpath）之内；Windows 大小写不敏感。 */
export function isInside(root, candidate) {
  const relative = path.relative(root, candidate)
  if (relative === '') return true
  if (path.isAbsolute(relative)) return false
  return relative.split(path.sep)[0] !== '..'
}

/** 解析并做 realpath 包含校验；越界抛 PathEscapeError。 */
export function assertInside(root, candidate, label = 'path') {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new PathEscapeError(`${label} must be a non-empty string`)
  }
  if (candidate.includes('\0')) throw new PathEscapeError(`${label} contains a NUL byte`)
  const resolved = path.resolve(root, candidate)
  const real = realpathLoose(resolved)
  if (!isInside(root, real)) throw new PathEscapeError(`${label} escapes the data root: ${candidate}`)
  return real
}

// ── 日期/字符串小工具 ────────────────────────────────────────────────────

function pad2(value) {
  return String(value).padStart(2, '0')
}

/** 本地时区的 YYYY-MM-DD。 */
export function formatLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 带本地时区偏移的 ISO 时间（SPEC 1.4 的 ts 形态）。 */
export function isoWithOffset(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  return `${formatLocalDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`
}

export function addDays(date, days) {
  const copy = new Date(date.getTime())
  copy.setDate(copy.getDate() + days)
  return copy
}

/** 把任意日期字符串规整成 YYYY-MM-DD；无法识别返回 null。 */
export function normalizeDateString(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

function daysBetween(fromDate, toDate) {
  const from = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
  const to = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())
  return Math.round((from - to) / 86_400_000)
}

/** 解析 from 到 to 的天数（to 晚于 from 为正）。 */
function dateStringDiff(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${toDate}T00:00:00`)
  return daysBetween(to, from)
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function asStringArray(value) {
  if (!Array.isArray(value)) return []
  const result = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim() !== '') result.push(item.trim())
  }
  return result
}

function asMastery(value, fallback = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.min(5, Math.round(number)))
}

function requiredString(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '') throw new ValidationError(`${field} is required`, 'MISSING_FIELD')
  if (text.length > maxLength) throw new ValidationError(`${field} is longer than ${maxLength} characters`, 'FIELD_TOO_LONG')
  return text
}

function optionalString(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return ''
  const text = typeof value === 'string' ? value.trim() : String(value)
  if (text.length > maxLength) throw new ValidationError(`${field} is longer than ${maxLength} characters`, 'FIELD_TOO_LONG')
  return text
}

// ── 极简 YAML frontmatter（只覆盖 profile.md 用到的子集） ────────────────

function parseScalar(raw) {
  const value = raw.trim()
  if (value === '') return ''
  if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2)
    || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
    return value.slice(1, -1)
  }
  if (/^(true|yes)$/i.test(value)) return true
  if (/^(false|no)$/i.test(value)) return false
  if (/^(null|~)$/i.test(value)) return null
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return value
}

function parseInlineList(raw) {
  const inner = raw.slice(1, -1).trim()
  if (inner === '') return []
  return inner.split(',').map((item) => parseScalar(item))
}

export function parseSimpleYaml(lines) {
  const root = {}
  let currentKey = null
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    const indent = line.match(/^\s*/)[0].length
    const trimmed = line.trim()

    if (trimmed.startsWith('- ')) {
      if (currentKey === null) continue
      if (!Array.isArray(root[currentKey])) root[currentKey] = []
      root[currentKey].push(parseScalar(trimmed.slice(2)))
      continue
    }

    const colon = trimmed.indexOf(':')
    if (colon <= 0) continue
    const key = trimmed.slice(0, colon).trim()
    const rest = trimmed.slice(colon + 1).trim()

    if (indent === 0) {
      currentKey = key
      if (rest === '') {
        root[key] = null
      } else if (rest.startsWith('[') && rest.endsWith(']')) {
        root[key] = parseInlineList(rest)
      } else {
        root[key] = parseScalar(rest)
      }
      continue
    }

    if (currentKey === null) continue
    if (root[currentKey] === null || typeof root[currentKey] !== 'object' || Array.isArray(root[currentKey])) {
      root[currentKey] = {}
    }
    root[currentKey][key] = rest === '' ? null : parseScalar(rest)
  }
  return root
}

export function parseFrontmatter(markdown) {
  const text = String(markdown ?? '').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { data: {}, body: text.trim(), hasFrontmatter: false }
  let end = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      end = index
      break
    }
  }
  if (end === -1) return { data: {}, body: text.trim(), hasFrontmatter: false }
  return {
    data: parseSimpleYaml(lines.slice(1, end)),
    body: lines.slice(end + 1).join('\n').trim(),
    hasFrontmatter: true,
  }
}

// ── 规范化读取 ──────────────────────────────────────────────────────────

function normalizeBranch(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = asString(raw.id)
  const name = asString(raw.name)
  if (id === '' || name === '') return null
  return {
    id,
    name,
    parent: asString(raw.parent) || null,
    workspace: asString(raw.workspace),
    paths: asStringArray(raw.paths),
    keywords: asStringArray(raw.keywords),
    materials: asStringArray(raw.materials),
    status: asString(raw.status) || 'active',
    next: asString(raw.next),
  }
}

function normalizeConcept(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = asString(raw.id)
  const name = asString(raw.name)
  if (id === '' || name === '') return null
  return {
    id,
    name,
    aliases: asStringArray(raw.aliases),
    branches: asStringArray(raw.branches),
    prereq: asStringArray(raw.prereq),
    related: asStringArray(raw.related),
    mastery: asMastery(raw.mastery),
    evidence: asStringArray(raw.evidence),
    misconceptions: asStringArray(raw.misconceptions),
    sources: asStringArray(raw.sources),
    next_review: normalizeDateString(raw.next_review),
  }
}

function normalizeError(raw) {
  if (!raw || typeof raw !== 'object') return null
  const symptom = asString(raw.symptom)
  if (symptom === '') return null
  return {
    id: asString(raw.id),
    branch: asString(raw.branch),
    concept: asString(raw.concept),
    symptom,
    root_cause: asString(raw.root_cause),
    fix: asString(raw.fix),
    seen: Number.isFinite(Number(raw.seen)) ? Number(raw.seen) : 0,
    last_at: asString(raw.last_at),
  }
}

function normalizeProgress(raw) {
  if (!raw || typeof raw !== 'object') return null
  const branch = asString(raw.branch)
  const unit = asString(raw.unit)
  if (branch === '' || unit === '') return null
  const entry = {
    ts: asString(raw.ts),
    branch,
    unit,
    action: asString(raw.action) || 'study',
  }
  if (raw.mastery !== undefined && raw.mastery !== null) entry.mastery = asMastery(raw.mastery)
  const evidence = asString(raw.evidence)
  if (evidence) entry.evidence = evidence
  const note = asString(raw.note)
  if (note) entry.note = note
  const session = asString(raw.session)
  if (session) entry.session = session
  const concept = asString(raw.concept)
  if (concept) entry.concept = concept
  return entry
}

function dedupeById(list) {
  const seen = new Set()
  const result = []
  for (const item of list) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}

/** 掌握度 → 下次复习间隔（SPEC 3.2 的 1/3/7/14 天）。 */
export function nextReviewDays(mastery, event = 'study') {
  if (event === 'misconception') return 1
  if (mastery <= 1) return 1
  if (mastery === 2) return 3
  if (mastery === 3) return 7
  return 14
}

/**
 * 按 unit 找概念：先精确匹配 name/alias，再找 unit 里最早出现的最长名称。
 * 例如 unit=「指针与数组」命中「指针」（而不是要求 unit 恰好等于概念名）。
 */
export function matchConceptByUnit(concepts, unit) {
  const unitKey = String(unit).trim().toLowerCase()
  if (unitKey === '') return null
  const exact = concepts.find((concept) => concept.name.toLowerCase() === unitKey
    || concept.aliases.some((alias) => alias.toLowerCase() === unitKey))
  if (exact !== undefined) return exact

  let best = null
  for (const concept of concepts) {
    for (const term of [concept.name, ...concept.aliases]) {
      const needle = String(term).trim().toLowerCase()
      if (needle.length < 2) continue
      const position = unitKey.indexOf(needle)
      if (position === -1) continue
      if (best === null || position < best.position || (position === best.position && needle.length > best.length)) {
        best = { concept, position, length: needle.length }
      }
    }
  }
  return best?.concept ?? null
}

// ── Store ───────────────────────────────────────────────────────────────

/**
 * @param {{dataRoot: string, now?: () => Date, logger?: Console, backupKeep?: number}} options
 */
export function createStore(options = {}) {
  const dataRoot = path.resolve(options.dataRoot ?? process.cwd())
  const now = typeof options.now === 'function' ? options.now : () => new Date()
  const logger = options.logger ?? console
  const backupKeep = Number.isInteger(options.backupKeep) && options.backupKeep > 0 ? options.backupKeep : 20

  let rootReal = null
  let queue = Promise.resolve()

  function serialize(task) {
    const run = queue.then(task, task)
    queue = run.then(() => undefined, () => undefined)
    return run
  }

  function ensureRoot() {
    if (rootReal !== null) return rootReal
    fs.mkdirSync(dataRoot, { recursive: true })
    rootReal = fs.realpathSync.native(dataRoot)
    return rootReal
  }

  function resolveFile(relative) {
    const root = ensureRoot()
    return assertInside(root, relative, 'data file')
  }

  function readText(relative) {
    const target = resolveFile(relative)
    try {
      return fs.readFileSync(target, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null
      throw error
    }
  }

  function readJson(relative, fallback) {
    const text = readText(relative)
    if (text === null) return fallback
    try {
      return JSON.parse(text)
    } catch (error) {
      logger.warn?.(`[learning-hub] ${relative} 不是合法 JSON，已按空数据继续：${error.message}`)
      return fallback
    }
  }

  function readJsonl(relative) {
    const text = readText(relative)
    if (text === null) return []
    const rows = []
    for (const line of text.split(/\r?\n/)) {
      if (line.trim() === '') continue
      try {
        rows.push(JSON.parse(line))
      } catch {
        // 追加流里的一行坏数据不应让整份状态不可读。
      }
    }
    return rows
  }

  function backupExisting(target, relative) {
    let stat
    try {
      stat = fs.statSync(target)
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    if (!stat.isFile()) return
    const backupDir = path.join(ensureRoot(), BACKUP_DIR)
    fs.mkdirSync(backupDir, { recursive: true })
    const safeName = relative.replace(/[\\/]+/g, '__')
    const stamp = new Date(now().getTime()).toISOString().replace(/[:.]/g, '-')
    const destination = path.join(backupDir, `${safeName}.${stamp}-${randomBytes(3).toString('hex')}.bak`)
    fs.copyFileSync(target, destination)
    try {
      const prefix = `${safeName}.`
      const existing = fs.readdirSync(backupDir)
        .filter((name) => name.startsWith(prefix) && name.endsWith('.bak'))
        .sort()
        .reverse()
      for (const stale of existing.slice(backupKeep)) fs.rmSync(path.join(backupDir, stale), { force: true })
    } catch {
      // 清理旧备份失败不影响本次写入。
    }
  }

  function writeAtomic(relative, text, { backup = true } = {}) {
    const target = resolveFile(relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (backup) backupExisting(target, relative)
    const temporary = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
    try {
      fs.writeFileSync(temporary, text, { encoding: 'utf8', mode: 0o644 })
      fs.renameSync(temporary, target)
    } catch (error) {
      fs.rmSync(temporary, { force: true })
      throw error
    }
  }

  function writeJson(relative, value) {
    writeAtomic(relative, `${JSON.stringify(value, null, 2)}\n`)
  }

  function appendJsonl(relative, value) {
    const target = resolveFile(relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    try {
      const stat = fs.statSync(target)
      if (stat.size > 0 && stat.size <= MAX_JSONL_BACKUP_BYTES) backupExisting(target, relative)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    let needsNewline = false
    try {
      const handle = fs.openSync(target, 'r')
      try {
        const size = fs.fstatSync(handle).size
        if (size > 0) {
          const last = Buffer.alloc(1)
          fs.readSync(handle, last, 0, 1, size - 1)
          needsNewline = last[0] !== 0x0a
        }
      } finally {
        fs.closeSync(handle)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    const payload = `${needsNewline ? '\n' : ''}${JSON.stringify(value)}\n`
    const descriptor = fs.openSync(target, 'a')
    try {
      fs.writeFileSync(descriptor, payload, { encoding: 'utf8' })
      fs.fsyncSync(descriptor)
    } finally {
      fs.closeSync(descriptor)
    }
  }

  // ── 读取 ──

  function readProfile() {
    const text = readText(FILE_NAMES.profile)
    if (text === null) return { data: {}, body: '', hasFrontmatter: false }
    return parseFrontmatter(text)
  }

  function readBranches() {
    const raw = readJson(FILE_NAMES.branches, { version: 1, branches: [] })
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.branches) ? raw.branches : []
    return dedupeById(list.map(normalizeBranch).filter(Boolean))
  }

  function readConceptsDocument() {
    const raw = readJson(FILE_NAMES.concepts, null)
    if (Array.isArray(raw)) return { document: raw, list: raw }
    if (raw !== null && typeof raw === 'object' && Array.isArray(raw.concepts)) {
      return { document: raw, list: raw.concepts }
    }
    return { document: { version: 1, concepts: [] }, list: [] }
  }

  function readConcepts() {
    const { list } = readConceptsDocument()
    return dedupeById(list.map(normalizeConcept).filter(Boolean))
  }

  function readErrors() {
    const raw = readJson(FILE_NAMES.errors, { version: 1, errors: [] })
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.errors) ? raw.errors : []
    return list.map(normalizeError).filter(Boolean)
  }

  function readProgress() {
    return readJsonl(FILE_NAMES.progress).map(normalizeProgress).filter(Boolean)
  }

  function readSessions() {
    return readJsonl(FILE_NAMES.sessions)
  }

  function readReviews() {
    const raw = readJson(FILE_NAMES.reviews, { version: 1, reviews: [] })
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.reviews) ? raw.reviews : []
    return list.filter((item) => item && typeof item === 'object').map((item) => ({
      concept: asString(item.concept),
      branch: asString(item.branch),
      due: normalizeDateString(item.due),
      mastery: asMastery(item.mastery),
      interval_days: Number.isFinite(Number(item.interval_days)) ? Number(item.interval_days) : null,
      last_reviewed: normalizeDateString(item.last_reviewed),
      status: asString(item.status) || 'scheduled',
    })).filter((item) => item.concept !== '' && item.due !== null)
  }

  /** concepts.next_review 与 reviews.json 的并集，取较早日期（reviews 视为排期真源之一）。 */
  function effectiveDueMap(concepts, reviews) {
    const map = new Map()
    for (const concept of concepts) {
      if (concept.next_review !== null) map.set(concept.id, concept.next_review)
    }
    for (const review of reviews) {
      if (['done', 'completed', 'cancelled'].includes(review.status)) continue
      const current = map.get(review.concept)
      if (current === undefined || review.due < current) map.set(review.concept, review.due)
    }
    return map
  }

  function readMaterials() {
    const text = readText(FILE_NAMES.materials)
    return text === null ? [] : text.split(/\r?\n/)
  }

  // ── 状态 ──

  function buildStateSync(at = now()) {
    const profile = readProfile()
    const branches = readBranches()
    const concepts = readConcepts()
    const progress = readProgress()
    const reviews = readReviews()
    const dueMap = effectiveDueMap(concepts, reviews)
    const today = formatLocalDate(at)

    const branchModels = branches.map((branch) => {
      const own = concepts.filter((concept) => concept.branches.includes(branch.id))
      const mastery = own.length === 0
        ? 0
        : Math.round((own.reduce((sum, concept) => sum + concept.mastery, 0) / own.length) * 10) / 10
      const dueCount = own.filter((concept) => {
        const due = dueMap.get(concept.id)
        return due !== undefined && due <= today
      }).length
      const weakCount = own.filter((concept) => concept.mastery <= 2).length
      return {
        ...branch,
        // canonical（camelCase）+ SPEC 风格别名（snake_case），避免面板两套写法互相 undefined。
        masteryAvg: mastery,
        conceptCount: own.length,
        dueCount,
        weakCount,
        mastery,
        mastery_avg: mastery,
        concept_count: own.length,
        due_count: dueCount,
        weak_count: weakCount,
      }
    })
    const branchById = new Map(branchModels.map((branch) => [branch.id, branch]))

    const dueReviews = concepts
      .filter((concept) => {
        const due = dueMap.get(concept.id)
        return due !== undefined && due <= today
      })
      .sort((left, right) => String(dueMap.get(left.id)).localeCompare(String(dueMap.get(right.id)))
        || String(left.id).localeCompare(String(right.id)))
      .map((concept) => ({ concept: concept.id, due: dueMap.get(concept.id) }))

    const weakConcepts = concepts
      .filter((concept) => concept.mastery <= 2)
      .sort((left, right) => left.mastery - right.mastery || String(left.id).localeCompare(String(right.id)))
      .map((concept) => ({
        concept: concept.id,
        mastery: concept.mastery,
        reasons: weakReasons(concept, dueMap.get(concept.id), today),
      }))

    const withIndex = progress.map((entry, index) => ({ entry, index }))
    withIndex.sort((left, right) => {
      const leftTime = Date.parse(left.entry.ts)
      const rightTime = Date.parse(right.entry.ts)
      const leftValue = Number.isFinite(leftTime) ? leftTime : 0
      const rightValue = Number.isFinite(rightTime) ? rightTime : 0
      return rightValue - leftValue || right.index - left.index
    })
    const recentActivity = withIndex.slice(0, 20).map(({ entry }) => entry)

    let currentBranch = recentActivity.find((entry) => branchById.has(entry.branch))?.branch ?? null
    if (currentBranch === null) {
      currentBranch = branchModels.find((branch) => branch.status === 'active')?.id
        ?? branchModels[0]?.id
        ?? null
    }

    return {
      schema: STATE_SCHEMA,
      seed: branchModels.length === 0 && concepts.length === 0 && progress.length === 0,
      as_of: today,
      asOf: today,
      generated_at: at.toISOString(),
      generatedAt: at.toISOString(),
      profile: profile.data,
      current_branch: currentBranch,
      currentBranch,
      branches: branchModels,
      concepts: concepts.map((concept) => ({
        ...concept,
        next_review: concept.next_review,
      })),
      weak_concepts: weakConcepts,
      weakConcepts,
      due_reviews: dueReviews,
      dueReviews,
      recent_activity: recentActivity,
      recentActivity,
    }
  }

  function weakReasons(concept, due, today = formatLocalDate(now())) {
    const reasons = []
    if (concept.mastery <= 1) reasons.push('掌握度 ≤1：只见过或还没跟做过')
    else reasons.push('掌握度 2：能跟做，还不能独立完成')
    if (concept.misconceptions.length > 0) reasons.push(`已知误区：${concept.misconceptions.slice(0, 2).join('；')}`)
    if (due !== undefined && due <= today) reasons.push(`复习已到期：${due}`)
    return reasons
  }

  // ── 写操作 ──

  function recordSync(input = {}) {
    const branchId = requiredString(input.branch, 'branch', 120)
    const unit = requiredString(input.unit, 'unit', 200)
    const event = asString(input.event ?? input.action ?? 'study').toLowerCase() || 'study'
    if (!PROGRESS_EVENTS.includes(event)) {
      throw new ValidationError(`event must be one of ${PROGRESS_EVENTS.join('/')}`, 'INVALID_EVENT')
    }
    const evidence = optionalString(input.evidence, 'evidence', 500)
    const note = optionalString(input.note, 'note', 1000)
    const session = optionalString(input.session, 'session', 200)
    const conceptHint = optionalString(input.concept, 'concept', 200)
    let mastery
    if (input.mastery !== undefined && input.mastery !== null && input.mastery !== '') {
      const number = Number(input.mastery)
      if (!Number.isInteger(number) || number < 0 || number > 5) {
        throw new ValidationError('mastery must be an integer between 0 and 5', 'INVALID_MASTERY')
      }
      mastery = number
    }

    const branches = readBranches()
    if (!branches.some((branch) => branch.id === branchId)) {
      throw new ValidationError(`unknown branch: ${branchId}`, 'UNKNOWN_BRANCH')
    }

    const concepts = readConcepts()
    let concept = null
    if (conceptHint !== '') {
      concept = concepts.find((item) => item.id === conceptHint) ?? null
      if (concept === null) throw new ValidationError(`unknown concept: ${conceptHint}`, 'UNKNOWN_CONCEPT')
    } else {
      concept = matchConceptByUnit(concepts, unit)
    }

    const at = now()
    const entry = {
      ts: isoWithOffset(at),
      branch: branchId,
      unit,
      action: event,
    }
    if (mastery !== undefined) entry.mastery = mastery
    if (evidence) entry.evidence = evidence
    if (note) entry.note = note
    if (session) entry.session = session
    if (concept !== null) entry.concept = concept.id
    appendJsonl(FILE_NAMES.progress, entry)

    const updated = {}
    if (concept !== null && (mastery !== undefined || event === 'review' || event === 'misconception' || note !== '')) {
      // 只改已知字段，保留 data 里课程进度、mastery_basis 等未知字段与顶层 _seed/notice。
      const { document, list } = readConceptsDocument()
      let target = list.find((item) => item !== null && typeof item === 'object' && item.id === concept.id)
      if (target === undefined) {
        target = { id: concept.id, name: concept.name }
        list.push(target)
      }
      if (mastery !== undefined) target.mastery = mastery
      if (evidence) {
        if (!Array.isArray(target.evidence)) target.evidence = []
        if (!target.evidence.includes(evidence)) target.evidence.push(evidence)
      }
      if (note && event === 'misconception') {
        if (!Array.isArray(target.misconceptions)) target.misconceptions = []
        if (!target.misconceptions.includes(note)) target.misconceptions.push(note)
      }
      const effectiveMastery = asMastery(target.mastery, concept.mastery)
      target.mastery = effectiveMastery
      target.next_review = formatLocalDate(addDays(at, nextReviewDays(effectiveMastery, event)))
      writeJson(FILE_NAMES.concepts, document)
      updated.conceptId = target.id
      updated.mastery = effectiveMastery
    }

    return { ok: true, updated, state: buildStateSync(at) }
  }

  function linkSync(input = {}) {
    const from = requiredString(input.from, 'from', 200)
    const to = requiredString(input.to, 'to', 200)
    const relationRaw = requiredString(input.relation, 'relation', 20).toLowerCase()
    const relation = relationRaw === 'prerequisite' ? 'prereq' : relationRaw
    if (!LINK_RELATIONS.includes(relation)) {
      throw new ValidationError(`relation must be one of ${LINK_RELATIONS.join('/')}`, 'INVALID_RELATION')
    }
    if (from === to) throw new ValidationError('from and to must be different concepts', 'SELF_LINK')

    const concepts = readConcepts()
    const fromConcept = concepts.find((concept) => concept.id === from)
    const toConcept = concepts.find((concept) => concept.id === to)
    if (fromConcept === undefined) throw new ValidationError(`unknown concept: ${from}`, 'UNKNOWN_CONCEPT')
    if (toConcept === undefined) throw new ValidationError(`unknown concept: ${to}`, 'UNKNOWN_CONCEPT')

    // 同 record：只改 prereq/related，保留 concepts.json 里的其余字段与顶层元数据。
    const { document, list } = readConceptsDocument()
    const fromRaw = list.find((item) => item !== null && typeof item === 'object' && item.id === from)
    const toRaw = list.find((item) => item !== null && typeof item === 'object' && item.id === to)
    if (fromRaw === undefined || toRaw === undefined) {
      throw new ValidationError('concepts.json 内部不一致：概念 id 存在但无法定位原始记录', 'INCONSISTENT_DATA')
    }

    let changed = false
    if (relation === 'prereq') {
      if (!Array.isArray(toRaw.prereq)) toRaw.prereq = []
      if (!toRaw.prereq.includes(from)) {
        toRaw.prereq.push(from)
        changed = true
      }
    } else {
      if (!Array.isArray(fromRaw.related)) fromRaw.related = []
      if (!Array.isArray(toRaw.related)) toRaw.related = []
      if (!fromRaw.related.includes(to)) {
        fromRaw.related.push(to)
        changed = true
      }
      if (!toRaw.related.includes(from)) {
        toRaw.related.push(from)
        changed = true
      }
    }
    if (changed) writeJson(FILE_NAMES.concepts, document)
    return { ok: true, from, to, relation, changed }
  }

  function searchSync(input = {}) {
    const query = requiredString(input.query, 'query', 100)
    const branch = optionalString(input.branch, 'branch', 120)
    const needle = query.toLowerCase()
    const matches = []

    for (const concept of readConcepts()) {
      if (branch && !concept.branches.includes(branch)) continue
      let score = 0
      if (concept.name.toLowerCase() === needle) score = 100
      else if (concept.name.toLowerCase().includes(needle)) score = 70
      else if (concept.aliases.some((alias) => alias.toLowerCase().includes(needle))) score = 60
      else if (concept.id.toLowerCase().includes(needle)) score = 40
      if (score === 0) continue
      matches.push({
        type: 'concept',
        id: concept.id,
        name: concept.name,
        branch: concept.branches[0] ?? '',
        mastery: concept.mastery,
        snippet: concept.misconceptions[0] ?? concept.evidence[0] ?? '',
        score,
      })
    }

    for (const error of readErrors()) {
      if (branch && error.branch !== branch) continue
      const haystack = `${error.symptom}\n${error.root_cause}\n${error.fix}\n${error.concept}`.toLowerCase()
      if (!haystack.includes(needle)) continue
      matches.push({
        type: 'error',
        id: error.id,
        name: error.symptom,
        branch: error.branch,
        concept: error.concept,
        snippet: error.fix || error.root_cause,
        score: 50,
      })
    }

    const materials = readMaterials()
    for (let index = 0; index < materials.length; index += 1) {
      const line = materials[index]
      if (!line.toLowerCase().includes(needle)) continue
      matches.push({
        type: 'material',
        name: line.trim(),
        branch: branch || '',
        line: index + 1,
        snippet: line.trim(),
        score: 40,
      })
    }

    matches.sort((left, right) => right.score - left.score || String(left.name).localeCompare(String(right.name)))
    return { query, branch: branch || null, matches: matches.slice(0, 40) }
  }

  function reviewSync(input = {}) {
    const withinRaw = input.withinDays
    let withinDays = 7
    if (withinRaw !== undefined && withinRaw !== null && withinRaw !== '') {
      const number = Number(withinRaw)
      if (!Number.isInteger(number) || number < 0 || number > 365) {
        throw new ValidationError('withinDays must be an integer between 0 and 365', 'INVALID_WINDOW')
      }
      withinDays = number
    }
    const today = formatLocalDate(now())
    const limit = formatLocalDate(addDays(now(), withinDays))
    const concepts = readConcepts()
    const dueMap = effectiveDueMap(concepts, readReviews())
    const due = concepts
      .filter((concept) => {
        const dueDate = dueMap.get(concept.id)
        return dueDate !== undefined && dueDate <= limit
      })
      .sort((left, right) => String(dueMap.get(left.id)).localeCompare(String(dueMap.get(right.id)))
        || String(left.id).localeCompare(String(right.id)))
      .map((concept) => ({
        concept: concept.id,
        name: concept.name,
        branch: concept.branches[0] ?? '',
        due: dueMap.get(concept.id),
        mastery: concept.mastery,
        overdue_days: dateStringDiff(dueMap.get(concept.id), today),
      }))
    return { withinDays, due, count: due.length }
  }

  function routeSync(input = {}) {
    return scoreBranches({
      text: typeof input.text === 'string' ? input.text : '',
      cwd: typeof input.cwd === 'string' ? input.cwd : '',
      branches: readBranches(),
      concepts: readConcepts(),
    })
  }

  function appendSessionSync(input = {}) {
    const entry = {
      ts: isoWithOffset(now()),
      cwd: optionalString(input.cwd, 'cwd', 1000),
      primary: input.primary ?? null,
      secondary: Array.isArray(input.secondary) ? input.secondary : [],
      confidence: Number(input.confidence) || 0,
      reason: optionalString(input.reason, 'reason', 2000),
    }
    appendJsonl(FILE_NAMES.sessions, entry)
    return entry
  }

  return {
    get root() {
      return ensureRoot()
    },
    buildState: () => serialize(() => buildStateSync(now())),
    record: (input) => serialize(() => recordSync(input)),
    link: (input) => serialize(() => linkSync(input)),
    search: (input) => serialize(() => searchSync(input)),
    review: (input) => serialize(() => reviewSync(input)),
    route: (input) => serialize(() => routeSync(input)),
    appendSession: (input) => serialize(() => appendSessionSync(input)),
    // 供只读调用与测试使用
    readProfile: () => readProfile(),
    readBranches,
    readConcepts,
    readErrors,
    readProgress,
    readSessions,
    readReviews,
    readMaterials,
    assertInside: (candidate, label) => assertInside(ensureRoot(), candidate, label),
  }
}
