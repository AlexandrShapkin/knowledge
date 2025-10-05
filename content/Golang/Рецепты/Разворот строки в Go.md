---
title: Разворот строки
draft: false
tags:
  - go
  - golang
  - strings
  - revers
  - recipes
---
 
В Go нет встроенной функции для разворота строки. Причина — строка хранится как последовательность **байтов**, а не символов. Для работы с текстом (особенно с кириллицей, эмодзи и т.п.) нужно конвертировать строку в `[]rune`.
## Способ 1. Разворот через `[]rune`
Простой и универсальный вариант:
```go
func reverse(s string) string {
    runes := []rune(s)
    for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
        runes[i], runes[j] = runes[j], runes[i]
    }
    return string(runes)
}
```

## Способ 2. Только ASCII
Если гарантирован только ASCII, можно работать напрямую с байтами:
```go
func reverseASCII(s string) string {
    b := []byte(s)
    for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
        b[i], b[j] = b[j], b[i]
    }
    return string(b)
}
```

## **Итого**:
- `[]rune` — правильно для любых символов Unicode, чуть медленнее.
- `[]byte` — быстрее, но работает только для ASCII.