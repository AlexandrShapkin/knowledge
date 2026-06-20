import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const contentRoot = path.join(root, "content")
const reportPath = path.join(root, "LINK_MIGRATION_REPORT.json")

function walk(directory) {
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...walk(fullPath))
    else result.push(fullPath)
  }
  return result
}

function toPosix(value) {
  return value.split(path.sep).join("/")
}

function relativeToContent(file) {
  return toPosix(path.relative(contentRoot, file))
}

function withoutMd(value) {
  return value.replace(/\.md$/i, "")
}

function decodePath(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value.replace(/%20/gi, " ")
  }
}

function stripContentPrefix(value) {
  return value.replace(/^\/?content\//i, "")
}

function encodeSegment(segment) {
  return decodePath(segment)
    .replace(/%/g, "%25")
    .replace(/ /g, "%20")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/#/g, "%23")
    .replace(/\?/g, "%3F")
}

function encodePath(value) {
  return value.split("/").map(encodeSegment).join("/")
}

function slugifyHeading(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function pathDistance(sourceFile, candidateFile) {
  const source = path.posix.dirname(relativeToContent(sourceFile)).split("/").filter(Boolean)
  const target = path.posix.dirname(relativeToContent(candidateFile)).split("/").filter(Boolean)
  let common = 0
  while (common < source.length && common < target.length && source[common] === target[common]) {
    common += 1
  }
  return source.length - common + target.length - common
}

function chooseNearest(sourceFile, candidates) {
  if (candidates.length === 0) return { status: "missing", file: null }
  if (candidates.length === 1) return { status: "resolved", file: candidates[0] }

  const ranked = candidates
    .map((file) => ({ file, distance: pathDistance(sourceFile, file) }))
    .sort((a, b) => a.distance - b.distance || relativeToContent(a.file).localeCompare(relativeToContent(b.file), "ru"))

  if (ranked.length > 1 && ranked[0].distance === ranked[1].distance) {
    return { status: "ambiguous", file: null, candidates: ranked.map((entry) => entry.file) }
  }

  return { status: "resolved", file: ranked[0].file }
}

const allFiles = walk(contentRoot)
const markdownFiles = allFiles.filter((file) => file.toLowerCase().endsWith(".md"))
const assetFiles = allFiles.filter((file) => !file.toLowerCase().endsWith(".md"))

const markdownByRelative = new Map()
const markdownByStem = new Map()
const markdownByBasename = new Map()
const assetsByRelative = new Map()
const assetsByBasename = new Map()

function addMulti(map, key, value) {
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(value)
}

for (const file of markdownFiles) {
  const relative = relativeToContent(file)
  const stem = withoutMd(relative)
  const basename = withoutMd(path.posix.basename(relative))
  markdownByRelative.set(relative, file)
  markdownByRelative.set(stem, file)
  addMulti(markdownByStem, stem, file)
  addMulti(markdownByBasename, basename, file)
}

for (const file of assetFiles) {
  const relative = relativeToContent(file)
  assetsByRelative.set(relative, file)
  addMulti(assetsByBasename, path.posix.basename(relative), file)
}

function resolveMarkdown(sourceFile, targetValue) {
  const target = stripContentPrefix(decodePath(targetValue).replace(/^\.\//, ""))
  const sourceDirectory = path.posix.dirname(relativeToContent(sourceFile))

  for (const direct of [target, path.posix.normalize(path.posix.join(sourceDirectory, target))]) {
    for (const candidate of [direct, withoutMd(direct), `${withoutMd(direct)}.md`]) {
      const file = markdownByRelative.get(candidate)
      if (file) return { status: "resolved", file }
    }
  }

  const normalizedStem = withoutMd(target)
  const byStem = markdownByStem.get(normalizedStem) ?? []
  if (byStem.length > 0) return chooseNearest(sourceFile, byStem)

  const basename = withoutMd(path.posix.basename(target))
  return chooseNearest(sourceFile, markdownByBasename.get(basename) ?? [])
}

function resolveAsset(sourceFile, targetValue) {
  const target = stripContentPrefix(decodePath(targetValue).replace(/^\.\//, ""))
  const sourceDirectory = path.posix.dirname(relativeToContent(sourceFile))

  for (const direct of [target, path.posix.normalize(path.posix.join(sourceDirectory, target))]) {
    const file = assetsByRelative.get(direct)
    if (file) return { status: "resolved", file }
  }

  return chooseNearest(sourceFile, assetsByBasename.get(path.posix.basename(target)) ?? [])
}

function relativeLink(sourceFile, targetFile) {
  const sourceDirectory = path.posix.dirname(relativeToContent(sourceFile))
  let relative = path.posix.relative(sourceDirectory, relativeToContent(targetFile))
  if (!relative) relative = path.posix.basename(relativeToContent(targetFile))
  return encodePath(relative)
}

function parseWiki(raw) {
  const separator = raw.indexOf("|")
  const targetWithAnchor = separator === -1 ? raw.trim() : raw.slice(0, separator).trim()
  const alias = separator === -1 ? "" : raw.slice(separator + 1).trim()
  const hash = targetWithAnchor.indexOf("#")
  const target = hash === -1 ? targetWithAnchor : targetWithAnchor.slice(0, hash).trim()
  const anchor = hash === -1 ? "" : targetWithAnchor.slice(hash + 1).trim()
  const defaultLabel = target ? withoutMd(path.posix.basename(target)) : anchor || targetWithAnchor
  return { target, anchor, label: alias || defaultLabel }
}

const report = {
  generatedAt: new Date().toISOString(),
  filesChanged: 0,
  wikiLinksConverted: 0,
  wikiEmbedsConverted: 0,
  unresolvedConvertedToText: 0,
  ambiguousConvertedToText: 0,
  ambiguous: [],
  unresolved: [],
  changedFiles: [],
}

for (const file of markdownFiles.sort((a, b) => a.localeCompare(b, "ru"))) {
  const original = readFileSync(file, "utf8")
  const updated = original.replace(/(!?)\[\[([^\]]+)\]\]/g, (full, embedMarker, raw) => {
    const isEmbed = embedMarker === "!"
    const { target, anchor, label } = parseWiki(raw)

    if (!target && anchor && !isEmbed) {
      report.wikiLinksConverted += 1
      return `[${label}](#${slugifyHeading(anchor)})`
    }

    const resolution = isEmbed ? resolveAsset(file, target) : resolveMarkdown(file, target)

    if (resolution.status === "resolved") {
      const href = relativeLink(file, resolution.file)
      const anchorPart = anchor ? `#${slugifyHeading(anchor)}` : ""
      if (isEmbed) {
        report.wikiEmbedsConverted += 1
        return `![${label}](${href}${anchorPart})`
      }
      report.wikiLinksConverted += 1
      return `[${label}](${href}${anchorPart})`
    }

    const entry = {
      file: relativeToContent(file),
      source: full,
      target,
      label,
    }

    if (resolution.status === "ambiguous") {
      entry.candidates = resolution.candidates.map(relativeToContent)
      report.ambiguous.push(entry)
      report.ambiguousConvertedToText += 1
    } else {
      report.unresolved.push(entry)
      report.unresolvedConvertedToText += 1
    }

    return label || target || raw
  })

  if (updated !== original) {
    writeFileSync(file, updated)
    report.filesChanged += 1
    report.changedFiles.push(relativeToContent(file))
  }
}

report.changedFiles.sort((a, b) => a.localeCompare(b, "ru"))
report.unresolved.sort((a, b) => a.file.localeCompare(b.file, "ru"))
report.ambiguous.sort((a, b) => a.file.localeCompare(b.file, "ru"))

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  filesChanged: report.filesChanged,
  wikiLinksConverted: report.wikiLinksConverted,
  wikiEmbedsConverted: report.wikiEmbedsConverted,
  unresolvedConvertedToText: report.unresolvedConvertedToText,
  ambiguousConvertedToText: report.ambiguousConvertedToText,
}, null, 2))
