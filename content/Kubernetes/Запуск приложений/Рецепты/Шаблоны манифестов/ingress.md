---
title: ingress
draft: false
tags:
  - kubernetes
  - manifest
  - ingress
---
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress

metadata:
  name: <ingress-name>

spec:
  rules:
    - host: <host-name>

      http:
        paths:
          - path: /
            pathType: Prefix

            backend:
              service:
                name: <service-name>

                port:
                  number: 80
```

```bash
kubectl apply -f ingress.yaml
kubectl get ingress
kubectl describe ingress <ingress-name>
kubectl delete -f ingress.yaml
```

```bash
kubectl get pods -A
kubectl get svc -A
```
