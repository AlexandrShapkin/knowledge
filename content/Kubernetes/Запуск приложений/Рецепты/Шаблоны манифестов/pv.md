---
title: pv
draft: false
tags:
  -
---
```yaml
apiVersion: v1
kind: PersistentVolume

metadata:
  name: <pv-name>

spec:
  capacity:
    storage: 1Gi

  accessModes:
    - ReadWriteOnce

  persistentVolumeReclaimPolicy: Retain

  hostPath:
    path: <host-path>
```

```bash
kubectl apply -f pv.yaml
kubectl get pv
kubectl describe pv <pv-name>
kubectl delete -f pv.yaml
```