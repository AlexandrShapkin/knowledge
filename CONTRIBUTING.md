# Внесение изменений

Этот документ описывает работу через fork и Pull Request. Обязательные правила файлов в `content/` находятся в [`CONTENT_RULES.md`](./CONTENT_RULES.md).

## Требования

- Git;
- Node.js 22.17.1;
- npm 10.9.2 или новее.

```bash
git --version
node --version
npm --version
```

## Подготовка fork

Создайте fork и клонируйте его:

```bash
git clone https://github.com/USER/knowledge.git
cd knowledge
```

`origin` должен указывать на fork. Оригинальный репозиторий добавляется как `knowledge-upstream`:

```bash
git remote add knowledge-upstream https://github.com/AlexandrShapkin/knowledge.git
git remote -v
```

Имя `upstream` зарезервировано для исходного репозитория Quartz.

Установите зависимости и плагины:

```bash
npm ci
npm run install-plugins
```

## Настройки Obsidian

Для совпадения поведения Obsidian и Quartz:

- включите **Use [[Wikilinks]]**;
- выберите **New link format → Relative path to file**;
- храните вложения в локальном `!assets` рядом с заметкой.

## Рабочая ветка

```bash
git fetch knowledge-upstream main
git switch -c docs/my-change knowledge-upstream/main
```

Одна ветка и один Pull Request должны соответствовать одной логически связанной задаче. Не работайте непосредственно в `main` fork.

## Создание заметки

Перед созданием файла:

1. проверьте существующие материалы;
2. выберите ближайший тематический каталог;
3. определите полезные связи;
4. добавьте или обновите ближайший `index.md`.

Минимальный frontmatter:

```yaml
---
title: Название заметки
tags:
  - основной-тег
---
```

Теги пишутся в lowercase и не повторяются.

## Ссылки и вложения

Основной формат внутренних ссылок — Obsidian wikilinks:

```markdown
[[Соседняя заметка]]
[[../Сети/DNS|Проверка DNS]]
[[Соседняя заметка#Раздел]]
```

Внешние URL оформляются обычными Markdown-ссылками:

```markdown
[Документация](https://example.com)
```

Вложения размещаются в локальном `!assets`:

```text
content/Kubernetes/Ingress/
├── index.md
├── TLS через cert-manager.md
└── !assets/
    └── Схема выпуска сертификата.png
```

```markdown
![[!assets/Схема выпуска сертификата.png|Схема 800x600]]
```

Quartz 5 также поддерживает `![[Документ.pdf]]`, аудио, видео, встраивание целых заметок, разделов и block references.

Имена файлов должны описывать содержимое.

## Служебные и непубликуемые каталоги

`quartz.config.yaml` является источником истины для `configuration.ignorePatterns`. Проектные валидаторы читают те же шаблоны, что и Quartz.

Сейчас из публикации исключаются `private`, `templates`, `.obsidian` и `!Meta`. Каталог `!assets` не исключается: вложения из него публикуются вместе с заметками.

## Проверки

Обновите генерируемые индексы, если менялась структура:

```bash
npm run content:indexes
```

Миграция старых внутренних Markdown-ссылок:

```bash
npm run content:wikilinks
npm run content:wikilinks:check
```

Полная проверка контента:

```bash
npm run content:validate
```

Тесты автоматизации:

```bash
npm run sync:test
```

TypeScript и production build:

```bash
npx tsc --noEmit
npx quartz build
```

Локальный просмотр:

```bash
npx quartz build --serve
```

## Синхронизация ветки

```bash
npm run sync -- --contributor
```

Команда запускает `content:validate`, коммитит локальные изменения, делает rebase на `knowledge-upstream/main`, учитывает существующую одноимённую ветку в fork и отправляет результат в `origin` без force push.

Собственное сообщение commit:

```bash
npm run sync -- --contributor --message "docs(ssh): add host key note"
```

Аварийный пропуск локальной проверки:

```bash
npm run sync -- --contributor --no-check
```

`--no-check` не отключает CI.

## Конфликты

При конфликте синхронизация останавливается и ничего не отправляет. Автоматического смыслового объединения Markdown нет.

Проверьте состояние через `git status`. После ручного исправления добавьте исправленные файлы и продолжите rebase. Для отмены используйте штатную команду отмены rebase.

Перед rebase создаётся страховочная ветка `backup/repository-sync-<timestamp>`.

## Pull Request

Создайте Pull Request со следующими параметрами:

```text
base repository: AlexandrShapkin/knowledge
base branch: main
head repository: ваш fork
compare branch: ваша рабочая ветка
```

В описании укажите цель изменения, изменённые области, выполненные проверки и известные ограничения.

Название PR оформляется как Conventional Commit:

```text
docs(ssh): add host key verification note
fix(content): repair broken wikilinks
```

## Обновление существующего PR

```bash
npm run sync -- --contributor
```

Команда повторно сделает rebase на актуальный `knowledge-upstream/main` и обновит ветку fork без force push.

## Ограничения

Не используйте `npx quartz sync` для этого репозитория. Не размещайте проектную автоматизацию внутри `quartz/`: каталог обновляется из upstream Quartz.

## Контрольный список

- [ ] Изменение находится в отдельной ветке.
- [ ] Новая заметка раскрывает одну тему.
- [ ] Frontmatter содержит `title` и непустые `tags`.
- [ ] Wikilinks относительные и ведут на публикуемые файлы.
- [ ] Вложения находятся в локальном `!assets`.
- [ ] Структурные изменения отражены в `index.md`.
- [ ] Выполнен `npm run content:validate`.
- [ ] Выполнен `npm run sync:test` при изменении автоматизации.
- [ ] Выполнены `npx tsc --noEmit` и `npx quartz build` при изменении Quartz или конфигурации.
