---
title: Миграция с Docker Compose на k3s + ArgoCD
draft: false
tags:
  - docker
  - docker_compose
  - kubernetes
  - k3s
  - argocd
  - gitops
  - администрирование
---
> Личные заметки по процессу перехода домашней инфраструктуры от Docker Compose к Kubernetes (k3s) с GitOps-подходом через ArgoCD. Сразу оговорюсь: опыт работы с Kubernetes у меня минимальный, а ArgoCD я не использовал вовсе — до этого момента.

---

## Контекст

До миграции инфраструктура строилась на **[Ansible](https://www.redhat.com/en/ansible-collaborative) + [Docker Compose](https://docs.docker.com/compose/)** на [AlmaLinux](https://almalinux.org/ru/). Все сервисы описывались через `docker-compose.yml` файлы и разворачивались вручную или через [Ansible плейбуки](https://github.com/AlexandrShapkin/homelab-infra/tree/legacy/docker-compose/playbooks). Это работало, но имело ряд ограничений:

- Нет единой точки управления состоянием
- Изменения применялись вручную по SSH
- Нет автоматического восстановления при падении
- Сложно отслеживать, что именно задеплоено
- Нет чёткой привязки к внешнему источнику истины (в данном случае — GitHub-репозиторий)

Старые наработки сохранены в ветке [`legacy/docker-compose`](https://github.com/AlexandrShapkin/homelab-infra/tree/legacy/docker-compose).

---

## Что выбрал и почему

**[k3s](https://k3s.io/)** — лёгкий дистрибутив [Kubernetes](https://kubernetes.io/) от [Rancher](https://www.rancher.com/), заточенный под edge и homelab. Из коробки идёт с [Traefik](https://traefik.io/traefik) как ingress controller и local-path provisioner для хранилища. Не нужно разбираться с kubeadm и ручной настройкой компонентов. Поскольку у меня Single-Node кластер, полноценный k8s был бы избыточным.

**[ArgoCD](https://argoproj.github.io/cd/)** — GitOps-инструмент: читает манифесты из git-репозитория и приводит состояние кластера в соответствие с ними. Изменение инфраструктуры = коммит в репо. ArgoCD сам следит за расхождениями и восстанавливает их.

В качестве первого сервиса выбрана **[Grafana](https://grafana.com/)**: есть реальная потребность в мониторинге, а сам стек нетривиальный — помимо Grafana нужен [Prometheus](https://prometheus.io/), что делает задачу хорошей практикой. Можно было взять готовый [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack), который разворачивает всё сам, но тогда практической ценности было бы значительно меньше.

---

## Подготовка к миграции

Для начала зарегистрировал несколько доменов в зоне `.ru`. В качестве регистратора использую [SpaceWeb](https://sweb.ru/):

- `alexandrshapkin.ru` — A-запись, базовая; используется как основа для остальных
- `argocd.alexandrshapkin.ru` — CNAME-запись — адрес для ArgoCD
- `grafana.alexandrshapkin.ru` — CNAME-запись — адрес для Grafana
- `ru.alexandrshapkin.ru` — A-запись — один из арендованных VPS; нужен для сбора метрик через [Node Exporter](https://github.com/prometheus/node_exporter)
- `fi.alexandrshapkin.ru` — A-запись — аналогично `ru.alexandrshapkin.ru`

Пул доменов будет расширяться по мере необходимости. Фактически у меня три хоста: хостовая машина с k3s/ArgoCD и два VPS. VPS довольно слабые, поэтому использовать их как дополнительные ноды кластера пока не стал — хотя поэкспериментировать с этим было бы интересно.

Хостовая машина — десктоп на базе i5-9400F с 32 ГБ DDR4, ОС — [Ubuntu 26.04 LTS](https://documentation.ubuntu.com/release-notes/26.04/).

---

## Миграция старого репозитория

В первую очередь «очистил» [репозиторий](https://github.com/AlexandrShapkin/homelab-infra), сохранив старые наработки в ветку [legacy/docker-compose](https://github.com/AlexandrShapkin/homelab-infra/tree/legacy/docker-compose):

```bash
git checkout -b legacy/docker-compose
git push origin legacy/docker-compose
git checkout main
git rm -rf .
git commit --allow-empty -m "chore: init k3s(k8s)/argocd era"
git push origin main --force
```

В результате получилась чистая ветка [main](https://github.com/AlexandrShapkin/homelab-infra/tree/26de5e58c9aaeb36ce4cf564e155148a82b21fbf), с которой и началась работа.

---

## Структура репозитория

Выбран паттерн **[App of Apps](https://argo-cd.readthedocs.io/en/latest/operator-manual/cluster-bootstrapping/#app-of-apps-pattern-alternative)** — один корневой ArgoCD Application следит за директорией `apps/`, в которой лежат Application-манифесты для каждого сервиса.

```
homelab-infra/
├── apps/                        # ArgoCD Applications (что деплоить)
│   ├── root-app.yaml            # Корневой app - следит за этой директорией
│   ├── sealed-secrets.yaml      # Контроллер для шифрования секретов
│   ├── cert-manager-config.yaml # TLS-сертификаты
│   ├── argocd-config.yaml       # Настройки самого ArgoCD
│   └── prometheus-stack.yaml    # Мониторинг
├── clusters/
│   └── homelab/
│       └── root-app.yaml        # Bootstrap - применяется вручную один раз
└── infrastructure/              # Сами манифесты сервисов
    ├── argocd/
    ├── cert-manager/
    └── prometheus-stack/
```

**Bootstrap** — единственное действие, которое нужно выполнить на готовом кластере:

```bash
kubectl apply -f clusters/homelab/root-app.yaml
```

После этого ArgoCD управляет всем остальным сам. В дальнейшем, возможно, автоматизирую и сам процесс развёртывания кластера вместе с применением bootstrap.

---

## Что сделано и как работает

### Общая картина
![](Pasted%20image%2020260529014518.png)

---

### Поток ArgoCD → Kubernetes

#### Как ArgoCD узнаёт, что деплоить

ArgoCD работает по принципу **reconciliation loop** — бесконечный цикл сравнения «что есть в git» с «что есть в кластере». Расхождение — применить изменения.

Точка входа — файл `clusters/homelab/root-app.yaml`. Он применяется **один раз вручную**:

```bash
kubectl apply -f clusters/homelab/root-app.yaml
```

После этого в кластере появляется объект `Application` с именем `root-app`. ArgoCD видит его и начинает следить за директорией `apps/` в репозитории.

#### Паттерн App of Apps — как работает цепочка

`root-app` следит за директорией `apps/`. Там лежат файлы вида:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: prometheus-stack
spec:
  source:
    path: infrastructure/prometheus-stack   # директория с манифестами
  destination:
    namespace: monitoring
  syncPolicy:
    automated:
      prune: true      # удалять ресурсы, которых нет в git
      selfHeal: true   # восстанавливать, если кто-то изменил вручную
```

ArgoCD применяет эти файлы — то есть создаёт **новые объекты Application** в кластере. Каждый из них в свою очередь начинает следить за своей директорией.

Итог: достаточно добавить файл в `apps/` — ArgoCD сам создаст Application и задеплоит всё, что находится в указанном `path`.

#### syncOptions: ServerSideApply и CreateNamespace

В `apps/prometheus-stack.yaml` есть:

```yaml
syncOptions:
  - CreateNamespace=true    # создать namespace, если не существует
  - ServerSideApply=true    # применять через server-side apply (нужно для больших CRD)
```

`CreateNamespace=true` — ArgoCD сам создаёт namespace `monitoring` перед применением манифестов. Без этого деплой падал бы с ошибкой «namespace not found».

`ServerSideApply=true` — некоторые ресурсы (особенно CRD) слишком большие для обычного `kubectl apply`. Server-side apply решает эту проблему.

---

### Prometheus собирает метрики

#### Как Prometheus знает, с кого собирать метрики

Prometheus работает по модели **pull** — сам ходит к экспортерам по расписанию (каждые 30 секунд согласно `scrape_interval` в конфиге) и забирает метрики.

Список целей описан в `infrastructure/prometheus-stack/prometheus-config.yaml` в секции `scrape_configs`. Это ConfigMap, который монтируется в под Prometheus как файл `/etc/prometheus/prometheus.yml`.

#### node-exporter внутри кластера — автообнаружение нод

```yaml
- job_name: node-exporter
  kubernetes_sd_configs:
    - role: node          # обнаруживать все ноды кластера автоматически
  relabel_configs:
    - source_labels: [__address__]
      regex: '(.*):10250'
      replacement: '${1}:9100'
      target_label: __address__
```

`kubernetes_sd_configs` с `role: node` говорит Prometheus использовать **Kubernetes Service Discovery** — он обращается к Kubernetes API и получает список всех нод кластера. Изначально адрес ноды приходит с портом `10250` (kubelet), `relabel_configs` заменяет его на `9100` (node-exporter).

Для этого Prometheus нужны права на чтение информации о нодах — они описаны в `infrastructure/prometheus-stack/prometheus-rbac.yaml`: ServiceAccount → ClusterRole → ClusterRoleBinding.

#### node-exporter как DaemonSet

Node-exporter описан в `infrastructure/prometheus-stack/node-exporter.yaml` как `DaemonSet` — это специальный тип workload в Kubernetes, который гарантирует, что **один экземпляр пода запущен на каждой ноде**. При добавлении новой ноды DaemonSet автоматически запускает там pod.

Важные параметры:

```yaml
hostPID: true
hostNetwork: true     # под использует сеть хоста, а не pod network
```

`hostNetwork: true` означает, что node-exporter слушает на порту `9100` **хост-машины**, а не внутри pod network. Именно поэтому Prometheus может достучаться до него по IP ноды.

```yaml
volumeMounts:
  - name: root
    mountPath: /host
    readOnly: true   # примонтирован весь корень хост-системы
```

Node-exporter читает метрики хост-машины через примонтированные `/proc`, `/sys` и корневую файловую систему хоста.

#### node-exporter на внешних VPS

Внешние машины (`fi.alexandrshapkin.ru`, `ru.alexandrshapkin.ru`) указаны как статические таргеты:

```yaml
- job_name: node-exporter-external
  static_configs:
    - targets:
        - 'fi.alexandrshapkin.ru:9100'
        - 'ru.alexandrshapkin.ru:9100'
  relabel_configs:
    - source_labels: [__address__]
      regex: '([^:]+):\d+'
      target_label: instance   # hostname без порта — читаемое имя в дашборде
```

Prometheus обращается к ним напрямую по DNS. На каждом VPS должен быть запущен `node_exporter`, а порт `9100` открыт для IP сервера кластера.

#### mikrotik-exporter

MikroTik не умеет отдавать метрики в формате Prometheus напрямую. Для этого используется **[mktxp](https://github.com/akpw/mktxp)** — отдельный сервис, который:

1. Подключается к MikroTik API (порт 8728)
2. Запрашивает данные (интерфейсы, DHCP leases, ресурсы и т.д.)
3. Преобразует их в формат Prometheus
4. Отдаёт по HTTP на порту `49090`

Конфигурация роутера (IP, логин, пароль) хранится в SealedSecret `infrastructure/prometheus-stack/mikrotik-secret.yaml` — файл `mktxp.conf` зашифрован и безопасно хранится в git. В кластере Sealed Secrets контроллер расшифровывает его в обычный Secret, который монтируется в под через initContainer (копируется в `emptyDir`, чтобы mktxp мог обновлять файл при старте).

Prometheus обращается к mktxp по DNS-имени сервиса внутри кластера:

```yaml
- job_name: mikrotik
  static_configs:
    - targets:
        - mikrotik-exporter:49090   # Service DNS-имя внутри кластера
```

Kubernetes резолвит `mikrotik-exporter` в ClusterIP сервиса, описанного в `infrastructure/prometheus-stack/mikrotik-exporter.yaml`.

### Хранение данных

Prometheus хранит данные в PersistentVolumeClaim `prometheus-data`. k3s автоматически создаёт физический том через `local-path` provisioner — данные хранятся на диске ноды в `/var/lib/rancher/k3s/storage/`.

Retention настроен на 30 дней: `--storage.tsdb.retention.time=30d`.

---

### Grafana подключается к Prometheus

#### Автоматическое добавление datasource

Grafana поддерживает **provisioning** — механизм автоматической настройки при старте через файлы конфигурации.

Datasource описан в ConfigMap внутри `infrastructure/prometheus-stack/grafana.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
data:
  prometheus.yaml: |
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        url: http://prometheus:9090   # Service DNS-имя
        isDefault: true
        editable: false
```

Этот ConfigMap монтируется в директорию `/etc/grafana/provisioning/datasources/` внутри контейнера. При старте Grafana читает все `.yaml` файлы из этой директории и автоматически добавляет datasource.

`url: http://prometheus:9090` — Kubernetes DNS резолвит `prometheus` в ClusterIP сервиса Prometheus. Grafana и Prometheus находятся в одном namespace `monitoring`, поэтому достаточно короткого имени.

#### Автоматическая загрузка дашбордов

Аналогично datasource — через provisioning. Нужны два ConfigMap.

**Провайдер** — говорит Grafana, где искать дашборды:

```yaml
data:
  dashboards.yaml: |
    apiVersion: 1
    providers:
      - name: default
        type: file
        options:
          path: /var/lib/grafana/dashboards   # ← смотреть здесь
```

**Сами дашборды** — JSON-файлы, скачанные с grafana.com:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dashboard-node-exporter
data:
  node-exporter.json: |
    { ... JSON дашборда ... }
```

Оба ConfigMap монтируются в соответствующие директории контейнера. При старте Grafana читает все `.json` файлы из `path` и загружает их.

**Важный нюанс:** дашборды с grafana.com содержат `${DS_PROMETHEUS}` вместо реального имени datasource. Перед созданием ConfigMap нужно заменить:

```bash
sed -i 's/\${DS_PROMETHEUS}/Prometheus/g' dashboard.json
```

Иначе Grafana не может сопоставить дашборд с datasource.

---

### TLS и доступ снаружи

#### Цепочка: интернет → роутер → Traefik → сервис
![](Pasted%20image%2020260531182648.png)
#### Как cert-manager получает сертификат

`ClusterIssuer` в `infrastructure/cert-manager/cluster-issuer.yaml` настраивает интеграцию с Let's Encrypt через HTTP-01 валидацию.

Когда Ingress создаётся с аннотацией `cert-manager.io/cluster-issuer: letsencrypt-prod`, cert-manager:

1. Видит новый Ingress и аннотацию
2. Создаёт `CertificateRequest` к Let's Encrypt
3. Let's Encrypt отвечает: «Докажи, что ты владеешь доменом — положи файл по адресу `http://grafana.alexandrshapkin.ru/.well-known/acme-challenge/TOKEN`»
4. cert-manager создаёт временный Ingress и Pod, который отвечает на этот запрос
5. Let's Encrypt проверяет файл и выдаёт сертификат
6. cert-manager сохраняет сертификат в Secret `grafana-tls`
7. Traefik читает Secret и использует сертификат для HTTPS

Сертификаты обновляются автоматически за 30 дней до истечения.

#### Почему Traefik, а не NGINX

k3s включает Traefik из коробки — он уже настроен и занял порты 80/443. Traefik автоматически читает объекты `Ingress` из всех namespace и настраивает маршрутизацию без перезапуска.

---

### Sealed Secrets

#### Почему нельзя просто закодировать в base64

В Kubernetes Secret данные хранятся в base64 — это **не шифрование**, а просто кодирование. Любой, кто имеет доступ к кластеру или к git, может декодировать их за секунду.

#### Как работает Sealed Secrets

![](Pasted%20image%2020260531182648.png)

Приватный ключ никогда не покидает кластер — поэтому зашифрованный SealedSecret бесполезен без доступа к нему.

**Единственная уязвимость:** если кластер пересоздаётся без резервной копии мастер-ключа, все SealedSecrets не расшифровать. Поэтому бэкап обязателен:

```bash
kubectl get secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > sealed-secrets-master-key-backup.yaml
```

---

## Грабли и решения

В ходе миграции — во многом из-за отсутствия опыта — пришлось столкнуться с несколькими неочевидными проблемами.

### 1. Порты 80/443 заняты Traefik — argocd-server завис в Pending

k3s по умолчанию разворачивает Traefik как LoadBalancer на портах 80 и 443. ArgoCD тоже запрашивает LoadBalancer на тех же портах — klipper (svclb) не может назначить IP, pod висит в `Pending`.

**Решение:** поменять тип сервиса argocd-server на ClusterIP и пустить его через Traefik как Ingress, как и все остальные сервисы:

```bash
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "ClusterIP"}}'
```

Плюс отключить внутренний TLS у ArgoCD, чтобы избежать конфликтов с Traefik:

```yaml
data:
  server.insecure: "true"
```

### 2. Секреты в открытом виде в git

Plain-text пароли в манифестах — очевидно плохая идея.

**Решение:** [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets). Утилита `kubeseal` шифрует Secret публичным ключом контроллера — расшифровать может только контроллер внутри кластера. Зашифрованный `SealedSecret` безопасно коммитить в git.

```bash
kubectl create secret generic my-secret \
  --from-literal=password=реальный_пароль \
  --dry-run=client -o yaml | \
kubeseal \
  --controller-name sealed-secrets \
  --controller-namespace kube-system \
  --format yaml > my-sealed-secret.yaml
```

**Важно:** сделать бэкап мастер-ключа и хранить его отдельно. Если пересоздать кластер без бэкапа — старые SealedSecrets не расшифровать:

```bash
kubectl get secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > sealed-secrets-master-key-backup.yaml
```

### 3. mktxp не стартует — Read-only filesystem

mktxp при запуске пытается обновить конфиг-файлы, добавив новые ключи из свежей версии. Но файлы примонтированы из ConfigMap/Secret — они read-only.

**Решение:** initContainer копирует конфиги в `emptyDir` (rw) перед стартом основного контейнера. mktxp работает уже с копиями и может их изменять.

```yaml
initContainers:
  - name: copy-config
    image: busybox:1.36
    command:
      - sh
      - -c
      - |
        cp /config-global/_mktxp.conf /mktxp-config/_mktxp.conf
        cp /config-router/mktxp.conf /mktxp-config/mktxp.conf
        chown 1000:1000 /mktxp-config/*
        chmod 644 /mktxp-config/*
```

Также выяснилось, что нужно явно прописать все новые ключи в `_mktxp.conf` (включая `compact_default_conf_values`) — иначе mktxp падает с `KeyError`.

### 4. Дашборды Grafana — Datasource not found

Дашборды с grafana.com используют переменную `${DS_PROMETHEUS}` вместо реального имени datasource. Grafana не может её разрезолвить.

**Решение:** заменить перед созданием ConfigMap:

```bash
sed -i 's/\${DS_PROMETHEUS}/Prometheus/g' dashboard.json
```

---

## Итог

Текущий стек мониторинга:

|Компонент|Назначение|
|---|---|
|Prometheus|Сбор и хранение метрик (30 дней)|
|Grafana|Визуализация|
|node-exporter (DaemonSet)|Метрики нод кластера|
|node-exporter (external)|Метрики внешних VPS (fi, ru)|
|mktxp|Метрики MikroTik-роутера|

Внешние машины опрашиваются напрямую по домену — порт 9100 открыт только для IP сервера кластера. Возможно, в будущем заменю это на туннелирование, но пока достаточно.

Все сервисы доступны по HTTPS через Traefik + cert-manager + Let's Encrypt. Валидация — HTTP-01 (белый IP, порты 80/443 проброшены с MikroTik). Сертификаты обновляются автоматически — cert-manager следит за сроком и перевыпускает заранее.