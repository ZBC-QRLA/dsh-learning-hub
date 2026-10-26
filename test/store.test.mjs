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
  const result = await store.record({ branch: 'math.linear-algebra', unit: '第一章 行列式', event: 'study', mastery: 2 })
  assert.equal(result.ok, true)
  assert.deepEqual(result.updated, {})
  assert.equal(fs.readFileSync(path.join(fixture.root, 'concepts.json'), 'utf8'), conceptsBefore)
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
