import { readFileSync, writeFileSync } from "node:fs"

const replacements = [
  {
    file: "content/ssh/Диагностика SSH.md",
    from: "[SSH-ключ](content/ssh/SSH%20ключи/index.md)",
    to: "[SSH-ключ](SSH%20ключи/index.md)",
  },
  {
    file: "content/ssh/SSH ключи/index.md",
    from: "[Диагностика SSH](Диагностика%20SSH.md)",
    to: "[Диагностика SSH](../Диагностика%20SSH.md)",
  },
]

for (const replacement of replacements) {
  const source = readFileSync(replacement.file, "utf8")
  const occurrences = source.split(replacement.from).length - 1

  if (occurrences !== 1) {
    throw new Error(
      `${replacement.file}: ожидалось одно вхождение ${JSON.stringify(replacement.from)}, найдено ${occurrences}`,
    )
  }

  writeFileSync(replacement.file, source.replace(replacement.from, replacement.to))
  console.log(`Исправлена ссылка в ${replacement.file}`)
}
