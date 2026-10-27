import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { createStore, STATE_SCHEMA } from '../lib/store.js'
import { createFixture, FIXED_NOW, quietLogger } from './helpers.mjs'

function openFixture() {
  const fixture = createFixture()
  const store = createStore({ dataRoot: fixture.root, now: () => new Date(FIXED_NOW), logger: quietLogger() })
  return { fixture, store }
}

function readJsonFile(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
}

function readJsonlFile(root, name) {
  return fs.readFileSync(path.join(root, name), 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

const REVIEW_FIXTURE_ROWS = [
  { concept: 'cs.c.pointer', branch: 'cs.c', due: '2026-10-24', mastery: 2, interval_days: 3, status: 'scheduled', last_reviewed: '2026-10-20', seed: true },
  { concept: 'math.calculus.limit', branch: 'math.calculus', due: '2026-10-25', mastery: 2, interval_days: 3, status: 'scheduled', last_reviewed: '2026-10-22', seed: true },
  { concept: 'math.calculus.derivative', branch: 'math.calculus', due: '2026-10-30', mastery: 1, interval_days: 1, status: 'scheduled', last_reviewed: null, seed: true },
]

/** reviews.json 夹具：保留 _seed/policy/generated_from 等顶层未知字段。 */
function writeReviewsFixture(root, reviews = REVIEW_FIXTURE_ROWS) {
  const document = {
    version: 1,
    _seed: true,
    generated_from: 'concepts.next_review',
    generated_at: '2026-10-26T09:00:00+08:00',
    policy: { intervals_days: [1, 3, 7, 14] },
    reviews: reviews.map((row) => ({ ...row })),
  }
  fs.writeFileSync(path.join(root, 'reviews.json'), JSON.stringify(document, null, 2))
}

test('buildState：读取 profile/branches/concepts，输出完整 state 形状', async (t) => {
  const { fixture, store } = openFixture()
  t.after(() => fixture.cleanup())

  const state = await store.buildState()
  assert.equal(state.schema, STATE_SCHEMA)
  assert.equal(state.seed, false)
  assert.equal(state.as_of, '2026-10-26')
  assert.equal(typeof state.generated_at, 'string')
  assert.equal(state.profile.name, 'Demo Learner')
  assert.equal(state.profile.stage, 'Year 1')
  assert.deepEqual(state.profile.goals, ['Build foundations in calculus, linear algebra, and C'])
  assert.equal(state.current_branch, 'math.calculus')
  assert.equal(state.branches.length, 3)
  assert.equal(state.concepts.length, 5)
  assert.equal(state.weak_concepts.length, 4)
  assert.equal(state.due_reviews.length, 2)
  assert.equal(state.recent_activity.length, 2)
  assert.equal(state.recent_activity[0].branch, 'math.calculus')

  const calculus = state.branches.find((branch) => branch.id === 'math.calculus')
  assert.equal(calculus.masteryAvg, 1.5)
  assert.equal(calculus.mastery_avg, 1.5)
  assert.equal(calculus.conceptCount, 2)
  assert.equal(calculus.concept_count, 2)
  assert.equal(calculus.dueCount, 1)
  assert.equal(calculus.due_count, 1)

  const dueIds = state.due_reviews.map((row) => row.concept)
  assert.deepEqual(dueIds.sort(), ['cs.c.pointer', 'math.calculus.limit'])
  assert.deepEqual(state.weakConcepts, state.weak_concepts)
  assert.deepEqual(state.recentActivity, state.recent_activity)
})

test('buildState：空数据根返回 seed=true 且不抛错', async (t) => {
  const fixture = createFixture()
  t.after(() => fixture.cleanup())
  const emptyRoot = path.join(fixture.root, 'empty')
  fs.mkdirSync(emptyRoot)

  const store = createStore({ dataRoot: emptyRoot, now: () => new Date(FIXED_NOW), logger: quietLogger() })
  const state = await store.buildState()
  assert.equal(state.seed, true)
  assert.deepEqual(state.branches, [])
  assert.deepEqual(state.concepts, [])
  assert.equal(state.current_branch, null)
  assert.deepEqual(state.due_reviews, [])
  assert.deepEqual(state.weak_concepts, [])
  assert.deepEqual(state.recent_activity, [])
})

test('record：追加 progress、更新 concept 掌握度/复习日期、写前备份', async (t) => {
  const { fixture, store } = openFixture()
  t.after(() => fixture.cleanup())

  const progressPath = path.join(fixture.root, 'progress.jsonl')
  const before = fs.readFileSync(progressPath, 'utf8')

  const result = await store.record({
    branch: 'cs.c',
    unit: '指针与数组',
    event: 'practice',
    mastery: 4,
    evidence: 'c-program/homework-4',
  })

  assert.equal(result.ok, true)
  assert.equal(result.updated.conceptId, 'cs.c.pointer')
  assert.equal(result.updated.mastery, 4)
  assert.equal(result.state.branches.find((branch) => branch.id === 'cs.c').masteryAvg, 2.5)

  const after = fs.readFileSync(progressPath, 'utf8')
  assert.ok(after.startsWith(before), 'progress.jsonl 必须是追加写，旧内容不变')
  const lines = after.trim().split(/\r?\n/)
  assert.equal(lines.length, 3)
  const entry = JSON.parse(lines.at(-1))
  assert.equal(entry.branch, 'cs.c')
  assert.equal(entry.unit, '指针与数组')
  assert.equal(entry.action, 'practice')
  assert.equal(entry.mastery, 4)
  assert.equal(entry.evidence, 'c-program/homework-4')
  assert.match(entry.ts, /^2026-10-26T10:00:00[+-]\d{2}:\d{2}$/)

  const concepts = JSON.parse(fs.readFileSync(path.join(fixture.root, 'concepts.json'), 'utf8'))
  const pointer = concepts.concepts.find((concept) => concept.id === 'cs.c.pointer')
  assert.equal(pointer.mastery, 4)
  assert.equal(pointer.next_review, '2026-11-09')
  assert.equal(concepts.notice, 'Seed fixture: unknown fields must be preserved', '顶层未知字段必须保留')
  assert.equal(pointer.course_progress, 'in progress', '概念未知字段必须保留')

  const backups = fs.readdirSync(path.join(fixture.root, '.backups'))
  assert.ok(backups.some((name) => name.startsWith('concepts.json.')), '覆盖写前必须备份 concepts.json')
  assert.equal(fs.readdirSync(fixture.root).some((name) => name.endsWith('.tmp')), false)
})

test('record：未知分支/非法掌握度被拒绝且不写 progress', async (t) => {
  const { fixture, store } = openFixture()
  t.after(() => fixture.cleanup())

  const progressPath = path.join(fixture.root, 'progress.jsonl')
  const before = fs.readFileSync(progressPath, 'utf8')

  await assert.rejects(
    store.record({ branch: 'cs.rust', unit: '所有权', event: 'study' }),
    /unknown branch/,
  )
  await assert.rejects(
    store.record({ branch: 'cs.c', unit: '指针', event: 'study', mastery: 9 }),
    /mastery/,
  )
  await assert.rejects(
    store.record({ branch: 'cs.c', unit: '指针', event: 'daydream' }),
    /event/,
  )
  assert.equal(fs.readFileSync(progressPath, 'utf8'), before)
})

test('record：没有命中概念时仍追加 progress，但不改 concepts.json', async (t) => {
  const { fixture, store } = openFixture()
  t.after(() => fixture.cleanup())

  const conceptsBefore = fs.readFileSync(path.join(fixture.root, 'concepts.json'), 'utf8')
  const result = await store.record({
    branch: 'math.linear-algebra',
    unit: '第一章 行列式',
    event: 'study',
    mastery: 2,
    evidence: '线代/第一章 行列式 习题1',
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.updated, {})
  assert.equal(fs.readFileSync(path.join(fixture.root, 'concepts.json'), 'utf8'), conceptsBefore)
})

test('record：缺 evidence 或 seed 占位证据被拒绝，且不写 progress/sessions/concepts', async (t) => {
  const { fixture, store } = openFixture()
  t.after(() => fixture.cleanup())

  const progressPath = path.join(fixture.root, 'progress.jsonl')
  const sessionsPath = path.join(fixture.root, 'sessions.jsonl')
  const conceptsPath = path.join(fixture.root, 'concepts.json')
  const progressBefore = fs.readFileSync(progressPath, 'utf8')
  const sessionsBefore = fs.readFileSync(sessionsPath, 'utf8')
  const conceptsBefore = fs.readFileSync(conceptsPath, 'utf8')

  await assert.rejects(
    store.record({ branch: 'cs.c', unit: '指针与数组', event: 'practice', mastery: 4 }),
    (error) => error.name === 'ValidationError' && error.code === 'EVIDENCE_REQUIRED',
    '缺 evidence 必须报 EVIDENCE_REQUIRED',
  )
  await assert.rejects(
    store.record({ branch: 'cs.c', unit: '指针与数组', event: 'practice', mastery: 4, evidence: '   ' }),
    (error) => error.code === 'EVIDENCE_REQUIRED',
    '纯空白 evidence 等同缺失',
  )
  for (const evidence of ['seed: 待补充', 'seed：作业4', '示例: 作业4', '示例：作业4', 'c-program/homework-4 待补充']) {
    await assert.rejects(
      store.record({ branch: 'cs.c', unit: '指针与数组', event: 'practice', mastery: 4, evidence }),
      (error) => error.name === 'ValidationError' && error.code === 'SEED_EVIDENCE',
      `seed 占位证据应被拒绝：${evidence}`,
    )
  }
  assert.equal(fs.readFileSync(progressPath, 'utf8'), progressBefore, '被拒绝的 record 不得写 progress')
  assert.equal(fs.readFileSync(sessionsPath, 'utf8'), sessionsBefore, '被拒绝的 record 不得写 sessions')
  assert.equal(fs.readFileSync(conceptsPath, 'utf8'), conceptsBefore, '被拒绝的 record 不得改 concepts')

  // 只认“前缀 seed:/示例:”与“包含 待补充”，不得用“包含 seed”误伤真实路径。
  const result = await store.record({
    branch: 'cs.c',
    unit: '指针与数组',
    event: 'practice',
    mastery: 3,
    evidence: 'seed-project/homework.c',
  })
  assert.equal(result.ok, true)
  assert.equal(readJsonlFile(fixture.root, 'progress.jsonl').at(-1).evidence, 'seed-project/homework.c')
})

test('record：只给 evidence 也能切 real，并更新已有 reviews 行', async (t) => {
  const { fixture, store } = openFixture()
  t.after(() => fixture.cleanup())
  writeReviewsFixture(fixture.root)

  const result = await store.record({ branch: 'cs.c', unit: '指针与数组', event: 'study', evidence: 'c-program/homework-4 Q3' })
  assert.equal(result.ok, true)
  assert.equal(result.updated.conceptId, 'cs.c.pointer')
  assert.equal(result.updated.mastery, 2, '没给 mastery 时沿用概念原掌握度')
  assert.match(result.updated.session, /^sess-20261026-100000-[0-9a-f]{6}$/)

  const conceptsDoc = readJsonFile(fixture.root, 'concepts.json')
  const pointer = conceptsDoc.concepts.find((item) => item.id === 'cs.c.pointer')
  assert.equal(pointer.seed, false)
  assert.equal(pointer.mastery_basis, 'recorded_evidence')
  assert.deepEqual(pointer.evidence, ['c-program/homework-3', 'c-program/homework-4 Q3'])
  assert.equal(pointer.course_progress, 'in progress', '课程进度等未知字段必须保留')
  assert.equal(pointer.next_review, '2026-10-29')
  assert.equal(conceptsDoc.notice, 'Seed fixture: unknown fields must be preserved', 'concepts.json 顶层未知字段必须保留')

  const reviewsDoc = readJsonFile(fixture.root, 'reviews.json')
  assert.equal(reviewsDoc._seed, true, 'reviews 顶层 _seed 必须保留')
  assert.equal(reviewsDoc.generated_from, 'concepts.next_review', 'reviews 顶层 generated_from 必须保留')
  assert.deepEqual(reviewsDoc.policy, { intervals_days: [1, 3, 7, 14] }, 'reviews 顶层 policy 必须保留')
  assert.match(reviewsDoc.generated_at, /^2026-10-26T10:00:00[+-]\d{2}:\d{2}$/)
  assert.equal(reviewsDoc.reviews.length, 3, '已存在的概念只更新，不新增')

  const pointerReview = reviewsDoc.reviews.find((row) => row.concept === 'cs.c.pointer')
  assert.deepEqual(
    {
      due: pointerReview.due,
      mastery: pointerReview.mastery,
      interval_days: pointerReview.interval_days,
      status: pointerReview.status,
      last_reviewed: pointerReview.last_reviewed,
      seed: pointerReview.seed,
      branch: pointerReview.branch,
    },
    {
      due: '2026-10-29',
      mastery: 2,
      interval_days: 3,
      status: 'scheduled',
      last_reviewed: '2026-10-26',
      seed: false,
      branch: 'cs.c',
    },
  )
  assert.deepEqual(reviewsDoc.reviews.map((row) => row.due), ['2026-10-25', '2026-10-29', '2026-10-30'], 'due 必须升序')
})

test('record：seed 概念切 real 时清掉占位证据，reviews 缺条目则新增', async (t) => {
  const { fixture, store } = openFixture()
  t.after(() => fixture.cleanup())

  const conceptsPath = path.join(fixture.root, 'concepts.json')
  const conceptsDoc = readJsonFile(fixture.root, 'concepts.json')
  const array = conceptsDoc.concepts.find((item) => item.id === 'cs.c.array')
  array.seed = true
  array.mastery_basis = 'seed_placeholder'
  array.evidence = ['seed: 待补充', '示例：作业2', '待补充']
  fs.writeFileSync(conceptsPath, JSON.stringify(conceptsDoc, null, 2))
  writeReviewsFixture(fixture.root)

  const result = await store.record({ branch: 'cs.c', unit: '数组', event: 'practice', mastery: 1, evidence: 'c-program/homework-4 Q1' })
  assert.equal(result.updated.conceptId, 'cs.c.array')

  const after = readJsonFile(fixture.root, 'concepts.json')
  const target = after.concepts.find((item) => item.id === 'cs.c.array')
  assert.deepEqual(target.evidence, ['c-program/homework-4 Q1'], '旧 seed 占位证据必须被清掉')
  assert.equal(target.seed, false)
  assert.equal(target.mastery_basis, 'recorded_evidence')
  assert.equal(target.mastery, 1)

  const reviewsDoc = readJsonFile(fixture.root, 'reviews.json')
  assert.equal(reviewsDoc.reviews.length, 4, '没有排期的概念应新增一条')
  const created = reviewsDoc.reviews.find((row) => row.concept === 'cs.c.array')
  assert.deepEqual(
    {
      due: created.due,
      mastery: created.mastery,
      interval_days: created.interval_days,
      status: created.status,
      last_reviewed: created.last_reviewed,
      seed: created.seed,
      branch: created.branch,
    },
    {
      due: '2026-10-27',
      mastery: 1,
      interval_days: 1,
      status: 'scheduled',
      last_reviewed: '2026-10-26',
      seed: false,
      branch: 'cs.c',
    },
  )
  const dues = reviewsDoc.reviews.map((row) => row.due)
  assert.deepEqual(dues, ['2026-10-24', '2026-10-25', '2026-10-27', '2026-10-30'])
  assert.deepEqual(dues, [...dues].sort(), 'due 必须升序')
})

test('record：自动补 sessions 行且与 progress.session 一致；同 session 不重复追加', async (t) => {
  const { fixture, store } = openFixture()
  t.after(() => fixture.cleanup())

  const first = await store.record({ branch: 'cs.c', unit: '指针与数组', event: 'practice', mastery: 3, evidence: 'c-program/homework-4 Q4' })
  assert.match(first.updated.session, /^sess-20261026-100000-[0-9a-f]{6}$/)

  const sessions = readJsonlFile(fixture.root, 'sessions.jsonl')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].session, first.updated.session)
  assert.equal(sessions[0].seed, false)
  assert.equal(sessions[0].cwd, '/path/to/learner/courses/c')
  assert.equal(sessions[0].primary, 'cs.c')
  assert.deepEqual(sessions[0].secondary, [])
  assert.equal(sessions[0].confidence, 1)
  assert.equal(sessions[0].reason, 'record: 指针与数组')
  assert.match(sessions[0].ts, /^2026-10-26T10:00:00[+-]\d{2}:\d{2}$/)

  const progress = readJsonlFile(fixture.root, 'progress.jsonl')
  assert.equal(progress.at(-1).session, first.updated.session, 'progress.session 必须能在 sessions 里找到')
  assert.equal(progress.at(-1).seed, false)

  const second = await store.record({
    branch: 'cs.c',
    unit: '指针与数组',
    event: 'practice',
    mastery: 4,
    evidence: 'c-program/homework-4 Q5',
    session: first.updated.session,
  })
  assert.equal(second.updated.session, first.updated.session)
  assert.equal(readJsonlFile(fixture.root, 'sessions.jsonl').length, 1, '同 session 不得重复追加 sessions 行')

  const reused = await store.appendSession({ session: first.updated.session, cwd: '/path/to/learner/courses/c' })
  assert.equal(reused.session, first.updated.session)
  assert.equal(reused.confidence, 1)
  assert.equal(readJsonlFile(fixture.root, 'sessions.jsonl').length, 1, 'appendSession 对已存在 session 幂等')

  const generated = await store.appendSession({
    at: new Date(2026, 9, 27, 22, 22, 45),
    cwd: '',
    primary: 'math.calculus',
    reason: 'route test',
  })
  assert.match(generated.session, /^sess-20261027-222245-[0-9a-f]{6}$/)
  assert.equal(generated.cwd, '(route)', 'cwd 为空时必须回退 (route)')
  assert.match(generated.ts, /^2026-10-27T22:22:45[+-]\d{2}:\d{2}$/)
  assert.equal(readJsonlFile(fixture.root, 'sessions.jsonl').length, 2)
})

test('link：prereq 与 related 更新概念图并备份', async (t) => {
  const { fixture, store } = openFixture()
  t.after(() => fixture.cleanup())

  const result = await store.link({ from: 'cs.c.array', to: 'cs.c.pointer', relation: 'related' })
  assert.equal(result.ok, true)
  assert.equal(result.changed, true)

  const concepts = JSON.parse(fs.readFileSync(path.join(fixture.root, 'concepts.json'), 'utf8'))
  const array = concepts.concepts.find((concept) => concept.id === 'cs.c.array')
  const pointer = concepts.concepts.find((concept) => concept.id === 'cs.c.pointer')
  assert.ok(array.related.includes('cs.c.pointer'))
  assert.ok(pointer.related.includes('cs.c.array'))
  assert.equal(concepts.notice, 'Seed fixture: unknown fields must be preserved', 'link 也必须保留顶层未知字段')
  assert.equal(pointer.course_progress, 'in progress', 'link 也必须保留概念未知字段')

  await assert.rejects(store.link({ from: 'cs.c.pointer', to: 'cs.c.pointer', relation: 'related' }), /different/)
  await assert.rejects(store.link({ from: 'cs.c.pointer', to: 'cs.c.malloc', relation: 'prereq' }), /unknown concept/)
  await assert.rejects(store.link({ from: 'cs.c.pointer', to: 'cs.c.array', relation: 'cousin' }), /relation/)
})
