import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const contentRoot = path.join(root, "content")
const reportPath = path.join(root, "ATOMICITY_AUDIT.json")

function walk(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walk(fullPath))
    else files.push(fullPath)
  }
  return files
}

function toPosix(value) {
  return value.split(path.sep).join("/")
}

function relativeToContent(file) {
  return toPosix(path.relative(contentRoot, file))
}

function splitFrontmatter(source) {
  const normalized = source.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) return { raw: "", body: normalized }
  const end = normalized.indexOf("\n---\n", 4)
  if (end === -1) return { raw: normalized.slice(4), body: "" }
  return { raw: normalized.slice(4, end), body: normalized.slice(end + 5) }
}

function scalarField(raw, name) {
  return raw.match(new RegExp(`^${name}:\\s*(.*?)\\s*$`, "m"))?.[1]?.replace(/^['"]|['"]$/g, "") ?? ""
}

function parseTags(raw) {
  const lines = raw.split("\n")
  const start = lines.findIndex((line) => /^tags:\s*/.test(line))
  if (start === -1) return []
  const scalar = lines[start].replace(/^tags:\s*/, "").trim()
  if (scalar.startsWith("[") && scalar.endsWith("]")) {
    return scalar
      .slice(1, -1)
      .split(",")
      .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean)
  }
  const result = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*-\s*(.*?)\s*$/)
    if (!match) break
    if (match[1]) result.push(match[1])
  }
  return result
}

function stripCode(body) {
  return body.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]+`/g, " ")
}

function wordCount(body) {
  return (stripCode(body).match(/[\p{L}\p{N}]+/gu) ?? []).length
}

const files = walk(contentRoot)
  .filter((file) => file.toLowerCase().endsWith(".md"))
  .sort((left, right) => left.localeCompare(right, "ru"))

const notes = files.map((file) => {
  const source = readFileSync(file, "utf8")
  const { raw, body } = splitFrontmatter(source)
  const headings = [...body.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map((match) => ({
    level: match[1].length,
    text: match[2].trim(),
  }))
  const h2 = headings.filter((heading) => heading.level === 2)
  const h3 = headings.filter((heading) => heading.level === 3)
  const words = wordCount(body)
  const pathValue = relativeToContent(file)
  const isIndex = path.basename(file).toLowerCase() === "index.md"
  const generated = scalarField(raw, "generated").toLowerCase() === "true"
  const title = scalarField(raw, "title") || headings.find((heading) => heading.level === 1)?.text || path.basename(file, ".md")
  const score = isIndex
    ? 0
    : (words >= 1200 ? 4 : words >= 800 ? 3 : words >= 450 ? 1 : 0) +
      (h2.length >= 8 ? 4 : h2.length >= 5 ? 2 : h2.length >= 3 ? 1 : 0) +
      (h3.length >= 12 ? 2 : h3.length >= 6 ? 1 : 0)

  return {
    path: pathValue,
    title,
    tags: parseTags(raw),
    isIndex,
    generated,
    words,
    characters: body.length,
    h2Count: h2.length,
    h3Count: h3.length,
    headings,
    internalLinks: [...body.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+\.md(?:#[^)]+)?)\)/g)].length,
    score,
  }
})

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    markdownFiles: notes.length,
    indexes: notes.filter((note) => note.isIndex).length,
    generatedIndexes: notes.filter((note) => note.generated).length,
    contentNotes: notes.filter((note) => !note.isIndex).length,
    candidatesScore3Plus: notes.filter((note) => !note.isIndex && note.score >= 3).length,
    candidatesScore5Plus: notes.filter((note) => !note.isIndex && note.score >= 5).length,
  },
  candidates: notes
    .filter((note) => !note.isIndex && note.score >= 1)
    .sort((left, right) => right.score - left.score || right.words - left.words),
  notes,
}

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report.totals, null, 2))
