# Тесты SheVagent — 36/36 PASS

Проверено 2026-11-24 командой `node --test test/*.test.mjs` в основном проекте
`D:\Opencode\App`.

```
tests 36
pass 36
fail 0
cancelled 0
skipped 0
duration_ms ~500
```

## Файлы тестов

- `tests/basic.test.mjs` — базовые инструменты (read/write/edit/grep/glob/shell).
- `tests/agent-behavior.test.mjs` — поведение агента и выбор инструментов.
- `tests/ui-intents.test.mjs` — разбор голосовых команд и виджетов.
- `tests/model-fallback.test.mjs` — переключение модели и fallback.
- `tests/github-sync.test.mjs` — GitHub-харнес: разбор URL, алиасы из манифеста,
  запрет произвольных команд из репозитория.

## Как запускать

Тесты живут в основном проекте SheVagent, а здесь приведены их копии для обзора:

```
cd D:\Opencode\App
node --test test/*.test.mjs
```

## GitHub-харнес

`github_sync` подтягивает публичный репозиторий как источник навыков
(`skills/*/SKILL.md`) и алиасов (`tools/manifest.json`). Исполняется только
конфигурация, не код. См. `skills/harness-intro/SKILL.md`.
