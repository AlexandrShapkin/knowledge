import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { mergeMarkdown } from "./smart-sync.mjs"

const markdownExtensions = new Set([".md", ".mdx"])

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
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

function hasRemote(name) {
  return gitOutput(["remote"]).split("\n").filter(Boolean).includes(name)
}

function remoteBranchExists(remote, branch) {
  return runGit(["ls-remote", "--exit-code", "--heads", remote, branch], {
    allowFailure: true,
  }).status === 0
}

function hasStagedChanges() {
  return runGit(["diff", "--cached", "--quiet"], { allowFailure: true }).status === 1
}

function operationInProgress() {
  return ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-apply", "rebase-merge"].some((name) =>
    existsSync(gitPath(name)),
  )
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n")
}

function readStage(stage, file) {
  const result = runGit(["show", `:${stage}:${file}`], { allowFailure: true })
  return result.status === 0 ? normalize(result.stdout) : null
}

function writeReport(reportDir, file, payload) {
  const safeName = file.replace(/[\\/:*?"<>|]/g, "_")
  mkdirSync(reportDir, { recursive: true })
  writeFileSync(path.join(reportDir, `${safeName}.json`), `${JSON.stringify(payload, null, 2)}\n`)
}

function resolveConflict(file, reportDir) {
  const base = readStage(1, file)
  const local = readStage(2, file)
  const remote = readStage(3, file)
  const records = []

  if (local === null && remote === null) {
    runGit(["rm", "--", file])
    return
  }

  if (local === null) {
    if (base !== null && remote === base) {
      runGit(["rm", "--", file])
      return
    }

    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, remote ?? "")
    runGit(["add", "--", file])
    writeReport(reportDir, file, {
      resolution: "remote-kept",
      reason: "local deletion conflicted with remote modification",
    })
    return
  }

  if (remote === null) {
    if (base !== null && local === base) {
      runGit(["rm", "--", file])
      return
    }

    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, local)
    runGit(["add", "--", file])
    writeReport(reportDir, file, {
      resolution: "local-kept",
      reason: "remote deletion conflicted with local modification",
    })
    return
  }

  let result
  if (markdownExtensions.has(path.extname(file).toLowerCase())) {
    result = mergeMarkdown(base ?? "", local, remote, (entry) => records.push(entry))
  } else {
    result = local
    records.push({
      kind: "non-markdown",
      resolution: "local-kept",
      note: "The command cannot semantically merge this file type",
    })
  }

  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, result)
  runGit(["add", "--", file])

  if (records.length > 0) {
    writeReport(reportDir, file, {
      resolution: markdownExtensions.has(path.extname(file).toLowerCase())
        ? "three-way-markdown"
        : "local-kept",
      records,
    })
  }
}

function resolveConflicts(reportDir) {
  const files = runGit(["diff", "--name-only", "--diff-filter=U", "-z"])
    .stdout.split("\0")
    .filter(Boolean)

  for (const file of files) resolveConflict(file, reportDir)

  const unresolved = runGit(["diff", "--name-only", "--diff-filter=U"], {
    allowFailure: true,
  }).stdout.trim()

  if (unresolved) throw new Error(`Unresolved files remain:\n${unresolved}`)
}

function commitLocalChanges(message) {
  runGit(["add", "-A"])
  if (!hasStagedChanges()) return false
  runGit(["commit", "-m", message], { stdio: "inherit" })
  return true
}

function createBackupBranch() {
  const branch = `backup/repository-sync-${timestamp()}`
  runGit(["branch", branch, "HEAD"])
  return branch
}

function integrateRef(ref, label, reportDir) {
  if (runGit(["merge-base", "--is-ancestor", ref, "HEAD"], { allowFailure: true }).status === 0) {
    return false
  }

  if (runGit(["merge-base", "--is-ancestor", "HEAD", ref], { allowFailure: true }).status === 0) {
    runGit(["merge", "--ff-only", ref], { stdio: "inherit" })
    return true
  }

  const merge = runGit(["merge", "--no-ff", "--no-commit", ref], {
    allowFailure: true,
    stdio: "inherit",
  })

  if (merge.status !== 0) resolveConflicts(reportDir)

  if (existsSync(gitPath("MERGE_HEAD"))) {
    runGit(["commit", "-m", `Repository sync: merge ${label}`], { stdio: "inherit" })
  }

  return true
}

function fetchAndIntegrate(remote, branch, reportDir) {
  if (!remoteBranchExists(remote, branch)) return false
  runGit(["fetch", remote, branch], { stdio: "inherit" })
  return integrateRef("FETCH_HEAD", `${remote}/${branch}`, reportDir)
}

function pushWithRetry(options, reportDir) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const push = runGit(
      ["push", options.pushRemote, `HEAD:${options.pushBranch}`],
      { allowFailure: true, stdio: "inherit" },
    )

    if (push.status === 0) return
    if (attempt === 3) throw new Error("Push failed after three attempts")

    fetchAndIntegrate(options.pushRemote, options.pushBranch, reportDir)
  }
}

export function parseArgs(argv, currentBranch) {
  const options = {
    mode: "owner",
    pullRemote: "origin",
    pullBranch: currentBranch,
    pushRemote: "origin",
    pushBranch: currentBranch,
    message: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === "--contributor") {
      options.mode = "contributor"
      options.pullRemote = "knowledge-upstream"
      options.pullBranch = "main"
      options.pushRemote = "origin"
      options.pushBranch = currentBranch
    } else if (value === "--pull-remote") options.pullRemote = argv[++index]
    else if (value === "--pull-branch") options.pullBranch = argv[++index]
    else if (value === "--push-remote") options.pushRemote = argv[++index]
    else if (value === "--push-branch") options.pushBranch = argv[++index]
    else if (value === "--message") options.message = argv[++index]
    else throw new Error(`Unknown argument: ${value}`)
  }

  return options
}

export function main(argv = process.argv.slice(2)) {
  if (gitOutput(["rev-parse", "--is-inside-work-tree"]) !== "true") {
    throw new Error("The command must be run inside a Git repository")
  }

  if (operationInProgress()) {
    throw new Error("A merge, rebase, cherry-pick, or revert is already in progress")
  }

  const currentBranch = gitOutput(["branch", "--show-current"])
  if (!currentBranch) throw new Error("Detached HEAD is not supported")

  const options = parseArgs(argv, currentBranch)
  for (const remote of new Set([options.pullRemote, options.pushRemote])) {
    if (!hasRemote(remote)) throw new Error(`Git remote not found: ${remote}`)
  }

  const reportDir = path.join(gitPath("repository-sync"), timestamp())
  const message = options.message ?? `Repository sync: local changes ${new Date().toISOString()}`

  commitLocalChanges(message)
  const backupBranch = createBackupBranch()

  fetchAndIntegrate(options.pullRemote, options.pullBranch, reportDir)

  if (
    options.pullRemote !== options.pushRemote ||
    options.pullBranch !== options.pushBranch
  ) {
    fetchAndIntegrate(options.pushRemote, options.pushBranch, reportDir)
  }

  pushWithRetry(options, reportDir)

  console.log(`Repository sync completed in ${options.mode} mode`)
  console.log(`Current branch: ${currentBranch}`)
  console.log(`Pulled from: ${options.pullRemote}/${options.pullBranch}`)
  console.log(`Pushed to: ${options.pushRemote}/${options.pushBranch}`)
  console.log(`Backup branch: ${backupBranch}`)
  console.log(`Conflict reports: ${reportDir}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
