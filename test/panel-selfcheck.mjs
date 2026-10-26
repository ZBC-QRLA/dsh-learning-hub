// 学习中枢面板自检（零依赖，Node >= 20）
// 运行：node --check public/app.js && node test/panel-selfcheck.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const failures = [];
let checks = 0;

function ok(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const sample = JSON.parse(read('sample-state.json'));
const index = read('index.html');
const css = read('styles.css');
const js = read('app.js');

// The panel is a browser UMD file. Evaluate it with a CommonJS-shaped sandbox
// instead of require(), because this package is "type": "module".
const sandbox = { module: { exports: {} }, exports: {}, console };
sandbox.globalThis = sandbox;
vm.runInNewContext(js, sandbox, { filename: path.join(root, 'app.js') });
const api = sandbox.module.exports;

// 1. canonical state 外形
['schema', 'seed', 'as_of', 'generated_at', 'profile', 'current_branch', 'branches', 'concepts', 'weak_concepts', 'due_reviews', 'recent_activity']
  .forEach((key) => ok(Object.prototype.hasOwnProperty.call(sample, key), 'sample 缺少字段 ' + key));
ok(sample.schema === 'learning-hub.state/v1', 'schema 应为 learning-hub.state/v1');
ok(sample.seed === true, 'sample 必须标注 seed=true');
ok(sample.as_of === '2026-10-26', 'sample as_of 应为 2026-10-26');
ok(sample.branches.length === 3, 'sample 应有 3 个分支，实际 ' + sample.branches.length);
ok(sample.concepts.length >= 28 && sample.concepts.length <= 36, '概念数量应约 30，实际 ' + sample.concepts.length);
ok(sample.weak_concepts.length >= 3 && sample.weak_concepts.length <= 5, 'weak_concepts 应为 3–5，实际 ' + sample.weak_concepts.length);
ok(sample.due_reviews.length >= 6 && sample.due_reviews.length <= 8, 'due_reviews 应为 6–8，实际 ' + sample.due_reviews.length);
ok(sample.recent_activity.length >= 5 && sample.recent_activity.length <= 8, 'recent_activity 应为 5–8，实际 ' + sample.recent_activity.length);

const branchIds = new Set(sample.branches.map((branch) => branch.id));
const conceptIds = new Set(sample.concepts.map((concept) => concept.id));
ok(branchIds.size === sample.branches.length, '分支 id 重复');
ok(conceptIds.size === sample.concepts.length, '概念 id 重复');
ok(branchIds.has(sample.current_branch), 'current_branch 不在 branches 中');
sample.branches.forEach((branch) => {
  ['id', 'name', 'parent', 'status', 'next'].forEach((key) => ok(Object.prototype.hasOwnProperty.call(branch, key), '分支 ' + branch.id + ' 缺少 ' + key));
  ok(Array.isArray(branch.concepts) && branch.concepts.length > 0, '分支 ' + branch.id + ' 没有 concepts');
  ok(branch.concepts.every((id) => conceptIds.has(id)), '分支 ' + branch.id + ' 引用了不存在的概念');
  ok(branch.weak.every((id) => conceptIds.has(id)), '分支 ' + branch.id + ' weak 引用了不存在的概念');
  const dueCount = sample.due_reviews.filter((item) => {
    const concept = sample.concepts.find((c) => c.id === item.concept);
    return concept && concept.branches.includes(branch.id);
  }).length;
  ok(branch.dueCount === dueCount, '分支 ' + branch.id + ' dueCount=' + branch.dueCount + ' 与 due_reviews 实际 ' + dueCount + ' 不一致');
});

sample.concepts.forEach((concept) => {
  ok(concept.branches.length > 0 && concept.branches.every((id) => branchIds.has(id)), '概念 ' + concept.id + ' 分支无效');
  ok(concept.mastery >= 0 && concept.mastery <= 5, '概念 ' + concept.id + ' mastery 越界');
  ok(concept.prereq.every((id) => conceptIds.has(id) && id !== concept.id), '概念 ' + concept.id + ' prereq 无效');
  ok(concept.related.every((id) => conceptIds.has(id) && id !== concept.id), '概念 ' + concept.id + ' related 无效');
  ok(Array.isArray(concept.evidence), '概念 ' + concept.id + ' evidence 不是数组');
});

// 2. 归一化 + 统计 + 三个分支的概念图
const state = api.normalizeState(sample, { source: 'sample' });
ok(state.branches.length === 3, 'normalize 后分支数不为 3');
ok(state.concepts.length === sample.concepts.length, 'normalize 后概念数不一致');
ok(state.currentBranch === sample.current_branch, 'normalize currentBranch 不一致');
ok(state.seed === true, 'normalize 丢失 seed');
ok(state.asOf === '2026-10-26', 'seed 基准日应取 as_of');
ok(api.BUILTIN_STATE && api.BUILTIN_STATE.concepts.length === sample.concepts.length, '内置 fallback 与 sample 概念数不一致');
ok(JSON.stringify(api.BUILTIN_STATE) === JSON.stringify(sample), '内置 fallback 与 sample 内容不同步');

let totalNodes = 0;
let totalPrereq = 0;
state.branches.forEach((branch) => {
  const stats = api.computeStats(state, branch.id);
  ok(stats && stats.conceptCount === branch.conceptIds.length, '分支 ' + branch.id + ' 统计概念数不一致');
  ok(stats.distribution.reduce((sum, n) => sum + n, 0) === branch.conceptIds.length, '分支 ' + branch.id + ' 分布总数不一致');
  ok(stats.avg >= 0 && stats.avg <= 5, '分支 ' + branch.id + ' 平均掌握度越界');

  const layout = api.buildGraphLayout(branch.conceptList);
  ok(layout.nodes.length === branch.conceptList.length, '分支 ' + branch.id + ' 图节点数不一致');
  ok(layout.prereqEdgeCount > 0, '分支 ' + branch.id + ' 没有先修边');
  ok(layout.prereqEdgeCount <= layout.allEdges.length, '分支 ' + branch.id + ' 约简边数异常');
  const svg = api.renderGraphSVG(layout, branch.conceptList[0].id);
  ok(svg.startsWith('<svg'), '分支 ' + branch.id + ' 未生成 SVG');
  ok(svg.includes('node-label-bg'), '分支 ' + branch.id + ' SVG 缺少标签底');
  ok((svg.match(/data-concept-id=/g) || []).length === layout.nodes.length, '分支 ' + branch.id + ' SVG 节点数不一致');
  ok(!svg.includes('undefined') && !svg.includes('NaN'), '分支 ' + branch.id + ' SVG 含 undefined/NaN');
  layout.nodes.forEach((node) => {
    ok(Number.isFinite(node.x) && Number.isFinite(node.y), '节点 ' + node.id + ' 坐标非数字');
    ok(node.x >= 40 && node.x <= 320, '节点 ' + node.id + ' x 越界');
    ok(node.lines.length <= 2, '节点 ' + node.id + ' 标签超过两行');
  });
  const layers = new Map();
  layout.nodes.forEach((node) => {
    if (!layers.has(node.depth)) layers.set(node.depth, []);
    layers.get(node.depth).push(node);
  });
  layers.forEach((nodes, depth) => {
    const xs = nodes.map((node) => node.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) {
      ok(xs[i] - xs[i - 1] >= 70, '分支 ' + branch.id + ' 第 ' + depth + ' 层标签间距不足');
    }
  });
  totalNodes += layout.nodes.length;
  totalPrereq += layout.prereqEdgeCount;
});

const weak = state.weak[0];
const detail = api.renderDetailHTML(state, weak.concept);
ok(detail.includes(weak.concept.name), '详情未包含概念名');
ok(detail.includes('先修') && detail.includes('关联'), '详情缺少先修/关联区');
ok(!detail.includes('undefined'), '详情含 undefined');
ok(api.dueStatus('2026-10-24', state.referenceDate).key === 'overdue', 'dueStatus 逾期判断失败');
ok(api.dueStatus('2026-10-26', state.referenceDate).key === 'today', 'dueStatus 今天判断失败');

// 3. 静态文件边界与依赖
ok(index.includes('./styles.css') && index.includes('./app.js'), 'index 未引用本地样式/脚本');
ok(!/<script[^>]+src=["']https?:/i.test(index), 'index 引用了远程脚本');
ok(!/<link[^>]+href=["']https?:/i.test(index), 'index 引用了远程样式/字体');
ok(!/@import\s+url\(\s*["']?https?:/i.test(css), 'CSS 使用了远程 @import');
ok(!/url\(\s*["']?https?:/i.test(css), 'CSS 引用了远程资源');
ok(!/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com/i.test(index + css + js), '发现常见 CDN 引用');
ok(!/@font-face/.test(css), 'CSS 不应声明外部字体');
ok(index.includes('name="color-scheme"'), 'index 未声明 color-scheme');
ok(css.includes('prefers-color-scheme: dark'), 'CSS 缺少深色媒体查询');
ok(css.includes('[hidden] { display: none !important; }'), 'CSS 缺少 hidden 兜底');
ok(js.includes('/api/learning-hub/state'), 'app.js 缺少 state API');
ok(js.includes('/api/learning-hub/record'), 'app.js 缺少 record API');
ok(js.includes('./sample-state.json'), 'app.js 缺少 sample 回退');
ok(js.includes('__LEARNING_HUB_DATA__'), 'app.js 缺少注入数据支持');

// index 必有 id 与 app.js 读取的 id 对齐
const indexIds = new Set(Array.from(index.matchAll(/\sid="([^"]+)"/g), (match) => match[1]));
ok(indexIds.size === Array.from(index.matchAll(/\sid="([^"]+)"/g)).length, 'index 存在重复 id');
const requiredIds = Array.from(js.matchAll(/\$\('([^']+)'\)/g), (match) => match[1]);
requiredIds.forEach((id) => ok(indexIds.has(id), 'app.js 读取的 #' + id + ' 不在 index.html 中'));

// 4. 汇总
if (failures.length) {
  console.error('selfcheck FAILED (' + failures.length + ' / ' + checks + ')');
  failures.forEach((message) => console.error(' - ' + message));
  process.exit(1);
}
console.log('selfcheck OK');
console.log(' - sample: ' + sample.branches.length + ' 分支 / ' + sample.concepts.length + ' 概念 / ' +
  sample.weak_concepts.length + ' 薄弱 / ' + sample.due_reviews.length + ' 到期 / ' + sample.recent_activity.length + ' 活动');
console.log(' - normalize: 当前 ' + state.currentBranch + '，基准日 ' + state.asOf);
console.log(' - graph: ' + totalNodes + ' 节点 / ' + totalPrereq + ' 条约简先修边');
console.log(' - checks: ' + checks);
