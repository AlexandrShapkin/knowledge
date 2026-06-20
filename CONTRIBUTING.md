# Внесение изменений

Этот документ описывает полный цикл работы с fork: настройку репозитория, редактирование, синхронизацию, проверку и создание pull request.

## Требования

Нужны Git, Node.js 22 или новее и npm 10.9.2 или новее.

```bash
git --version
node --version
npm --version
```

## 1. Создание и клонирование fork

Создайте fork `AlexandrShapkin/knowledge` в интерфейсе GitHub, затем клонируйте его:

```bash
git clone https://github.com/USER/knowledge.git
cd knowledge
```

`origin` должен указывать на ваш fork.

Добавьте оригинальный репозиторий под именем `knowledge-upstream`:

```bash
git remote add knowledge-upstream https://github.com/AlexandrShapkin/knowledge.git
git remote -v
```

Не используйте имя `upstream` для базы знаний. Quartz использует `upstream` для репозитория `jackyzha0/quartz`.

Установите зависимости:

```bash
npm ci
```

## 2. Создание рабочей ветки

Получите актуальную основную ветку и создайте отдельную ветку задачи:

```bash
git fetch knowledge-upstream v4
git switch -c docs/my-change knowledge-upstream/v4
```

Не вносите изменения непосредственно в `v4` своего fork.

Рекомендуемые имена:

```text
docs/add-ssh-note
docs/fix-linux-links
fix/markdown-frontmatter
```

## 3. Редактирование заметок

Пользовательские заметки находятся в `content/`.

Правила:

- сохраняйте UTF-8;
- не удаляйте несвязанные разделы;
- используйте существующий стиль Markdown и Obsidian-ссылок;
- добавляйте ссылку на новую заметку из подходящей индексной заметки;
- проверяйте, что тема ещё не раскрыта в существующем файле;
- добавляйте корректный frontmatter.

Пример:

```yaml
---
title: Название заметки
draft: false
tags:
  - linux
  - troubleshooting
---
```

Теги пишутся в lowercase. Пустые элементы `-` недопустимы.

## 4. Локальная проверка

Запустите сайт:

```bash
npx quartz build --serve
```

Проверьте итоговую сборку:

```bash
npx quartz build
```

Для изменений механизма синхронизации:

```bash
npm run sync:test
```

Для изменений TypeScript и Quartz:

```bash
npm run check
```

## 5. Синхронизация ветки

После редактирования выполните:

```bash
npm run sync -- --contributor
```

Режим контрибьютора:

1. коммитит локальные изменения;
2. создаёт резервную ветку;
3. получает `knowledge-upstream/v4`;
4. объединяет её с текущей веткой;
5. при необходимости объединяет Markdown-конфликты;
6. получает существующую одноимённую ветку из вашего fork;
7. отправляет текущую ветку в `origin` без force push.

Собственное сообщение коммита:

```bash
npm run sync -- --contributor --message "Add SSH host key note"
```

Если команда сообщает, что уже выполняется merge или rebase, сначала завершите или отмените текущую Git-операцию.

## 6. Создание pull request

После успешной синхронизации откройте pull request:

```text
base repository: AlexandrShapkin/knowledge
base branch: v4
head repository: ваш fork
compare branch: ваша рабочая ветка
```

В описании укажите:

- что добавлено или исправлено;
- какие файлы изменены;
- какие проверки выполнены;
- есть ли автоматические решения конфликтов, требующие просмотра.

Одна задача должна соответствовать одному pull request.

## 7. Обновление существующего pull request

Если `v4` изменилась:

```bash
npm run sync -- --contributor
```

Команда снова получит актуальную `knowledge-upstream/v4`, объединит её с вашей веткой и обновит ветку в fork.

## Разрешение конфликтов

Markdown-файлы объединяются трёхсторонним алгоритмом:

- независимые изменения сохраняются;
- `tags`, `aliases` и `cssclasses` объединяются без дублей;
- Markdown-списки объединяются без дублей;
- неоднозначные варианты текста сохраняются оба;
- отчёты записываются в `.git/repository-sync/`.

Для не-Markdown-файлов при конфликте сохраняется локальная версия и создаётся отчёт. Такой результат нужно проверить вручную.

Перед каждой синхронизацией создаётся ветка вида:

```text
backup/repository-sync-<timestamp>
```

## Что не следует делать

Без явной необходимости не используйте:

```bash
npx quartz sync
git push --force
git reset --hard
git clean -fd
```

Не изменяйте пользовательскую автоматизацию внутри `quartz/`, потому что `npx quartz update` может затереть такие изменения.
