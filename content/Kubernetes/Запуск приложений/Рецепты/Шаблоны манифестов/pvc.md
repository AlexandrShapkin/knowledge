---
title: pvc
draft: false
tags:
  -
---
```yaml
apiVersion: v1
kind: PersistentVolumeClaim

metadata:
  name: <pvc-name>

spec:
  accessModes:
    - ReadWriteOnce

  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f pvc.yaml
kubectl get pvc
kubectl describe pvc <pvc-name>
kubectl delete -f pvc.yaml
```

```bash
kubectl get pv
kubectl get pvc
```