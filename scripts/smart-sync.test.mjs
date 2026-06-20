import assert from "node:assert/strict"
import test from "node:test"
import { mergeMarkdown } from "./smart-sync.mjs"

test("merges independent markdown sections", () => {
  const base = `---
title: SSH
tags:
  - ssh
---
# SSH

Base introduction.

## Client

Base client text.

## Server

Base server text.
`
  const ours = base.replace("Base client text.", "Local client text.")
  const theirs = base.replace("Base server text.", "Remote server text.")
  const result = mergeMarkdown(base, ours, theirs)
  assert.match(result, /Local client text\./)
  assert.match(result, /Remote server text\./)
})

test("unions concurrently changed frontmatter tags", () => {
  const base = `---
title: SSH
tags:
  - ssh
---
Body
`
  const ours = base.replace("  - ssh", "  - ssh\n  - linux")
  const theirs = base.replace("  - ssh", "  - ssh\n  - security")
  const result = mergeMarkdown(base, ours, theirs)
  assert.match(result, /  - ssh/)
  assert.match(result, /  - linux/)
  assert.match(result, /  - security/)
})

test("unions conflicting markdown lists", () => {
  const base = `# Checklist

- base
`
  const ours = `# Checklist

- base
- local
`
  const theirs = `# Checklist

- base
- remote
`
  const result = mergeMarkdown(base, ours, theirs)
  assert.match(result, /- local/)
  assert.match(result, /- remote/)
})

test("preserves both variants when a paragraph cannot be merged cleanly", () => {
  const records = []
  const base = `# Note

Original text
`
  const ours = `# Note

Local replacement
`
  const theirs = `# Note

Remote replacement
`
  const result = mergeMarkdown(base, ours, theirs, (entry) => records.push(entry))
  assert.match(result, /Local replacement/)
  assert.match(result, /Remote replacement/)
  assert.ok(records.length > 0)
})
