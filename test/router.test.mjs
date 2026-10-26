import assert from 'node:assert/strict'
import test from 'node:test'

import { LOW_CONFIDENCE_THRESHOLD, normalizePath, scoreBranches } from '../lib/router.js'

const BRANCHES = [
  {
    id: 'math.calculus',
    name: 'Calculus',
    workspace: '/path/to/learner/courses/calculus',
    paths: ['courses/calculus'],
    keywords: ['limit', 'derivative', 'integral', '极限', '导数', '积分'],
    status: 'active',
    next: 'Chapter 1: functions and limits',
  },
  {
    id: 'math.linear-algebra',
    name: 'Linear Algebra',
    workspace: '/path/to/learner/courses/linear-algebra',
    paths: ['courses/linear-algebra'],
    keywords: ['matrix', 'determinant', 'eigenvalue', '矩阵', '行列式', '特征值'],
    status: 'active',
    next: 'Chapter 1: determinants',
  },
  {
    id: 'cs.c',
    name: 'C Programming',
    workspace: '/path/to/learner/courses/c',
    paths: ['courses/c'],
    keywords: ['pointer', 'array', 'struct', '指针', '数组', '结构体'],
    status: 'active',
    next: 'Pointers and arrays',
  },
]

const CONCEPTS = [
  { id: 'math.calculus.limit', name: '极限', aliases: ['limit'], branches: ['math.calculus'], mastery: 2 },
  { id: 'math.calculus.derivative', name: '导数', aliases: ['derivative'], branches: ['math.calculus'], mastery: 1 },
  { id: 'math.linear-algebra.matrix', name: '矩阵', aliases: ['matrix'], branches: ['math.linear-algebra'], mastery: 3 },
  { id: 'cs.c.pointer', name: '指针', aliases: ['pointer'], branches: ['cs.c'], mastery: 2 },
  { id: 'cs.c.array', name: '数组', aliases: ['array'], branches: ['cs.c'], mastery: 1 },
]

test('route：cwd 命中工作区，高置信', () => {
  const result = scoreBranches({ cwd: '/path/to/learner/courses/calculus/chapter-1', branches: BRANCHES, concepts: CONCEPTS })
  assert.equal(result.primary, 'math.calculus')
  assert.ok(result.confidence >= LOW_CONFIDENCE_THRESHOLD)
  assert.match(result.reason, /cwd/)
  assert.deepEqual(result.secondary, [])
  assert.ok(result.concepts.some((concept) => concept.id === 'math.calculus.derivative'))
})

test('route：关键词命中 C 分支', () => {
  const result = scoreBranches({ text: '指针和数组总是搞混，结构体也不会写', branches: BRANCHES, concepts: CONCEPTS })
  assert.equal(result.primary, 'cs.c')
  assert.ok(result.confidence >= LOW_CONFIDENCE_THRESHOLD)
  assert.match(result.reason, /关键词/)
  assert.deepEqual(result.concepts.map((concept) => concept.id).sort(), ['cs.c.array', 'cs.c.pointer'])
})

test('route：多分支同时命中 → 次分支 + 低置信', () => {
  const result = scoreBranches({ text: '极限和矩阵怎么放在一起理解？', branches: BRANCHES, concepts: CONCEPTS })
  assert.ok(['math.calculus', 'math.linear-algebra'].includes(result.primary))
  assert.equal(result.secondary.length, 1)
  assert.ok(result.confidence < LOW_CONFIDENCE_THRESHOLD)
  assert.match(result.reason, /置信度/)
})

test('route：没有信号 → primary null、confidence 0', () => {
  const empty = scoreBranches({ branches: BRANCHES, concepts: CONCEPTS })
  assert.equal(empty.primary, null)
  assert.equal(empty.confidence, 0)
  assert.deepEqual(empty.secondary, [])
  assert.match(empty.reason, /没有可用的匹配信号/)

  const unrelated = scoreBranches({ text: '今天天气不错', branches: BRANCHES, concepts: CONCEPTS })
  assert.equal(unrelated.primary, null)
  assert.equal(unrelated.confidence, 0)
})

test('route：没有分支数据时不抛错', () => {
  const result = scoreBranches({ text: '极限', branches: [], concepts: [] })
  assert.deepEqual(result, {
    primary: null,
    secondary: [],
    confidence: 0,
    reason: '没有命中任何分支（cwd 与文本都不匹配）；请先确认属于哪门课。',
    concepts: [],
  })
})

test('normalizePath：Windows 反斜杠、重复斜杠与大小写归一', () => {
  assert.equal(normalizePath('C:\\demo\\learner\\\\calculus\\'), 'c:/demo/learner/calculus')
})
