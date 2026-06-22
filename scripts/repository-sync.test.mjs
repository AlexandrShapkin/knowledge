import assert from "node:assert/strict"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { parseArgs } from "./repository-sync.mjs"

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const syncScript = path.join(scriptsDir, "repository-sync.mjs")

function run(command, args, cwd, allowFailure = false) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" })
  if (!allowFailure && result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"))
  }
  return result
}

function git(cwd, ...args) {
  return run("git", args, cwd)
}

function configure(cwd) {
  git(cwd, "config", "user.name", "Sync Test")
  git(cwd, "config", "user.email", "sync-test@example.com")
}

function installScript(cwd) {
  const target = path.join(cwd, "scripts")
  mkdirSync(target, { recursive: true })
  copyFileSync(syncScript, path.join(target, "repository-sync.mjs"))
}

function createSeedRepository(root) {
  const bare = path.join(root, "origin.git")
  const seed = path.join(root, "seed")
  git(root, "init", "--bare", bare)
  git(root, "init", "-b", "main", seed)
  configure(seed)
  mkdirSync(path.join(seed, "content"), { recursive: true })
  writeFileSync(
    path.join(seed, "content", "note.md"),
    "---\ntitle: Note\ntags:\n  - base\n---\n\n# Note\n\nLocal section.\n\nRemote section.\n",
  )
  git(seed, "add", ".")
  git(seed, "commit", "-m", "Initial")
  git(seed, "remote", "add", "origin", bare)
  git(seed, "push", "-u", "origin", "main")
  git(root, "--git-dir", bare, "symbolic-ref", "HEAD", "refs/heads/main")
  return bare
}

test("owner mode uses the current branch on origin", () => {
  assert.deepEqual(parseArgs([], "main"), {
    mode: "owner",
    skipCheck: false,
    pullRemote: "origin",
    pullBranch: "main",
    pushRemote: "origin",
    pushBranch: "main",
    message: null,
  })
})

test("contributor mode rebases onto knowledge-upstream/main and pushes the feature branch", () => {
  assert.deepEqual(parseArgs(["--contributor", "--no-check"], "docs/update"), {
    mode: "contributor",
    skipCheck: true,
    pullRemote: "knowledge-upstream",
    pullBranch: "main",
    pushRemote: "origin",
    pushBranch: "docs/update",
    message: null,
  })
})

test("explicit remotes and branches override mode defaults", () => {
  assert.deepEqual(
    parseArgs(
      [
        "--contributor",
        "--pull-remote",
        "source",
        "--pull-branch",
        "stable",
        "--push-remote",
        "fork",
        "--push-branch",
        "topic",
        "--message",
        "docs: update",
      ],
      "docs/update",
    ),
    {
      mode: "contributor",
      skipCheck: false,
      pullRemote: "source",
      pullBranch: "stable",
      pushRemote: "fork",
      pushBranch: "topic",
      message: "docs: update",
    },
  )
})

test("owner sync rebases non-conflicting local work and pushes without force", () => {
  const root = mkdtempSync(path.join(tmpdir(), "repository-sync-owner-"))
  try {
    const bare = createSeedRepository(root)
    const local = path.join(root, "local")
    const remote = path.join(root, "remote")
    git(root, "clone", bare, local)
    git(root, "clone", bare, remote)
    configure(local)
    configure(remote)
    installScript(local)

    const localFile = path.join(local, "content", "note.md")
    writeFileSync(localFile, readFileSync(localFile, "utf8").replace("Local section.", "Local edit."))

    const remoteFile = path.join(remote, "content", "note.md")
    writeFileSync(remoteFile, readFileSync(remoteFile, "utf8").replace("Remote section.", "Remote edit."))
    git(remote, "add", ".")
    git(remote, "commit", "-m", "Remote edit")
    git(remote, "push", "origin", "main")

    const result = run(
      process.execPath,
      [path.join(local, "scripts", "repository-sync.mjs"), "--no-check", "--message", "docs: local edit"],
      local,
    )
    assert.equal(result.status, 0, result.stderr)

    git(remote, "pull", "--ff-only", "origin", "main")
    const published = readFileSync(remoteFile, "utf8")
    assert.match(published, /Local edit\./)
    assert.match(published, /Remote edit\./)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("sync stops on a conflicting rebase and does not push", () => {
  const root = mkdtempSync(path.join(tmpdir(), "repository-sync-conflict-"))
  try {
    const bare = createSeedRepository(root)
    const local = path.join(root, "local")
    const remote = path.join(root, "remote")
    git(root, "clone", bare, local)
    git(root, "clone", bare, remote)
    configure(local)
    configure(remote)
    installScript(local)

    const localFile = path.join(local, "content", "note.md")
    writeFileSync(localFile, readFileSync(localFile, "utf8").replace("Local section.", "Local replacement."))

    const remoteFile = path.join(remote, "content", "note.md")
    writeFileSync(remoteFile, readFileSync(remoteFile, "utf8").replace("Local section.", "Remote replacement."))
    git(remote, "add", ".")
    git(remote, "commit", "-m", "Remote replacement")
    git(remote, "push", "origin", "main")
    const remoteHead = git(remote, "rev-parse", "HEAD").stdout.trim()

    const result = run(
      process.execPath,
      [path.join(local, "scripts", "repository-sync.mjs"), "--no-check"],
      local,
      true,
    )
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Nothing was pushed/)
    assert.equal(git(root, "--git-dir", bare, "rev-parse", "main").stdout.trim(), remoteHead)
    assert.match(git(local, "branch", "--list", "backup/repository-sync-*").stdout, /backup\/repository-sync-/)

    git(local, "rebase", "--abort")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
