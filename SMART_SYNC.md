# Repository Sync

Команда `npm run sync` синхронизирует Git-репозиторий и заменяет использование `npx quartz sync` для заметок.

Перед Git-операциями команда по умолчанию запускает полную проверку контента:

```bash
npm run content:validate
```

Если проверка завершается ошибкой, commit, merge и push не выполняются.

Обязательные правила заметок описаны в [`CONTENT_RULES.md`](./CONTENT_RULES.md).

## Почему используется отдельная команда

Стандартная команда Quartz сохраняет каталог `content` во временный кэш, удаляет его перед `git pull`, а затем возвращает локальную копию. Это подходит для модели Quartz, где контент хранится отдельно, но мешает двустороннему редактированию заметок через GitHub.

Реализация репозитория находится в:

```text
scripts/repository-sync.mjs
scripts/repository-sync-core.mjs
scripts/smart-sync.mjs
scripts/check-content-links.mjs
```

Назначение файлов:

- `repository-sync.mjs` — предварительная проверка и обработка `--no-check`;
- `repository-sync-core.mjs` — Git-операции, резервная ветка, fetch, merge и push;
- `smart-sync.mjs` — трёхстороннее объединение Markdown;
- `check-content-links.mjs` — проверка YAML, ссылок, графа и вложений.

## Режим владельца

По умолчанию команда синхронизирует текущую ветку с одноимённой веткой в `origin`:

```bash
npm run sync
```

Для основной базы:

```bash
git switch v4
npm run sync
```

Схема:

```text
проверка content/
    ↓
локальные изменения
    ↓ commit
резервная ветка
    ↓ fetch origin/v4
трёхсторонний merge
    ↓ push без force
origin/v4
```

## Режим контрибьютора

Настройте remotes:

```bash
git remote add knowledge-upstream https://github.com/AlexandrShapkin/knowledge.git
```

Работайте в отдельной ветке и запускайте:

```bash
npm run sync -- --contributor
```

В этом режиме:

```text
получение: knowledge-upstream/v4
отправка:  origin/<текущая-ветка>
```

Имя `knowledge-upstream` выбрано намеренно. Remote `upstream` используется Quartz для получения обновлений движка.

## Предварительная проверка

До любых Git-изменений выполняется:

```bash
npm run content:validate
```

Команда включает:

```bash
npm run content:indexes:check
npm run content:links
```

Проверяются:

- обязательные `index.md` в обычных каталогах;
- пропуск служебных каталогов `!…`;
- YAML frontmatter, `title` и `tags`;
- внутренние Markdown-ссылки и существование файлов;
- связанность заметок;
- размещение вложений в локальном `!assets`;
- понятность имён вложений.

Смысловая атомарность и законченность текста проверяются вручную.

## Пропуск проверки

В аварийной ситуации локальную проверку можно отключить:

```bash
npm run sync -- --no-check
npm run sync -- --contributor --no-check
```

Флаг `--no-check`:

- удаляется из аргументов до запуска Git-ядра;
- отключает только предварительный локальный запуск `content:validate`;
- не отключает проверки Pull Request;
- не отключает проверку перед deploy;
- не разрешает merge невалидного контента в `v4`.

Флаг предназначен для сохранения или передачи промежуточного состояния. Использовать его как постоянный режим работы не следует.

## Явная настройка

Можно задать обе стороны отдельно:

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

Флаги можно сочетать с `--no-check`.

## Порядок выполнения

1. Разбирается флаг `--no-check`.
2. Если обход не задан, выполняется `npm run content:validate`.
3. Проверяется, что команда запущена внутри Git-репозитория.
4. Проверяется отсутствие незавершённого merge, rebase, cherry-pick или revert.
5. Все локальные изменения добавляются и коммитятся.
6. Создаётся резервная ветка `backup/repository-sync-*`.
7. Получается заданная ветка источника.
8. Выполняется fast-forward или обычный merge.
9. Конфликты Markdown разрешаются автоматически.
10. При раздельных pull/push remotes также получается удалённая ветка назначения.
11. Выполняется push без `--force`.
12. При конкурентном push выполняется до трёх повторных fetch, merge и push.

Если удалённая ветка назначения ещё не существует, она создаётся обычным push.

## Объединение Markdown

Алгоритм использует базовую, локальную и удалённую версии.

Автоматически обрабатываются:

- изменения в разных частях файла;
- списки `tags`, `aliases` и `cssclasses`;
- Markdown-списки;
- независимые изменения предложений;
- добавление и удаление файлов.

Если один блок изменён двумя несовместимыми способами, обе версии сохраняются в итоговом файле. Это предотвращает тихую потерю данных, но результат нужно прочитать и отредактировать.

Для конфликтующего не-Markdown-файла сохраняется локальная версия.

## Резервные копии и отчёты

Резервная ветка:

```text
backup/repository-sync-<timestamp>
```

Отчёты:

```text
.git/repository-sync/<timestamp>/
```

Возврат к резервной ветке выполняйте только после проверки её имени:

```bash
git reset --hard backup/repository-sync-<timestamp>
```

Эта команда удаляет текущие незакоммиченные изменения.

## Ошибки проверки контента

При ошибке `content:validate` сначала исправьте перечисленные файлы. Типовые категории:

```text
missing-frontmatter
missing-title
missing-tags
missing-target
wiki-link
isolated-note
asset-location
asset-outside-assets
generic-asset-name
```

После исправления запустите:

```bash
npm run content:validate
npm run sync
```

## Ошибки Git

Незавершённая Git-операция:

```text
A merge, rebase, cherry-pick, or revert is already in progress
```

Проверьте:

```bash
git status
```

Отсутствующий remote:

```text
Git remote not found: knowledge-upstream
```

Добавьте его и повторите команду.

Ошибка push после трёх попыток означает, что удалённая ветка продолжает изменяться либо сервер отклонил push. Изменения остаются локально и в резервной ветке.

## Тестирование

```bash
npm run sync:test
```

Тесты проверяют объединение Markdown, режим владельца и режим контрибьютора на временных локальных Git-репозиториях. Интернет для них не требуется.
