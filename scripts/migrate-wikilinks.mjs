import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { unified } from "unified"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { visit } from "unist-util-visit"
import {
  isServicePath,
  listContentFiles,
  loadContentPolicy,
} from "./content-policy.mjs"
import { markdownTargetToWikilink } from "./wikilinks.mjs"

const root = process.cwd()
const policy = loadContentPolicy(root)
const checkOnly = process.argv.includes("--check")
const parser = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm)
const publishedFiles = new Set(listContentFiles(policy).map((file) => path.resolve(file)))
const markdownFiles = listContentFiles(policy, { markdownOnly: true })
  .map((file) => path.resolve(file))
  .filter((file) => !isServicePath(policy, file))
  .sort((a, b) => a.localeCompare(b, "ru"))

const external = (value) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)

function decodePath(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function plainLabel(node) {
  if (node.type === "image") return node.alt ?? ""
  if (!Array.isArray(node.children) || node.children.some((child) => child.type !== "text")) return null
  return node.children.map((child) => child.value ?? "").join("")
}

function resolvable(file, target) {
  const rawPath = target.split("#", 1)[0].split("?", 1)[0]
  if (!rawPath) return false
  const resolved = path.resolve(path.dirname(file), decodePath(rawPath))
  return existsSync(resolved) && publishedFiles.has(resolved)
}

let changedFiles = 0
let convertedLinks = 0
let skippedLinks = 0

for (const file of markdownFiles) {
  const source = readFileSync(file, "utf8")
  let tree
  try {
    tree = parser.parse(source)
  } catch {
    skippedLinks += 1
    continue
  }

  const replacements = []
  const collect = (node, embedded) => {
    const target = String(node.url ?? "").trim()
    if (!target || external(target) || target.startsWith("#") || target.includes("?")) return
    if (node.title) {
      skippedLinks += 1
      return
    }

    const label = plainLabel(node)
    if (label === null || label.includes("\n") || label.includes("]]")) {
      skippedLinks += 1
      return
    }
    if (!resolvable(file, target)) {
      skippedLinks += 1
      return
    }

    const start = node.position?.start?.offset
    const end = node.position?.end?.offset
    if (start === undefined || end === undefined) {
      skippedLinks += 1
      return
    }

    replacements.push({
      start,
      end,
      value: markdownTargetToWikilink(target, label, embedded),
    })
  }

  visit(tree, "link", (node) => collect(node, false))
  visit(tree, "image", (node) => collect(node, true))

  if (replacements.length === 0) continue
  replacements.sort((left, right) => right.start - left.start)
  let output = source
  for (const replacement of replacements) {
    output = output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end)
  }

  convertedLinks += replacements.length
  changedFiles += 1
  if (!checkOnly) writeFileSync(file, output)
}

console.log(
  JSON.stringify(
    {
      mode: checkOnly ? "check" : "write",
      markdownFiles: markdownFiles.length,
      changedFiles,
      convertedLinks,
      skippedLinks,
    },
    null,
    2,
  ),
)

if (checkOnly && convertedLinks > 0) process.exitCode = 1
