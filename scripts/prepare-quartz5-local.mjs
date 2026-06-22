import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()

function run(command, args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    shell: process.platform === "win32",
  })

  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n")
    throw new Error(`${command} ${args.join(" ")} завершилась с кодом ${result.status}${details ? `\n${details}` : ""}`)
  }

  return capture ? (result.stdout ?? "").trim() : result.status
}

function writeJsonAsYaml(file, value) {
  // JSON является допустимым подмножеством YAML 1.2.
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function replaceBranchReferences(file) {
  if (!existsSync(file)) return
  const content = readFileSync(file, "utf8")
  writeFileSync(file, content.replaceAll("v4", "main"), "utf8")
}

function checkoutPaths(ref, files) {
  const existing = files.filter((file) => {
    return run("git", ["cat-file", "-e", `${ref}:${file}`], { capture: true, allowFailure: true }) === ""
      ? true
      : run("git", ["cat-file", "-e", `${ref}:${file}`], { allowFailure: true }) === 0
  })

  if (existing.length > 0) run("git", ["checkout", ref, "--", ...existing])
  return existing
}

function plugin(source, enabled = true, extra = {}) {
  return { source: `github:quartz-community/${source}`, enabled, ...extra }
}

const branch = run("git", ["branch", "--show-current"], { capture: true })
if (branch !== "migration/quartz5") {
  throw new Error(`Скрипт разрешено запускать только в migration/quartz5. Текущая ветка: ${branch}`)
}

const status = run("git", ["status", "--porcelain"], { capture: true })
if (status) {
  throw new Error("Перед запуском рабочее дерево должно быть чистым. Выполните git status.")
}

console.log("1/7 Получение актуальной main")
run("git", ["fetch", "origin", "main"])

console.log("2/7 Перенос репозиторных scripts и документации")
const scriptFiles = run("git", ["ls-tree", "-r", "--name-only", "origin/main", "--", "scripts"], {
  capture: true,
})
  .split(/\r?\n/)
  .filter(Boolean)

const documentationFiles = [
  "README.md",
  "CONTENT_RULES.md",
  "SMART_SYNC.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
]

run("git", ["checkout", "origin/main", "--", ...scriptFiles, ...documentationFiles])

for (const file of [...scriptFiles, ...documentationFiles]) replaceBranchReferences(file)

console.log("3/7 Объединение package.json")
const packageFile = path.join(root, "package.json")
const pkg = JSON.parse(readFileSync(packageFile, "utf8"))

pkg.scripts = {
  ...pkg.scripts,
  sync: "node scripts/repository-sync.mjs",
  "sync:test": "node --test scripts/smart-sync.test.mjs scripts/repository-sync.test.mjs",
  "content:links": "node scripts/check-content-links.mjs",
  "content:indexes": "node scripts/ensure-content-indexes.mjs",
  "content:indexes:check": "node scripts/ensure-content-indexes.mjs --check",
  "content:validate": "npm run content:indexes:check && npm run content:links",
}

pkg.dependencies = {
  ...pkg.dependencies,
  "gray-matter": "^4.0.3",
  "remark-frontmatter": "^5.0.0",
  "remark-gfm": "^4.0.1",
}

writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`, "utf8")

console.log("4/7 Создание конфигурации Quartz 5")
const quartzConfig = {
  $schema: "./quartz/plugins/quartz-plugins.schema.json",
  configuration: {
    pageTitle: "База знаний",
    pageTitleSuffix: "📚",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "goatcounter",
      websiteId: "knowledge",
    },
    locale: "ru-RU",
    baseUrl: "knowledge.alexandrshapkin.ru",
    ignorePatterns: ["private", "templates", ".obsidian", "!Meta"],
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Schibsted Grotesk",
        body: "Source Sans Pro",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#faf8f8",
          lightgray: "#e5e5e5",
          gray: "#b8b8b8",
          darkgray: "#4e4e4e",
          dark: "#2b2b2b",
          secondary: "#284b63",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#161618",
          lightgray: "#393639",
          gray: "#646464",
          darkgray: "#d4d4d4",
          dark: "#ebebec",
          secondary: "#7b97aa",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: [
    plugin("created-modified-date", true, {
      options: {
        defaultDateType: "modified",
        priority: ["frontmatter", "filesystem", "git"],
      },
      order: 10,
    }),
    plugin("syntax-highlighting", true, {
      options: {
        theme: { light: "github-light", dark: "github-dark" },
        keepBackground: false,
      },
      order: 20,
    }),
    plugin("obsidian-flavored-markdown", true, {
      options: { enableInHtmlEmbed: false, enableCheckbox: true },
      order: 30,
    }),
    plugin("github-flavored-markdown", true, { order: 40 }),
    plugin("table-of-contents", true, {
      order: 50,
      layout: { position: "right", priority: 30, display: "desktop-only" },
    }),
    plugin("crawl-links", true, {
      options: { markdownLinkResolution: "relative" },
      order: 60,
    }),
    plugin("description", true, { order: 70 }),
    plugin("latex", true, { options: { renderEngine: "katex" }, order: 80 }),
    plugin("fonts"),
    plugin("remove-draft"),
    plugin("alias-redirects"),
    plugin("content-index", true, {
      options: { enableSiteMap: true, enableRSS: true },
    }),
    plugin("favicon"),
    plugin("og-image"),
    plugin("cname"),
    plugin("content-page"),
    plugin("folder-page"),
    plugin("tag-page"),
    plugin("explorer", true, {
      layout: { position: "left", priority: 50 },
    }),
    plugin("graph", true, {
      layout: { position: "right", priority: 10 },
    }),
    plugin("search", true, {
      layout: {
        position: "left",
        priority: 20,
        group: "toolbar",
        groupOptions: { grow: true },
      },
    }),
    plugin("backlinks", true, {
      layout: { position: "afterBody", priority: 10 },
    }),
    plugin("article-title", true, {
      layout: { position: "beforeBody", priority: 10 },
    }),
    plugin("content-meta", true, {
      layout: { position: "beforeBody", priority: 20 },
    }),
    plugin("tag-list", true, {
      layout: { position: "beforeBody", priority: 30 },
    }),
    plugin("page-title", true, {
      layout: { position: "left", priority: 10 },
    }),
    plugin("darkmode", true, {
      layout: { position: "left", priority: 30, group: "toolbar" },
    }),
    plugin("reader-mode", true, {
      layout: { position: "left", priority: 35, group: "toolbar" },
    }),
    plugin("breadcrumbs", true, {
      layout: { position: "beforeBody", priority: 5, condition: "not-index" },
    }),
    plugin("footer", true, {
      options: {
        links: {
          GitHub: "https://github.com/AlexandrShapkin/knowledge",
          Telegram: "https://t.me/AlexandrShapkin",
          "Quartz GitHub": "https://github.com/jackyzha0/quartz",
        },
      },
    }),
    plugin("recent-notes", true, {
      options: {
        title: "Последние изменения",
        limit: 5,
        showTags: false,
      },
      layout: { position: "right", priority: 20 },
    }),
    plugin("spacer", true, {
      options: {},
      order: 25,
      layout: { position: "left", priority: 25, display: "mobile-only" },
    }),
  ],
  layout: {
    groups: {
      toolbar: {
        priority: 35,
        direction: "row",
        gap: "0.5rem",
      },
    },
    byPageType: {
      "404": {
        positions: {
          beforeBody: [],
          left: [],
          right: [],
        },
      },
      content: {},
      folder: {
        exclude: ["reader-mode"],
        positions: { right: [] },
      },
      tag: {
        exclude: ["reader-mode"],
        positions: { right: [] },
      },
    },
  },
}

writeJsonAsYaml(path.join(root, "quartz.config.yaml"), quartzConfig)

console.log("5/7 Настройка GitHub Actions для Quartz 5")
mkdirSync(path.join(root, ".github", "workflows"), { recursive: true })

writeFileSync(
  path.join(root, ".github", "workflows", "deploy.yml"),
  `name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - main
    paths-ignore:
      - README.md
      - CONTRIBUTING.md
      - CONTENT_RULES.md
      - SMART_SYNC.md
      - AGENTS.md
      - CODE_OF_CONDUCT.md
      - LICENSE.txt
      - docs/**

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v6
        with:
          node-version: 22.17
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Quartz plugins
        run: npm run install-plugins

      - name: Validate content contract
        run: npm run content:validate

      - name: Test synchronization
        run: npm run sync:test

      - name: Build Quartz
        run: npx quartz build

      - name: Upload GitHub Pages artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: ./public

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
`,
  "utf8",
)

writeFileSync(
  path.join(root, ".github", "workflows", "validate-content-links.yml"),
  `name: Validate Quartz 5 migration

on:
  pull_request:
    branches:
      - main
    paths:
      - content/**
      - scripts/**
      - package.json
      - package-lock.json
      - quartz.config.yaml
      - quartz.lock.json
      - quartz.ts
      - .github/workflows/**

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v6
        with:
          node-version: 22.17
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Quartz plugins
        run: npm run install-plugins

      - name: Test directory index rules
        run: node --test scripts/ensure-content-indexes.test.mjs

      - name: Validate content
        run: npm run content:validate

      - name: Test synchronization
        run: npm run sync:test

      - name: Type-check Quartz
        run: npx tsc --noEmit

      - name: Build Quartz
        run: npx quartz build
`,
  "utf8",
)

console.log("6/7 Подготовка завершена")
console.log("Теперь выполните:")
console.log("  npm install")
console.log("  npm run install-plugins")
console.log("  npm run sync:test")
console.log("  npm run content:validate")
console.log("  npx tsc --noEmit")
console.log("  npx quartz build")
console.log("")
console.log("7/7 После успешных проверок зафиксируйте изменения отдельным коммитом.")
