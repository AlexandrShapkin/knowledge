import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

const markdownExtensions = new Set([".md", ".mdx"])
const listFrontmatterKeys = new Set(["tags", "aliases", "cssclasses"])

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? "pipe",
  })

  if (options.allowFailure) return result

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    throw new Error(output || `git ${args.join(" ")} failed`)
  }

  return result
}

function gitOutput(args) {
  return runGit(args).stdout.trim()
}

function gitPath(name) {
  return gitOutput(["rev-parse", "--git-path", name])
}

function isOperationInProgress() {
  return ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-apply", "rebase-merge"].some((name) =>
    existsSync(gitPath(name)),
  )
}

function hasStagedChanges() {
  return runGit(["diff", "--cached", "--quiet"], { allowFailure: true }).status === 1
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n")
}

function splitFrontmatter(text) {
  const normalized = normalize(text)
  if (!normalized.startsWith("---\n")) return { frontmatter: "", body: normalized }
  const end = normalized.indexOf("\n---\n", 4)
  if (end === -1) return { frontmatter: "", body: normalized }
  return {
    frontmatter: normalized.slice(4, end),
    body: normalized.slice(end + 5),
  }
}

function parseFrontmatterBlocks(text) {
  const lines = normalize(text).split("\n")
  const order = []
  const blocks = new Map()
  let current = null

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/)
    if (match) {
      current = match[1]
      order.push(current)
      blocks.set(current, [line])
    } else if (current) {
      blocks.get(current).push(line)
    }
  }

  return { order, blocks }
}

function unique(values) {
  return [...new Set(values)]
}

function parseYamlList(block) {
  return block
    .slice(1)
    .map((line) => line.match(/^\s*-\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean)
}

function mergeFrontmatter(baseText, oursText, theirsText, record) {
  if (oursText === theirsText) return oursText
  if (oursText === baseText) return theirsText
  if (theirsText === baseText) return oursText

  const base = parseFrontmatterBlocks(baseText)
  const ours = parseFrontmatterBlocks(oursText)
  const theirs = parseFrontmatterBlocks(theirsText)
  const order = unique([...ours.order, ...theirs.order, ...base.order])
  const output = []

  for (const key of order) {
    const baseBlock = base.blocks.get(key) ?? []
    const oursBlock = ours.blocks.get(key) ?? []
    const theirsBlock = theirs.blocks.get(key) ?? []
    const baseValue = baseBlock.join("\n")
    const oursValue = oursBlock.join("\n")
    const theirsValue = theirsBlock.join("\n")

    if (oursValue === theirsValue) {
      output.push(...oursBlock)
      continue
    }

    if (oursValue === baseValue) {
      output.push(...theirsBlock)
      continue
    }

    if (theirsValue === baseValue) {
      output.push(...oursBlock)
      continue
    }

    if (listFrontmatterKeys.has(key)) {
      const values = unique([...parseYamlList(oursBlock), ...parseYamlList(theirsBlock)])
      output.push(`${key}:`, ...values.map((value) => `  - ${value}`))
      continue
    }

    output.push(...oursBlock)
    record({ kind: "frontmatter", key, ours: oursValue, theirs: theirsValue })
  }

  return output.join("\n").replace(/\n+$/, "")
}

function splitMarkdownBlocks(text) {
  const lines = normalize(text).split("\n")
  const blocks = []
  let current = []
  let inFence = false

  const flush = () => {
    if (current.length) blocks.push(current.join("\n"))
    current = []
  }

  for (const line of lines) {
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) inFence = !inFence
    if (!inFence && line.trim() === "") {
      flush()
      continue
    }
    current.push(line)
  }

  flush()
  return blocks
}

function isListBlock(text) {
  const lines = normalize(text).split("\n").filter((line) => line.trim())
  return lines.length > 0 && lines.every((line) => /^\s*(?:[-*+] |\d+[.)] )/.test(line))
}

function mergeListBlocks(ours, theirs) {
  return unique([...normalize(ours).split("\n"), ...normalize(theirs).split("\n")]).join("\n")
}

function tokenizeSentences(text) {
  return normalize(text)
    .replace(/\n+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/u)
    .filter(Boolean)
}

