/** Test fixture: build a temporary _learner data root plus a tiny panel. */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const FIXED_NOW = new Date(2026, 9, 26, 10, 0, 0) // local time 2026-10-26 10:00

export function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-hub-'))
  const panelDir = path.join(root, 'panel')
  fs.mkdirSync(path.join(root, 'materials'), { recursive: true })
  fs.mkdirSync(panelDir, { recursive: true })

  fs.writeFileSync(path.join(root, 'profile.md'), [
    '---',
    'name: Demo Learner',
    'stage: Year 1',
    'major: Computer Science',
    'goals:',
    '  - Build foundations in calculus, linear algebra, and C',
    'teaching:',
    '  language: en',
    '  one_step_at_a_time: true',
    'constraints:',
    '  - Do not modify user files without consent',
    '---',
    '',
    '# Current state',
    'Seed fixture used by the test suite.',
    '',
  ].join('\n'))

  fs.writeFileSync(path.join(root, 'branches.json'), JSON.stringify({
    version: 1,
    seed: true,
    branches: [
      {
        id: 'math.calculus',
        name: 'Calculus',
        parent: 'math',
        workspace: '/path/to/learner/courses/calculus',
        paths: ['courses/calculus'],
        keywords: ['limit', 'derivative', 'integral', '极限', '导数', '积分'],
        status: 'active',
        next: 'Chapter 1: functions and limits',
      },
      {
        id: 'math.linear-algebra',
        name: 'Linear Algebra',
        parent: 'math',
        workspace: '/path/to/learner/courses/linear-algebra',
        paths: ['courses/linear-algebra'],
        keywords: ['matrix', 'determinant', 'eigenvalue', '矩阵', '行列式', '特征值'],
        status: 'active',
        next: 'Chapter 1: determinants',
      },
      {
        id: 'cs.c',
        name: 'C Programming',
        parent: 'cs',
        workspace: '/path/to/learner/courses/c',
        paths: ['courses/c'],
        keywords: ['pointer', 'array', 'struct', '指针', '数组', '结构体'],
        status: 'active',
        next: 'Pointers and arrays',
      },
    ],
  }, null, 2))

  fs.writeFileSync(path.join(root, 'concepts.json'), JSON.stringify({
    version: 1,
    seed: true,
    notice: 'Seed fixture: unknown fields must be preserved',
    concepts: [
      {
        id: 'math.calculus.limit',
        name: '极限',
        aliases: ['limit'],
        branches: ['math.calculus'],
        prereq: [],
        related: ['math.calculus.derivative'],
        mastery: 2,
        evidence: ['calculus/homework-1'],
        misconceptions: ['把无限接近当成等于'],
        next_review: '2026-10-25',
      },
      {
        id: 'math.calculus.derivative',
        name: '导数',
        aliases: ['derivative'],
        branches: ['math.calculus'],
        prereq: ['math.calculus.limit'],
        related: [],
        mastery: 1,
        evidence: [],
        next_review: '2026-10-30',
      },
      {
        id: 'math.linear-algebra.matrix',
        name: '矩阵',
        aliases: ['matrix'],
        branches: ['math.linear-algebra'],
        prereq: [],
        related: [],
        mastery: 3,
        evidence: ['linear-algebra/homework-2'],
        next_review: '2026-11-02',
      },
      {
        id: 'cs.c.pointer',
        name: '指针',
        aliases: ['pointer'],
        branches: ['cs.c'],
        prereq: [],
        related: ['cs.c.array'],
        mastery: 2,
        evidence: ['c-program/homework-3'],
        misconceptions: ['数组名和指针混淆'],
        course_progress: 'in progress',
        next_review: '2026-10-24',
      },
      {
        id: 'cs.c.array',
        name: '数组',
        aliases: ['array'],
        branches: ['cs.c'],
        prereq: ['cs.c.pointer'],
        related: [],
        mastery: 1,
        evidence: [],
        next_review: null,
      },
    ],
  }, null, 2))

  const progressLines = [
    {
      ts: '2026-10-24T20:00:00+08:00',
      branch: 'cs.c',
      unit: '指针与数组',
      action: 'study',
      mastery: 2,
      evidence: 'c-program/homework-3',
    },
    {
      ts: '2026-10-25T21:00:00+08:00',
      branch: 'math.calculus',
      unit: '第一章 函数与极限',
      action: 'practice',
      mastery: 2,
      evidence: 'calculus/homework-1',
    },
  ]
  fs.writeFileSync(path.join(root, 'progress.jsonl'), `${progressLines.map((line) => JSON.stringify(line)).join('\n')}\n`)

  fs.writeFileSync(path.join(root, 'errors.json'), JSON.stringify({
    version: 1,
    seed: true,
    errors: [
      {
        id: 'E-001',
        branch: 'cs.c',
        concept: 'cs.c.pointer',
        symptom: '数组名和指针混淆',
        root_cause: '没有区分数组名退化为首元素地址',
        fix: '用 sizeof 与 &arr 对比',
        seen: 2,
        last_at: '2026-10-24',
      },
    ],
  }, null, 2))

  fs.writeFileSync(path.join(root, 'materials', 'index.md'), [
    '# Materials index (seed)',
    '',
    '- Calculus | textbook | Demo textbook | courses/calculus/textbook.pdf | KB: no',
    '- C Programming | homework | c-program/homework-4 | courses/c/homework-4.c | KB: no',
    '',
  ].join('\n'))

  fs.writeFileSync(path.join(root, 'sessions.jsonl'), '')

  fs.writeFileSync(path.join(panelDir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Panel fixture</title></head><body><div id="panel-marker">panel fixture</div></body></html>')
  fs.writeFileSync(path.join(panelDir, 'styles.css'), 'body{color:#111}')
  fs.writeFileSync(path.join(panelDir, 'app.js'), 'console.log("panel")')
  fs.writeFileSync(path.join(panelDir, 'sample-state.json'), JSON.stringify({ schema: 'learning-hub.state/v1', seed: true }))

  return {
    root,
    panelDir,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

/** Capture logger output so the test run stays quiet. */
export function quietLogger() {
  return { info() {}, warn() {}, error() {} }
}
