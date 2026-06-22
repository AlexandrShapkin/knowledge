import path from "node:path"

export const pageExtensions = new Set([".md", ".mdx", ".canvas", ".base"])

const wikiPattern = /!?\[\[[^\]]+\]\]/g

function splitUnescapedPipe(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "|" && value[index - 1] !== "\\") {
      return [value.slice(0, index), value.slice(index + 1)]
    }
  }
  return [value, ""]
}

export function parseWikilink(raw) {
  const embedded = raw.startsWith("!")
  const inner = raw.slice(embedded ? 3 : 2, -2)
  const [destination, aliasRaw] = splitUnescapedPipe(inner)
  const hash = destination.indexOf("#")
  const target = (hash >= 0 ? destination.slice(0, hash) : destination).trim()
  const anchor = (hash >= 0 ? destination.slice(hash + 1) : "").trim()
  const alias = aliasRaw.trim().replace(/\\\|/g, "|")
  return { raw, embedded, target, anchor, alias }
}

export function findWikilinks(value) {
  return [...value.matchAll(wikiPattern)].map((match) => ({
    index: match.index ?? 0,
    ...parseWikilink(match[0]),
  }))
}

export function createPublishedIndex(policy, publishedFiles, publishedDirectories = []) {
  const files = new Map()
  const directories = new Map()

  for (const file of publishedFiles) {
    const relative = path.relative(policy.contentRoot, file).split(path.sep).join("/")
    files.set(relative.normalize("NFKC").toLowerCase(), file)
  }
  for (const directory of publishedDirectories) {
    const relative = path.relative(policy.contentRoot, directory).split(path.sep).join("/")
    directories.set(relative.normalize("NFKC").toLowerCase(), directory)
  }

  return { files, directories }
}

function decodedTarget(target) {
  try {
    return decodeURIComponent(target)
  } catch {
    return target
  }
}

function lookup(map, relative) {
  return map.get(relative.normalize("NFKC").toLowerCase()) ?? null
}

export function resolveRelativeWikilink(policy, index, sourceFile, target) {
  if (!target) return { kind: "page", file: sourceFile, relative: "" }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) return { kind: "external" }
  if (target.startsWith("/")) return { kind: "outside" }

  const sourceDirectory = path.posix.dirname(
    path.relative(policy.contentRoot, sourceFile).split(path.sep).join("/"),
  )
  const normalized = path.posix.normalize(path.posix.join(sourceDirectory, decodedTarget(target)))
  if (normalized === ".." || normalized.startsWith("../")) return { kind: "outside" }

  const extension = path.posix.extname(normalized).toLowerCase()
  if (extension) {
    const file = lookup(index.files, normalized)
    if (!file) return { kind: "missing", relative: normalized }
    return { kind: pageExtensions.has(extension) ? "page" : "asset", file, relative: normalized }
  }

  const pageCandidates = [
    `${normalized}.md`,
    `${normalized}.mdx`,
    `${normalized}.canvas`,
    `${normalized}.base`,
    `${normalized}/index.md`,
    `${normalized}/index.mdx`,
  ]

  const basename = path.posix.basename(normalized)
  if (basename) {
    pageCandidates.push(`${normalized}/${basename}.md`, `${normalized}/${basename}.mdx`)
  }

  for (const candidate of pageCandidates) {
    const file = lookup(index.files, candidate)
    if (file) return { kind: "page", file, relative: candidate }
  }

  const directory = lookup(index.directories, normalized)
  if (directory) return { kind: "folder", directory, relative: normalized }
  return { kind: "missing", relative: normalized }
}

export function markdownTargetToWikilink(target, label = "", embedded = false) {
  const hash = target.indexOf("#")
  const rawPath = hash >= 0 ? target.slice(0, hash) : target
  const anchor = hash >= 0 ? target.slice(hash + 1) : ""
  let decoded = decodedTarget(rawPath).replace(/\\/g, "/")
  if (/\.(?:md|mdx)$/i.test(decoded)) decoded = decoded.replace(/\.(?:md|mdx)$/i, "")

  const destination = `${decoded}${anchor ? `#${anchor}` : ""}`
  const defaultLabel = path.posix.basename(decoded).replace(/\.(?:md|mdx|canvas|base)$/i, "")
  const alias = label && label !== defaultLabel && label !== destination ? `|${label.replace(/\|/g, "\\|")}` : ""
  return `${embedded ? "!" : ""}[[${destination}${alias}]]`
}
