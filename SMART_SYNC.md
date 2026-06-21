# Repository Sync

Команда `npm run sync` синхронизирует Git-репозиторий и заменяет использование `npx quartz sync` для заметок.

Перед Git-операциями команда по умолчанию запускает:

```bash
npm run content:validate
```

Если проверка завершается ошибкой, commit, merge и push не выполняются.

Обязательные правила заметок описаны в [`CONTENT_RULES.md`](./CONTENT_RULES.md).

## Реализация

```text
scripts/repository-sync.mjs
scripts/repository-sync-core.mjs
scripts/smart-sync.mjs
scripts/check-content-links.mjs
scripts/ensure-content-indexes.mjs
```

- `repository-sync.mjs` запускает предварительную проверку и обрабатывает `--no-check`;
- `repository-sync-core.mjs` выполняет Git-операции;
- `smart-sync.mjs` объединяет Markdown;
- `check-content-links.mjs` проверяет YAML, ссылки, граф и вложения;
- `ensure-content-indexes.mjs` проверяет индексы каталогов-разделов.

## Режим владельца

```bash
git switch v4
npm run sync
```

Схема:

```text
проверка content/
    ↓
локальный commit
    ↓
резервная ветка
    ↓
fetch и merge origin/v4
    ↓
push без force
```

## Режим контрибьютора

```bash
git remote add knowledge-upstream https://github.com/AlexandrShapkin/knowledge.git
npm run sync -- --contributor
```

В этом режиме изменения получаются из `knowledge-upstream/v4`, а текущая рабочая ветка отправляется в `origin`.

## Предварительная проверка

```bash
npm run content:indexes:check
npm run content:links
```

Проверяются:

- обязательные `index.md` в непустых каталогах-разделах;
- пропуск полностью пустых каталогов;
- пропуск служебных каталогов `!…`;
- YAML frontmatter, `title` и `tags`;
- внутренние Markdown-ссылки;
- связанность заметок;
- расположение и имена вложений.

Каталог считается разделом, если содержит Markdown-файл или непустой дочерний раздел. Полностью пустая директория является заготовкой структуры и не требует `index.md`.

## Пропуск проверки

```bash
npm run sync -- --no-check
npm run sync -- --contributor --no-check
```

`--no-check` отключает только локальную проверку. Проверки Pull Request и deploy остаются обязательными.

## Явная настройка

```bash
npm run sync -- \
  --pull-remote knowledge-upstream \
  --pull-branch v4 \
  --push-remote origin \
  --push-branch docs/my-change
```

Сообщение локального коммита:

```bash
npm run sync -- --message "docs(notes): update SSH notes"
```

## Порядок выполнения

1. Разбирается `--no-check`.
2. Выполняется проверка контента.
3. Проверяется состояние Git.
4. Локальные изменения коммитятся.
5. Создаётся резервная ветка `backup/repository-sync-*`.
6. Получается заданная ветка источника.
7. Выполняется fast-forward или merge.
8. Markdown-конфликты объединяются автоматически.
9. Выполняется push без force.
10. При конкурентном push выполняется до трёх повторов fetch, merge и push.

## Объединение Markdown

Автоматически обрабатываются независимые изменения, списки `tags`, `aliases`, `cssclasses`, Markdown-списки, добавление и удаление файлов.

Если один блок изменён несовместимыми способами, обе версии сохраняются. Результат нужно проверить вручную.

Для конфликтующего не-Markdown-файла сохраняется локальная версия и создаётся отчёт.

## Резервные копии и отчёты

```text
backup/repository-sync-<timestamp>
.git/repository-sync/<timestamp>/
```

## Типовые ошибки

Ошибки контента сначала исправляются командой:

```bash
npm run content:validate
```

Незавершённая Git-операция проверяется через:

```bash
git status
```

Если отсутствует `knowledge-upstream`, добавьте его и повторите синхронизацию.

## Тестирование

```bash
npm run sync:test
node --test scripts/ensure-content-indexes.test.mjs
```
