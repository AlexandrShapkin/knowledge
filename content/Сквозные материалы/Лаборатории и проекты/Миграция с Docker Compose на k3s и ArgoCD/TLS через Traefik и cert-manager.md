---
title: TLS через Traefik и cert-manager
draft: false
tags:
  - traefik
  - cert-manager
  - tls
  - kubernetes
---

## Цепочка: интернет → роутер → Traefik → сервис

![[!assets/Схема работы TLS через Traefik.png]]

## Как cert-manager получает сертификат

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

## Почему Traefik, а не NGINX

k3s включает Traefik из коробки — он уже настроен и занял порты 80/443. Traefik автоматически читает объекты `Ingress` из всех namespace и настраивает маршрутизацию без перезапуска.

## Связанные заметки

- [[index|Миграция с Docker Compose на k3s и ArgoCD]]
