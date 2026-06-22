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

function configure(root) {
  writeFileSync(
    path.join(root, "quartz.config.yaml"),
    [
      "configuration:",
      "  ignorePatterns:",
      "    - private",
      '    - "\\\\!Meta/**"',
      "plugins: []",
      "",
    ].join("\n"),
  )
}

function run(root, ...args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  })
}

test("check mode ignores completely empty and Quartz-ignored directories", () => {
  const root = mkdtempSync(path.join(tmpdir(), "content-indexes-check-"))

  try {
    mkdirSync(path.join(root, "content", "Empty"), { recursive: true })
    mkdirSync(path.join(root, "content", "Active", "EmptyChild"), { recursive: true })
    mkdirSync(path.join(root, "content", "!Meta"), { recursive: true })
    mkdirSync(path.join(root, "content", "private"), { recursive: true })
    configure(root)
    writeFileSync(path.join(root, "content", "index.md"), markdown("Root"))
    writeFileSync(path.join(root, "content", "Active", "Note.md"), markdown("Note"))
    writeFileSync(path.join(root, "content", "!Meta", "Workspace.md"), markdown("Workspace"))
    writeFileSync(path.join(root, "content", "private", "Secret.md"), markdown("Secret"))

    const reportFile = path.join(root, "report.json")
    const result = run(root, "--check", "--report", reportFile)
    const report = JSON.parse(readFileSync(reportFile, "utf8"))

    assert.equal(result.status, 1)
    assert.deepEqual(report.missingIndexes, ["content/Active/index.md"])
    assert.deepEqual(report.ignoredEmptyDirectories.sort(), [
      "content/Active/EmptyChild",
      "content/Empty",
    ])
    assert.doesNotMatch(JSON.stringify(report), /!Meta|private/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("generated indexes use wikilinks and exclude empty and ignored child directories", () => {
  const root = mkdtempSync(path.join(tmpdir(), "content-indexes-write-"))

  try {
    mkdirSync(path.join(root, "content", "Section", "EmptyChild"), { recursive: true })
    mkdirSync(path.join(root, "content", "Section", "!Meta"), { recursive: true })
    configure(root)
    writeFileSync(path.join(root, "content", "index.md"), markdown("Root"))
    writeFileSync(path.join(root, "content", "Section", "Note.md"), markdown("Note"))
    writeFileSync(path.join(root, "content", "Section", "!Meta", "Workspace.md"), markdown("Workspace"))

    const result = run(root)
    const generated = readFileSync(path.join(root, "content", "Section", "index.md"), "utf8")

    assert.equal(result.status, 0, result.stderr)
    assert.match(generated, /\[\[Note\|Note\]\]/)
    assert.doesNotMatch(generated, /EmptyChild|!Meta|Workspace/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
