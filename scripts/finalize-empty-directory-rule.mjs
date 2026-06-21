import { readFileSync, unlinkSync, writeFileSync } from "node:fs"

function replaceExact(file, before, after) {
  const source = readFileSync(file, "utf8")
  const occurrences = source.split(before).length - 1
  if (occurrences !== 1) {
    throw new Error(`${file}: expected one occurrence, found ${occurrences}: ${before}`)
  }
  writeFileSync(file, source.replace(before, after), "utf8")
}

replaceExact(
  "README.md",
  "Каждый обычный каталог внутри `content/` должен содержать `index.md`. Каталоги, название которых начинается с `!`, являются служебными и не требуют индекса.",
  "Каждый непустой каталог-раздел внутри `content/` должен содержать `index.md`. Полностью пустые каталоги игнорируются до появления в них заметки или непустого дочернего раздела. Каталоги, название которых начинается с `!`, являются служебными и не требуют индекса.",
)
replaceExact(
  "README.md",
  "Проверяются индексы каталогов, YAML, теги, ссылки, связанность графа, расположение вложений и итоговая сборка Quartz.",
  "Проверяются индексы непустых каталогов-разделов, YAML, теги, ссылки, связанность графа, расположение вложений и итоговая сборка Quartz. Полностью пустые каталоги не считаются разделами.",
)

replaceExact(
  "CONTENT_RULES.md",
  "Каждый обычный каталог внутри `content/` обязан содержать `index.md`, даже если в нём пока мало материалов.",
  "Каждый непустой каталог-раздел внутри `content/` обязан содержать `index.md`. Каталог считается непустым, если в нём есть хотя бы один Markdown-файл или хотя бы один непустой дочерний раздел. Полностью пустой каталог является заготовкой структуры, не считается разделом базы, не включается в родительский индекс и не требует `index.md`.",
)
replaceExact(
  "CONTENT_RULES.md",
  "3. Убедиться, что в каталоге есть `index.md`.",
  "3. Если после добавления заметки каталог становится непустым, убедиться, что в нём есть `index.md`.",
)
replaceExact(
  "CONTENT_RULES.md",
  "- наличие `index.md` в обычных каталогах;",
  "- наличие `index.md` в непустых каталогах-разделах и пропуск полностью пустых каталогов;",
)
replaceExact(
  "CONTENT_RULES.md",
  "- [ ] В каждом обычном каталоге есть `index.md`.",
  "- [ ] В каждом непустом каталоге-разделе есть `index.md`; полностью пустые каталоги оставлены без индекса.",
)

replaceExact(
  "CONTRIBUTING.md",
  "4. убедитесь, что в каталоге есть `index.md`;",
  "4. учтите, что после добавления заметки каталог становится разделом и должен содержать `index.md`;",
)
replaceExact(
  "CONTRIBUTING.md",
  "Для каталогов, название которых начинается с `!`, `index.md` не требуется.",
  "Для каталогов, название которых начинается с `!`, `index.md` не требуется. Полностью пустые каталоги также не считаются разделами и не требуют индекса до появления в них заметки или непустого дочернего раздела.",
)
replaceExact(
  "CONTRIBUTING.md",
  "- наличие `index.md` во всех обычных каталогах;",
  "- наличие `index.md` во всех непустых каталогах-разделах и пропуск полностью пустых каталогов;",
)
replaceExact(
  "CONTRIBUTING.md",
  "- [ ] в каждом обычном каталоге есть `index.md`;",
  "- [ ] в каждом непустом каталоге-разделе есть `index.md`; полностью пустые каталоги не требуют индекса;",
)

replaceExact(
  "content/Формат заметок.md",
  "Каждый обычный каталог внутри `content/` содержит `index.md`.",
  "Каждый непустой каталог-раздел внутри `content/` содержит `index.md`. Полностью пустой каталог не считается разделом, не включается в навигацию и не требует индекса до появления в нём заметки или непустого дочернего раздела.",
)
replaceExact(
  "content/Формат заметок.md",
  "Команда проверяет индексы каталогов, frontmatter, теги, внутренние ссылки, связанность заметок и расположение вложений.",
  "Команда проверяет индексы непустых каталогов-разделов, пропускает полностью пустые каталоги, а также проверяет frontmatter, теги, внутренние ссылки, связанность заметок и расположение вложений.",
)

replaceExact(
  "SMART_SYNC.md",
  "- обязательные `index.md` в обычных каталогах;",
  "- обязательные `index.md` в непустых каталогах-разделах и пропуск полностью пустых каталогов;",
)

replaceExact(
  "AGENTS.md",
  "- сохранять корректный frontmatter.",
  "- сохранять корректный frontmatter;\n- не создавать `index.md` в полностью пустых каталогах: индекс требуется только каталогу с заметкой или непустым дочерним разделом.",
)

writeFileSync(
  ".github/workflows/validate-content-links.yml",
  `name: Validate content

on:
  pull_request:
    branches:
      - v4
    paths:
      - content/**
      - templates/**
      - CONTENT_RULES.md
      - package.json
      - package-lock.json
      - scripts/**
      - .github/workflows/validate-content-links.yml

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 22.17

      - name: Install dependencies
        run: npm ci

      - name: Test directory index rules
        run: node --test scripts/ensure-content-indexes.test.mjs

      - name: Validate directory indexes
        id: indexes
        continue-on-error: true
        run: npm run content:indexes:check

      - name: Validate links, metadata and assets
        id: content
        continue-on-error: true
        run: node scripts/check-content-links.mjs --report content-validation-report.json

      - name: Upload validation report
        if: always()
        uses: actions/upload-artifact@v6
        with:
          name: content-validation-report
          path: content-validation-report.json
          if-no-files-found: ignore
          retention-days: 14

      - name: Fail on validation errors
        if: steps.indexes.outcome == 'failure' || steps.content.outcome == 'failure'
        run: exit 1

      - name: Test synchronization
        run: npm run sync:test

      - name: Build Quartz
        run: npx quartz build
`,
  "utf8",
)

unlinkSync("scripts/finalize-empty-directory-rule.mjs")
