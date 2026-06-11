---
title: service-nodeport
draft: false
tags:
  -
---
```yaml
apiVersion: v1
kind: Service

metadata:
  name: <service-name>

spec:
  type: NodePort

  selector:
    app: <app-name>

  ports:
    - port: 80
      targetPort: <container-port>
      nodePort: <node-port>
```

```bash
kubectl apply -f service-nodeport.yaml
kubectl get svc
kubectl describe svc <service-name>
kubectl delete -f service-nodeport.yaml
```