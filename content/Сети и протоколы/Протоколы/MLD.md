---
title: Протокол MLD
draft: false
tags:
  - computer-networks
  - tcp/ip
  - internet-layer
---
**MLD (Multicast Listener Discovery)** — это **вспомогательный протокол сетевого уровня (Layer 3)** модели **[OSI](../../Сети%20и%20протоколы/Модели/OSI.md)**, предназначенный для **управления членством узлов в multicast-группах в IPv6-сетях**.  
MLD используется хостами и маршрутизаторами для **обмена сообщениями о присоединении и выходе из IPv6-мультикаст-групп**, аналогично тому, как **[IGMP](IGMP.md)** работает в IPv4.

В модели **[TCP-IP](../../Сети%20и%20протоколы/Модели/TCP-IP.md)** MLD входит в **сетевой уровень (Internet Layer)** и реализован как часть **[ICMPv6](ICMP.md#icmpv6-internet-control-message-protocol-for-ipv6)** (Protocol = 58).

---
## Основные функции
- Регистрация хоста в multicast-группе (Join).
- Уведомление маршрутизатора о выходе из группы (Leave).
- Проверка активности участников (Query / Report цикл).
- Контроль доставки multicast-трафика в пределах IPv6-линка.

---
## Основные характеристики
- **Основан на ICMPv6** (в отличие от IGMP, который — отдельный протокол поверх IP).
- **Используется только с IPv6.**
- **Работает в пределах локального сегмента (link-local scope)**.
- **Версии:**
    - **MLDv1 ([RFC 2710](https://www.rfc-editor.org/rfc/rfc2710.html))** — базовая функциональность, аналог IGMPv2.
    - **MLDv2 ([RFC 3810](https://www.rfc-editor.org/rfc/rfc3810.html))** — поддержка Source-Specific Multicast (SSM), аналог IGMPv3.
- **Адрес назначения:** `ff02::16` — все маршрутизаторы, поддерживающие MLD.

---
## Основные типы сообщений

|Тип ICMPv6|Название|Назначение|Отправитель|
|---|---|---|---|
|**130**|Multicast Listener Query|Запрос маршрутизатора об активных группах|Маршрутизатор|
|**131**|Multicast Listener Report|Сообщение о присоединении к группе|Хост|
|**132**|Multicast Listener Done|Уведомление о выходе из группы|Хост|
|**143**|Multicast Listener Report v2|Расширенный отчёт (MLDv2, SSM)|Хост|

---
## Формат пакета MLDv1

|Поле|Размер (бит)|Описание|
|---|---|---|
|**Type**|8|Тип сообщения (130–132)|
|**Code**|8|Всегда 0|
|**Checksum**|16|Контрольная сумма ICMPv6|
|**Maximum Response Delay**|16|Максимальная задержка ответа|
|**Reserved**|16|Зарезервировано|
|**Multicast Address**|128|IPv6 multicast-адрес группы|

---
## Принцип работы
1. **Маршрутизатор** периодически отправляет **Multicast Listener Query** на `ff02::1` (все узлы).
2. **Хосты**, подписанные на multicast-группы, отвечают **Multicast Listener Report** с адресом своей группы.
3. Если хост **покидает группу**, он отправляет **Multicast Listener Done**.
4. **Маршрутизатор** отправляет **Group-Specific Query**, чтобы проверить, остались ли другие слушатели.
5. Если ответов нет — доставка multicast-трафика для этой группы прекращается.

---
## Пример взаимодействия
```
Host A → Router: MLD Report (Join ff15::1234)
Router → LAN: IPv6 multicast data forwarded to ff15::1234
Router → LAN: MLD Query (ff02::1)
Host A → Router: MLD Report (still interested)
Host A → Router: MLD Done (ff15::1234)
Router → LAN: Group-Specific Query (ff15::1234)
Router: No response → stops forwarding
```

---
## MLDv2 (RFC 3810)
- Поддерживает **Source-Specific Multicast (SSM)**.
- Хост может указать список источников, **от которых хочет или не хочет** получать поток.
- Два режима фильтрации:
    - **Include mode** — принимать только от указанных источников.
    - **Exclude mode** — принимать от всех, кроме указанных источников.
- Использует **Multicast Listener Report v2 (Type = 143)**, содержащий список групп и источников.

---
## Инкапсуляция и адресация

|Параметр|Значение|
|---|---|
|Протокол верхнего уровня|ICMPv6 (Protocol = 58)|
|IPv6-адрес источника|Link-local адрес (`fe80::/10`)|
|IPv6-адрес назначения|`ff02::1` (все узлы) или `ff02::16` (все маршрутизаторы)|
|MAC-адрес multicast|33:33:xx:xx:xx:xx (низшие 32 бита IPv6 multicast-адреса)|

---
## Диагностика и управление

|Утилита|Назначение|
|---|---|
|`ip -6 maddr show`|Просмотр IPv6 multicast-групп|
|`netstat -g`|Список multicast-групп IPv4 и IPv6|
|`tcpdump -n icmp6 and ip6[40]==130`|Анализ MLD Query|
|`tcpdump -n icmp6 and ip6[40]==143`|Анализ MLDv2 Report|
|`ssmping6`|Проверка Source-Specific Multicast по IPv6|
|`smcroute`|Управление статическими multicast-маршрутами|

**Пример:**
```
$ sudo tcpdump -n -i eth0 icmp6 and ip6[40]==130
fe80::1 > ff02::1: [icmp6 sum ok] MLD Query (max resp delay 10.0s)
```

---
## Безопасность
- MLD не содержит аутентификации — возможны spoofed Report/Done-пакеты.
- Возможны DoS-атаки путём создания большого количества multicast-групп.
- Рекомендуется:
    - Использовать **MLD Snooping** на коммутаторах.
    - Ограничивать TTL (Hop Limit = 1).
    - Применять фильтрацию multicast-трафика на границе VLAN/подсетей.

---
## Применение

|Область|Пример|
|---|---|
|**IPv6 IPTV**|Управление потоками каналов|
|**Multimedia streaming**|Распространение контента по SSM|
|**Служебные протоколы IPv6**|ND, DHCPv6, Router Advertisement используют multicast|
|**IoT / Smart devices**|Синхронное обновление или командная рассылка|

---
## Сравнение IGMP и MLD

|Характеристика|**IGMP**|**MLD**|
|---|---|---|
|Протокол|Отдельный (IP Protocol = 2)|Часть ICMPv6 (Protocol = 58)|
|Версии|v1, v2, v3|v1, v2|
|Поддержка SSM|IGMPv3|MLDv2|
|IP-версия|IPv4|IPv6|
|Адреса управления|224.0.0.x|ff02::x|
|Аналог на L2|IGMP Snooping|MLD Snooping|

---
## Связь с другими компонентами IPv6
- **MLD** — основа **IPv6 multicast membership management**.
- **ICMPv6** — базовый транспортный механизм.
- **Neighbor Discovery (ND)** и **Router Discovery** также используют multicast, но с другими типами ICMPv6-сообщений.