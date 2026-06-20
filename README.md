# База знаний IT

Открытая база технических заметок по Linux, сетям, DevOps, разработке и смежным темам.

Сайт собран на Quartz и публикуется через GitHub Pages: `https://knowledge.alexandrshapkin.ru/`.

Все пользовательские материалы находятся в каталоге [`content`](./content) и могут редактироваться в Obsidian или любом Markdown-редакторе.

## Требования

Для локальной работы нужны:

- Git;
- Node.js 22 или новее;
- npm 10.9.2 или новее.

После клонирования установите зависимости:

```bash
npm ci
```

## Основные команды

Локальный просмотр:

```bash
npx quartz build --serve
```

Проверка сборки:

```bash
npx quartz build
```

Синхронизация владельца:

```bash
npm run sync
```

Тесты синхронизации:

```bash
npm run sync:test
```

`npm run sync` — собственная команда репозитория. Она находится в `scripts/` и не заменяется при `npx quartz update`.

Для Git-синхронизации заметок не используйте `npx quartz sync`: стандартная команда Quartz временно исключает каталог `content` из Git-операции, а затем восстанавливает локальную копию. Из-за этого удалённые изменения заметок могут не появиться локально.

Подробности: [`SMART_SYNC.md`](./SMART_SYNC.md).

## Работа владельца

Основная публикуемая ветка — `v4`.

```bash
git switch v4
npm run sync
```

Команда коммитит локальные изменения, создаёт резервную ветку, получает актуальную `origin/v4`, объединяет изменения и отправляет результат без force push.

## Как внести вклад

Внешние участники работают через fork и отдельную ветку.

```bash
git clone https://github.com/USER/knowledge.git
cd knowledge
git remote add knowledge-upstream https://github.com/AlexandrShapkin/knowledge.git
npm ci
git switch -c docs/my-change
```

После редактирования:

```bash
npm run sync -- --contributor
```

Команда получает `knowledge-upstream/v4`, объединяет её с текущей веткой и отправляет текущую ветку в `origin`. Затем создайте pull request в ветку `v4` оригинального репозитория.

Имя `upstream` не используется для базы знаний: Quartz использует его для собственного исходного репозитория. Для оригинального репозитория базы применяется `knowledge-upstream`.

Полная инструкция: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Публикация

После обычного push или merge pull request в `v4` workflow `.github/workflows/deploy.yml` устанавливает зависимости, выполняет `npx quartz build` и публикует каталог `public` в GitHub Pages.

Изменения следует вносить через отдельную ветку и pull request. Push, выполненный другим workflow через стандартный токен GitHub Actions, может не запустить workflow публикации.

## Структура

```text
content/                  пользовательские заметки
scripts/                  пользовательская автоматизация
quartz/                   исходный код upstream Quartz
.github/workflows/        CI и публикация
README.md                 обзор проекта
CONTRIBUTING.md           инструкция для участников
SMART_SYNC.md             синхронизация
AGENTS.md                 правила для ИИ-агентов
```

Пользовательскую автоматизацию не следует размещать внутри `quartz/`: этот каталог обновляется из upstream Quartz и локальные изменения в нём могут быть затёрты.
