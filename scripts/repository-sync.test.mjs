import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { parseArgs } from "./repository-sync.mjs"

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const syncScript = path.join(scriptsDir, "repository-sync.mjs")
const syncCoreScript = path.join(scriptsDir, "repository-sync-core.mjs")
const mergeScript = path.join(scriptsDir, "smart-sync.mjs")

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

function installScripts(cwd) {
  const target = path.join(cwd, "scripts")
  mkdirSync(target, { recursive: true })
  copyFileSync(syncScript, path.join(target, "repository-sync.mjs"))
  copyFileSync(syncCoreScript, path.join(target, "repository-sync-core.mjs"))
  copyFileSync(mergeScript, path.join(target, "smart-sync.mjs"))
}

function createSeedRepository(root) {
  const bare = path.join(root, "origin.git")
  const seed = path.join(root, "seed")
  git(root, "init", "--bare", bare)
  git(root, "init", "-b", "v4", seed)
  configure(seed)
  mkdirSync(path.join(seed, "content"), { recursive: true })
  writeFileSync(
    path.join(seed, "content", "note.md"),
    "---\ntitle: Note\ntags:\n  - base\n---\n\n# Note\n\n## Local\n\nBase local.\n\n## Remote\n\nBase remote.\n",
  )
  git(seed, "add", ".")
  git(seed, "commit", "-m", "Initial")
  git(seed, "remote", "add", "origin", bare)
  git(seed, "push", "-u", "origin", "v4")
  git(root, "--git-dir", bare, "symbolic-ref", "HEAD", "refs/heads/v4")
  return bare
}

test("owner mode uses the current branch on origin", () => {
  assert.deepEqual(parseArgs([], "v4"), {
    mode: "owner",
    pullRemote: "origin",
    pullBranch: "v4",
    pushRemote: "origin",
    pushBranch: "v4",
    message: null,
  })
})

test("contributor mode pulls v4 from knowledge-upstream and pushes the current branch", () => {
  assert.deepEqual(parseArgs(["--contributor"], "docs/update"), {
    mode: "contributor",
    pullRemote: "knowledge-upstream",
    pullBranch: "v4",
    pushRemote: "origin",
    pushBranch: "docs/update",
    message: null,
  })
})

test("owner sync combines independent local and remote Markdown changes", () => {
  const root = mkdtempSync(path.join(tmpdir(), "repository-sync-owner-"))
  try {
    const bare = createSeedRepository(root)
    const local = path.join(root, "local")
    const remote = path.join(root, "remote")
    git(root, "clone", bare, local)
    git(root, "clone", bare, remote)
    configure(local)
    configure(remote)
    installScripts(local)

    const localFile = path.join(local, "content", "note.md")
    writeFileSync(localFile, readFileSync(localFile, "utf8").replace("Base local.", "Local edit."))

    const remoteFile = path.join(remote, "content", "note.md")
    writeFileSync(remoteFile, readFileSync(remoteFile, "utf8").replace("Base remote.", "Remote edit."))
    git(remote, "add", ".")
    git(remote, "commit", "-m", "Remote edit")
    git(remote, "push", "origin", "v4")

    const result = run(process.execPath, [path.join(local, "scripts", "repository-sync.mjs")], local)
    assert.equal(result.status, 0)

    const merged = readFileSync(localFile, "utf8")
    assert.match(merged, /Local edit\./)
    assert.match(merged, /Remote edit\./)

    git(remote, "pull", "--ff-only", "origin", "v4")
    const published = readFileSync(remoteFile, "utf8")
    assert.match(published, /Local edit\./)
    assert.match(published, /Remote edit\./)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("contributor sync pulls upstream v4 and pushes only the feature branch to the fork", () => {
  const root = mkdtempSync(path.join(tmpdir(), "repository-sync-contributor-"))
  try {
    const upstream = createSeedRepository(root)
    const fork = path.join(root, "fork.git")
    git(root, "clone", "--bare", upstream, fork)

    const contributor = path.join(root, "contributor")
    const maintainer = path.join(root, "maintainer")
    git(root, "clone", fork, contributor)
    git(root, "clone", upstream, maintainer)
    configure(contributor)
    configure(maintainer)
    installScripts(contributor)
    git(contributor, "remote", "add", "knowledge-upstream", upstream)
    git(contributor, "switch", "-c", "docs/update")

    const contributorFile = path.join(contributor, "content", "note.md")
    writeFileSync(
      contributorFile,
      readFileSync(contributorFile, "utf8").replace("Base local.", "Contributor edit."),
    )

    const maintainerFile = path.join(maintainer, "content", "note.md")
    writeFileSync(
      maintainerFile,
      readFileSync(maintainerFile, "utf8").replace("Base remote.", "Maintainer edit."),
    )
    git(maintainer, "add", ".")
    git(maintainer, "commit", "-m", "Maintainer edit")
    git(maintainer, "push", "origin", "v4")

    const result = run(
      process.execPath,
      [path.join(contributor, "scripts", "repository-sync.mjs"), "--contributor"],
      contributor,
    )
    assert.equal(result.status, 0)

    const merged = readFileSync(contributorFile, "utf8")
    assert.match(merged, /Contributor edit\./)
    assert.match(merged, /Maintainer edit\./)

    const verify = path.join(root, "verify")
    git(root, "clone", fork, verify)
    git(verify, "switch", "docs/update")
    const published = readFileSync(path.join(verify, "content", "note.md"), "utf8")
    assert.match(published, /Contributor edit\./)
    assert.match(published, /Maintainer edit\./)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
