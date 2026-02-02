---
title: reshape(1, n)
draft: false
tags:
  - 
aliases:
---
 `reshape(1, n)` используется в NumPy для **преобразования [[ndarray|массива]] в двумерную [[Матрица-строка и матрица-столбец|матрицу-строку]]**.

Если есть одномерный массив длины `n`:

```python
import numpy as np

a = np.array([1, 2, 3, 4])
print(a.shape)  # (4,)
```

Применение `reshape(1, n)`:

```python
row = a.reshape(1, 4)
print(row)
# [[1 2 3 4]]
print(row.shape)  # (1, 4)
```

Особенности:

- Превращает 1D массив `(n,)` в 2D массив с одной строкой `(1, n)`
- Используется для **[[Broadcasting идея и назначение|broadcasting]] по строкам** или операций линейной алгебры, где нужна матрица-строка
- Обычно не копирует данные, создаётся **view** с изменёнными `shape` и `strides`

Пример с broadcasting:

```python
x = np.array([1, 2, 3])
y = np.array([[10], [20]])  # shape (2, 1)

x_row = x.reshape(1, 3)     # shape (1, 3)

# Broadcasting по строкам
result = y + x_row           # shape (2, 3)
print(result)
# [[11 12 13]
#  [21 22 23]]
```

Идея: `reshape(1, n)` делает массив **двумерной строкой**, чтобы его можно было согласовать с другими массивами для операций без циклов.
