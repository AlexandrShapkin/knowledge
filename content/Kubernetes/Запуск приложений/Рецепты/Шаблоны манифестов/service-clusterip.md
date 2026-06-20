---
title: service-clusterip
draft: false
tags:
  - kubernetes
  - manifest
  - service
  - clusterip
---
```yaml
apiVersion: v1
kind: Service

metadata:
  name: <service-name>

spec:
  type: ClusterIP

  selector:
    app: <app-name>

  ports:
    - port: 80
      targetPort: <container-port>
```

```bash
kubectl apply -f service-clusterip.yaml
kubectl get svc
kubectl describe svc <service-name>
kubectl get endpoints
kubectl delete -f service-clusterip.yaml
```