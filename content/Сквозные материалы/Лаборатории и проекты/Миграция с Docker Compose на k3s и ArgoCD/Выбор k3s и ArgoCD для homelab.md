---
title: Выбор k3s и ArgoCD для homelab
draft: false
tags:
  - kubernetes
  - k3s
  - argocd
  - gitops
  - homelab
---

**[k3s](https://k3s.io/)** — лёгкий дистрибутив [Kubernetes](https://kubernetes.io/) от [Rancher](https://www.rancher.com/), заточенный под edge и homelab. Из коробки идёт с [Traefik](https://traefik.io/traefik) как ingress controller и local-path provisioner для хранилища. Не нужно разбираться с kubeadm и ручной настройкой компонентов. Поскольку у меня Single-Node кластер, полноценный k8s был бы избыточным.

**[ArgoCD](https://argoproj.github.io/cd/)** — GitOps-инструмент: читает манифесты из git-репозитория и приводит состояние кластера в соответствие с ними. Изменение инфраструктуры = коммит в репо. ArgoCD сам следит за расхождениями и восстанавливает их.

В качестве первого сервиса выбрана **[Grafana](https://grafana.com/)**: есть реальная потребность в мониторинге, а сам стек нетривиальный — помимо Grafana нужен [Prometheus](https://prometheus.io/), что делает задачу хорошей практикой. Можно было взять готовый [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack), который разворачивает всё сам, но тогда практической ценности было бы значительно меньше.

## Связанные заметки

- [[index|Миграция с Docker Compose на k3s и ArgoCD]]
