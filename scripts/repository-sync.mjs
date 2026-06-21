import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

export function parseArgs(argv, currentBranch) {
  const options = {
    mode: "owner",
    pullRemote: "origin",
    pullBranch: currentBranch,
    pushRemote: "origin",
    pushBranch: currentBranch,
    message: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === "--contributor") {
      options.mode = "contributor"
      options.pullRemote = "knowledge-upstream"
      options.pullBranch = "v4"
    } else if (value === "--pull-remote") options.pullRemote = argv[++index]
    else if (value === "--pull-branch") options.pullBranch = argv[++index]
    else if (value === "--push-remote") options.pushRemote = argv[++index]
    else if (value === "--push-branch") options.pushBranch = argv[++index]
    else if (value === "--message") options.message = argv[++index]
    else throw new Error(`Unknown argument: ${value}`)
  }

  return options
}

export function parseSyncArgs(argv) {
  return {
    skipCheck: argv.includes("--no-check"),
    forwarded: argv.filter((argument) => argument !== "--no-check"),
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function corePath() {
  const local = path.join(path.dirname(fileURLToPath(import.meta.url)), "repository-sync-core.mjs")
  if (existsSync(local)) return local

  const fallback = process.env.INIT_CWD
    ? path.join(process.env.INIT_CWD, "scripts", "repository-sync-core.mjs")
    : ""
  if (fallback && existsSync(fallback)) return fallback

  throw new Error("repository-sync-core.mjs not found")
}

export function main(argv = process.argv.slice(2)) {
  const options = parseSyncArgs(argv)
  const validator = path.resolve("scripts/check-content-links.mjs")
  const packageFile = path.resolve("package.json")

  if (options.skipCheck) {
    console.warn("Проверка content/ пропущена по флагу --no-check")
  } else if (existsSync(validator) && existsSync(packageFile)) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm"
    run(npm, ["run", "content:validate"])
  }

  run(process.execPath, [corePath(), ...options.forwarded])
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
