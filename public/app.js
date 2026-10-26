/* 学习中枢 · 静态面板（无构建 / 无 CDN / 无外部依赖）
 * 数据优先级：宿主 API → window.__LEARNING_HUB_DATA__ → 同目录 sample-state.json → 内置 fallback。
 * 本文件同时导出纯函数，供 panel/selfcheck.mjs 在 Node 中校验布局与渲染。
 */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LearningHub = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { api.boot(); });
    } else {
      api.boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var API_STATE = '/api/learning-hub/state';
  var API_RECORD = '/api/learning-hub/record';
  var MASTERY_LABELS = ['未接触', '见过', '能跟做', '能独立做', '熟练稳定', '能讲明白'];
  var ACTION_LABELS = {
    study: '学习',
    practice: '练习',
    exam: '测验',
    review: '复习',
    misconception: '误区'
  };
  var STATUS_LABELS = { active: '进行中', paused: '暂缓', planned: '计划中', archived: '已归档' };
  var GROUP_LABELS = { math: '数学', cs: '计算机', ee: '电子', eng: '工程' };
  var SOURCE_INFO = {
    api: { label: '宿主 API', tone: 'live', note: '实时数据' },
    injected: { label: '注入数据', tone: 'seed', note: 'window.__LEARNING_HUB_DATA__' },
    sample: { label: '样例 seed', tone: 'seed', note: 'sample-state.json' },
    builtin: { label: '内置兜底', tone: 'warn', note: 'BUILTIN_STATE' }
  };
  var BUILTIN_STATE = {"schema":"learning-hub.state/v1","seed":true,"as_of":"2026-10-26","generated_at":"2026-10-26T00:20:00+08:00","disclaimer":"演示数据（seed）：仅用于学习中枢面板的离线预览，不代表真实成绩、真实复习记录或真实学习证据。","profile":{"name":"Demo Learner","stage":"Year 1","major":"Computer Science","goals":["Build foundations in Calculus, Linear Algebra, and C Programming","Practice steadily with spaced review"]},"current_branch":"math.calculus","branches":[{"id":"math.calculus","name":"Calculus","parent":"math","workspace":"","paths":["courses/calculus"],"keywords":["极限","导数","微分","积分","级数","多元函数"],"materials":[],"status":"active","next":"第一章 函数与极限 · 极限的 ε-δ 定义","masteryAvg":2.2,"conceptCount":11,"dueCount":3,"weak":["math.calculus.limit","math.calculus.mvt"],"concepts":["math.calculus.function","math.calculus.limit","math.calculus.continuity","math.calculus.derivative","math.calculus.differential","math.calculus.mvt","math.calculus.indefinite-integral","math.calculus.definite-integral","math.calculus.ode","math.calculus.multivariable","math.calculus.series"]},{"id":"math.linear-algebra","name":"Linear Algebra","parent":"math","workspace":"","paths":["courses/linear-algebra"],"keywords":["矩阵","行列式","线性方程组","向量空间","特征值","二次型"],"materials":[],"status":"active","next":"第二章 矩阵 · 逆矩阵与初等变换","masteryAvg":2,"conceptCount":10,"dueCount":3,"weak":["math.linear-algebra.linear-systems","math.linear-algebra.rank"],"concepts":["math.linear-algebra.vectors","math.linear-algebra.matrix-ops","math.linear-algebra.determinant","math.linear-algebra.inverse","math.linear-algebra.linear-systems","math.linear-algebra.rank","math.linear-algebra.vector-space","math.linear-algebra.eigen","math.linear-algebra.orthogonality","math.linear-algebra.quadratic-form"]},{"id":"cs.c","name":"C Programming","parent":"cs","workspace":"","paths":["courses/c"],"keywords":["指针","数组","结构体","动态内存","文件","C"],"materials":[],"status":"active","next":"指针与数组 · 指针运算与越界检查","masteryAvg":2.2,"conceptCount":11,"dueCount":2,"weak":["cs.c.pointer"],"concepts":["cs.c.types","cs.c.variables","cs.c.operators","cs.c.control-flow","cs.c.functions","cs.c.arrays","cs.c.pointer","cs.c.strings","cs.c.structs","cs.c.malloc","cs.c.file-io"]}],"concepts":[{"id":"math.calculus.function","name":"函数与初等函数","aliases":[],"branches":["math.calculus"],"prereq":[],"related":["math.calculus.limit","math.calculus.continuity"],"mastery":4,"evidence":["calculus/homework-1 1(2)","2026-09-18 课堂笔记"],"misconceptions":[],"sources":[],"next_review":"2026-11-09"},{"id":"math.calculus.limit","name":"极限","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.function"],"related":["math.calculus.continuity","math.calculus.series"],"mastery":2,"evidence":["calculus/homework-1 3(2)","2026-10-19 错题订正"],"misconceptions":[],"sources":[],"next_review":"2026-10-24"},{"id":"math.calculus.continuity","name":"连续与间断","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.limit"],"related":["math.calculus.derivative","math.calculus.mvt"],"mastery":3,"evidence":["第一章小测 Q4"],"misconceptions":[],"sources":[],"next_review":"2026-10-30"},{"id":"math.calculus.derivative","name":"导数","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.limit","math.calculus.continuity"],"related":["math.calculus.differential","math.calculus.mvt","math.calculus.indefinite-integral"],"mastery":3,"evidence":["第一章作业 5","2026-10-21 练习"],"misconceptions":[],"sources":[],"next_review":"2026-11-02"},{"id":"math.calculus.differential","name":"微分与线性近似","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.derivative"],"related":["math.calculus.multivariable"],"mastery":3,"evidence":["第二章作业 2"],"misconceptions":[],"sources":[],"next_review":"2026-11-05"},{"id":"math.calculus.mvt","name":"中值定理","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.derivative"],"related":["math.calculus.continuity","math.calculus.definite-integral"],"mastery":1,"evidence":["第二章作业 4(1)"],"misconceptions":[],"sources":[],"next_review":"2026-10-31"},{"id":"math.calculus.indefinite-integral","name":"不定积分","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.derivative"],"related":["math.calculus.definite-integral","math.calculus.ode"],"mastery":3,"evidence":["第三章作业 1"],"misconceptions":[],"sources":[],"next_review":"2026-11-04"},{"id":"math.calculus.definite-integral","name":"定积分","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.indefinite-integral","math.calculus.limit"],"related":["math.calculus.ode","math.calculus.series"],"mastery":3,"evidence":["第三章作业 3","2026-10-23 复习"],"misconceptions":[],"sources":[],"next_review":"2026-10-29"},{"id":"math.calculus.ode","name":"一阶微分方程","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.indefinite-integral","math.calculus.definite-integral"],"related":["math.calculus.derivative"],"mastery":2,"evidence":["第四章作业 1"],"misconceptions":[],"sources":[],"next_review":"2026-11-03"},{"id":"math.calculus.multivariable","name":"多元函数与偏导","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.derivative","math.calculus.definite-integral"],"related":["math.calculus.differential"],"mastery":0,"evidence":[],"misconceptions":[],"sources":[],"next_review":"2026-11-10"},{"id":"math.calculus.series","name":"级数","aliases":[],"branches":["math.calculus"],"prereq":["math.calculus.limit","math.calculus.continuity"],"related":["math.calculus.definite-integral"],"mastery":0,"evidence":[],"misconceptions":[],"sources":[],"next_review":"2026-11-12"},{"id":"math.linear-algebra.vectors","name":"向量与线性组合","aliases":[],"branches":["math.linear-algebra"],"prereq":[],"related":["math.linear-algebra.matrix-ops","math.linear-algebra.vector-space","math.linear-algebra.orthogonality"],"mastery":3,"evidence":["linear-algebra/homework-1 2"],"misconceptions":[],"sources":[],"next_review":"2026-11-06"},{"id":"math.linear-algebra.matrix-ops","name":"矩阵运算","aliases":[],"branches":["math.linear-algebra"],"prereq":["math.linear-algebra.vectors"],"related":["math.linear-algebra.determinant","math.linear-algebra.linear-systems","cs.c.arrays"],"mastery":3,"evidence":["第一章作业 4","2026-10-18 练习"],"misconceptions":[],"sources":[],"next_review":"2026-11-01"},{"id":"math.linear-algebra.determinant","name":"行列式","aliases":[],"branches":["math.linear-algebra"],"prereq":["math.linear-algebra.matrix-ops"],"related":["math.linear-algebra.inverse","math.linear-algebra.eigen"],"mastery":2,"evidence":["第二章作业 2"],"misconceptions":[],"sources":[],"next_review":"2026-10-31"},{"id":"math.linear-algebra.inverse","name":"逆矩阵","aliases":[],"branches":["math.linear-algebra"],"prereq":["math.linear-algebra.determinant","math.linear-algebra.matrix-ops"],"related":["math.linear-algebra.linear-systems"],"mastery":3,"evidence":["第二章作业 5(1)"],"misconceptions":[],"sources":[],"next_review":"2026-11-02"},{"id":"math.linear-algebra.linear-systems","name":"线性方程组","aliases":[],"branches":["math.linear-algebra"],"prereq":["math.linear-algebra.matrix-ops"],"related":["math.linear-algebra.inverse","math.linear-algebra.rank","math.linear-algebra.vector-space"],"mastery":2,"evidence":["第二章小测 Q3","2026-10-24 重做"],"misconceptions":[],"sources":[],"next_review":"2026-10-25"},{"id":"math.linear-algebra.rank","name":"秩","aliases":[],"branches":["math.linear-algebra"],"prereq":["math.linear-algebra.matrix-ops"],"related":["math.linear-algebra.linear-systems","math.linear-algebra.vector-space","math.linear-algebra.determinant"],"mastery":2,"evidence":["第三章作业 1"],"misconceptions":[],"sources":[],"next_review":"2026-11-07"},{"id":"math.linear-algebra.vector-space","name":"向量空间","aliases":[],"branches":["math.linear-algebra"],"prereq":["math.linear-algebra.vectors","math.linear-algebra.linear-systems"],"related":["math.linear-algebra.rank","math.linear-algebra.eigen"],"mastery":1,"evidence":["第三章作业 4"],"misconceptions":[],"sources":[],"next_review":"2026-11-08"},{"id":"math.linear-algebra.eigen","name":"特征值与特征向量","aliases":[],"branches":["math.linear-algebra"],"prereq":["math.linear-algebra.determinant","math.linear-algebra.linear-systems"],"related":["math.linear-algebra.quadratic-form","math.linear-algebra.orthogonality"],"mastery":2,"evidence":["第四章作业 2"],"misconceptions":[],"sources":[],"next_review":"2026-10-27"},{"id":"math.linear-algebra.orthogonality","name":"正交与投影","aliases":[],"branches":["math.linear-algebra"],"prereq":["math.linear-algebra.vectors"],"related":["math.linear-algebra.vector-space","math.linear-algebra.quadratic-form"],"mastery":2,"evidence":["第五章作业 1"],"misconceptions":[],"sources":[],"next_review":"2026-11-04"},{"id":"math.linear-algebra.quadratic-form","name":"二次型","aliases":[],"branches":["math.linear-algebra"],"prereq":["math.linear-algebra.eigen","math.linear-algebra.orthogonality"],"related":["math.linear-algebra.eigen"],"mastery":0,"evidence":[],"misconceptions":[],"sources":[],"next_review":"2026-11-12"},{"id":"cs.c.types","name":"基本数据类型","aliases":[],"branches":["cs.c"],"prereq":[],"related":["cs.c.variables","cs.c.operators"],"mastery":3,"evidence":["c-program/homework-1"],"misconceptions":[],"sources":[],"next_review":"2026-11-05"},{"id":"cs.c.variables","name":"变量与作用域","aliases":[],"branches":["cs.c"],"prereq":["cs.c.types"],"related":["cs.c.functions","cs.c.pointer"],"mastery":3,"evidence":["c-program/homework-2"],"misconceptions":[],"sources":[],"next_review":"2026-11-02"},{"id":"cs.c.operators","name":"运算符与表达式","aliases":[],"branches":["cs.c"],"prereq":["cs.c.variables"],"related":["cs.c.control-flow"],"mastery":3,"evidence":["c-program/homework-2 Q5"],"misconceptions":[],"sources":[],"next_review":"2026-11-03"},{"id":"cs.c.control-flow","name":"控制流","aliases":[],"branches":["cs.c"],"prereq":["cs.c.operators"],"related":["cs.c.functions","cs.c.arrays"],"mastery":3,"evidence":["c-program/homework-3"],"misconceptions":[],"sources":[],"next_review":"2026-11-06"},{"id":"cs.c.functions","name":"函数","aliases":[],"branches":["cs.c"],"prereq":["cs.c.control-flow","cs.c.variables"],"related":["cs.c.arrays","cs.c.pointer"],"mastery":2,"evidence":["c-program/homework-3 Q4"],"misconceptions":[],"sources":[],"next_review":"2026-10-31"},{"id":"cs.c.arrays","name":"数组","aliases":[],"branches":["cs.c"],"prereq":["cs.c.functions","cs.c.control-flow"],"related":["cs.c.pointer","cs.c.strings","math.linear-algebra.matrix-ops"],"mastery":3,"evidence":["c-program/homework-4 Q2","2026-10-22 阶段测验记录（seed 占位）"],"misconceptions":[],"sources":[],"next_review":"2026-11-01"},{"id":"cs.c.pointer","name":"指针","aliases":[],"branches":["cs.c"],"prereq":["cs.c.arrays","cs.c.variables"],"related":["cs.c.strings","cs.c.malloc","cs.c.structs"],"mastery":2,"evidence":["c-program/homework-4 Q3","2026-10-25 练习"],"misconceptions":[],"sources":[],"next_review":"2026-10-26"},{"id":"cs.c.strings","name":"字符串","aliases":[],"branches":["cs.c"],"prereq":["cs.c.arrays","cs.c.pointer"],"related":["cs.c.functions","cs.c.structs"],"mastery":2,"evidence":["c-program/homework-5 Q1"],"misconceptions":[],"sources":[],"next_review":"2026-10-30"},{"id":"cs.c.structs","name":"结构体","aliases":[],"branches":["cs.c"],"prereq":["cs.c.variables","cs.c.arrays"],"related":["cs.c.pointer","cs.c.file-io"],"mastery":1,"evidence":["c-program/homework-5 Q3"],"misconceptions":[],"sources":[],"next_review":"2026-10-28"},{"id":"cs.c.malloc","name":"动态内存","aliases":[],"branches":["cs.c"],"prereq":["cs.c.pointer"],"related":["cs.c.structs","cs.c.file-io"],"mastery":1,"evidence":["c-program/homework-6 Q2"],"misconceptions":[],"sources":[],"next_review":"2026-11-02"},{"id":"cs.c.file-io","name":"文件读写","aliases":[],"branches":["cs.c"],"prereq":["cs.c.functions","cs.c.pointer"],"related":["cs.c.structs","cs.c.malloc"],"mastery":1,"evidence":["c-program/homework-6 Q3"],"misconceptions":[],"sources":[],"next_review":"2026-11-07"}],"weak_concepts":[{"concept":"math.calculus.limit","mastery":2,"reasons":["掌握度 2/5","同一误区出现 2 次"]},{"concept":"math.calculus.mvt","mastery":1,"reasons":["掌握度 1/5","缺少独立完成的证据"]},{"concept":"math.linear-algebra.linear-systems","mastery":2,"reasons":["掌握度 2/5","解的情况讨论不完整"]},{"concept":"math.linear-algebra.rank","mastery":2,"reasons":["掌握度 2/5","行秩 / 列秩混淆"]},{"concept":"cs.c.pointer","mastery":2,"reasons":["掌握度 2/5","数组名与指针混淆"]}],"due_reviews":[{"concept":"math.calculus.limit","due":"2026-10-24","mastery":2},{"concept":"math.linear-algebra.linear-systems","due":"2026-10-25","mastery":2},{"concept":"cs.c.pointer","due":"2026-10-26","mastery":2},{"concept":"math.linear-algebra.eigen","due":"2026-10-27","mastery":2},{"concept":"cs.c.structs","due":"2026-10-28","mastery":1},{"concept":"math.calculus.definite-integral","due":"2026-10-29","mastery":3},{"concept":"math.calculus.mvt","due":"2026-10-31","mastery":1},{"concept":"math.linear-algebra.determinant","due":"2026-10-31","mastery":2}],"recent_activity":[{"ts":"2026-10-25T22:40:00+08:00","branch":"cs.c","unit":"指针","action":"practice","mastery":2,"evidence":"c-program/homework-4 Q3"},{"ts":"2026-10-25T21:10:00+08:00","branch":"math.calculus","unit":"极限","action":"review","mastery":2,"evidence":"错题订正 2 题（seed 占位）"},{"ts":"2026-10-24T16:30:00+08:00","branch":"math.linear-algebra","unit":"线性方程组","action":"practice","mastery":2,"evidence":"第二章小测 Q3 重做"},{"ts":"2026-10-24T10:05:00+08:00","branch":"cs.c","unit":"指针","action":"misconception","mastery":2,"evidence":"作业4 Q3 数组名与指针混用"},{"ts":"2026-10-23T19:20:00+08:00","branch":"math.calculus","unit":"定积分","action":"review","mastery":3,"evidence":"第三章作业 3 复习"},{"ts":"2026-10-22T20:00:00+08:00","branch":"cs.c","unit":"数组","action":"exam","mastery":3,"evidence":"阶段测验答题记录（seed 占位，无真实分数）"},{"ts":"2026-10-21T18:40:00+08:00","branch":"math.calculus","unit":"导数","action":"practice","mastery":3,"evidence":"第一章作业 5 订正"},{"ts":"2026-10-20T20:10:00+08:00","branch":"math.linear-algebra","unit":"特征值与特征向量","action":"study","mastery":2,"evidence":"第四章作业 2"}]};

  /* ------------------------------------------------------------------ *
   * 基础工具
   * ------------------------------------------------------------------ */

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function str(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function num(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampMastery(value) {
    var n = Math.round(num(value, 0));
    return Math.max(0, Math.min(5, n));
  }

  function unique(list) {
    var seen = Object.create(null);
    var out = [];
    arr(list).forEach(function (item) {
      var key = str(item);
      if (key && !seen[key]) {
        seen[key] = true;
        out.push(key);
      }
    });
    return out;
  }

  function esc(value) {
    return str(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function parseDate(value) {
    if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getTime());
    if (!value) return null;
    var text = str(value);
    var dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (dateOnly) {
      var local = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
      return isNaN(local.getTime()) ? null : local;
    }
    var parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function startOfDay(value) {
    var d = parseDate(value) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function todayStart() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function addDays(date, days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function dayDiff(from, to) {
    if (!from || !to) return 0;
    return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
  }

  function isoDate(date) {
    if (!date) return '';
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function shortDate(value) {
    var d = parseDate(value);
    if (!d) return '—';
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dateTime(value) {
    var d = parseDate(value);
    if (!d) return '—';
    return String(d.getMonth() + 1).padStart(2, '0') + '月' + String(d.getDate()).padStart(2, '0') + '日 ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function activityTime(value) {
    var d = parseDate(value);
    if (!d) return '—';
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function actionLabel(action) {
    return ACTION_LABELS[action] || str(action) || '记录';
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || str(status) || '未知';
  }

  function groupLabel(parent) {
    return GROUP_LABELS[parent] || (parent ? str(parent) : '其他');
  }

  function masteryLabel(mastery) {
    return MASTERY_LABELS[clampMastery(mastery)];
  }

  function dueStatus(value, reference) {
    var d = parseDate(value);
    if (!d) return { key: 'none', label: '未排期', days: null, date: null };
    var days = dayDiff(reference, d);
    var key = 'later';
    var label = shortDate(d);
    if (days < 0) {
      key = 'overdue';
      label = '逾期 ' + Math.abs(days) + ' 天';
    } else if (days === 0) {
      key = 'today';
      label = '今天';
    } else if (days === 1) {
      key = 'soon';
      label = '明天';
    } else if (days <= 7) {
      key = 'soon';
      label = days + ' 天后';
    }
    return { key: key, label: label, days: days, date: d };
  }

  function masteryChip(mastery, extraClass) {
    var m = clampMastery(mastery);
    return '<span class="mastery-chip m' + m + (extraClass ? ' ' + extraClass : '') + '">' + m + '</span>';
  }

  function pips(mastery) {
    var m = clampMastery(mastery);
    var out = '<span class="pips" role="img" aria-label="掌握度 ' + m + ' / 5">';
    for (var i = 1; i <= 5; i += 1) out += '<span class="' + (i <= m ? 'is-on m' + m : '') + '"></span>';
    return out + '</span>';
  }

  /* ------------------------------------------------------------------ *
   * 状态规范化：canonical 优先，兼容旧字段
   * ------------------------------------------------------------------ */

  function unwrapState(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    if (raw.data && typeof raw.data === 'object' && (raw.data.concepts || raw.data.branches)) return raw.data;
    if (raw.state && typeof raw.state === 'object' && (raw.state.concepts || raw.state.branches)) return raw.state;
    return raw;
  }

  function normalizeConcept(item) {
    if (!item || typeof item !== 'object') return null;
    var id = str(item.id);
    if (!id) return null;
    return {
      id: id,
      name: str(item.name) || id,
      aliases: arr(item.aliases).map(str).filter(Boolean),
      branches: unique(arr(item.branches).map(str)),
      prereq: unique(arr(item.prereq).map(str)),
      related: unique(arr(item.related).map(str)),
      mastery: clampMastery(item.mastery),
      evidence: arr(item.evidence).map(str).filter(Boolean),
      misconceptions: arr(item.misconceptions).map(str).filter(Boolean),
      sources: arr(item.sources).map(str).filter(Boolean),
      next_review: str(item.next_review || item.nextReview || '')
    };
  }

  function normalizeBranch(item, index, conceptById) {
    if (!item || typeof item !== 'object') return null;
    var id = str(item.id);
    if (!id) return null;
    var explicit = arr(item.concepts).map(function (entry) {
      return typeof entry === 'string' ? entry : str(entry && entry.id);
    }).filter(Boolean);
    var conceptIds = unique(explicit).filter(function (cid) { return conceptById.has(cid); });
    var avg = num(item.masteryAvg, NaN);
    var count = num(item.conceptCount, NaN);
    return {
      id: id,
      name: str(item.name) || id,
      parent: str(item.parent),
      workspace: str(item.workspace),
      paths: arr(item.paths).map(str).filter(Boolean),
      keywords: arr(item.keywords).map(str).filter(Boolean),
      materials: arr(item.materials),
      status: str(item.status) || 'active',
      next: str(item.next),
      masteryAvg: Number.isFinite(avg) ? avg : null,
      conceptCount: Number.isFinite(count) ? count : null,
      dueCount: num(item.dueCount, NaN),
      explicitConceptIds: conceptIds,
      weakIds: unique(arr(item.weak).map(function (entry) {
        return typeof entry === 'string' ? entry : str(entry && entry.id);
      }).filter(Boolean)),
      conceptIds: [],
      conceptList: [],
      order: index
    };
  }

  function normalizeWeakList(rawList, conceptById) {
    var out = [];
    arr(rawList).forEach(function (entry) {
      if (typeof entry === 'string') entry = { id: entry };
      if (!entry || typeof entry !== 'object') return;
      var id = str(entry.concept || entry.concept_id || entry.conceptId || entry.id);
      var concept = conceptById.get(id);
      if (!concept) return;
      var reasons = [];
      if (Array.isArray(entry.reasons)) reasons = entry.reasons.map(str).filter(Boolean);
      else if (entry.reason) reasons = [str(entry.reason)];
      if (!reasons.length) reasons = ['掌握度 ' + concept.mastery + ' / 5'];
      out.push({
        conceptId: concept.id,
        concept: concept,
        name: concept.name,
        branch: str(entry.branch) || concept.branches[0] || '',
        mastery: clampMastery(entry.mastery === undefined ? concept.mastery : entry.mastery),
        reasons: reasons
      });
    });
    return out;
  }

  function normalizeDueList(rawList, conceptById, referenceDate) {
    var out = [];
    arr(rawList).forEach(function (entry) {
      if (typeof entry === 'string') entry = { id: entry };
      if (!entry || typeof entry !== 'object') return;
      var id = str(entry.concept || entry.concept_id || entry.conceptId || entry.id);
      var concept = conceptById.get(id);
      if (!concept) return;
      var due = str(entry.due || entry.next_review || entry.nextReview || entry.date || concept.next_review);
      var dueDate = parseDate(due);
      if (!dueDate) return;
      out.push({
        conceptId: concept.id,
        concept: concept,
        name: concept.name,
        branch: str(entry.branch) || concept.branches[0] || '',
        next_review: isoDate(dueDate),
        mastery: clampMastery(entry.mastery === undefined ? concept.mastery : entry.mastery),
        dueDate: startOfDay(dueDate),
        days: dayDiff(referenceDate, dueDate)
      });
    });
    out.sort(function (a, b) {
      return a.dueDate.getTime() - b.dueDate.getTime() || a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
    return out;
  }

  function normalizeActivity(rawList, conceptById) {
    var out = [];
    arr(rawList).forEach(function (entry, index) {
      if (!entry || typeof entry !== 'object') return;
      var branch = str(entry.branch || entry.branch_id || entry.branchId);
      var unit = str(entry.unit || entry.concept || entry.name);
      var concept = null;
      if (conceptById.has(unit)) concept = conceptById.get(unit);
      else {
        concept = Array.from(conceptById.values()).find(function (c) {
          return c.name === unit && (!branch || c.branches.indexOf(branch) !== -1);
        }) || null;
      }
      out.push({
        ts: str(entry.ts || entry.time || entry.at),
        branch: branch || (concept && concept.branches[0]) || '',
        unit: unit,
        action: str(entry.action) || 'study',
        mastery: clampMastery(entry.mastery),
        evidence: str(entry.evidence),
        conceptId: concept ? concept.id : '',
        order: index
      });
    });
    out.sort(function (a, b) {
      var ta = parseDate(a.ts);
      var tb = parseDate(b.ts);
      if (ta && tb && ta.getTime() !== tb.getTime()) return tb.getTime() - ta.getTime();
      return a.order - b.order;
    });
    return out.slice(0, 40);
  }

  function normalizeState(raw, options) {
    var source = unwrapState(raw);
    if (!source || typeof source !== 'object') throw new Error('state 不是对象');
    var rawConcepts = arr(source.concepts);
    var rawBranches = arr(source.branches);
    if (!rawConcepts.length) throw new Error('state 缺少 concepts');
    if (!rawBranches.length) throw new Error('state 缺少 branches');

    var concepts = rawConcepts.map(normalizeConcept).filter(Boolean);
    var conceptById = new Map(concepts.map(function (c) { return [c.id, c]; }));
    if (!concepts.length) throw new Error('state.concepts 为空');

    var branches = rawBranches.map(function (item, index) {
      return normalizeBranch(item, index, conceptById);
    }).filter(Boolean);
    if (!branches.length) throw new Error('state.branches 为空');

    // 合并分支显式 concepts 与 concept.branches，双向补齐，避免字段轻微不一致丢数据。
    branches.forEach(function (branch) {
      var inferred = concepts.filter(function (c) { return c.branches.indexOf(branch.id) !== -1; })
        .map(function (c) { return c.id; });
      branch.conceptIds = unique(branch.explicitConceptIds.concat(inferred));
      branch.conceptIds.forEach(function (cid) {
        var concept = conceptById.get(cid);
        if (concept && concept.branches.indexOf(branch.id) === -1) concept.branches.push(branch.id);
      });
    });
    concepts.forEach(function (concept) {
      if (concept.branches.length) return;
      var guess = branches.find(function (b) { return concept.id.indexOf(b.id + '.') === 0; });
      if (guess) concept.branches.push(guess.id);
    });
    branches.forEach(function (branch) {
      branch.conceptIds = unique(branch.conceptIds.concat(
        concepts.filter(function (c) { return c.branches.indexOf(branch.id) !== -1; }).map(function (c) { return c.id; })
      ));
      branch.conceptList = branch.conceptIds.map(function (cid) { return conceptById.get(cid); }).filter(Boolean);
      branch.conceptCount = branch.conceptCount === null ? branch.conceptList.length : branch.conceptCount;
      if (branch.masteryAvg === null) {
        branch.masteryAvg = branch.conceptList.length
          ? branch.conceptList.reduce(function (sum, c) { return sum + c.mastery; }, 0) / branch.conceptList.length
          : 0;
      }
    });

    var generatedAt = str(source.generated_at || source.generatedAt);
    var seed = source.seed === true || source.sample === true || options && options.seed === true;
    var explicitAsOf = parseDate(source.as_of || source.asOf);
    var generatedDate = parseDate(generatedAt);
    var referenceDate = startOfDay(explicitAsOf || (seed && generatedDate) || options && options.today || todayStart());

    var requestedBranch = str(source.current_branch || source.currentBranch || (options && options.currentBranch));
    var currentBranch = branches.find(function (b) { return b.id === requestedBranch; }) ||
      branches.find(function (b) { return b.status === 'active'; }) ||
      branches[0];

    var weak = null;
    if (Array.isArray(source.weak_concepts) || Array.isArray(source.weakConcepts) || Array.isArray(source.weak)) {
      weak = normalizeWeakList(source.weak_concepts || source.weakConcepts || source.weak, conceptById);
    } else {
      var weakIds = [];
      branches.forEach(function (b) { weakIds = weakIds.concat(b.weakIds); });
      if (weakIds.length) {
        weak = normalizeWeakList(weakIds, conceptById);
      } else {
        weak = concepts.filter(function (c) { return c.mastery > 0 && c.mastery <= 2; }).map(function (c) {
          return {
            conceptId: c.id, concept: c, name: c.name, branch: c.branches[0] || '',
            mastery: c.mastery, reasons: ['掌握度 ' + c.mastery + ' / 5']
          };
        });
      }
    }

    var due = null;
    if (Array.isArray(source.due_reviews) || Array.isArray(source.dueReviews) || Array.isArray(source.due)) {
      due = normalizeDueList(source.due_reviews || source.dueReviews || source.due, conceptById, referenceDate);
    } else {
      var horizon = addDays(referenceDate, 7);
      due = normalizeDueList(concepts.filter(function (c) {
        var d = parseDate(c.next_review);
        return d && startOfDay(d) <= horizon;
      }).map(function (c) {
        return { concept: c.id, due: c.next_review, mastery: c.mastery };
      }), conceptById, referenceDate);
    }

    var rawActivity = source.recent_activity || source.recentActivity || source.activity;
    var activity = normalizeActivity(Array.isArray(rawActivity) ? rawActivity : [], conceptById);

    branches.forEach(function (branch) {
      var branchDue = due.filter(function (d) { return d.branch === branch.id || (d.concept && d.concept.branches.indexOf(branch.id) !== -1); });
      if (!Number.isFinite(branch.dueCount)) branch.dueCount = branchDue.length;
      branch.dueList = branchDue;
      branch.weakList = weak.filter(function (w) {
        return w.branch === branch.id || (w.concept && w.concept.branches.indexOf(branch.id) !== -1);
      });
      branch.weakCount = branch.weakIds.length || branch.weakList.length;
    });

    var profile = source.profile && typeof source.profile === 'object' ? source.profile : {};
    return {
      schema: str(source.schema || ''),
      seed: seed,
      generatedAt: generatedAt,
      asOf: str(source.as_of || source.asOf) || isoDate(referenceDate),
      referenceDate: referenceDate,
      disclaimer: str(source.disclaimer),
      profile: {
        name: str(profile.name) || '学习者',
        stage: str(profile.stage),
        major: str(profile.major),
        goals: arr(profile.goals).map(str).filter(Boolean)
      },
      currentBranch: currentBranch.id,
      branches: branches,
      concepts: concepts,
      conceptIndex: conceptById,
      weak: weak,
      due: due,
      activity: activity,
      source: str(options && options.source)
    };
  }

  function getBranch(state, branchId) {
    return state.branches.find(function (b) { return b.id === branchId; }) || null;
  }

  function getConcept(state, conceptId) {
    return state.conceptIndex.get(conceptId) || null;
  }

  function branchName(state, branchId) {
    var branch = getBranch(state, branchId);
    return branch ? branch.name : branchId;
  }

  function computeStats(state, branchId) {
    var branch = getBranch(state, branchId);
    if (!branch) return null;
    var distribution = [0, 0, 0, 0, 0, 0];
    var sum = 0;
    var touched = 0;
    branch.conceptList.forEach(function (concept) {
      var m = clampMastery(concept.mastery);
      distribution[m] += 1;
      sum += m;
      if (m >= 1) touched += 1;
    });
    var computedAvg = branch.conceptList.length ? sum / branch.conceptList.length : 0;
    var weak = state.weak.filter(function (w) {
      return w.branch === branchId || (w.concept && w.concept.branches.indexOf(branchId) !== -1);
    });
    var due = state.due.filter(function (d) {
      return d.branch === branchId || (d.concept && d.concept.branches.indexOf(branchId) !== -1);
    });
    var overdue = due.filter(function (d) { return d.days < 0; }).length;
    var today = due.filter(function (d) { return d.days === 0; }).length;
    return {
      branch: branch,
      distribution: distribution,
      conceptCount: branch.conceptCount,
      listCount: branch.conceptList.length,
      avg: Number.isFinite(branch.masteryAvg) ? branch.masteryAvg : computedAvg,
      computedAvg: computedAvg,
      touched: touched,
      weakCount: branch.weakCount,
      weak: weak,
      dueCount: Number.isFinite(branch.dueCount) ? branch.dueCount : due.length,
      due: due,
      overdue: overdue,
      today: today
    };
  }

  /* ------------------------------------------------------------------ *
   * 概念图布局与 SVG（纯函数，可在 Node 中测试）
   * ------------------------------------------------------------------ */

  function wrapLabel(name) {
    var text = str(name);
    if (text.length <= 6) return [text];
    var first = text.slice(0, 6);
    var rest = text.slice(6);
    if (rest.length <= 6) return [first, rest];
    return [first, text.slice(6, 11) + '…'];
  }

  function buildGraphLayout(concepts) {
    var list = arr(concepts).filter(function (c) { return c && c.id; });
    var map = new Map(list.map(function (c) { return [c.id, c]; }));
    var order = new Map(list.map(function (c, index) { return [c.id, index]; }));
    var depthMemo = new Map();

    function depthOf(concept, visiting) {
      if (depthMemo.has(concept.id)) return depthMemo.get(concept.id);
      if (visiting.has(concept.id)) return 0;
      visiting.add(concept.id);
      var parents = concept.prereq.filter(function (pid) { return map.has(pid) && pid !== concept.id; });
      var depth = 0;
      parents.forEach(function (pid) {
        depth = Math.max(depth, 1 + depthOf(map.get(pid), visiting));
      });
      visiting.delete(concept.id);
      depth = Math.min(depth, 9);
      depthMemo.set(concept.id, depth);
      return depth;
    }

    list.forEach(function (concept) { depthOf(concept, new Set()); });
    var maxDepth = 0;
    var layers = [];
    list.forEach(function (concept) {
      var d = depthMemo.get(concept.id) || 0;
      maxDepth = Math.max(maxDepth, d);
      if (!layers[d]) layers[d] = [];
      layers[d].push(concept);
    });
    for (var d = 0; d <= maxDepth; d += 1) {
      if (!layers[d]) layers[d] = [];
    }

    // 分层 + 父节点居中：每层把节点放到其先修的 x 均值附近，再做最小间距消解。
    // 这样 12 节点/19 条先修边不会在左右两极之间来回拉出长斜线。
    var width = 360;
    var padX = 48;
    var top = 42;
    var rowGap = 76;
    var height = Math.max(300, top + maxDepth * rowGap + 68);
    var nodes = [];
    var byId = new Map();
    for (var depth = 0; depth <= maxDepth; depth += 1) {
      var layer = layers[depth];
      var desired = new Map();
      layer.forEach(function (concept) {
        var parents = concept.prereq.map(function (pid) { return byId.get(pid); }).filter(Boolean);
        var x = parents.length
          ? parents.reduce(function (sum, node) { return sum + node.x; }, 0) / parents.length
          : width / 2;
        desired.set(concept.id, x);
      });
      layer.sort(function (a, b) {
        return desired.get(a.id) - desired.get(b.id) || order.get(a.id) - order.get(b.id);
      });
      var count = layer.length;
      var gap = count > 1 ? Math.min(92, (width - padX * 2) / (count - 1)) : 0;
      var span = gap * (count - 1);
      var mean = count
        ? layer.reduce(function (sum, concept) { return sum + desired.get(concept.id); }, 0) / count
        : width / 2;
      var start = count > 1
        ? Math.max(padX, Math.min(width - padX - span, mean - span / 2))
        : Math.max(padX, Math.min(width - padX, mean));
      layer.forEach(function (concept, index) {
        var node = {
          id: concept.id,
          concept: concept,
          x: count > 1 ? start + gap * index : start,
          y: top + depth * rowGap,
          depth: depth,
          mastery: concept.mastery,
          lines: wrapLabel(concept.name)
        };
        nodes.push(node);
        byId.set(concept.id, node);
      });
    }

    function prereqPath(a, b) {
      if (Math.abs(a.x - b.x) < 0.5) {
        return 'M ' + a.x.toFixed(1) + ' ' + (a.y + 18) + ' L ' + b.x.toFixed(1) + ' ' + (b.y - 21);
      }
      var midY = (a.y + b.y) / 2;
      return 'M ' + a.x.toFixed(1) + ' ' + (a.y + 18) +
        ' C ' + a.x.toFixed(1) + ' ' + midY.toFixed(1) + ', ' +
        b.x.toFixed(1) + ' ' + midY.toFixed(1) + ', ' +
        b.x.toFixed(1) + ' ' + (b.y - 21);
    }

    function relatedPath(a, b) {
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var length = Math.sqrt(dx * dx + dy * dy) || 1;
      var offset = Math.min(26, length * 0.22);
      var cx = (a.x + b.x) / 2 - (dy / length) * offset;
      var cy = (a.y + b.y) / 2 + (dx / length) * offset;
      return 'M ' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
        ' Q ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ', ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    }

    var allPrereqEdges = [];
    var prereqPairs = new Set();
    nodes.forEach(function (node) {
      node.concept.prereq.forEach(function (pid) {
        var parent = byId.get(pid);
        if (!parent) return;
        var key = parent.id + '>' + node.id;
        prereqPairs.add(key);
        allPrereqEdges.push({ from: parent.id, to: node.id, type: 'prereq', path: prereqPath(parent, node) });
      });
    });

    // 传递约简：A→B→C 存在时不再画 A→C，保留最贴近的层级。
    var parentsOf = new Map();
    var childrenOf = new Map();
    allPrereqEdges.forEach(function (edge) {
      if (!parentsOf.has(edge.to)) parentsOf.set(edge.to, []);
      parentsOf.get(edge.to).push(edge.from);
      if (!childrenOf.has(edge.from)) childrenOf.set(edge.from, []);
      childrenOf.get(edge.from).push(edge.to);
    });
    function reaches(start, target, seen) {
      if (start === target) return true;
      seen = seen || new Set();
      if (seen.has(start)) return false;
      seen.add(start);
      var children = childrenOf.get(start) || [];
      for (var i = 0; i < children.length; i += 1) {
        if (children[i] === target || reaches(children[i], target, seen)) return true;
      }
      return false;
    }
    var prereqEdges = allPrereqEdges.filter(function (edge) {
      var parents = parentsOf.get(edge.to) || [];
      return !parents.some(function (other) {
        return other !== edge.from && reaches(edge.from, other);
      });
    });

    var relatedEdges = [];
    var relatedSeen = new Set();
    nodes.forEach(function (node) {
      node.concept.related.forEach(function (rid) {
        var target = byId.get(rid);
        if (!target || target.id === node.id) return;
        var pair = [node.id, target.id].sort().join('~');
        if (relatedSeen.has(pair)) return;
        relatedSeen.add(pair);
        if (prereqPairs.has(node.id + '>' + target.id) || prereqPairs.has(target.id + '>' + node.id)) return;
        relatedEdges.push({ from: node.id, to: target.id, type: 'related', path: relatedPath(node, target) });
      });
    });

    return {
      width: width,
      height: height,
      maxDepth: maxDepth,
      nodes: nodes,
      edges: prereqEdges.concat(relatedEdges),
      allEdges: allPrereqEdges.concat(relatedEdges),
      prereqEdgeCount: prereqEdges.length,
      byId: byId
    };
  }

  function renderGraphSVG(layout, selectedId) {
    if (!layout || !layout.nodes.length) {
      return '<div class="empty-state">' +
        '<p class="empty-title">当前分支还没有概念</p>' +
        '<p class="empty-text">在 state.concepts 中补充概念后，这里会生成先修关系图。</p>' +
        '</div>';
    }
    var selected = selectedId && layout.byId.has(selectedId) ? selectedId : '';
    var edges = layout.edges.map(function (edge) {
      var cls = edge.type === 'prereq' ? 'graph-edge edge-prereq' : 'graph-edge edge-related';
      var marker = edge.type === 'prereq' ? ' marker-end="url(#lh-arrow)"' : '';
      return '<path class="' + cls + '" data-from="' + esc(edge.from) + '" data-to="' + esc(edge.to) +
        '" d="' + edge.path + '"' + marker + '></path>';
    }).join('');

    var nodes = layout.nodes.map(function (node) {
      var m = clampMastery(node.mastery);
      var isSelected = node.id === selected;
      var label = node.lines.map(function (line, index) {
        return '<tspan x="0" y="' + (38 + index * 13) + '">' + esc(line) + '</tspan>';
      }).join('');
      var longest = node.lines.reduce(function (max, line) { return Math.max(max, line.length); }, 1);
      var bgWidth = Math.min(96, longest * 10.6 + 8);
      var bgHeight = 15 + (node.lines.length - 1) * 13;
      return '<g class="graph-node m' + m + (isSelected ? ' is-selected' : '') + '" data-concept-id="' + esc(node.id) +
        '" transform="translate(' + node.x.toFixed(1) + ' ' + node.y.toFixed(1) + ')" tabindex="0" role="button"' +
        ' aria-label="' + esc(node.concept.name + '，掌握度 ' + m + ' / 5，按回车查看详情') + '">' +
        '<circle class="node-halo" r="20"></circle>' +
        '<circle class="node-disc" r="16"></circle>' +
        '<text class="node-level" text-anchor="middle" y="4">' + m + '</text>' +
        '<rect class="node-label-bg" x="' + (-bgWidth / 2).toFixed(1) + '" y="28" width="' +
        bgWidth.toFixed(1) + '" height="' + bgHeight + '" rx="3.5"></rect>' +
        '<text class="node-label" text-anchor="middle">' + label + '</text>' +
        '</g>';
    }).join('');

    return '<svg class="concept-graph" viewBox="0 0 ' + layout.width + ' ' + layout.height +
      '" role="group" aria-label="概念图，共 ' + layout.nodes.length + ' 个概念，节点按掌握度着色">' +
      '<defs><marker id="lh-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">' +
      '<path class="arrow-head" d="M0,0 L8,4 L0,8 z"></path></marker></defs>' +
      '<g class="graph-edges" aria-hidden="true">' + edges + '</g>' +
      '<g class="graph-nodes">' + nodes + '</g>' +
      '</svg>';
  }

  /* ------------------------------------------------------------------ *
   * 概念详情
   * ------------------------------------------------------------------ */

  function conceptLinkChips(state, ids, relation) {
    if (!ids.length) return '<span class="muted-text">无</span>';
    return ids.map(function (id) {
      var concept = getConcept(state, id);
      if (!concept) {
        return '<span class="concept-chip is-missing" title="state 中缺少该概念">' + esc(id) + '</span>';
      }
      var branch = concept.branches[0] || '';
      var extra = branch && branch !== state.currentBranch ? '<span class="chip-branch">' + esc(branchName(state, branch)) + '</span>' : '';
      return '<button type="button" class="concept-chip" data-action="open-concept" data-concept-id="' + esc(id) +
        '" title="' + esc(relation + '：' + concept.name) + '">' + esc(concept.name) + extra + '</button>';
    }).join('');
  }

  function renderDetailHTML(state, concept) {
    if (!concept) {
      return '<div class="empty-state">' +
        '<p class="empty-title">选择一个概念</p>' +
        '<p class="empty-text">点击左侧概念或右侧节点，查看掌握度、先修、关联与证据。</p>' +
        '</div>';
    }
    var m = clampMastery(concept.mastery);
    var due = dueStatus(concept.next_review, state.referenceDate);
    var branchNames = concept.branches.map(function (id) { return branchName(state, id); }).join(' · ');
    var aliases = concept.aliases.length
      ? '<p class="detail-aliases">' + concept.aliases.map(esc).join(' / ') + '</p>' : '';
    var evidence = concept.evidence.length
      ? '<ul class="detail-list">' + concept.evidence.map(function (item) {
        return '<li>' + esc(item) + '</li>';
      }).join('') + '</ul>'
      : '<p class="muted-text">尚无证据记录。掌握度只按可追溯证据调整。</p>';
    var misconceptions = concept.misconceptions.length
      ? '<section class="detail-section"><h4>误区</h4><ul class="detail-list is-warn">' +
        concept.misconceptions.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul></section>'
      : '';
    var sources = concept.sources.length
      ? '<section class="detail-section"><h4>来源</h4><p class="detail-text">' + concept.sources.map(esc).join(' · ') + '</p></section>'
      : '';

    return '<div class="detail-head">' +
      '<span class="mastery-orb m' + m + '">' + m + '</span>' +
      '<div class="detail-title"><h3>' + esc(concept.name) + '</h3>' + aliases +
      '<p class="detail-meta">' + esc(branchNames || '未归属分支') + ' · ' + esc(masteryLabel(m)) + '</p></div>' +
      '<button type="button" class="btn btn-small" data-action="record-concept" data-concept-id="' + esc(concept.id) + '">记录</button>' +
      '</div>' +
      '<div class="detail-facts">' +
      '<div class="detail-fact"><span>掌握度</span>' + pips(m) + '<b>' + m + ' / 5</b></div>' +
      '<div class="detail-fact"><span>下次复习</span><b>' + esc(concept.next_review || '未排期') + '</b>' +
      '<span class="due-inline ' + due.key + '">' + esc(due.label) + '</span></div>' +
      '</div>' +
      '<section class="detail-section"><h4>先修</h4><div class="chip-row">' +
      conceptLinkChips(state, concept.prereq, '先修') + '</div></section>' +
      '<section class="detail-section"><h4>关联</h4><div class="chip-row">' +
      conceptLinkChips(state, concept.related, '关联') + '</div></section>' +
      '<section class="detail-section"><h4>证据</h4>' + evidence + '</section>' +
      misconceptions + sources +
      '<p class="detail-id">' + esc(concept.id) + '</p>';
  }

  /* ------------------------------------------------------------------ *
   * 面板 UI
   * ------------------------------------------------------------------ */

  var app = {
    state: null,
    source: '',
    loadInfo: null,
    selectedConceptId: '',
    recordBranch: '',
    searchResults: [],
    activeSearchIndex: -1,
    expandedCourses: new Set(),
    collapsedGroups: new Set(),
    loading: false
  };
  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function setHTML(element, html) {
    if (element) element.innerHTML = html;
  }

  function showToast(message, tone) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.className = 'toast is-visible' + (tone ? ' is-' + tone : '');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      els.toast.className = 'toast';
    }, 4200);
  }

  function fetchJSON(url, options) {
    options = options || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, options.timeout || 8000);
    var init = {
      method: options.method || 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {}
    };
    if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    return fetch(url, init).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        if (text) {
          try { data = JSON.parse(text); } catch (error) { data = null; }
        }
        if (!response.ok) {
          var detail = data && (data.error || data.message) ? ': ' + (data.error || data.message) : '';
          throw new Error('HTTP ' + response.status + detail);
        }
        if (!data) throw new Error('响应不是有效 JSON');
        return data;
      });
    }).catch(function (error) {
      if (error && error.name === 'AbortError') throw new Error('请求超时');
      throw error;
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  function loadState() {
    var injected = root.__LEARNING_HUB_DATA__;
    var isFile = root.location && root.location.protocol === 'file:';
    var apiError = null;
    var sampleError = null;

    function fallback() {
      if (injected && typeof injected === 'object') {
        return { raw: injected, source: 'injected', apiError: apiError, sampleError: sampleError };
      }
      if (BUILTIN_STATE && typeof BUILTIN_STATE === 'object') {
        return { raw: BUILTIN_STATE, source: 'builtin', apiError: apiError, sampleError: sampleError };
      }
      throw new Error('没有可用的内置 fallback 数据');
    }

    if (!isFile) {
      return fetchJSON(API_STATE, { timeout: 6000 }).then(function (raw) {
        return { raw: raw, source: 'api', apiError: null, sampleError: null };
      }).catch(function (error) {
        apiError = error;
        return fetchJSON('./sample-state.json', { timeout: 6000 }).then(function (raw) {
          return { raw: raw, source: 'sample', apiError: apiError, sampleError: null };
        }).catch(function (error2) {
          sampleError = error2;
          return fallback();
        });
      });
    }

    return fetchJSON('./sample-state.json', { timeout: 2500 }).then(function (raw) {
      return { raw: raw, source: 'sample', apiError: null, sampleError: null };
    }).catch(function (error) {
      sampleError = error;
      return fallback();
    });
  }

  function sourceMeta(source) {
    return SOURCE_INFO[source] || SOURCE_INFO.builtin;
  }

  function renderSource() {
    var meta = sourceMeta(app.source);
    if (els.sourceBadge) {
      els.sourceBadge.dataset.tone = meta.tone;
      els.sourceBadge.innerHTML = '<span class="source-dot"></span>' + esc(meta.label);
      els.sourceBadge.title = meta.note + (app.state && app.state.generatedAt ? ' · 生成于 ' + app.state.generatedAt : '');
    }
    var generated = app.state && app.state.generatedAt ? dateTime(app.state.generatedAt) : '未知';
    if (els.dataFootnote) {
      els.dataFootnote.textContent = '数据：' + meta.label + ' · 生成 ' + generated +
        ' · 基准日 ' + (app.state ? app.state.asOf : '—');
    }
    if (els.treeFoot) {
      els.treeFoot.textContent = app.state
        ? '基准日 ' + app.state.asOf + ' · ' + app.state.concepts.length + ' 个概念'
        : '';
    }
  }

  function renderBanner() {
    if (!els.seedBanner) return;
    var state = app.state;
    var isDemo = app.source !== 'api' || (state && state.seed);
    if (!isDemo) {
      els.seedBanner.hidden = true;
      els.seedBanner.innerHTML = '';
      return;
    }
    var title = '';
    var text = '';
    if (app.source === 'sample') {
      title = '样例数据（seed）';
      text = '当前读取 sample-state.json，仅用于离线预览，不代表真实成绩；记录写入需要宿主 API。';
    } else if (app.source === 'builtin') {
      title = '内置兜底数据（seed）';
      text = '未能读取 sample-state.json，已使用内置演示数据，不代表真实成绩。';
    } else if (app.source === 'injected') {
      title = '注入的演示数据';
      text = '当前使用 window.__LEARNING_HUB_DATA__ 注入数据，提交记录会尝试写入宿主 API。';
    } else {
      title = '宿主返回 seed 样例';
      text = '当前 state 标记为 seed，仅用于界面演示，不代表真实成绩。';
    }
    var errors = [];
    if (app.loadInfo && app.loadInfo.apiError) errors.push('state API 不可用');
    if (app.loadInfo && app.loadInfo.sampleError) errors.push('sample-state.json 不可用');
    var detail = errors.length ? ' · ' + errors.join(' / ') : '';
    els.seedBanner.hidden = false;
    els.seedBanner.innerHTML = '<span class="banner-mark" aria-hidden="true">!</span>' +
      '<span class="banner-copy"><strong>' + esc(title) + '</strong><span>' + esc(text + detail) + '</span></span>' +
      '<span class="banner-meta">' + (state ? '基准日 ' + esc(state.asOf) : '') + '</span>';
  }

  function renderProfile() {
    if (!app.state || !els.learnerCard) return;
    var profile = app.state.profile;
    var initial = profile.name ? profile.name.slice(0, 1) : '学';
    var meta = [profile.stage, profile.major].filter(Boolean).join(' · ') || '学习档案';
    var goal = profile.goals[0] || '';
    setHTML(els.learnerCard,
      '<div class="learner-head">' +
      '<span class="avatar" aria-hidden="true">' + esc(initial) + '</span>' +
      '<div class="learner-id"><p class="learner-name">' + esc(profile.name) +
      (app.state.seed ? '<span class="seed-chip">SEED</span>' : '') + '</p>' +
      '<p class="learner-meta">' + esc(meta) + '</p></div></div>' +
      (goal ? '<p class="learner-goal" title="' + esc(profile.goals.join('；')) + '"><span>目标</span>' + esc(goal) + '</p>' : ''));
  }

  function renderTree() {
    if (!app.state || !els.branchTree) return;
    var state = app.state;
    var groups = [];
    var groupMap = new Map();
    state.branches.forEach(function (branch) {
      var key = branch.parent || 'other';
      if (!groupMap.has(key)) {
        var group = { key: key, name: groupLabel(key), branches: [] };
        groupMap.set(key, group);
        groups.push(group);
      }
      groupMap.get(key).branches.push(branch);
    });
    groups.sort(function (a, b) {
      var rank = { math: 0, cs: 1, ee: 2, eng: 3 };
      return (rank[a.key] === undefined ? 9 : rank[a.key]) - (rank[b.key] === undefined ? 9 : rank[b.key]) ||
        a.name.localeCompare(b.name, 'zh-Hans-CN');
    });

    var html = groups.map(function (group) {
      var collapsed = app.collapsedGroups.has(group.key);
      var body = group.branches.map(renderCourse).join('');
      return '<section class="tree-group">' +
        '<button type="button" class="tree-group-head" data-action="toggle-group" data-group="' + esc(group.key) +
        '" aria-expanded="' + (!collapsed) + '">' +
        '<svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"></path></svg>' +
        '<span class="tree-group-name">' + esc(group.name) + '</span>' +
        '<span class="tree-group-count">' + group.branches.length + '</span></button>' +
        '<div class="tree-group-body"' + (collapsed ? ' hidden' : '') + '>' + body + '</div>' +
        '</section>';
    }).join('');
    setHTML(els.branchTree, html || '<p class="muted-text">没有分支数据。</p>');
    updateCollapseButton();
  }

  function renderCourse(branch) {
    var state = app.state;
    var isCurrent = branch.id === state.currentBranch;
    var expanded = app.expandedCourses.has(branch.id);
    var avg = Number.isFinite(branch.masteryAvg) ? branch.masteryAvg : 0;
    var meterWidth = Math.max(0, Math.min(100, (avg / 5) * 100));
    var dueCount = Number.isFinite(branch.dueCount) ? branch.dueCount : branch.dueList.length;
    var concepts = branch.conceptList.map(function (concept) {
      var isSelected = concept.id === app.selectedConceptId;
      var isDue = branch.dueList.some(function (d) { return d.conceptId === concept.id; });
      var isWeak = branch.weakList.some(function (w) { return w.conceptId === concept.id; });
      return '<button type="button" class="tree-concept' + (isSelected ? ' is-selected' : '') +
        '" data-action="select-concept" data-concept-id="' + esc(concept.id) + '" data-branch="' + esc(branch.id) + '">' +
        masteryChip(concept.mastery, 'mini') +
        '<span class="tree-concept-name">' + esc(concept.name) + '</span>' +
        (isWeak ? '<span class="tree-tag weak">弱</span>' : '') +
        (isDue ? '<span class="due-dot" title="已排入复习"></span>' : '') +
        '</button>';
    }).join('');

    return '<article class="tree-course' + (isCurrent ? ' is-current' : '') + '">' +
      '<div class="course-row">' +
      '<button type="button" class="twisty" data-action="toggle-course" data-branch="' + esc(branch.id) +
      '" aria-expanded="' + expanded + '" aria-label="' + (expanded ? '收起' : '展开') + esc(branch.name) + '的概念">' +
      '<svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"></path></svg></button>' +
      '<button type="button" class="course-pick" data-action="select-branch" data-branch="' + esc(branch.id) + '">' +
      '<span class="course-title"><span class="status-dot" data-status="' + esc(branch.status) + '"></span>' +
      '<span class="course-name">' + esc(branch.name) + '</span>' +
      (isCurrent ? '<span class="current-chip">当前</span>' : '') + '</span>' +
      '<span class="course-next">' + esc(branch.next || '未设置下一步') + '</span>' +
      '<span class="course-meter" aria-hidden="true"><span style="width:' + meterWidth.toFixed(1) + '%"></span></span>' +
      '<span class="course-figures"><span>' + avg.toFixed(1) + ' / 5</span><span>' + dueCount + ' 待复习</span></span>' +
      '</button></div>' +
      '<div class="course-concepts"' + (expanded ? '' : ' hidden') + '>' + concepts +
      (branch.conceptList.length ? '' : '<p class="muted-text tree-empty">暂无概念</p>') + '</div>' +
      '</article>';
  }

  function updateCollapseButton() {
    if (!els.collapseTree) return;
    var anyExpanded = app.expandedCourses.size > 0 || app.collapsedGroups.size === 0;
    els.collapseTree.textContent = anyExpanded ? '全部收起' : '全部展开';
    els.collapseTree.setAttribute('aria-label', anyExpanded ? '收起所有分支的概念' : '展开所有分支的概念');
  }

  function renderHero(stats) {
    if (!els.branchHero) return;
    var branch = stats.branch;
    setHTML(els.branchHero,
      '<div class="hero-copy">' +
      '<p class="eyebrow">当前分支 · ' + esc(groupLabel(branch.parent)) + '</p>' +
      '<div class="hero-title-row"><h1>' + esc(branch.name) + '</h1>' +
      '<span class="status-pill" data-status="' + esc(branch.status) + '"><span class="status-dot"></span>' +
      esc(statusLabel(branch.status)) + '</span></div>' +
      '<p class="hero-next">' + esc(branch.next || '尚未设置 next 字段') + '</p>' +
      '<div class="hero-meta"><span>' + stats.conceptCount + ' 个概念</span><span>平均 ' + stats.avg.toFixed(1) +
      ' / 5</span><span>' + stats.dueCount + ' 条待复习</span>' +
      (branch.workspace ? '<span class="mono">' + esc(branch.workspace) + '</span>' : '') + '</div>' +
      '</div>' +
      '<div class="hero-side"><span class="hero-side-label">已接触</span>' +
      '<strong>' + stats.touched + '<em>/' + stats.listCount + '</em></strong>' +
      '<span class="hero-side-label">薄弱 ' + stats.weakCount + '</span></div>');
  }

  function renderNext(stats) {
    if (!els.nextCard) return;
    setHTML(els.nextCard,
      '<span class="next-mark" aria-hidden="true">→</span>' +
      '<div class="next-copy"><p class="eyebrow">下一步</p><h2>' + esc(stats.branch.next || '尚未设置下一步') + '</h2>' +
      '<p class="next-note">完成后记录一条证据；掌握度只按可追溯的作业、路径或会话调整。</p></div>' +
      '<button type="button" class="btn" data-action="focus-record">记录进度</button>');
  }

  function iconSvg(name) {
    var icons = {
      gauge: '<path d="M3 13a9 9 0 1 1 18 0"></path><path d="M12 13l4-4"></path><circle cx="12" cy="13" r="1.4"></circle>',
      check: '<circle cx="12" cy="12" r="8"></circle><path d="M8.5 12.2 11 14.7l4.7-4.9"></path>',
      alert: '<path d="M12 4 3.5 19h17L12 4Z"></path><path d="M12 9v4"></path><circle cx="12" cy="16.3" r=".7"></circle>',
      clock: '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7v5.4l3.2 2"></path>'
    };
    return '<svg class="kpi-icon" viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || '') + '</svg>';
  }

  function renderKpis(stats) {
    if (!els.kpis) return;
    var dueSub = stats.overdue ? stats.overdue + ' 个已逾期' : (stats.today ? stats.today + ' 个今天到期' : '暂无逾期');
    setHTML(els.kpis,
      '<article class="kpi"><span class="kpi-glyph">' + iconSvg('gauge') + '</span>' +
      '<p class="kpi-label">掌握均值</p><p class="kpi-value">' + stats.avg.toFixed(1) + '<span> / 5</span></p>' +
      '<p class="kpi-sub">基于 ' + stats.listCount + ' 个概念</p></article>' +
      '<article class="kpi"><span class="kpi-glyph">' + iconSvg('check') + '</span>' +
      '<p class="kpi-label">已接触</p><p class="kpi-value">' + stats.touched + '<span> / ' + stats.listCount + '</span></p>' +
      '<p class="kpi-sub">掌握度 ≥ 1</p></article>' +
      '<article class="kpi"><span class="kpi-glyph">' + iconSvg('alert') + '</span>' +
      '<p class="kpi-label">薄弱概念</p><p class="kpi-value">' + stats.weakCount + '<span> 个</span></p>' +
      '<p class="kpi-sub">优先补证据与订正</p></article>' +
      '<article class="kpi"><span class="kpi-glyph">' + iconSvg('clock') + '</span>' +
      '<p class="kpi-label">待复习</p><p class="kpi-value">' + stats.dueCount + '<span> 条</span></p>' +
      '<p class="kpi-sub">' + dueSub + '</p></article>');
  }

  function renderMastery(stats) {
    if (!els.masteryCard) return;
    var total = stats.listCount || 1;
    var segments = stats.distribution.map(function (count, mastery) {
      if (!count) return '';
      return '<span class="dist-seg m' + mastery + '" style="width:' + ((count / total) * 100).toFixed(2) +
        '%" title="' + masteryLabel(mastery) + '：' + count + ' 个"></span>';
    }).join('');
    var items = stats.distribution.map(function (count, mastery) {
      return '<div class="dist-item"><span class="swatch m' + mastery + '"></span>' +
        '<span class="dist-label"><b>' + mastery + '</b> ' + masteryLabel(mastery) + '</span>' +
        '<span class="dist-count">' + count + '</span></div>';
    }).join('');
    setHTML(els.masteryCard,
      '<div class="panel-head"><div><h2>掌握度总览</h2>' +
      '<p class="panel-sub">0 未接触 → 5 能讲明白 · 当前分支</p></div>' +
      '<span class="mastery-total">' + stats.avg.toFixed(1) + '<em> / 5</em></span></div>' +
      '<div class="stacked-bar" role="img" aria-label="掌握度分布">' + segments + '</div>' +
      '<div class="dist-grid">' + items + '</div>');
  }

  function renderWeak(stats) {
    if (!els.weakCard) return;
    var rows = stats.weak.map(function (item) {
      return '<button type="button" class="list-row" data-action="open-concept" data-concept-id="' + esc(item.conceptId) + '">' +
        masteryChip(item.mastery) +
        '<span class="list-main"><span class="row-title">' + esc(item.name) + '</span>' +
        '<span class="row-sub">' + esc(item.reasons.slice(0, 2).join(' · ')) + '</span></span>' +
        '<span class="row-arrow" aria-hidden="true">›</span></button>';
    }).join('');
    setHTML(els.weakCard,
      '<div class="panel-head"><div><h2>薄弱概念</h2><p class="panel-sub">来自 state.weak_concepts</p></div>' +
      '<span class="count-chip">' + stats.weakCount + '</span></div>' +
      (rows ? '<div class="list">' + rows + '</div>' :
        '<div class="empty-state compact"><p class="empty-title">暂无薄弱概念</p><p class="empty-text">保持记录，薄弱项会被自动标出。</p></div>'));
  }

  function renderDue(stats) {
    if (!els.dueCard) return;
    var rows = stats.due.slice(0, 6).map(function (item) {
      var status = dueStatus(item.next_review, app.state.referenceDate);
      var d = parseDate(item.next_review);
      return '<button type="button" class="list-row due-row" data-action="open-concept" data-concept-id="' + esc(item.conceptId) + '">' +
        '<span class="date-tile"><strong>' + (d ? String(d.getDate()).padStart(2, '0') : '—') + '</strong>' +
        '<span>' + (d ? (d.getMonth() + 1) + '月' : '') + '</span></span>' +
        '<span class="list-main"><span class="row-title">' + esc(item.name) + '</span>' +
        '<span class="row-sub">掌握度 ' + item.mastery + ' / 5 · ' + esc(item.next_review) + '</span></span>' +
        '<span class="due-status ' + status.key + '">' + esc(status.label) + '</span></button>';
    }).join('');
    var extra = stats.dueCount > stats.due.length
      ? '<p class="panel-foot">另有 ' + (stats.dueCount - stats.due.length) + ' 条未显示</p>' : '';
    setHTML(els.dueCard,
      '<div class="panel-head"><div><h2>到期复习</h2><p class="panel-sub">逾期 / 今天 / 7 天内</p></div>' +
      '<span class="count-chip">' + stats.dueCount + '</span></div>' +
      (rows ? '<div class="list">' + rows + '</div>' + extra :
        '<div class="empty-state compact"><p class="empty-title">暂无到期复习</p><p class="empty-text">下次复习排期会显示在这里。</p></div>'));
  }

  function renderActivity() {
    if (!els.activityCard) return;
    var state = app.state;
    var items = state.activity.slice(0, 8).map(function (item) {
      var branch = item.branch ? branchName(state, item.branch) : '未归属';
      var unit = item.conceptId
        ? '<button type="button" class="activity-unit" data-action="open-concept" data-concept-id="' +
          esc(item.conceptId) + '">' + esc(item.unit || item.conceptId) + '</button>'
        : '<span class="activity-unit is-static">' + esc(item.unit || '未命名单元') + '</span>';
      return '<article class="activity-item">' +
        '<span class="activity-dot" data-action="' + esc(item.action) + '" aria-hidden="true"></span>' +
        '<div class="activity-main"><div class="activity-top">' + unit +
        '<span class="action-badge" data-action="' + esc(item.action) + '">' + esc(actionLabel(item.action)) + '</span>' +
        '<span class="activity-branch">' + esc(branch) + '</span></div>' +
        (item.evidence ? '<p class="activity-evidence">' + esc(item.evidence) + '</p>' : '') + '</div>' +
        '<div class="activity-side"><time datetime="' + esc(item.ts) + '">' + esc(activityTime(item.ts)) + '</time>' +
        pips(item.mastery) + '</div></article>';
    }).join('');
    setHTML(els.activityCard,
      '<div class="panel-head"><div><h2>最近活动</h2><p class="panel-sub">progress.jsonl 审计流 · 最近 ' +
      Math.min(8, state.activity.length) + ' 条</p></div>' +
      '<span class="count-chip">' + state.activity.length + '</span></div>' +
      (items ? '<div class="activity-list">' + items + '</div>' :
        '<div class="empty-state compact"><p class="empty-title">暂无活动</p><p class="empty-text">提交一条进度后会出现在这里。</p></div>'));
  }

  function renderCenter() {
    var stats = computeStats(app.state, app.state.currentBranch);
    if (!stats) return;
    renderHero(stats);
    renderNext(stats);
    renderKpis(stats);
    renderMastery(stats);
    renderWeak(stats);
    renderDue(stats);
    renderActivity();
  }

  function renderGraph() {
    if (!app.state || !els.graphWrap) return;
    var branch = getBranch(app.state, app.state.currentBranch);
    var layout = buildGraphLayout(branch ? branch.conceptList : []);
    app.graphLayout = layout;
    setHTML(els.graphWrap, renderGraphSVG(layout, app.selectedConceptId));
    if (els.graphMeta) {
      els.graphMeta.textContent = layout.nodes.length + ' 个节点 · ' + layout.prereqEdgeCount +
        ' 条先修边' + (layout.edges.length > layout.prereqEdgeCount ? ' · 关联边选中后显示' : '');
    }
    updateGraphHighlight();
  }

  function updateGraphHighlight() {
    if (!els.graphWrap || !app.graphLayout) return;
    var selected = app.selectedConceptId;
    if (!selected) return;
    var neighbors = new Set([selected]);
    (app.graphLayout.allEdges || app.graphLayout.edges).forEach(function (edge) {
      if (edge.from === selected) neighbors.add(edge.to);
      if (edge.to === selected) neighbors.add(edge.from);
    });
    var nodes = els.graphWrap.querySelectorAll('.graph-node');
    Array.prototype.forEach.call(nodes, function (node) {
      var id = node.getAttribute('data-concept-id');
      node.classList.toggle('is-selected', id === selected);
      node.classList.toggle('is-neighbor', id !== selected && neighbors.has(id));
      node.classList.toggle('is-muted', id !== selected && !neighbors.has(id));
    });
    var edges = els.graphWrap.querySelectorAll('.graph-edge');
    Array.prototype.forEach.call(edges, function (edge) {
      var hot = edge.getAttribute('data-from') === selected || edge.getAttribute('data-to') === selected;
      edge.classList.toggle('is-hot', hot);
      edge.classList.toggle('is-muted', !hot);
    });
  }

  function renderDetail() {
    if (!els.detail) return;
    var concept = app.selectedConceptId ? getConcept(app.state, app.selectedConceptId) : null;
    setHTML(els.detail, renderDetailHTML(app.state, concept));
  }

  function defaultConceptForBranch(branchId) {
    var state = app.state;
    var weak = state.weak.find(function (w) { return w.branch === branchId; });
    if (weak) return weak.conceptId;
    var due = state.due.find(function (d) { return d.branch === branchId; });
    if (due) return due.conceptId;
    var branch = getBranch(state, branchId);
    return branch && branch.conceptList[0] ? branch.conceptList[0].id : '';
  }

  function renderAll() {
    renderSource();
    renderProfile();
    renderBanner();
    renderTree();
    renderCenter();
    renderGraph();
    renderDetail();
    syncRecordForm();
    renderFooter();
  }

  function renderFooter() {
    if (!els.appFootnote) return;
    var meta = sourceMeta(app.source);
    els.appFootnote.textContent = '学习中枢 v0.1 · 静态面板 · 无 CDN / 无外部字体 · 数据源：' + meta.label;
  }

  function ensureDetailVisible() {
    if (!els.detail || !els.detail.scrollIntoView) return;
    var rect = els.detail.getBoundingClientRect();
    var viewport = root.innerHeight || 900;
    if (rect.top > viewport - 96 || rect.bottom < 80) {
      try {
        els.detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        els.detail.scrollIntoView();
      }
    }
  }

  function selectBranch(branchId, options) {
    options = options || {};
    var branch = getBranch(app.state, branchId);
    if (!branch) return;
    app.state.currentBranch = branchId;
    app.expandedCourses.add(branchId);
    app.collapsedGroups.delete(branch.parent || 'other');
    if (!options.keepConcept || !app.selectedConceptId) {
      app.selectedConceptId = defaultConceptForBranch(branchId);
    }
    var selected = getConcept(app.state, app.selectedConceptId);
    if (!selected || selected.branches.indexOf(branchId) === -1) {
      app.selectedConceptId = defaultConceptForBranch(branchId);
    }
    renderTree();
    renderCenter();
    renderGraph();
    renderDetail();
    if (options.reveal) ensureDetailVisible();
  }

  function selectConcept(conceptId, options) {
    options = options || {};
    var concept = getConcept(app.state, conceptId);
    if (!concept) return;
    var branchId = concept.branches.indexOf(app.state.currentBranch) !== -1
      ? app.state.currentBranch
      : (concept.branches[0] || app.state.currentBranch);
    if (branchId !== app.state.currentBranch) {
      app.state.currentBranch = branchId;
      app.expandedCourses.add(branchId);
      app.collapsedGroups.delete((getBranch(app.state, branchId) || {}).parent || 'other');
      app.selectedConceptId = conceptId;
      renderTree();
      renderCenter();
      renderGraph();
      renderDetail();
    } else {
      app.selectedConceptId = conceptId;
      renderTree();
      updateGraphHighlight();
      renderDetail();
    }
    if (options.reveal !== false) ensureDetailVisible();
  }

  function openConcept(conceptId) {
    selectConcept(conceptId, { reveal: true });
  }

  /* ---------------------------- 复习表单 ---------------------------- */

  function currentRecordBranch() {
    if (app.recordBranch && getBranch(app.state, app.recordBranch)) return app.recordBranch;
    return app.state.currentBranch;
  }

  function populateUnitOptions(branchId, preferredId) {
    if (!els.recordUnit) return;
    var branch = getBranch(app.state, branchId);
    var concepts = branch ? branch.conceptList : [];
    var options = concepts.map(function (concept) {
      return '<option value="' + esc(concept.id) + '">' + esc(concept.name) + ' · ' + concept.mastery + '/5</option>';
    }).join('');
    els.recordUnit.innerHTML = options || '<option value="">暂无概念</option>';
    var preferred = preferredId && concepts.some(function (c) { return c.id === preferredId; })
      ? preferredId
      : (app.selectedConceptId && concepts.some(function (c) { return c.id === app.selectedConceptId; })
        ? app.selectedConceptId
        : (concepts[0] ? concepts[0].id : ''));
    if (preferred) els.recordUnit.value = preferred;
    updateMasteryFromUnit();
    updateRecordHint();
  }

  function updateMasteryFromUnit() {
    if (!els.recordUnit || !els.recordForm) return;
    var concept = getConcept(app.state, els.recordUnit.value);
    if (!concept) return;
    var input = els.recordForm.querySelector('input[name="record-mastery"][value="' + concept.mastery + '"]');
    if (input) input.checked = true;
  }

  function updateRecordHint() {
    if (!els.recordHint) return;
    var branch = getBranch(app.state, currentRecordBranch());
    var concept = getConcept(app.state, els.recordUnit ? els.recordUnit.value : '');
    if (concept) {
      els.recordHint.textContent = '将记录：' + (branch ? branch.name : '') + ' · ' + concept.name +
        ' · 当前掌握度 ' + concept.mastery + '/5。证据必填。';
    } else {
      els.recordHint.textContent = '证据必填，例如「calculus/homework-3 Q2」或本地路径。';
    }
  }

  function syncRecordForm() {
    if (!app.state || !els.recordBranch) return;
    var branchId = currentRecordBranch();
    if (els.recordBranch.options.length !== app.state.branches.length) {
      els.recordBranch.innerHTML = app.state.branches.map(function (branch) {
        return '<option value="' + esc(branch.id) + '">' + esc(branch.name) + '</option>';
      }).join('');
    }
    els.recordBranch.value = branchId;
    populateUnitOptions(branchId);
  }

  function setRecordStatus(tone, message) {
    if (!els.recordStatus) return;
    els.recordStatus.hidden = !message;
    els.recordStatus.className = 'record-status' + (tone ? ' is-' + tone : '');
    els.recordStatus.textContent = message || '';
  }

  function submitRecord(event) {
    event.preventDefault();
    if (!app.state) return;
    var branchId = els.recordBranch.value;
    var concept = getConcept(app.state, els.recordUnit.value);
    var action = els.recordAction.value;
    var masteryInput = els.recordForm.querySelector('input[name="record-mastery"]:checked');
    var mastery = masteryInput ? Number(masteryInput.value) : (concept ? concept.mastery : 0);
    var evidence = els.recordEvidence.value.trim();
    var note = els.recordNote.value.trim();
    if (!branchId || !concept) {
      setRecordStatus('error', '请选择分支和概念单元。');
      return;
    }
    if (!evidence) {
      setRecordStatus('error', '请填写可追溯的证据（作业、路径或会话），不接受“感觉会了”。');
      els.recordEvidence.focus();
      return;
    }
    var payload = {
      branch: branchId,
      unit: concept.name,
      action: action,
      mastery: clampMastery(mastery),
      evidence: evidence
    };
    if (note) payload.note = note;
    setRecordStatus('pending', '正在提交到 /api/learning-hub/record …');
    els.recordSubmit.disabled = true;
    els.recordSubmit.textContent = '提交中…';
    fetchJSON(API_RECORD, { method: 'POST', body: payload, timeout: 10000 }).then(function (result) {
      var message = result && (result.message || result.ok === true) ? '已记录。' : '已记录。';
      setRecordStatus('success', '已提交：' + branchName(app.state, branchId) + ' · ' + concept.name +
        ' · ' + actionLabel(action) + '（' + clampMastery(mastery) + '/5）。' + message);
      showToast('进度已记录', 'success');
      els.recordEvidence.value = '';
      els.recordNote.value = '';
      if (app.source === 'api') {
        refreshState({ quiet: true }).catch(function () {
          setRecordStatus('success', '已提交，但刷新最新 state 失败；可稍后点右上角重新载入。');
        });
      }
    }).catch(function (error) {
      var suffix = root.location && root.location.protocol === 'file:'
        ? '（file:// 预览无法调用写入接口）' : '';
      setRecordStatus('error', '提交失败：' + (error.message || '未知错误') + suffix + '。表单内容已保留。');
      showToast('提交失败，表单已保留', 'error');
    }).finally(function () {
      els.recordSubmit.disabled = false;
      els.recordSubmit.textContent = '提交进度';
    });
  }

  /* ---------------------------- 搜索 ---------------------------- */

  function searchConcepts(query) {
    var q = str(query).trim().toLowerCase();
    if (!q) return [];
    var state = app.state;
    var results = [];
    state.concepts.forEach(function (concept) {
      var branches = concept.branches.map(function (id) { return branchName(state, id); }).join(' ');
      var haystack = [concept.name, concept.id, concept.aliases.join(' '), branches].join(' ').toLowerCase();
      if (haystack.indexOf(q) === -1) return;
      var score = 5;
      if (concept.name.toLowerCase().indexOf(q) === 0) score = 0;
      else if (concept.name.toLowerCase().indexOf(q) !== -1) score = 1;
      else if (concept.aliases.some(function (a) { return a.toLowerCase().indexOf(q) !== -1; })) score = 2;
      else if (concept.id.toLowerCase().indexOf(q) !== -1) score = 3;
      results.push({ concept: concept, score: score });
    });
    results.sort(function (a, b) {
      return a.score - b.score || a.concept.name.localeCompare(b.concept.name, 'zh-Hans-CN');
    });
    return results.slice(0, 8).map(function (item) { return item.concept; });
  }

  function renderSearchResults() {
    if (!els.searchInput || !els.searchResults) return;
    var query = els.searchInput.value.trim();
    if (!query) {
      closeSearchResults();
      return;
    }
    app.searchResults = searchConcepts(query);
    app.activeSearchIndex = app.searchResults.length ? 0 : -1;
    if (!app.searchResults.length) {
      els.searchResults.hidden = false;
      els.searchResults.innerHTML = '<p class="search-empty">没有匹配的概念。可搜索中文名、别名或 ID。</p>';
    } else {
      els.searchResults.hidden = false;
      els.searchResults.innerHTML = app.searchResults.map(function (concept, index) {
        var branch = concept.branches.map(function (id) { return branchName(app.state, id); }).join(' / ');
        return '<button type="button" role="option" id="search-opt-' + index + '" data-action="search-pick" data-concept-id="' +
          esc(concept.id) + '" class="search-result' + (index === app.activeSearchIndex ? ' is-active' : '') + '">' +
          masteryChip(concept.mastery, 'mini') +
          '<span class="search-result-main"><span class="search-result-name">' + esc(concept.name) + '</span>' +
          '<span class="search-result-meta">' + esc(branch) + ' · ' + esc(concept.id) + '</span></span>' +
          '<span class="search-score">' + concept.mastery + '/5</span></button>';
      }).join('');
    }
    els.searchInput.setAttribute('aria-expanded', 'true');
    updateSearchActive();
  }

  function updateSearchActive() {
    if (!els.searchResults) return;
    var nodes = els.searchResults.querySelectorAll('.search-result');
    Array.prototype.forEach.call(nodes, function (node, index) {
      node.classList.toggle('is-active', index === app.activeSearchIndex);
      node.setAttribute('aria-selected', index === app.activeSearchIndex ? 'true' : 'false');
    });
    if (app.activeSearchIndex >= 0 && els.searchInput) {
      els.searchInput.setAttribute('aria-activedescendant', 'search-opt-' + app.activeSearchIndex);
    } else if (els.searchInput) {
      els.searchInput.removeAttribute('aria-activedescendant');
    }
  }

  function closeSearchResults() {
    if (els.searchResults) {
      els.searchResults.hidden = true;
      els.searchResults.innerHTML = '';
    }
    if (els.searchInput) {
      els.searchInput.setAttribute('aria-expanded', 'false');
      els.searchInput.removeAttribute('aria-activedescendant');
    }
    app.searchResults = [];
    app.activeSearchIndex = -1;
  }

  function pickSearchResult(index) {
    var concept = app.searchResults[index];
    if (!concept) return;
    els.searchInput.value = '';
    closeSearchResults();
    openConcept(concept.id);
    if (els.searchInput) els.searchInput.blur();
  }

  /* ---------------------------- 数据加载与事件 ---------------------------- */

  function chooseInitialState(normalized, previous) {
    if (previous) {
      if (previous.branch && getBranch(normalized, previous.branch)) normalized.currentBranch = previous.branch;
      if (previous.concept && getConcept(normalized, previous.concept)) app.selectedConceptId = previous.concept;
    }
    var branch = getBranch(normalized, normalized.currentBranch) || normalized.branches[0];
    normalized.currentBranch = branch.id;
    app.expandedCourses.add(branch.id);
    var selected = app.selectedConceptId ? getConcept(normalized, app.selectedConceptId) : null;
    if (!selected || selected.branches.indexOf(branch.id) === -1) {
      app.selectedConceptId = defaultConceptForBranch(branch.id);
    }
    app.recordBranch = branch.id;
  }

  function refreshState(options) {
    options = options || {};
    var previous = {
      branch: app.state ? app.state.currentBranch : '',
      concept: app.selectedConceptId
    };
    return loadState().then(function (loaded) {
      var normalized = normalizeState(loaded.raw, { source: loaded.source });
      normalized.source = loaded.source;
      app.state = normalized;
      app.source = loaded.source;
      app.loadInfo = loaded;
      chooseInitialState(normalized, options.preserve === false ? null : previous);
      renderAll();
      return normalized;
    });
  }

  function loadAndRender() {
    app.loading = true;
    if (els.app) els.app.setAttribute('aria-busy', 'true');
    var previous = app.state ? { branch: app.state.currentBranch, concept: app.selectedConceptId } : null;
    return loadState().then(function (loaded) {
      var normalized = normalizeState(loaded.raw, { source: loaded.source });
      normalized.source = loaded.source;
      app.state = normalized;
      app.source = loaded.source;
      app.loadInfo = loaded;
      app.selectedConceptId = '';
      chooseInitialState(normalized, previous);
      renderAll();
      app.loading = false;
      if (els.app) els.app.removeAttribute('aria-busy');
      document.body.classList.add('is-ready');
    }).catch(function (error) {
      app.loading = false;
      if (els.app) els.app.removeAttribute('aria-busy');
      showFatal(error);
    });
  }

  function showFatal(error) {
    if (els.sourceBadge) {
      els.sourceBadge.dataset.tone = 'error';
      els.sourceBadge.innerHTML = '<span class="source-dot"></span>载入失败';
    }
    var message = '<div class="fatal-state"><h2>面板数据载入失败</h2><p>' +
      esc(error && error.message ? error.message : String(error)) + '</p>' +
      '<p class="muted-text">请确认 sample-state.json 与内置 fallback 都可用，或让宿主提供 /api/learning-hub/state。</p></div>';
    ['branchHero', 'nextCard', 'kpis', 'masteryCard', 'weakCard', 'dueCard', 'activityCard', 'graphWrap', 'detail'].forEach(function (key) {
      if (els[key]) els[key].innerHTML = key === 'branchHero' ? message : '';
    });
  }

  function bindEvents() {
    if (els.reloadBtn) {
      els.reloadBtn.addEventListener('click', function () {
        showToast('正在重新载入数据…');
        loadAndRender();
      });
    }
    if (els.branchTree) {
      els.branchTree.addEventListener('click', function (event) {
        var toggleGroup = event.target.closest('[data-action="toggle-group"]');
        if (toggleGroup) {
          var group = toggleGroup.getAttribute('data-group');
          if (app.collapsedGroups.has(group)) app.collapsedGroups.delete(group);
          else app.collapsedGroups.add(group);
          renderTree();
          return;
        }
        var toggleCourse = event.target.closest('[data-action="toggle-course"]');
        if (toggleCourse) {
          var branchId = toggleCourse.getAttribute('data-branch');
          if (app.expandedCourses.has(branchId)) app.expandedCourses.delete(branchId);
          else app.expandedCourses.add(branchId);
          renderTree();
          return;
        }
        var branchPick = event.target.closest('[data-action="select-branch"]');
        if (branchPick) {
          selectBranch(branchPick.getAttribute('data-branch'));
          return;
        }
        var conceptPick = event.target.closest('[data-action="select-concept"]');
        if (conceptPick) {
          selectConcept(conceptPick.getAttribute('data-concept-id'));
        }
      });
    }
    if (els.collapseTree) {
      els.collapseTree.addEventListener('click', function () {
        var expanded = app.expandedCourses.size > 0 || app.collapsedGroups.size === 0;
        if (expanded) {
          app.expandedCourses.clear();
          app.state.branches.forEach(function (b) { app.collapsedGroups.add(b.parent || 'other'); });
        } else {
          app.collapsedGroups.clear();
          app.expandedCourses.add(app.state.currentBranch);
        }
        renderTree();
      });
    }
    if (els.recordForm) els.recordForm.addEventListener('submit', submitRecord);
    if (els.recordBranch) {
      els.recordBranch.addEventListener('change', function () {
        app.recordBranch = els.recordBranch.value;
        populateUnitOptions(app.recordBranch);
        setRecordStatus('', '');
      });
    }
    if (els.recordUnit) {
      els.recordUnit.addEventListener('change', function () {
        updateMasteryFromUnit();
        updateRecordHint();
      });
    }
    ['masteryCard', 'weakCard', 'dueCard', 'activityCard', 'detail', 'center'].forEach(function (key) {
      var node = els[key];
      if (!node) return;
      node.addEventListener('click', function (event) {
        var focusRecord = event.target.closest('[data-action="focus-record"]');
        if (focusRecord) {
          focusRecordForm();
          return;
        }
        var recordConcept = event.target.closest('[data-action="record-concept"]');
        if (recordConcept) {
          var concept = getConcept(app.state, recordConcept.getAttribute('data-concept-id'));
          if (concept) {
            app.recordBranch = concept.branches[0] || app.state.currentBranch;
            syncRecordForm();
            els.recordUnit.value = concept.id;
            updateMasteryFromUnit();
            updateRecordHint();
            focusRecordForm();
          }
          return;
        }
        var open = event.target.closest('[data-action="open-concept"]');
        if (open) openConcept(open.getAttribute('data-concept-id'));
      });
    });
    if (els.graphWrap) {
      els.graphWrap.addEventListener('click', function (event) {
        var node = event.target.closest('.graph-node');
        if (node) selectConcept(node.getAttribute('data-concept-id'));
      });
      els.graphWrap.addEventListener('keydown', function (event) {
        var node = event.target.closest('.graph-node');
        if (!node) return;
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          selectConcept(node.getAttribute('data-concept-id'));
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown' ||
            event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          var nodes = Array.prototype.slice.call(els.graphWrap.querySelectorAll('.graph-node'));
          var index = nodes.indexOf(node);
          if (index === -1) return;
          event.preventDefault();
          var next = event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? (index + 1) % nodes.length
            : (index - 1 + nodes.length) % nodes.length;
          nodes[next].focus();
        }
      });
    }
    ['branchHero', 'nextCard'].forEach(function (key) {
      var node = els[key];
      if (!node) return;
      node.addEventListener('click', function (event) {
        if (event.target.closest('[data-action="focus-record"]')) focusRecordForm();
      });
    });
    if (els.searchInput) {
      els.searchInput.addEventListener('input', renderSearchResults);
      els.searchInput.addEventListener('focus', function () {
        if (els.searchInput.value.trim()) renderSearchResults();
      });
      els.searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          closeSearchResults();
          els.searchInput.blur();
          return;
        }
        if (!app.searchResults.length) return;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          app.activeSearchIndex = (app.activeSearchIndex + 1) % app.searchResults.length;
          updateSearchActive();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          app.activeSearchIndex = (app.activeSearchIndex - 1 + app.searchResults.length) % app.searchResults.length;
          updateSearchActive();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          pickSearchResult(app.activeSearchIndex < 0 ? 0 : app.activeSearchIndex);
        }
      });
    }
    if (els.searchResults) {
      els.searchResults.addEventListener('click', function (event) {
        var result = event.target.closest('[data-action="search-pick"]');
        if (!result) return;
        var nodes = Array.prototype.slice.call(els.searchResults.querySelectorAll('.search-result'));
        pickSearchResult(nodes.indexOf(result));
      });
    }
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.search-wrap')) closeSearchResults();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      var tag = (event.target && event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable) return;
      event.preventDefault();
      if (els.searchInput) els.searchInput.focus();
    });
  }

  function setupLayoutToggles() {
    var app = els.app;
    var treeBtn = $('toggle-tree');
    var mapBtn = $('toggle-map');
    var treeCol = $('tree-col');
    var mapCol = $('map-col');
    if (!app || !treeBtn || !mapBtn || !treeCol || !mapCol) return;

    var TREE_KEY = 'learning-hub.tree-collapsed';
    var MAP_KEY = 'learning-hub.map-collapsed';
    function read(key, fallback) {
      try {
        var value = window.localStorage.getItem(key);
        return value === null ? fallback : value === '1';
      } catch (error) {
        return fallback;
      }
    }
    function write(key, value) {
      try { window.localStorage.setItem(key, value ? '1' : '0'); } catch (error) { /* file:// 或隐私模式 */ }
    }
    function setLabel(button, collapsed, openText, closeText) {
      var span = button.querySelector('span');
      if (span) span.textContent = collapsed ? openText : closeText;
    }

    var narrow = false;
    try { narrow = window.matchMedia('(max-width: 900px)').matches; } catch (error) { /* 老环境 */ }
    var treeCollapsed = read(TREE_KEY, narrow);
    var mapCollapsed = read(MAP_KEY, false);

    function apply(persist) {
      app.classList.toggle('is-tree-collapsed', treeCollapsed);
      app.classList.toggle('is-map-collapsed', mapCollapsed);
      treeBtn.setAttribute('aria-expanded', String(!treeCollapsed));
      mapBtn.setAttribute('aria-expanded', String(!mapCollapsed));
      setLabel(treeBtn, treeCollapsed, '展开分叉树', '收起分叉树');
      setLabel(mapBtn, mapCollapsed, '展开概念图', '收起概念图');
      if (persist) {
        write(TREE_KEY, treeCollapsed);
        write(MAP_KEY, mapCollapsed);
      }
    }

    treeBtn.addEventListener('click', function () {
      treeCollapsed = !treeCollapsed;
      apply(true);
    });
    mapBtn.addEventListener('click', function () {
      mapCollapsed = !mapCollapsed;
      apply(true);
    });
    apply(false);
  }

  function focusRecordForm() {
    if (!els.recordCard) return;
    try {
      els.recordCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      els.recordCard.scrollIntoView();
    }
    if (els.recordEvidence) setTimeout(function () { els.recordEvidence.focus({ preventScroll: true }); }, 280);
  }

  function boot() {
    if (boot.started) return;
    boot.started = true;
    els = {
      app: $('app'),
      sourceBadge: $('source-badge'),
      reloadBtn: $('reload-btn'),
      seedBanner: $('seed-banner'),
      dataFootnote: $('data-footnote'),
      learnerCard: $('learner-card'),
      branchTree: $('branch-tree'),
      collapseTree: $('collapse-tree'),
      treeFoot: $('tree-foot'),
      center: $('center'),
      branchHero: $('branch-hero'),
      nextCard: $('next-card'),
      kpis: $('kpis'),
      masteryCard: $('mastery-card'),
      weakCard: $('weak-card'),
      dueCard: $('due-card'),
      activityCard: $('activity-card'),
      recordCard: $('record-card'),
      recordForm: $('record-form'),
      recordBranch: $('record-branch'),
      recordUnit: $('record-unit'),
      recordAction: $('record-action'),
      recordEvidence: $('record-evidence'),
      recordNote: $('record-note'),
      recordStatus: $('record-status'),
      recordSubmit: $('record-submit'),
      recordHint: $('record-hint'),
      graphWrap: $('graph-wrap'),
      graphMeta: $('graph-meta'),
      detail: $('concept-detail'),
      searchInput: $('concept-search'),
      searchResults: $('search-results'),
      toast: $('toast'),
      appFootnote: $('app-footnote')
    };
    setupLayoutToggles();
    bindEvents();
    loadAndRender();
  }

  return {
    boot: boot,
    normalizeState: normalizeState,
    computeStats: computeStats,
    buildGraphLayout: buildGraphLayout,
    renderGraphSVG: renderGraphSVG,
    renderDetailHTML: renderDetailHTML,
    dueStatus: dueStatus,
    wrapLabel: wrapLabel,
    MASTERY_LABELS: MASTERY_LABELS,
    BUILTIN_STATE: BUILTIN_STATE
  };
});
