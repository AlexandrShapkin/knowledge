---
title: Go multistage Dockerfile template
draft: false
tags:
  -
---


```Dockerfile
FROM golang:<go version> AS builder

WORKDIR /path/to/app

COPY go.mod .

RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o <bin> ./path/to/main

FROM alpine:<alpine version>

WORKDIR /path/to/app

COPY --from=builder /path/to/bin .
# COPY --from=builder /path/to/data ./path/to/data

EXPOSE <port>

CMD [ "./<bin>" ]
```