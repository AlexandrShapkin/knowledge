import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  createPublishedIndex,
  findWikilinks,
  resolveRelativeWikilink,
} from "./wikilinks.mjs"
import { loadContentPolicy } from "./content-policy.mjs"

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationScript = path.join(scriptsDirectory, "migrate-wikilinks.mjs")

function markdown(title, body = "") {
  return `---\ntitle: ${title}\ntags:\n  - test\n---\n\n${body}\n`
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "wikilinks-"))
  const section = path.join(root, "content", "Section")
  const assets = path.join(section, "!assets")
  mkdirSync(assets, { recursive: true })
  writeFileSync(
    path.join(root, "quartz.config.yaml"),
    ["configuration:", "  ignorePatterns: []", "plugins: []", ""].join("\n"),
  )
  writeFileSync(path.join(section, "Target.md"), markdown("Target", "Target body."))
  writeFileSync(path.join(assets, "Network diagram.png"), "image")
  return { root, section, assets }
}

test("parses wikilinks, aliases and embeds", () => {
  const links = findWikilinks("[[Target#Heading|Alias]] and ![[!assets/Image.png|Alt 640x480]]")
  assert.deepEqual(
    links.map(({ embedded, target, anchor, alias }) => ({ embedded, target, anchor, alias })),
    [
      { embedded: false, target: "Target", anchor: "Heading", alias: "Alias" },
      { embedded: true, target: "!assets/Image.png", anchor: "", alias: "Alt 640x480" },
    ],
  )
})

test("resolves relative wikilinks case-insensitively", () => {
  const { root, section, assets } = fixture()
  try {
    const policy = loadContentPolicy(root)
    const source = path.join(section, "Source.md")
    writeFileSync(source, markdown("Source", "Source body."))
    const files = [source, path.join(section, "Target.md"), path.join(assets, "Network diagram.png")]
    const index = createPublishedIndex(policy, files, [policy.contentRoot, section, assets])

    assert.equal(resolveRelativeWikilink(policy, index, source, "target").kind, "page")
    assert.equal(
      resolveRelativeWikilink(policy, index, source, "!assets/network diagram.png").kind,
      "asset",
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("migrates internal Markdown links and embeds without touching external links or code", () => {
  const { root, section } = fixture()
  try {
    const sourceFile = path.join(section, "Source.md")
    writeFileSync(
      sourceFile,
      markdown(
        "Source",
        [
          "[Target title](Target.md)",
          "![Network diagram](!assets/Network%20diagram.png)",
          "[External](https://example.com)",
          "`[Code sample](Target.md)`",
        ].join("\n\n"),
      ),
    )

    const result = spawnSync(process.execPath, [migrationScript], { cwd: root, encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)

    const migrated = readFileSync(sourceFile, "utf8")
    assert.match(migrated, /\[\[Target\|Target title\]\]/)
    assert.match(migrated, /!\[\[!assets\/Network diagram\.png\|Network diagram\]\]/)
    assert.match(migrated, /\[External\]\(https:\/\/example\.com\)/)
    assert.match(migrated, /`\[Code sample\]\(Target\.md\)`/)

    const check = spawnSync(process.execPath, [migrationScript, "--check"], {
      cwd: root,
      encoding: "utf8",
    })
    assert.equal(check.status, 0, check.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
