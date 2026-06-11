---
title: deployment
draft: false
tags:
  -
---
```yaml
apiVersion: apps/v1
kind: Deployment

metadata:
  name: <deployment-name>

spec:
  replicas: 1

  selector:
    matchLabels:
      app: <app-name>

  template:
    metadata:
      labels:
        app: <app-name>

    spec:
      containers:
        - name: <container-name>

          image: <image>:<tag>

          imagePullPolicy: IfNotPresent

          ports:
            - containerPort: <container-port>

          volumeMounts:
            - name: <volume-name>
              mountPath: <mount-path>

          livenessProbe:
            httpGet:
              path: /health
              port: <container-port>

            initialDelaySeconds: 10
            periodSeconds: 10

          readinessProbe:
            httpGet:
              path: /health
              port: <container-port>

            initialDelaySeconds: 5
            periodSeconds: 5

      volumes:
        - name: <volume-name>

          persistentVolumeClaim:
            claimName: <pvc-name>
```

```bash
kubectl apply -f deployment.yaml
kubectl get deployments
kubectl get pods
kubectl describe deployment <deployment-name>
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl delete -f deployment.yaml
kubectl rollout restart deployment <deployment-name>
kubectl scale deployment <deployment-name> --replicas=3
```