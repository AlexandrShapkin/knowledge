import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  })

  if (options.allowFailure) return result

  if (result.error) throw result.error
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    throw new Error(output || `${command} ${args.join(" ")} failed`)
  }

  return result
}

function runGit(args, options = {}) {
  return run("git", args, options)
}

function gitOutput(args) {
  return runGit(args).stdout.trim()
}

function gitPath(name) {
  return gitOutput(["rev-parse", "--git-path", name])
}

function operationInProgress() {
  return ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-apply", "rebase-merge"].some(
    (name) => existsSync(gitPath(name)),
  )
}

function hasRemote(name) {
  return gitOutput(["remote"])
    .split("\n")
    .filter(Boolean)
    .includes(name)
}

function remoteBranchExists(remote, branch) {
  return (
    runGit(["ls-remote", "--exit-code", "--heads", remote, branch], {
      allowFailure: true,
    }).status === 0
  )
}

function hasStagedChanges() {
  return runGit(["diff", "--cached", "--quiet"], { allowFailure: true }).status === 1
}

function isAncestor(ancestor, descendant) {
  return (
    runGit(["merge-base", "--is-ancestor", ancestor, descendant], {
      allowFailure: true,
    }).status === 0
  )
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function requireValue(argv, index, option) {
  const value = argv[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${option}`)
  return value
}

export function parseArgs(argv, currentBranch) {
  const contributor = argv.includes("--contributor")
  const options = {
    mode: contributor ? "contributor" : "owner",
    skipCheck: argv.includes("--no-check"),
    pullRemote: contributor ? "knowledge-upstream" : "origin",
    pullBranch: contributor ? "main" : currentBranch,
    pushRemote: "origin",
    pushBranch: currentBranch,
    message: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === "--contributor" || value === "--no-check") continue

    if (value === "--pull-remote") {
      options.pullRemote = requireValue(argv, index, value)
      index += 1
    } else if (value === "--pull-branch") {
      options.pullBranch = requireValue(argv, index, value)
      index += 1
    } else if (value === "--push-remote") {
      options.pushRemote = requireValue(argv, index, value)
      index += 1
    } else if (value === "--push-branch") {
      options.pushBranch = requireValue(argv, index, value)
      index += 1
    } else if (value === "--message") {
      options.message = requireValue(argv, index, value)
      index += 1
    } else {
      throw new Error(`Unknown argument: ${value}`)
    }
  }

  return options
}

function validateContent(skipCheck) {
  if (skipCheck) {
    console.warn("Проверка content/ пропущена по флагу --no-check")
    return
  }

  run(process.execPath, ["--run", "content:validate"], { stdio: "inherit" })
}

function commitLocalChanges(message) {
  runGit(["add", "-A"], { stdio: "inherit" })
  if (!hasStagedChanges()) return false

  runGit(["commit", "-m", message ?? "docs: update knowledge base"], {
    stdio: "inherit",
  })
  return true
}

function createBackupBranch() {
  const branch = `backup/repository-sync-${timestamp()}`
  runGit(["branch", branch, "HEAD"])
  return branch
}

function rebaseOntoRemote(remote, branch, state) {
  if (!remoteBranchExists(remote, branch)) return false

  runGit(["fetch", "--prune", remote, branch], { stdio: "inherit" })
  if (isAncestor("FETCH_HEAD", "HEAD")) return false

  if (!state.backupBranch) state.backupBranch = createBackupBranch()

  const result = runGit(["rebase", "FETCH_HEAD"], {
    allowFailure: true,
    stdio: "inherit",
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `Rebase onto ${remote}/${branch} stopped because of conflicts.`,
        "Resolve conflicts, run `git add <files>` and `git rebase --continue`, or abort with `git rebase --abort`.",
        `Backup branch: ${state.backupBranch}`,
        "Nothing was pushed.",
      ].join("\n"),
    )
  }

  return true
}

function pushWithRetry(options, state) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = runGit(["push", options.pushRemote, `HEAD:${options.pushBranch}`], {
      allowFailure: true,
      stdio: "inherit",
    })

    if (result.status === 0) return
    if (attempt === 3) throw new Error("Push failed after three attempts")

    console.warn(`Push rejected; refreshing ${options.pushRemote}/${options.pushBranch}`)
    rebaseOntoRemote(options.pushRemote, options.pushBranch, state)
  }
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

  validateContent(options.skipCheck)
  commitLocalChanges(options.message)

  const state = { backupBranch: null }
  rebaseOntoRemote(options.pullRemote, options.pullBranch, state)

  if (
    options.pullRemote !== options.pushRemote ||
    options.pullBranch !== options.pushBranch
  ) {
    rebaseOntoRemote(options.pushRemote, options.pushBranch, state)
  }

  pushWithRetry(options, state)

  console.log(`Repository sync completed in ${options.mode} mode`)
  console.log(`Current branch: ${currentBranch}`)
  console.log(`Rebased onto: ${options.pullRemote}/${options.pullBranch}`)
  console.log(`Pushed to: ${options.pushRemote}/${options.pushBranch}`)
  if (state.backupBranch) console.log(`Backup branch: ${state.backupBranch}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