function mergeWithGit(base, ours, theirs, labels = ["LOCAL", "BASE", "REMOTE"]) {
  const dir = mkdtempSync(path.join(tmpdir(), "smart-sync-"))
  const basePath = path.join(dir, "base")
  const oursPath = path.join(dir, "ours")
  const theirsPath = path.join(dir, "theirs")

  try {
    writeFileSync(basePath, normalize(base))
    writeFileSync(oursPath, normalize(ours))
    writeFileSync(theirsPath, normalize(theirs))
    const result = runGit(
      [
        "merge-file",
        "-p",
        "--diff3",
        "-L",
        labels[0],
        "-L",
        labels[1],
        "-L",
        labels[2],
        oursPath,
        basePath,
        theirsPath,
      ],
      { allowFailure: true },
    )
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(result.stderr?.trim() || "git merge-file failed")
    }
    return { text: normalize(result.stdout), conflicted: result.status === 1 }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function resolveConflictHunk(base, ours, theirs, record) {
  if (ours === theirs) return ours
  if (ours === base) return theirs
  if (theirs === base) return ours
  if (!ours.trim()) return theirs
  if (!theirs.trim()) return ours

  if (isListBlock(ours) && isListBlock(theirs)) return mergeListBlocks(ours, theirs)

  const oursHeading = ours.match(/^(#{1,6}\s+.+)\n?([\s\S]*)$/)
  const theirsHeading = theirs.match(/^(#{1,6}\s+.+)\n?([\s\S]*)$/)
  if (oursHeading && theirsHeading && oursHeading[1].trim() === theirsHeading[1].trim()) {
    const merged = resolveConflictHunk("", oursHeading[2], theirsHeading[2], record)
    return `${oursHeading[1]}${merged ? `\n${merged}` : ""}`
  }

  if (!/[`|]/.test(ours + theirs)) {
    const baseSentences = tokenizeSentences(base)
    const oursSentences = tokenizeSentences(ours)
    const theirsSentences = tokenizeSentences(theirs)
    if (Math.max(baseSentences.length, oursSentences.length, theirsSentences.length) > 1) {
      const sentenceMerge = mergeWithGit(
        baseSentences.join("\n"),
        oursSentences.join("\n"),
        theirsSentences.join("\n"),
      )
      if (!sentenceMerge.conflicted) return sentenceMerge.text.trim().replace(/\n+/g, " ")
    }
  }

  const oursBlocks = splitMarkdownBlocks(ours)
  const theirsBlocks = splitMarkdownBlocks(theirs)
  const mergedBlocks = [...oursBlocks]
  const seen = new Set(oursBlocks.map((block) => block.trim()))

  for (const block of theirsBlocks) {
    const key = block.trim()
    if (key && !seen.has(key)) {
      mergedBlocks.push(block)
      seen.add(key)
    }
  }

  record({ kind: "body", base, ours, theirs })
  return mergedBlocks.join("\n\n")
}

function resolveConflictMarkers(text, record) {
  const lines = normalize(text).split("\n")
  const output = []

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("<<<<<<< ")) {
      output.push(lines[index])
      continue
    }

    const ours = []
    const base = []
    const theirs = []
    index += 1

    while (index < lines.length && !lines[index].startsWith("||||||| ")) {
      ours.push(lines[index])
      index += 1
    }

    index += 1
    while (index < lines.length && lines[index] !== "=======") {
      base.push(lines[index])
      index += 1
    }

    index += 1
    while (index < lines.length && !lines[index].startsWith(">>>>>>> ")) {
      theirs.push(lines[index])
      index += 1
    }

    output.push(resolveConflictHunk(base.join("\n"), ours.join("\n"), theirs.join("\n"), record))
  }

  return output.join("\n")
}

export function mergeMarkdown(baseText, oursText, theirsText, onConflict = () => {}) {
  const base = splitFrontmatter(baseText)
  const ours = splitFrontmatter(oursText)
  const theirs = splitFrontmatter(theirsText)
  const frontmatter = mergeFrontmatter(base.frontmatter, ours.frontmatter, theirs.frontmatter, onConflict)
  const bodyMerge = mergeWithGit(base.body, ours.body, theirs.body)
  const body = bodyMerge.conflicted
    ? resolveConflictMarkers(bodyMerge.text, onConflict)
    : bodyMerge.text.replace(/\n+$/, "")

  if (!frontmatter) return body
  return `---\n${frontmatter}\n---\n${body}`
}

function readStage(stage, file) {
  const result = runGit(["show", `:${stage}:${file}`], { allowFailure: true })
  if (result.status !== 0) return null
  return normalize(result.stdout)
}

function writeConflictReport(reportDir, file, entry) {
  const target = path.join(reportDir, `${file.replace(/[\\/:*?"<>|]/g, "_")}.json`)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(entry, null, 2)}\n`)
}

function resolveFile(file, reportDir) {
  const base = readStage(1, file)
  const ours = readStage(2, file)
  const theirs = readStage(3, file)
  const records = []
  const record = (entry) => records.push(entry)

  if (ours === null && theirs === null) {
    runGit(["rm", "--", file])
    return
  }

  if (ours === null) {
    if (base !== null && theirs === base) {
      runGit(["rm", "--", file])
      return
    }
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, theirs)
    runGit(["add", "--", file])
    writeConflictReport(reportDir, file, { resolution: "remote", reason: "local deletion", records })
    return
  }

  if (theirs === null) {
    if (base !== null && ours === base) {
      runGit(["rm", "--", file])
      return
    }
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, ours)
    runGit(["add", "--", file])
    writeConflictReport(reportDir, file, { resolution: "local", reason: "remote deletion", records })
    return
  }

  let merged
  if (markdownExtensions.has(path.extname(file).toLowerCase())) {
    merged = mergeMarkdown(base ?? "", ours, theirs, record)
  } else {
    merged = ours
    record({ kind: "binary-or-structured", ours, theirs })
  }

  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, merged)
  runGit(["add", "--", file])

  if (records.length) {
    writeConflictReport(reportDir, file, {
      resolution: markdownExtensions.has(path.extname(file).toLowerCase()) ? "three-way-markdown" : "local",
      records,
    })
  }
}

function resolveMergeConflicts(reportDir) {
  const result = runGit(["diff", "--name-only", "--diff-filter=U", "-z"])
  const files = result.stdout.split("\0").filter(Boolean)
  for (const file of files) resolveFile(file, reportDir)

  const unresolved = runGit(["diff", "--name-only", "--diff-filter=U"], { allowFailure: true }).stdout.trim()
  if (unresolved) throw new Error(`Unresolved files remain:\n${unresolved}`)
}

function createBackupBranch() {
  const name = `backup/smart-sync-${timestamp()}`
  runGit(["branch", name, "HEAD"])
  return name
}

function commitLocalChanges(message) {
  runGit(["add", "-A"])
  if (!hasStagedChanges()) return false
  runGit(["commit", "-m", message], { stdio: "inherit" })
  return true
}

function integrateRemote(remote, branch, reportDir) {
  runGit(["fetch", remote, branch], { stdio: "inherit" })
  const remoteRef = `${remote}/${branch}`

  if (runGit(["merge-base", "--is-ancestor", remoteRef, "HEAD"], { allowFailure: true }).status === 0) {
    return false
  }

  if (runGit(["merge-base", "--is-ancestor", "HEAD", remoteRef], { allowFailure: true }).status === 0) {
    runGit(["merge", "--ff-only", remoteRef], { stdio: "inherit" })
    return true
  }

  const merge = runGit(["merge", "--no-ff", "--no-commit", remoteRef], {
    allowFailure: true,
    stdio: "inherit",
  })

  if (merge.status !== 0) resolveMergeConflicts(reportDir)

  if (hasStagedChanges() || existsSync(gitPath("MERGE_HEAD"))) {
    runGit(["commit", "-m", `Smart sync: merge ${remoteRef}`], { stdio: "inherit" })
  }

  return true
}

function pushWithRetry(remote, branch, reportDir) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const push = runGit(["push", remote, `HEAD:${branch}`], { allowFailure: true, stdio: "inherit" })
    if (push.status === 0) return
    if (attempt === 3) throw new Error("Push failed after three attempts")
    integrateRemote(remote, branch, reportDir)
  }
}

function parseArgs(argv) {
  const options = {
    remote: process.env.SMART_SYNC_REMOTE ?? "origin",
    branch: process.env.SMART_SYNC_BRANCH ?? null,
    message: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === "--remote") options.remote = argv[++index]
    else if (value === "--branch") options.branch = argv[++index]
    else if (value === "--message") options.message = argv[++index]
    else throw new Error(`Unknown argument: ${value}`)
  }

  return options
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (gitOutput(["rev-parse", "--is-inside-work-tree"]) !== "true") {
    throw new Error("The command must be run inside a Git repository")
  }

  if (isOperationInProgress()) {
    throw new Error("A merge, rebase, cherry-pick, or revert is already in progress")
  }

  const currentBranch = gitOutput(["branch", "--show-current"])
  if (!currentBranch) throw new Error("Detached HEAD is not supported")
  const branch = options.branch ?? currentBranch

  if (currentBranch !== branch) {
    throw new Error(`Current branch is ${currentBranch}, expected ${branch}`)
  }

  const reportDir = path.join(gitPath("smart-sync"), timestamp())
  mkdirSync(reportDir, { recursive: true })
  const message = options.message ?? `Smart sync: local changes ${new Date().toISOString()}`

  commitLocalChanges(message)
  const backup = createBackupBranch()
  integrateRemote(options.remote, branch, reportDir)
  pushWithRetry(options.remote, branch, reportDir)

  console.log(`Smart sync completed on ${branch}`)
  console.log(`Backup branch: ${backup}`)
  console.log(`Conflict report: ${reportDir}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
