# База знаний IT

Открытая база технических заметок по Linux, сетям, DevOps, разработке и смежным темам.

Сайт работает на Quartz 5 и публикуется через GitHub Pages: `https://knowledge.alexandrshapkin.ru/`.

Пользовательские материалы находятся в [`content`](./content) и редактируются преимущественно в Obsidian.

## Требования

- Git;
- Node.js 22.17.1 — версия закреплена в [`.nvmrc`](./.nvmrc);
- npm 10.9.2 или новее.

После клонирования:

```bash
npm ci
npm run install-plugins
```

## Настройки Obsidian

Для совпадения поведения Obsidian и Quartz используются:

- **Use [[Wikilinks]]** — включено;
- **New link format** — `Relative path to file`;
- вложения размещаются в локальном подкаталоге `!assets` рядом с заметкой.

Основной формат внутренних ссылок:

```markdown
[[Соседняя заметка]]
[[../Сети/DNS|Проверка DNS]]
[[Соседняя заметка#Раздел]]
![[!assets/Схема сети.png|Схема сети 800x600]]
```

Quartz 5 поддерживает встраивание изображений, SVG, PDF, аудио, видео, целых заметок, заголовков и block references.

## Что предоставляет Quartz 5

Quartz отвечает за:

- преобразование Markdown, Canvas и Bases в сайт;
- Obsidian wikilinks, embeds, callouts, Mermaid и block references;
- Explorer, поиск, граф, backlinks, теги и folder pages;
- фильтрацию `draft`, `unlisted` и `ignorePatterns`;
- RSS, sitemap, favicon, OG-изображения и GitHub Pages build;
- систему внешних плагинов и `quartz.lock.json`.

Каталог `quartz/` является кодом upstream. Пользовательские правила и автоматизация находятся вне него, чтобы обновление Quartz не затирало проектные изменения.

## Проектные инструменты

Quartz не задаёт правила качества этой базы и не управляет её Git-процессом безопасным для текущей схемы remotes. Поэтому сохранены:

1. `scripts/repository-sync.mjs` — validate, commit, fetch, rebase и push без force;
2. `scripts/check-content-links.mjs` — проверка frontmatter, wikilinks, Markdown-ссылок, графа и вложений;
3. `scripts/ensure-content-indexes.mjs` — поддержка явных `index.md` поверх нативных FolderPage;
4. `scripts/migrate-wikilinks.mjs` — одноразовая и повторяемая миграция внутренних Markdown-ссылок в wikilinks.

Все инструменты используют `configuration.ignorePatterns` из `quartz.config.yaml`. Поэтому `private`, `templates`, `.obsidian` и `!Meta` не проверяются как публикуемый контент и не попадают в сайт.

## Правила контента

Каждая содержательная Markdown-заметка должна:

- раскрывать одну тему;
- иметь YAML frontmatter с непустыми `title` и `tags`;
- быть связанной хотя бы с одной другой заметкой;
- использовать относительные wikilinks для внутренних страниц и вложений;
- хранить вложения в локальном `!assets`;
- использовать понятные имена вложений.

Обычные Markdown-ссылки сохраняются для внешних URL. Существующие внутренние Markdown-ссылки поддерживаются для совместимости, но новые внутренние связи создаются как wikilinks.

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

Миграция внутренних Markdown-ссылок:

```bash
npm run content:wikilinks
npm run content:wikilinks:check
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

Перед обновлением создайте рабочую ветку и убедитесь, что рабочее дерево чистое:

```bash
npx quartz upgrade
npm run install-plugins
npm run sync:test
npm run content:validate
npx tsc --noEmit
npx quartz build
```

Изменения Quartz, конфигурации и lock-файла объединяются через Pull Request после зелёного CI.

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
