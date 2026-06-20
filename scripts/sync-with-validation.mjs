import { spawnSync } from "node:child_process"
import path from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

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

export function main(argv = process.argv.slice(2)) {
  const options = parseSyncArgs(argv)

  if (options.skipCheck) {
    console.warn("Проверка content/ пропущена по флагу --no-check")
  } else {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm"
    console.log("Проверка структуры и ссылок content/...")
    run(npm, ["run", "content:validate"])
  }

  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "repository-sync.mjs")
  run(process.execPath, [script, ...options.forwarded])
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
}
