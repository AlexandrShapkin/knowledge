import { readFileSync } from "node:fs"
import path from "node:path"
import { globbySync } from "globby"
import YAML from "yaml"

export function loadContentPolicy(repositoryRoot = process.cwd()) {
  const root = path.resolve(repositoryRoot)
  const contentRoot = path.join(root, "content")
  const configPath = path.join(root, "quartz.config.yaml")
  const config = YAML.parse(readFileSync(configPath, "utf8")) ?? {}
  const ignorePatterns = config.configuration?.ignorePatterns ?? []

  if (!Array.isArray(ignorePatterns) || ignorePatterns.some((pattern) => typeof pattern !== "string")) {
    throw new Error("configuration.ignorePatterns must be an array of strings")
  }

  return { repositoryRoot: root, contentRoot, ignorePatterns }
}

function list(policy, patterns, options = {}) {
  return globbySync(patterns, {
    cwd: policy.contentRoot,
    ignore: policy.ignorePatterns,
    gitignore: true,
    dot: false,
    followSymbolicLinks: false,
    ...options,
  }).map((entry) => path.resolve(policy.contentRoot, entry))
}

export function listContentFiles(policy, { markdownOnly = false } = {}) {
  const patterns = markdownOnly ? ["**/*.md", "**/*.mdx"] : ["**/*"]
  return list(policy, patterns, { onlyFiles: true })
}

export function listContentDirectories(policy) {
  return [policy.contentRoot, ...list(policy, ["**/*"], { onlyDirectories: true })]
}

export function relativeContentPath(policy, value) {
  return path.relative(policy.contentRoot, value).split(path.sep).join("/")
}

export function isServicePath(policy, value) {
  return relativeContentPath(policy, value)
    .split("/")
    .filter(Boolean)
    .some((segment) => segment.startsWith("!"))
}

export function isAssetPath(policy, value) {
  const directories = relativeContentPath(policy, path.dirname(value))
    .split("/")
    .filter(Boolean)
  const serviceDirectories = directories.filter((segment) => segment.startsWith("!"))
  return serviceDirectories.length > 0 && serviceDirectories.every((segment) => segment === "!assets")
}
