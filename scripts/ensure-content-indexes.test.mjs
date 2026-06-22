import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url))
const script = path.join(scriptsDirectory, "ensure-content-indexes.mjs")

function markdown(title) {
  return `---\ntitle: ${title}\ntags:\n  - test\n---\n\n${title}\n`
}

function run(root, ...args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  })
}

test("check mode ignores completely empty directories", () => {
  const root = mkdtempSync(path.join(tmpdir(), "content-indexes-check-"))

  try {
    mkdirSync(path.join(root, "content", "Empty"), { recursive: true })
    mkdirSync(path.join(root, "content", "Active", "EmptyChild"), { recursive: true })
    writeFileSync(path.join(root, "content", "index.md"), markdown("Root"))
    writeFileSync(path.join(root, "content", "Active", "Note.md"), markdown("Note"))

    const reportFile = path.join(root, "report.json")
    const result = run(root, "--check", "--report", reportFile)
    const report = JSON.parse(readFileSync(reportFile, "utf8"))

    assert.equal(result.status, 1)
    assert.deepEqual(report.missingIndexes, ["content/Active/index.md"])
    assert.deepEqual(report.ignoredEmptyDirectories.sort(), [
      "content/Active/EmptyChild",
      "content/Empty",
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("generated indexes exclude empty child directories", () => {
  const root = mkdtempSync(path.join(tmpdir(), "content-indexes-write-"))

  try {
    mkdirSync(path.join(root, "content", "Section", "EmptyChild"), { recursive: true })
    writeFileSync(path.join(root, "content", "index.md"), markdown("Root"))
    writeFileSync(path.join(root, "content", "Section", "Note.md"), markdown("Note"))

    const result = run(root)
    const generated = readFileSync(path.join(root, "content", "Section", "index.md"), "utf8")

    assert.equal(result.status, 0)
    assert.match(generated, /\[Note\]\(Note\.md\)/)
    assert.doesNotMatch(generated, /EmptyChild/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
