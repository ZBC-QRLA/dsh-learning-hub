/**
 * learning-hub 路由打分（纯函数，零依赖，便于单测）。
 *
 * 输入：用户文本 + cwd + branches + concepts。
 * 输出：{ primary, secondary, confidence, reason, concepts } —— 与 SPEC 2 的
 * route 契约一致。confidence < 0.6 视为低置信，调用方应只问一句确认。
 */

export const LOW_CONFIDENCE_THRESHOLD = 0.6

/** 统一路径分隔符、去掉尾斜杠并转小写（Windows 大小写不敏感）。 */
export function normalizePath(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()
}

/** cwd 是否包含目标路径片段（按路径段边界匹配，避免 “c” 命中 “c++”）。 */
function pathContains(cwd, target) {
  if (!target) return false
  if (cwd === target) return true
  return `/${cwd}/`.includes(`/${target}/`)
}

function round2(value) {
  return Math.round(value * 100) / 100
}

/** 文本里是否出现某个词（拉丁单字符不参与打分，避免噪声）。 */
function textHas(text, term) {
  const needle = String(term ?? '').trim().toLowerCase()
  if (needle.length < 2) return false
  return text.includes(needle)
}

/**
 * 给每个分支打分并给出主/次分支、置信度与理由。
 * @param {{text?: string, cwd?: string, branches?: object[], concepts?: object[]}} input
 * @returns {{primary: string|null, secondary: string[], confidence: number, reason: string, concepts: {id: string, name: string, mastery: number}[]}}
 */
export function scoreBranches(input = {}) {
  const text = String(input.text ?? '')
  const textNorm = text.toLowerCase()
  const cwd = normalizePath(input.cwd)
  const branches = Array.isArray(input.branches) ? input.branches : []
  const concepts = Array.isArray(input.concepts) ? input.concepts : []

  const scored = branches.map((branch) => {
    let score = 0
    const reasons = []

    const workspace = normalizePath(branch.workspace)
    if (cwd && workspace) {
      if (cwd === workspace || cwd.startsWith(`${workspace}/`)) {
        score += 10
        reasons.push(`cwd 位于「${branch.name}」工作区`)
      } else if (workspace.startsWith(`${cwd}/`)) {
        score += 5
        reasons.push(`cwd 是「${branch.name}」工作区的上级目录`)
      }
    }

    for (const rawPath of Array.isArray(branch.paths) ? branch.paths : []) {
      const fragment = normalizePath(rawPath)
      if (fragment && pathContains(cwd, fragment)) {
        score += 6
        reasons.push(`cwd 包含路径片段「${rawPath}」`)
        break
      }
    }

    if (textNorm && textHas(textNorm, branch.name)) {
      score += 3
      reasons.push(`文本提到分支名「${branch.name}」`)
    }

    const keywordHits = []
    for (const keyword of Array.isArray(branch.keywords) ? branch.keywords : []) {
      if (textHas(textNorm, keyword)) keywordHits.push(String(keyword))
    }
    if (keywordHits.length > 0) {
      score += Math.min(6, keywordHits.length * 2)
      reasons.push(`命中关键词：${keywordHits.slice(0, 4).join('、')}`)
    }

    const conceptHits = []
    for (const concept of concepts) {
      if (!Array.isArray(concept.branches) || !concept.branches.includes(branch.id)) continue
      const terms = [concept.name, ...(Array.isArray(concept.aliases) ? concept.aliases : [])]
      let matched = false
      for (const term of terms) {
        // 概念名常是“指针与地址”“数组与字符串”：除整名外，还要按连接词拆成
        // “指针 / 地址”“数组 / 字符串”，否则用户只说一个词时永远命中不了。
        const parts = String(term ?? '').split(/[与和、/\\s]+/).filter((part) => part.length >= 2)
        if (textHas(textNorm, term) || parts.some((part) => textHas(textNorm, part))) {
          matched = true
          break
        }
      }
      if (matched) conceptHits.push(concept)
    }
    if (conceptHits.length > 0) {
      score += Math.min(3, conceptHits.length)
      reasons.push(`命中概念：${conceptHits.slice(0, 4).map((concept) => concept.name).join('、')}`)
    }

    return { branch, score, reasons, conceptHits }
  })

  scored.sort((left, right) => right.score - left.score || String(left.branch.id).localeCompare(String(right.branch.id)))
  const top = scored[0]
  const noSignal = top === undefined || top.score === 0
  if (noSignal) {
    return {
      primary: null,
      secondary: [],
      confidence: 0,
      reason: text || cwd
        ? '没有命中任何分支（cwd 与文本都不匹配）；请先确认属于哪门课。'
        : '没有可用的匹配信号（缺少 cwd 与 text）；请先确认属于哪门课。',
      concepts: [],
    }
  }

  const secondScore = scored[1]?.score ?? 0
  const confidence = Math.min(0.99, round2(top.score / (top.score + secondScore + 2)))
  const secondaryEntries = scored
    .slice(1)
    .filter((entry) => entry.score >= Math.max(2, top.score * 0.5))
    .slice(0, 3)

  let reason = top.reasons.join('；')
  if (reason === '') reason = `「${top.branch.name}」匹配度最高`
  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    reason += `；置信度 ${confidence.toFixed(2)} 低于 ${LOW_CONFIDENCE_THRESHOLD}，建议只问一句确认`
  }

  const relevant = []
  const seen = new Set()
  for (const entry of [top, ...secondaryEntries]) {
    for (const concept of entry.conceptHits) {
      if (seen.has(concept.id)) continue
      seen.add(concept.id)
      relevant.push(concept)
    }
  }
  if (relevant.length === 0) {
    const primaryConcepts = concepts
      .filter((concept) => Array.isArray(concept.branches) && concept.branches.includes(top.branch.id))
      .sort((left, right) => (left.mastery ?? 0) - (right.mastery ?? 0) || String(left.id).localeCompare(String(right.id)))
      .slice(0, 5)
    relevant.push(...primaryConcepts)
  }

  return {
    primary: top.branch.id,
    secondary: secondaryEntries.map((entry) => entry.branch.id),
    confidence,
    reason,
    concepts: relevant.slice(0, 8).map((concept) => ({
      id: concept.id,
      name: concept.name,
      mastery: Number(concept.mastery) || 0,
    })),
  }
}
