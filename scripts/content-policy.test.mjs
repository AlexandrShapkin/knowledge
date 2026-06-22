import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import {
  isAssetPath,
  isServicePath,
  listContentDirectories,
  listContentFiles,
  loadContentPolicy,
  relativeContentPath,
} from "./content-policy.mjs"

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "content-policy-"))
  const content = path.join(root, "content")
  mkdirSync(path.join(content, "Linux", "!assets"), { recursive: true })
  mkdirSync(path.join(content, "!Meta"), { recursive: true })
  mkdirSync(path.join(content, "private"), { recursive: true })
  mkdirSync(path.join(content, "templates"), { recursive: true })

  writeFileSync(
    path.join(root, "quartz.config.yaml"),
    [
      "configuration:",
      "  ignorePatterns:",
      "    - private",
      "    - templates",
      '    - "\\\\!Meta/**"',
      "plugins: []",
      "",
    ].join("\n"),
  )
  writeFileSync(path.join(content, "Linux", "note.md"), "visible")
  writeFileSync(path.join(content, "Linux", "!assets", "diagram.png"), "asset")
  writeFileSync(path.join(content, "!Meta", "workspace.md"), "ignored")
  writeFileSync(path.join(content, "private", "secret.md"), "ignored")
  writeFileSync(path.join(content, "templates", "note.md"), "ignored")

  return root
}

test("Quartz ignorePatterns are reused by project tooling", () => {
  const root = createFixture()
  try {
    const policy = loadContentPolicy(root)
    const files = listContentFiles(policy).map((file) => relativeContentPath(policy, file)).sort()
    const directories = listContentDirectories(policy)
      .map((file) => relativeContentPath(policy, file))
      .sort()

    assert.deepEqual(files, ["Linux/!assets/diagram.png", "Linux/note.md"])
    assert.deepEqual(directories, ["", "Linux", "Linux/!assets"])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("service and asset paths are classified separately", () => {
  const root = createFixture()
  try {
    const policy = loadContentPolicy(root)
    const note = path.join(policy.contentRoot, "Linux", "note.md")
    const asset = path.join(policy.contentRoot, "Linux", "!assets", "diagram.png")

    assert.equal(isServicePath(policy, note), false)
    assert.equal(isServicePath(policy, asset), true)
    assert.equal(isAssetPath(policy, note), false)
    assert.equal(isAssetPath(policy, asset), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
