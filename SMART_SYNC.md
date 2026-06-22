# Синхронизация репозитория

`npm run sync` — проектная оболочка над обычными Git-операциями. Она проверяет контент, фиксирует локальные изменения, обновляет текущую ветку через rebase и отправляет её без force push.

## Почему не используется `npx quartz sync`

В текущем Quartz 5 команда `npx quartz sync` рассчитана на типовой Quartz-репозиторий: она временно убирает каталог `content`, получает ветку `v5` из `origin` и отправляет текущую ветку с force-флагом. В этом репозитории `origin` содержит базу знаний, а Quartz обновляется через отдельный remote `upstream`, поэтому такой сценарий не подходит.

Проектная команда находится в `scripts/repository-sync.mjs` и не изменяет файлы внутри `quartz/`.

## Обычная работа владельца

```bash
git switch main
npm run sync
```

Команда выполняет:

1. `npm run content:validate`;
2. `git add -A`;
3. commit локальных изменений, если они есть;
4. fetch текущей ветки из `origin`;
5. rebase локальной ветки на удалённую;
6. push без `--force`.

Сообщение commit по умолчанию:

```text
docs: update knowledge base
```

Собственное сообщение:

```bash
npm run sync -- --message "docs(ssh): update troubleshooting notes"
```

## Работа контрибьютора

Настройте remotes:

```bash
git remote add knowledge-upstream https://github.com/AlexandrShapkin/knowledge.git
```

Создайте рабочую ветку и выполните:

```bash
npm run sync -- --contributor
```

Команда:

1. проверяет и коммитит локальные изменения;
2. делает rebase на `knowledge-upstream/main`;
3. учитывает существующую одноимённую ветку в fork;
4. отправляет текущую ветку в `origin` без force push.

Remote `upstream` не используется для базы знаний: он зарезервирован для обновлений движка Quartz.

## Конфликты

Синхронизация не пытается автоматически объединять конфликтующие предложения, YAML-поля или бинарные файлы. При конфликте rebase останавливается, push не выполняется.

Проверьте состояние:

```bash
git status
```

Разрешите конфликт вручную:

```bash
git add <исправленные-файлы>
git rebase --continue
```

Либо отмените rebase:

```bash
git rebase --abort
```

Перед первым rebase команда создаёт страховочную ветку:

```text
backup/repository-sync-<timestamp>
```

После успешной проверки результата ненужную страховочную ветку можно удалить обычной командой `git branch -d`.

## Пропуск локальной проверки

Только для сохранения промежуточного состояния:

```bash
npm run sync -- --no-check
```

Флаг отключает лишь локальный `content:validate`. Проверки Pull Request и deployment продолжают выполняться.

## Явные remotes и ветки

```bash
npm run sync -- \
  --pull-remote knowledge-upstream \
  --pull-branch main \
  --push-remote origin \
  --push-branch docs/my-change
```

Поддерживаемые параметры:

- `--contributor`;
- `--no-check`;
- `--message <text>`;
- `--pull-remote <name>`;
- `--pull-branch <name>`;
- `--push-remote <name>`;
- `--push-branch <name>`.

## Тестирование

```bash
npm run sync:test
```

Тесты проверяют:

- режим владельца и контрибьютора;
- переопределение remotes и веток;
- успешный rebase независимых изменений;
- остановку при конфликте без push;
- применение `ignorePatterns` Quartz к проектным валидаторам.
