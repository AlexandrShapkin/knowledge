---
title: Datasource not found в Grafana
draft: false
tags:
  - grafana
  - prometheus
  - troubleshooting
  - datasource
---

Дашборды с grafana.com используют переменную `${DS_PROMETHEUS}` вместо реального имени datasource. Grafana не может её разрезолвить.

**Решение:** заменить перед созданием ConfigMap:

```bash
sed -i 's/\${DS_PROMETHEUS}/Prometheus/g' dashboard.json
```

## Связанные заметки

- [[index|Миграция с Docker Compose на k3s и ArgoCD]]
