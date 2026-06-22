# База знаний IT

Открытая база технических заметок по Linux, сетям, DevOps, разработке и смежным темам.

Сайт работает на Quartz 5 и публикуется через GitHub Pages: `https://knowledge.alexandrshapkin.ru/`.

Пользовательские материалы находятся в [`content`](./content) и редактируются в Obsidian или любом Markdown-редакторе.

## Требования

- Git;
- Node.js 22.17.1 — версия закреплена в [`.nvmrc`](./.nvmrc);
- npm 10.9.2 или новее.

После клонирования:

```bash
npm ci
npm run install-plugins
```

## Что предоставляет Quartz 5

Quartz отвечает за:

- преобразование Markdown, Canvas и Bases в сайт;
- Explorer, поиск, граф, backlinks, теги и folder pages;
- фильтрацию `draft`, `unlisted` и `ignorePatterns`;
- RSS, sitemap, favicon, OG-изображения и GitHub Pages build;
- систему внешних плагинов и `quartz.lock.json`.

Каталог `quartz/` является кодом upstream. Пользовательские правила и автоматизация находятся вне него, чтобы обновление Quartz не затирало проектные изменения.

## Проектные инструменты

Quartz не задаёт правила качества этой базы и не управляет её Git-процессом безопасным для текущей схемы remotes. Поэтому сохранены три проектных инструмента:

1. `scripts/repository-sync.mjs` — validate, commit, fetch, rebase и push без force;
2. `scripts/check-content-links.mjs` — проверка frontmatter, ссылок, графа и вложений;
3. `scripts/ensure-content-indexes.mjs` — поддержка явных `index.md`, которые формируют иерархию и связи графа поверх нативных FolderPage.

Все инструменты используют `configuration.ignorePatterns` из `quartz.config.yaml`. Поэтому `private`, `templates`, `.obsidian` и `!Meta` не проверяются как публикуемый контент и не попадают в сайт.

## Правила контента

Каждая содержательная Markdown-заметка должна:

- раскрывать одну тему;
- иметь YAML frontmatter с непустыми `title` и `tags`;
- быть связанной хотя бы с одной другой заметкой;
- использовать относительные Markdown-ссылки;
- хранить вложения в локальном `!assets`;
- использовать понятные имена вложений.

Quartz 5 умеет обрабатывать Obsidian wiki-links, но в этом репозитории обычные Markdown-ссылки остаются осознанным переносимым контрактом.

Подробности: [`CONTENT_RULES.md`](./CONTENT_RULES.md).

## Основные команды

Полная проверка контента:

```bash
npm run content:validate
```

Создание или обновление генерируемых `index.md`:

```bash
npm run content:indexes
```

Локальный сайт:

```bash
npx quartz build --serve
```

Production build:

```bash
npx tsc --noEmit
npx quartz build
```

Тесты проектной автоматизации:

```bash
npm run sync:test
```

## Синхронизация

Владелец:

```bash
git switch main
npm run sync
```

Контрибьютор:

```bash
npm run sync -- --contributor
```

`npm run sync` сначала выполняет `content:validate`, затем коммитит изменения, делает rebase на удалённую ветку и отправляет результат без force push. При конфликте команда останавливается и ничего не публикует.

Не используйте `npx quartz sync` для этого репозитория: текущая реализация Quartz временно убирает `content`, получает `origin/v5` и выполняет force push текущей ветки. Здесь `origin` хранит базу знаний, а remote `upstream` используется для самого Quartz.

Полная инструкция: [`SMART_SYNC.md`](./SMART_SYNC.md).

## Обновление Quartz

Перед обновлением создайте рабочую ветку и убедитесь, что рабочее дерево чистое. Затем используйте штатный механизм Quartz:

```bash
npx quartz upgrade
npm run install-plugins
npm run sync:test
npm run content:validate
npx tsc --noEmit
npx quartz build
```

Изменения Quartz, конфигурации и lock-файла следует объединять через Pull Request после зелёного CI.

## Pull Request и CI

Для каждого изменения создаётся отдельная ветка. Pull Request в `main` выполняет:

```bash
npm ci
npm run install-plugins
npm run content:validate
npm run sync:test
npx tsc --noEmit
npx quartz build
```

Дополнительно CI проверяет, что `!Meta` не появился в итоговом `public`.

После merge в `main` workflow `.github/workflows/deploy.yml` публикует сайт в GitHub Pages.

## Документы проекта

- [`CONTENT_RULES.md`](./CONTENT_RULES.md) — обязательный формат контента;
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — процесс внешних изменений;
- [`SMART_SYNC.md`](./SMART_SYNC.md) — безопасная Git-синхронизация;
- [`AGENTS.md`](./AGENTS.md) — правила для ИИ-агентов.

## Структура

```text
content/                  публикуемая база знаний
scripts/                  проектная автоматизация
quartz/                   upstream Quartz 5
quartz.config.yaml        конфигурация сайта и ignorePatterns
quartz.lock.json          закреплённые версии плагинов
.github/workflows/        CI и GitHub Pages deployment
```
