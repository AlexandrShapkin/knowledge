---
title: feature_names
draft: false
tags:
  -
---
 `feature_names` — это атрибут [[Что такое датасет|датасета]] в `sklearn.datasets`, который содержит **названия признаков (features)**, то есть колонок матрицы данных `X`.

В Wine dataset:

```python
from sklearn.datasets import load_wine

data = load_wine()
print(data.feature_names)
```

Результат:

```
['alcohol', 'malic_acid', 'ash', 'alcalinity_of_ash', 'magnesium',
 'total_phenols', 'flavanoids', 'nonflavanoid_phenols', 'proanthocyanins',
 'color_intensity', 'hue', 'od280/od315_of_diluted_wines', 'proline']
```

Пояснения:

- Каждое название соответствует **столбцу `X[:, i]`**
- Используется для:
    - визуализации
    - интерпретации модели
    - выбора признаков для анализа или построения графиков


Пример использования при построении графика:

```python
import matplotlib.pyplot as plt

X = data.data
y = data.target
plt.scatter(X[:, 0], X[:, 1], c=y)
plt.xlabel(data.feature_names[0])
plt.ylabel(data.feature_names[1])
plt.show()
```

Коротко:  
**`feature_names` хранит список названий признаков, соответствующих столбцам матрицы данных, для удобства анализа и визуализации.**
